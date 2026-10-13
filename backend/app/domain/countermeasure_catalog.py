"""Small, fixed catalog of countermeasures a simulation run can select.

Kept separate from any single mission's seed data (app/domain/ares180_seed.py)
because countermeasures are not mission-specific: the same exercise /
radiation / sleep-management protocol could in principle apply to any
destination. Each plan's effect on the simulation is modeled qualitatively in
app/services/simulation_engine.py's COUNTERMEASURE_EFFECTS table (a rate-constant
nudge, not a quantified clinical effect size) -- see that module's docstring
and docs/methodology.md, reconciliation #7, for why no invented numeric
"expected risk reduction" is ever exposed to a caller.
"""

from app.schemas.countermeasure import CountermeasurePlan

COUNTERMEASURE_CATALOG: list[CountermeasurePlan] = [
    CountermeasurePlan(
        id="exercise_protocol",
        name="Enhanced exercise protocol",
        target_risk="musculoskeletal",
        description=(
            "Prioritized resistive and aerobic exercise scheduling, intended to limit muscle "
            "and bone deconditioning across the mission."
        ),
        limitations=[
            "Effect on the simulation's muscle/bone accumulators is modeled qualitatively "
            "(faster muscle recovery, slower bone-risk accumulation), not a quantified "
            "clinical effect size from a specific study.",
            "Does not fully prevent deconditioning; the simulation still accrues some risk.",
        ],
    ),
    CountermeasurePlan(
        id="radiation_shielding",
        name="Supplemental radiation shielding & monitoring",
        target_risk="radiation",
        description=(
            "Additional shielding placement and dosimetry monitoring, intended to slow how "
            "quickly radiation burden accumulates over the mission."
        ),
        limitations=[
            "Effect on the simulation's radiation accumulator is modeled qualitatively (a "
            "slower accumulation rate), not a quantified shielding-effectiveness figure.",
            "Does not model an acute high-dose event (e.g. a solar particle event) differently.",
        ],
    ),
    CountermeasurePlan(
        id="sleep_cognitive_protocol",
        name="Sleep & cognitive-load management protocol",
        target_risk="cognitive_operational",
        description=(
            "Structured sleep scheduling and operational-workload pacing, intended to speed "
            "sleep-debt recovery and cognitive-resilience adaptation."
        ),
        limitations=[
            "Effect on the simulation's sleep-recovery and cognitive-adaptation rates is "
            "modeled qualitatively, not a quantified clinical effect size.",
            "Cannot fully offset a high-workload day (e.g. an EVA) in the simulation.",
        ],
    ),
]


def get_countermeasure_catalog() -> list[CountermeasurePlan]:
    return list(COUNTERMEASURE_CATALOG)
