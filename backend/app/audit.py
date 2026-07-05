"""Audit orchestration: crawl → score with the shared rule-based scorer →
aggregate per page and overall."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Literal

import httpx
from alt_text_scorer import score_image, summarize

from .captioning import suggest_caption
from .crawler import FetchError, fetch, parse_images, parse_sitemap
from .models import AuditResponse, ImageResult, PageResult, WcagRef

# Bounds concurrent page/sitemap fetches per audit — polite to the audited
# site while keeping a 20-page sitemap audit at seconds, not minutes.
MAX_CONCURRENT_FETCHES = 5


async def audit_html(url: str, html: str) -> PageResult:
    """Score every image in an already-fetched page."""
    scan = parse_images(html, url)
    images: list[ImageResult] = []
    results = []
    for image_input, display_src in scan.images:
        result = score_image(image_input)
        results.append(result)
        caption = None
        if result.screen_reader_fallback is not None:  # MISSING or GENERIC
            caption = await suggest_caption(display_src)
        images.append(
            ImageResult(
                src=display_src,
                alt=image_input.alt,
                category=result.category,
                reason=result.reason,
                severity=result.severity,
                label=result.label,
                wcag=WcagRef(
                    criterion=result.wcag.criterion,
                    name=result.wcag.name,
                    level=result.wcag.level,
                    url=result.wcag.url,
                ),
                suggested_fix=result.suggested_fix,
                screen_reader_fallback=result.screen_reader_fallback,
                suggested_caption=caption,
            )
        )
    return PageResult(
        url=url,
        fetched=True,
        possibly_js_rendered=scan.possibly_js_rendered,
        images=images,
        counts=summarize(results),
    )


async def audit_page(url: str, client: httpx.AsyncClient) -> PageResult:
    try:
        response = await fetch(url, client)
    except (FetchError, httpx.HTTPError) as exc:
        return PageResult(url=url, fetched=False, error=str(exc), counts=summarize([]))
    return await audit_html(url, response.text)


async def _resolve_sitemap_pages(
    kind: str, locs: list[str], max_pages: int, client: httpx.AsyncClient
) -> list[str]:
    if kind == "urlset":
        return locs[:max_pages]

    # sitemapindex: flatten one level of child sitemaps, fetched concurrently.
    # Fetch at most max_pages children — even if every child yielded a single
    # page URL that would already satisfy the cap.
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_FETCHES)

    async def fetch_child(child_url: str) -> list[str]:
        async with semaphore:
            try:
                child = await fetch(child_url, client)
            except (FetchError, httpx.HTTPError):
                return []
        parsed = parse_sitemap(child.text)
        return parsed[1] if parsed and parsed[0] == "urlset" else []

    children = await asyncio.gather(*(fetch_child(u) for u in locs[:max_pages]))
    page_urls: list[str] = []
    for child_pages in children:
        page_urls.extend(child_pages[: max_pages - len(page_urls)])
        if len(page_urls) >= max_pages:
            break
    return page_urls


async def run_audit(url: str, max_pages: int) -> AuditResponse:
    async with httpx.AsyncClient() as client:
        response = await fetch(url, client)
        content_type = response.headers.get("content-type", "")

        source: Literal["page", "sitemap"] = "page"
        pages: list[PageResult]
        looks_like_xml = "xml" in content_type or url.split("?", 1)[0].lower().endswith(".xml")
        sitemap = parse_sitemap(response.text) if looks_like_xml else None

        if sitemap:
            source = "sitemap"
            page_urls = await _resolve_sitemap_pages(sitemap[0], sitemap[1], max_pages, client)
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_FETCHES)

            async def bounded_audit(page_url: str) -> PageResult:
                async with semaphore:
                    return await audit_page(page_url, client)

            pages = list(await asyncio.gather(*(bounded_audit(u) for u in page_urls)))
        else:
            pages = [await audit_html(url, response.text)]

    totals = summarize([])
    for page in pages:
        for category, count in page.counts.items():
            totals[category] += count

    return AuditResponse(
        requested_url=url,
        source=source,
        pages=pages,
        totals=totals,
        total_images=sum(totals.values()),
        generated_at=datetime.now(timezone.utc),
    )
