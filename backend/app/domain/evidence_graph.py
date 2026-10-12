"""The evidence causal graph (spec section 10), built with NetworkX.

## Why this graph is smaller than the specification's own example

The specification's data-package document includes a fuller evidence_graph.json
with many edges marked supported_evidence/data_supported_association, citing
sources such as "NASA HRP Evidence Report - Bone", "NASA HRP Evidence Report -
Cog", and datasets GLDS-473/GLDS-388. None of those citations are in
app/core/evidence_registry.py, because none of them were ever actually
verified (docs/data-sources.md marks them "Unverified"; the Bone and
Cardiovascular reports are blocked by the source site's anti-automation
protection, and GLDS-473/388 were never found under those IDs).

CausalEdge's own validator (app/schemas/causal_graph.py) enforces this
project's core rule at construction time: an edge cannot claim
supported_evidence or data_supported_association unless its
evidence_reference names a verified source. So this graph is built only
from what is actually registered -- OSD-720/GLDS-699, AINV0000000837 (the
Hughes-Fulford osteoblast data), NAG9-1024, the HRP Behavioral Health risk
page, and the HRP Bone, Muscle and EVA Operations risk reference pages
(added after a second search pass specifically looking for concrete,
accessible sources for the edges that started out as exploratory_hypothesis
-- see docs/data-sources.md) -- and every edge this project cannot back
with one of those is honestly labelled exploratory_hypothesis instead. A
smaller, honestly evidenced graph is the point of this project, not a
shortcoming of it.
"""

from __future__ import annotations

import networkx as nx

from app.schemas.causal_graph import CausalEdge, CausalNode


def build_causal_nodes() -> list[CausalNode]:
    return [
        CausalNode(
            id="radiation_exposure",
            label="Radiation Exposure",
            category="exposure",
            description="Cumulative and acute radiation exposure during the mission.",
        ),
        CausalNode(
            id="dna_damage_response",
            label="DNA Damage Response",
            category="molecular",
            description="Cellular response to DNA damage, including repair pathways.",
        ),
        CausalNode(
            id="inflammatory_signaling",
            label="Inflammatory Signaling",
            category="molecular",
            description="Systemic inflammatory markers and cytokine activity.",
        ),
        CausalNode(
            id="sleep_debt",
            label="Sleep Debt",
            category="behavioral",
            description="Accumulated sleep deficit relative to an individual's baseline need.",
        ),
        CausalNode(
            id="cognitive_load",
            label="Cognitive Load",
            category="behavioral",
            description="Mental workload from tasks, stress and environmental factors.",
        ),
        CausalNode(
            id="cognitive_performance_risk",
            label="Cognitive Performance Risk",
            category="operational",
            description="Risk of impaired cognitive performance affecting mission tasks.",
        ),
        CausalNode(
            id="microgravity",
            label="Microgravity",
            category="exposure",
            description="Prolonged exposure to the microgravity environment.",
        ),
        CausalNode(
            id="bone_remodeling_alteration",
            label="Bone Remodeling Alteration",
            category="physiological",
            description="Changes in bone formation and resorption balance.",
        ),
        CausalNode(
            id="bone_loss_risk",
            label="Bone Loss Risk",
            category="physiological",
            description="Risk of clinically significant bone mineral density loss.",
        ),
        CausalNode(
            id="exercise_availability",
            label="Exercise Availability",
            category="countermeasure",
            description="Access to resistance and aerobic exercise equipment.",
        ),
        CausalNode(
            id="muscle_recovery",
            label="Muscle Recovery",
            category="physiological",
            description="Ability to recover from physical exertion and maintain muscle mass.",
        ),
        CausalNode(
            id="eva_load",
            label="EVA Load",
            category="operational",
            description="Physical and cognitive demands of extravehicular activity.",
        ),
        CausalNode(
            id="operational_error_risk",
            label="Operational Error Risk",
            category="operational",
            description="Risk of human error affecting mission success or safety.",
        ),
    ]


