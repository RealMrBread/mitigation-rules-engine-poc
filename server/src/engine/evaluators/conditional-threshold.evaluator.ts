import { ConditionalConfigSchema } from "../../../../shared/schemas/rule.schema.js";
import type { EvalResult } from "../../../../shared/types/evaluation.js";
import type { Evaluator } from "../evaluator.interface.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Operator = "eq" | "neq" | "in" | "gte" | "lte" | "gt" | "lt";

interface ThresholdCheck {
  field: string;
  operator: Operator;
  value: string | number | string[];
}

interface ConditionalBranch {
  when: ThresholdCheck;
  then: ThresholdCheck;
}

interface ConditionalConfig {
  conditions: ConditionalBranch[];
  default: ThresholdCheck;
}

// ---------------------------------------------------------------------------
// Operator helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate whether the observed value **passes** the condition.
 * Returns true when the condition is satisfied.
 */
function passes(
  operator: Operator,
  observed: unknown,
  expected: string | number | string[],
): boolean {
  switch (operator) {
    case "eq":
      return observed === expected;
    case "neq":
      return observed !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(observed as string);
    case "gte":
      return typeof observed === "number" && observed >= (expected as number);
    case "lte":
      return typeof observed === "number" && observed <= (expected as number);
    case "gt":
      return typeof observed === "number" && observed > (expected as number);
    case "lt":
      return typeof observed === "number" && observed < (expected as number);
    default:
      return false;
  }
}

/** Format a value for human-readable explanation text. */
function formatValue(val: unknown): string {
  if (Array.isArray(val)) {
    return `[${val.map((v) => `"${v}"`).join(", ")}]`;
  }
  return typeof val === "string" ? `"${val}"` : String(val);
}

const OPERATOR_LABEL: Record<Operator, string> = {
  eq: "==",
  neq: "!=",
  in: "in",
  gte: ">=",
  lte: "<=",
  gt: ">",
  lt: "<",
};

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export class ConditionalThresholdEvaluator implements Evaluator {
  evaluate(config: any, observations: Record<string, any>): EvalResult {
    const typedConfig = config as ConditionalConfig;

    // Try each condition branch in order
    for (let i = 0; i < typedConfig.conditions.length; i++) {
      const branch = typedConfig.conditions[i];
      const whenObserved = observations[branch.when.field];
      const whenMatched = passes(
        branch.when.operator,
        whenObserved,
        branch.when.value,
      );

      if (whenMatched) {
        // This branch matched -- evaluate the "then" threshold
        return this.evaluateThreshold(
          branch.then,
          observations,
          `condition[${i}]`,
          branch.when,
          whenObserved,
        );
      }
    }

    // No branch matched -- use default threshold
    return this.evaluateThreshold(
      typedConfig.default,
      observations,
      "default",
      undefined,
      undefined,
    );
  }

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = ConditionalConfigSchema.safeParse(config);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private evaluateThreshold(
    threshold: ThresholdCheck,
    observations: Record<string, any>,
    branchLabel: string,
    whenClause: ThresholdCheck | undefined,
    whenObserved: unknown,
  ): EvalResult {
    const { field, operator, value } = threshold;
    const observed = observations[field];
    const conditionPassed = passes(operator, observed, value);

    // Build explanation
    const branchPart =
      whenClause !== undefined
        ? `Branch ${branchLabel} matched (${whenClause.field} ${formatValue(whenObserved)} ${OPERATOR_LABEL[whenClause.operator]} ${formatValue(whenClause.value)}). `
        : `No condition branch matched; using ${branchLabel} threshold. `;

    const checkPart = `${field} ${formatValue(observed)} ${OPERATOR_LABEL[operator]} ${formatValue(value)}: `;

    const verdict = conditionPassed
      ? "Condition met -- no vulnerability."
      : "Condition NOT met -- vulnerability triggered.";

    return {
      triggered: !conditionPassed,
      details: {
        observedValues: {
          ...(whenClause ? { [whenClause.field]: whenObserved } : {}),
          [field]: observed,
        },
        requiredValues: { threshold, branch: branchLabel },
        explanation: `${branchPart}${checkPart}${verdict}`,
      },
    };
  }
}
