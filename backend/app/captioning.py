"""Extension point for a future image-captioning backend (e.g. a free-tier
vision model like Gemini Flash). This is deliberately the ONLY place in the
backend where such a call would ever be added — the audit pipeline already
awaits it for every MISSING/GENERIC image and puts the result in
`ImageResult.suggested_caption`.

Returning None means "no caption available"; the report then shows only the
rule-based template fix. To wire up a real captioner later, implement this
function (call your vision API, cache by src, rate-limit) — nothing else in
the codebase needs to change.

SECURITY: `image_src` comes straight from a crawled page's <img> markup and
is attacker-controlled. If your implementation fetches the image bytes, route
the request through `crawler.fetch` (or at minimum await
`crawler.assert_public_http_url`) so the SSRF guard applies — a bare
httpx.get(image_src) would happily fetch cloud metadata endpoints or internal
services a malicious audited page points it at.
"""
from __future__ import annotations


async def suggest_caption(image_src: str) -> str | None:
    return None
