"""Tests for the ingestion pipeline (Prompt 7).

Uses tests/fixtures/synthetic_test_fixture_differential_expression.csv --
NOT real data from any NASA dataset (this project never obtained OSD-720's
actual processed files; see tests/fixtures/README.md and
docs/data-sources.md). It only mimics GeneLab's real column-naming
convention so the parser can be tested against realistic headers.
"""

from datetime import date
from pathlib import Path

import pandas as pd
import pytest
from pydantic import ValidationError

from app.services.ingestion import (
    ColumnMapping,
    IngestionError,
    detect_columns,
    filter_degs,
    ingest_differential_expression,
    load_differential_expression,
    summarize_degs,
)
from app.services.provenance import build_evidence_record

FIXTURE = Path(__file__).parent / "fixtures" / "synthetic_test_fixture_differential_expression.csv"


def test_detect_columns_finds_the_geneLab_style_headers():
    df = load_differential_expression(FIXTURE)
    mapping = detect_columns(df)
    assert mapping.gene_id_col == "gene_id"
    assert mapping.log2fc_col == "Log2fc_(mixed radiation)v(sham-irradiated)"
    assert mapping.pvalue_col == "P.value_(mixed radiation)v(sham-irradiated)"
    assert mapping.padj_col == "P.adj_(mixed radiation)v(sham-irradiated)"


def test_detect_columns_rejects_missing_log2fc_column():
    df = pd.DataFrame({"gene_id": ["a"], "P.value_(x)v(y)": [0.01], "P.adj_(x)v(y)": [0.02]})
    with pytest.raises(IngestionError, match="log2FC"):
        detect_columns(df)


def test_detect_columns_rejects_ambiguous_log2fc_columns():
    df = pd.DataFrame(
        {
            "gene_id": ["a"],
            "Log2fc_(x)v(y)": [1.0],
            "Log2fc_(x)v(z)": [1.0],
            "P.value_(x)v(y)": [0.01],
            "P.adj_(x)v(y)": [0.02],
        }
    )
    with pytest.raises(IngestionError, match="more than one candidate log2FC"):
        detect_columns(df)


def test_load_rejects_non_csv_extension(tmp_path):
    bad = tmp_path / "data.txt"
    bad.write_text("gene_id,Log2fc_(x)v(y)\n")
    with pytest.raises(IngestionError, match=r"\.csv"):
        load_differential_expression(bad)


def test_load_rejects_missing_file(tmp_path):
    with pytest.raises(IngestionError, match="not found"):
        load_differential_expression(tmp_path / "nope.csv")


def test_load_rejects_empty_file(tmp_path):
    empty = tmp_path / "empty.csv"
    empty.write_text("gene_id,Log2fc_(x)v(y),P.value_(x)v(y),P.adj_(x)v(y)\n")
    with pytest.raises(IngestionError, match="no data rows"):
        load_differential_expression(empty)


def test_load_rejects_non_numeric_statistics_column(tmp_path):
    bad = tmp_path / "bad.csv"
    bad.write_text(
        "gene_id,Log2fc_(x)v(y),P.value_(x)v(y),P.adj_(x)v(y)\n"
        "g1,not_a_number,0.01,0.02\n"
    )
    with pytest.raises(IngestionError, match="must be numeric"):
        load_differential_expression(bad)


def test_filter_degs_applies_both_thresholds():
    df = load_differential_expression(FIXTURE)
    mapping = detect_columns(df)
    degs = filter_degs(df, mapping, padj_threshold=0.05, log2fc_threshold=0.5)
    # From the fixture: rows with padj<0.05 AND |log2fc|>0.5
    assert set(degs["gene_id"]) == {
        "ENSMUSG00000000001",
        "ENSMUSG00000000002",
        "ENSMUSG00000000004",
        "ENSMUSG00000000007",
        "ENSMUSG00000000008",
        "ENSMUSG00000000009",
    }


def test_summarize_degs_is_deterministic_and_bounded():
    df = load_differential_expression(FIXTURE)
    mapping = detect_columns(df)
    degs = filter_degs(df, mapping)
    first = summarize_degs(df, degs, mapping, padj_threshold=0.05, log2fc_threshold=0.5)
    second = summarize_degs(df, degs, mapping, padj_threshold=0.05, log2fc_threshold=0.5)
    assert first == second
    assert first["deg_count"] == len(degs)
    assert first["total_genes"] == len(df)
    assert 0.0 <= first["deg_fraction"] <= 1.0
    assert "not a causal or clinical claim" in first["notes"]


def test_summarize_degs_top_lists_are_sorted_by_magnitude():
    df = load_differential_expression(FIXTURE)
    mapping = detect_columns(df)
    degs = filter_degs(df, mapping)
    summary = summarize_degs(df, degs, mapping, padj_threshold=0.05, log2fc_threshold=0.5)
    up_values = [g["log2fc"] for g in summary["top_upregulated"]]
    assert up_values == sorted(up_values, reverse=True)
    down_values = [g["log2fc"] for g in summary["top_downregulated"]]
    assert down_values == sorted(down_values)


def test_ingest_differential_expression_end_to_end():
    result = ingest_differential_expression(FIXTURE)
    assert result.summary["total_genes"] == 10
    assert result.summary["deg_count"] == 6
    assert result.mapping.gene_id_col == "gene_id"


def test_ingest_is_deterministic():
    first = ingest_differential_expression(FIXTURE)
    second = ingest_differential_expression(FIXTURE)
    assert first.summary == second.summary
    assert first.mapping == second.mapping


# --- provenance -------------------------------------------------------

def test_build_evidence_record_accepts_a_verified_dataset():
    record = build_evidence_record(
        source_type="nasa_dataset",
        dataset_id="OSD-720",
        source_url="https://osdr.nasa.gov/bio/repo/data/studies/OSD-720",
        organism="Mus musculus",
        tissue="Left ventricle",
        condition="ground_based_simulated_radiation",
        analysis_method="RNA-Seq, GeneLab standard processing",
        limitations=["Ground-based simulated radiation, not spaceflight"],
        accessed_at=date(2026, 9, 24),
    )
    assert record.dataset_id == "OSD-720"


def test_build_evidence_record_rejects_unverified_dataset():
    with pytest.raises(ValidationError, match="verified-source registry"):
        build_evidence_record(
            source_type="nasa_dataset",
            dataset_id="GLDS-473",
            source_url="https://example.com/fake",
            organism="Mus musculus",
            tissue=None,
            condition="spaceflight",
            analysis_method=None,
            limitations=["test"],
            accessed_at=date(2026, 9, 24),
        )


def test_build_evidence_record_requires_limitations():
    with pytest.raises(ValidationError):
        build_evidence_record(
            source_type="nasa_dataset",
            dataset_id="OSD-720",
            source_url="https://osdr.nasa.gov/bio/repo/data/studies/OSD-720",
            organism="Mus musculus",
            tissue="Left ventricle",
            condition="ground_based_simulated_radiation",
            analysis_method=None,
            limitations=[],
            accessed_at=date(2026, 9, 24),
        )
