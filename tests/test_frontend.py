import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class FrontendRoutesTest(unittest.TestCase):
    def test_routes_serve_the_same_react_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry = '<div id="root"></div><script src="/assets/app.js"></script>'
            (root / "index.html").write_text(entry)
            with patch("app.main.FRONTEND_DIR", root):
                client = TestClient(app)
                for route in ["/", "/recommendations", "/restaurant-view", "/map-view", "/review-import", "/admin",
                              "/login", "/discover", "/entries/new", "/entries/example/edit", "/shares", "/shares/new", "/shares/import"]:
                    with self.subTest(route=route):
                        response = client.get(route)
                        self.assertEqual(response.status_code, 200)
                        self.assertEqual(response.text, entry)
                        self.assertEqual(response.headers["cache-control"], "no-cache")

    def test_missing_build_has_actionable_response(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch("app.main.FRONTEND_DIR", Path(directory)):
                response = TestClient(app).get("/")
                self.assertEqual(response.status_code, 503)
                self.assertIn("npm run build", response.json()["detail"])
