from secrets import compare_digest
from time import monotonic

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.core.config import settings
from app.schemas.restaurant import (
    AdminDashboardResponse,
    RecommendationDebugResponse,
    RestaurantDetailResponse,
    ResetTrialDataResponse,
    ReviewFeedbackRequest,
    ReviewFeedbackResponse,
    RestaurantRecommendationRequest,
    RestaurantRecommendationResponse,
    ReviewImportRequest,
    ReviewImportResponse,
    ReviewVisibilityUpdateRequest,
    ReviewVisibilityUpdateResponse,
)
from app.services.recommendation_service import RecommendationService


router = APIRouter(prefix="/api", tags=["restaurants"])
service = RecommendationService()
_feedback_rate_limit_hits: dict[str, list[float]] = {}


def require_admin_token(x_admin_token: str | None = Header(default=None)) -> None:
    if not settings.admin_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin token is not configured",
        )
    if not x_admin_token or not compare_digest(x_admin_token, settings.admin_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )


def _request_client_id(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", maxsplit=1)[0].strip()
    if request.client is None:
        return "unknown"
    return request.client.host


def require_feedback_rate_limit(request: Request) -> None:
    limit = settings.review_feedback_rate_limit_count
    if limit <= 0:
        return
    window_seconds = settings.review_feedback_rate_limit_window_seconds
    now = monotonic()
    earliest_allowed = now - window_seconds
    client_id = _request_client_id(request)
    hits = [
        timestamp
        for timestamp in _feedback_rate_limit_hits.get(client_id, [])
        if timestamp >= earliest_allowed
    ]
    if len(hits) >= limit:
        _feedback_rate_limit_hits[client_id] = hits
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many feedback submissions. Please try again later.",
        )
    hits.append(now)
    _feedback_rate_limit_hits[client_id] = hits


@router.post("/recommend/restaurants", response_model=RestaurantRecommendationResponse, deprecated=True, dependencies=[Depends(require_admin_token)])
def recommend_restaurants(
    payload: RestaurantRecommendationRequest,
) -> RestaurantRecommendationResponse:
    return service.recommend(payload)


@router.post("/recommend/debug", response_model=RecommendationDebugResponse, deprecated=True, dependencies=[Depends(require_admin_token)])
def recommend_debug(
    payload: RestaurantRecommendationRequest,
) -> RecommendationDebugResponse:
    return service.recommend_debug(payload)


@router.get("/restaurants/{restaurant_id:path}", response_model=RestaurantDetailResponse, deprecated=True, dependencies=[Depends(require_admin_token)])
def get_restaurant_detail(
    restaurant_id: str,
    lat: float | None = None,
    lng: float | None = None,
    category: str | None = None,
) -> RestaurantDetailResponse:
    detail = service.get_restaurant_detail(
        restaurant_id,
        lat=lat,
        lng=lng,
        category=category,
    )
    if detail is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return detail


@router.post("/reviews/import", response_model=ReviewImportResponse)
def import_reviews(
    payload: ReviewImportRequest,
    _: None = Depends(require_admin_token),
) -> ReviewImportResponse:
    try:
        result = service.import_reviews(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return result


@router.post("/reviews/feedback", response_model=ReviewFeedbackResponse, deprecated=True, dependencies=[Depends(require_admin_token)])
def submit_review_feedback(
    payload: ReviewFeedbackRequest,
    _: None = Depends(require_feedback_rate_limit),
) -> ReviewFeedbackResponse:
    try:
        result = service.submit_review_feedback(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return result


@router.get("/admin/dashboard", response_model=AdminDashboardResponse)
def admin_dashboard(_: None = Depends(require_admin_token)) -> AdminDashboardResponse:
    return service.get_admin_dashboard()


@router.post("/admin/reset-data", response_model=ResetTrialDataResponse)
def reset_trial_data(_: None = Depends(require_admin_token)) -> ResetTrialDataResponse:
    return service.reset_trial_data()


@router.patch(
    "/admin/reviews/{review_id}/visibility",
    response_model=ReviewVisibilityUpdateResponse,
)
def update_review_visibility(
    review_id: int,
    payload: ReviewVisibilityUpdateRequest,
    _: None = Depends(require_admin_token),
) -> ReviewVisibilityUpdateResponse:
    result = service.set_review_visibility(review_id, payload.is_visible)
    if result is None:
        raise HTTPException(status_code=404, detail="Review not found")
    return result


@router.get("/client-config/map")
def client_map_config() -> dict[str, str | bool]:
    return {
        "amap_js_api_key": settings.amap_js_api_key,
        "amap_security_js_code": settings.amap_security_js_code,
        "enabled": bool(settings.amap_js_api_key),
    }
