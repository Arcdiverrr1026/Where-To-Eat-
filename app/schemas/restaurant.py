from typing import Literal

from pydantic import BaseModel, Field


BudgetOption = Literal["20以内", "50以内", "70以内", "70以上"]
DistanceOption = Literal["步行10分钟内", "骑车15分钟内", "3公里内"]
SceneOption = Literal["一个人吃", "宿舍聚餐", "夜宵", "约会"]


class UserLocation(BaseModel):
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")


class RestaurantRecommendationRequest(BaseModel):
    location: UserLocation
    category: str = Field(..., description="Restaurant category")
    budget: BudgetOption
    distance: DistanceOption
    scene: SceneOption


class RestaurantCard(BaseModel):
    restaurant_id: str
    source: str
    name: str
    category: str
    lng: float
    lat: float
    distance_meters: int
    distance_text: str
    avg_price: int
    final_score: int
    tags: list[str]
    risk_flags: list[str]
    summary: str


class RestaurantRecommendationResponse(BaseModel):
    total: int
    list: list[RestaurantCard]


class ScoreBreakdown(BaseModel):
    reputation: int
    authenticity: int
    student_fit: int
    stability: int
    final: int


class RestaurantDetailResponse(BaseModel):
    restaurant_id: str
    source: str
    review_source: str
    review_count: int
    name: str
    category: str
    address: str
    distance_meters: int
    distance_text: str
    avg_price: int
    business_hours: str
    scores: ScoreBreakdown
    tags: list[str]
    risk_flags: list[str]
    recommend_reasons: list[str]
    warning_points: list[str]
    recent_review_summary: list[str]
    popular_dishes: list[str]
    common_negatives: list[str]
    scene_fit: dict[str, str]


class ReviewImportRequest(BaseModel):
    restaurant_id: str = Field(..., description="Target restaurant id")
    format: Literal["json", "csv"] = Field(..., description="Review content format")
    content: str = Field(..., description="Raw review content")


class ReviewImportResponse(BaseModel):
    restaurant_id: str
    imported_count: int
    review_source: str
    sample_review: str | None = None


class ReviewFeedbackRequest(BaseModel):
    restaurant_id: str = Field(..., description="Target restaurant id")
    rating: int = Field(..., ge=1, le=5, description="User rating from 1 to 5")
    content: str = Field(..., min_length=2, description="Short user feedback")


class ReviewFeedbackResponse(BaseModel):
    restaurant_id: str
    review_source: str
    review_count: int
    sample_review: str


class ImportedRestaurantSummary(BaseModel):
    restaurant_id: str
    review_count: int
    last_imported_at: str | None = None


class ImportedReviewRecord(BaseModel):
    restaurant_id: str
    rating: int
    content: str
    days_ago: int
    created_at: str | None = None


class CachedRestaurantRecord(BaseModel):
    restaurant_id: str
    source: str
    name: str
    category: str
    address: str
    avg_price: int
    business_hours: str
    distance_meters: int
    updated_at: str | None = None


class AnalysisCacheRecord(BaseModel):
    restaurant_id: str
    restaurant_name: str
    restaurant_category: str | None = None
    review_source: str
    review_count: int
    final_score: int
    tags: list[str]
    risk_flags: list[str]
    updated_at: str | None = None


class AdminDashboardResponse(BaseModel):
    imported_restaurants: list[ImportedRestaurantSummary]
    recent_reviews: list[ImportedReviewRecord]
    cached_restaurants: list[CachedRestaurantRecord]
    analysis_caches: list[AnalysisCacheRecord]
