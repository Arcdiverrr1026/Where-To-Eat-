from app.core.scoring import ScoringEngine
from app.core.review_analysis import ReviewAnalyzer
from app.data.mock_restaurants import MOCK_RESTAURANTS
from app.db.sqlite import SQLiteStore
from app.schemas.restaurant import (
    AdminDashboardResponse,
    AnalysisCacheRecord,
    CachedRestaurantRecord,
    ImportedRestaurantSummary,
    ImportedReviewRecord,
    RestaurantCard,
    RestaurantDetailResponse,
    ReviewFeedbackRequest,
    ReviewFeedbackResponse,
    RestaurantRecommendationRequest,
    RestaurantRecommendationResponse,
    ReviewImportRequest,
    ReviewImportResponse,
    ScoreBreakdown,
)
from app.services.restaurant_source_service import RestaurantSourceService
from app.services.review_source_service import ReviewSourceService


class RecommendationService:
    def __init__(self) -> None:
        self.scoring = ScoringEngine()
        self.review_analyzer = ReviewAnalyzer()
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
        if not candidates and source == "amap":
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

        candidates.sort(key=lambda item: item.final_score, reverse=True)
        return RestaurantRecommendationResponse(total=len(candidates), list=candidates)

    def _build_recommendation_cards(
        self,
        *,
        restaurants: list[dict],
        source: str,
        payload: RestaurantRecommendationRequest,
    ) -> list[RestaurantCard]:
        candidates: list[RestaurantCard] = []

        for restaurant in restaurants:
            restaurant, tags, risk_flags, scores = self._prepare_restaurant_for_output(
                restaurant=restaurant,
                budget=payload.budget,
                distance=payload.distance,
                scene=payload.scene,
            )
            if not self.scoring.within_budget(restaurant["avg_price"], payload.budget):
                continue
            if not self.scoring.within_distance(
                restaurant["distance_meters"], payload.distance
            ):
                continue
            self.restaurant_cache[restaurant["id"]] = restaurant
            candidates.append(
                RestaurantCard(
                    restaurant_id=restaurant["id"],
                    source=restaurant.get("source", source),
                    name=restaurant["name"],
                    category=restaurant["category"],
                    lng=float(restaurant.get("lng", payload.location.lng)),
                    lat=float(restaurant.get("lat", payload.location.lat)),
                    distance_meters=restaurant["distance_meters"],
                    distance_text=self._format_distance(restaurant["distance_meters"]),
                    avg_price=restaurant["avg_price"],
                    final_score=scores.final,
                    tags=tags,
                    risk_flags=risk_flags,
                    summary=self._build_summary(restaurant),
                )
            )
        return candidates

    def get_restaurant_detail(self, restaurant_id: str) -> RestaurantDetailResponse | None:
        restaurant = self.restaurant_cache.get(restaurant_id)
        if restaurant is None:
            restaurant = self.source_service.get_cached_restaurant(restaurant_id)
        if restaurant is None:
            restaurant = next(
                (item for item in MOCK_RESTAURANTS if item["id"] == restaurant_id), None
            )
        if restaurant is None:
            return None
        default_budget = "50以内"
        default_distance = "骑车15分钟内"
        default_scene = "宿舍聚餐"
        restaurant, tags, risk_flags, scores = self._prepare_restaurant_for_output(
            restaurant=restaurant,
            budget=default_budget,
            distance=default_distance,
            scene=default_scene,
        )

        return RestaurantDetailResponse(
            restaurant_id=restaurant["id"],
            source=restaurant.get("source", "mock"),
            review_source=restaurant.get("review_source", "none"),
            review_count=restaurant.get("review_count", 0),
            name=restaurant["name"],
            category=restaurant["category"],
            address=restaurant["address"],
            distance_meters=restaurant["distance_meters"],
            distance_text=self._format_distance(restaurant["distance_meters"]),
            avg_price=restaurant["avg_price"],
            business_hours=restaurant["business_hours"],
            scores=ScoreBreakdown(
                reputation=scores.reputation,
                authenticity=scores.authenticity,
                student_fit=scores.student_fit,
                stability=scores.stability,
                final=scores.final,
            ),
            tags=tags,
            risk_flags=risk_flags,
            recommend_reasons=restaurant["recommend_reasons"],
            warning_points=restaurant["warning_points"],
            recent_review_summary=restaurant["recent_review_summary"],
            popular_dishes=restaurant["popular_dishes"],
            common_negatives=restaurant["common_negatives"],
            scene_fit=restaurant["scene_fit"],
        )

    def import_reviews(self, payload: ReviewImportRequest) -> ReviewImportResponse | None:
        restaurant = self.restaurant_cache.get(payload.restaurant_id)
        if restaurant is None:
            restaurant = next(
                (item for item in MOCK_RESTAURANTS if item["id"] == payload.restaurant_id), None
            )
        if restaurant is None:
            return None

        reviews = self.review_source_service.import_reviews(
            restaurant_id=payload.restaurant_id,
            review_format=payload.format,
            content=payload.content,
        )
        enriched, _, _, _ = self._prepare_restaurant_for_output(
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
        if restaurant is None:
            restaurant = next(
                (item for item in MOCK_RESTAURANTS if item["id"] == payload.restaurant_id), None
            )
        if restaurant is None:
            return None

        review = self.review_source_service.submit_feedback(
            restaurant_id=payload.restaurant_id,
            rating=payload.rating,
            content=payload.content,
        )
        enriched, _, _, _ = self._prepare_restaurant_for_output(
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
            analysis_caches=[
                AnalysisCacheRecord(**item) for item in payload["analysis_caches"]
            ],
        )

    def _enrich_with_reviews(self, restaurant: dict) -> dict:
        enriched = restaurant.copy()
        reviews, review_source = self.review_source_service.fetch_reviews(enriched)
        analysis = self.review_analyzer.analyze(reviews, enriched)
        enriched.update(
            {
                "review_source": review_source,
                "review_count": analysis.review_count,
                "positive_signals": analysis.positive_signals,
                "negative_intensity": analysis.negative_intensity,
                "detail_richness": analysis.detail_richness,
                "trend_score": analysis.trend_score,
                "template_risk": analysis.template_risk,
                "time_anomaly": analysis.time_anomaly,
                "high_score_detail": analysis.high_score_detail,
                "score_consistency": analysis.score_consistency,
                "value_signal": analysis.value_signal,
                "portion_signal": analysis.portion_signal,
                "peak_risk": analysis.peak_risk,
                "volatility": analysis.volatility,
                "negative_focus": analysis.negative_focus,
                "popular_dishes": analysis.popular_dishes,
                "common_negatives": analysis.common_negatives,
                "recommend_reasons": analysis.recommend_reasons,
                "warning_points": analysis.warning_points,
                "recent_review_summary": analysis.recent_review_summary,
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
    ) -> tuple[dict, list[str], list[str], object]:
        enriched = self._enrich_with_reviews(restaurant)
        cached = None if force_refresh else self.store.fetch_analysis_cache(enriched["id"])

        current_signature = (
            enriched.get("review_source", "none"),
            enriched.get("review_count", 0),
        )
        cached_signature = None
        if cached is not None:
            cached_signature = (cached["review_source"], cached["review_count"])

        if cached is not None and cached_signature == current_signature:
            tags = cached["tags"]
            risk_flags = cached["risk_flags"]
            scores = type(
                "CachedScoreResult",
                (),
                {
                    "reputation": cached["reputation_score"],
                    "authenticity": cached["authenticity_score"],
                    "student_fit": cached["student_fit_score"],
                    "stability": cached["stability_score"],
                    "final": cached["final_score"],
                },
            )()
            enriched.update(
                {
                    "recommend_reasons": cached["recommend_reasons"],
                    "warning_points": cached["warning_points"],
                    "recent_review_summary": cached["recent_review_summary"],
                    "popular_dishes": cached["popular_dishes"],
                    "common_negatives": cached["common_negatives"],
                    "scene_fit": cached["scene_fit"],
                }
            )
            return enriched, tags, risk_flags, scores

        scores = self.scoring.calculate_scores(
            restaurant=enriched,
            budget=budget,
            distance=distance,
            scene=scene,
        )
        tags, risk_flags = self._build_tags(enriched, scores.final)
        self.store.upsert_analysis_cache(
            {
                "restaurant_id": enriched["id"],
                "review_source": enriched.get("review_source", "none"),
                "review_count": enriched.get("review_count", 0),
                "reputation_score": scores.reputation,
                "authenticity_score": scores.authenticity,
                "student_fit_score": scores.student_fit,
                "stability_score": scores.stability,
                "final_score": scores.final,
                "tags": tags,
                "risk_flags": risk_flags,
                "recommend_reasons": enriched["recommend_reasons"],
                "warning_points": enriched["warning_points"],
                "recent_review_summary": enriched["recent_review_summary"],
                "popular_dishes": enriched["popular_dishes"],
                "common_negatives": enriched["common_negatives"],
                "scene_fit": enriched["scene_fit"],
            }
        )
        return enriched, tags, risk_flags, scores

    def _format_distance(self, meters: int) -> str:
        if meters >= 1000:
            return f"{meters / 1000:.1f}km"
        return f"{meters}m"

    def _build_summary(self, restaurant: dict) -> str:
        if restaurant.get("review_count", 0) == 0:
            return "这家店还缺真实评价，你和同学的反馈会直接决定它后面的口碑判断。"
        reasons = restaurant["recommend_reasons"][:2]
        return "，".join(reasons)

    def _build_tags(self, restaurant: dict, final_score: int) -> tuple[list[str], list[str]]:
        if restaurant.get("review_count", 0) == 0:
            return ["待补第一批评价"], []
        tags: list[str] = []
        risk_flags: list[str] = []

        if restaurant["portion_signal"] >= 80:
            tags.append("分量大")
        if restaurant["value_signal"] >= 80:
            tags.append("性价比高")
        if restaurant["scene_fit"]["宿舍聚餐"] == "高匹配":
            tags.append("适合聚餐")
        if restaurant["scene_fit"]["夜宵"] == "高匹配":
            tags.append("夜宵方便")
        if final_score >= 80:
            tags.append("近期评价稳定")

        if restaurant["template_risk"] >= 35:
            risk_flags.append("评论模板化倾向")
        if restaurant["peak_risk"] >= 40:
            risk_flags.append("高峰时段排队久")
        if restaurant["negative_intensity"] >= 40:
            risk_flags.append("近期差评偏多")

        return tags[:3], risk_flags[:3]
