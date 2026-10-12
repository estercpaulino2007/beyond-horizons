"""Small builders for valid domain objects, reused across schema tests so
each test only overrides the field it's actually checking."""

from datetime import date, datetime, timezone

from app.schemas import (
    AgentRecommendation,
    CausalEdge,
    CausalNode,
    CrewBaseline,
    CrewProfile,
    DailyCrewState,
    DailyExposure,
    DebateResult,
    EvidenceRecord,
    ExperimentProposal,
    MissionConfig,
    RiskResult,
)
from app.schemas.events import DecisionAlternative, DecisionPoint, SimulationEvent


def make_mission(**overrides) -> MissionConfig:
    data = dict(
        mission_id="ares-180",
        mission_name="Ares-180 Mars Transit Simulation",
        destination="mars_transit",
        duration_days=180,
        crew_size=4,
        gravity_g=0.0,
        communication_delay_minutes=22.0,
    )
    data.update(overrides)
    return MissionConfig(**data)


def make_crew(**overrides) -> CrewProfile:
    data = dict(
        id="atlas",
        display_name="Atlas",
        role="Mission Specialist",
        baseline=CrewBaseline(
            radiation_sensitivity=0.45,
            bone_loss_susceptibility=0.35,
            sleep_resilience=0.30,
            muscle_recovery=0.75,
            cognitive_resilience=0.58,
            inflammatory_baseline=0.40,
        ),
        characteristics=["High physical capacity", "Unstable sleep patterns"],
        primary_vulnerability="Cognitive fatigue under sleep debt",
        limitations=["Synthetic persona for demonstration only"],
    )
    data.update(overrides)
    return CrewProfile(**data)


def make_exposure(**overrides) -> DailyExposure:
    data = dict(
        mission_id="ares-180",
        crew_id="atlas",
        day=1,
        radiation_dose=0.008,
        sleep_hours=7.2,
        exercise_duration_min=120.0,
        eva_load=0.0,
        operational_workload=0.45,
        co2_level_ppm=4500.0,
    )
    data.update(overrides)
    return DailyExposure(**data)


def make_event(**overrides) -> SimulationEvent:
    data = dict(
        id="evt_radiation_storm",
        mission_id="ares-180",
        day_start=143,
        day_end=143,
        type="radiation_storm",
        severity="high",
        description="Solar particle event causes acute radiation exposure",
        effects={"radiation_dose_multiplier": 3.5},
    )
    data.update(overrides)
    return SimulationEvent(**data)


def make_eva_decision_event(**overrides) -> SimulationEvent:
    data = dict(
        id="evt_eva_critical",
        mission_id="ares-180",
        day_start=145,
        day_end=145,
        type="eva",
        severity="high",
        description="Critical EVA scheduled for day 145",
        effects={"eva_load": 0.40},
        decision_point=DecisionPoint(
            alternatives=[
                DecisionAlternative(id="A", name="Maintain EVA", description="Proceed as scheduled"),
                DecisionAlternative(id="B", name="Delay EVA", description="Postpone by 10 days"),
                DecisionAlternative(id="C", name="Reassign + Recovery", description="Reassign and recover sleep"),
            ]
        ),
    )
    data.update(overrides)
    return SimulationEvent(**data)


def make_daily_state(**overrides) -> DailyCrewState:
    data = dict(
        crew_id="atlas",
        mission_id="ares-180",
        day=145,
        radiation_burden=0.77,
        sleep_debt=0.6,
        muscle_recovery=0.6,
        bone_risk=0.3,
        cognitive_resilience=0.4,
        operational_risk=0.68,
        uncertainty=0.21,
    )
    data.update(overrides)
    return DailyCrewState(**data)


def make_risk_result(**overrides) -> RiskResult:
    scores = overrides.pop("scores", None) or make_daily_state()
    data = dict(
        crew_id=scores.crew_id,
        mission_id=scores.mission_id,
        day=scores.day,
        scores=scores,
        band="high",
        uncertainty=scores.uncertainty,
        top_drivers=[],
    )
    data.update(overrides)
    return RiskResult(**data)