def build_causal_edges() -> list[CausalEdge]:
    return [
        # --- Backed by verified sources (data_supported_association / supported_evidence) ---
        CausalEdge(
            source="radiation_exposure",
            target="dna_damage_response",
            relation="increases",
            weight=0.75,
            evidence_level="data_supported_association",
            uncertainty=0.30,
            evidence_reference=(
                "OSD-720 (GLDS-699, cardiac transcriptome, ground-based simulated radiation) "
                "and NAG9-1024 (rat skin, ground-based radiation + retinoid countermeasure)"
            ),
            limitations=[
                "Ground-based simulated/accelerator radiation, not spaceflight",
                "Cardiac (OSD-720) and skin (NAG9-1024) tissue only; not verified for other tissues",
                "Animal models (mouse, rat), not human",
            ],
        ),
        CausalEdge(
            source="dna_damage_response",
            target="inflammatory_signaling",
            relation="triggers",
            weight=0.65,
            evidence_level="data_supported_association",
            uncertainty=0.30,
            evidence_reference=(
                "NAG9-1024: radiation altered stress-response, immune/inflammation and "
                "DNA-repair gene expression in irradiated rat skin"
            ),
            limitations=[
                "Rat skin, ground-based accelerator radiation only",
                "Association observed in gene expression data, not a demonstrated mechanism in humans",
            ],
        ),
        CausalEdge(
            source="sleep_debt",
            target="cognitive_load",
            relation="increases",
            weight=0.75,
            evidence_level="supported_evidence",
            uncertainty=0.20,
            evidence_reference="HRP-BEHAVIORAL-HEALTH: risk page cites sleep/performance studies (gap BMed-101)",
            limitations=[
                "Official NASA risk-page summary, not a specific quantitative effect size",
                "Individual variability in sleep resilience is not modelled here",
            ],
        ),
        CausalEdge(
            source="cognitive_load",
            target="cognitive_performance_risk",
            relation="increases",
            weight=0.80,
            evidence_level="supported_evidence",
            uncertainty=0.18,
            evidence_reference="HRP-BEHAVIORAL-HEALTH: risk statement links cognitive/behavioral stressors to in-mission performance",
            limitations=[
                "General risk framing from the official risk page, not a specific dose-response curve",
            ],
        ),
        CausalEdge(
            source="microgravity",
            target="bone_remodeling_alteration",
            relation="alters",
            weight=0.80,
            evidence_level="supported_evidence",
            uncertainty=0.20,
            evidence_reference=(
                "AINV0000000837: Hughes-Fulford osteoblast microgravity gene-expression data "
                "(Shuttle Biorack, STS-76/81/84), backed by 4 peer-reviewed papers"
            ),
            limitations=[
                "Cell culture (MC3T3-E1 osteoblasts), not intact bone or a whole organism",
                "Short spaceflight exposure (hours), not a multi-month mission",
            ],
        ),
        CausalEdge(
            source="bone_remodeling_alteration",
            target="bone_loss_risk",
            relation="increases",
            weight=0.80,
            evidence_level="supported_evidence",
            uncertainty=0.25,
            evidence_reference=(
                "HRP-BONE-RISK: NASA reference page and 2017/2024 evidence reports (NTRS 20170004597, "
                "20240005190) -- astronauts lose 1-1.5% of bone density per month during 4-6 month missions"
            ),
            limitations=[
                "Population-level astronaut DXA-scan data, not the specific Ares-180 crew",
                "The source itself says it is unclear whether bone density stabilises or keeps "
                "declining on missions longer than 4-6 months (Ares-180 is 180 days)",
            ],
        ),
        CausalEdge(
            source="exercise_availability",
            target="muscle_recovery",
            relation="improves",
            weight=0.75,
            evidence_level="supported_evidence",
            uncertainty=0.25,
            evidence_reference=(
                "HRP-MUSCLE-RISK: NASA reference page -- ISS crew who adhere to the exercise schedule "
                "with adequate countermeasure equipment return with only minimal losses of muscle "
                "size, strength and endurance"
            ),
            limitations=[
                "The 'minimal losses' finding is tied to ISS-era exercise hardware; the source itself "
                "flags that exploration-mission hardware may not have the same capability",
                "No specific quantitative effect size is given (this engine's rate constants remain synthetic_parameter)",
            ],
        ),
        CausalEdge(
            source="eva_load",
            target="operational_error_risk",
            relation="increases",
            weight=0.55,
            evidence_level="supported_evidence",
            uncertainty=0.40,
            evidence_reference=(
                "HRP-EVA-RISK: NASA formally tracks a Risk of Mission Impacting Injury and Compromised "
                "Performance due to EVA Operations"
            ),
            limitations=[
                "The source page itself states that injury mechanisms and individual risk factors "
                "(sex, anthropometry, fitness) are not yet understood -- this edge claims only that "
                "EVA carries a recognized risk, not a specific mechanism or effect size",
                "Planetary (non-microgravity) EVA physiological demands are characterised only for a "
                "limited number of Lunar/Mars analogue sites per the source",
            ],
        ),
        # --- Not independently verified: exploratory_hypothesis ---
        CausalEdge(
            source="radiation_exposure",
            target="cognitive_performance_risk",
            relation="increases",
            weight=0.45,
            evidence_level="exploratory_hypothesis",
            uncertainty=0.55,
            evidence_reference=(
                "Scenario hypothesis, informed by HRP-BEHAVIORAL-HEALTH gap BMed-102 (radiation/CNS "
                "effects on cognition, an open research gap per that page, largely animal-studied)"
            ),
            limitations=[
                "Human evidence for radiation's cognitive effects is limited (an open gap per the source page)",
                "Not independently verified against a specific dataset in this project",
            ],
        ),
        CausalEdge(
            source="eva_load",
            target="muscle_recovery",
            relation="decreases",
            weight=0.50,
            evidence_level="exploratory_hypothesis",
            uncertainty=0.50,
            evidence_reference="Scenario hypothesis based on general EVA physical-demand framing",
            limitations=[
                "HRP-EVA-RISK (verified) covers injury/performance risk broadly, not specifically "
                "EVA's effect on muscle-recovery capacity",
                "No specific verified NASA source ties EVA load directly to muscle-recovery decline",
            ],
        ),
        CausalEdge(
            source="muscle_recovery",
            target="operational_error_risk",
            relation="decreases",
            weight=0.40,
            evidence_level="exploratory_hypothesis",
            uncertainty=0.55,
            evidence_reference="Scenario hypothesis linking physical deconditioning to operational error",
            limitations=[
                "No specific verified NASA source connecting muscle deconditioning directly to error rates",
            ],
        ),
        CausalEdge(
            source="cognitive_performance_risk",
            target="operational_error_risk",
            relation="increases",
            weight=0.70,
            evidence_level="exploratory_hypothesis",
            uncertainty=0.45,
            evidence_reference=(
                "Scenario hypothesis; the individual links (sleep->cognitive load, cognitive "
                "load->cognitive performance risk) are each supported_evidence above, but this "
                "specific downstream link to operational error is not independently verified"
            ),
            limitations=[
                "Chained from two supported_evidence edges but not itself independently verified",
                "No specific verified NASA source connecting cognitive performance risk directly to error rates",
            ],
        ),
    ]


def build_networkx_graph() -> nx.DiGraph:
    """Builds the graph and validates every edge references an existing node
    (CausalNode/CausalEdge are independent schemas with no cross-reference
    check of their own -- this is where that check happens).
    """
    nodes = build_causal_nodes()
    edges = build_causal_edges()
    node_ids = {n.id for n in nodes}

    graph = nx.DiGraph()
    for node in nodes:
        graph.add_node(node.id, **node.model_dump())
    for edge in edges:
        if edge.source not in node_ids:
            raise ValueError(f"edge references unknown source node {edge.source!r}")
        if edge.target not in node_ids:
            raise ValueError(f"edge references unknown target node {edge.target!r}")
        graph.add_edge(edge.source, edge.target, **edge.model_dump())

    return graph
