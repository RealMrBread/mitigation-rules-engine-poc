import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  RuleSchema,
  SimpleConfigSchema,
  ConditionalConfigSchema,
  ComputedConfigSchema,
  MitigationSchema,
  BridgeEffectSchema,
  OperatorSchema,
} from "../schemas/rule.schema";
import { ObservationSchema } from "../schemas/observation.schema";
import { EvaluateRequestSchema } from "../schemas/evaluation.schema";
import { CreateReleaseRequestSchema } from "../schemas/release.schema";
import { LoginRequestSchema } from "../schemas/user.schema";
import { SEED_RULES } from "../data/seed-rules";
import {
  OBS_ALL_PASSING,
  OBS_ATTIC_VENT_FAIL,
  OBS_WINDOWS_FAIL,
  OBS_AUTO_DECLINE,
  OBS_MULTIPLE_FAILS,
} from "../data/seed-observations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "a0000000-0000-4000-a000-000000000001";

// ---------------------------------------------------------------------------
// Rule schemas
// ---------------------------------------------------------------------------

describe("Rule schemas", () => {
  it("valid simple_threshold config parses correctly", () => {
    const input = {
      id: VALID_UUID,
      name: "Test Rule",
      description: "A test rule",
      type: "simple_threshold" as const,
      config: {
        field: "attic_vent_screens",
        operator: "eq",
        value: "Ember Resistant",
      },
      mitigations: [],
    };
    const result = RuleSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("simple_threshold");
    }
  });

  it("valid conditional_threshold config parses correctly", () => {
    const input = {
      id: VALID_UUID,
      name: "Roof Rule",
      description: "Conditional roof check",
      type: "conditional_threshold" as const,
      config: {
        conditions: [
          {
            when: { field: "wildfire_risk_category", operator: "eq", value: "A" },
            then: { field: "roof_type", operator: "in", value: ["Class A", "Class B"] },
          },
        ],
        default: { field: "roof_type", operator: "eq", value: "Class A" },
      },
      mitigations: [],
    };
    const result = RuleSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("conditional_threshold");
    }
  });

  it("valid computed_with_modifiers config parses correctly", () => {
    const input = {
      id: VALID_UUID,
      name: "Window Rule",
      description: "Computed distance check",
      type: "computed_with_modifiers" as const,
      config: {
        baseValue: 30,
        unit: "feet",
        modifiers: [
          {
            field: "window_type",
            operation: "multiply",
            mapping: { "Single Pane": 3, "Double Pane": 2 },
          },
        ],
        comparisonField: "vegetation[].distance_to_window",
        comparisonOperator: "gte",
      },
      mitigations: [],
    };
    const result = RuleSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("computed_with_modifiers");
    }
  });

  it("rejects invalid operator value", () => {
    const result = OperatorSchema.safeParse("contains");
    expect(result.success).toBe(false);
  });

  it("rejects SimpleConfig missing required field 'field'", () => {
    const result = SimpleConfigSchema.safeParse({
      operator: "eq",
      value: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects wrong value type in ComputedConfig baseValue", () => {
    const result = ComputedConfigSchema.safeParse({
      baseValue: "thirty",
      unit: "feet",
      modifiers: [
        {
          field: "f",
          operation: "multiply",
          mapping: { a: 1 },
        },
      ],
      comparisonField: "x",
      comparisonOperator: "gte",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("baseValue");
    }
  });

  it("discriminated union: simple_threshold type rejects ConditionalConfig shape", () => {
    const input = {
      id: VALID_UUID,
      name: "Bad Rule",
      description: "Mismatched config",
      type: "simple_threshold" as const,
      config: {
        conditions: [
          {
            when: { field: "x", operator: "eq", value: "y" },
            then: { field: "x", operator: "eq", value: "y" },
          },
        ],
        default: { field: "x", operator: "eq", value: "y" },
      },
      mitigations: [],
    };
    const result = RuleSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("discriminated union: conditional_threshold type rejects SimpleConfig shape", () => {
    const input = {
      id: VALID_UUID,
      name: "Bad Rule",
      description: "Mismatched config",
      type: "conditional_threshold" as const,
      config: {
        field: "attic_vent_screens",
        operator: "eq",
        value: "Ember Resistant",
      },
      mitigations: [],
    };
    const result = RuleSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mitigation schemas
// ---------------------------------------------------------------------------

describe("Mitigation schemas", () => {
  it("full mitigation without effect parses", () => {
    const result = MitigationSchema.safeParse({
      id: VALID_UUID,
      name: "Fix it",
      description: "Full fix",
      category: "full",
    });
    expect(result.success).toBe(true);
  });

  it("bridge mitigation with multiplier effect parses", () => {
    const result = MitigationSchema.safeParse({
      id: VALID_UUID,
      name: "Apply Film",
      description: "Temporary film",
      category: "bridge",
      effect: { type: "multiplier", value: 0.8 },
    });
    expect(result.success).toBe(true);
  });

  it("bridge mitigation with override effect parses", () => {
    const result = MitigationSchema.safeParse({
      id: VALID_UUID,
      name: "Override Mit",
      description: "Override value",
      category: "bridge",
      effect: { type: "override", value: 100 },
    });
    expect(result.success).toBe(true);
  });

  it("bridge mitigation without effect is rejected", () => {
    const result = MitigationSchema.safeParse({
      id: VALID_UUID,
      name: "Bad Bridge",
      description: "Missing effect",
      category: "bridge",
    });
    expect(result.success).toBe(false);
  });

  it("invalid effect type value is rejected", () => {
    const result = BridgeEffectSchema.safeParse({
      type: "additive",
      value: 5,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Observation schemas
// ---------------------------------------------------------------------------

describe("Observation schemas", () => {
  it("complete observation with all fields parses", () => {
    const result = ObservationSchema.safeParse({
      property_id: "PROP-001",
      state: "CA",
      attic_vent_screens: "Ember Resistant",
      roof_type: "Class A",
      window_type: "Tempered Glass",
      wildfire_risk_category: "B",
      vegetation: [{ type: "Tree", distance_to_window: 50 }],
      home_to_home_distance: 20,
    });
    expect(result.success).toBe(true);
  });

  it("rejects observation missing globally required field property_id", () => {
    const result = ObservationSchema.safeParse({
      state: "CA",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("property_id");
    }
  });

  it("rejects observation missing globally required field state", () => {
    const result = ObservationSchema.safeParse({
      property_id: "PROP-001",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("state");
    }
  });

  it("extra unknown fields pass through (extensibility via passthrough)", () => {
    const result = ObservationSchema.safeParse({
      property_id: "PROP-001",
      state: "CA",
      custom_field: "hello",
      another_field: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).custom_field).toBe("hello");
      expect((result.data as Record<string, unknown>).another_field).toBe(42);
    }
  });

  it("vegetation array items validated (invalid type rejected)", () => {
    const result = ObservationSchema.safeParse({
      property_id: "PROP-001",
      state: "CA",
      vegetation: [{ type: "Cactus", distance_to_window: 10 }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Seed data validation
// ---------------------------------------------------------------------------

describe("Seed data validation", () => {
  it("all 4 seed rules parse through RuleSchema", () => {
    expect(SEED_RULES).toHaveLength(4);
    for (const rule of SEED_RULES) {
      const result = RuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
    }
  });

  it("all 5 seed observations parse through ObservationSchema", () => {
    const observations = [
      OBS_ALL_PASSING,
      OBS_ATTIC_VENT_FAIL,
      OBS_WINDOWS_FAIL,
      OBS_AUTO_DECLINE,
      OBS_MULTIPLE_FAILS,
    ];
    expect(observations).toHaveLength(5);
    for (const obs of observations) {
      const result = ObservationSchema.safeParse(obs);
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// API schemas
// ---------------------------------------------------------------------------

describe("API schemas", () => {
  it("valid EvaluateRequest parses", () => {
    const result = EvaluateRequestSchema.safeParse({
      observations: { property_id: "PROP-001", state: "CA" },
      release_id: null,
    });
    expect(result.success).toBe(true);
  });

  it("valid CreateReleaseRequest parses", () => {
    const result = CreateReleaseRequestSchema.safeParse({
      name: "v1.0.0",
    });
    expect(result.success).toBe(true);
  });

  it("valid LoginRequest parses", () => {
    const result = LoginRequestSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });
});
