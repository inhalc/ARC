"""Global configuration and defaults for the paper agent project."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        value = value.strip().strip("'\"")
        os.environ.setdefault(key, value)


def _bootstrap_env() -> None:
    env_path = Path(os.environ.get("PAPER_AGENT_ENV_FILE", ".env"))
    _load_env_file(env_path)


default_env_loaded = False
if not default_env_loaded:
    _bootstrap_env()
    default_env_loaded = True


@dataclass(slots=True)
class Settings:
    """Application settings resolved from environment variables."""

    data_dir: Path = Path(os.environ.get("PAPER_AGENT_DATA_DIR", "data"))
    openalex_mailto: str | None = os.environ.get("PAPER_AGENT_OPENALEX_MAILTO") or None
    arxiv_email: str | None = os.environ.get("PAPER_AGENT_ARXIV_EMAIL") or None
    cache_ttl_hours: int = int(os.environ.get("PAPER_AGENT_CACHE_TTL_HOURS", "72"))
    http_timeout: float = float(os.environ.get("PAPER_AGENT_HTTP_TIMEOUT", "30"))
    embedding_model: str = os.environ.get("PAPER_AGENT_EMBED_MODEL", "BAAI/bge-base-en-v1.5")
    summary_model: str = os.environ.get("PAPER_AGENT_SUMMARY_MODEL", "facebook/bart-large-cnn")
    summary_language: str = os.environ.get("PAPER_AGENT_SUMMARY_LANGUAGE", "zh")
    device: str = os.environ.get("PAPER_AGENT_DEVICE", "auto")
    top_k: int = int(os.environ.get("PAPER_AGENT_TOP_K", "20"))
    rerank_k: int = int(os.environ.get("PAPER_AGENT_RERANK_K", "10"))

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
