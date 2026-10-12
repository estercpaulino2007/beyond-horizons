"""NASA dataset ingestion (spec section 6/Step 7).

Reads a processed differential-expression CSV (the kind GeneLab/OSDR
publishes -- see docs/data-sources.md, "OSD-720 (GLDS-699)" for the real
file-naming convention this was built against), validates its columns and
types, filters differentially expressed genes (DEGs), and produces a small,
reproducible, deterministic summary.

## What this deliberately does NOT do (reconciliation issues #4/#5)

The original specification's gene-expression note annotated genes into
biological categories (inflammatory, DNA-damage, bone, muscle...) by
substring-matching gene symbols against short hardcoded lists. That was
flagged in docs/methodology.md as unreliable (`'CAT' in gene_id` matches
far more than the catalase gene) and requires a real gene-to-pathway
mapping resource this project has not verified. This module does not
attempt that. It ingests, validates, filters and summarises -- turning
processed counts into a causal-graph edge (like the ones already in
app/domain/evidence_graph.py) is a separate, human-reviewed step, not
something this pipeline does automatically.

## Column detection, not hardcoded names

GeneLab differential-expression files name their statistics columns after
the specific contrast being tested, e.g. `Log2fc_(mixed radiation)v(sham-irradiated)`
for OSD-720, but `Log2fc_(Space Flight)v(Ground Control)` for a spaceflight
study -- the contrast names differ per dataset. This module detects the
right columns by pattern (case-insensitive, tolerant of `.`/`_` variants)
rather than assuming a literal column name, and raises a clear error
listing the actual columns found if detection fails -- satisfying the
"validar colunas e tipos de arquivo" requirement without over-fitting to
one dataset's exact header text (which this project has not yet seen: see
the module docstring in docs/data-sources.md about OSD-720's real files
not having been downloaded).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

_LOG2FC_RE = re.compile(r"log2fc", re.IGNORECASE)
_PVALUE_RE = re.compile(r"p[._]?value", re.IGNORECASE)
_PADJ_RE = re.compile(r"(p[._]?adj|padj|fdr|q[._]?value)", re.IGNORECASE)

DEFAULT_PADJ_THRESHOLD = 0.05
DEFAULT_LOG2FC_THRESHOLD = 0.5


class IngestionError(ValueError):
    """Raised when the input file's columns or types don't match what a
    differential-expression file needs. Always carries a message listing
    what was actually found, so a person can fix the file or the detection
    pattern rather than guess.
    """


@dataclass(frozen=True)
class ColumnMapping:
    gene_id_col: str
    log2fc_col: str
    pvalue_col: str
    padj_col: str


def detect_columns(df: pd.DataFrame) -> ColumnMapping:
    """Finds the gene-ID, log2FC, raw-p-value and adjusted-p-value columns
    by name pattern. Raises IngestionError with the actual column list if
    any of them can't be found or are ambiguous.
    """
    if df.shape[1] < 2:
        raise IngestionError(f"expected at least 2 columns, got {list(df.columns)}")

    gene_id_col = df.columns[0]

    log2fc_matches = [c for c in df.columns if _LOG2FC_RE.search(c)]
    padj_matches = [c for c in df.columns if _PADJ_RE.search(c)]
    # A raw p-value column matches _PVALUE_RE but must NOT also match the
    # (broader) adjusted-p-value pattern, or "P.adj_(...)" would match both.
    pvalue_matches = [c for c in df.columns if _PVALUE_RE.search(c) and c not in padj_matches]

    for name, matches in (("log2FC", log2fc_matches), ("raw p-value", pvalue_matches), ("adjusted p-value", padj_matches)):
        if len(matches) == 0:
            raise IngestionError(
                f"could not find a {name} column. Columns present: {list(df.columns)}"
            )
        if len(matches) > 1:
            raise IngestionError(
                f"found more than one candidate {name} column ({matches}); this file may "
                "report more than one contrast -- select the intended column manually"
            )

    return ColumnMapping(
        gene_id_col=gene_id_col,
        log2fc_col=log2fc_matches[0],
        pvalue_col=pvalue_matches[0],
        padj_col=padj_matches[0],
    )


def load_differential_expression(path: Path) -> pd.DataFrame:
    """Reads the CSV and validates its shape and types.

    Raises IngestionError (not a raw pandas exception) for anything a
    person ingesting a new dataset needs to actually see: wrong extension,
    empty file, non-numeric statistics columns.
    """
    if path.suffix.lower() != ".csv":
        raise IngestionError(f"expected a .csv file, got {path.name!r}")
    if not path.exists():
        raise IngestionError(f"file not found: {path}")

    df = pd.read_csv(path)
    if df.empty:
        raise IngestionError(f"{path.name} has no data rows")

    mapping = detect_columns(df)
    for col in (mapping.log2fc_col, mapping.pvalue_col, mapping.padj_col):
        if not pd.api.types.is_numeric_dtype(df[col]):
            raise IngestionError(f"column {col!r} must be numeric, got dtype {df[col].dtype}")

    return df


def filter_degs(
    df: pd.DataFrame,
    mapping: ColumnMapping,
    *,
    padj_threshold: float = DEFAULT_PADJ_THRESHOLD,
    log2fc_threshold: float = DEFAULT_LOG2FC_THRESHOLD,
) -> pd.DataFrame:
    """Differentially expressed genes: padj < threshold and |log2FC| > threshold.

    These two thresholds are a standard, widely used convention in
    differential-expression analysis (not something invented for this
    project), but they are still a choice, not a fact -- callers can pass
    their own. The result is NOT re-sorted here (see summarize_degs for
    the deterministic ordering used in the summary).
    """
    return df[
        (df[mapping.padj_col] < padj_threshold) & (df[mapping.log2fc_col].abs() > log2fc_threshold)
    ].copy()


def summarize_degs(
    df: pd.DataFrame,
    degs: pd.DataFrame,
    mapping: ColumnMapping,
    *,
    padj_threshold: float,
    log2fc_threshold: float,
    top_n: int = 10,
) -> dict[str, Any]:
    """A small, deterministic, JSON-serialisable summary -- not the full
    gene list (which stays in the CSV/dataframe, not duplicated here).
    """
    up = degs[degs[mapping.log2fc_col] > 0].sort_values(
        by=[mapping.log2fc_col, mapping.gene_id_col], ascending=[False, True]
    )
    down = degs[degs[mapping.log2fc_col] < 0].sort_values(
        by=[mapping.log2fc_col, mapping.gene_id_col], ascending=[True, True]
    )

    def _top(rows: pd.DataFrame) -> list[dict[str, Any]]:
        return [
            {
                "gene_id": row[mapping.gene_id_col],
                "log2fc": round(float(row[mapping.log2fc_col]), 4),
                "padj": float(row[mapping.padj_col]),
            }
            for _, row in rows.head(top_n).iterrows()
        ]

    return {
        "total_genes": int(len(df)),
        "deg_count": int(len(degs)),
        "deg_fraction": round(len(degs) / len(df), 4) if len(df) else 0.0,
        "padj_threshold": padj_threshold,
        "log2fc_threshold": log2fc_threshold,
        "direction_counts": {"up": int(len(up)), "down": int(len(down))},
        "top_upregulated": _top(up),
        "top_downregulated": _top(down),
        "notes": (
            "DEG status (padj < threshold, |log2FC| > threshold) is a statistical "
            "association observed in this processed dataset (data_supported_association), "
            "not a causal or clinical claim. Connecting any of these genes to a physiological "
            "risk in the evidence graph (app/domain/evidence_graph.py) is a separate, "
            "human-reviewed step -- this summary does not do that automatically."
        ),
    }


@dataclass(frozen=True)
class IngestionResult:
    mapping: ColumnMapping
    summary: dict[str, Any]


def ingest_differential_expression(
    path: Path,
    *,
    padj_threshold: float = DEFAULT_PADJ_THRESHOLD,
    log2fc_threshold: float = DEFAULT_LOG2FC_THRESHOLD,
) -> IngestionResult:
    df = load_differential_expression(path)
    mapping = detect_columns(df)
    degs = filter_degs(df, mapping, padj_threshold=padj_threshold, log2fc_threshold=log2fc_threshold)
    summary = summarize_degs(
        df, degs, mapping, padj_threshold=padj_threshold, log2fc_threshold=log2fc_threshold
    )
    return IngestionResult(mapping=mapping, summary=summary)
