import csv
import io
import json

from app.core.config import settings
from app.db.sqlite import SQLiteStore
from app.data.mock_reviews import MOCK_REVIEWS


class ReviewSourceService:
    def __init__(self) -> None:
        self.store = SQLiteStore()

    def fetch_reviews(self, restaurant: dict) -> tuple[list[dict], str]:
        restaurant_id = restaurant.get("id", "")
        imported = self.store.fetch_reviews(restaurant_id)
        if imported:
            return imported, "imported"
        if settings.use_mock_review_fallback:
            reviews = MOCK_REVIEWS.get(restaurant_id, [])
            if reviews:
                return reviews, "mock"
        return [], "none"

    def import_reviews(
        self,
        *,
        restaurant_id: str,
        review_format: str,
        content: str,
    ) -> list[dict]:
        if review_format == "json":
            reviews = self._parse_json_reviews(content)
        else:
            reviews = self._parse_csv_reviews(content)
        self.store.replace_reviews(restaurant_id, reviews)
        return reviews

    def submit_feedback(
        self,
        *,
        restaurant_id: str,
        rating: int,
        content: str,
    ) -> dict:
        review = self._normalize_review(
            {
                "rating": rating,
                "content": content,
                "days_ago": 0,
            }
        )
        self.store.append_review(restaurant_id, review)
        return review

    def _parse_json_reviews(self, content: str) -> list[dict]:
        payload = json.loads(content)
        if not isinstance(payload, list):
            raise ValueError("JSON content must be a list of review objects")
        return [self._normalize_review(item) for item in payload]

    def _parse_csv_reviews(self, content: str) -> list[dict]:
        reader = csv.DictReader(io.StringIO(content))
        return [self._normalize_review(row) for row in reader]

    def _normalize_review(self, item: dict) -> dict:
        if "content" not in item:
            raise ValueError("Each review must include a content field")
        rating = int(item.get("rating", 3))
        days_ago = int(item.get("days_ago", 7))
        return {
            "rating": max(1, min(5, rating)),
            "content": str(item.get("content", "")).strip(),
            "days_ago": max(0, days_ago),
        }

    def get_admin_dashboard(self) -> dict:
        return {
            "imported_restaurants": self.store.list_imported_restaurants(),
            "recent_reviews": self.store.list_recent_reviews(),
            "analysis_caches": self.store.list_analysis_cache_records(),
        }
