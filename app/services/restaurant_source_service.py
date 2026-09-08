import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import time

from app.clients.amap import AmapClient
from app.core.config import settings
from app.core.pricing import estimate_value_base
from app.data.mock_restaurants import MOCK_RESTAURANTS
from app.db.sqlite import SQLiteStore


class RestaurantSourceService:
    CATEGORY_KEYWORDS = {
        "火锅": ["火锅", "重庆火锅", "牛肉火锅"],
        "烧烤": ["烧烤", "烤串", "烤肉"],
        "自助": ["自助", "自助餐", "海鲜自助", "烤肉自助"],
        "家常菜": ["家常菜", "本帮菜", "小炒"],
        "麻辣烫": ["麻辣烫", "麻辣拌"],
        "面食": ["面馆", "拉面", "拌面", "面食"],
        "奶茶甜品": ["奶茶", "甜品", "饮品", "糖水"],
    }
    def __init__(self, store: SQLiteStore | None = None) -> None:
        self.amap_client = AmapClient()
        self.store = store if store is not None else SQLiteStore()
        self._candidate_cache: dict[tuple[float, float, str], tuple[float, list[dict], str, dict]] = {}

    def close(self) -> None:
        self.amap_client.close()

    def prewarm_candidate_cache(self) -> None:
        if (
            not settings.recommendation_prewarm_enabled
            or not self.amap_client.is_configured()
        ):
            return
        for lat, lng in self._prewarm_locations():
            for category in self._prewarm_categories():
                try:
                    self.fetch_candidates(lat=lat, lng=lng, category=category)
                except Exception:
                    continue

    def fetch_candidates(self, *, lat: float, lng: float, category: str, radius_meters: int | None = None) -> tuple[list[dict], str]:
        if radius_meters is not None:
            if not self.amap_client.is_configured():
                return [], "none"
            restaurants = {}
            for keyword in self.CATEGORY_KEYWORDS.get(category, [category]):
                items = self.amap_client.search_nearby_restaurants(
                    lat=lat, lng=lng, keyword=keyword, radius_meters=radius_meters,
                    page_size=settings.amap_page_size, page_count=settings.amap_page_count,
                )
                for item in items:
                    restaurants[item.source_id] = self._normalize_amap_restaurant(item, category)
            candidates = sorted(restaurants.values(), key=lambda item: item["distance_meters"])
            self.store.upsert_restaurants(candidates)
            return candidates, "amap"
        candidates, source, _ = self._fetch_candidates_result(
            lat=lat,
            lng=lng,
            category=category,
        )
        return candidates, source

    def fetch_candidates_with_debug(
        self, *, lat: float, lng: float, category: str
    ) -> tuple[list[dict], str, dict]:
        return self._fetch_candidates_result(lat=lat, lng=lng, category=category)

    def _fetch_candidates_result(
        self, *, lat: float, lng: float, category: str
    ) -> tuple[list[dict], str, dict]:
        cache_key = self._candidate_cache_key(lat=lat, lng=lng, category=category)
        cached_result = self._get_candidate_cache(cache_key)
        if cached_result is not None:
            return cached_result

        if self.amap_client.is_configured():
            candidates, debug = self._fetch_from_amap_with_debug(
                lat=lat,
                lng=lng,
                category=category,
            )
            if candidates:
                self.store.upsert_restaurants(candidates)
                self._set_candidate_cache(cache_key, candidates, "amap", debug)
                return candidates, "amap", debug

        if settings.use_mock_fallback:
            candidates = self._fetch_from_mock(lat=lat, lng=lng, category=category)
            self.store.upsert_restaurants(candidates)
            debug = {
                "total_fetched": len(candidates),
                "total_after_dedupe": len(candidates),
                "keyword_stats": [],
            }
            self._set_candidate_cache(cache_key, candidates, "mock", debug)
            return candidates, "mock", debug
        return [], "none", {"total_fetched": 0, "total_after_dedupe": 0, "keyword_stats": []}

    def get_cached_restaurant(self, restaurant_id: str) -> dict | None:
        restaurant = self.store.fetch_restaurant(restaurant_id)
        if restaurant is None:
            return None
        return self._apply_default_signals(restaurant)

    def fetch_amap_restaurant_by_id(
        self,
        restaurant_id: str,
        *,
        category: str | None = None,
    ) -> dict | None:
        if not self._looks_like_amap_id(restaurant_id):
            return None
        candidate = self.amap_client.fetch_restaurant_detail(restaurant_id)
        if candidate is None:
            return None
        resolved_category = category or self._infer_category(candidate)
        restaurant = self._normalize_amap_restaurant(candidate, resolved_category)
        self.store.upsert_restaurants([restaurant])
        return restaurant

    def get_cached_restaurants(self) -> list[dict]:
        return self.store.list_cached_restaurants()

    def fetch_mock_candidates(self, *, lat: float, lng: float, category: str) -> list[dict]:
        candidates = self._fetch_from_mock(lat=lat, lng=lng, category=category)
        if candidates:
            self.store.upsert_restaurants(candidates)
        return candidates

    def _fetch_from_amap_with_debug(
        self, *, lat: float, lng: float, category: str
    ) -> tuple[list[dict], dict]:
        keywords = self.CATEGORY_KEYWORDS.get(category, [category])
        seen_ids: set[str] = set()
        restaurants = []
        keyword_stats: list[dict] = []
        total_fetched = 0
        for keyword, items in self._fetch_amap_keyword_results(
            lat=lat,
            lng=lng,
            keywords=keywords,
        ):
            total_fetched += len(items)
            before_count = len(seen_ids)
            for item in items:
                if item.source_id in seen_ids:
                    continue
                seen_ids.add(item.source_id)
                restaurants.append(self._normalize_amap_restaurant(item, category))
            keyword_stats.append(
                {
                    "keyword": keyword,
                    "fetched_count": len(items),
                    "deduped_new_count": len(seen_ids) - before_count,
                }
            )
            if len(restaurants) >= settings.amap_target_candidate_count:
                break
        restaurants.sort(key=lambda item: item["distance_meters"])
        return restaurants, {
            "total_fetched": total_fetched,
            "total_after_dedupe": len(restaurants),
            "keyword_stats": keyword_stats,
        }

    def _fetch_amap_keyword_results(
        self,
        *,
        lat: float,
        lng: float,
        keywords: list[str],
    ) -> list[tuple[str, list]]:
        max_workers = max(1, min(settings.amap_keyword_parallelism, len(keywords)))
        if max_workers == 1:
            return [
                (
                    keyword,
                    self._fetch_amap_keyword_candidates(lat=lat, lng=lng, keyword=keyword),
                )
                for keyword in keywords
            ]

        results: dict[str, list] = {}
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(
                    self._fetch_amap_keyword_candidates,
                    lat=lat,
                    lng=lng,
                    keyword=keyword,
                ): keyword
                for keyword in keywords
            }
            for future in as_completed(futures):
                keyword = futures[future]
                try:
                    results[keyword] = future.result()
                except Exception:
                    results[keyword] = []

        return [(keyword, results.get(keyword, [])) for keyword in keywords]

    def _fetch_amap_keyword_candidates(
        self,
        *,
        lat: float,
        lng: float,
        keyword: str,
    ) -> list:
        return self.amap_client.search_nearby_restaurants(
            lat=lat,
            lng=lng,
            keyword=keyword,
            radius_meters=settings.amap_radius_meters,
            page_size=settings.amap_page_size,
            page_count=settings.amap_page_count,
        )

    def _candidate_cache_key(
        self,
        *,
        lat: float,
        lng: float,
        category: str,
    ) -> tuple[float, float, str]:
        return (round(lat, 4), round(lng, 4), category)

    def _get_candidate_cache(
        self,
        cache_key: tuple[float, float, str],
    ) -> tuple[list[dict], str, dict] | None:
        ttl_seconds = settings.recommendation_candidate_cache_ttl_seconds
        if ttl_seconds <= 0:
            return None
        now = time()
        cached = self._candidate_cache.get(cache_key)
        if cached is not None:
            expires_at, candidates, source, debug = cached
            if expires_at > now and (source == "amap" or not self.amap_client.is_configured()):
                return self._copy_candidates(candidates), source, self._copy_debug(debug)
            self._candidate_cache.pop(cache_key, None)

        cached_row = self.store.fetch_candidate_cache(self._candidate_cache_id(cache_key))
        if cached_row is None:
            return None
        candidates = self._copy_candidates(cached_row["candidates"])
        debug = self._copy_debug(cached_row["debug"])
        source = cached_row["source"]
        if source != "amap" and self.amap_client.is_configured():
            return None
        self._candidate_cache[cache_key] = (
            cached_row["expires_at"],
            self._copy_candidates(candidates),
            source,
            self._copy_debug(debug),
        )
        return candidates, source, debug

    def _set_candidate_cache(
        self,
        cache_key: tuple[float, float, str],
        candidates: list[dict],
        source: str,
        debug: dict,
    ) -> None:
        if source != "amap" and self.amap_client.is_configured():
            return
        ttl_seconds = settings.recommendation_candidate_cache_ttl_seconds
        if ttl_seconds <= 0:
            return
        expires_at = time() + ttl_seconds
        self._candidate_cache[cache_key] = (
            expires_at,
            self._copy_candidates(candidates),
            source,
            self._copy_debug(debug),
        )
        self.store.upsert_candidate_cache(
            cache_key=self._candidate_cache_id(cache_key),
            lat=cache_key[0],
            lng=cache_key[1],
            category=cache_key[2],
            source=source,
            candidates=self._copy_candidates(candidates),
            debug=self._copy_debug(debug),
            ttl_seconds=ttl_seconds,
        )

    def _candidate_cache_id(self, cache_key: tuple[float, float, str]) -> str:
        return f"{cache_key[0]:.4f}|{cache_key[1]:.4f}|{cache_key[2]}"

    def _copy_candidates(self, candidates: list[dict]) -> list[dict]:
        return [item.copy() for item in candidates]

    def _copy_debug(self, debug: dict) -> dict:
        copied = debug.copy()
        copied["keyword_stats"] = [item.copy() for item in debug.get("keyword_stats", [])]
        return copied

    def _prewarm_categories(self) -> list[str]:
        configured = [
            item.strip()
            for item in settings.recommendation_prewarm_categories.split(",")
            if item.strip()
        ]
        if configured:
            return configured
        return ["烧烤", "火锅", "家常菜"]

    def _prewarm_locations(self) -> list[tuple[float, float]]:
        locations: list[tuple[float, float]] = []
        for item in settings.recommendation_prewarm_locations.split(";"):
            parts = [part.strip() for part in item.split(",", maxsplit=1)]
            if len(parts) != 2:
                continue
            try:
                locations.append((float(parts[0]), float(parts[1])))
            except ValueError:
                continue
        return locations

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

    def _normalize_amap_restaurant(self, restaurant, category: str) -> dict:
        avg_price = restaurant.avg_price
        value_for_money_signal = estimate_value_base(avg_price)
        portion_signal = 78 if avg_price <= 50 else 70
        normalized = {
            "id": f"amap_{restaurant.source_id}",
            "external_id": restaurant.source_id,
            "source": "amap",
            "name": restaurant.name,
            "category": category,
            "address": restaurant.address,
            "raw_type": restaurant.raw_type,
            "avg_price": avg_price,
            "avg_price_known": restaurant.avg_price_known,
            "business_hours": restaurant.business_hours,
            "distance_meters": restaurant.distance_meters,
            "lng": restaurant.lng,
            "lat": restaurant.lat,
            "walking_minutes": restaurant.walking_minutes,
            "riding_minutes": restaurant.riding_minutes,
            "positive_comment_ratio": 72,
            "complaint_intensity": 28,
            "detail_coverage": 52,
            "recent_momentum": 65,
            "duplicate_comment_risk": 20,
            "recent_burst_risk": 15,
            "praise_detail_ratio": 58,
            "opinion_spread": 68,
            "value_for_money_signal": value_for_money_signal,
            "portion_signal": portion_signal,
            "queue_pressure": 35,
            "issue_concentration": 60,
            "highlighted_items": [],
            "caution_items": ["评论数据暂未接入"],
            "comment_highlights": self._build_base_reasons(restaurant.distance_meters, avg_price),
            "caution_notes": [
                "当前只有基础店铺信息，评论内容还在持续补充中",
            ],
            "comment_overview": [
                "当前店铺来自高德店铺信息，已完成价格和基础位置维度估算。",
                "评论内容和留言摘要会在后续有人补充后逐步变完整。",
            ],
            "scene_fit": self._build_scene_fit(
                avg_price=avg_price,
                distance_meters=restaurant.distance_meters,
                category=category,
            ),
        }
        return normalized

    def _looks_like_amap_id(self, restaurant_id: str) -> bool:
        normalized_id = restaurant_id.strip()
        if not normalized_id:
            return False
        if normalized_id.startswith("amap_"):
            return True
        return normalized_id.upper().startswith("B") and any(
            character.isdigit() for character in normalized_id
        )

    def _infer_category(self, restaurant) -> str:
        searchable_text = " ".join(
            str(value)
            for value in (restaurant.category, restaurant.raw_type, restaurant.name)
            if value
        )
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            if category in searchable_text:
                return category
            if any(keyword in searchable_text for keyword in keywords):
                return category
        return "餐饮"

    def _apply_default_signals(self, restaurant: dict) -> dict:
        restaurant.setdefault("external_id", None)
        restaurant.setdefault("source", "mock")
        restaurant.setdefault("lng", 121.4737)
        restaurant.setdefault("lat", 31.2304)
        restaurant.setdefault("raw_type", "")
        restaurant.setdefault("avg_price_known", True)
        restaurant.setdefault("walking_minutes", None)
        restaurant.setdefault("riding_minutes", None)
        restaurant.setdefault("positive_comment_ratio", 72)
        restaurant.setdefault("complaint_intensity", 28)
        restaurant.setdefault("detail_coverage", 52)
        restaurant.setdefault("recent_momentum", 65)
        restaurant.setdefault("duplicate_comment_risk", 20)
        restaurant.setdefault("recent_burst_risk", 15)
        restaurant.setdefault("praise_detail_ratio", 58)
        restaurant.setdefault("opinion_spread", 68)
        restaurant.setdefault(
            "value_for_money_signal", estimate_value_base(restaurant["avg_price"])
        )
        restaurant.setdefault("portion_signal", 78 if restaurant["avg_price"] <= 50 else 70)
        restaurant.setdefault("queue_pressure", 35)
        restaurant.setdefault("issue_concentration", 60)
        restaurant.setdefault("highlighted_items", [])
        restaurant.setdefault("caution_items", ["评论数据暂未接入"])
        restaurant.setdefault(
            "comment_highlights",
            self._build_base_reasons(restaurant["distance_meters"], restaurant["avg_price"]),
        )
        restaurant.setdefault("caution_notes", ["当前为基础信息缓存，评论内容会在详情页逐步补充"])
        restaurant.setdefault(
            "comment_overview",
            ["当前店铺来自缓存基础信息，若存在评论数据会自动更新页面概况。"],
        )
        restaurant.setdefault(
            "scene_fit",
            self._build_scene_fit(
                avg_price=restaurant["avg_price"],
                distance_meters=restaurant["distance_meters"],
                category=restaurant["category"],
            ),
        )
        return restaurant



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

    def _build_scene_fit(
        self,
        *,
        avg_price: int,
        distance_meters: int,
        category: str,
    ) -> dict[str, str]:
        solo_friendly = {"面食", "麻辣烫", "奶茶甜品"}
        group_friendly = {"火锅", "烧烤", "自助", "家常菜"}
        date_friendly = {"火锅", "家常菜", "奶茶甜品"}

        if category in solo_friendly and avg_price <= 40 and distance_meters <= 1500:
            one_person = "高匹配"
        elif distance_meters <= 2000:
            one_person = "中匹配"
        else:
            one_person = "低匹配"

        if category in group_friendly and avg_price <= 70:
            dorm_group = "高匹配"
        elif category == "奶茶甜品":
            dorm_group = "低匹配"
        else:
            dorm_group = "中匹配"

        if distance_meters <= 1200 and category in {"烧烤", "麻辣烫", "面食", "奶茶甜品"}:
            late_night = "高匹配"
        elif distance_meters <= 2500:
            late_night = "中匹配"
        else:
            late_night = "低匹配"

        if category in date_friendly and avg_price >= 35:
            date = "高匹配" if avg_price >= 50 else "中匹配"
        else:
            date = "低匹配"
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
