import math

from app.clients.amap import AmapClient
from app.core.config import settings
from app.data.mock_restaurants import MOCK_RESTAURANTS
from app.db.sqlite import SQLiteStore


class RestaurantSourceService:
    def __init__(self) -> None:
        self.amap_client = AmapClient()
        self.store = SQLiteStore()

    def fetch_candidates(self, *, lat: float, lng: float, category: str) -> tuple[list[dict], str]:
        if self.amap_client.is_configured():
            candidates = self._fetch_from_amap(lat=lat, lng=lng, category=category)
            if candidates:
                self.store.upsert_restaurants(candidates)
                return candidates, "amap"

        if settings.use_mock_fallback:
            candidates = self._fetch_from_mock(lat=lat, lng=lng, category=category)
            self.store.upsert_restaurants(candidates)
            return candidates, "mock"
        return [], "none"

    def get_cached_restaurant(self, restaurant_id: str) -> dict | None:
        restaurant = self.store.fetch_restaurant(restaurant_id)
        if restaurant is None:
            return None
        return self._apply_default_signals(restaurant)

    def get_cached_restaurants(self) -> list[dict]:
        return self.store.list_cached_restaurants()

    def fetch_mock_candidates(self, *, lat: float, lng: float, category: str) -> list[dict]:
        candidates = self._fetch_from_mock(lat=lat, lng=lng, category=category)
        if candidates:
            self.store.upsert_restaurants(candidates)
        return candidates

    def _fetch_from_amap(self, *, lat: float, lng: float, category: str) -> list[dict]:
        restaurants = self.amap_client.search_nearby_restaurants(
            lat=lat,
            lng=lng,
            keyword=category,
            radius_meters=settings.amap_radius_meters,
            page_size=settings.amap_page_size,
        )
        return [self._normalize_amap_restaurant(item) for item in restaurants]

    def _fetch_from_mock(self, *, lat: float, lng: float, category: str) -> list[dict]:
        return [
            self._apply_default_signals(
                {
                    **item.copy(),
                    "source": "mock",
                    **self._mock_coordinates(
                        origin_lat=lat,
                        origin_lng=lng,
                        distance_meters=item["distance_meters"],
                        index=index,
                    ),
                }
            )
            for index, item in enumerate(MOCK_RESTAURANTS)
            if item["category"] == category
        ]

    def _normalize_amap_restaurant(self, restaurant) -> dict:
        avg_price = restaurant.avg_price
        value_signal = self._estimate_value_signal(avg_price)
        portion_signal = 78 if avg_price <= 50 else 70
        normalized = {
            "id": f"amap_{restaurant.source_id}",
            "external_id": restaurant.source_id,
            "source": "amap",
            "name": restaurant.name,
            "category": restaurant.category,
            "address": restaurant.address,
            "avg_price": avg_price,
            "business_hours": restaurant.business_hours,
            "distance_meters": restaurant.distance_meters,
            "lng": restaurant.lng,
            "lat": restaurant.lat,
            "positive_signals": 72,
            "negative_intensity": 28,
            "detail_richness": 52,
            "trend_score": 65,
            "template_risk": 20,
            "time_anomaly": 15,
            "high_score_detail": 58,
            "score_consistency": 68,
            "value_signal": value_signal,
            "portion_signal": portion_signal,
            "peak_risk": 35,
            "volatility": 30,
            "negative_focus": 60,
            "popular_dishes": [],
            "common_negatives": ["评论数据暂未接入"],
            "recommend_reasons": self._build_base_reasons(restaurant.distance_meters, avg_price),
            "warning_points": [
                "当前为地图基础数据评分，评论分析模块待接入",
            ],
            "recent_review_summary": [
                "当前店铺来自高德周边搜索，已完成距离和价格维度估算。",
                "评论抓取与近期口碑分析将在下一阶段接入。",
            ],
            "scene_fit": self._build_scene_fit(avg_price, restaurant.distance_meters),
        }
        return self._apply_default_signals(normalized)

    def _apply_default_signals(self, restaurant: dict) -> dict:
        restaurant.setdefault("external_id", None)
        restaurant.setdefault("source", "mock")
        restaurant.setdefault("lng", 121.4737)
        restaurant.setdefault("lat", 31.2304)
        restaurant.setdefault("positive_signals", 72)
        restaurant.setdefault("negative_intensity", 28)
        restaurant.setdefault("detail_richness", 52)
        restaurant.setdefault("trend_score", 65)
        restaurant.setdefault("template_risk", 20)
        restaurant.setdefault("time_anomaly", 15)
        restaurant.setdefault("high_score_detail", 58)
        restaurant.setdefault("score_consistency", 68)
        restaurant.setdefault("value_signal", self._estimate_value_signal(restaurant["avg_price"]))
        restaurant.setdefault("portion_signal", 78 if restaurant["avg_price"] <= 50 else 70)
        restaurant.setdefault("peak_risk", 35)
        restaurant.setdefault("volatility", 30)
        restaurant.setdefault("negative_focus", 60)
        restaurant.setdefault("popular_dishes", [])
        restaurant.setdefault("common_negatives", ["评论数据暂未接入"])
        restaurant.setdefault(
            "recommend_reasons",
            self._build_base_reasons(restaurant["distance_meters"], restaurant["avg_price"]),
        )
        restaurant.setdefault("warning_points", ["当前为基础信息缓存，评论分析会在详情页补充"])
        restaurant.setdefault(
            "recent_review_summary",
            ["当前店铺来自缓存基础信息，若存在评论数据会自动重新分析。"],
        )
        restaurant.setdefault(
            "scene_fit",
            self._build_scene_fit(restaurant["avg_price"], restaurant["distance_meters"]),
        )
        return restaurant

    def _estimate_value_signal(self, avg_price: int) -> int:
        if avg_price <= 20:
            return 90
        if avg_price <= 35:
            return 84
        if avg_price <= 50:
            return 76
        if avg_price <= 70:
            return 68
        return 58

    def _build_base_reasons(self, distance_meters: int, avg_price: int) -> list[str]:
        reasons: list[str] = []
        if distance_meters <= 1000:
            reasons.append("距离较近，适合快速决策")
        if avg_price <= 35:
            reasons.append("价格相对友好，符合学生预算")
        elif avg_price <= 50:
            reasons.append("价格处于可接受区间")
        else:
            reasons.append("更适合预算较宽松的场景")
        reasons.append("已接入真实周边搜索结果")
        return reasons

    def _build_scene_fit(self, avg_price: int, distance_meters: int) -> dict[str, str]:
        one_person = "高匹配" if avg_price <= 35 and distance_meters <= 1500 else "中匹配"
        dorm_group = "高匹配" if avg_price <= 60 else "中匹配"
        late_night = "高匹配" if distance_meters <= 1000 else "中匹配"
        date = "中匹配" if avg_price >= 50 else "低匹配"
        return {
            "一个人吃": one_person,
            "宿舍聚餐": dorm_group,
            "夜宵": late_night,
            "约会": date,
        }

    def _mock_coordinates(
        self,
        *,
        origin_lat: float,
        origin_lng: float,
        distance_meters: int,
        index: int,
    ) -> dict[str, float]:
        bearing_deg = (index * 83 + 25) % 360
        distance_km = max(distance_meters, 200) / 1000
        bearing = math.radians(bearing_deg)
        lat_offset = (distance_km / 111.32) * math.cos(bearing)
        lng_offset = (distance_km / (111.32 * max(math.cos(math.radians(origin_lat)), 0.2))) * math.sin(bearing)
        return {
            "lat": round(origin_lat + lat_offset, 6),
            "lng": round(origin_lng + lng_offset, 6),
        }
