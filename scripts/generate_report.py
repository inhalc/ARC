"""Generate Markdown/CSV reports without running the API server."""
from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from paper_agent.export import to_csv, to_markdown
from paper_agent.service import SearchRequest, search_papers


async def _run(request: SearchRequest, markdown_path: Path | None, csv_path: Path | None) -> None:
    payload = await search_papers(request)
    if markdown_path:
        markdown_path.write_text(to_markdown(payload), encoding="utf-8")
        print(f"Markdown report saved to {markdown_path}")
    if csv_path:
        csv_path.write_text(to_csv(payload), encoding="utf-8")
        print(f"CSV report saved to {csv_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate offline related paper reports.")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--category", action="append", dest="categories", default=[], help="Optional arXiv category like cs.AI")
    parser.add_argument("--markdown", type=Path, default=Path("report.md"), help="Markdown output path")
    parser.add_argument("--csv", type=Path, default=Path("report.csv"), help="CSV output path")
    parser.add_argument("--openalex", type=int, default=60, help="OpenAlex max results")
    parser.add_argument("--arxiv", type=int, default=40, help="arXiv max results")
    parser.add_argument("--top", type=int, default=20, help="Number of ranked items to keep")
    parser.add_argument("--no-summary", action="store_true", help="Disable abstract summarisation")
    args = parser.parse_args()

    request = SearchRequest(
        query=args.query,
        categories=args.categories,
        openalex_limit=args.openalex,
        arxiv_limit=args.arxiv,
        top_k=args.top,
        summarise=not args.no_summary,
    )
    asyncio.run(_run(request, args.markdown, args.csv))


if __name__ == "__main__":
    main()
