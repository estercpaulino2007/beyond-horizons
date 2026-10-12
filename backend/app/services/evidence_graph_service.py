"""Converts the NetworkX evidence graph (app.domain.evidence_graph) into
Cytoscape.js-compatible JSON (spec section 15, GET /api/v1/evidence/graph).
"""

from __future__ import annotations

import networkx as nx

from app.schemas.api import CytoscapeEdgeElement, CytoscapeNodeElement, EvidenceGraphElements


def to_cytoscape_elements(graph: nx.DiGraph) -> EvidenceGraphElements:
    nodes = [CytoscapeNodeElement(data=dict(graph.nodes[node_id])) for node_id in graph.nodes]

    edges = []
    for source, target, data in graph.edges(data=True):
        edge_data = {"id": f"{source}->{target}", **data}
        edges.append(CytoscapeEdgeElement(data=edge_data))

    return EvidenceGraphElements(nodes=nodes, edges=edges)
