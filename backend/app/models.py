from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, HttpUrl

AltTextCategory = Literal["MISSING", "GENERIC", "DECORATIVE_UNMARKED", "GOOD"]


class AuditRequest(BaseModel):
    url: HttpUrl
    max_pages: int = Field(default=5, ge=1, le=20)


class WcagRef(BaseModel):
    criterion: str
    name: str
    level: str
    url: str


class ImageResult(BaseModel):
    src: str
    alt: Optional[str]
    category: AltTextCategory
    reason: str
    severity: Literal["error", "warning", "pass"]
    label: str
    wcag: WcagRef
    suggested_fix: str
    suggested_caption: Optional[str] = None


class PageResult(BaseModel):
    url: str
    fetched: bool
    error: Optional[str] = None
    possibly_js_rendered: bool = False
    images: list[ImageResult] = []
    counts: dict[AltTextCategory, int]


class AuditResponse(BaseModel):
    requested_url: str
    source: Literal["page", "sitemap"]
    pages: list[PageResult]
    totals: dict[AltTextCategory, int]
    total_images: int
    generated_at: datetime
