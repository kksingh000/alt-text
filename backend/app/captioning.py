"""Extension point for a future image-captioning backend (e.g. a free-tier
vision model like Gemini Flash). This is deliberately the ONLY place in the
backend where such a call would ever be added — the audit pipeline already
awaits it for every MISSING/GENERIC image and puts the result in
`ImageResult.suggested_caption`.

Returning None means "no caption available"; the report then shows only the
rule-based template fix. To wire up a real captioner later, implement this
function (call your vision API, cache by src, rate-limit) — nothing else in
the codebase needs to change.
"""
from __future__ import annotations


async def suggest_caption(image_src: str) -> str | None:
    return None
