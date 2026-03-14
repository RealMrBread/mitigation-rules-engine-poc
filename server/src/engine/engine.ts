import { GLOBALLY_REQUIRED_FIELDS } from "../../../shared/schemas/observation.schema.js";
import type {
  EvaluationResult,
  EvaluationSummary,
  VulnerabilityResult,
} from "../../../shared/types/evaluation.js";
import type { Rule } from "../../../shared/types/rule.js";
import { EvaluatorRegistry } from "./registry.js";
import { SimpleThresholdEvaluator } from "./evaluators/simple-threshold.evaluator.js";

// ---------------------------------------------------------------------------
// UUID helper (avoids dependency on @types/node)
// ---------------------------------------------------------------------------

function generateUUID(): string {
  // Use globalThis.crypto.randomUUID when available (Node 19+, modern browsers)
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof (globalThis.crypto as any).randomUUID === "function"
  ) {
    return (globalThis.crypto as any).randomUUID();
  }
  // Fallback: RFC-4122 v4 UUID via Math.random
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import { ConditionalThresholdEvaluator } from "./evaluators/conditional-threshold.evaluator.js";
import { ComputedWithModifiersEvaluator } from "./evaluators/computed-with-modifiers.evaluator.js";

// ---------------------------------------------------------------------------
// Pre-configured registry with all built-in evaluators
// ---------------------------------------------------------------------------

export const defaultRegistry = new EvaluatorRegistry();
defaultRegistry.register("simple_threshold", new SimpleThresholdEvaluator());
defaultRegistry.register(
  "conditional_threshold",
  new ConditionalThresholdEvaluator(),
);
defaultRegistry.register(
  "computed_with_modifiers",
  new ComputedWithModifiersEvaluator(),
);

// ---------------------------------------------------------------------------
// Field extraction helpers
// ---------------------------------------------------------------------------

/**
 * Strip `[]` notation from a field name to get the top-level observation key.
 * e.g. "vegetation[].type" -> "vegetation", "window_type" -> "window_type"
 */
function stripArrayNotation(field: string): string {
  const bracketIndex = field.indexOf("[");
  return bracketIndex >= 0 ? field.substring(0, bracketIndex) : field;
}

/**
 * Extract all top-level observation fields that a rule's config references.
 * Returns a deduplicated array of field names.
 */
function getReferencedFields(rule: Rule): string[] {
  const fields = new Set<string>();

  switch (rule.type) {
    case "simple_threshold": {
      const config = rule.config;
      fields.add(stripArrayNotation(config.field));
      break;
    }
    case "conditional_threshold": {
      const config = rule.config;
      for (const condition of config.conditions) {
        fields.add(stripArrayNotation(condition.when.field));
        fields.add(stripArrayNotation(condition.then.field));
      }
      fields.add(stripArrayNotation(config.default.field));
      break;
    }
    case "computed_with_modifiers": {
      const config = rule.config;
      if (config.arrayField) {
        fields.add(config.arrayField);
      }
      fields.add(stripArrayNotation(config.comparisonField));
      for (const modifier of config.modifiers) {
        fields.add(stripArrayNotation(modifier.field));
      }
      break;
    }
  }

  return [...fields];
}

// ---------------------------------------------------------------------------
// Main evaluate function
// ---------------------------------------------------------------------------

/**
 * Evaluate a set of observations against a list of rules.
 *
 * This is a pure function (aside from UUID generation for the evaluation ID).
 * It validates globally required fields, dispatches each rule to its evaluator,
 * collects results, and builds a summary.
 */
