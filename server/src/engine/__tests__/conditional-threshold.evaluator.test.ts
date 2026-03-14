import { describe, it, expect } from "vitest";
import { ConditionalThresholdEvaluator } from "../evaluators/conditional-threshold.evaluator.js";
import { ROOF_RULE } from "../../../../shared/data/seed-rules.js";
import type { ConditionalConfig } from "../../../../shared/types/rule.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const evaluator = new ConditionalThresholdEvaluator();
const config = ROOF_RULE.config as ConditionalConfig;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConditionalThresholdEvaluator", () => {
  // -----------------------------------------------------------------------
  // 1. Risk A + Class A -> passes (condition branch, Class A in [A, B])
  // -----------------------------------------------------------------------
  it("passes when condition branch matches and threshold is met (Risk A + Class A)", () => {
    const result = evaluator.evaluate(config, {
      wildfire_risk_category: "A",
      roof_type: "Class A",
    });

    expect(result.triggered).toBe(false);
    expect(result.details.observedValues).toEqual({
      wildfire_risk_category: "A",
      roof_type: "Class A",
    });
  });

  // -----------------------------------------------------------------------
  // 2. Risk A + Class B -> passes (condition branch, Class B in [A, B])
  // -----------------------------------------------------------------------
  it("passes when condition branch matches and threshold is met (Risk A + Class B)", () => {
    const result = evaluator.evaluate(config, {
      wildfire_risk_category: "A",
      roof_type: "Class B",
    });

    expect(result.triggered).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 3. Risk A + Class C -> triggers (condition branch, Class C not in [A, B])
  // -----------------------------------------------------------------------
  it("triggers when condition branch matches but threshold is NOT met (Risk A + Class C)", () => {
    const result = evaluator.evaluate(config, {
      wildfire_risk_category: "A",
      roof_type: "Class C",
    });

    expect(result.triggered).toBe(true);
    expect(result.details.explanation).toContain("Condition NOT met");
  });

  // -----------------------------------------------------------------------
  // 4. Risk B + Class A -> passes (default branch, eq Class A)
  // -----------------------------------------------------------------------
  it("passes when no condition matches and default threshold is met (Risk B + Class A)", () => {
    const result = evaluator.evaluate(config, {
      wildfire_risk_category: "B",
      roof_type: "Class A",
    });

    expect(result.triggered).toBe(false);
    expect(result.details.explanation).toContain("default");
  });

  // -----------------------------------------------------------------------
  // 5. Risk B + Class B -> triggers (default branch, Class B != Class A)
  // -----------------------------------------------------------------------
  it("triggers when no condition matches and default threshold is NOT met (Risk B + Class B)", () => {
    const result = evaluator.evaluate(config, {
      wildfire_risk_category: "B",
      roof_type: "Class B",
    });

    expect(result.triggered).toBe(true);
    expect(result.details.explanation).toContain("default");
    expect(result.details.explanation).toContain("Condition NOT met");
  });

  // -----------------------------------------------------------------------
  // 6. Risk C + Class C -> triggers (default branch)
  // -----------------------------------------------------------------------
  it("triggers when no condition matches and default threshold is NOT met (Risk C + Class C)", () => {
    const result = evaluator.evaluate(config, {
      wildfire_risk_category: "C",
      roof_type: "Class C",
    });

    expect(result.triggered).toBe(true);
    expect(result.details.explanation).toContain("default");
  });

  // -----------------------------------------------------------------------
  // 7. Explanation mentions which branch was evaluated
  // -----------------------------------------------------------------------
  it("includes the matched branch label in the explanation", () => {
    const conditionResult = evaluator.evaluate(config, {
      wildfire_risk_category: "A",
      roof_type: "Class A",
    });
    expect(conditionResult.details.explanation).toContain("condition[0]");

    const defaultResult = evaluator.evaluate(config, {
      wildfire_risk_category: "B",
      roof_type: "Class A",
    });
    expect(defaultResult.details.explanation).toContain("default");
  });

  // -----------------------------------------------------------------------
  // 8. validate() rejects invalid config (empty conditions array)
  // -----------------------------------------------------------------------
  it("rejects invalid config with empty conditions array", () => {
    const result = evaluator.validate({
      conditions: [],
      default: { field: "roof_type", operator: "eq", value: "Class A" },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 9. validate() accepts valid config
  // -----------------------------------------------------------------------
  it("accepts a valid conditional config", () => {
    const result = evaluator.validate(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 10. validate() rejects config missing default
  // -----------------------------------------------------------------------
  it("rejects config missing the default threshold", () => {
    const result = evaluator.validate({
      conditions: [
        {
          when: { field: "risk", operator: "eq", value: "A" },
          then: { field: "roof", operator: "eq", value: "Class A" },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
