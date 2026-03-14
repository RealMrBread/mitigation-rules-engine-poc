import { describe, it, expect } from "vitest";
import { SimpleThresholdEvaluator } from "../evaluators/simple-threshold.evaluator.js";
import { ATTIC_VENT_RULE, HOME_TO_HOME_RULE } from "../../../../shared/data/seed-rules.js";
import type { SimpleConfig } from "../../../../shared/types/rule.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const evaluator = new SimpleThresholdEvaluator();

// Extract configs with proper typing (seed rules use discriminated union)
const atticVentConfig = ATTIC_VENT_RULE.config as SimpleConfig;
const homeToHomeConfig = HOME_TO_HOME_RULE.config as SimpleConfig;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SimpleThresholdEvaluator", () => {
  // -----------------------------------------------------------------------
  // Attic Vent rule (eq operator, string comparison)
  // -----------------------------------------------------------------------

  it("triggers when attic vent is 'Standard' (not 'Ember Resistant')", () => {
    const result = evaluator.evaluate(atticVentConfig, {
      attic_vent_screens: "Standard",
    });

    expect(result.triggered).toBe(true);
    expect(result.details.observedValues).toEqual({
      attic_vent_screens: "Standard",
    });
    expect(result.details.requiredValues).toEqual(atticVentConfig);
  });

  it("passes when attic vent is 'Ember Resistant'", () => {
    const result = evaluator.evaluate(atticVentConfig, {
      attic_vent_screens: "Ember Resistant",
    });

    expect(result.triggered).toBe(false);
    expect(result.details.observedValues).toEqual({
      attic_vent_screens: "Ember Resistant",
    });
  });

  // -----------------------------------------------------------------------
  // Home-to-Home rule (gte operator, numeric comparison)
  // -----------------------------------------------------------------------

  it("triggers when home-to-home distance is 10 (< 15)", () => {
    const result = evaluator.evaluate(homeToHomeConfig, {
      home_to_home_distance: 10,
    });

    expect(result.triggered).toBe(true);
    expect(result.details.observedValues).toEqual({
      home_to_home_distance: 10,
    });
  });

  it("passes when home-to-home distance is 20 (>= 15)", () => {
    const result = evaluator.evaluate(homeToHomeConfig, {
      home_to_home_distance: 20,
    });

    expect(result.triggered).toBe(false);
  });

  it("passes when home-to-home distance is exactly 15 (boundary)", () => {
    const result = evaluator.evaluate(homeToHomeConfig, {
      home_to_home_distance: 15,
    });

    expect(result.triggered).toBe(false);
  });

  // -----------------------------------------------------------------------
  // "in" operator
  // -----------------------------------------------------------------------

  it("passes when observed value is in the allowed array", () => {
    const config = {
      field: "roof_type",
      operator: "in" as const,
      value: ["Class A", "Class B"],
    };

    const result = evaluator.evaluate(config, { roof_type: "Class A" });

    expect(result.triggered).toBe(false);
    expect(result.details.observedValues).toEqual({ roof_type: "Class A" });
  });

  it("triggers when observed value is NOT in the allowed array", () => {
    const config = {
      field: "roof_type",
      operator: "in" as const,
      value: ["Class A", "Class B"],
    };

    const result = evaluator.evaluate(config, { roof_type: "Class C" });

    expect(result.triggered).toBe(true);
  });

  // -----------------------------------------------------------------------
  // "neq" operator
  // -----------------------------------------------------------------------

  it("passes when observed value is different (neq)", () => {
    const config = {
      field: "siding_material",
      operator: "neq" as const,
      value: "Wood",
    };

    const result = evaluator.evaluate(config, { siding_material: "Stucco" });

    expect(result.triggered).toBe(false);
  });

  // -----------------------------------------------------------------------
  // validate()
  // -----------------------------------------------------------------------

  it("rejects invalid config (missing required fields)", () => {
    const result = evaluator.validate({ operator: "eq" });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts valid config", () => {
    const result = evaluator.validate({
      field: "some_field",
      operator: "gte",
      value: 10,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Explanation string
  // -----------------------------------------------------------------------

  it("produces a meaningful explanation string", () => {
    const result = evaluator.evaluate(atticVentConfig, {
      attic_vent_screens: "Standard",
    });

    expect(result.details.explanation).toContain("attic_vent_screens");
    expect(result.details.explanation).toContain("Standard");
    expect(result.details.explanation).toContain("Ember Resistant");
    expect(result.details.explanation).toContain("vulnerability triggered");
  });
});
