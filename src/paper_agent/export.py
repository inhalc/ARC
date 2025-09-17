"""Utility exporters for search results."""
from __future__ import annotations

import csv
import io
from typing import Iterable

from .service import SearchItem, SearchResponse


def to_markdown(payload: SearchResponse) -> str:
    lines: list[str] = []
    lines.append(f"# Related Papers for `{payload.query}`")
    if payload.categories:
        cats = ", ".join(payload.categories)
        lines.append(f"*Categories:* {cats}")
    lines.append(f"*Generated at:* {payload.generated_at.isoformat()}")
    lines.append("")
    for idx, item in enumerate(payload.items, start=1):
        lines.append(f"## {idx}. {item.title}")
        lines.append(f"- 来源：{item.source.upper()} | 分数：{item.score}")
        lines.append(f"- 作者：{item.authors_brief}")
        if item.venue:
            lines.append(f"- 发表：{item.venue} ({item.year or '未知'})")
        else:
            lines.append(f"- 年份：{item.year or '未知'}")
        if item.doi:
            lines.append(f"- DOI：[ {item.doi} ](https://doi.org/{item.doi})")
        if item.url:
            lines.append(f"- 链接：{item.url}")
        lines.append(f"- Why Related：{item.why_related}")
        lines.append(f"- Difference：{item.difference}")
        if item.summary:
            lines.append("")
            lines.append(f"**摘要精炼**：{item.summary}")
        if item.abstract:
            lines.append("")
            lines.append("<details><summary>原始摘要</summary>")
            lines.append("")
            lines.append(item.abstract)
            lines.append("")
            lines.append("</details>")
        lines.append("")
    return "\n".join(lines)


def to_csv(payload: SearchResponse) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "title",
        "authors",
        "year",
        "venue",
        "source",
        "score",
        "doi",
        "url",
        "why_related",
        "difference",
        "summary",
        "abstract",
    ])
    for item in payload.items:
        writer.writerow([
            item.title,
            "; ".join(item.authors),
            item.year or "",
            item.venue or "",
            item.source,
            item.score,
            item.doi or "",
            item.url or "",
            item.why_related,
            item.difference,
            item.summary or "",
            item.abstract or "",
        ])
    return buffer.getvalue()


__all__ = ["to_markdown", "to_csv"]
