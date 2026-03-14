import { SimpleConfigSchema } from "../../../../shared/schemas/rule.schema.js";
import type { EvalResult } from "../../../../shared/types/evaluation.js";
import type {
  SimpleConfig,
  Operator,
} from "../../../../shared/types/rule.js";
import type { Evaluator } from "../evaluator.interface.js";

// ---------------------------------------------------------------------------
// Operator helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate whether the observed value **passes** the condition.
 * The config defines the passing condition -- vulnerability triggers when
 * the condition is NOT met.
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

/** Build a human-readable explanation of the evaluation outcome. */
function buildExplanation(
  field: string,
  operator: Operator,
  observed: unknown,
  expected: string | number | string[],
  conditionPassed: boolean,
): string {
  const observedStr =
    typeof observed === "string" ? `"${observed}"` : String(observed);

  const expectedStr = Array.isArray(expected)
    ? `[${expected.map((v) => `"${v}"`).join(", ")}]`
    : typeof expected === "string"
      ? `"${expected}"`
      : String(expected);

  const operatorLabel: Record<Operator, string> = {
    eq: "==",
    neq: "!=",
    in: "in",
    gte: ">=",
    lte: "<=",
    gt: ">",
    lt: "<",
  };

  const verdict = conditionPassed
    ? "Condition met -- no vulnerability."
    : "Condition NOT met -- vulnerability triggered.";

  return `${field} ${observedStr} ${operatorLabel[operator]} ${expectedStr}: ${verdict}`;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export class SimpleThresholdEvaluator implements Evaluator {
  evaluate(config: SimpleConfig, observations: Record<string, any>): EvalResult {
    const { field, operator, value } = config;
    const observed = observations[field];

    const conditionPassed = passes(operator, observed, value);

    return {
      triggered: !conditionPassed,
      details: {
        observedValues: { [field]: observed },
        requiredValues: { field, operator, value },
        explanation: buildExplanation(
          field,
          operator,
          observed,
          value,
          conditionPassed,
        ),
      },
    };
  }

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = SimpleConfigSchema.safeParse(config);
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
}
