import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.library import COOKIE_NAME, _attempts
from app.main import app
from app.schemas.library import EntryInput, ShareInput
from app.services.library_service import LibraryError, LibraryService, token_hash


class PersonalLibraryTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.service = LibraryService(Path(self.directory.name) / "library.db")
        self.alice, self.alice_token = self.service.register("alice", "Alice", "test-password-123")
        self.bob, self.bob_token = self.service.register("bob", "Bob", "test-password-456")
        self.payload = EntryInput(restaurant_name="真实体验测试餐厅", rating=4, content="分量足，服务及时", visited_on=date.today())
        self.patch = patch("app.api.library.library", self.service)
        self.patch.start()
        _attempts.clear()
        self.client = TestClient(app)
        self.client.cookies.set(COOKIE_NAME, self.alice_token)

    def tearDown(self):
        self.client.close()
        self.patch.stop()
        self.directory.cleanup()

    def make_share(self):
        entry = self.service.create_entry(self.alice, self.payload)
        share = self.service.create_share(self.alice, ShareInput(title="周末餐厅", entry_ids=[entry["id"]]))
        return entry, share

    def test_passwords_and_session_tokens_are_not_stored_in_plaintext(self):
        with self.service.connection() as connection:
            user = connection.execute("SELECT * FROM library_users WHERE id = ?", (self.alice["id"],)).fetchone()
            self.assertNotIn("test-password-123", str(dict(user)))
            session = connection.execute("SELECT * FROM library_sessions WHERE owner_id = ?", (self.alice["id"],)).fetchone()
            self.assertEqual(session["token_hash"], token_hash(self.alice_token))
        _, token = self.service.login("ALICE", "test-password-123")
        self.assertEqual(self.service.current_user(token)["id"], self.alice["id"])
        self.service.logout(token)
        with self.assertRaises(LibraryError):
            self.service.current_user(token)

    def test_all_record_operations_enforce_owner(self):
        entry = self.service.create_entry(self.alice, self.payload)
        self.assertEqual(self.service.list_entries(self.bob["id"]), [])
        operations = [
            lambda: self.service.get_entry(self.bob["id"], entry["id"]),
            lambda: self.service.update_entry(self.bob["id"], entry["id"], self.payload),
            lambda: self.service.delete_entry(self.bob["id"], entry["id"]),
            lambda: self.service.favorite_entry(self.bob["id"], entry["id"], True),
            lambda: self.service.create_share(self.bob, ShareInput(title="不应成功", entry_ids=[entry["id"]])),
        ]
        for operation in operations:
            with self.assertRaises(LibraryError) as failure:
                operation()
            self.assertEqual(failure.exception.status, 404)

    def test_sharing_is_a_selected_snapshot_not_live_entire_library(self):
        entry, share = self.make_share()
        self.service.create_entry(self.alice, self.payload.model_copy(update={"content": "不能泄露的其他记录"}))
        self.service.update_entry(self.alice["id"], entry["id"], self.payload.model_copy(update={"content": "之后修改的原文"}))
        preview = self.service.preview_share(self.bob["id"], share["code"])
        self.assertEqual(len(preview["entries"]), 1)
        self.assertEqual(preview["entries"][0]["content"], self.payload.content)
        self.assertNotIn("favorite", preview["entries"][0])
        self.assertNotIn("origin_id", preview["entries"][0])
        with self.service.connection() as connection:
            row = connection.execute("SELECT * FROM library_shares").fetchone()
            self.assertNotIn(share["code"], str(dict(row)))

    def test_import_preserves_author_and_deduplicates_across_share_codes(self):
        entry, share = self.make_share()
        self.assertEqual(self.service.import_share(self.bob["id"], share["code"])["imported_count"], 1)
        self.assertEqual(self.service.import_share(self.bob["id"], share["code"])["skipped_count"], 1)
        second = self.service.create_share(self.alice, ShareInput(title="另一份分享", entry_ids=[entry["id"]]))
        self.assertEqual(self.service.import_share(self.bob["id"], second["code"])["imported_count"], 0)
        imported = self.service.list_entries(self.bob["id"])[0]
        self.assertEqual(imported["kind"], "imported")
        self.assertEqual(imported["author_name"], "Alice")
        self.assertEqual(imported["content"], self.payload.content)
        with self.assertRaises(LibraryError):
            self.service.update_entry(self.bob["id"], imported["id"], self.payload)
        with self.assertRaises(LibraryError):
            self.service.create_share(self.bob, ShareInput(title="冒充原作者", entry_ids=[imported["id"]]))

    def test_concurrent_import_is_atomic_and_idempotent(self):
        _, share = self.make_share()
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda _: self.service.import_share(self.bob["id"], share["code"]), range(4)))
        self.assertEqual(sum(result["imported_count"] for result in results), 1)
        self.assertEqual(self.service.list_shares(self.alice["id"])[0]["import_count"], 1)

    def test_revocation_blocks_future_access_but_preserves_imported_copy(self):
        _, share = self.make_share()
        self.service.import_share(self.bob["id"], share["code"])
        self.service.revoke_share(self.alice["id"], share["id"])
        with self.assertRaises(LibraryError):
            self.service.preview_share(self.bob["id"], share["code"])
        with self.assertRaises(LibraryError):
            self.service.import_share(self.bob["id"], share["code"])
        self.assertEqual(len(self.service.list_entries(self.bob["id"])), 1)

    def test_expired_shares_and_cross_owner_revocation_are_rejected(self):
        _, share = self.make_share()
        with self.assertRaises(LibraryError):
            self.service.revoke_share(self.bob["id"], share["id"])
        with patch("app.services.library_service.time", return_value=share["expires_at"] + 1):
            with self.assertRaises(LibraryError):
                self.service.import_share(self.bob["id"], share["code"])

    def test_deleting_an_entry_revokes_shares_containing_it(self):
        entry, share = self.make_share()
        self.service.delete_entry(self.alice["id"], entry["id"])
        with self.assertRaises(LibraryError):
            self.service.preview_share(self.bob["id"], share["code"])

    def test_api_cookie_auth_csrf_and_no_cache(self):
        response = self.client.get("/api/library/entries")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        response = self.client.post("/api/library/entries", json=self.payload.model_dump(mode="json"), headers={"Origin": "https://attacker.example"})
        self.assertEqual(response.status_code, 403)
        self.client.cookies.clear()
        self.assertEqual(self.client.get("/api/library/entries").status_code, 401)
        response = self.client.post("/api/library/auth/login", json={"username": "alice", "password": "test-password-123"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        self.assertIn("SameSite=strict", response.headers["set-cookie"])
        self.assertNotIn("password", response.text)
        self.assertEqual(self.client.post("/api/library/auth/logout").status_code, 204)
        self.assertEqual(self.client.get("/api/library/auth/me").status_code, 401)

    def test_api_two_person_share_flow(self):
        entry = self.client.post("/api/library/entries", json=self.payload.model_dump(mode="json"))
        self.assertEqual(entry.status_code, 201)
        share = self.client.post("/api/library/shares", json={"title": "一起吃过的店", "entry_ids": [entry.json()["id"]]})
        self.assertEqual(share.status_code, 201)
        self.client.cookies.clear()
        self.client.cookies.set(COOKIE_NAME, self.bob_token)
        self.assertEqual(self.client.get("/api/library/entries").json()["total"], 0)
        self.assertEqual(self.client.post("/api/library/share-preview", json={"code": share.json()["code"]}).status_code, 200)
        imported = self.client.post("/api/library/share-import", json={"code": share.json()["code"]})
        self.assertEqual(imported.json()["imported_count"], 1)
        self.assertEqual(self.client.get("/api/library/entries").json()["entries"][0]["author_name"], "Alice")

    def test_invalid_payloads_and_auth_rate_limit(self):
        payload = self.payload.model_dump(mode="json")
        for invalid in [{"rating": 6}, {"visited_on": "2999-01-01"}, {"lat": 30}, {"owner_id": self.bob["id"]}, {"content": "   "}]:
            self.assertEqual(self.client.post("/api/library/entries", json={**payload, **invalid}).status_code, 422)
        for _ in range(30):
            self.client.post("/api/library/auth/login", json={})
        self.assertEqual(self.client.post("/api/library/auth/login", json={}).status_code, 429)

    def test_legacy_public_review_endpoints_are_no_longer_public(self):
        for method, path in [("GET", "/api/restaurants/r001"), ("POST", "/api/reviews/feedback"),
                             ("POST", "/api/recommend/restaurants"), ("POST", "/api/recommend/debug")]:
            with self.subTest(path=path):
                self.assertIn(self.client.request(method, path).status_code, (401, 503))

    def test_discovery_does_not_expose_review_text_or_fake_places(self):
        candidate = {"id": "poi", "name": "餐厅", "category": "火锅", "address": "实际地址", "lat": 31, "lng": 121,
                     "distance_meters": 200, "avg_price": 50, "avg_price_known": True, "reviews": [{"content": "私人内容"}]}
        with patch("app.api.library.restaurant_service.source_service.fetch_candidates", return_value=([candidate], "amap")):
            result = self.client.post("/api/library/places", json={"lat": 31, "lng": 121})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["places"][0]["restaurant_name"], "餐厅")
            self.assertNotIn("私人内容", result.text)
        with patch("app.api.library.restaurant_service.source_service.fetch_candidates", return_value=([candidate], "mock")):
            self.assertEqual(self.client.post("/api/library/places", json={"lat": 31, "lng": 121}).json()["places"], [])
