"""GET /api/v1/evidence/graph (spec section 15)."""

from fastapi import APIRouter

from app.core.notices import SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.domain.evidence_graph import build_networkx_graph
from app.schemas.api import EvidenceGraphResponse
from app.schemas.common import EVIDENCE_LEVEL_DESCRIPTIONS
from app.services.evidence_graph_service import to_cytoscape_elements

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get(
    "/graph",
    summary="Get the evidence causal graph",
    description=(
        "Returns the causal graph of physiological/operational factors as Cytoscape.js-compatible "
        "JSON. Every edge carries an evidence_level, an uncertainty score, a reference and at least "
        "one limitation; only edges backed by a source registered in docs/data-sources.md may claim "
        "supported_evidence or data_supported_association (see app/core/evidence_registry.py) -- the "
        "rest are honestly labelled exploratory_hypothesis."
    ),
)
def get_evidence_graph() -> EvidenceGraphResponse:
    graph = build_networkx_graph()
    return EvidenceGraphResponse(
        elements=to_cytoscape_elements(graph),
        evidence_level_legend=EVIDENCE_LEVEL_DESCRIPTIONS,
        disclaimer=SIMULATION_DISCLAIMER,
        synthetic_data_notice=SYNTHETIC_DATA_NOTICE_EN,
    )
