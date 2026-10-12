"""API-facing request/response schemas.

These wrap the domain schemas (app.schemas.*) into the specific shapes the
HTTP API needs -- grouping RiskResults into per-crew trajectories with
vulnerability windows, for instance. They are not themselves part of the
domain model set from spec section 9.
"""

from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import DomainModel
from app.schemas.countermeasure import CountermeasurePlan
from app.schemas.crew import CrewProfile
from app.schemas.events import SimulationEvent
from app.schemas.mission import MissionConfig
from app.schemas.research import ExperimentProposal
from app.schemas.simulation_state import RiskResult

Severity = Literal["high", "critical"]


class MissionResponse(DomainModel):
    mission: MissionConfig
    crew_profiles: list[CrewProfile] = Field(description="The mission's synthetic crew, always synthetic=true.")
    events: list[SimulationEvent] = Field(description="Scripted mission events, e.g. the day-143 radiation storm.")
    synthetic_data_notice: str


class SimulationRunRequest(DomainModel):
    mission_id: str = Field(
        default="ares-180",
        description="Which mission scenario to simulate. Only 'ares-180' exists in this MVP; "
        "GET /api/v1/missions/{mission_id} lists what a scenario contains.",
        examples=["ares-180"],
    )
    countermeasures: list[CountermeasurePlan] = Field(
        default_factory=list,
        description="Optional countermeasures, applied for the entire simulated period "
        "(no partial-mission activation window yet -- see docs/methodology.md).",
    )


class VulnerabilityWindow(DomainModel):
    """A maximal run of consecutive days where a crew member's risk band
    was 'high' or 'critical' (spec section 7.1)."""

    day_start: int = Field(ge=1, le=1095)
    day_end: int = Field(ge=1, le=1095)
    severity: Severity
    primary_drivers: list[str] = Field(
        description="The risk drivers (see RiskResult.top_drivers) that appeared most often "
        "across the days in this window, most frequent first."
    )

    @model_validator(mode="after")
    def _day_range_ordered(self) -> "VulnerabilityWindow":
        if self.day_end < self.day_start:
            raise ValueError("day_end must be >= day_start")
        return self


class CrewTrajectory(DomainModel):
    crew_id: str
    display_name: str
    risk_results: list[RiskResult] = Field(description="One RiskResult per simulated day, in order.")
    vulnerability_windows: list[VulnerabilityWindow]


class SimulationRunResponse(DomainModel):
    mission_id: str
    generated_at: datetime
    disclaimer: str
    synthetic_data_notice: str
    trajectories: list[CrewTrajectory]
    band_day_counts: dict[str, dict[str, int]] = Field(
        description="Per crew member, how many simulated days fell in each risk band "
        "(low/moderate/high/critical)."
    )


class CounterfactualAlternativeResult(DomainModel):
    """One alternative's outcome from the day-145 EVA counterfactual
    comparison (spec section 12). Peaks and mean uncertainty are computed
    over a shared comparison window (days 143-160); see
    app/services/counterfactual.py for exactly why.
    """

    alternative: Literal["A", "B", "C"]
    description: str
    eva_crew_id: str = Field(description="Which crew member performs the EVA under this alternative.")
    eva_day: int = Field(ge=1, le=1095)
    peak_operational_risk: float = Field(ge=0.0, le=1.0)
    peak_cognitive_risk: float = Field(ge=0.0, le=1.0, description="Peak of (1 - cognitive_resilience) in the window.")
    peak_musculoskeletal_risk: float = Field(
        ge=0.0, le=1.0, description="Peak of 0.5*bone_risk + 0.5*(1-muscle_recovery) in the window."
    )
    mean_uncertainty: float = Field(ge=0.0, le=1.0)
    eva_completion_probability: float = Field(
        ge=0.0, le=1.0, description="Heuristic, bounded estimate -- not a validated prediction."
    )
    top_drivers: list[str]


class CounterfactualCompareRequest(DomainModel):
    mission_id: str = Field(
        default="ares-180",
        description="Only 'ares-180' is supported: this comparison is specific to its day-145 EVA decision.",
        examples=["ares-180"],
    )


class CounterfactualCompareResponse(DomainModel):
    mission_id: str
    generated_at: datetime
    disclaimer: str
    language_note: str = Field(
        description="Reminder that these are exploratory, heuristic comparisons, not predictions or medical guidance."
    )
    alternatives: list[CounterfactualAlternativeResult]


class CytoscapeNodeElement(DomainModel):
    data: dict = Field(description="CausalNode fields: id, label, category, description.")


class CytoscapeEdgeElement(DomainModel):
    data: dict = Field(
        description="CausalEdge fields plus a synthesized 'id': source, target, relation, "
        "weight, evidence_level, uncertainty, evidence_reference, limitations."
    )


class EvidenceGraphElements(DomainModel):
    nodes: list[CytoscapeNodeElement]
    edges: list[CytoscapeEdgeElement]


class EvidenceGraphResponse(DomainModel):
    elements: EvidenceGraphElements = Field(
        description="Cytoscape.js-compatible graph payload: pass directly to cy.add(elements) or cy.json({elements})."
    )
    evidence_level_legend: dict[str, str] = Field(
        description="What each evidence_level means (docs/methodology.md, 'Evidence levels')."
    )
    disclaimer: str
    synthetic_data_notice: str


class ResearchNavigatorRankingsResponse(DomainModel):
    """GET /api/v1/research-navigator/rankings (spec section 13)."""

    priority_formula: str = Field(
        description="The exact formula used to rank proposals, so the ranking is auditable "
        "rather than a black box."
    )
    language_note: str = Field(
        description="Reminder that these are this project's own hypothetical proposals, not "
        "funded or NASA-endorsed studies."
    )
    proposals: list[ExperimentProposal] = Field(description="Sorted by priority, descending.")
