"""Table 1 from Burns FJ, Chen S, Xu G, Wu F, Tang MS (2002), "The Action of
a Dietary Retinoid on Gene Expression and Cancer Induction in
Electron-irradiated Rat Skin", J Radiat Res 43(Suppl):S229-S232 -- the
published paper behind this project's NAG9-1024 evidence-registry entry
(see docs/data-sources.md and docs/source-material/nag9-1024/).

Every number below is transcribed verbatim from that table (normalized
Affymetrix fluorescence units); nothing here is estimated, interpolated or
generated. This is a small, fixed set of genes from ONE study (rat skin,
ground-based electron irradiation, 24h post-exposure) -- not a general
"radiation dose -> gene mutation" model. See GeneExpressionRecord's
docstring and this project's evidence_graph.py for why no such general
model is offered.
"""

from app.schemas.gene_expression import GeneExpressionRecord, GeneExpressionTableResponse

STUDY_CITATION = (
    "Burns FJ, Chen S, Xu G, Wu F, Tang MS (2002). The Action of a Dietary Retinoid on Gene "
    "Expression and Cancer Induction in Electron-irradiated Rat Skin. J Radiat Res 43(Suppl):S229-S232."
)

_LIMITATIONS = [
    "Rat skin, not human or astronaut tissue.",
    "Ground-based electron irradiation (ground accelerator), not spaceflight radiation.",
    "Single timepoint (24 hours post-exposure) -- not a trajectory over a mission.",
    "Gene expression change (how much a gene's activity went up or down), not a mutation -- "
    "this study did not sequence DNA for mutations, and this project has no mutation-level "
    "data for any gene.",
    "8740 genes were on the array; these are the ones the paper itself highlighted as most "
    "strongly altered -- not an exhaustive list of every gene radiation affects.",
]


def _records() -> list[GeneExpressionRecord]:
    return [
        GeneExpressionRecord(
            gene_symbol="Krt14 (keratin 14)",
            accession="D63774",
            gene_description="Rat n. mRNA for keratin 14",
            category="reversal_response",
            control=4758, vitamin_a_alone=4162, dose_9gy=55945, dose_9gy_plus_vitamin_a=8190, dose_18gy=21710,
        ),
        GeneExpressionRecord(
            gene_symbol="MRP14",
            accession="L18948",
            gene_description="Intracellular calcium-binding protein (MRP14)",
            category="reversal_response",
            control=42, vitamin_a_alone=593, dose_9gy=18930, dose_9gy_plus_vitamin_a=1250, dose_18gy=24441,
        ),
        GeneExpressionRecord(
            gene_symbol="Beta defensin-2",
            accession="AF068861",
            gene_description="Rat n. beta defensin-2",
            category="reversal_response",
            control=0, vitamin_a_alone=0, dose_9gy=4060, dose_9gy_plus_vitamin_a=0, dose_18gy=4038,
        ),
        GeneExpressionRecord(
            gene_symbol="SCC antigen 2 homolog",
            accession="rx04836",
            gene_description="Clone rx04836, homologous to mouse SCC antigen 2",
            category="reversal_response",
            control=1413, vitamin_a_alone=2424, dose_9gy=31193, dose_9gy_plus_vitamin_a=14018, dose_18gy=25887,
        ),
        GeneExpressionRecord(
            gene_symbol="CRBPII",
            accession="M13949",
            gene_description="Cellular retinol binding protein II (CRBPII)",
            category="reversal_response",
            control=1369, vitamin_a_alone=2052, dose_9gy=22428, dose_9gy_plus_vitamin_a=11509, dose_18gy=11433,
        ),
        GeneExpressionRecord(
            gene_symbol="Calcium-binding protein 8 homolog",
            accession="AA957003",
            gene_description="Homologous to calcium-binding protein 8",
            category="reversal_response",
            control=5817, vitamin_a_alone=3764, dose_9gy=21478, dose_9gy_plus_vitamin_a=4049, dose_18gy=25728,
        ),
        GeneExpressionRecord(
            gene_symbol="Involucrin",
            accession="L28818",
            gene_description="Rat n. involucrin gene (RATINVO)",
            category="additive_response",
            control=1848, vitamin_a_alone=5388, dose_9gy=3232, dose_9gy_plus_vitamin_a=8916, dose_18gy=3317,
        ),
        GeneExpressionRecord(
            gene_symbol="ODC",
            accession="J04792",
            gene_description="Ornithine decarboxylase (ODC) gene",
            category="additive_response",
            control=4037, vitamin_a_alone=1990, dose_9gy=3700, dose_9gy_plus_vitamin_a=1228, dose_18gy=4569,
        ),
    ]


def get_gene_expression_table(disclaimer: str, synthetic_data_notice: str) -> GeneExpressionTableResponse:
    return GeneExpressionTableResponse(
        study_citation=STUDY_CITATION,
        organism="Rat (Rattus norvegicus)",
        tissue="Dorsal skin",
        radiation_condition="9 Gy or 18 Gy electron irradiation, with/without a 300 ppm dietary retinyl acetate (vitamin A) supplement",
        timepoint="24 hours post-irradiation",
        evidence_reference="NAG9-1024",
        limitations=list(_LIMITATIONS),
        records=_records(),
        disclaimer=disclaimer,
        synthetic_data_notice=synthetic_data_notice,
    )
