from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas.restaurant import (
    AdminDashboardResponse,
    RestaurantDetailResponse,
    ResetTrialDataResponse,
    ReviewFeedbackRequest,
    ReviewFeedbackResponse,
    RestaurantRecommendationRequest,
    RestaurantRecommendationResponse,
    ReviewImportRequest,
    ReviewImportResponse,
)
from app.services.recommendation_service import RecommendationService


router = APIRouter(prefix="/api", tags=["restaurants"])
service = RecommendationService()


@router.post("/recommend/restaurants", response_model=RestaurantRecommendationResponse)
def recommend_restaurants(
    payload: RestaurantRecommendationRequest,
) -> RestaurantRecommendationResponse:
    return service.recommend(payload)


@router.get("/restaurants/{restaurant_id}", response_model=RestaurantDetailResponse)
def get_restaurant_detail(restaurant_id: str) -> RestaurantDetailResponse:
    detail = service.get_restaurant_detail(restaurant_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return detail


@router.post("/reviews/import", response_model=ReviewImportResponse)
def import_reviews(payload: ReviewImportRequest) -> ReviewImportResponse:
    try:
        result = service.import_reviews(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return result


@router.post("/reviews/feedback", response_model=ReviewFeedbackResponse)
def submit_review_feedback(payload: ReviewFeedbackRequest) -> ReviewFeedbackResponse:
    try:
        result = service.submit_review_feedback(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return result


@router.get("/admin/dashboard", response_model=AdminDashboardResponse)
def admin_dashboard() -> AdminDashboardResponse:
    return service.get_admin_dashboard()


@router.post("/admin/reset-data", response_model=ResetTrialDataResponse)
def reset_trial_data() -> ResetTrialDataResponse:
    return service.reset_trial_data()


@router.get("/client-config/map")
def client_map_config() -> dict[str, str | bool]:
    return {
        "amap_js_api_key": settings.amap_js_api_key,
        "amap_security_js_code": settings.amap_security_js_code,
        "enabled": bool(settings.amap_js_api_key),
    }
