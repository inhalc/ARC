"""Text summarisation helpers."""
from __future__ import annotations

from functools import lru_cache

from transformers import pipeline

from ..config import settings


def _resolve_pipeline_device() -> int:
    target = settings.device.lower()
    if target == "cuda":
        return 0
    if target == "cpu":
        return -1
    try:
        import torch

        return 0 if torch.cuda.is_available() else -1
    except Exception:
        return -1


@lru_cache(maxsize=1)
def get_summariser():
    return pipeline(
        "summarization",
        model=settings.summary_model,
        device=_resolve_pipeline_device(),
    )


def summarise_text(text: str, *, max_length: int = 120) -> str:
    if not text or len(text.split()) < 40:
        return text.strip()
    try:
        summariser = get_summariser()
        result = summariser(
            text,
            max_length=max_length,
            min_length=max_length // 2,
            do_sample=False,
        )
        if isinstance(result, list) and result:
            return result[0].get("summary_text", text).strip()
        return text.strip()
    except Exception:
        return text.strip()


__all__ = ["summarise_text", "get_summariser"]
