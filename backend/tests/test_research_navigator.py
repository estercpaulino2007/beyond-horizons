"""Tests for the Research Navigator (Prompt 8).

Checks: priority is always the schema's own computed_field (never a
hand-set number that could disagree with its inputs), the ranking is
sorted descending by that same computed value, every proposal carries at
least one limitation (the schema enforces this but we re-assert it as a
regression guard), and the ranking is deterministic across repeated calls.
"""

import pytest

from app.domain.research_navigator import build_research_proposals, rank_research_proposals
from app.schemas.research import ExperimentProposal


def test_priority_is_computed_not_settable():
    proposal = build_research_proposals()[0]
    expected = (
        proposal.mission_impact * proposal.uncertainty * proposal.expected_information_gain
    ) / proposal.relative_cost
    assert proposal.priority == pytest.approx(expected)
    with pytest.raises((TypeError, ValueError)):
        ExperimentProposal(
            id="bad",
            title="Bad",
            gap_description="x",
            mission_impact=0.5,
            uncertainty=0.5,
            expected_information_gain=0.5,
            relative_cost=1.0,
            limitations=["x"],
            priority=0.999,  # type: ignore[call-arg]
        )


def test_every_proposal_has_at_least_one_limitation():
    for proposal in build_research_proposals():
        assert len(proposal.limitations) >= 1
        assert all(item.strip() for item in proposal.limitations)


def test_three_proposals_with_distinct_ids():
    proposals = build_research_proposals()
    assert len(proposals) == 3
    ids = {p.id for p in proposals}
    assert len(ids) == 3


def test_ranking_is_sorted_descending_by_priority():
    ranked = rank_research_proposals()
    priorities = [p.priority for p in ranked]
    assert priorities == sorted(priorities, reverse=True)


def test_ranking_matches_known_computed_priorities():
    """Regression guard on the actual numbers, computed directly from this
    module's own stated inputs -- not invented reference values."""
    ranked = rank_research_proposals()
    by_id = {p.id: p.priority for p in ranked}
    assert by_id["radiation-sleep-cognition"] == pytest.approx(0.176, abs=1e-6)
    assert by_id["isolation-circadian-performance"] == pytest.approx(0.175, abs=1e-6)
    assert by_id["microgravity-muscle-bone"] == pytest.approx(0.14625, abs=1e-6)
    assert [p.id for p in ranked] == [
        "radiation-sleep-cognition",
        "isolation-circadian-performance",
        "microgravity-muscle-bone",
    ]


def test_ranking_is_deterministic_across_repeated_calls():
    first = [p.id for p in rank_research_proposals()]
    second = [p.id for p in rank_research_proposals()]
    assert first == second
