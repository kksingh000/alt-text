"""Rule-based alt text quality scorer (shared core of the alt-text toolkit)."""
from .scorer import (
    SPEC,
    AltTextCategory,
    ImageInput,
    ScoreResult,
    Severity,
    WcagReference,
    image_input_from_attrs,
    score_alt_text,
    score_image,
    summarize,
)

__all__ = [
    "SPEC",
    "AltTextCategory",
    "ImageInput",
    "ScoreResult",
    "Severity",
    "WcagReference",
    "image_input_from_attrs",
    "score_alt_text",
    "score_image",
    "summarize",
]
