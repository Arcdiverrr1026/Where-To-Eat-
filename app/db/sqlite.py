import json
import sqlite3
from time import time
from pathlib import Path

from app.core.config import settings


class SQLiteStore:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path if db_path is not None else settings.sqlite_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: sqlite3.Connection | None = None
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        """Return a persistent connection, creating it on first use."""
        if self._conn is None:
            self._conn = sqlite3.connect(
                self.db_path, check_same_thread=False,
            )
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def close(self) -> None:
        """Close the persistent connection (call on shutdown)."""
        if self._conn is not None:
            self._conn.close()
            self._conn = None

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
                    raw_type TEXT DEFAULT '',
                    avg_price INTEGER NOT NULL,
                    avg_price_known INTEGER DEFAULT 1,
                    business_hours TEXT NOT NULL,
                    distance_meters INTEGER NOT NULL,
                    lng REAL,
                    lat REAL,
                    walking_minutes INTEGER,
                    riding_minutes INTEGER,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            self._ensure_restaurant_columns(connection)
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS imported_reviews (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    restaurant_id TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    days_ago INTEGER NOT NULL,
                    is_visible INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            self._ensure_review_columns(connection)
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS recommendation_candidate_cache (
                    cache_key TEXT PRIMARY KEY,
                    lat REAL NOT NULL,
                    lng REAL NOT NULL,
                    category TEXT NOT NULL,
                    source TEXT NOT NULL,
                    candidates_json TEXT NOT NULL,
                    debug_json TEXT NOT NULL,
                    expires_at REAL NOT NULL,
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
                CREATE INDEX IF NOT EXISTS idx_restaurants_external_id
                ON restaurants (external_id)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_imported_reviews_visibility
                ON imported_reviews (restaurant_id, is_visible)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_candidate_cache_expires_at
                ON recommendation_candidate_cache (expires_at)
                """
            )

    def _ensure_restaurant_columns(self, connection: sqlite3.Connection) -> None:
        rows = connection.execute("PRAGMA table_info(restaurants)").fetchall()
        existing_columns = {row["name"] for row in rows}
        migrations = {
            "raw_type": "ALTER TABLE restaurants ADD COLUMN raw_type TEXT DEFAULT ''",
            "avg_price_known": (
                "ALTER TABLE restaurants ADD COLUMN avg_price_known INTEGER DEFAULT 1"
            ),
            "lng": "ALTER TABLE restaurants ADD COLUMN lng REAL",
            "lat": "ALTER TABLE restaurants ADD COLUMN lat REAL",
            "walking_minutes": "ALTER TABLE restaurants ADD COLUMN walking_minutes INTEGER",
            "riding_minutes": "ALTER TABLE restaurants ADD COLUMN riding_minutes INTEGER",
        }
        for column, statement in migrations.items():
            if column not in existing_columns:
                connection.execute(statement)

    def _ensure_review_columns(self, connection: sqlite3.Connection) -> None:
        rows = connection.execute("PRAGMA table_info(imported_reviews)").fetchall()
        existing_columns = {row["name"] for row in rows}
        if "is_visible" not in existing_columns:
            connection.execute(
                "ALTER TABLE imported_reviews ADD COLUMN is_visible INTEGER DEFAULT 1"
            )

    def upsert_restaurants(self, restaurants: list[dict]) -> None:
        if not restaurants:
            return
        with self._connect() as connection:
            connection.executemany(
                """
                INSERT INTO restaurants (
                    id, external_id, source, name, category, address,
                    raw_type, avg_price, avg_price_known, business_hours,
                    distance_meters, lng, lat, walking_minutes, riding_minutes,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    external_id = excluded.external_id,
                    source = excluded.source,
                    name = excluded.name,
                    category = excluded.category,
                    address = excluded.address,
                    raw_type = excluded.raw_type,
                    avg_price = excluded.avg_price,
                    avg_price_known = excluded.avg_price_known,
                    business_hours = excluded.business_hours,
                    distance_meters = excluded.distance_meters,
                    lng = excluded.lng,
                    lat = excluded.lat,
                    walking_minutes = excluded.walking_minutes,
                    riding_minutes = excluded.riding_minutes,
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
                        item.get("raw_type", ""),
                        int(item["avg_price"]),
                        1 if item.get("avg_price_known", True) else 0,
                        item["business_hours"],
                        int(item["distance_meters"]),
                        item.get("lng"),
                        item.get("lat"),
                        item.get("walking_minutes"),
                        item.get("riding_minutes"),
                    )
                    for item in restaurants
                ],
            )

    def fetch_restaurant(self, restaurant_id: str) -> dict | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, external_id, source, name, category, address,
                       raw_type, avg_price, avg_price_known, business_hours,
                       distance_meters, lng, lat, walking_minutes, riding_minutes,
                       updated_at
                FROM restaurants
                WHERE id = ? OR external_id = ?
                ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
                LIMIT 1
                """,
                (restaurant_id, restaurant_id, restaurant_id),
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
            "raw_type": row["raw_type"] or "",
            "avg_price": int(row["avg_price"]),
            "avg_price_known": bool(row["avg_price_known"]),
            "business_hours": row["business_hours"],
            "distance_meters": int(row["distance_meters"]),
            "lng": row["lng"],
            "lat": row["lat"],
            "walking_minutes": row["walking_minutes"],
            "riding_minutes": row["riding_minutes"],
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

    def clear_imported_reviews(self) -> int:
        with self._connect() as connection:
            cursor = connection.execute("DELETE FROM imported_reviews")
        return cursor.rowcount

    def clear_cached_restaurants(self) -> int:
        with self._connect() as connection:
            cursor = connection.execute("DELETE FROM restaurants")
        return cursor.rowcount

    def clear_candidate_cache(self) -> int:
        with self._connect() as connection:
            cursor = connection.execute("DELETE FROM recommendation_candidate_cache")
        return cursor.rowcount

    def fetch_candidate_cache(self, cache_key: str) -> dict | None:
        now = time()
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT source, candidates_json, debug_json, expires_at
                FROM recommendation_candidate_cache
                WHERE cache_key = ? AND expires_at > ?
                """,
                (cache_key, now),
            ).fetchone()
        if row is None:
            return None
        try:
            candidates = json.loads(row["candidates_json"])
            debug = json.loads(row["debug_json"])
        except json.JSONDecodeError:
            return None
        if not isinstance(candidates, list) or not isinstance(debug, dict):
            return None
        return {
            "source": row["source"],
            "candidates": candidates,
            "debug": debug,
            "expires_at": float(row["expires_at"]),
        }

    def upsert_candidate_cache(
        self,
        *,
        cache_key: str,
        lat: float,
        lng: float,
        category: str,
        source: str,
        candidates: list[dict],
        debug: dict,
        ttl_seconds: int,
    ) -> None:
        if ttl_seconds <= 0:
            return
        expires_at = time() + ttl_seconds
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO recommendation_candidate_cache (
                    cache_key, lat, lng, category, source, candidates_json,
                    debug_json, expires_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(cache_key) DO UPDATE SET
                    lat = excluded.lat,
                    lng = excluded.lng,
                    category = excluded.category,
                    source = excluded.source,
                    candidates_json = excluded.candidates_json,
                    debug_json = excluded.debug_json,
                    expires_at = excluded.expires_at,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    cache_key,
                    lat,
                    lng,
                    category,
                    source,
                    json.dumps(candidates, ensure_ascii=False),
                    json.dumps(debug, ensure_ascii=False),
                    expires_at,
                ),
            )

    def replace_reviews(self, restaurant_id: str, reviews: list[dict]) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM imported_reviews WHERE restaurant_id = ?",
                (restaurant_id,),
            )
            connection.executemany(
                """
                INSERT INTO imported_reviews (
                    restaurant_id, rating, content, days_ago, is_visible
                )
                VALUES (?, ?, ?, ?, 1)
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

    def append_reviews(self, restaurant_id: str, reviews: list[dict]) -> int:
        if not reviews:
            return 0
        existing = {
            (item["rating"], item["content"], item["days_ago"])
            for item in self.fetch_reviews(restaurant_id, include_hidden=True)
        }
        new_reviews = [
            review
            for review in reviews
            if (review["rating"], review["content"], review["days_ago"]) not in existing
        ]
        if not new_reviews:
            return 0
        with self._connect() as connection:
            connection.executemany(
                """
                INSERT INTO imported_reviews (
                    restaurant_id, rating, content, days_ago, is_visible
                )
                VALUES (?, ?, ?, ?, 1)
                """,
                [
                    (
                        restaurant_id,
                        int(review["rating"]),
                        str(review["content"]),
                        int(review["days_ago"]),
                    )
                    for review in new_reviews
                ],
            )
        return len(new_reviews)

    def append_review(self, restaurant_id: str, review: dict) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO imported_reviews (
                    restaurant_id, rating, content, days_ago, is_visible
                )
                VALUES (?, ?, ?, ?, 1)
                """,
                (
                    restaurant_id,
                    int(review["rating"]),
                    str(review["content"]),
                    int(review["days_ago"]),
                ),
            )

    def fetch_reviews(self, restaurant_id: str, include_hidden: bool = False) -> list[dict]:
        with self._connect() as connection:
            visibility_clause = "" if include_hidden else "AND is_visible = 1"
            rows = connection.execute(
                f"""
                SELECT id, rating, content, days_ago, is_visible, created_at
                FROM imported_reviews
                WHERE restaurant_id = ?
                {visibility_clause}
                ORDER BY id DESC
                """,
                (restaurant_id,),
            ).fetchall()
        return [
            {
                "review_id": int(row["id"]),
                "rating": int(row["rating"]),
                "content": row["content"],
                "days_ago": int(row["days_ago"]),
                "is_visible": bool(row["is_visible"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def list_imported_restaurants(self) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    restaurant_id,
                    COALESCE(
                        (
                            SELECT restaurants.name
                            FROM restaurants
                            WHERE restaurants.id = reviews.restaurant_id
                            LIMIT 1
                        ),
                        (
                            SELECT restaurants.name
                            FROM restaurants
                            WHERE restaurants.external_id = reviews.restaurant_id
                            LIMIT 1
                        )
                    ) AS restaurant_name,
                    COUNT(*) AS review_count,
                    MAX(created_at) AS last_imported_at
                FROM imported_reviews AS reviews
                GROUP BY restaurant_id
                ORDER BY last_imported_at DESC, restaurant_id ASC
                """
            ).fetchall()
        return [
            {
                "restaurant_id": row["restaurant_id"],
                "restaurant_name": row["restaurant_name"],
                "review_count": int(row["review_count"]),
                "last_imported_at": row["last_imported_at"],
            }
            for row in rows
        ]

    def list_recent_reviews(self, limit: int = 20) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    id,
                    restaurant_id,
                    COALESCE(
                        (
                            SELECT restaurants.name
                            FROM restaurants
                            WHERE restaurants.id = reviews.restaurant_id
                            LIMIT 1
                        ),
                        (
                            SELECT restaurants.name
                            FROM restaurants
                            WHERE restaurants.external_id = reviews.restaurant_id
                            LIMIT 1
                        )
                    ) AS restaurant_name,
                    rating,
                    content,
                    days_ago,
                    is_visible,
                    created_at
                FROM imported_reviews AS reviews
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "review_id": int(row["id"]),
                "restaurant_id": row["restaurant_id"],
                "restaurant_name": row["restaurant_name"],
                "rating": int(row["rating"]),
                "content": row["content"],
                "days_ago": int(row["days_ago"]),
                "is_visible": bool(row["is_visible"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def set_review_visibility(self, review_id: int, is_visible: bool) -> dict | None:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE imported_reviews
                SET is_visible = ?
                WHERE id = ?
                """,
                (1 if is_visible else 0, review_id),
            )
            if cursor.rowcount == 0:
                return None
            row = connection.execute(
                """
                SELECT id, restaurant_id, is_visible
                FROM imported_reviews
                WHERE id = ?
                """,
                (review_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "review_id": int(row["id"]),
            "restaurant_id": row["restaurant_id"],
            "is_visible": bool(row["is_visible"]),
        }
