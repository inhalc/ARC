"""Fetch a sample dataset from OpenAlex and arXiv."""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from paper_agent.config import settings
from paper_agent.datasources.arxiv import search_arxiv
from paper_agent.datasources.openalex import search_openalex
from paper_agent.models import PaperRecord


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return slug or "query"


def _deduplicate(records: Iterable[PaperRecord]) -> list[PaperRecord]:
    seen: set[str] = set()
    unique: list[PaperRecord] = []
    for record in records:
        key = record.doi or record.external_id
        if not key:
            key = record.title.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(record)
    return unique


async def collect(query: str, *, categories: list[str], openalex_count: int, arxiv_count: int) -> list[PaperRecord]:
    openalex_task = asyncio.create_task(
        search_openalex(query, max_results=openalex_count, use_cache=False)
    )
    arxiv_task = asyncio.create_task(
        search_arxiv(query, categories=categories, max_results=arxiv_count, use_cache=False)
    )
    openalex_results, arxiv_results = await asyncio.gather(openalex_task, arxiv_task)
    combined = _deduplicate([*openalex_results, *arxiv_results])
    combined.sort(key=lambda item: (item.year or 0), reverse=True)
    return combined


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch sample papers from OpenAlex and arXiv.")
    parser.add_argument("query", help="Free text search query")
    parser.add_argument("--category", action="append", dest="categories", default=[], help="Optional arXiv category filter (e.g. cs.AI)")
    parser.add_argument("--openalex", type=int, default=40, help="Maximum OpenAlex results")
    parser.add_argument("--arxiv", type=int, default=40, help="Maximum arXiv results")
    args = parser.parse_args()

    records = asyncio.run(
        collect(
            args.query,
            categories=args.categories,
            openalex_count=args.openalex,
            arxiv_count=args.arxiv,
        )
    )

    slug = _slugify(args.query)
    samples_dir = settings.data_dir / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    output_path = samples_dir / f"{slug}.json"

    payload = {
        "query": args.query,
        "categories": args.categories,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result_count": len(records),
        "records": [item.model_dump(mode="json") for item in records],
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(records)} records to {output_path}")


if __name__ == "__main__":
    main()
