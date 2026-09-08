import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.library import COOKIE_NAME, _attempts
from app.db.sqlite import SQLiteStore
from app.main import app
from app.schemas.library import EntryInput, ShareInput
from app.services.library_service import LibraryError, LibraryService
from app.services.restaurant_source_service import RestaurantSourceService


class FoodMapTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.service = LibraryService(Path(self.directory.name) / "map.db")
        self.author, self.token = self.service.register("map_author", "地图作者", "test-password-123")
        self.reader, _ = self.service.register("map_reader", "地图读者", "test-password-456")
        self.patch = patch("app.api.library.library", self.service)
        self.patch.start()
        _attempts.clear()
        self.client = TestClient(app)
        self.payload = EntryInput(restaurant_name="公开测试餐厅", rating=5, visited_on=date.today(), content="亲身体验", lat=31.23, lng=121.47)

    def tearDown(self):
        self.client.close()
        self.patch.stop()
        self.directory.cleanup()

    def test_public_browsing_only_exposes_opted_in_entries(self):
        private = self.service.create_entry(self.author, self.payload)
        self.assertEqual(self.client.get("/api/library/community/entries").json()["total"], 0)
        public = self.service.create_entry(self.author, self.payload.model_copy(update={"is_public": True}))
        result = self.client.get("/api/library/community/entries").json()
        self.assertEqual([item["id"] for item in result["entries"]], [public["id"]])
        self.assertNotIn("favorite", result["entries"][0])
        self.assertNotIn("origin_id", result["entries"][0])
        self.assertNotIn("username", result["entries"][0])
        self.assertEqual(self.client.get(f"/api/library/entries/{private['id']}").status_code, 401)
        self.assertEqual(self.client.get("/api/library/community/entries", params={"author_id": self.reader["id"]}).json()["total"], 0)

    def test_unpublishing_and_deletion_remove_public_access(self):
        public = self.service.create_entry(self.author, self.payload.model_copy(update={"is_public": True}))
        self.service.update_entry(self.author["id"], public["id"], self.payload)
        self.assertEqual(self.service.public_entries(), [])
        self.service.update_entry(self.author["id"], public["id"], self.payload.model_copy(update={"is_public": True}))
        self.service.delete_entry(self.author["id"], public["id"])
        self.assertEqual(self.service.public_entries(), [])

    def test_imported_public_entry_stays_private_and_read_only(self):
        public = self.service.create_entry(self.author, self.payload.model_copy(update={"is_public": True}))
        share = self.service.create_share(self.author, ShareInput(title="足迹", entry_ids=[public["id"]]))
        self.service.import_share(self.reader["id"], share["code"])
        imported = self.service.list_entries(self.reader["id"])[0]
        self.assertFalse(imported["is_public"])
        self.assertEqual(imported["author_id"], self.author["id"])
        self.assertEqual(imported["origin_id"], public["id"])
        with self.assertRaises(LibraryError):
            self.service.update_entry(self.reader["id"], imported["id"], self.payload.model_copy(update={"is_public": True}))
        self.service.update_entry(self.author["id"], public["id"], self.payload)
        self.assertEqual(self.service.public_entries(), [])
        self.assertEqual(len(self.service.list_entries(self.reader["id"])), 1)

    def test_public_post_requires_account_and_map_location(self):
        payload = self.payload.model_dump(mode="json") | {"is_public": True}
        self.assertEqual(self.client.post("/api/library/entries", json=payload).status_code, 401)
        self.client.cookies.set(COOKIE_NAME, self.token)
        self.assertEqual(self.client.post("/api/library/entries", json=payload | {"lat": None, "lng": None}).status_code, 422)
        self.assertEqual(self.client.post("/api/library/entries", json=payload).status_code, 201)

    def test_configured_amap_bypasses_persisted_mock_cache(self):
        store = SQLiteStore(Path(self.directory.name) / "cache.db")
        source = RestaurantSourceService(store)
        cache_key = (31.2304, 121.4737, "餐厅")
        store.upsert_candidate_cache(cache_key="31.2304|121.4737|餐厅", lat=cache_key[0], lng=cache_key[1], category=cache_key[2], source="mock", candidates=[], debug={}, ttl_seconds=600)
        with patch.object(source.amap_client, "is_configured", return_value=True):
            self.assertIsNone(source._get_candidate_cache(cache_key))
            with patch.object(store, "upsert_candidate_cache") as persist:
                source._set_candidate_cache(cache_key, [], "mock", {})
                persist.assert_not_called()
        source.close()
