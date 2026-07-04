"""Audit orchestration: crawl → score with the shared rule-based scorer →
aggregate per page and overall."""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
from alt_text_scorer import score_image, summarize

from .captioning import suggest_caption
from .crawler import FetchError, fetch, parse_images, parse_sitemap
from .models import AuditResponse, ImageResult, PageResult, WcagRef

ZERO_COUNTS = {"MISSING": 0, "GENERIC": 0, "DECORATIVE_UNMARKED": 0, "GOOD": 0}


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
        return PageResult(url=url, fetched=False, error=str(exc), counts=dict(ZERO_COUNTS))
    return await audit_html(url, response.text)


async def _resolve_sitemap_pages(
    kind: str, locs: list[str], max_pages: int, client: httpx.AsyncClient
) -> list[str]:
    if kind == "urlset":
        return locs[:max_pages]
    # sitemapindex: flatten one level of child sitemaps.
    page_urls: list[str] = []
    for child_url in locs:
        if len(page_urls) >= max_pages:
            break
        try:
            child = await fetch(child_url, client)
        except (FetchError, httpx.HTTPError):
            continue
        parsed = parse_sitemap(child.text)
        if parsed and parsed[0] == "urlset":
            page_urls.extend(parsed[1][: max_pages - len(page_urls)])
    return page_urls


async def run_audit(url: str, max_pages: int) -> AuditResponse:
    async with httpx.AsyncClient() as client:
        response = await fetch(url, client)
        content_type = response.headers.get("content-type", "")

        source = "page"
        pages: list[PageResult]
        looks_like_xml = "xml" in content_type or url.split("?", 1)[0].lower().endswith(".xml")
        sitemap = parse_sitemap(response.text) if looks_like_xml else None

        if sitemap:
            source = "sitemap"
            page_urls = await _resolve_sitemap_pages(sitemap[0], sitemap[1], max_pages, client)
            pages = [await audit_page(page_url, client) for page_url in page_urls]
        else:
            pages = [await audit_html(url, response.text)]

    totals = dict(ZERO_COUNTS)
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
