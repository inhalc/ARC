"""FastAPI application entrypoint for the paper agent backend."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from .export import to_csv, to_markdown
from .service import SearchRequest, search_papers

app = FastAPI(
    title="Related Paper Agent API",
    version="0.1.0",
    description="Provides paper aggregation, ranking, and reporting services backed by OpenAlex & arXiv.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/search")
async def api_search(request: SearchRequest):
    payload = await search_papers(request)
    return JSONResponse(payload.model_dump(mode="json"))


@app.post("/api/export/markdown")
async def api_export_markdown(request: SearchRequest):
    payload = await search_papers(request)
    content = to_markdown(payload)
    headers = {
        "Content-Disposition": "attachment; filename=related-papers.md",
    }
    return PlainTextResponse(content, media_type="text/markdown", headers=headers)


@app.post("/api/export/csv")
async def api_export_csv(request: SearchRequest):
    payload = await search_papers(request)
    content = to_csv(payload)
    headers = {
        "Content-Disposition": "attachment; filename=related-papers.csv",
    }
    return PlainTextResponse(content, media_type="text/csv", headers=headers)


__all__ = ["app"]