def make_verified_evidence(**overrides) -> EvidenceRecord:
    data = dict(
        source_type="nasa_dataset",
        dataset_id="OSD-720",
        source_url="https://osdr.nasa.gov/bio/repo/data/studies/OSD-720",
        organism="Mus musculus",
        tissue="Left ventricle",
        condition="ground_based_simulated_radiation",
        analysis_method="RNA-Seq, GeneLab standard processing",
        limitations=["Ground-based simulated radiation, not spaceflight", "Mouse, not human"],
        accessed_at=date(2026, 9, 19),
    )
    data.update(overrides)
    return EvidenceRecord(**data)


def make_synthetic_evidence(**overrides) -> EvidenceRecord:
    data = dict(
        source_type="synthetic_parameter",
        condition="synthetic",
        limitations=["Parameter created for the Ares-180 demonstration scenario"],
        accessed_at=date(2026, 9, 19),
    )
    data.update(overrides)
    return EvidenceRecord(**data)


def make_verified_edge(**overrides) -> CausalEdge:
    data = dict(
        source="radiation_exposure",
        target="dna_damage_response",
        relation="increases",
        weight=0.85,
        evidence_level="supported_evidence",
        uncertainty=0.10,
        evidence_reference="OSD-720: differential expression, mixed radiation vs. sham, left ventricle",
        limitations=["Ground-based simulated radiation, not spaceflight", "Mouse, not human"],
    )
    data.update(overrides)
    return CausalEdge(**data)


def make_hypothesis_edge(**overrides) -> CausalEdge:
    data = dict(
        source="sleep_debt",
        target="cognitive_load",
        relation="increases",
        weight=0.72,
        evidence_level="exploratory_hypothesis",
        uncertainty=0.25,
        evidence_reference="Scenario hypothesis for Ares-180; not independently measured",
        limitations=["MVP relation; not a clinical effect size"],
    )
    data.update(overrides)
    return CausalEdge(**data)


def make_causal_node(**overrides) -> CausalNode:
    data = dict(
        id="radiation_exposure",
        label="Radiation Exposure",
        category="exposure",
        description="Cumulative and acute radiation exposure during mission",
    )
    data.update(overrides)
    return CausalNode(**data)


def make_experiment_proposal(**overrides) -> ExperimentProposal:
    data = dict(
        id="exp_radiation_sleep_cognition",
        title="Radiation + Sleep + Cognition",
        gap_description="Interaction between radiation exposure, sleep and cognitive performance",
        mission_impact=0.8,
        uncertainty=0.7,
        expected_information_gain=0.6,
        relative_cost=1.5,
        limitations=["Exploratory prioritisation heuristic, not a funding decision"],
    )
    data.update(overrides)
    return ExperimentProposal(**data)


def make_recommendation(role: str, **overrides) -> AgentRecommendation:
    if role == "skeptic":
        data = dict(
            role="skeptic",
            justification="Several relations in this decision are exploratory hypotheses.",
            limitations=["Does not model long-term radiation carcinogenesis risk"],
        )
    else:
        data = dict(
            role=role,
            recommendation="B",
            utility=0.12,
            confidence=0.6,
            justification="Delaying the EVA reduces operational risk given current radiation burden.",
            limitations=["Utility weights are scenario parameters, not validated preferences"],
        )
    data.update(overrides)
    return AgentRecommendation(**data)


def make_debate_result(**overrides) -> DebateResult:
    data = dict(
        mission_id="ares-180",
        day=145,
        alternatives=["A", "B", "C"],
        recommendations=[
            make_recommendation("mission_commander"),
            make_recommendation("flight_surgeon"),
            make_recommendation("science_officer"),
            make_recommendation("skeptic"),
        ],
        disagreement_summary="Flight surgeon and science officer disagree on acceptable risk.",
        generated_at=datetime(2026, 9, 19, tzinfo=timezone.utc),
    )
    data.update(overrides)
    return DebateResult(**data)
