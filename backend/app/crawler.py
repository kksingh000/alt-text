"""Fetching and HTML/sitemap parsing for the audit service.

Plain HTTP + BeautifulSoup only — free and fast. JS-rendered pages are
detected heuristically and flagged in the report; actually rendering them
with a headless browser is a deliberate non-goal for the zero-cost MVP (see
`fetch_rendered` below for the extension point).
"""
from __future__ import annotations

import asyncio
import ipaddress
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import httpx
from alt_text_scorer import ImageInput, image_input_from_attrs
from bs4 import BeautifulSoup

USER_AGENT = "AltTextAuditBot/0.1 (accessibility audit; +https://github.com/kksingh000/alt-text)"
FETCH_TIMEOUT_SECONDS = 15.0
MAX_REDIRECTS = 5

# Lazy-loading libraries put the real image in data-* and a placeholder (or
# nothing) in src, so the data-* attributes take priority when present.
LAZY_SRC_ATTRS = ("data-src", "data-lazy-src", "data-original", "src")


class FetchError(Exception):
    """A URL we refuse to fetch or could not fetch."""


async def assert_public_http_url(url: str) -> None:
    """SSRF guard: only http(s) to hosts that resolve to public addresses.

    This runs on every redirect hop as well as the initial URL, and resolves
    DNS on the event loop's resolver so a slow lookup never blocks other
    requests. (DNS could still change between this check and the actual
    request — acceptable for an MVP; a production deployment should pin the
    resolved address.)
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise FetchError(f"Only http(s) URLs are supported, got {parsed.scheme!r}")
    host = parsed.hostname
    if not host:
        raise FetchError("URL has no host")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None)
    except OSError as exc:
        raise FetchError(f"Could not resolve host {host!r}") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise FetchError(f"Refusing to fetch non-public address for host {host!r}")


async def fetch(url: str, client: httpx.AsyncClient) -> httpx.Response:
    """GET with the SSRF guard applied to the URL and every redirect hop."""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        await assert_public_http_url(current)
        response = await client.get(
            current,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=False,
            timeout=FETCH_TIMEOUT_SECONDS,
        )
        location = response.headers.get("location")
        if response.status_code in (301, 302, 303, 307, 308) and location:
            current = urljoin(current, location)
            continue
        response.raise_for_status()
        return response
    raise FetchError("Too many redirects")


async def fetch_rendered(url: str) -> str:
    """Extension point: render a JS-heavy page with a headless browser and
    return its HTML. Deliberately unimplemented in the zero-cost MVP — pages
    that look JS-rendered are flagged `possibly_js_rendered` in the report
    instead. Wiring in Playwright here is the only change needed later.
    """
    raise NotImplementedError("Headless rendering is not part of the zero-cost MVP")


@dataclass
class PageScan:
    url: str
    #: (scorer input, absolute src for display) per <img>
    images: list[tuple[ImageInput, str]] = field(default_factory=list)
    possibly_js_rendered: bool = False


def parse_images(html: str, base_url: str) -> PageScan:
    """Extract every <img> as (ImageInput, absolute display src)."""
    soup = BeautifulSoup(html, "html.parser")
    scan = PageScan(url=base_url)

    for tag in soup.find_all("img"):
        src = next((tag.get(attr) for attr in LAZY_SRC_ATTRS if tag.get(attr)), "")
        image = image_input_from_attrs(
            {
                "alt": tag.get("alt"),
                "src": src,
                "width": tag.get("width"),
                "height": tag.get("height"),
                "role": tag.get("role"),
                "aria-hidden": tag.get("aria-hidden"),
            }
        )
        display_src = urljoin(base_url, src) if src else ""
        scan.images.append((image, display_src))

    scan.possibly_js_rendered = not scan.images and len(soup.find_all("script")) >= 2
    return scan


def parse_sitemap(xml_text: str) -> tuple[str, list[str]] | None:
    """Returns ('urlset'|'sitemapindex', [urls]) if the text is a sitemap,
    else None."""
    try:
        root = ET.fromstring(xml_text.strip())
    except ET.ParseError:
        return None
    kind = root.tag.rsplit("}", 1)[-1]
    if kind not in ("urlset", "sitemapindex"):
        return None
    locs = [
        el.text.strip()
        for el in root.iter()
        if el.tag.rsplit("}", 1)[-1] == "loc" and el.text and el.text.strip()
    ]
    return kind, locs
