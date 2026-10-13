/**
 * Hand-written TypeScript mirrors of the backend's Pydantic response
 * schemas (see backend/app/schemas/api.py and backend/app/schemas/*.py).
 *
 * These are not auto-generated. Field names and shapes are kept in sync by
 * hand with the backend -- if a backend schema changes, this file must be
 * updated too. Only the fields this frontend actually renders are typed;
 * extra backend fields are simply ignored by TypeScript's structural typing.
 */

export type EvidenceLevel =
  | "supported_evidence"
  | "data_supported_association"
  | "exploratory_hypothesis"
  | "synthetic_parameter";

export type RiskBand = "low" | "moderate" | "high" | "critical";

export type Destination =
  | "low_earth_orbit"
  | "lunar_orbital"
  | "lunar_orbital_surface"
  | "mars_transit"
  | "mars_surface";

// --- Missions ---

export interface CrewBaseline {
  radiation_sensitivity: number;
  bone_loss_susceptibility: number;
  sleep_resilience: number;
  muscle_recovery: number;
  cognitive_resilience: number;
  inflammatory_baseline: number;
}

export interface CrewProfile {
  id: string;
  display_name: string;
  role: string;
  synthetic: true;
  baseline: CrewBaseline;
  characteristics: string[];
  primary_vulnerability: string;
  limitations: string[];
}

export interface MissionConfig {
  mission_id: string;
  mission_name: string;
  destination: Destination;
  duration_days: number;
  crew_size: number;
  gravity_g: number;
  communication_delay_minutes: number;
  synthetic: true;
}

export interface SimulationEvent {
  id: string;
  mission_id: string;
  day_start: number;
  day_end: number;
  type: "radiation_storm" | "equipment_failure" | "communication_delay" | "eva" | "other";
  severity: "low" | "medium" | "high";
  description: string;
  effects: Record<string, number>;
  synthetic: true;
  decision_point: {
    alternatives: { id: string; name: string; description: string }[];
  } | null;
}

export interface MissionResponse {
  mission: MissionConfig;
  crew_profiles: CrewProfile[];
  events: SimulationEvent[];
  synthetic_data_notice: string;
}

// --- Simulation customization (request bodies) ---

export interface CrewBaselineOverride {
  radiation_sensitivity?: number;
  bone_loss_susceptibility?: number;
  sleep_resilience?: number;
  muscle_recovery?: number;
  cognitive_resilience?: number;
  inflammatory_baseline?: number;
}

export interface CrewOverride {
  id: string;
  display_name?: string;
  baseline?: CrewBaselineOverride;
}

export interface MissionOverride {
  destination?: Destination;
  duration_days?: number;
  communication_delay_minutes?: number;
  gravity_g?: number;
}

export type TargetRisk = "musculoskeletal" | "radiation" | "cognitive_operational";

export interface CountermeasurePlan {
  id: string;
  name: string;
  target_risk: TargetRisk;
  description: string;
  limitations: string[];
  evidence_reference: string | null;
}

export interface SimulationRunRequestBody {
  mission_id?: string;
  countermeasures?: CountermeasurePlan[];
  crew_overrides?: CrewOverride[];
  mission_overrides?: MissionOverride | null;
  active_event_ids?: string[] | null;
}

// --- Simulation ---

export interface RiskDriver {
  name: string;
  contribution: number;
}

export interface DailyCrewState {
  crew_id: string;
  mission_id: string;
  day: number;
  radiation_burden: number;
  sleep_debt: number;
  muscle_recovery: number;
  bone_risk: number;
  cognitive_resilience: number;
  operational_risk: number;
  uncertainty: number;
}

export interface RiskResult {
  crew_id: string;
  mission_id: string;
  day: number;
  scores: DailyCrewState;
  band: RiskBand;
  uncertainty: number;
  top_drivers: RiskDriver[];
  disclaimer: string;
}

export interface VulnerabilityWindow {
  day_start: number;
  day_end: number;
  severity: "high" | "critical";
  primary_drivers: string[];
}

export interface CrewTrajectory {
  crew_id: string;
  display_name: string;
  risk_results: RiskResult[];
  vulnerability_windows: VulnerabilityWindow[];
}

export interface SimulationRunResponse {
  mission_id: string;
  generated_at: string;
  disclaimer: string;
  synthetic_data_notice: string;
  trajectories: CrewTrajectory[];
  band_day_counts: Record<string, Record<string, number>>;
  mission: MissionConfig;
  crew_profiles: CrewProfile[];
}

// --- Counterfactual ---

