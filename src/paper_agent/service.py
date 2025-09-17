"""High-level service orchestration for the paper agent."""
from __future__ import annotations

import asyncio
import math
import re
from datetime import datetime, timezone
from typing import Iterable

import numpy as np
from pydantic import BaseModel, Field

from .config import settings
from .datasources.arxiv import search_arxiv
from .datasources.openalex import search_openalex
from .models import PaperRecord
from .pipeline.embedding import encode_query, encode_texts
from .pipeline.summariser import summarise_text
from .utils import deduplicate_records, format_brief_authors


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2, description="检索关键词或问题（英文更易命中）")
    categories: list[str] = Field(default_factory=list, description="可选的 arXiv 分类代码")
    openalex_limit: int = Field(default=60, ge=0, le=200)
    arxiv_limit: int = Field(default=40, ge=0, le=200)
    top_k: int = Field(default=settings.top_k, ge=1, le=100)
    summarise: bool = Field(default=True)


class SearchItem(BaseModel):
    id: str
    title: str
    abstract: str | None
    authors: list[str]
    authors_brief: str
    year: int | None
    venue: str | None
    doi: str | None
    url: str | None
    source: str
    score: float
    why_related: str
    difference: str
    summary: str | None


class SearchResponse(BaseModel):
    query: str
    categories: list[str]
    generated_at: datetime
    total_candidates: int
    returned: int
    items: list[SearchItem]


def _text_for_embedding(record: PaperRecord) -> str:
    parts = [record.title]
    if record.abstract:
        parts.append(record.abstract)
    if record.extra:
        concepts = record.extra.get("concepts") or record.extra.get("categories")
        if concepts:
            parts.append("; ".join(map(str, concepts)))
    return "\n".join(parts)


def _pick_sentences(text: str, *, count: int = 2) -> list[str]:
    sentences = re.split(r"(?<=[。！？.!?])\s+", text.strip()) if text else []
    sentences = [s.strip() for s in sentences if s.strip()]
    return sentences[:count]


def _build_explanations(record: PaperRecord, query: str) -> tuple[str, str]:
    sentences = _pick_sentences(record.abstract or "")
    first = sentences[0] if sentences else record.abstract or ""
    second = sentences[1] if len(sentences) > 1 else ""
    why_related = (
        f"论文聚焦于 {record.venue or '相关领域'}，摘要指出：{first} 与检索主题“{query}”高度相关。"
        if first
        else f"论文来自 {record.venue or '该领域'}，与主题“{query}”存在交叉。"
    )
    difference = (
        f"该研究由 {format_brief_authors(record.authors)} 提出，强调：{second or first}，从 {record.source} 视角补充主题。"
        if first
        else f"该研究提供了来自 {record.source} 的补充视角。"
    )
    return why_related, difference


def _build_summary(record: PaperRecord) -> str | None:
    if not record.abstract:
        return None
    return summarise_text(record.abstract, max_length=120)


async def _gather_sources(request: SearchRequest) -> list[PaperRecord]:
    tasks: list[asyncio.Task[list[PaperRecord]]] = []
    if request.openalex_limit > 0:
        tasks.append(
            asyncio.create_task(
                search_openalex(
                    request.query,
                    max_results=request.openalex_limit,
                )
            )
        )
    if request.arxiv_limit > 0:
        tasks.append(
            asyncio.create_task(
                search_arxiv(
                    request.query,
                    categories=request.categories,
                    max_results=request.arxiv_limit,
                )
            )
        )
    if not tasks:
        return []
    results = await asyncio.gather(*tasks)
    merged = [item for sublist in results for item in sublist]
    return deduplicate_records(merged)


async def search_papers(request: SearchRequest) -> SearchResponse:
    records = await _gather_sources(request)
    if not records:
        return SearchResponse(
            query=request.query,
            categories=request.categories,
            generated_at=datetime.now(timezone.utc),
            total_candidates=0,
            returned=0,
            items=[],
        )

    texts = [_text_for_embedding(rec) for rec in records]
    doc_embeddings = encode_texts(texts)
    query_embedding = encode_query(request.query)
    scores = np.dot(doc_embeddings, query_embedding)
    ranked_indices = np.argsort(-scores)

    top_limit = min(request.top_k, len(records))
    ranked_items: list[SearchItem] = []
    for idx in ranked_indices[:top_limit]:
        record = records[int(idx)]
        score = float(scores[int(idx)])
        why_related, difference = _build_explanations(record, request.query)
        summary = _build_summary(record) if request.summarise else None
        ranked_items.append(
            SearchItem(
                id=record.external_id,
                title=record.title,
                abstract=record.abstract,
                authors=record.authors,
                authors_brief=format_brief_authors(record.authors),
                year=record.year,
                venue=record.venue,
                doi=record.doi,
                url=record.url,
                source=record.source,
                score=round(score, 4),
                why_related=why_related,
                difference=difference,
                summary=summary,
            )
        )

    return SearchResponse(
        query=request.query,
        categories=request.categories,
        generated_at=datetime.now(timezone.utc),
        total_candidates=len(records),
        returned=len(ranked_items),
        items=ranked_items,
    )


__all__ = ["search_papers", "SearchRequest", "SearchResponse", "SearchItem"]
