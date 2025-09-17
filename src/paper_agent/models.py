"""Data models shared across data sources."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class PaperRecord(BaseModel):
    source: Literal["openalex", "arxiv"]
    external_id: str
    title: str
    abstract: str | None = None
    authors: list[str] = Field(default_factory=list)
    published: datetime | None = None
    year: int | None = None
    doi: str | None = None
    url: str | None = None
    citation_count: int | None = None
    venue: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "extra": "allow",
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }


__all__ = ["PaperRecord"]
