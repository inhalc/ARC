
"""Text summarisation helpers."""
from __future__ import annotations

from functools import lru_cache

from transformers import pipeline

from ..config import settings


def _resolve_pipeline_device() -> int:
    target = settings.device.lower()
    if target == 'cuda':
        return 0
    if target == 'cpu':
        return -1
    try:
        import torch

        return 0 if torch.cuda.is_available() else -1
    except Exception:
        return -1


@lru_cache(maxsize=1)
def get_summariser():
    return pipeline(
        'summarization',
        model=settings.summary_model,
        device=_resolve_pipeline_device(),
    )


@lru_cache(maxsize=1)
def get_en_to_zh_translator():
    if settings.summary_language.lower() != 'zh':
        return None
    try:
        return pipeline('translation_en_to_zh', model='Helsinki-NLP/opus-mt-en-zh', device=_resolve_pipeline_device())
    except Exception:
        return None


def _looks_english(text: str) -> bool:
    ascii_letters = sum(1 for ch in text if ch.isascii() and ch.isalpha())
    non_ascii = sum(1 for ch in text if not ch.isascii())
    return ascii_letters > non_ascii


def _translate_to_zh(text: str) -> str:
    translator = get_en_to_zh_translator()
    if translator is None:
        return text
    try:
        result = translator(text, max_length=max(64, len(text.split()) * 3))
        if isinstance(result, list) and result:
            translated = result[0].get('translation_text')
            if translated:
                return translated.strip()
    except Exception:
        pass
    return text


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
            summary = result[0].get('summary_text', text).strip()
        else:
            summary = text.strip()
    except Exception:
        summary = text.strip()
    if settings.summary_language.lower() == 'zh' and _looks_english(summary):
        return _translate_to_zh(summary)
    return summary


__all__ = ['summarise_text', 'get_summariser', 'get_en_to_zh_translator']
