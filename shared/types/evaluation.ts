// Evaluation types for the Mitigation Rules Engine

import type { Mitigation } from "./rule.js";

export interface EvalResult {
  triggered: boolean;
  details: {
    observedValues: Record<string, any>;
    requiredValues: any;
    computedThreshold?: number;
    explanation: string;
  };
}

export type RuleEvaluationStatus = "evaluated" | "skipped" | "error";

export interface VulnerabilityResult {
  rule_id: string;
  rule_name: string;
  description: string;
  triggered: boolean;
  details: EvalResult["details"];
  mitigations: Mitigation[];
  status: RuleEvaluationStatus;
  skipReason?: string;
  missingFields?: string[];
}

export interface BridgeStackBreakdownItem {
  bridge: string;
  modifier: number;
  running_threshold: number;
}

export interface BridgeStackBreakdown {
  base_threshold: number;
  bridge_modifier_product: number;
  final_threshold: number;
  actual_value: number;
  passes: boolean;
  breakdown: BridgeStackBreakdownItem[];
}

export interface EvaluationSummary {
  total_vulnerabilities: number;
  auto_decline_vulnerabilities: number;
  mitigatable: number;
  bridge_mitigations_available: number;
  bridge_mitigation_limit: number;
}

export interface EvaluationResult {
  evaluation_id: string;
  release: {
    id: string;
    name: string;
  };
  auto_declined: boolean;
  vulnerabilities: VulnerabilityResult[];
  skipped_rules: Array<{
    rule_id: string;
    rule_name: string;
    reason: string;
    missingFields: string[];
  }>;
  summary: EvaluationSummary;
}
