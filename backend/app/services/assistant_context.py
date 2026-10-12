"""Builds the grounding context the in-app assistant is allowed to answer from.

Nothing here is sent to any third party unless an operator has configured
ASSISTANT_API_KEY (app/core/config.py) -- this module only assembles text from
data this project already computes and serves elsewhere (GET
/api/v1/missions/{id}, GET /api/v1/evidence/graph). It never invents a fact
that isn't already present in one of those domain builders.
"""

from __future__ import annotations

from app.core.notices import PLATFORM_DISCLAIMER, SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.domain.ares180_seed import build_crew_profiles, build_mission_config, build_mission_events
from app.domain.evidence_graph import build_causal_edges, build_causal_nodes


def build_assistant_context() -> str:
    """A compact, deterministic text summary of the mission, crew and
    evidence graph -- small enough to stay well within a chat model's
    context window, and regenerated fresh on every request so it can never
    drift from what the rest of the app is actually showing."""
    mission = build_mission_config()
    crew = build_crew_profiles()
    events = build_mission_events()
    nodes = {n.id: n for n in build_causal_nodes()}
    edges = build_causal_edges()

    lines: list[str] = []

    lines.append(f"Disclaimers that apply to everything below: {PLATFORM_DISCLAIMER} {SYNTHETIC_DATA_NOTICE_EN} {SIMULATION_DISCLAIMER}")
    lines.append("")
    lines.append(
        f"## Mission: {mission.mission_name} ({mission.mission_id})\n"
        f"Destination: {mission.destination} | Duration: {mission.duration_days} days | "
        f"Crew size: {mission.crew_size} | Gravity: {mission.gravity_g} g | "
        f"Comm delay: {mission.communication_delay_minutes} min one-way"
    )
    lines.append("")

    lines.append("## Crew (synthetic, not real astronauts)")
    for member in crew:
        lines.append(
            f"- {member.display_name} ({member.role}): primary_vulnerability="
            f"{member.primary_vulnerability!r}; baseline={member.baseline.model_dump()}"
        )
    lines.append("")

    lines.append("## Scripted mission events")
    for event in events:
        lines.append(f"- day {event.day_start}-{event.day_end}: [{event.type}] {event.description}")
    lines.append("")

    lines.append(
        "## Evidence causal graph (every edge's evidence_level is authoritative -- "
        "never state a stronger level than what is listed here)"
    )
    for edge in edges:
        source = nodes[edge.source].label
        target = nodes[edge.target].label
        lines.append(
            f"- {source} --{edge.relation}--> {target} "
            f"[evidence_level={edge.evidence_level}, uncertainty={edge.uncertainty}] "
            f"ref: {edge.evidence_reference} "
            f"limitations: {'; '.join(edge.limitations)}"
        )

    return "\n".join(lines)