export function evaluate(
  observations: Record<string, any>,
  rules: Rule[],
  registry: EvaluatorRegistry = defaultRegistry,
): EvaluationResult {
  const evaluationId = generateUUID();

  // -------------------------------------------------------------------------
  // Step 1: Validate globally required fields
  // -------------------------------------------------------------------------

  const missingGlobal: string[] = [];
  for (const field of GLOBALLY_REQUIRED_FIELDS) {
    if (observations[field] === undefined || observations[field] === null) {
      missingGlobal.push(field);
    }
  }

  if (missingGlobal.length > 0) {
    return {
      evaluation_id: evaluationId,
      release: { id: "", name: "" },
      auto_declined: false,
      vulnerabilities: [],
      skipped_rules: [],
      summary: {
        total_vulnerabilities: 0,
        auto_decline_vulnerabilities: 0,
        mitigatable: 0,
        bridge_mitigations_available: 0,
        bridge_mitigation_limit: 3,
      },
      validation_error: {
        message: `Missing globally required fields: ${missingGlobal.join(", ")}`,
        missingFields: missingGlobal,
      },
    } as EvaluationResult & { validation_error: any };
  }

  // -------------------------------------------------------------------------
  // Step 2: Evaluate each rule
  // -------------------------------------------------------------------------

  const vulnerabilities: VulnerabilityResult[] = [];
  const skippedRules: EvaluationResult["skipped_rules"] = [];

  for (const rule of rules) {
    // 2a: Check if rule-referenced fields are present
    const referencedFields = getReferencedFields(rule);
    const missing = referencedFields.filter(
      (f) => observations[f] === undefined || observations[f] === null,
    );

    if (missing.length > 0) {
      // 2b: Skip rule with warning
      skippedRules.push({
        rule_id: rule.id,
        rule_name: rule.name,
        reason: `Missing required observation fields: ${missing.join(", ")}`,
        missingFields: missing,
      });
      continue;
    }

    // 2c: Dispatch to evaluator
    try {
      const { result } = registry.evaluate(rule, observations);

      const vulnerability: VulnerabilityResult = {
        rule_id: rule.id,
        rule_name: rule.name,
        description: rule.description,
        triggered: result.triggered,
        details: result.details,
        mitigations: rule.mitigations,
        status: "evaluated",
      };

      // 2d: Only add triggered rules to vulnerabilities
      if (result.triggered) {
        vulnerabilities.push(vulnerability);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      vulnerabilities.push({
        rule_id: rule.id,
        rule_name: rule.name,
        description: rule.description,
        triggered: false,
        details: {
          observedValues: {},
          requiredValues: {},
          explanation: `Evaluation error: ${errorMessage}`,
        },
        mitigations: [],
        status: "error",
      });
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Check auto-decline
  // -------------------------------------------------------------------------

  const autoDeclineVulnerabilities = vulnerabilities.filter(
    (v) => v.triggered && v.mitigations.length === 0,
  );
  const autoDeclined = autoDeclineVulnerabilities.length > 0;

  // -------------------------------------------------------------------------
  // Step 4: Build summary
  // -------------------------------------------------------------------------

  const triggeredVulnerabilities = vulnerabilities.filter((v) => v.triggered);
  const mitigatableVulnerabilities = triggeredVulnerabilities.filter(
    (v) => v.mitigations.length > 0,
  );
  const bridgeMitigationsAvailable = new Set(
    triggeredVulnerabilities.flatMap((v) =>
      v.mitigations
        .filter((m) => m.category === "bridge")
        .map((m) => m.id),
    ),
  ).size;

  const summary: EvaluationSummary = {
    total_vulnerabilities: triggeredVulnerabilities.length,
    auto_decline_vulnerabilities: autoDeclineVulnerabilities.length,
    mitigatable: mitigatableVulnerabilities.length,
    bridge_mitigations_available: bridgeMitigationsAvailable,
    bridge_mitigation_limit: 3,
  };

  // -------------------------------------------------------------------------
  // Step 5: Return EvaluationResult
  // -------------------------------------------------------------------------

  return {
    evaluation_id: evaluationId,
    release: { id: "", name: "" },
    auto_declined: autoDeclined,
    vulnerabilities,
    skipped_rules: skippedRules,
    summary,
  };
}
