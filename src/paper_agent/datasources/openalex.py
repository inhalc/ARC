"""OpenAlex API integration."""
from __future__ import annotations

import asyncio
import json
from datetime import timedelta
from typing import Any, Iterable

import httpx

from ..cache import DiskCache
from ..config import settings
from ..models import PaperRecord

OPENALEX_URL = "https://api.openalex.org/works"

ttl = None if settings.cache_ttl_hours <= 0 else timedelta(hours=settings.cache_ttl_hours)
_cache = DiskCache("openalex", settings.data_dir, ttl=ttl)


def _inflate_abstract(inverted: dict[str, list[int]] | None) -> str | None:
    if not inverted:
        return None
    slots: list[str | None] = []
    for word, positions in inverted.items():
        for pos in positions:
            while len(slots) <= pos:
                slots.append(None)
            slots[pos] = word
    return " ".join(token for token in slots if token).strip() if slots else None


def _parse_openalex_work(payload: dict[str, Any]) -> PaperRecord:
    host = payload.get("host_venue") or {}
    authors: list[str] = []
    for authorship in payload.get("authorships", []) or []:
        author = (authorship.get("author") or {}).get("display_name")
        if author:
            authors.append(author)
    abstract = payload.get("abstract") or _inflate_abstract(payload.get("abstract_inverted_index"))
    return PaperRecord(
        source="openalex",
        external_id=payload.get("id") or payload.get("openalex_id") or "",
        title=payload.get("display_name") or payload.get("title") or "",
        abstract=abstract,
        authors=authors,
        published=None,
        year=payload.get("publication_year"),
        doi=payload.get("doi"),
        url=payload.get("primary_location", {}).get("landing_page_url") or payload.get("id"),
        citation_count=(payload.get("cited_by_count") if isinstance(payload.get("cited_by_count"), int) else None),
        venue=host.get("display_name"),
        extra={
            "concepts": [concept.get("display_name") for concept in payload.get("concepts", [])],
            "openalex": {
                "id": payload.get("id"),
                "ids": payload.get("ids"),
            },
        },
    )


def _make_cache_key(query: str, filters: dict[str, str] | None, max_results: int) -> str:
    return json.dumps({
        "query": query,
        "filters": filters or {},
        "max_results": max_results,
    }, sort_keys=True)


def _serialize_filter(filters: dict[str, str] | None) -> str | None:
    if not filters:
        return None
    return ",".join(f"{key}:{value}" for key, value in filters.items())


async def search_openalex(
    query: str,
    *,
    max_results: int = 50,
    filters: dict[str, str] | None = None,
    use_cache: bool = True,
    client: httpx.AsyncClient | None = None,
) -> list[PaperRecord]:
    if max_results <= 0:
        return []
    cache_key = _make_cache_key(query, filters, max_results)
    if use_cache:
        entry = _cache.load(cache_key)
        if entry is not None:
            return [PaperRecord.model_validate(item) for item in entry.data]

    created_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=settings.http_timeout, http2=True)
        created_client = True

    records: list[PaperRecord] = []
    params: dict[str, Any] = {
        "search": query,
        "per-page": min(200, max_results, 25),
        "page": 1,
    }
    filter_expr = _serialize_filter(filters)
    if filter_expr:
        params["filter"] = filter_expr
    if settings.openalex_mailto:
        params["mailto"] = settings.openalex_mailto

    try:
        while len(records) < max_results:
            response = await client.get(OPENALEX_URL, params=params)
            response.raise_for_status()
            payload = response.json()
            page_results: Iterable[dict[str, Any]] = payload.get("results", [])
            if not page_results:
                break
            for item in page_results:
                records.append(_parse_openalex_work(item))
                if len(records) >= max_results:
                    break
            if len(records) >= max_results:
                break
            params["page"] = params.get("page", 1) + 1
            await asyncio.sleep(0)
    finally:
        if created_client:
            await client.aclose()

    if use_cache:
        _cache.store(cache_key, [record.model_dump(mode="json") for record in records])
    return records


__all__ = ["search_openalex"]
