"""Registry of sources this project has actually verified.

This is the code-level enforcement of the project's core rule ("do not invent
data"): a CausalEdge (see app/schemas/causal_graph.py) may only claim
`supported_evidence` or `data_supported_association` if its `evidence_reference`
points at something registered here. Every entry must have a matching, human-
readable entry in docs/data-sources.md — this file is a short index into that
document, not a replacement for it.

When a new source is verified (a page opened, a file checked), add it here
AND write it up in docs/data-sources.md in the same step. Do not add a key
here "in advance" of actually checking the source.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class VerifiedSource:
    key: str  # short token; CausalEdge.evidence_reference must start with this
    label: str  # human-readable name, shown in error messages
    docs_anchor: str  # heading in docs/data-sources.md to look up for detail


# Keep this list in the same order as docs/data-sources.md.
VERIFIED_SOURCES: tuple[VerifiedSource, ...] = (
    VerifiedSource(
        key="OSD-720",
        label="OSD-720 / GLDS-699 (cardiac transcriptome, ground-based simulated radiation)",
        docs_anchor="OSD-720 (GLDS-699)",
    ),
    VerifiedSource(
        key="GLDS-699",
        label="GLDS-699 (same study as OSD-720)",
        docs_anchor="OSD-720 (GLDS-699)",
    ),
    VerifiedSource(
        key="AINV0000000837",
        label="Hughes-Fulford osteoblast microgravity data (LSDA AINV0000000837)",
        docs_anchor="AINV0000000837",
    ),
    VerifiedSource(
        key="AINV0000000839",
        label="Hughes-Fulford osteoblast microgravity data (LSDA AINV0000000839, duplicate of AINV0000000837)",
        docs_anchor="AINV0000000837",
    ),
    VerifiedSource(
        key="NAG9-1024",
        label="Burns et al. radiation-induced skin cancer + retinoid countermeasure (NASA grant NAG9-1024)",
        docs_anchor="NAG9-1024",
    ),
    VerifiedSource(
        key="HRP-BEHAVIORAL-HEALTH",
        label="NASA HRP Behavioral Health risk (cognitive/behavioral), cross-checked against NTRS 20250001454",
        docs_anchor="NASA HRP risk pages",
    ),
    VerifiedSource(
        key="HRP-RADIATION-CARCINOGENESIS",
        label="NASA HRP Radiation Carcinogenesis risk",
        docs_anchor="NASA HRP risk pages",
    ),
    VerifiedSource(
        key="HRP-MICROHOST",
        label="NASA HRP Host-Microorganism Interactions risk (out of MVP scope, kept for future use)",
        docs_anchor="NASA HRP risk pages",
    ),
    VerifiedSource(
        key="HRP-BONE-RISK",
        label="NASA HHP Bone Risk reference page + 2017/2024 Bone Fracture evidence reports (NTRS 20170004597, 20240005190)",
        docs_anchor="HRP-BONE-RISK",
    ),
    VerifiedSource(
        key="HRP-MUSCLE-RISK",
        label="NASA HHP Muscle Risk reference page (reduced muscle size/strength/endurance)",
        docs_anchor="HRP-MUSCLE-RISK",
    ),
    VerifiedSource(
        key="HRP-EVA-RISK",
        label="NASA HHP EVA Operations Risk reference page (injury/performance/long-term health)",
        docs_anchor="HRP-EVA-RISK",
    ),
)


def is_verified_reference(evidence_reference: str) -> bool:
    """True if evidence_reference names a source this project has actually checked."""
    ref = evidence_reference.strip().casefold()
    return any(ref.startswith(src.key.casefold()) for src in VERIFIED_SOURCES)


def verified_keys() -> list[str]:
    return [src.key for src in VERIFIED_SOURCES]
