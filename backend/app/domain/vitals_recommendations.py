"""What-to-do text shown next to a non-normal vitals metric.

Deliberately general wellness guidance (rest, hydrate, recheck, notice
patterns, escalate to a real clinician) -- never a dose, a medication name, or
a specific clinical treatment. The line between "general self-care advice"
and "medical advice this project explicitly disclaims" is exactly that: no
entry here tells anyone what to take or do to themselves beyond rest/
hydrate/recheck/breathe, and every "alert" tier ends by pointing at a real
clinician, not at more self-management.
"""

from app.schemas.vitals import MetricStatus

# metric_id -> status ("attention" or "alert") -> list of suggestions.
# "normal" is intentionally absent from every entry: see evaluate_vitals(),
# which only attaches recommendations when status != "normal".
_RECOMMENDATIONS: dict[str, dict[MetricStatus, list[str]]] = {
    "heart_rate": {
        "attention": [
            "Rest for a few minutes, avoid caffeine/stimulants, then recheck.",
            "Note what you were doing right before this reading -- exertion, stress and temperature all shift heart rate.",
        ],
        "alert": [
            "Sit or lie down and rest now, then recheck in a few minutes.",
            "If it stays this far outside range, or you feel dizzy, short of breath or have chest discomfort, treat this as needing real medical evaluation, not just this app.",
        ],
    },
    "heart_rhythm": {
        "attention": [
            "A one-off irregular-feeling beat is common and often harmless -- this app has no ECG sensor to confirm what's actually happening electrically.",
            "If it recurs, lasts more than a few seconds, or comes with dizziness or chest discomfort, that is a reason for real medical evaluation.",
        ],
    },
    "spo2": {
        "attention": [
            "Take a few slow, deep breaths and recheck.",
            "If you're using a device, make sure it's correctly positioned before trusting the number.",
        ],
        "alert": [
            "Recheck immediately with correct sensor placement.",
            "If this reading is accurate and you feel short of breath, dizzy or confused, treat this as needing urgent medical evaluation.",
        ],
    },
    "respiratory_rate": {
        "attention": [
            "Recheck while fully at rest, seated, breathing normally.",
            "Note whether this coincides with stress, exertion, or a pressure/altitude change.",
        ],
        "alert": [
            "If you feel breathless, lightheaded, or this persists, this needs medical evaluation.",
        ],
    },
    "body_temp": {
        "attention": [
            "Monitor over the next few hours and note any other symptoms (chills, fatigue, headache).",
            "Stay hydrated and rested in the meantime.",
        ],
        "alert": [
            "Recheck your thermometer/method to confirm the reading.",
            "If confirmed, this is a case for medical evaluation, not self-management.",
        ],
    },
    "sleep": {
        "attention": [
            "Prioritize an earlier wind-down tonight -- fewer screens/stimulants before bed.",
            "If short sleep keeps recurring across entries, that pattern is worth raising as a workload/schedule issue, not just a one-off.",
        ],
    },
    "sleep_quality": {
        "attention": [
            "Low self-rated quality despite enough hours can mean fragmented sleep -- note any waking, noise or light disruptions.",
            "Track this alongside sleep hours; a pattern over several nights tells you more than one night does.",
        ],
    },
    "activity": {
        "attention": [
            "Even a short walk or light resistance movement helps offset the musculoskeletal effects of inactivity (see the Genetics page for why).",
            "Build activity back up gradually rather than all at once.",
        ],
    },
    "stress": {
        "attention": [
            "A short break, slow breathing, or talking to someone can help in the moment.",
            "If stress stays elevated across several entries, that pattern itself is worth flagging to whoever supports crew wellbeing.",
        ],
    },
    "hydration": {
        "attention": [
            "Increase fluid intake and recheck how you feel in a couple of hours.",
            "This is a self-estimate, not a measurement -- this app (like most consumer wearables) cannot measure hydration precisely.",
        ],
    },
}


def recommendations_for(metric_id: str, status: MetricStatus) -> list[str]:
    if status == "normal":
        return []
    return list(_RECOMMENDATIONS.get(metric_id, {}).get(status, []))
