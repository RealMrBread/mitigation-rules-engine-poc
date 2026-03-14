import { describe, it, expect, vi } from "vitest";
import { EvaluatorRegistry } from "../registry.js";
import { UnknownRuleTypeError } from "../errors.js";
import type { Evaluator } from "../evaluator.interface.js";
import type { EvalResult } from "../../../../shared/types/evaluation.js";
import type { Rule } from "../../../../shared/types/rule.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal stub evaluator that returns a fixed EvalResult. */
function createStubEvaluator(result: EvalResult): Evaluator {
  return {
    evaluate: vi.fn().mockReturnValue(result),
    validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  };
}

/** Build a minimal Rule object for testing purposes. */
function buildRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Test Rule",
    description: "A rule used in unit tests",
    type: "simple_threshold",
    config: { field: "age", operator: "gte", value: 18 },
    mitigations: [],
    ...overrides,
  } as Rule;
}

const TRIGGERED_RESULT: EvalResult = {
  triggered: true,
  details: {
    observedValues: { age: 25 },
    requiredValues: { field: "age", operator: "gte", value: 18 },
    explanation: "age 25 >= 18",
  },
};

const NOT_TRIGGERED_RESULT: EvalResult = {
  triggered: false,
  details: {
    observedValues: { age: 10 },
    requiredValues: { field: "age", operator: "gte", value: 18 },
    explanation: "age 10 < 18",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EvaluatorRegistry", () => {
  it("registers and retrieves an evaluator", () => {
    const registry = new EvaluatorRegistry();
    const evaluator = createStubEvaluator(TRIGGERED_RESULT);

    registry.register("simple_threshold", evaluator);

    expect(registry.get("simple_threshold")).toBe(evaluator);
  });

  it("throws UnknownRuleTypeError for an unregistered type", () => {
    const registry = new EvaluatorRegistry();

    expect(() => registry.get("nonexistent_type")).toThrow(
      UnknownRuleTypeError,
    );
    expect(() => registry.get("nonexistent_type")).toThrow(
      /No evaluator registered for rule type: "nonexistent_type"/,
    );
  });

  it("dispatches evaluate to the correct evaluator", () => {
    const registry = new EvaluatorRegistry();
    const simpleEvaluator = createStubEvaluator(TRIGGERED_RESULT);
    const conditionalEvaluator = createStubEvaluator(NOT_TRIGGERED_RESULT);

    registry.register("simple_threshold", simpleEvaluator);
    registry.register("conditional_threshold", conditionalEvaluator);

    const rule = buildRule({
      type: "simple_threshold",
      config: { field: "age", operator: "gte", value: 18 },
    });
    const observations = { age: 25 };

    const { rule: returnedRule, result } = registry.evaluate(
      rule,
      observations,
    );

    expect(returnedRule).toBe(rule);
    expect(result).toEqual(TRIGGERED_RESULT);
    expect(simpleEvaluator.evaluate).toHaveBeenCalledWith(
      rule.config,
      observations,
    );
    expect(conditionalEvaluator.evaluate).not.toHaveBeenCalled();
  });

  it("overwrites an existing evaluator when registering the same type", () => {
    const registry = new EvaluatorRegistry();
    const original = createStubEvaluator(TRIGGERED_RESULT);
    const replacement = createStubEvaluator(NOT_TRIGGERED_RESULT);

    registry.register("simple_threshold", original);
    registry.register("simple_threshold", replacement);

    expect(registry.get("simple_threshold")).toBe(replacement);

    const rule = buildRule();
    const { result } = registry.evaluate(rule, { age: 10 });

    expect(result).toEqual(NOT_TRIGGERED_RESULT);
    expect(replacement.evaluate).toHaveBeenCalled();
    expect(original.evaluate).not.toHaveBeenCalled();
  });
});
