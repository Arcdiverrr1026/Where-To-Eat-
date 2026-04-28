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
    amap_page_size: int = int(os.getenv("AMAP_PAGE_SIZE", "12"))
    amap_page_count: int = int(os.getenv("AMAP_PAGE_COUNT", "1"))
    amap_target_candidate_count: int = int(os.getenv("AMAP_TARGET_CANDIDATE_COUNT", "18"))
    amap_http_timeout_seconds: float = float(os.getenv("AMAP_HTTP_TIMEOUT_SECONDS", "2.0"))
    amap_fetch_route_details: bool = (
        os.getenv("AMAP_FETCH_ROUTE_DETAILS", "false").lower() == "true"
    )
    admin_token: str = os.getenv("ADMIN_TOKEN", "").strip()
    use_mock_fallback: bool = os.getenv("USE_MOCK_FALLBACK", "true").lower() != "false"
    use_mock_review_fallback: bool = (
        os.getenv("USE_MOCK_REVIEW_FALLBACK", "false").lower() == "true"
    )
    sqlite_path: str = os.getenv(
        "SQLITE_PATH", str(BASE_DIR / "data" / "where_to_eat.db")
    )


settings = Settings()
