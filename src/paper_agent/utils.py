"""Utility helpers for paper aggregation."""
from __future__ import annotations

from typing import Iterable, List

from .models import PaperRecord


def deduplicate_records(records: Iterable[PaperRecord]) -> list[PaperRecord]:
    seen: set[str] = set()
    unique: list[PaperRecord] = []
    for record in records:
        key = (record.doi or record.external_id or record.title or "").strip().lower()
        if not key:
            continue
        if key in seen:
            continue
        seen.add(key)
        unique.append(record)
    return unique


def format_brief_authors(authors: List[str], *, max_items: int = 3) -> str:
    if not authors:
        return "Unknown"
    if len(authors) <= max_items:
        return ", ".join(authors)
    return ", ".join(authors[:max_items]) + f" and {len(authors) - max_items} more"


__all__ = ["deduplicate_records", "format_brief_authors"]
