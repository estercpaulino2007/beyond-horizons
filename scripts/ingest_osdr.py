#!/usr/bin/env python3
"""CLI: ingest one NASA/GeneLab processed differential-expression CSV.

Usage (a file you already downloaded):
    python scripts/ingest_osdr.py \
        --input path/to/GLDS-699_rna_seq_differential_expression_GLbulkRNAseq.csv \
        --dataset-id OSD-720 \
        --source-url https://osdr.nasa.gov/bio/repo/data/studies/OSD-720 \
        --organism "Mus musculus" --tissue "Left ventricle" \
        --condition ground_based_simulated_radiation \
        --analysis-method "RNA-Seq, GeneLab standard processing (STAR/RSEM)" \
        --limitation "Ground-based simulated radiation, not spaceflight" \
        --limitation "Mouse, not human"

Usage (download first, from a URL you provide):
    python scripts/ingest_osdr.py --url https://.../some_file.csv --dataset-id ... [same flags]

This script never picks a dataset, a URL, or a file on its own -- per the
project's rule (docs/architecture.md, "Data"), nothing is downloaded or
ingested without an explicit --input or --url from the person running it.
`--dataset-id` must be a key already registered in
backend/app/core/evidence_registry.py (and written up in
docs/data-sources.md); this is enforced by EvidenceRecord itself
(backend/app/schemas/evidence.py), not by this script.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

from pydantic import ValidationError

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.schemas.evidence import Condition  # noqa: E402
from app.services.ingestion import (  # noqa: E402
    DEFAULT_LOG2FC_THRESHOLD,
    DEFAULT_PADJ_THRESHOLD,
    IngestionError,
    ingest_differential_expression,
)
from app.services.provenance import build_evidence_record  # noqa: E402

CONDITIONS: tuple[str, ...] = Condition.__args__  # type: ignore[attr-defined]


def _download(url: str, dataset_id: str) -> Path:
    dest_dir = REPO_ROOT / "data" / "raw" / dataset_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = url.rstrip("/").rsplit("/", 1)[-1] or "downloaded.csv"
    dest = dest_dir / filename
    print(f"Downloading {url} -> {dest.relative_to(REPO_ROOT)}")
    urllib.request.urlretrieve(url, dest)  # noqa: S310 (explicit, user-provided URL only)
    return dest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="Path to an already-downloaded CSV file")
    source.add_argument("--url", type=str, help="URL to download the CSV from (only fetched if given explicitly)")

    parser.add_argument("--dataset-id", required=True, help="Must be a key in app/core/evidence_registry.py")
    parser.add_argument("--source-url", required=True, help="The NASA study/report page URL")
    parser.add_argument("--organism", default=None)
    parser.add_argument("--tissue", default=None)
    parser.add_argument("--condition", required=True, choices=CONDITIONS)
    parser.add_argument("--analysis-method", default=None)
    parser.add_argument(
        "--limitation", action="append", required=True,
        help="Repeatable; give at least one real limitation of this dataset/analysis",
    )
    parser.add_argument(
        "--accessed-at", type=str, default=None,
        help="YYYY-MM-DD; defaults to today (the date this script actually runs)",
    )
    parser.add_argument("--padj-threshold", type=float, default=DEFAULT_PADJ_THRESHOLD)
    parser.add_argument("--log2fc-threshold", type=float, default=DEFAULT_LOG2FC_THRESHOLD)
    parser.add_argument(
        "--output", type=Path, default=None,
        help="Where to write the result JSON (default: data/processed/<dataset-id>_ingestion.json)",
    )
    args = parser.parse_args()

    csv_path = args.input if args.input else _download(args.url, args.dataset_id)

    accessed_at = date.fromisoformat(args.accessed_at) if args.accessed_at else date.today()

    try:
        result = ingest_differential_expression(
            csv_path, padj_threshold=args.padj_threshold, log2fc_threshold=args.log2fc_threshold
        )
    except IngestionError as exc:
        print(f"Ingestion failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    try:
        evidence = build_evidence_record(
            source_type="nasa_dataset",
            dataset_id=args.dataset_id,
            source_url=args.source_url,
            organism=args.organism,
            tissue=args.tissue,
            condition=args.condition,
            analysis_method=args.analysis_method,
            limitations=args.limitation,
            accessed_at=accessed_at,
        )
    except ValidationError as exc:
        print("Could not register this dataset's provenance:", file=sys.stderr)
        for error in exc.errors():
            print(f"  - {error['msg']}", file=sys.stderr)
        raise SystemExit(1) from exc

    output_path = args.output or (REPO_ROOT / "data" / "processed" / f"{args.dataset_id}_ingestion.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_file": str(csv_path.relative_to(REPO_ROOT)) if REPO_ROOT in csv_path.parents else str(csv_path),
        "evidence": evidence.model_dump(mode="json"),
        "column_mapping": {
            "gene_id_col": result.mapping.gene_id_col,
            "log2fc_col": result.mapping.log2fc_col,
            "pvalue_col": result.mapping.pvalue_col,
            "padj_col": result.mapping.padj_col,
        },
        "summary": result.summary,
    }
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Ingested {csv_path.name}: {result.summary['deg_count']}/{result.summary['total_genes']} DEGs")
    print(f"Wrote: {output_path.relative_to(REPO_ROOT) if REPO_ROOT in output_path.parents else output_path}")
    print("Reminder: DEG status is a statistical association, not a causal or clinical claim (see summary.notes).")


if __name__ == "__main__":
    main()
