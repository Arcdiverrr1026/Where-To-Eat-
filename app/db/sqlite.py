import sqlite3
import json
from pathlib import Path

from app.core.config import settings


class SQLiteStore:
    def __init__(self) -> None:
        self.db_path = Path(settings.sqlite_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS restaurants (
                    id TEXT PRIMARY KEY,
                    external_id TEXT,
                    source TEXT NOT NULL,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    address TEXT NOT NULL,
                    avg_price INTEGER NOT NULL,
                    business_hours TEXT NOT NULL,
                    distance_meters INTEGER NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS imported_reviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    restaurant_id TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    days_ago INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS analysis_cache (
                    restaurant_id TEXT PRIMARY KEY,
                    review_source TEXT NOT NULL,
                    review_count INTEGER NOT NULL,
                    reputation_score INTEGER NOT NULL,
                    authenticity_score INTEGER NOT NULL,
                    student_fit_score INTEGER NOT NULL,
                    stability_score INTEGER NOT NULL,
                    final_score INTEGER NOT NULL,
                    tags_json TEXT NOT NULL,
                    risk_flags_json TEXT NOT NULL,
                    recommend_reasons_json TEXT NOT NULL,
                    warning_points_json TEXT NOT NULL,
                    recent_review_summary_json TEXT NOT NULL,
                    popular_dishes_json TEXT NOT NULL,
                    common_negatives_json TEXT NOT NULL,
                    scene_fit_json TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_imported_reviews_restaurant_id
                ON imported_reviews (restaurant_id)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_restaurants_category
                ON restaurants (category)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_analysis_cache_final_score
                ON analysis_cache (final_score)
                """
            )

    def upsert_restaurants(self, restaurants: list[dict]) -> None:
        if not restaurants:
            return
        with self._connect() as connection:
            connection.executemany(
                """
                INSERT INTO restaurants (
                    id, external_id, source, name, category, address,
                    avg_price, business_hours, distance_meters, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    external_id = excluded.external_id,
                    source = excluded.source,
                    name = excluded.name,
                    category = excluded.category,
                    address = excluded.address,
                    avg_price = excluded.avg_price,
                    business_hours = excluded.business_hours,
                    distance_meters = excluded.distance_meters,
                    updated_at = CURRENT_TIMESTAMP
                """,
                [
                    (
                        item["id"],
                        item.get("external_id"),
                        item.get("source", "unknown"),
                        item["name"],
                        item["category"],
                        item["address"],
                        int(item["avg_price"]),
                        item["business_hours"],
                        int(item["distance_meters"]),
                    )
                    for item in restaurants
                ],
            )

    def fetch_restaurant(self, restaurant_id: str) -> dict | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, external_id, source, name, category, address,
                       avg_price, business_hours, distance_meters, updated_at
                FROM restaurants
                WHERE id = ?
                """,
                (restaurant_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "external_id": row["external_id"],
            "source": row["source"],
            "name": row["name"],
            "category": row["category"],
            "address": row["address"],
            "avg_price": int(row["avg_price"]),
            "business_hours": row["business_hours"],
            "distance_meters": int(row["distance_meters"]),
        }

    def list_cached_restaurants(self, limit: int = 50) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, source, name, category, address, avg_price,
                       business_hours, distance_meters, updated_at
                FROM restaurants
                ORDER BY updated_at DESC, id ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "restaurant_id": row["id"],
                "source": row["source"],
                "name": row["name"],
                "category": row["category"],
                "address": row["address"],
                "avg_price": int(row["avg_price"]),
                "business_hours": row["business_hours"],
                "distance_meters": int(row["distance_meters"]),
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]

    def upsert_analysis_cache(self, payload: dict) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO analysis_cache (
                    restaurant_id, review_source, review_count,
                    reputation_score, authenticity_score, student_fit_score,
                    stability_score, final_score, tags_json, risk_flags_json,
                    recommend_reasons_json, warning_points_json,
                    recent_review_summary_json, popular_dishes_json,
                    common_negatives_json, scene_fit_json, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(restaurant_id) DO UPDATE SET
                    review_source = excluded.review_source,
                    review_count = excluded.review_count,
                    reputation_score = excluded.reputation_score,
                    authenticity_score = excluded.authenticity_score,
                    student_fit_score = excluded.student_fit_score,
                    stability_score = excluded.stability_score,
                    final_score = excluded.final_score,
                    tags_json = excluded.tags_json,
                    risk_flags_json = excluded.risk_flags_json,
                    recommend_reasons_json = excluded.recommend_reasons_json,
                    warning_points_json = excluded.warning_points_json,
                    recent_review_summary_json = excluded.recent_review_summary_json,
                    popular_dishes_json = excluded.popular_dishes_json,
                    common_negatives_json = excluded.common_negatives_json,
                    scene_fit_json = excluded.scene_fit_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    payload["restaurant_id"],
                    payload["review_source"],
                    int(payload["review_count"]),
                    int(payload["reputation_score"]),
                    int(payload["authenticity_score"]),
                    int(payload["student_fit_score"]),
                    int(payload["stability_score"]),
                    int(payload["final_score"]),
                    json.dumps(payload["tags"], ensure_ascii=False),
                    json.dumps(payload["risk_flags"], ensure_ascii=False),
                    json.dumps(payload["recommend_reasons"], ensure_ascii=False),
                    json.dumps(payload["warning_points"], ensure_ascii=False),
                    json.dumps(payload["recent_review_summary"], ensure_ascii=False),
                    json.dumps(payload["popular_dishes"], ensure_ascii=False),
                    json.dumps(payload["common_negatives"], ensure_ascii=False),
                    json.dumps(payload["scene_fit"], ensure_ascii=False),
                ),
            )

    def fetch_analysis_cache(self, restaurant_id: str) -> dict | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM analysis_cache
                WHERE restaurant_id = ?
                """,
                (restaurant_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "restaurant_id": row["restaurant_id"],
            "review_source": row["review_source"],
            "review_count": int(row["review_count"]),
            "reputation_score": int(row["reputation_score"]),
            "authenticity_score": int(row["authenticity_score"]),
            "student_fit_score": int(row["student_fit_score"]),
            "stability_score": int(row["stability_score"]),
            "final_score": int(row["final_score"]),
            "tags": json.loads(row["tags_json"]),
            "risk_flags": json.loads(row["risk_flags_json"]),
            "recommend_reasons": json.loads(row["recommend_reasons_json"]),
            "warning_points": json.loads(row["warning_points_json"]),
            "recent_review_summary": json.loads(row["recent_review_summary_json"]),
            "popular_dishes": json.loads(row["popular_dishes_json"]),
            "common_negatives": json.loads(row["common_negatives_json"]),
            "scene_fit": json.loads(row["scene_fit_json"]),
            "updated_at": row["updated_at"],
        }

    def list_analysis_cache_records(self, limit: int = 50) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    analysis_cache.restaurant_id,
                    restaurants.name AS restaurant_name,
                    restaurants.category AS restaurant_category,
                    analysis_cache.review_source,
                    analysis_cache.review_count,
                    analysis_cache.final_score,
                    analysis_cache.tags_json,
                    analysis_cache.risk_flags_json,
                    analysis_cache.updated_at
                FROM analysis_cache
                LEFT JOIN restaurants
                    ON restaurants.id = analysis_cache.restaurant_id
                ORDER BY analysis_cache.updated_at DESC, analysis_cache.restaurant_id ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "restaurant_id": row["restaurant_id"],
                "restaurant_name": row["restaurant_name"] or row["restaurant_id"],
                "restaurant_category": row["restaurant_category"],
                "review_source": row["review_source"],
                "review_count": int(row["review_count"]),
                "final_score": int(row["final_score"]),
                "tags": json.loads(row["tags_json"]),
                "risk_flags": json.loads(row["risk_flags_json"]),
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]

    def replace_reviews(self, restaurant_id: str, reviews: list[dict]) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM imported_reviews WHERE restaurant_id = ?",
                (restaurant_id,),
            )
            connection.executemany(
                """
                INSERT INTO imported_reviews (restaurant_id, rating, content, days_ago)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (
                        restaurant_id,
                        int(review["rating"]),
                        str(review["content"]),
                        int(review["days_ago"]),
                    )
                    for review in reviews
                ],
            )

    def append_review(self, restaurant_id: str, review: dict) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO imported_reviews (restaurant_id, rating, content, days_ago)
                VALUES (?, ?, ?, ?)
                """,
                (
                    restaurant_id,
                    int(review["rating"]),
                    str(review["content"]),
                    int(review["days_ago"]),
                ),
            )

    def fetch_reviews(self, restaurant_id: str) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT rating, content, days_ago
                FROM imported_reviews
                WHERE restaurant_id = ?
                ORDER BY id ASC
                """,
                (restaurant_id,),
            ).fetchall()
        return [
            {
                "rating": int(row["rating"]),
                "content": row["content"],
                "days_ago": int(row["days_ago"]),
            }
            for row in rows
        ]

    def list_imported_restaurants(self) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    restaurant_id,
                    COUNT(*) AS review_count,
                    MAX(created_at) AS last_imported_at
                FROM imported_reviews
                GROUP BY restaurant_id
                ORDER BY last_imported_at DESC, restaurant_id ASC
                """
            ).fetchall()
        return [
            {
                "restaurant_id": row["restaurant_id"],
                "review_count": int(row["review_count"]),
                "last_imported_at": row["last_imported_at"],
            }
            for row in rows
        ]

    def list_recent_reviews(self, limit: int = 20) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT restaurant_id, rating, content, days_ago, created_at
                FROM imported_reviews
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "restaurant_id": row["restaurant_id"],
                "rating": int(row["rating"]),
                "content": row["content"],
                "days_ago": int(row["days_ago"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
