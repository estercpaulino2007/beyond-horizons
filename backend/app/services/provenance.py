"""Provenance: builds the EvidenceRecord for one ingested dataset (spec
section 6, "Regras de proveniência").

This is a thin, deliberate wrapper around the EvidenceRecord schema
(app/schemas/evidence.py) rather than new logic: the schema itself already
enforces every rule this function exists to apply (source_url required for
nasa_dataset/nasa_report, dataset_id must be in the verified registry,
limitations must be non-empty). Ingestion code should always go through
this function rather than constructing EvidenceRecord directly, so there
is exactly one place in the ingestion path that documents *why* those
rules exist.
"""

from __future__ import annotations

from datetime import date

from app.schemas.evidence import Condition, EvidenceRecord
from app.schemas.common import SourceType


def build_evidence_record(
    *,
    source_type: SourceType,
    dataset_id: str | None,
    source_url: str | None,
    organism: str | None,
    tissue: str | None,
    condition: Condition,
    analysis_method: str | None,
    limitations: list[str],
    accessed_at: date,
) -> EvidenceRecord:
    """Registers one dataset's provenance.

    Raises pydantic.ValidationError (via EvidenceRecord) if:
      - source_type is nasa_dataset/nasa_report and source_url is missing;
      - source_type is nasa_dataset/nasa_report and dataset_id is not a key
        in app/core/evidence_registry.py (i.e. not actually verified and
        written up in docs/data-sources.md);
      - limitations is empty.

    These are not this function's own checks -- they are EvidenceRecord's,
    inherited here so every ingestion path uses them automatically.
    """
    return EvidenceRecord(
        source_type=source_type,
        dataset_id=dataset_id,
        source_url=source_url,
        organism=organism,
        tissue=tissue,
        condition=condition,
        analysis_method=analysis_method,
        limitations=limitations,
        accessed_at=accessed_at,
    )
