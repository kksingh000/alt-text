import pytest
from app.crawler import FetchError, assert_public_http_url, parse_images, parse_sitemap

PAGE = """
<!DOCTYPE html>
<html><body>
  <img src="/img/dog.jpg">
  <img src="hero.webp" alt="img_1234">
  <img src="https://cdn.example.com/cat.jpg" alt="A tabby cat sleeping on a windowsill">
  <img data-src="https://cdn.example.com/lazy.jpg" alt="">
  <img src="/spacer.gif" width="1" height="1">
</body></html>
"""


def test_parse_images_extracts_inputs_and_absolute_srcs():
    scan = parse_images(PAGE, "https://example.com/blog/post")
    assert len(scan.images) == 5
    assert not scan.possibly_js_rendered

    srcs = [display for _, display in scan.images]
    assert srcs[0] == "https://example.com/img/dog.jpg"
    assert srcs[1] == "https://example.com/blog/hero.webp"
    assert srcs[2] == "https://cdn.example.com/cat.jpg"
    # lazy-loading fallback attribute is honoured
    assert srcs[3] == "https://cdn.example.com/lazy.jpg"

    first = scan.images[0][0]
    assert first.alt is None
    spacer = scan.images[4][0]
    assert spacer.width == 1
    assert spacer.height == 1


def test_js_rendered_detection():
    spa = """
    <html><body>
      <div id="root"></div>
      <script src="/app.js"></script>
      <script>window.__BOOT__ = 1;</script>
    </body></html>
    """
    assert parse_images(spa, "https://example.com").possibly_js_rendered
    assert not parse_images(PAGE, "https://example.com").possibly_js_rendered


def test_parse_sitemap_urlset():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/</loc></url>
      <url><loc>https://example.com/about</loc></url>
    </urlset>"""
    assert parse_sitemap(xml) == ("urlset", ["https://example.com/", "https://example.com/about"])


def test_parse_sitemap_index():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
    </sitemapindex>"""
    assert parse_sitemap(xml) == ("sitemapindex", ["https://example.com/sitemap-posts.xml"])


def test_parse_sitemap_rejects_html_and_garbage():
    assert parse_sitemap(PAGE) is None
    assert parse_sitemap("not xml at all") is None


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://localhost:8000/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "ftp://example.com/file",
        "file:///etc/passwd",
    ],
)
def test_ssrf_guard_rejects_non_public_targets(url):
    with pytest.raises(FetchError):
        assert_public_http_url(url)
