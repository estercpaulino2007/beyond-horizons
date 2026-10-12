"""Single source of truth for mapping operational_risk -> RiskBand.

Used by both RiskResult's own validator (app/schemas/simulation_state.py)
and the simulation engine (app/services/simulation_engine.py), so the two
can never independently drift apart on where a threshold sits.
"""

from app.schemas.common import RiskBand


def band_for_risk(operational_risk: float) -> RiskBand:
    if operational_risk < 0.25:
        return "low"
    if operational_risk < 0.5:
        return "moderate"
    if operational_risk < 0.75:
        return "high"
    return "critical"
