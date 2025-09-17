"""Sentence embedding utilities for paper retrieval."""
from __future__ import annotations

from functools import lru_cache
from typing import Iterable

import numpy as np
from sentence_transformers import SentenceTransformer

from ..config import settings


def _resolve_device() -> str:
    target = settings.device.lower()
    if target not in {"auto", "cpu", "cuda"}:
        return "cpu"
    if target == "auto":
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            return "cpu"
    return target


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    device = _resolve_device()
    model = SentenceTransformer(settings.embedding_model, device=device)
    return model


def encode_texts(texts: Iterable[str]) -> np.ndarray:
    model = get_embedding_model()
    return model.encode(
        list(texts),
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )


def encode_query(text: str) -> np.ndarray:
    return encode_texts([text])[0]


__all__ = ["encode_texts", "encode_query", "get_embedding_model"]
