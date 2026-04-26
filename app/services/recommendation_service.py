from app.core.config import settings
from app.core.scoring import ScoringEngine
from app.core.comment_summary import CommentSummarizer
from app.data.mock_restaurants import MOCK_RESTAURANTS
from app.db.sqlite import SQLiteStore
from app.schemas.restaurant import (
    AdminDashboardResponse,
    CachedRestaurantRecord,
    ImportedRestaurantSummary,
    ImportedReviewRecord,
    RecommendationDebugKeywordStat,
    RecommendationDebugResponse,
    RestaurantCard,
    RestaurantDetailResponse,
    RestaurantReviewItem,
    ReviewFeedbackRequest,
    ReviewFeedbackResponse,
    RestaurantRecommendationRequest,
    RestaurantRecommendationResponse,
    ResetTrialDataResponse,
    ReviewImportRequest,
    ReviewImportResponse,
)
from app.services.restaurant_source_service import RestaurantSourceService
from app.services.review_source_service import ReviewSourceService


class RecommendationService:
    def __init__(self) -> None:
        self.scoring = ScoringEngine()
        self.comment_summarizer = CommentSummarizer()
        self.store = SQLiteStore()
        self.source_service = RestaurantSourceService()
        self.review_source_service = ReviewSourceService()
        self.restaurant_cache: dict[str, dict] = {}

    def recommend(
        self, payload: RestaurantRecommendationRequest
    ) -> RestaurantRecommendationResponse:
        restaurants, source = self.source_service.fetch_candidates(
            lat=payload.location.lat,
            lng=payload.location.lng,
            category=payload.category,
        )
        candidates = self._build_recommendation_cards(
            restaurants=restaurants,
            source=source,
            payload=payload,
        )

        # Real POI results can legitimately be filtered to zero by budget/distance.
        # For demo stability, fall back to mock recommendations when enabled.
        if not candidates and source == "amap" and settings.use_mock_fallback:
            mock_restaurants = self.source_service.fetch_mock_candidates(
                lat=payload.location.lat,
                lng=payload.location.lng,
                category=payload.category,
            )
            candidates = self._build_recommendation_cards(
                restaurants=mock_restaurants,
                source="mock",
                payload=payload,
            )

        candidates.sort(key=self._restaurant_card_sort_key)
        return RestaurantRecommendationResponse(total=len(candidates), list=candidates)

    def recommend_debug(
        self, payload: RestaurantRecommendationRequest
    ) -> RecommendationDebugResponse:
        restaurants, source, source_debug = self.source_service.fetch_candidates_with_debug(
            lat=payload.location.lat,
            lng=payload.location.lng,
            category=payload.category,
        )
        _, filter_debug = self._build_recommendation_cards(
            restaurants=restaurants,
            source=source,
            payload=payload,
            collect_debug=True,
        )
        return RecommendationDebugResponse(
            category=payload.category,
            budget=payload.budget,
            distance=payload.distance,
            scene=payload.scene,
            source=source,
            total_fetched=source_debug["total_fetched"],
            total_after_dedupe=source_debug["total_after_dedupe"],
            filtered_by_budget=filter_debug["filtered_by_budget"],
            filtered_by_distance=filter_debug["filtered_by_distance"],
            filtered_by_scene=filter_debug["filtered_by_scene"],
            final_count=filter_debug["final_count"],
            keyword_stats=[
                RecommendationDebugKeywordStat(**item)
                for item in source_debug["keyword_stats"]
            ],
        )

    def _build_recommendation_cards(
        self,
        *,
        restaurants: list[dict],
        source: str,
        payload: RestaurantRecommendationRequest,
        collect_debug: bool = False,
    ) -> list[RestaurantCard] | tuple[list[RestaurantCard], dict]:
        candidates: list[RestaurantCard] = []
        debug = {
            "filtered_by_budget": 0,
            "filtered_by_distance": 0,
            "filtered_by_scene": 0,
            "final_count": 0,
        }

        for restaurant in restaurants:
            restaurant, tags, risk_flags = self._prepare_restaurant_for_output(
                restaurant=restaurant,
                budget=payload.budget,
                distance=payload.distance,
                scene=payload.scene,
            )
            if not self.scoring.within_budget(
                restaurant["avg_price"],
                payload.budget,
                price_known=restaurant.get("avg_price_known", True),
            ):
                debug["filtered_by_budget"] += 1
                continue
            if not self.scoring.within_route_constraint(
                restaurant=restaurant,
                distance=payload.distance,
            ):
                debug["filtered_by_distance"] += 1
                continue
            if not self._matches_scene(restaurant, payload.scene):
                debug["filtered_by_scene"] += 1
                continue
            self.restaurant_cache[restaurant["id"]] = restaurant
            lng_value = restaurant.get("lng")
            lat_value = restaurant.get("lat")
            candidates.append(
                RestaurantCard(
                    restaurant_id=restaurant["id"],
                    source=restaurant.get("source", source),
                    name=restaurant["name"],
                    category=restaurant["category"],
                    lng=float(lng_value) if lng_value is not None else payload.location.lng,
                    lat=float(lat_value) if lat_value is not None else payload.location.lat,
                    distance_meters=restaurant["distance_meters"],
                    distance_text=self._format_distance(restaurant["distance_meters"]),
                    travel_text=self._format_travel(restaurant),
                    avg_price=restaurant["avg_price"],
                    price_text=self._format_price(restaurant),
                    price_source=self._format_price_source(restaurant),
                    scene_match=self._scene_match_label(restaurant, payload.scene),
                    review_count=restaurant.get("review_count", 0),
                    comment_tone=self._build_comment_tone(restaurant),
                    tags=tags,
                    risk_flags=risk_flags,
                    summary=self._build_summary(restaurant),
                )
            )
        debug["final_count"] = len(candidates)
        if collect_debug:
            return candidates, debug
        return candidates

    def get_restaurant_detail(self, restaurant_id: str) -> RestaurantDetailResponse | None:
        restaurant = self.restaurant_cache.get(restaurant_id)
        if restaurant is None:
            restaurant = self.source_service.get_cached_restaurant(restaurant_id)
        if restaurant is None and settings.use_mock_fallback:
            restaurant = self._find_mock_restaurant(restaurant_id)
        if restaurant is None:
            return None
        default_budget = "50以内"
        default_distance = "骑车15分钟内"
        default_scene = "宿舍聚餐"
        restaurant, tags, risk_flags = self._prepare_restaurant_for_output(
            restaurant=restaurant,
            budget=default_budget,
            distance=default_distance,
            scene=default_scene,
        )
        reviews = self.review_source_service.fetch_public_reviews(restaurant["id"])

        return RestaurantDetailResponse(
            restaurant_id=restaurant["id"],
            source=restaurant.get("source", "cached"),
            review_source=restaurant.get("review_source", "none"),
            review_count=restaurant.get("review_count", 0),
            name=restaurant["name"],
            category=restaurant["category"],
            address=restaurant["address"],
            distance_meters=restaurant["distance_meters"],
            distance_text=self._format_distance(restaurant["distance_meters"]),
            travel_text=self._format_travel(restaurant),
            avg_price=restaurant["avg_price"],
            price_text=self._format_price(restaurant),
            price_source=self._format_price_source(restaurant),
            business_hours=restaurant["business_hours"],
            tags=tags,
            risk_flags=risk_flags,
            comment_highlights=restaurant["comment_highlights"],
            caution_notes=restaurant["caution_notes"],
            comment_overview=restaurant["comment_overview"],
            reviews=[RestaurantReviewItem(**item) for item in reviews],
            highlighted_items=restaurant["highlighted_items"],
            caution_items=restaurant["caution_items"],
            scene_fit=restaurant["scene_fit"],
        )

    def import_reviews(self, payload: ReviewImportRequest) -> ReviewImportResponse | None:
        restaurant = self.restaurant_cache.get(payload.restaurant_id)
        if restaurant is None:
            restaurant = self.source_service.get_cached_restaurant(payload.restaurant_id)
        if restaurant is None and settings.use_mock_fallback:
            restaurant = self._find_mock_restaurant(payload.restaurant_id)
        if restaurant is None:
            return None

        reviews = self.review_source_service.import_reviews(
            restaurant_id=payload.restaurant_id,
            review_format=payload.format,
            content=payload.content,
        )
        enriched, _, _ = self._prepare_restaurant_for_output(
            restaurant=restaurant,
            budget="50以内",
            distance="骑车15分钟内",
            scene="宿舍聚餐",
            force_refresh=True,
        )
        self.restaurant_cache[payload.restaurant_id] = enriched
        sample_review = reviews[0]["content"] if reviews else None
        return ReviewImportResponse(
            restaurant_id=payload.restaurant_id,
            imported_count=len(reviews),
            review_source="imported",
            sample_review=sample_review,
        )

    def submit_review_feedback(
        self, payload: ReviewFeedbackRequest
    ) -> ReviewFeedbackResponse | None:
        restaurant = self.restaurant_cache.get(payload.restaurant_id)
        if restaurant is None:
            restaurant = self.source_service.get_cached_restaurant(payload.restaurant_id)
        if restaurant is None and settings.use_mock_fallback:
            restaurant = self._find_mock_restaurant(payload.restaurant_id)
        if restaurant is None:
            return None

        review = self.review_source_service.submit_feedback(
            restaurant_id=payload.restaurant_id,
            rating=payload.rating,
            content=payload.content,
        )
        enriched, _, _ = self._prepare_restaurant_for_output(
            restaurant=restaurant,
            budget="50以内",
            distance="骑车15分钟内",
            scene="宿舍聚餐",
            force_refresh=True,
        )
        self.restaurant_cache[payload.restaurant_id] = enriched
        return ReviewFeedbackResponse(
            restaurant_id=payload.restaurant_id,
            review_source="imported",
            review_count=enriched.get("review_count", 0),
            sample_review=review["content"],
        )

    def get_admin_dashboard(self) -> AdminDashboardResponse:
        payload = self.review_source_service.get_admin_dashboard()
        return AdminDashboardResponse(
            imported_restaurants=[
                ImportedRestaurantSummary(**item)
                for item in payload["imported_restaurants"]
            ],
            recent_reviews=[
                ImportedReviewRecord(**item) for item in payload["recent_reviews"]
            ],
            cached_restaurants=[
                CachedRestaurantRecord(**item)
                for item in self.source_service.get_cached_restaurants()
            ],
        )

    def reset_trial_data(self) -> ResetTrialDataResponse:
        cleared_reviews = self.store.clear_imported_reviews()
        cleared_restaurants = self.store.clear_cached_restaurants()
        self.restaurant_cache.clear()
        return ResetTrialDataResponse(
            cleared_reviews=cleared_reviews,
            cleared_restaurants=cleared_restaurants,
            message="试运行阶段的历史评价和餐厅缓存已清空。",
        )

    def _find_mock_restaurant(self, restaurant_id: str) -> dict | None:
        return next((item for item in MOCK_RESTAURANTS if item["id"] == restaurant_id), None)

    def _enrich_with_reviews(self, restaurant: dict) -> dict:
        enriched = restaurant.copy()
        reviews, review_source = self.review_source_service.fetch_reviews(enriched)
        summary = self.comment_summarizer.summarize(reviews, enriched)
        enriched.update(
            {
                "review_source": review_source,
                "review_count": summary.review_count,
                "positive_comment_ratio": summary.positive_comment_ratio,
                "complaint_intensity": summary.complaint_intensity,
                "detail_coverage": summary.detail_coverage,
                "recent_momentum": summary.recent_momentum,
                "duplicate_comment_risk": summary.duplicate_comment_risk,
                "recent_burst_risk": summary.recent_burst_risk,
                "praise_detail_ratio": summary.praise_detail_ratio,
                "opinion_spread": summary.opinion_spread,
                "value_for_money_signal": summary.value_for_money_signal,
                "portion_signal": summary.portion_signal,
                "queue_pressure": summary.queue_pressure,
                "issue_concentration": summary.issue_concentration,
                "highlighted_items": summary.highlighted_items,
                "caution_items": summary.caution_items,
                "comment_highlights": summary.comment_highlights,
                "caution_notes": summary.caution_notes,
                "comment_overview": summary.comment_overview,
            }
        )
        return enriched

    def _prepare_restaurant_for_output(
        self,
        *,
        restaurant: dict,
        budget: str,
        distance: str,
        scene: str,
        force_refresh: bool = False,
    ) -> tuple[dict, list[str], list[str]]:
        enriched = self._enrich_with_reviews(restaurant)
        tags, risk_flags = self._build_tags(enriched)
        return enriched, tags, risk_flags

    def _format_distance(self, meters: int) -> str:
        if meters >= 1000:
            return f"{meters / 1000:.1f}km"
        return f"{meters}m"

    def _format_travel(self, restaurant: dict) -> str:
        walking_minutes = restaurant.get("walking_minutes")
        riding_minutes = restaurant.get("riding_minutes")
        parts: list[str] = []
        if walking_minutes is not None:
            parts.append(f"步行约{walking_minutes}分钟")
        if riding_minutes is not None:
            parts.append(f"骑行约{riding_minutes}分钟")
        distance_text = self._format_distance(int(restaurant["distance_meters"]))
        if parts:
            return " · ".join(parts + [f"距离约{distance_text}"])
        return f"距离约{distance_text}"

    def _format_price(self, restaurant: dict) -> str:
        if not restaurant.get("avg_price_known", True):
            return "人均待补充"
        return f"人均约{int(restaurant['avg_price'])}元"

    def _format_price_source(self, restaurant: dict) -> str:
        if restaurant.get("avg_price_known", True):
            if restaurant.get("source") == "amap":
                return "价格来源：高德"
            return "价格来源：项目预设"
        return "价格来源：待补充"

    def _build_summary(self, restaurant: dict) -> str:
        if restaurant.get("review_count", 0) == 0:
            return "这家店还缺真实评论，你和同学的留言会直接决定后来的人能看到什么。"
        reasons = restaurant["comment_highlights"][:2]
        return "，".join(reasons)

    def _build_comment_tone(self, restaurant: dict) -> str:
        review_count = restaurant.get("review_count", 0)
        if review_count == 0:
            return "还没人留言"
        if restaurant.get("complaint_intensity", 0) >= 45:
            return "吐槽偏多"
        if restaurant.get("positive_comment_ratio", 0) >= 75:
            return "大家挺推荐"
        if review_count >= 5:
            return "最近讨论不少"
        return "评价还在积累"

    def _restaurant_card_sort_key(self, item: RestaurantCard) -> tuple[int, int, int, int]:
        tone_priority = {
            "大家挺推荐": 3,
            "最近讨论不少": 2,
            "评价还在积累": 1,
            "还没人留言": 0,
            "吐槽偏多": -1,
        }
        scene_priority = {
            "当前场景高匹配": 2,
            "当前场景中匹配": 1,
            "当前场景低匹配": 0,
        }
        return (
            -scene_priority.get(item.scene_match, 0),
            -item.review_count,
            -tone_priority.get(item.comment_tone, 0),
            item.distance_meters,
        )

    def _matches_scene(self, restaurant: dict, scene: str) -> bool:
        scene_fit = restaurant.get("scene_fit", {})
        return scene_fit.get(scene, "中匹配") != "低匹配"

    def _scene_match_label(self, restaurant: dict, scene: str) -> str:
        scene_fit = restaurant.get("scene_fit", {})
        match_level = scene_fit.get(scene, "中匹配")
        return f"当前场景{match_level}"

    def _build_tags(self, restaurant: dict) -> tuple[list[str], list[str]]:
        if restaurant.get("review_count", 0) == 0:
            return ["待补第一批评价"], []
        tags: list[str] = []
        risk_flags: list[str] = []

        if restaurant["portion_signal"] >= 80:
            tags.append("分量大")
        if restaurant["value_for_money_signal"] >= 80:
            tags.append("性价比高")
        if restaurant["scene_fit"]["宿舍聚餐"] == "高匹配":
            tags.append("适合聚餐")
        if restaurant["scene_fit"]["夜宵"] == "高匹配":
            tags.append("夜宵方便")
        if restaurant["positive_comment_ratio"] >= 75 and restaurant["complaint_intensity"] < 35:
            tags.append("近期评价稳定")

        if restaurant["duplicate_comment_risk"] >= 35:
            risk_flags.append("评论模板化倾向")
        if restaurant["queue_pressure"] >= 40:
            risk_flags.append("高峰时段排队久")
        if restaurant["complaint_intensity"] >= 40:
            risk_flags.append("近期差评偏多")

        return tags[:3], risk_flags[:3]
