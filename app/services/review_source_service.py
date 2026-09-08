import csv
import io
import json

from app.core.config import settings
from app.db.sqlite import SQLiteStore
from app.data.mock_reviews import MOCK_REVIEWS
from app.schemas.restaurant import MAX_REVIEW_CONTENT_LENGTH


class ReviewSourceService:
    def __init__(self, store: SQLiteStore | None = None) -> None:
        self.store = store if store is not None else SQLiteStore()

    def fetch_reviews(self, restaurant: dict) -> tuple[list[dict], str]:
        imported = self._fetch_imported_reviews(restaurant)
        if imported:
            return imported, "imported"
        if settings.use_mock_review_fallback:
            for restaurant_id in self._review_lookup_ids(restaurant):
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
        mode: str = "append",
    ) -> list[dict]:
        if review_format == "json":
            reviews = self._parse_json_reviews(content)
        else:
            reviews = self._parse_csv_reviews(content)
        if mode not in {"append", "replace"}:
            raise ValueError("Import mode must be append or replace")
        if mode == "replace":
            self.store.replace_reviews(restaurant_id, reviews)
            return reviews
        existing = {
            (item["rating"], item["content"], item["days_ago"])
            for item in self.store.fetch_reviews(restaurant_id, include_hidden=True)
        }
        new_reviews: list[dict] = []
        for review in reviews:
            key = (review["rating"], review["content"], review["days_ago"])
            if key in existing:
                continue
            existing.add(key)
            new_reviews.append(review)
        self.store.append_reviews(restaurant_id, new_reviews)
        return new_reviews

    def fetch_public_reviews(self, restaurant: dict | str) -> list[dict]:
        reviews = self._fetch_imported_reviews(restaurant)
        if not reviews and settings.use_mock_review_fallback:
            for restaurant_id in self._review_lookup_ids(restaurant):
                reviews = MOCK_REVIEWS.get(restaurant_id, [])
                if reviews:
                    break
        return [
            {
                "rating": int(item.get("rating", 3)),
                "content": item["content"],
                "created_at": item.get("created_at"),
                "days_ago": int(item.get("days_ago", 0)),
            }
            for item in reviews
        ]

    def _fetch_imported_reviews(self, restaurant: dict | str) -> list[dict]:
        reviews: list[dict] = []
        seen_keys: set[tuple] = set()
        for restaurant_id in self._review_lookup_ids(restaurant):
            for review in self.store.fetch_reviews(restaurant_id):
                key = (
                    review.get("review_id"),
                    review["rating"],
                    review["content"],
                    review["days_ago"],
                    review.get("created_at"),
                )
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                reviews.append(review)
        return reviews

    def _review_lookup_ids(self, restaurant: dict | str) -> list[str]:
        if isinstance(restaurant, dict):
            candidates = [restaurant.get("id"), restaurant.get("external_id")]
        else:
            candidates = [restaurant]

        lookup_ids: list[str] = []
        for candidate in candidates:
            if not candidate:
                continue
            value = str(candidate).strip()
            if not value:
                continue
            lookup_ids.append(value)
            if value.startswith("amap_"):
                lookup_ids.append(value.removeprefix("amap_"))
            else:
                lookup_ids.append(f"amap_{value}")

        deduped: list[str] = []
        for value in lookup_ids:
            if value and value not in deduped:
                deduped.append(value)
        return deduped

    def submit_feedback(
        self,
        *,
        restaurant_id: str,
        rating: int = 3,
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
        if not isinstance(item, dict):
            raise ValueError("Each review must be an object")
        if "content" not in item:
            raise ValueError("Each review must include a content field")
        content = str(item.get("content", "")).strip()
        if len(content) < 2:
            raise ValueError("Each review content must contain at least 2 characters")
        if len(content) > MAX_REVIEW_CONTENT_LENGTH:
            raise ValueError(
                f"Each review content must be {MAX_REVIEW_CONTENT_LENGTH} characters or fewer"
            )
        rating = int(item.get("rating", 3))
        days_ago = int(item.get("days_ago", 7))
        return {
            "rating": max(1, min(5, rating)),
            "content": content,
            "days_ago": max(0, days_ago),
        }

    def set_review_visibility(self, review_id: int, is_visible: bool) -> dict | None:
        return self.store.set_review_visibility(review_id, is_visible)

    def get_admin_dashboard(self) -> dict:
        return {
            "imported_restaurants": self.store.list_imported_restaurants(),
            "recent_reviews": self.store.list_recent_reviews(),
        }
