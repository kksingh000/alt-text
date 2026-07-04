import httpx
from alt_text_scorer import SPEC
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .audit import run_audit
from .crawler import FetchError
from .models import AuditRequest, AuditResponse

app = FastAPI(
    title="Alt Text Audit API",
    version="0.1.0",
    description=(
        "Crawls a page or sitemap and scores every image's alt text with the "
        "shared rule-based scorer. No AI, no external API calls."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "scorer_spec_version": SPEC["version"]}


@app.post("/api/audit", response_model=AuditResponse)
async def audit(request: AuditRequest) -> AuditResponse:
    try:
        return await run_audit(str(request.url), request.max_pages)
    except FetchError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"The site responded with HTTP {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch the site: {exc}") from exc
