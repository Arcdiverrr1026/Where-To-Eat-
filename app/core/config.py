import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent


@dataclass(frozen=True)
class Settings:
    amap_api_key: str = os.getenv("AMAP_API_KEY", "").strip()
    amap_js_api_key: str = os.getenv(
        "AMAP_JS_API_KEY", os.getenv("AMAP_API_KEY", "")
    ).strip()
    amap_security_js_code: str = os.getenv("AMAP_SECURITY_JS_CODE", "").strip()
    amap_radius_meters: int = int(os.getenv("AMAP_RADIUS_METERS", "3000"))
    amap_page_size: int = int(os.getenv("AMAP_PAGE_SIZE", "8"))
    amap_page_count: int = int(os.getenv("AMAP_PAGE_COUNT", "1"))
    amap_target_candidate_count: int = int(os.getenv("AMAP_TARGET_CANDIDATE_COUNT", "18"))
    amap_keyword_parallelism: int = int(os.getenv("AMAP_KEYWORD_PARALLELISM", "3"))
    amap_http_timeout_seconds: float = float(os.getenv("AMAP_HTTP_TIMEOUT_SECONDS", "1.5"))
    amap_fetch_route_details: bool = (
        os.getenv("AMAP_FETCH_ROUTE_DETAILS", "false").lower() == "true"
    )
    recommendation_candidate_cache_ttl_seconds: int = int(
        os.getenv("RECOMMENDATION_CANDIDATE_CACHE_TTL_SECONDS", "600")
    )
    recommendation_prewarm_enabled: bool = (
        os.getenv("RECOMMENDATION_PREWARM_ENABLED", "true").lower() != "false"
    )
    recommendation_prewarm_categories: str = os.getenv(
        "RECOMMENDATION_PREWARM_CATEGORIES", ""
    ).strip()
    recommendation_prewarm_locations: str = os.getenv(
        "RECOMMENDATION_PREWARM_LOCATIONS", "31.2304,121.4737"
    ).strip()
    admin_token: str = os.getenv("ADMIN_TOKEN", "").strip()
    review_feedback_rate_limit_count: int = int(
        os.getenv("REVIEW_FEEDBACK_RATE_LIMIT_COUNT", "5")
    )
    review_feedback_rate_limit_window_seconds: int = int(
        os.getenv("REVIEW_FEEDBACK_RATE_LIMIT_WINDOW_SECONDS", "60")
    )
    use_mock_fallback: bool = os.getenv("USE_MOCK_FALLBACK", "true").lower() != "false"
    use_mock_review_fallback: bool = (
        os.getenv("USE_MOCK_REVIEW_FALLBACK", "false").lower() == "true"
    )
    sqlite_path: str = os.getenv(
        "SQLITE_PATH", str(BASE_DIR / "data" / "where_to_eat.db")
    )


settings = Settings()
