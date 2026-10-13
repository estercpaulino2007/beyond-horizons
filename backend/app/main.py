"""Beyond Horizons API entrypoint.

Step 4 added health check, CORS, OpenAPI metadata, and the first two real
endpoints (GET /api/v1/missions/{mission_id}, POST /api/v1/simulations/run).
Steps 5-9 added counterfactual, evidence-graph, research-navigator and
debate-chamber endpoints (ingestion, Step 7, is a CLI script, not an HTTP
endpoint). A later pass added the in-app assistant (app/api/assistant.py).
Persistence is added in a later step.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import assistant, counterfactual, countermeasures, debate, evidence, missions, research_navigator, simulations, vitals
from app.core.config import get_settings
from app.core.notices import PLATFORM_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN

API_VERSION = "0.1.0"
API_V1_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Beyond Horizons API",
        version=API_VERSION,
        summary="Explainable crew digital twin for exploratory space-health simulation.",
        description=f"{PLATFORM_DISCLAIMER}\n\n{SYNTHETIC_DATA_NOTICE_EN}",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["system"], summary="Liveness check")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "beyond-horizons-api", "version": API_VERSION}

    app.include_router(missions.router, prefix=API_V1_PREFIX)
    app.include_router(simulations.router, prefix=API_V1_PREFIX)
    app.include_router(countermeasures.router, prefix=API_V1_PREFIX)
    app.include_router(counterfactual.router, prefix=API_V1_PREFIX)
    app.include_router(evidence.router, prefix=API_V1_PREFIX)
    app.include_router(research_navigator.router, prefix=API_V1_PREFIX)
    app.include_router(debate.router, prefix=API_V1_PREFIX)
    app.include_router(assistant.router, prefix=API_V1_PREFIX)
    app.include_router(vitals.router, prefix=API_V1_PREFIX)

    return app


app = create_app()
