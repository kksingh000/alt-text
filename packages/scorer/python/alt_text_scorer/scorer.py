"""Rule-based alt text quality scorer.

Pure functions, no I/O, no network. This is the Python mirror of the
TypeScript implementation in packages/scorer/ts; both are generated from the
same canonical rule spec (packages/scorer/spec/scorer.spec.json) and must pass
the same golden fixtures (packages/scorer/spec/fixtures.json).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from importlib import resources
from typing import Iterable, Literal, Mapping, Optional

AltTextCategory = Literal["MISSING", "GENERIC", "DECORATIVE_UNMARKED", "GOOD"]
Severity = Literal["error", "warning", "pass"]

SPEC: dict = json.loads(
    resources.files(__package__).joinpath("spec_data.json").read_text(encoding="utf-8")
)

def _compile(pattern: str) -> "re.Pattern[str]":
    """Compile a spec pattern with JavaScript-compatible semantics.

    - re.ASCII keeps \\d/\\w/\\s ASCII-only, matching JS where \\d is [0-9]
      (Python's default \\d also matches e.g. Arabic-Indic digits).
    - '$' is replaced with \\Z because Python's '$' also matches just before a
      trailing newline, while JS '$' (no /m flag) matches only at the very end.
    Spec patterns must stay within the JS/Python common syntax subset.
    """
    return re.compile(pattern.replace("$", r"\Z"), re.IGNORECASE | re.ASCII)


_GENERIC_WORDS = frozenset(SPEC["genericWords"])
_GENERIC_ALT_PATTERNS = [_compile(p) for p in SPEC["genericAltPatterns"]]
_DECORATIVE_FILENAME_PATTERNS = [_compile(p) for p in SPEC["decorativeFilenamePatterns"]]
_DECORATIVE_ROLES = frozenset({"presentation", "none"})
_ASCII_ONLY = re.compile(r"^[\x00-\x7f]+$")
_THRESHOLDS = SPEC["thresholds"]


@dataclass(frozen=True)
class ImageInput:
    """Language-neutral description of an <img>.

    ``alt=None`` means the attribute is absent entirely, which is distinct
    from ``alt=""``.
    """

    alt: Optional[str]
    src: str = ""
    width: Optional[int] = None
    height: Optional[int] = None
    role: Optional[str] = None
    aria_hidden: bool = False


@dataclass(frozen=True)
class WcagReference:
    criterion: str
    name: str
    level: str
    url: str


@dataclass(frozen=True)
class ScoreResult:
    category: AltTextCategory
    reason: str
    severity: Severity
    label: str
    wcag: WcagReference
    suggested_fix: str
    screen_reader_fallback: Optional[str] = field(default=None)


def _filename_from_src(src: str) -> Optional[str]:
    """Lowercased filename from a URL-ish src, ignoring query/hash.

    Returns None for data:/blob: URIs and empty srcs, where a "filename" is
    meaningless.
    """
    if not src:
        return None
    lower = src.lower()
    if lower.startswith("data:") or lower.startswith("blob:"):
        return None
    path = re.split(r"[?#]", src, maxsplit=1)[0]
    last = path.rsplit("/", 1)[-1]
    if not last:
        return None
    from urllib.parse import unquote

    try:
        # errors="strict" mirrors JS decodeURIComponent, which throws on
        # malformed sequences (we then keep the raw string, as scorer.ts does);
        # the default errors="replace" would silently produce U+FFFD instead.
        return unquote(last, errors="strict").lower()
    except UnicodeDecodeError:
        return last.lower()


def _trim(value: str) -> str:
    """JS String.prototype.trim parity: also strips U+FEFF (BOM/ZWNBSP),
    which Python's str.strip() does not treat as whitespace."""
    prev = None
    while prev != value:
        prev = value
        value = value.strip().strip("﻿")
    return value


def _filename_stem(filename: str) -> str:
    dot = filename.rfind(".")
    return filename[:dot] if dot > 0 else filename


def _is_tiny(width: Optional[int], height: Optional[int]) -> bool:
    tiny = _THRESHOLDS["tinyDimensionPx"]
    spacer = _THRESHOLDS["spacerDimensionPx"]
    if width is not None and 0 < width <= spacer:
        return True
    if height is not None and 0 < height <= spacer:
        return True
    return (
        width is not None
        and height is not None
        and 0 < width < tiny
        and 0 < height < tiny
    )


def _baseline(alt: Optional[str], src: str) -> tuple[AltTextCategory, str]:
    """Scores alt text alone (missing/generic checks), ignoring decorative signals."""
    if alt is None:
        return "MISSING", "no-alt-attribute"
    if alt == "":
        return "MISSING", "empty-alt"
    trimmed = _trim(alt)
    if trimmed == "":
        return "MISSING", "whitespace-only-alt"

    lower = trimmed.lower()
    if lower in _GENERIC_WORDS:
        return "GENERIC", "generic-word"
    if any(p.search(lower) for p in _GENERIC_ALT_PATTERNS):
        return "GENERIC", "generic-pattern"

    filename = _filename_from_src(src)
    if filename and lower in (filename, _filename_stem(filename)):
        return "GENERIC", "matches-filename"

    if (
        not re.search(r"\s", trimmed)
        and _ASCII_ONLY.match(trimmed)
        and len(trimmed) < _THRESHOLDS["minSingleWordLength"]
    ):
        return "GENERIC", "single-short-word"

    return "GOOD", "descriptive"


def _result(category: AltTextCategory, reason: str) -> ScoreResult:
    meta = SPEC["categories"][category]
    return ScoreResult(
        category=category,
        reason=reason,
        severity=meta["severity"],
        label=meta["label"],
        wcag=WcagReference(**meta["wcag"]),
        suggested_fix=meta["suggestedFix"],
        screen_reader_fallback=meta["screenReaderFallback"],
    )


def score_image(image: ImageInput) -> ScoreResult:
    """Rule-based alt text scorer. Pure function, no I/O, no network.

    Evaluation order:
    1. role="presentation"/"none" or aria-hidden="true" -> GOOD (author opted out).
    2. Image looks decorative (tiny dimensions or spacer/divider-style filename):
       alt="" -> GOOD; otherwise, if the alt is missing or generic ->
       DECORATIVE_UNMARKED. A tiny image with genuinely descriptive alt
       (a labelled 16px icon) stays GOOD.
    3. Otherwise MISSING / GENERIC / GOOD from the alt text itself.
    """
    role = image.role.strip().lower() if image.role else None
    if (role in _DECORATIVE_ROLES) or image.aria_hidden:
        return _result("GOOD", "explicitly-marked-decorative")

    base_category, base_reason = _baseline(image.alt, image.src)

    tiny = _is_tiny(image.width, image.height)
    filename = _filename_from_src(image.src)
    decorative_name = filename is not None and any(
        p.search(filename) for p in _DECORATIVE_FILENAME_PATTERNS
    )
    if tiny or decorative_name:
        if image.alt == "":
            return _result("GOOD", "decorative-correctly-marked")
        if base_category != "GOOD":
            return _result(
                "DECORATIVE_UNMARKED",
                "tiny-image-unmarked" if tiny else "decorative-filename-unmarked",
            )

    return _result(base_category, base_reason)


def score_alt_text(alt: Optional[str], src: str = "") -> ScoreResult:
    """Convenience wrapper when all you have is the alt string and src."""
    return score_image(ImageInput(alt=alt, src=src))


def _parse_dimension(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    # Only plain pixel integers: a prefix match would truncate width="2%" to 2
    # and misclassify a fluid-layout content image as a tiny decorative spacer.
    match = re.fullmatch(r"\s*(\d+)\s*", value, re.ASCII)
    if not match:
        return None
    parsed = int(match.group(1))
    return parsed if parsed > 0 else None


def image_input_from_attrs(attrs: Mapping[str, Optional[str]]) -> ImageInput:
    """Builds an ImageInput from raw HTML attributes, e.g. a BeautifulSoup
    ``tag.attrs`` mapping (the backend crawler's case)."""
    return ImageInput(
        alt=attrs.get("alt"),
        src=attrs.get("src") or "",
        width=_parse_dimension(attrs.get("width")),
        height=_parse_dimension(attrs.get("height")),
        role=attrs.get("role"),
        aria_hidden=(attrs.get("aria-hidden") or "").strip().lower() == "true",
    )


def summarize(results: Iterable[ScoreResult]) -> dict[AltTextCategory, int]:
    """Counts results per category — what the audit report displays."""
    counts: dict[AltTextCategory, int] = {
        "MISSING": 0,
        "GENERIC": 0,
        "DECORATIVE_UNMARKED": 0,
        "GOOD": 0,
    }
    for r in results:
        counts[r.category] += 1
    return counts
