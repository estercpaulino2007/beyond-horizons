"""Rule-based evaluation of a self-reported VitalsEntry against standard adult
resting reference ranges.

Where these ranges come from (see docs/data-sources.md, "CLINICAL-VITALS-
REFERENCE" for the full write-up and app/core/evidence_registry.py for the
registered key): widely published general clinical guidance --
resting heart rate (American Heart Association), SpO2 and respiratory rate
(standard adult vital-sign references used in clinical practice and cited by
the WHO/CDC), body temperature (CDC), recommended adult sleep duration (CDC /
National Sleep Foundation). These are NOT spaceflight-specific thresholds --
this project has not found a published, spaceflight-specific vital-sign
reference table, and says so explicitly in the response's limitations. Stress
level and daily activity minutes are self-reported wellness indicators, not
clinical vitals, and are scored more leniently (never "alert") for that
reason.

Deliberately rule-based and deterministic, not LLM-generated: the same input
always produces the same evaluation, and every sentence traces back to a
specific comparison coded here -- nothing is invented at request time.
"""

from app.schemas.vitals import MetricStatus, VitalMetricEvaluation, VitalsEntry, VitalsEvaluationResponse

REFERENCE_SOURCE = "CLINICAL-VITALS-REFERENCE"

_LIMITATIONS = [
    "These are general adult resting reference ranges (AHA/CDC/standard clinical vital-sign guidance), "
    "not spaceflight-specific thresholds -- no published, peer-reviewed in-flight vital-sign reference "
    "table was found for this project.",
    "A single self-reported snapshot cannot diagnose anything; trends over many consistent readings are "
    "far more informative than any one entry.",
    "Values are exactly what you type in -- this app has no sensor or wearable integration and does not "
    "verify them against any device.",
    "This is not medical advice and does not replace evaluation by a flight surgeon or clinician.",
]

_STATUS_RANK: dict[MetricStatus, int] = {"normal": 0, "attention": 1, "alert": 2}


def _worse(a: MetricStatus, b: MetricStatus) -> MetricStatus:
    return a if _STATUS_RANK[a] >= _STATUS_RANK[b] else b


def _evaluate_range(
    *, metric_id: str, label: str, value: float, unit: str,
    normal_low: float, normal_high: float,
    alert_low: float, alert_high: float,
    reference_range: str,
) -> VitalMetricEvaluation:
    if value < alert_low or value > alert_high:
        status: MetricStatus = "alert"
        note = f"{value:g} {unit} is outside the {reference_range} resting range and well beyond the usual attention margin."
    elif value < normal_low or value > normal_high:
        status = "attention"
        note = f"{value:g} {unit} is just outside the {reference_range} resting range -- worth watching, not yet urgent."
    else:
        status = "normal"
        note = f"{value:g} {unit} is within the {reference_range} resting range."
    return VitalMetricEvaluation(
        metric_id=metric_id, label=label, value=value, unit=unit,
        status=status, reference_range=reference_range, note=note,
    )


def _evaluate_wellness(
    *, metric_id: str, label: str, value: float, unit: str,
    normal_low: float, reference_range: str, good_note: str, low_note: str,
) -> VitalMetricEvaluation:
    """For sleep/activity/stress: never 'alert' -- these are self-reported
    wellness indicators, not clinical vitals a single bad reading can be
    dangerous on its own.
    """
    status: MetricStatus = "normal" if value >= normal_low else "attention"
    note = good_note if status == "normal" else low_note
    return VitalMetricEvaluation(
        metric_id=metric_id, label=label, value=value, unit=unit,
        status=status, reference_range=reference_range, note=note,
    )


def _evaluate_stress(value: int) -> VitalMetricEvaluation:
    """Self-reported 0-10 stress scale, lower is better -- the inverse shape
    of _evaluate_wellness's "higher is better", so handled separately rather
    than forcing a sign-flipped value through that helper.
    """
    status: MetricStatus = "normal" if value <= 3 else "attention"
    note = (
        f"Self-reported stress {value}/10 is on the lower end."
        if status == "normal"
        else f"Self-reported stress {value}/10 is elevated -- worth noting alongside sleep and workload."
    )
    return VitalMetricEvaluation(
        metric_id="stress", label="Stress level", value=float(value), unit="/10",
        status=status, reference_range="self-reported, lower is better", note=note,
    )


def evaluate_vitals(entry: VitalsEntry, *, disclaimer: str, synthetic_data_notice: str) -> VitalsEvaluationResponse:
    metrics: list[VitalMetricEvaluation] = [
        _evaluate_range(
            metric_id="heart_rate", label="Heart rate", value=entry.heart_rate_bpm, unit="bpm",
            normal_low=60, normal_high=100, alert_low=50, alert_high=110,
            reference_range="60-100 bpm",
        ),
        _evaluate_range(
            metric_id="spo2", label="Blood oxygen (SpO2)", value=entry.spo2_percent, unit="%",
            normal_low=95, normal_high=100, alert_low=90, alert_high=100,
            reference_range="95-100%",
        ),
        _evaluate_range(
            metric_id="body_temp", label="Body temperature", value=entry.body_temp_c, unit="°C",
            normal_low=36.1, normal_high=37.2, alert_low=35.5, alert_high=38.0,
            reference_range="36.1-37.2°C",
        ),
        _evaluate_range(
            metric_id="respiratory_rate", label="Respiratory rate", value=entry.respiratory_rate_bpm, unit="breaths/min",
            normal_low=12, normal_high=20, alert_low=10, alert_high=24,
            reference_range="12-20 breaths/min",
        ),
        _evaluate_wellness(
            metric_id="sleep", label="Sleep", value=entry.sleep_hours, unit="h", normal_low=7,
            reference_range="7-9 h (CDC adult recommendation)",
            good_note=f"{entry.sleep_hours:g} h meets the general adult recommendation (7-9 h).",
            low_note=f"{entry.sleep_hours:g} h is below the general adult recommendation (7-9 h) -- insufficient sleep is a known contributor to fatigue and reduced performance.",
        ),
        _evaluate_wellness(
            metric_id="activity", label="Physical activity", value=entry.activity_minutes, unit="min", normal_low=20,
            reference_range="~20+ min/day (WHO weekly guidance averaged daily)",
            good_note=f"{entry.activity_minutes:g} min meets the rough daily average implied by WHO weekly activity guidance.",
            low_note=f"{entry.activity_minutes:g} min is below the rough daily average implied by WHO weekly activity guidance -- relevant here because inactivity compounds microgravity-linked muscle/bone loss (see the Genetics page).",
        ),
        _evaluate_stress(entry.stress_level),
    ]

    overall_status: MetricStatus = "normal"
    for m in metrics:
        overall_status = _worse(overall_status, m.status)

    non_normal = [m for m in metrics if m.status != "normal"]
    if not non_normal:
        insights = ["All monitored indicators are within expected resting ranges for this entry."]
    else:
        insights = [m.note for m in non_normal]
        if any(m.status == "alert" for m in non_normal):
            insights.append(
                "One or more readings are well outside the resting reference range -- if this reflects how "
                "you actually feel right now, treat it as a prompt to check in with a real clinician, not "
                "just this app."
            )

    return VitalsEvaluationResponse(
        overall_status=overall_status,
        metrics=metrics,
        insights=insights,
        reference_source=REFERENCE_SOURCE,
        limitations=list(_LIMITATIONS),
        disclaimer=disclaimer,
        synthetic_data_notice=synthetic_data_notice,
    )
