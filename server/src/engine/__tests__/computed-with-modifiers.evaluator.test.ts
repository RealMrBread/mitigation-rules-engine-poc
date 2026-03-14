import { describe, it, expect } from "vitest";
import { ComputedWithModifiersEvaluator } from "../evaluators/computed-with-modifiers.evaluator.js";
import type { ComputedConfig } from "../../../../shared/types/rule.js";

// ---------------------------------------------------------------------------
// Shared test config (mirrors WINDOWS_RULE.config from seed-rules)
// ---------------------------------------------------------------------------

const WINDOWS_CONFIG: ComputedConfig = {
  baseValue: 30,
  unit: "feet",
  modifiers: [
    {
      field: "window_type",
      operation: "multiply",
      mapping: {
        "Single Pane": 3,
        "Double Pane": 2,
        "Tempered Glass": 1,
      },
    },
    {
      field: "vegetation[].type",
      operation: "divide",
      mapping: {
        Tree: 1,
        Shrub: 2,
        Grass: 3,
      },
    },
  ],
  comparisonField: "vegetation[].distance_to_window",
  comparisonOperator: "gte",
  arrayField: "vegetation",
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildObservations(
  windowType: string,
  vegetation: Array<{ type: string; distance_to_window: number }>,
): Record<string, any> {
  return {
    property_id: "PROP-TEST",
    window_type: windowType,
    vegetation,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ComputedWithModifiersEvaluator", () => {
  const evaluator = new ComputedWithModifiersEvaluator();

  // -----------------------------------------------------------------------
  // Test 1: Single Pane + Tree at 50ft -> triggers
  // threshold = 30 * 3 / 1 = 90ft, 50 < 90 -> FAIL
  // -----------------------------------------------------------------------
  it("triggers for Single Pane + Tree at 50ft (threshold 90 > 50)", () => {
    const observations = buildObservations("Single Pane", [
      { type: "Tree", distance_to_window: 50 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    expect(result.triggered).toBe(true);
    expect(result.details.computedThreshold).toBe(90);
  });

  // -----------------------------------------------------------------------
  // Test 2: Tempered Glass + Tree at 50ft -> passes
  // threshold = 30 * 1 / 1 = 30ft, 50 >= 30 -> PASS
  // -----------------------------------------------------------------------
  it("passes for Tempered Glass + Tree at 50ft (threshold 30 <= 50)", () => {
    const observations = buildObservations("Tempered Glass", [
      { type: "Tree", distance_to_window: 50 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    expect(result.triggered).toBe(false);
    expect(result.details.computedThreshold).toBe(30);
  });

  // -----------------------------------------------------------------------
  // Test 3: Single Pane + Shrub at 50ft -> passes
  // threshold = 30 * 3 / 2 = 45ft, 50 >= 45 -> PASS
  // -----------------------------------------------------------------------
  it("passes for Single Pane + Shrub at 50ft (threshold 45 <= 50)", () => {
    const observations = buildObservations("Single Pane", [
      { type: "Shrub", distance_to_window: 50 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    expect(result.triggered).toBe(false);
    expect(result.details.computedThreshold).toBe(45);
  });

  // -----------------------------------------------------------------------
  // Test 4: Single Pane + Grass at 50ft -> passes
  // threshold = 30 * 3 / 3 = 30ft, 50 >= 30 -> PASS
  // -----------------------------------------------------------------------
  it("passes for Single Pane + Grass at 50ft (threshold 30 <= 50)", () => {
    const observations = buildObservations("Single Pane", [
      { type: "Grass", distance_to_window: 50 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    expect(result.triggered).toBe(false);
    expect(result.details.computedThreshold).toBe(30);
  });

  // -----------------------------------------------------------------------
  // Test 5: Multiple vegetation - Tree at 50ft + Tree at 100ft, Single Pane
  // First: threshold 90, 50 < 90 -> FAIL
  // Second: threshold 90, 100 >= 90 -> PASS
  // Rule triggers because first item fails
  // -----------------------------------------------------------------------
  it("triggers when any vegetation item fails (Tree at 50ft fails, Tree at 100ft passes)", () => {
    const observations = buildObservations("Single Pane", [
      { type: "Tree", distance_to_window: 50 },
      { type: "Tree", distance_to_window: 100 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    expect(result.triggered).toBe(true);

    const breakdown = (result.details as any).itemBreakdown;
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].passes).toBe(false);
    expect(breakdown[0].threshold).toBe(90);
    expect(breakdown[0].actualValue).toBe(50);
    expect(breakdown[1].passes).toBe(true);
    expect(breakdown[1].threshold).toBe(90);
    expect(breakdown[1].actualValue).toBe(100);
  });

  // -----------------------------------------------------------------------
  // Test 6: Multiple vegetation - all pass -> rule passes
  // -----------------------------------------------------------------------
  it("passes when all vegetation items meet the threshold", () => {
    const observations = buildObservations("Tempered Glass", [
      { type: "Tree", distance_to_window: 50 },
      { type: "Shrub", distance_to_window: 20 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    expect(result.triggered).toBe(false);

    const breakdown = (result.details as any).itemBreakdown;
    // Tree: 30 * 1 / 1 = 30, 50 >= 30 -> pass
    expect(breakdown[0].passes).toBe(true);
    expect(breakdown[0].threshold).toBe(30);
    // Shrub: 30 * 1 / 2 = 15, 20 >= 15 -> pass
    expect(breakdown[1].passes).toBe(true);
    expect(breakdown[1].threshold).toBe(15);
  });

  // -----------------------------------------------------------------------
  // Test 7: Double Pane + Tree at 50ft -> triggers
  // threshold = 30 * 2 / 1 = 60ft, 50 < 60 -> FAIL
  // -----------------------------------------------------------------------
  it("triggers for Double Pane + Tree at 50ft (threshold 60 > 50)", () => {
    const observations = buildObservations("Double Pane", [
      { type: "Tree", distance_to_window: 50 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    expect(result.triggered).toBe(true);
    expect(result.details.computedThreshold).toBe(60);
  });

  // -----------------------------------------------------------------------
  // Test 8: Computation details include full breakdown
  // -----------------------------------------------------------------------
  it("includes computation breakdown with base value, modifiers, threshold, and actual value", () => {
    const observations = buildObservations("Single Pane", [
      { type: "Tree", distance_to_window: 50 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    expect(result.details.computedThreshold).toBe(90);
    expect(result.details.requiredValues).toEqual({
      baseValue: 30,
      unit: "feet",
      comparisonOperator: "gte",
    });

    const breakdown = (result.details as any).itemBreakdown;
    expect(breakdown).toHaveLength(1);

    const item = breakdown[0];
    expect(item.observationModifierProduct).toBe(3); // 3 * (1/1)
    expect(item.threshold).toBe(90);
    expect(item.actualValue).toBe(50);
    expect(item.passes).toBe(false);
    expect(item.modifiers).toEqual([
      {
        field: "window_type",
        observedValue: "Single Pane",
        mappedValue: 3,
        operation: "multiply",
      },
      {
        field: "vegetation[].type",
        observedValue: "Tree",
        mappedValue: 1,
        operation: "divide",
      },
    ]);
  });

  // -----------------------------------------------------------------------
  // Test 9: validate() rejects invalid config
  // -----------------------------------------------------------------------
  it("rejects invalid config via validate()", () => {
    const invalidConfig = {
      baseValue: -10, // must be positive
      // missing required fields
    };

    const validation = evaluator.validate(invalidConfig);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it("accepts valid config via validate()", () => {
    const validation = evaluator.validate(WINDOWS_CONFIG);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Test 10: Mixed vegetation types get different modifier values
  // Tree + Shrub with Single Pane
  // Tree: 30 * 3 / 1 = 90, Shrub: 30 * 3 / 2 = 45
  // -----------------------------------------------------------------------
  it("handles mixed vegetation types with different modifier values per item", () => {
    const observations = buildObservations("Single Pane", [
      { type: "Tree", distance_to_window: 80 },
      { type: "Shrub", distance_to_window: 40 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    const breakdown = (result.details as any).itemBreakdown;
    expect(breakdown).toHaveLength(2);

    // Tree item: threshold = 30 * 3 / 1 = 90, 80 < 90 -> fails
    expect(breakdown[0].threshold).toBe(90);
    expect(breakdown[0].actualValue).toBe(80);
    expect(breakdown[0].passes).toBe(false);

    // Shrub item: threshold = 30 * 3 / 2 = 45, 40 < 45 -> fails
    expect(breakdown[1].threshold).toBe(45);
    expect(breakdown[1].actualValue).toBe(40);
    expect(breakdown[1].passes).toBe(false);

    expect(result.triggered).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Test 11: Non-array mode (no arrayField set)
  // -----------------------------------------------------------------------
  it("evaluates non-array config by reading directly from observations", () => {
    const nonArrayConfig: ComputedConfig = {
      baseValue: 100,
      unit: "feet",
      modifiers: [
        {
          field: "risk_level",
          operation: "multiply",
          mapping: { High: 2, Low: 1 },
        },
      ],
      comparisonField: "distance",
      comparisonOperator: "gte",
    };

    const observations = { risk_level: "High", distance: 150 };
    const result = evaluator.evaluate(nonArrayConfig, observations);

    // threshold = 100 * 2 = 200, 150 < 200 -> triggered
    expect(result.triggered).toBe(true);
    expect(result.details.computedThreshold).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Test 12: Boundary case -- exact threshold with gte passes
  // -----------------------------------------------------------------------
  it("passes when actual value exactly equals threshold with gte operator", () => {
    const observations = buildObservations("Tempered Glass", [
      { type: "Tree", distance_to_window: 30 },
    ]);

    const result = evaluator.evaluate(WINDOWS_CONFIG, observations);

    // threshold = 30 * 1 / 1 = 30, 30 >= 30 -> PASS
    expect(result.triggered).toBe(false);
  });
});
