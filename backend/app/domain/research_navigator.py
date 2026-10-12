"""Research Navigator (spec section 13).

Turns the evidence graph's honestly-labelled gaps into a small, ranked list
of hypothetical follow-up experiments. Nothing here claims to be a real,
funded, or NASA-endorsed study -- `ExperimentProposal.limitations` always
says so explicitly (enforced by `non_empty_limitations`, see
app/schemas/common.py).

Ranking uses the project's own priority formula (reconciliation log #7,
docs/methodology.md): priority = mission_impact * uncertainty *
expected_information_gain / relative_cost. It is a computed_field on the
schema itself, so this module never invents a priority number -- it only
supplies the four inputs and lets the schema compute it.
"""

from app.schemas.research import ExperimentProposal

_SHARED_LIMITATIONS = [
    "Hypothetical experiment design, not a funded or scheduled NASA study.",
    "Impact, uncertainty and information-gain scores are this project's own "
    "qualitative judgment calls, not measured quantities.",
]


def build_research_proposals() -> list[ExperimentProposal]:
    """The three candidate experiments this project proposes, built directly
    from gaps already visible in the evidence graph (app/domain/evidence_graph.py):
    the radiation-x-sleep-x-cognition interaction, the microgravity-x-muscle-x-bone
    interaction, and the isolation-x-circadian-x-performance interaction all
    appear there as exploratory_hypothesis edges with no supporting dataset."""
    return [
        ExperimentProposal(
            id="radiation-sleep-cognition",
            title="Radiation + Sleep + Cognition",
            gap_description=(
                "The evidence graph links radiation exposure and sleep debt to cognitive "
                "resilience only through exploratory_hypothesis edges (app/domain/evidence_graph.py) "
                "-- no dataset in this project's registry (app/core/evidence_registry.py) measures "
                "the combined effect of radiation dose and sleep debt on cognition in the same "
                "subjects. The closest real source on file (JSC, DOI 10.83263/2p33-rp27) covers "
                "sleep medication and abrupt-awakening cognition, but not radiation."
            ),
            mission_impact=0.80,
            uncertainty=0.55,
            expected_information_gain=0.60,
            relative_cost=1.5,
            limitations=_SHARED_LIMITATIONS
            + [
                "Would require a combined radiation + sleep-restriction ground analog; no such "
                "combined protocol exists among this project's verified sources."
            ],
        ),
        ExperimentProposal(
            id="microgravity-muscle-bone",
            title="Microgravity + Muscle + Bone",
            gap_description=(
                "Bone and muscle loss are each backed by real sources individually (the "
                "Hughes-Fulford osteoblast dataset and the HRP bone/muscle risk pages), but no "
                "single dataset measures bone and muscle decline together under microgravity in "
                "the same crew member over time -- musculoskeletal_risk in the simulation engine "
                "is a reporting-only heuristic, not a value read from data."
            ),
            mission_impact=0.75,
            uncertainty=0.60,
            expected_information_gain=0.65,
            relative_cost=2.0,
            limitations=_SHARED_LIMITATIONS
            + [
                "A combined longitudinal bone+muscle dataset under long-duration microgravity "
                "is costlier (longer duration, more instrumentation) than the other two proposals, "
                "reflected in its higher relative_cost."
            ],
        ),
        ExperimentProposal(
            id="isolation-circadian-performance",
            title="Isolation + Circadian Rhythm + Performance",
            gap_description=(
                "The evidence graph's behavioral-health edges (backed by HRP-BEHAVIORAL-HEALTH) "
                "cover isolation and confinement broadly, but not the specific interaction between "
                "circadian misalignment and operational performance -- this remains an "
                "exploratory_hypothesis edge with no dedicated dataset."
            ),
            mission_impact=0.60,
            uncertainty=0.70,
            expected_information_gain=0.50,
            relative_cost=1.2,
            limitations=_SHARED_LIMITATIONS
            + [
                "Isolation effects are highly context-dependent (crew size, mission phase, "
                "communication delay); a ground analog may not transfer cleanly to flight."
            ],
        ),
    ]


def rank_research_proposals() -> list[ExperimentProposal]:
    """Descending by priority; ties broken by id so the ordering is
    deterministic (never relies on Python's unstable sort behavior across
    versions for exactly-equal floats)."""
    proposals = build_research_proposals()
    return sorted(proposals, key=lambda p: (-p.priority, p.id))
