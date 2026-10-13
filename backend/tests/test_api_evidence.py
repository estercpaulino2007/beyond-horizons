from fastapi.testclient import TestClient

from app.core.notices import SIMULATION_DISCLAIMER, SYNTHETIC_DATA_NOTICE_EN
from app.main import app

client = TestClient(app)


def test_get_evidence_graph_returns_cytoscape_shape():
    response = client.get("/api/v1/evidence/graph")
    assert response.status_code == 200
    data = response.json()

    assert "nodes" in data["elements"]
    assert "edges" in data["elements"]
    assert len(data["elements"]["nodes"]) == 14
    assert len(data["elements"]["edges"]) == 13

    for node in data["elements"]["nodes"]:
        d = node["data"]
        assert {"id", "label", "category", "description"} <= set(d)

    for edge in data["elements"]["edges"]:
        d = edge["data"]
        assert {"id", "source", "target", "relation", "evidence_level", "uncertainty", "limitations"} <= set(d)
        assert d["id"] == f"{d['source']}->{d['target']}"


def test_evidence_graph_has_the_disclaimer_and_legend():
    response = client.get("/api/v1/evidence/graph")
    data = response.json()
    assert data["disclaimer"] == SIMULATION_DISCLAIMER
    assert data["synthetic_data_notice"] == SYNTHETIC_DATA_NOTICE_EN
    assert set(data["evidence_level_legend"]) == {
        "supported_evidence",
        "data_supported_association",
        "exploratory_hypothesis",
        "synthetic_parameter",
    }


def test_evidence_graph_node_ids_cover_every_edge_endpoint():
    response = client.get("/api/v1/evidence/graph")
    data = response.json()
    node_ids = {n["data"]["id"] for n in data["elements"]["nodes"]}
    for edge in data["elements"]["edges"]:
        assert edge["data"]["source"] in node_ids
        assert edge["data"]["target"] in node_ids


def test_openapi_documents_the_evidence_endpoint():
    schema = client.get("/openapi.json").json()
    assert "/api/v1/evidence/graph" in schema["paths"]


def test_gene_expression_endpoint_returns_real_table_data():
    response = client.get("/api/v1/evidence/gene-expression")
    assert response.status_code == 200
    data = response.json()

    assert data["evidence_reference"] == "NAG9-1024"
    assert "Burns" in data["study_citation"]
    assert len(data["limitations"]) > 0
    assert len(data["records"]) == 8

    keratin14 = next(r for r in data["records"] if r["accession"] == "D63774")
    assert keratin14["control"] == 4758
    assert keratin14["dose_9gy"] == 55945
    # fold_change_9gy_vs_control is a computed field: 55945 / 4758, rounded to 1dp
    assert keratin14["fold_change_9gy_vs_control"] == 11.8

    beta_defensin = next(r for r in data["records"] if r["accession"] == "AF068861")
    assert beta_defensin["control"] == 0
    # Division by zero is reported as None, never fabricated
    assert beta_defensin["fold_change_9gy_vs_control"] is None

    assert data["disclaimer"] == SIMULATION_DISCLAIMER
    assert data["synthetic_data_notice"] == SYNTHETIC_DATA_NOTICE_EN
