import hashlib
import hmac
import json
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from time import time
from uuid import uuid4

from app.schemas.library import EntryInput, ShareInput


class LibraryError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def password_hash(password: str, salt: bytes) -> str:
    return hashlib.scrypt(password.encode(), salt=salt, n=32768, r=8, p=1, maxmem=64 * 1024 * 1024).hex()


class LibraryService:
    SESSION_SECONDS = 30 * 86400

    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS library_users (
                    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
                    display_name TEXT NOT NULL, salt TEXT NOT NULL,
                    password_hash TEXT NOT NULL, created_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS library_sessions (
                    token_hash TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL REFERENCES library_users(id) ON DELETE CASCADE,
                    expires_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS library_entries (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL REFERENCES library_users(id) ON DELETE CASCADE,
                    origin_id TEXT NOT NULL, author_name TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK(kind IN ('own', 'imported', 'legacy')),
                    data_json TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0,
                    source_title TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL, updated_at REAL NOT NULL,
                    UNIQUE(owner_id, origin_id)
                );
                CREATE INDEX IF NOT EXISTS idx_library_entries_owner ON library_entries(owner_id, updated_at);
                CREATE TABLE IF NOT EXISTS library_shares (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL REFERENCES library_users(id) ON DELETE CASCADE,
                    code_hash TEXT UNIQUE NOT NULL, code_hint TEXT NOT NULL,
                    title TEXT NOT NULL, snapshot_json TEXT NOT NULL,
                    created_at REAL NOT NULL, expires_at REAL NOT NULL,
                    revoked_at REAL, import_count INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_library_shares_owner ON library_shares(owner_id);
                CREATE TABLE IF NOT EXISTS library_share_entries (
                    share_id TEXT NOT NULL REFERENCES library_shares(id) ON DELETE CASCADE,
                    entry_id TEXT NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
                    PRIMARY KEY(share_id, entry_id)
                );
                CREATE TABLE IF NOT EXISTS library_share_imports (
                    share_id TEXT NOT NULL REFERENCES library_shares(id) ON DELETE CASCADE,
                    owner_id TEXT NOT NULL REFERENCES library_users(id) ON DELETE CASCADE,
                    PRIMARY KEY(share_id, owner_id)
                );
            """)
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(library_entries)")}
            if "is_public" not in columns:
                connection.execute("ALTER TABLE library_entries ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0")
            connection.execute("CREATE INDEX IF NOT EXISTS idx_library_public ON library_entries(is_public, updated_at)")

    @contextmanager
    def connection(self, write: bool = False):
        connection = sqlite3.connect(self.db_path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            if write:
                connection.execute("BEGIN IMMEDIATE")
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def register(self, username: str, display_name: str, password: str) -> tuple[dict, str]:
        salt = secrets.token_bytes(16)
        digest = password_hash(password, salt)
        user_id = uuid4().hex
        with self.connection(write=True) as connection:
            try:
                connection.execute(
                    "INSERT INTO library_users VALUES (?, ?, ?, ?, ?, ?)",
                    (user_id, username.lower(), display_name, salt.hex(), digest, time()),
                )
            except sqlite3.IntegrityError as exc:
                raise LibraryError(409, "账号已被使用，请换一个账号名") from exc
            token = self._new_session(connection, user_id)
        return {"id": user_id, "username": username.lower(), "display_name": display_name}, token

    def login(self, username: str, password: str) -> tuple[dict, str]:
        with self.connection() as connection:
            user = connection.execute("SELECT * FROM library_users WHERE username = ?", (username.lower(),)).fetchone()
        salt = bytes.fromhex(user["salt"]) if user else b"missing-user-salt"
        digest = password_hash(password, salt)
        if user is None or not hmac.compare_digest(digest, user["password_hash"]):
            raise LibraryError(401, "账号或密码不正确")
        with self.connection(write=True) as connection:
            token = self._new_session(connection, user["id"])
        return {key: user[key] for key in ("id", "username", "display_name")}, token

    def _new_session(self, connection, owner_id: str) -> str:
        token = secrets.token_urlsafe(32)
        connection.execute("DELETE FROM library_sessions WHERE expires_at <= ?", (time(),))
        connection.execute("INSERT INTO library_sessions VALUES (?, ?, ?)", (token_hash(token), owner_id, time() + self.SESSION_SECONDS))
        return token

    def current_user(self, token: str | None) -> dict:
        if not token or len(token) > 256:
            raise LibraryError(401, "请先登录个人库")
        with self.connection() as connection:
            user = connection.execute("""
                SELECT users.id, users.username, users.display_name
                FROM library_sessions sessions JOIN library_users users ON users.id = sessions.owner_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """, (token_hash(token), time())).fetchone()
        if user is None:
            raise LibraryError(401, "登录已失效，请重新登录")
        return dict(user)

    def logout(self, token: str | None) -> None:
        if token:
            with self.connection(write=True) as connection:
                connection.execute("DELETE FROM library_sessions WHERE token_hash = ?", (token_hash(token),))

    def _entry(self, row) -> dict:
        return {
            **json.loads(row["data_json"]),
            "id": row["id"], "kind": row["kind"], "author_name": row["author_name"],
            "favorite": bool(row["favorite"]), "source_title": row["source_title"],
            "created_at": row["created_at"], "updated_at": row["updated_at"],
            "is_public": bool(row["is_public"]) and row["kind"] == "own",
            "origin_id": row["origin_id"],
            "author_id": row["owner_id"] if row["kind"] == "own" else json.loads(row["data_json"]).get("source_author_id", row["author_name"]),
        }

    def list_entries(self, owner_id: str) -> list[dict]:
        with self.connection() as connection:
            rows = connection.execute("SELECT * FROM library_entries WHERE owner_id = ? ORDER BY updated_at DESC, id", (owner_id,)).fetchall()
        return [self._entry(row) for row in rows]

    def get_entry(self, owner_id: str, entry_id: str) -> dict:
        with self.connection() as connection:
            row = connection.execute("SELECT * FROM library_entries WHERE owner_id = ? AND id = ?", (owner_id, entry_id)).fetchone()
        if row is None:
            raise LibraryError(404, "记录不存在")
        return self._entry(row)

    def create_entry(self, user: dict, payload: EntryInput) -> dict:
        entry_id = uuid4().hex
        now = time()
        data = payload.model_dump(mode="json", exclude={"favorite", "is_public"})
        with self.connection(write=True) as connection:
            connection.execute("""
                INSERT INTO library_entries
                (id, owner_id, origin_id, author_name, kind, data_json, favorite, created_at, updated_at, is_public)
                VALUES (?, ?, ?, ?, 'own', ?, ?, ?, ?, ?)
            """, (entry_id, user["id"], entry_id, user["display_name"], json.dumps(data, ensure_ascii=False), payload.favorite, now, now, payload.is_public))
        return self.get_entry(user["id"], entry_id)

    def update_entry(self, owner_id: str, entry_id: str, payload: EntryInput) -> dict:
        data = payload.model_dump(mode="json", exclude={"favorite", "is_public"})
        with self.connection(write=True) as connection:
            row = connection.execute("SELECT kind FROM library_entries WHERE owner_id = ? AND id = ?", (owner_id, entry_id)).fetchone()
            if row is None:
                raise LibraryError(404, "记录不存在")
            if row["kind"] != "own":
                raise LibraryError(403, "导入体验保留原作者内容，不能改写为自己的体验")
            connection.execute("UPDATE library_entries SET data_json = ?, favorite = ?, updated_at = ?, is_public = ? WHERE id = ? AND owner_id = ?",
                               (json.dumps(data, ensure_ascii=False), payload.favorite, time(), payload.is_public, entry_id, owner_id))
        return self.get_entry(owner_id, entry_id)

    def favorite_entry(self, owner_id: str, entry_id: str, favorite: bool) -> dict:
        with self.connection(write=True) as connection:
            result = connection.execute("UPDATE library_entries SET favorite = ? WHERE owner_id = ? AND id = ?", (favorite, owner_id, entry_id))
            if not result.rowcount:
                raise LibraryError(404, "记录不存在")
        return self.get_entry(owner_id, entry_id)

    def public_entries(self, author_id: str | None = None) -> list[dict]:
        with self.connection() as connection:
            rows = connection.execute("""
                SELECT * FROM library_entries WHERE kind = 'own' AND is_public = 1
                AND (? IS NULL OR owner_id = ?) ORDER BY updated_at DESC, id LIMIT 1000
            """, (author_id, author_id)).fetchall()
        allowed = set(EntryInput.model_fields) - {"favorite"}
        allowed.update({"id", "author_id", "author_name", "created_at", "updated_at"})
        return [{key: value for key, value in self._entry(row).items() if key in allowed} for row in rows]

    def delete_entry(self, owner_id: str, entry_id: str) -> None:
        with self.connection(write=True) as connection:
            row = connection.execute("SELECT id FROM library_entries WHERE owner_id = ? AND id = ?", (owner_id, entry_id)).fetchone()
            if row is None:
                raise LibraryError(404, "记录不存在")
            connection.execute("""
                UPDATE library_shares SET revoked_at = ? WHERE owner_id = ? AND revoked_at IS NULL
                AND id IN (SELECT share_id FROM library_share_entries WHERE entry_id = ?)
            """, (time(), owner_id, entry_id))
            connection.execute("DELETE FROM library_entries WHERE owner_id = ? AND id = ?", (owner_id, entry_id))

    def create_share(self, user: dict, payload: ShareInput) -> dict:
        code = "WTE-" + secrets.token_urlsafe(18)
        share_id = uuid4().hex
        now = time()
        expires = now + payload.expires_in_days * 86400
        with self.connection(write=True) as connection:
            snapshots = []
            for entry_id in payload.entry_ids:
                row = connection.execute("SELECT * FROM library_entries WHERE owner_id = ? AND id = ? AND kind = 'own'", (user["id"], entry_id)).fetchone()
                if row is None:
                    raise LibraryError(404, "只能分享个人库中由自己撰写的体验")
                snapshots.append({**self._entry(row), "origin_id": row["origin_id"]})
            connection.execute("""
                INSERT INTO library_shares
                (id, owner_id, code_hash, code_hint, title, snapshot_json, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (share_id, user["id"], token_hash(code), code[-4:], payload.title, json.dumps(snapshots, ensure_ascii=False), now, expires))
            connection.executemany("INSERT INTO library_share_entries VALUES (?, ?)", [(share_id, entry_id) for entry_id in payload.entry_ids])
        return {"id": share_id, "code": code, "title": payload.title, "count": len(snapshots), "expires_at": expires}

    def list_shares(self, owner_id: str) -> list[dict]:
        with self.connection() as connection:
            rows = connection.execute("SELECT * FROM library_shares WHERE owner_id = ? ORDER BY created_at DESC", (owner_id,)).fetchall()
        return [{"id": row["id"], "title": row["title"], "code_hint": row["code_hint"],
                 "count": len(json.loads(row["snapshot_json"])), "created_at": row["created_at"],
                 "expires_at": row["expires_at"], "revoked_at": row["revoked_at"], "import_count": row["import_count"]} for row in rows]

    def revoke_share(self, owner_id: str, share_id: str) -> None:
        with self.connection(write=True) as connection:
            result = connection.execute("UPDATE library_shares SET revoked_at = COALESCE(revoked_at, ?) WHERE owner_id = ? AND id = ?", (time(), owner_id, share_id))
            if not result.rowcount:
                raise LibraryError(404, "分享不存在")

    def _active_share(self, connection, code: str):
        row = connection.execute("SELECT * FROM library_shares WHERE code_hash = ? AND revoked_at IS NULL AND expires_at > ?", (token_hash(code.strip()), time())).fetchone()
        if row is None:
            raise LibraryError(404, "分享码无效、已过期或已撤销")
        return row

    def preview_share(self, owner_id: str, code: str) -> dict:
        with self.connection() as connection:
            row = self._active_share(connection, code)
            snapshots = json.loads(row["snapshot_json"])
            existing = {item["origin_id"] for item in connection.execute("SELECT origin_id FROM library_entries WHERE owner_id = ?", (owner_id,)).fetchall()}
        entries = [{key: value for key, value in entry.items() if key not in {"origin_id", "favorite"}} | {"already_imported": entry["origin_id"] in existing} for entry in snapshots]
        return {"title": row["title"], "expires_at": row["expires_at"], "is_owner": row["owner_id"] == owner_id, "entries": entries}

    def import_share(self, owner_id: str, code: str) -> dict:
        with self.connection(write=True) as connection:
            row = self._active_share(connection, code)
            if row["owner_id"] == owner_id:
                raise LibraryError(409, "这些体验已经在你的个人库中")
            snapshots = json.loads(row["snapshot_json"])
            imported = 0
            now = time()
            for entry in snapshots:
                data = {key: value for key, value in entry.items() if key in EntryInput.model_fields and key not in {"favorite", "is_public"}}
                data["source_author_id"] = entry.get("author_id", entry["author_name"])
                result = connection.execute("""
                    INSERT INTO library_entries
                    (id, owner_id, origin_id, author_name, kind, data_json, favorite, source_title, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'imported', ?, 0, ?, ?, ?)
                    ON CONFLICT(owner_id, origin_id) DO NOTHING
                """, (uuid4().hex, owner_id, entry["origin_id"], entry["author_name"], json.dumps(data, ensure_ascii=False), row["title"], now, now))
                imported += result.rowcount
            if imported:
                result = connection.execute("INSERT OR IGNORE INTO library_share_imports VALUES (?, ?)", (row["id"], owner_id))
                if result.rowcount:
                    connection.execute("UPDATE library_shares SET import_count = import_count + 1 WHERE id = ?", (row["id"],))
        return {"imported_count": imported, "skipped_count": len(snapshots) - imported, "title": row["title"]}
