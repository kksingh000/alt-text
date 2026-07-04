import httpx
import pytest
from fastapi.testclient import TestClient

from app import audit as audit_module
from app import crawler
from app.main import app

client = TestClient(app)

PAGE_HTML = """
<html><body>
  <img src="/dog.jpg">
  <img src="/a.jpg" alt="img_1234">
  <img src="/cat.jpg" alt="A tabby cat sleeping on a windowsill">
</body></html>
"""

SITEMAP_XML = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/contact</loc></url>
</urlset>"""


def fake_fetch(responses: dict[str, httpx.Response]):
    async def fetch(url: str, _client) -> httpx.Response:
        response = responses.get(url)
        if response is None:
            raise crawler.FetchError(f"unexpected fetch of {url}")
        return response

    return fetch


def html_response(text: str) -> httpx.Response:
    return httpx.Response(200, text=text, headers={"content-type": "text/html"})


def xml_response(text: str) -> httpx.Response:
    return httpx.Response(200, text=text, headers={"content-type": "application/xml"})


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["scorer_spec_version"] >= 1


def test_audit_single_page(monkeypatch):
    monkeypatch.setattr(
        audit_module, "fetch", fake_fetch({"https://example.com/": html_response(PAGE_HTML)})
    )

    response = client.post("/api/audit", json={"url": "https://example.com/"})
    assert response.status_code == 200
    body = response.json()

    assert body["source"] == "page"
    assert body["total_images"] == 3
    assert body["totals"] == {
        "MISSING": 1,
        "GENERIC": 1,
        "DECORATIVE_UNMARKED": 0,
        "GOOD": 1,
    }

    page = body["pages"][0]
    assert page["fetched"] is True
    images = {img["src"]: img for img in page["images"]}
    missing = images["https://example.com/dog.jpg"]
    assert missing["category"] == "MISSING"
    assert missing["wcag"]["criterion"] == "1.1.1"
    assert "alt" in missing["suggested_fix"]
    assert missing["suggested_caption"] is None  # captioning stub is wired but empty
    generic = images["https://example.com/a.jpg"]
    assert generic["category"] == "GENERIC"
    assert generic["reason"] == "generic-pattern"


def test_audit_sitemap_caps_pages(monkeypatch):
    responses = {
        "https://example.com/sitemap.xml": xml_response(SITEMAP_XML),
        "https://example.com/": html_response(PAGE_HTML),
        "https://example.com/about": html_response("<html><body><img src='/x.jpg'></body></html>"),
    }
    monkeypatch.setattr(audit_module, "fetch", fake_fetch(responses))

    response = client.post(
        "/api/audit", json={"url": "https://example.com/sitemap.xml", "max_pages": 2}
    )
    assert response.status_code == 200
    body = response.json()

    assert body["source"] == "sitemap"
    assert [p["url"] for p in body["pages"]] == ["https://example.com/", "https://example.com/about"]
    assert body["totals"]["MISSING"] == 2  # dog.jpg + x.jpg


def test_audit_reports_unfetchable_sitemap_page(monkeypatch):
    async def fetch(url: str, _client):
        if url.endswith("sitemap.xml"):
            return xml_response(SITEMAP_XML)
        raise crawler.FetchError("boom")

    monkeypatch.setattr(audit_module, "fetch", fetch)

    response = client.post(
        "/api/audit", json={"url": "https://example.com/sitemap.xml", "max_pages": 1}
    )
    assert response.status_code == 200
    page = response.json()["pages"][0]
    assert page["fetched"] is False
    assert page["error"] == "boom"
    assert page["images"] == []


def test_audit_rejects_blocked_url(monkeypatch):
    async def fetch(url: str, _client):
        raise crawler.FetchError("Refusing to fetch non-public address")

    monkeypatch.setattr(audit_module, "fetch", fetch)
    response = client.post("/api/audit", json={"url": "http://internal.corp/"})
    assert response.status_code == 400
    assert "non-public" in response.json()["detail"]


def test_audit_validates_request():
    assert client.post("/api/audit", json={"url": "not a url"}).status_code == 422
    assert (
        client.post("/api/audit", json={"url": "https://example.com/", "max_pages": 999}).status_code
        == 422
    )
