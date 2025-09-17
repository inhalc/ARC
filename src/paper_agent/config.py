"""Global configuration and defaults for the paper agent project."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class Settings:
    """Application settings resolved from environment variables."""

    data_dir: Path = Path(os.environ.get("PAPER_AGENT_DATA_DIR", "data"))
    openalex_mailto: str | None = os.environ.get("PAPER_AGENT_OPENALEX_MAILTO") or None
    arxiv_email: str | None = os.environ.get("PAPER_AGENT_ARXIV_EMAIL") or None
    cache_ttl_hours: int = int(os.environ.get("PAPER_AGENT_CACHE_TTL_HOURS", "72"))
    http_timeout: float = float(os.environ.get("PAPER_AGENT_HTTP_TIMEOUT", "30"))

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
