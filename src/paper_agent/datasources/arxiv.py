"""arXiv API integration."""
from __future__ import annotations

import asyncio
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Any, Iterable, Sequence

import httpx

from ..cache import DiskCache
from ..config import settings
from ..models import PaperRecord

ARXIV_URL = "https://export.arxiv.org/api/query"

ttl = None if settings.cache_ttl_hours <= 0 else timedelta(hours=settings.cache_ttl_hours)
_cache = DiskCache("arxiv", settings.data_dir, ttl=ttl)

ATOM = "{http://www.w3.org/2005/Atom}"
ARXIV = "{http://arxiv.org/schemas/atom}"


def _make_cache_key(query: str, categories: Sequence[str] | None, max_results: int) -> str:
    return json.dumps({
        "query": query,
        "categories": list(categories) if categories else [],
        "max_results": max_results,
    }, sort_keys=True)


def _format_search_query(raw_query: str, categories: Sequence[str] | None) -> str:
    base = f'all:"{raw_query}"' if raw_query else "all:"""
    cat_parts = [f'cat:{cat}' for cat in (categories or [])]
    parts = [part for part in [base, *cat_parts] if part]
    return " AND ".join(parts)


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_entry(entry: Any) -> PaperRecord:
    title = (entry.findtext(f"{ATOM}title") or "").strip()
    abstract = (entry.findtext(f"{ATOM}summary") or "").strip()
    entry_id = entry.findtext(f"{ATOM}id") or ""
    external_id = entry_id.rsplit("/", 1)[-1] if entry_id else ""
    published = _parse_datetime(entry.findtext(f"{ATOM}published"))
    authors = [
        (author.findtext(f"{ATOM}name") or "").strip()
        for author in entry.findall(f"{ATOM}author")
    ]
    doi = entry.findtext(f"{ARXIV}doi")
    primary_category = entry.find(f"{ARXIV}primary_category")
    categories = [cat.attrib.get("term") for cat in entry.findall(f"{ATOM}category") if cat.attrib.get("term")]
    link = ""
    for link_node in entry.findall(f"{ATOM}link"):
        if link_node.attrib.get("rel") == "alternate":
            link = link_node.attrib.get("href", "")
            break
    return PaperRecord(
        source="arxiv",
        external_id=external_id,
        title=title,
        abstract=abstract,
        authors=[name for name in authors if name],
        published=published,
        year=published.year if published else None,
        doi=doi,
        url=link or entry_id,
        citation_count=None,
        venue=primary_category.attrib.get("term") if primary_category is not None else None,
        extra={
            "primary_category": primary_category.attrib.get("term") if primary_category is not None else None,
            "categories": categories,
        },
    )


async def search_arxiv(
    query: str,
    *,
    categories: Sequence[str] | None = None,
    max_results: int = 50,
    use_cache: bool = True,
    client: httpx.AsyncClient | None = None,
) -> list[PaperRecord]:
    if max_results <= 0:
        return []
    cache_key = _make_cache_key(query, categories, max_results)
    if use_cache:
        entry = _cache.load(cache_key)
        if entry is not None:
            return [PaperRecord.model_validate(item) for item in entry.data]

    created_client = False
    headers = {}
    if settings.arxiv_email:
        headers["User-Agent"] = f"paper-agent/0.1 ({settings.arxiv_email})"
    if client is None:
        client = httpx.AsyncClient(timeout=settings.http_timeout, headers=headers)
        created_client = True

    remaining = max_results
    start = 0
    records: list[PaperRecord] = []
    search_query = _format_search_query(query, categories)

    try:
        while remaining > 0:
            batch = min(remaining, 100)
            params = {
                "search_query": search_query,
                "start": str(start),
                "max_results": str(batch),
                "sortBy": "submittedDate",
                "sortOrder": "descending",
            }
            response = await client.get(ARXIV_URL, params=params)
            response.raise_for_status()
            text = response.text
            root = ET.fromstring(text)
            entries: Iterable[Any] = root.findall(f"{ATOM}entry")
            batch_count = 0
            for entry in entries:
                records.append(_parse_entry(entry))
                batch_count += 1
                if len(records) >= max_results:
                    break
            if batch_count == 0:
                break
            remaining = max_results - len(records)
            start += batch_count
            if remaining <= 0:
                break
            await asyncio.sleep(3)
    finally:
        if created_client:
            await client.aclose()

    if use_cache:
        _cache.store(cache_key, [record.model_dump(mode="json") for record in records])
    return records


__all__ = ["search_arxiv"]
