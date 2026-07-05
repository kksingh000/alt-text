import json
import sys
from pathlib import Path

import pytest

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SPEC_DIR = PACKAGE_ROOT.parent / "spec"
sys.path.insert(0, str(PACKAGE_ROOT))

from alt_text_scorer import (  # noqa: E402
    SPEC,
    ImageInput,
    image_input_from_attrs,
    score_alt_text,
    score_image,
    summarize,
)

FIXTURES = json.loads((SPEC_DIR / "fixtures.json").read_text(encoding="utf-8"))["cases"]


def _input_from_fixture(raw: dict) -> ImageInput:
    return ImageInput(
        alt=raw.get("alt"),
        src=raw.get("src", ""),
        width=raw.get("width"),
        height=raw.get("height"),
        role=raw.get("role"),
        aria_hidden=raw.get("ariaHidden", False),
    )


@pytest.mark.parametrize("case", FIXTURES, ids=[c["name"] for c in FIXTURES])
def test_golden_fixtures(case):
    result = score_image(_input_from_fixture(case["input"]))
    assert {"category": result.category, "reason": result.reason} == case["expected"]


def test_vendored_spec_matches_canonical():
    canonical = json.loads((SPEC_DIR / "scorer.spec.json").read_text(encoding="utf-8"))
    assert SPEC == canonical, (
        "spec_data.json has drifted from spec/scorer.spec.json — "
        "run: node packages/scorer/scripts/sync-spec.mjs"
    )


def test_result_metadata_comes_from_spec():
    result = score_alt_text(None, "https://example.com/a.jpg")
    assert result.category == "MISSING"
    assert result.severity == "error"
    assert result.wcag.criterion == "1.1.1"
    assert "alt" in result.suggested_fix
    assert result.screen_reader_fallback == "Image, no description available"

    good = score_alt_text("Golden retriever catching a red frisbee")
    assert good.category == "GOOD"
    assert good.severity == "pass"
    assert good.screen_reader_fallback is None


def test_image_input_from_attrs():
    attrs = {"src": "https://x.com/spacer.gif", "width": "1", "height": "50"}
    image = image_input_from_attrs(attrs)
    assert image.alt is None
    assert image.width == 1
    assert image.height == 50
    assert score_image(image).category == "DECORATIVE_UNMARKED"

    marked = image_input_from_attrs({"alt": "x", "aria-hidden": "true"})
    assert marked.aria_hidden is True
    assert score_image(marked).category == "GOOD"

    junk_dims = image_input_from_attrs({"alt": "A dog", "width": "auto", "height": "0"})
    assert junk_dims.width is None
    assert junk_dims.height is None

    # Percentages must not truncate to plausible pixel counts (width="2%" != 2px).
    percent = image_input_from_attrs({"alt": "A dog", "width": "2%", "height": "100%"})
    assert percent.width is None
    assert percent.height is None


def test_summarize():
    results = [
        score_alt_text(None),
        score_alt_text("image"),
        score_alt_text("A red bicycle leaning against a brick wall"),
        score_alt_text("img_2024"),
    ]
    assert summarize(results) == {
        "MISSING": 1,
        "GENERIC": 2,
        "DECORATIVE_UNMARKED": 0,
        "GOOD": 1,
    }
