"""Frontend reverse proxy for combining static assets and backend API."""
from __future__ import annotations

import os
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
DEFAULT_BACKEND_URL = "http://127.0.0.1:8000"
_EXCLUDED_HEADERS = {"content-encoding", "transfer-encoding", "connection"}


app = FastAPI(
    title="Related Paper Agent Frontend Gateway",
    description="Serves the static frontend and proxies /api requests to the backend.",
    version="0.1.0",
)


@app.on_event("startup")
async def _startup() -> None:
    backend_url = os.getenv("PAPER_AGENT_BACKEND", DEFAULT_BACKEND_URL)
    app.state.backend_url = backend_url.rstrip("/")
    app.state.client = httpx.AsyncClient(
        base_url=app.state.backend_url,
        timeout=httpx.Timeout(30.0, connect=10.0),
        follow_redirects=True,
    )


@app.on_event("shutdown")
async def _shutdown() -> None:
    client: httpx.AsyncClient | None = getattr(app.state, "client", None)
    if client is not None:
        await client.aclose()


def _set_forwarded_headers(headers: dict[str, str], request: Request) -> None:
    client_host = request.client.host if request.client else None
    if client_host:
        forwarded = headers.get("x-forwarded-for")
        headers["x-forwarded-for"] = f"{forwarded}, {client_host}" if forwarded else client_host
    headers["x-forwarded-proto"] = request.url.scheme


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy_api(path: str, request: Request) -> Response:
    client: httpx.AsyncClient = app.state.client
    target_path = f"/api/{path}" if path else "/api"
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    _set_forwarded_headers(headers, request)
    response = await client.request(
        request.method,
        target_path,
        content=body,
        params=request.query_params,
        headers=headers,
        cookies=request.cookies,
    )
    proxy_response = Response(content=response.content, status_code=response.status_code)
    for key_bytes, value_bytes in response.headers.raw:
        key = key_bytes.decode("latin-1")
        if key.lower() in _EXCLUDED_HEADERS:
            continue
        proxy_response.headers.append(key, value_bytes.decode("latin-1"))
    return proxy_response


@app.get("/gateway/health")
async def gateway_health() -> dict[str, str]:
    return {"status": "ok"}


app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend",
)

