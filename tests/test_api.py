import os
import sqlite3
import tempfile
import unittest
from urllib.parse import quote


TEST_DB = tempfile.NamedTemporaryFile(prefix="where_to_eat_test_", suffix=".db").name
os.environ["SQLITE_PATH"] = TEST_DB
os.environ["USE_MOCK_FALLBACK"] = "true"
os.environ["USE_MOCK_REVIEW_FALLBACK"] = "false"
os.environ["AMAP_API_KEY"] = ""
os.environ["ADMIN_TOKEN"] = "test-admin"

from fastapi.testclient import TestClient  # noqa: E402

from app.api.routes import _feedback_rate_limit_hits, service  # noqa: E402
from app.clients.amap import AmapClient, AmapRestaurantCandidate  # noqa: E402
from app.data.mock_restaurants import MOCK_RESTAURANTS  # noqa: E402
from app.db.sqlite import SQLiteStore  # noqa: E402
from app.main import app  # noqa: E402


class ApiRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app, headers={"X-Admin-Token": "test-admin"})
        cls.admin_headers = {"X-Admin-Token": "test-admin"}

    def setUp(self) -> None:
        _feedback_rate_limit_hits.clear()
        service.restaurant_cache.clear()
        service.source_service._candidate_cache.clear()
        self.client.post("/api/admin/reset-data", headers=self.admin_headers)

    def recommendation_payload(self, scene: str = "宿舍聚餐") -> dict:
        return {
            "location": {"lat": 31.2304, "lng": 121.4737},
            "category": "烧烤",
            "budget": "50以内",
            "distance": "步行10分钟内",
            "scene": scene,
        }

    def amap_restaurant(self, restaurant_id: str) -> dict:
        return {
            **MOCK_RESTAURANTS[0],
            "id": restaurant_id,
            "external_id": restaurant_id.removeprefix("amap_"),
            "source": "amap",
            "raw_type": "餐饮服务",
            "avg_price_known": True,
            "lng": 121.474,
            "lat": 31.231,
            "walking_minutes": 10,
            "riding_minutes": 3,
        }

    def test_scene_filter_keeps_matching_restaurants(self) -> None:
        response = self.client.post(
            "/api/recommend/restaurants",
            json=self.recommendation_payload(scene="宿舍聚餐"),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)

    def test_scene_filter_excludes_low_match_restaurants(self) -> None:
        response = self.client.post(
            "/api/recommend/restaurants",
            json=self.recommendation_payload(scene="约会"),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 0)

    def test_custom_budget_range_overrides_budget_preset(self) -> None:
        payload = {
            **self.recommendation_payload(),
            "budget": "70以上",
            "budget_min": 40,
            "budget_max": 50,
        }

        response = self.client.post("/api/recommend/restaurants", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["list"][0]["restaurant_id"], "r001")

    def test_custom_budget_range_filters_restaurants_outside_range(self) -> None:
        payload = {
            **self.recommendation_payload(),
            "budget_min": 50,
            "budget_max": 60,
        }

        response = self.client.post("/api/recommend/restaurants", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 0)

    def test_custom_budget_range_rejects_invalid_bounds(self) -> None:
        payload = {
            **self.recommendation_payload(),
            "budget_min": 80,
            "budget_max": 40,
        }

        response = self.client.post("/api/recommend/restaurants", json=payload)

        self.assertEqual(response.status_code, 422)

    def test_recommendation_persists_amap_restaurant_to_sqlite(self) -> None:
        restaurant = self.amap_restaurant("amap_persisted")
        original_fetch_candidates = service.source_service.fetch_candidates

        def fake_fetch_candidates(
            *, lat: float, lng: float, category: str
        ) -> tuple[list[dict], str]:
            return [restaurant], "amap"

        service.source_service.fetch_candidates = fake_fetch_candidates
        try:
            response = self.client.post(
                "/api/recommend/restaurants",
                json=self.recommendation_payload(),
            )
        finally:
            service.source_service.fetch_candidates = original_fetch_candidates

        cached = service.store.fetch_restaurant("amap_persisted")
        service.restaurant_cache.clear()
        detail = self.client.get("/api/restaurants/amap_persisted")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["list"][0]["restaurant_id"], "amap_persisted")
        self.assertIsNotNone(cached)
        self.assertEqual(cached["source"], "amap")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["restaurant_id"], "amap_persisted")

    def test_recommendation_batches_restaurant_upserts(self) -> None:
        restaurants = [
            self.amap_restaurant(f"amap_batch_{index}")
            for index in range(3)
        ]
        original_fetch_candidates = service.source_service.fetch_candidates
        original_upsert = service.store.upsert_restaurants
        upsert_sizes: list[int] = []

        def fake_fetch_candidates(
            *, lat: float, lng: float, category: str
        ) -> tuple[list[dict], str]:
            return restaurants, "amap"

        def counting_upsert(items: list[dict]) -> None:
            upsert_sizes.append(len(items))
            original_upsert(items)

        service.source_service.fetch_candidates = fake_fetch_candidates
        service.store.upsert_restaurants = counting_upsert
        try:
            response = self.client.post(
                "/api/recommend/restaurants",
                json=self.recommendation_payload(),
            )
        finally:
            service.source_service.fetch_candidates = original_fetch_candidates
            service.store.upsert_restaurants = original_upsert

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 3)
        returned_ids = [item["restaurant_id"] for item in response.json()["list"]]
        self.assertEqual(set(returned_ids), {item["id"] for item in restaurants})
        for restaurant_id in returned_ids:
            self.assertIn(restaurant_id, service.restaurant_cache)
            self.assertIsNotNone(service.store.fetch_restaurant(restaurant_id))
        service.restaurant_cache.clear()
        for restaurant_id in returned_ids:
            self.assertEqual(
                self.client.get(f"/api/restaurants/{restaurant_id}").status_code,
                200,
            )
        self.assertEqual(upsert_sizes, [3])

    def test_candidate_source_cache_reuses_amap_results(self) -> None:
        original_api_key = service.source_service.amap_client.api_key
        original_search = service.source_service.amap_client.search_nearby_restaurants
        calls: list[str] = []

        def fake_search_nearby_restaurants(
            *,
            lat: float,
            lng: float,
            keyword: str,
            radius_meters: int,
            page_size: int,
            page_count: int = 1,
        ) -> list[AmapRestaurantCandidate]:
            calls.append(keyword)
            return [
                AmapRestaurantCandidate(
                    source_id=f"{keyword}-001",
                    name=f"{keyword}测试店",
                    category=keyword,
                    address="大学城测试街",
                    raw_type="餐饮服务",
                    avg_price=35,
                    business_hours="10:00-22:00",
                    distance_meters=600,
                    lng=121.474,
                    lat=31.231,
                )
            ]

        service.source_service.amap_client.api_key = "test-key"
        service.source_service.amap_client.search_nearby_restaurants = (
            fake_search_nearby_restaurants
        )
        try:
            first, first_source = service.source_service.fetch_candidates(
                lat=31.2304,
                lng=121.4737,
                category="烧烤",
            )
            service.source_service._candidate_cache.clear()
            second, second_source = service.source_service.fetch_candidates(
                lat=31.23042,
                lng=121.47372,
                category="烧烤",
            )
        finally:
            service.source_service.amap_client.api_key = original_api_key
            service.source_service.amap_client.search_nearby_restaurants = original_search

        self.assertEqual(first_source, "amap")
        self.assertEqual(second_source, "amap")
        self.assertEqual(len(first), len(second))
        self.assertEqual(len(calls), 3)

    def test_restaurant_detail_recovers_from_search_context_when_cache_is_cold(self) -> None:
        restaurant = self.amap_restaurant("amap_first_click")
        original_fetch_candidates = service.source_service.fetch_candidates

        def fake_fetch_candidates(
            *, lat: float, lng: float, category: str
        ) -> tuple[list[dict], str]:
            self.assertEqual(lat, 31.2304)
            self.assertEqual(lng, 121.4737)
            self.assertEqual(category, "烧烤")
            return [restaurant], "amap"

        service.source_service.fetch_candidates = fake_fetch_candidates
        try:
            response = self.client.get(
                "/api/restaurants/amap_first_click",
                params={"lat": 31.2304, "lng": 121.4737, "category": "烧烤"},
            )
        finally:
            service.source_service.fetch_candidates = original_fetch_candidates

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["restaurant_id"], "amap_first_click")
        self.assertEqual(response.json()["source"], "amap")

    def test_restaurant_detail_fetches_amap_detail_when_cache_is_cold(self) -> None:
        original_api_key = service.source_service.amap_client.api_key
        original_fetch_detail = service.source_service.amap_client.fetch_restaurant_detail

        def fake_fetch_detail(source_id: str) -> AmapRestaurantCandidate:
            self.assertEqual(source_id, "amap_B0FFISHH14")
            return AmapRestaurantCandidate(
                source_id="B0FFISHH14",
                name="测试烧烤店",
                category="餐饮服务;中餐厅;烧烤",
                address="大学城测试街 14 号",
                raw_type="餐饮服务;中餐厅;烧烤",
                avg_price=42,
                business_hours="10:00-22:00",
                distance_meters=0,
                lng=121.474,
                lat=31.231,
            )

        service.source_service.amap_client.api_key = "test-key"
        service.source_service.amap_client.fetch_restaurant_detail = fake_fetch_detail
        try:
            response = self.client.get("/api/restaurants/amap_B0FFISHH14")
        finally:
            service.source_service.amap_client.api_key = original_api_key
            service.source_service.amap_client.fetch_restaurant_detail = original_fetch_detail

        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["restaurant_id"], "amap_B0FFISHH14")
        self.assertEqual(body["name"], "测试烧烤店")
        self.assertEqual(body["category"], "烧烤")
        self.assertIsNotNone(service.store.fetch_restaurant("amap_B0FFISHH14"))

    def test_amap_detail_client_parses_v5_detail_payload(self) -> None:
        class FakeResponse:
            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict:
                return {
                    "status": "1",
                    "pois": {
                        "poi": {
                            "id": "B0FFISHH14",
                            "name": "测试烧烤店",
                            "type": "餐饮服务;中餐厅;烧烤",
                            "address": "大学城测试街 14 号",
                            "location": "121.474,31.231",
                            "business": {
                                "cost": "42",
                                "opentime_today": "10:00-22:00",
                            },
                        }
                    },
                }

        class FakeClient:
            def get(self, url: str, params: dict) -> FakeResponse:
                self.url = url
                self.params = params
                return FakeResponse()

        fake_client = FakeClient()
        amap_client = AmapClient()
        amap_client.api_key = "test-key"
        amap_client._client = fake_client

        candidate = amap_client.fetch_restaurant_detail("B0FFISHH14")

        self.assertIsNotNone(candidate)
        self.assertEqual(fake_client.url, AmapClient.detail_url)
        self.assertEqual(fake_client.params["id"], "B0FFISHH14")
        self.assertEqual(candidate.name, "测试烧烤店")
        self.assertEqual(candidate.avg_price, 42)
        self.assertEqual(candidate.lng, 121.474)
        self.assertEqual(candidate.lat, 31.231)

    def test_restaurant_detail_accepts_encoded_slash_in_restaurant_id(self) -> None:
        restaurant_id = "amap_first/click"
        service.restaurant_cache[restaurant_id] = self.amap_restaurant(restaurant_id)

        response = self.client.get(f"/api/restaurants/{quote(restaurant_id, safe='')}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["restaurant_id"], restaurant_id)

    def test_restaurant_detail_returns_coordinates_from_recommendation(self) -> None:
        recommendation = self.client.post(
            "/api/recommend/restaurants",
            json=self.recommendation_payload(),
        ).json()
        restaurant = recommendation["list"][0]

        response = self.client.get(f"/api/restaurants/{restaurant['restaurant_id']}")
        detail = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(detail["lng"], restaurant["lng"])
        self.assertEqual(detail["lat"], restaurant["lat"])

    def test_review_import_appends_and_deduplicates(self) -> None:
        self.client.post("/api/recommend/restaurants", json=self.recommendation_payload())
        payload = {
            "restaurant_id": "r001",
            "format": "json",
            "mode": "append",
            "content": '[{"rating": 5, "content": "羊肉串不错，分量足", "days_ago": 1}]',
        }

        first = self.client.post(
            "/api/reviews/import",
            json=payload,
            headers=self.admin_headers,
        )
        second = self.client.post(
            "/api/reviews/import",
            json=payload,
            headers=self.admin_headers,
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["imported_count"], 1)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["imported_count"], 0)

    def test_review_import_deduplicates_within_same_payload(self) -> None:
        self.client.post("/api/recommend/restaurants", json=self.recommendation_payload())
        response = self.client.post(
            "/api/reviews/import",
            headers=self.admin_headers,
            json={
                "restaurant_id": "r001",
                "format": "json",
                "mode": "append",
                "content": (
                    "["
                    '{"rating": 5, "content": "羊肉串不错，分量足", "days_ago": 1},'
                    '{"rating": 5, "content": "羊肉串不错，分量足", "days_ago": 1}'
                    "]"
                ),
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["imported_count"], 1)

    def test_review_import_rejects_empty_content(self) -> None:
        self.client.post("/api/recommend/restaurants", json=self.recommendation_payload())
        response = self.client.post(
            "/api/reviews/import",
            headers=self.admin_headers,
            json={
                "restaurant_id": "r001",
                "format": "json",
                "content": '[{"rating": 5, "content": " ", "days_ago": 1}]',
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_review_import_requires_admin_token(self) -> None:
        self.client.post("/api/recommend/restaurants", json=self.recommendation_payload())
        payload = {
            "restaurant_id": "r001",
            "format": "json",
            "content": '[{"rating": 5, "content": "羊肉串不错，分量足", "days_ago": 1}]',
        }

        unauthorized = self.client.post("/api/reviews/import", json=payload, headers={"X-Admin-Token": ""})
        authorized = self.client.post(
            "/api/reviews/import",
            json=payload,
            headers=self.admin_headers,
        )

        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(authorized.status_code, 200)

    def test_review_visibility_toggle_hides_and_restores_public_review(self) -> None:
        self.client.post("/api/recommend/restaurants", json=self.recommendation_payload())
        self.client.post(
            "/api/reviews/import",
            headers=self.admin_headers,
            json={
                "restaurant_id": "r001",
                "format": "json",
                "content": '[{"rating": 5, "content": "羊肉串不错，分量足", "days_ago": 1}]',
            },
        )
        dashboard = self.client.get("/api/admin/dashboard", headers=self.admin_headers)
        review = dashboard.json()["recent_reviews"][0]

        before_hide = self.client.get("/api/restaurants/r001")
        hide = self.client.patch(
            f"/api/admin/reviews/{review['review_id']}/visibility",
            headers=self.admin_headers,
            json={"is_visible": False},
        )
        after_hide = self.client.get("/api/restaurants/r001")
        hidden_dashboard = self.client.get(
            "/api/admin/dashboard",
            headers=self.admin_headers,
        )
        restore = self.client.patch(
            f"/api/admin/reviews/{review['review_id']}/visibility",
            headers=self.admin_headers,
            json={"is_visible": True},
        )
        after_restore = self.client.get("/api/restaurants/r001")

        self.assertEqual(before_hide.status_code, 200)
        self.assertEqual(len(before_hide.json()["reviews"]), 1)
        self.assertEqual(hide.status_code, 200)
        self.assertEqual(len(after_hide.json()["reviews"]), 0)
        self.assertFalse(hidden_dashboard.json()["recent_reviews"][0]["is_visible"])
        self.assertEqual(restore.status_code, 200)
        self.assertEqual(len(after_restore.json()["reviews"]), 1)

    def test_feedback_rejects_too_long_content(self) -> None:
        response = self.client.post(
            "/api/reviews/feedback",
            headers={"X-Forwarded-For": "203.0.113.10"},
            json={
                "restaurant_id": "r001",
                "rating": 4,
                "content": "很" * 501,
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_feedback_rate_limit_blocks_repeated_submissions(self) -> None:
        statuses = [
            self.client.post(
                "/api/reviews/feedback",
                headers={"X-Forwarded-For": "203.0.113.11"},
                json={
                    "restaurant_id": "r001",
                    "rating": 4,
                    "content": f"第 {index} 条反馈",
                },
            ).status_code
            for index in range(6)
        ]

        self.assertEqual(statuses[:5], [200, 200, 200, 200, 200])
        self.assertEqual(statuses[5], 429)

    def test_feedback_is_visible_in_immediate_detail_response(self) -> None:
        self.client.post("/api/recommend/restaurants", json=self.recommendation_payload())
        feedback = self.client.post(
            "/api/reviews/feedback",
            headers={"X-Forwarded-For": "203.0.113.12"},
            json={
                "restaurant_id": "r001",
                "rating": 4,
                "content": "刚吃完，烤茄子不错，排队也能接受",
            },
        )
        detail = self.client.get("/api/restaurants/r001")
        body = detail.json()

        self.assertEqual(feedback.status_code, 200)
        self.assertEqual(feedback.json()["review_count"], 1)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(body["review_count"], 1)
        self.assertEqual(len(body["reviews"]), 1)
        self.assertEqual(body["reviews"][0]["content"], "刚吃完，烤茄子不错，排队也能接受")

    def test_feedback_persists_restaurant_when_only_memory_cache_has_it(self) -> None:
        restaurant = self.amap_restaurant("amap_cache_only")
        service.restaurant_cache[restaurant["id"]] = restaurant
        self.assertIsNone(service.store.fetch_restaurant(restaurant["id"]))

        feedback = self.client.post(
            "/api/reviews/feedback",
            headers={"X-Forwarded-For": "203.0.113.13"},
            json={
                "restaurant_id": restaurant["id"],
                "rating": 5,
                "content": "第一次提交也能正常挂到这家高德店",
            },
        )
        detail = self.client.get(f"/api/restaurants/{restaurant['id']}")
        body = detail.json()

        self.assertEqual(feedback.status_code, 200)
        self.assertIsNotNone(service.store.fetch_restaurant(restaurant["id"]))
        self.assertEqual(body["review_count"], 1)
        self.assertEqual(body["reviews"][0]["content"], "第一次提交也能正常挂到这家高德店")

    def test_feedback_accepts_external_amap_id_and_uses_canonical_restaurant_id(self) -> None:
        restaurant = self.amap_restaurant("amap_external_only")
        service.restaurant_cache[restaurant["id"]] = restaurant

        feedback = self.client.post(
            "/api/reviews/feedback",
            headers={"X-Forwarded-For": "203.0.113.14"},
            json={
                "restaurant_id": "external_only",
                "rating": 4,
                "content": "小程序传高德原始 ID 也应该能写入",
            },
        )
        canonical_detail = self.client.get("/api/restaurants/amap_external_only").json()
        external_detail = self.client.get("/api/restaurants/external_only").json()

        self.assertEqual(feedback.status_code, 200)
        self.assertEqual(feedback.json()["restaurant_id"], "amap_external_only")
        self.assertEqual(canonical_detail["review_count"], 1)
        self.assertEqual(len(canonical_detail["reviews"]), 1)
        self.assertEqual(external_detail["restaurant_id"], "amap_external_only")
        self.assertEqual(external_detail["reviews"][0]["content"], "小程序传高德原始 ID 也应该能写入")

    def test_cached_restaurant_can_be_loaded_by_external_amap_id(self) -> None:
        restaurant = self.amap_restaurant("amap_external_db")
        service.store.upsert_restaurants([restaurant])
        service.restaurant_cache.clear()

        response = self.client.get("/api/restaurants/external_db")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["restaurant_id"], "amap_external_db")

    def test_detail_counts_reviews_saved_under_external_amap_id(self) -> None:
        restaurant = self.amap_restaurant("amap_legacy_external")
        service.store.upsert_restaurants([restaurant])
        service.store.append_review(
            "legacy_external",
            {
                "rating": 5,
                "content": "历史数据挂在高德原始 ID 下也要能显示",
                "days_ago": 0,
            },
        )

        response = self.client.get("/api/restaurants/amap_legacy_external")
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["review_count"], 1)
        self.assertEqual(len(body["reviews"]), 1)
        self.assertEqual(body["reviews"][0]["content"], "历史数据挂在高德原始 ID 下也要能显示")

    def test_sqlite_review_visibility_migration_defaults_existing_rows_visible(self) -> None:
        db_fd, db_path = tempfile.mkstemp(
            prefix="where_to_eat_migration_",
            suffix=".db",
        )
        os.close(db_fd)
        with sqlite3.connect(db_path) as connection:
            connection.execute(
                """
                CREATE TABLE imported_reviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    restaurant_id TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    days_ago INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                INSERT INTO imported_reviews (restaurant_id, rating, content, days_ago)
                VALUES ('r001', 5, '历史评价', 1)
                """
            )

        store = SQLiteStore(db_path=db_path)
        try:
            rows = store.fetch_reviews("r001")
        finally:
            store.close()

        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["is_visible"])

    def test_admin_dashboard_includes_restaurant_names_for_reviews(self) -> None:
        restaurant = {
            **self.amap_restaurant("amap_named_dashboard"),
            "name": "后台展示测试店",
        }
        service.store.upsert_restaurants([restaurant])
        service.store.append_review(
            "named_dashboard",
            {
                "rating": 4,
                "content": "后台最近评价应该直接看到店名",
                "days_ago": 0,
            },
        )

        response = self.client.get("/api/admin/dashboard", headers=self.admin_headers)
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            body["imported_restaurants"][0]["restaurant_name"],
            "后台展示测试店",
        )
        self.assertEqual(
            body["recent_reviews"][0]["restaurant_name"],
            "后台展示测试店",
        )
        self.assertEqual(body["recent_reviews"][0]["restaurant_id"], "named_dashboard")

    def test_admin_dashboard_requires_token(self) -> None:
        unauthorized = self.client.get("/api/admin/dashboard", headers={"X-Admin-Token": ""})
        authorized = self.client.get("/api/admin/dashboard", headers=self.admin_headers)

        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(authorized.status_code, 200)


if __name__ == "__main__":
    unittest.main()
