"""Simple TTL-based disk cache utilities."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class CacheEntry:
    data: Any
    created_at: datetime


class DiskCache:
    """Persist JSON-serialisable responses on disk with optional TTL."""

    def __init__(self, namespace: str, base_dir: Path, ttl: timedelta | None = None) -> None:
        self.namespace = namespace
        self.base_dir = base_dir / namespace
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl

    def _path_for_key(self, key: str) -> Path:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return self.base_dir / f"{digest}.json"

    def load(self, key: str) -> CacheEntry | None:
        path = self._path_for_key(key)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text("utf-8"))
        except json.JSONDecodeError:
            path.unlink(missing_ok=True)
            return None
        created_at = datetime.fromisoformat(payload.get("created_at")) if payload.get("created_at") else None
        if created_at is None:
            path.unlink(missing_ok=True)
            return None
        if self.ttl is not None and created_at + self.ttl < datetime.now(timezone.utc):
            path.unlink(missing_ok=True)
            return None
        return CacheEntry(data=payload.get("data"), created_at=created_at)

    def store(self, key: str, data: Any) -> None:
        path = self._path_for_key(key)
        payload = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


__all__ = ["DiskCache", "CacheEntry"]
