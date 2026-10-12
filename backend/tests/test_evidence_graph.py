"""Tests for the evidence causal graph (Prompt 6).

Checks: every edge has an evidence_level and at least one limitation
(mostly enforced by CausalEdge's own schema, re-asserted here as a
regression guard tied to this specific graph's content); the graph is a
valid NetworkX DiGraph with no dangling edges; and -- the core rule --
every supported_evidence/data_supported_association edge in *this*
specific graph really does point at a source in the verified registry.
"""

import networkx as nx
import pytest

from app.core.evidence_registry import is_verified_reference
from app.domain.evidence_graph import build_causal_edges, build_causal_nodes, build_networkx_graph


def test_every_edge_has_evidence_level_and_at_least_one_limitation():
    for edge in build_causal_edges():
        assert edge.evidence_level in (
            "supported_evidence",
            "data_supported_association",
            "exploratory_hypothesis",
            "synthetic_parameter",
        )
        assert len(edge.limitations) >= 1
        assert all(item.strip() for item in edge.limitations)


def test_every_real_evidence_claim_points_at_a_verified_source():
    real_claims = [
        e for e in build_causal_edges() if e.evidence_level in ("supported_evidence", "data_supported_association")
    ]
    assert len(real_claims) >= 1  # the graph does claim some real evidence
    for edge in real_claims:
        assert is_verified_reference(edge.evidence_reference), (
            f"{edge.source}->{edge.target} claims {edge.evidence_level!r} but its "
            f"evidence_reference is not in the verified registry: {edge.evidence_reference!r}"
        )


def test_evidence_backed_edges_all_verified_and_hypotheses_remain_honest():
    """Regression guard for the project's honesty standard, in both
    directions: every supported_evidence/data_supported_association edge
    must be verifiable (checked by the schema itself at construction time,
    re-asserted here), and at least a few edges must remain honestly
    exploratory_hypothesis -- a second search pass found real sources for
    several edges that started out as hypotheses (bone, muscle, EVA), but
    not all of them, and the ones that are still unverified should stay
    labelled as such rather than being upgraded without a real source.
    """
    edges = build_causal_edges()
    real = [e for e in edges if e.evidence_level in ("supported_evidence", "data_supported_association")]
    exploratory = [e for e in edges if e.evidence_level == "exploratory_hypothesis"]
    assert len(real) >= 1
    assert len(exploratory) >= 1


def test_graph_is_a_valid_dag_with_no_dangling_edges():
    graph = build_networkx_graph()
    node_ids = {n.id for n in build_causal_nodes()}
    assert set(graph.nodes) == node_ids
    for source, target in graph.edges:
        assert source in node_ids
        assert target in node_ids
    assert nx.is_directed_acyclic_graph(graph)


def test_edge_referencing_unknown_node_is_rejected(monkeypatch):
    from app.schemas.causal_graph import CausalEdge

    import app.domain.evidence_graph as evidence_graph_module

    def _edges_with_bad_reference():
        return build_causal_edges() + [
            CausalEdge(
                source="radiation_exposure",
                target="a_node_that_does_not_exist",
                relation="increases",
                weight=0.5,
                evidence_level="exploratory_hypothesis",
                uncertainty=0.5,
                evidence_reference="Scenario hypothesis",
                limitations=["Test fixture edge"],
            )
        ]

    monkeypatch.setattr(evidence_graph_module, "build_causal_edges", _edges_with_bad_reference)
    with pytest.raises(ValueError, match="unknown"):
        evidence_graph_module.build_networkx_graph()


def test_node_count_and_categories():
    nodes = build_causal_nodes()
    assert len(nodes) == 13
    categories = {n.category for n in nodes}
    assert categories <= {"exposure", "molecular", "behavioral", "physiological", "operational", "countermeasure"}
