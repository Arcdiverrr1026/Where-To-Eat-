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
    travel_text: str
    avg_price: int
    review_count: int
    comment_tone: str
    tags: list[str]
    risk_flags: list[str]
    summary: str


class RestaurantRecommendationResponse(BaseModel):
    total: int
    list: list[RestaurantCard]


class RestaurantReviewItem(BaseModel):
    rating: int
    content: str
    created_at: str | None = None
    days_ago: int


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
    travel_text: str
    avg_price: int
    business_hours: str
    tags: list[str]
    risk_flags: list[str]
    comment_highlights: list[str]
    caution_notes: list[str]
    comment_overview: list[str]
    reviews: list[RestaurantReviewItem]
    highlighted_items: list[str]
    caution_items: list[str]
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
    rating: int = Field(3, ge=1, le=5, description="Optional rating placeholder")
    content: str = Field(..., min_length=2, description="Short user feedback")


class ReviewFeedbackResponse(BaseModel):
    restaurant_id: str
    review_source: str
    review_count: int
    sample_review: str


class ResetTrialDataResponse(BaseModel):
    cleared_reviews: int
    cleared_restaurants: int
    message: str


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


class AdminDashboardResponse(BaseModel):
    imported_restaurants: list[ImportedRestaurantSummary]
    recent_reviews: list[ImportedReviewRecord]
    cached_restaurants: list[CachedRestaurantRecord]
