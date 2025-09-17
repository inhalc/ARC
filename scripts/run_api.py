"""Convenience launcher for the FastAPI server."""
from __future__ import annotations

import uvicorn


def main() -> None:
    uvicorn.run("paper_agent.api:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
