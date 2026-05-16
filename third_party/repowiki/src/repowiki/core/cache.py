"""sqlite-based cache for analysis results.

The upstream project uses ``aiosqlite`` here. This vendored build runs as an
embedded engine, so the cache cannot require users to install an extra Python
package at runtime. Keep the public async API but back it with stdlib sqlite3.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from pathlib import Path

_CACHE_DIR = Path.home() / ".repowiki"
_CACHE_DB = _CACHE_DIR / "cache.db"
_DEFAULT_TTL = 7 * 24 * 3600  # 7 days


def content_hash(content: str) -> str:
    """sha256 hash truncated to 24 chars, used as cache key."""
    return hashlib.sha256(content.encode()).hexdigest()[:24]


class Cache:
    """async SQLite cache for LLM analysis results."""

    def __init__(self, db_path: str | Path | None = None):
        self.db_path = str(db_path or _CACHE_DB)
        self._db: sqlite3.Connection | None = None

    async def init(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(self.db_path)
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS cache "
            "(key TEXT PRIMARY KEY, value TEXT, created_at REAL)"
        )
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS projects "
            "(id TEXT PRIMARY KEY, data TEXT, created_at REAL)"
        )
        self._db.commit()

    async def get(self, key: str, ttl: int = _DEFAULT_TTL) -> dict | list | None:
        if not self._db:
            return None
        row = self._db.execute(
            "SELECT value, created_at FROM cache WHERE key = ?", (key,),
        ).fetchone()
        if not row:
            return None
        value, created_at = row
        if time.time() - created_at > ttl:
            self._db.execute("DELETE FROM cache WHERE key = ?", (key,))
            self._db.commit()
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None

    async def put(self, key: str, value: dict | list) -> None:
        if not self._db:
            return
        self._db.execute(
            "INSERT OR REPLACE INTO cache (key, value, created_at) VALUES (?, ?, ?)",
            (key, json.dumps(value, ensure_ascii=False), time.time()),
        )
        self._db.commit()

    async def save_project(self, project_id: str, data: dict) -> None:
        if not self._db:
            return
        self._db.execute(
            "INSERT OR REPLACE INTO projects (id, data, created_at) VALUES (?, ?, ?)",
            (project_id, json.dumps(data, ensure_ascii=False), time.time()),
        )
        self._db.commit()

    async def load_project(self, project_id: str) -> dict | None:
        if not self._db:
            return None
        row = self._db.execute(
            "SELECT data FROM projects WHERE id = ?", (project_id,),
        ).fetchone()
        if not row:
            return None
        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            return None

    async def close(self):
        if self._db:
            self._db.close()
            self._db = None
