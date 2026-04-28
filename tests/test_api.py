import os
import tempfile
import unittest


TEST_DB = tempfile.NamedTemporaryFile(prefix="where_to_eat_test_", suffix=".db").name
os.environ["SQLITE_PATH"] = TEST_DB
os.environ["USE_MOCK_FALLBACK"] = "true"
os.environ["USE_MOCK_REVIEW_FALLBACK"] = "false"
os.environ["AMAP_API_KEY"] = ""
os.environ["ADMIN_TOKEN"] = "test-admin"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


class ApiRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)
        cls.admin_headers = {"X-Admin-Token": "test-admin"}

    def setUp(self) -> None:
        self.client.post("/api/admin/reset-data", headers=self.admin_headers)

    def recommendation_payload(self, scene: str = "宿舍聚餐") -> dict:
        return {
            "location": {"lat": 31.2304, "lng": 121.4737},
            "category": "烧烤",
            "budget": "50以内",
            "distance": "步行10分钟内",
            "scene": scene,
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

    def test_review_import_appends_and_deduplicates(self) -> None:
        self.client.post("/api/recommend/restaurants", json=self.recommendation_payload())
        payload = {
            "restaurant_id": "r001",
            "format": "json",
            "mode": "append",
            "content": '[{"rating": 5, "content": "羊肉串不错，分量足", "days_ago": 1}]',
        }

        first = self.client.post("/api/reviews/import", json=payload)
        second = self.client.post("/api/reviews/import", json=payload)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["imported_count"], 1)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["imported_count"], 0)

    def test_review_import_deduplicates_within_same_payload(self) -> None:
        self.client.post("/api/recommend/restaurants", json=self.recommendation_payload())
        response = self.client.post(
            "/api/reviews/import",
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
            json={
                "restaurant_id": "r001",
                "format": "json",
                "content": '[{"rating": 5, "content": " ", "days_ago": 1}]',
            },
        )

        self.assertEqual(response.status_code, 400)

    def test_admin_dashboard_requires_token(self) -> None:
        unauthorized = self.client.get("/api/admin/dashboard")
        authorized = self.client.get("/api/admin/dashboard", headers=self.admin_headers)

        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(authorized.status_code, 200)


if __name__ == "__main__":
    unittest.main()