export interface CounterfactualAlternativeResult {
  alternative: "A" | "B" | "C";
  description: string;
  eva_crew_id: string;
  eva_day: number;
  peak_operational_risk: number;
  peak_cognitive_risk: number;
  peak_musculoskeletal_risk: number;
  mean_uncertainty: number;
  eva_completion_probability: number;
  top_drivers: string[];
}

export interface CounterfactualCompareResponse {
  mission_id: string;
  generated_at: string;
  disclaimer: string;
  language_note: string;
  alternatives: CounterfactualAlternativeResult[];
}

// --- Evidence graph ---

export interface CausalNodeData {
  id: string;
  label: string;
  category: string;
  description: string;
}

export interface CausalEdgeData {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
  evidence_level: EvidenceLevel;
  uncertainty: number;
  evidence_reference: string;
  limitations: string[];
}

export interface EvidenceGraphResponse {
  elements: {
    nodes: { data: CausalNodeData }[];
    edges: { data: CausalEdgeData }[];
  };
  evidence_level_legend: Record<string, string>;
  disclaimer: string;
  synthetic_data_notice: string;
}

// --- Real gene-expression data (NAG9-1024 / Burns et al. 2002) ---

export type GeneResponseCategory = "reversal_response" | "additive_response";

export interface GeneExpressionRecord {
  gene_symbol: string;
  accession: string;
  gene_description: string;
  category: GeneResponseCategory;
  control: number;
  vitamin_a_alone: number;
  dose_9gy: number;
  dose_9gy_plus_vitamin_a: number;
  dose_18gy: number;
  fold_change_9gy_vs_control: number | null;
  vitamin_a_reduced_the_9gy_effect: boolean;
}

export interface GeneExpressionTableResponse {
  study_citation: string;
  organism: string;
  tissue: string;
  radiation_condition: string;
  timepoint: string;
  evidence_reference: string;
  limitations: string[];
  records: GeneExpressionRecord[];
  disclaimer: string;
  synthetic_data_notice: string;
}

// --- Vitals (self-reported, rule-based evaluation) ---

export type MetricStatus = "normal" | "attention" | "alert";

// The six monitoring categories from the challenge brief -- see
// backend/app/schemas/vitals.py's VitalsCategory for the authoritative list.
export type VitalsCategory = "cardiac" | "respiratory" | "temperature" | "sleep_fatigue" | "activity_muscle" | "hydration_other";

export type HeartRhythm = "regular" | "irregular";

export interface VitalsEntry {
  heart_rate_bpm: number;
  heart_rhythm: HeartRhythm;
  spo2_percent: number;
  body_temp_c: number;
  respiratory_rate_bpm: number;
  sleep_hours: number;
  sleep_quality: number;
  stress_level: number;
  activity_minutes: number;
  hydration_level: number;
  body_mass_kg?: number | null;
}

export interface VitalMetricEvaluation {
  metric_id: string;
  label: string;
  category: VitalsCategory;
  value: number;
  unit: string;
  status: MetricStatus;
  reference_range: string;
  note: string;
  recommendations: string[];
}

export interface VitalsEvaluationResponse {
  overall_status: MetricStatus;
  metrics: VitalMetricEvaluation[];
  insights: string[];
  reference_source: string;
  limitations: string[];
  disclaimer: string;
  synthetic_data_notice: string;
}

// --- Research navigator ---

export interface ExperimentProposal {
  id: string;
  title: string;
  gap_description: string;
  mission_impact: number;
  uncertainty: number;
  expected_information_gain: number;
  relative_cost: number;
  limitations: string[];
  priority: number;
}

export interface ResearchNavigatorRankingsResponse {
  priority_formula: string;
  language_note: string;
  proposals: ExperimentProposal[];
}

// --- Debate chamber ---

export type DebateRole = "mission_commander" | "flight_surgeon" | "science_officer" | "skeptic";

export interface AgentRecommendation {
  role: DebateRole;
  recommendation: "A" | "B" | "C" | null;
  utility: number | null;
  confidence: number | null;
  justification: string;
  limitations: string[];
}

export interface DebateResult {
  mission_id: string;
  day: number;
  alternatives: string[];
  recommendations: AgentRecommendation[];
  disagreement_summary: string | null;
  generated_at: string;
  disclaimer: string;
}

// --- In-app assistant ---

export interface AssistantStatusResponse {
  configured: boolean;
  model: string | null;
  notice: string | null;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAskResponse {
  answer: string;
  disclaimer: string;
  synthetic_data_notice: string;
}
