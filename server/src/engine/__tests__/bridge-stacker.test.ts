import { describe, it, expect } from "vitest";
import { computeBridgeStack, type BridgeStackInput } from "../bridge-stacker.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bridge(name: string, value: number) {
  return { name, effect: { type: "multiplier" as const, value } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeBridgeStack", () => {
  it("returns base threshold with no breakdown when bridges array is empty", () => {
    const input: BridgeStackInput = {
      base_threshold: 90,
      actual_value: 50,
      comparison_operator: "gte",
      selected_bridges: [],
    };

    const result = computeBridgeStack(input);

    expect(result.base_threshold).toBe(90);
    expect(result.bridge_modifier_product).toBe(1);
    expect(result.final_threshold).toBe(90);
    expect(result.actual_value).toBe(50);
    expect(result.passes).toBe(false); // 50 >= 90 is false
    expect(result.breakdown).toEqual([]);
  });

  it("applies a single bridge multiplier correctly", () => {
    const input: BridgeStackInput = {
      base_threshold: 90,
      actual_value: 50,
      comparison_operator: "gte",
      selected_bridges: [bridge("Sprinklers", 0.8)],
    };

    const result = computeBridgeStack(input);

    expect(result.bridge_modifier_product).toBe(0.8);
    expect(result.final_threshold).toBe(72); // 90 * 0.8
    expect(result.passes).toBe(false); // 50 >= 72 is false
  });

  it("stacks two bridge multipliers so combined threshold passes", () => {
    const input: BridgeStackInput = {
      base_threshold: 90,
      actual_value: 50,
      comparison_operator: "gte",
      selected_bridges: [bridge("Sprinklers", 0.8), bridge("Fire Barrier", 0.5)],
    };

    const result = computeBridgeStack(input);

    expect(result.bridge_modifier_product).toBeCloseTo(0.4); // 0.8 * 0.5
    expect(result.final_threshold).toBeCloseTo(36); // 90 * 0.4
    expect(result.passes).toBe(true); // 50 >= 36
  });

  it("stacks three bridge multipliers correctly", () => {
    const input: BridgeStackInput = {
      base_threshold: 90,
      actual_value: 50,
      comparison_operator: "gte",
      selected_bridges: [
        bridge("Sprinklers", 0.8),
        bridge("Fire Barrier", 0.75),
        bridge("Setback", 0.5),
      ],
    };

    const result = computeBridgeStack(input);

    // 0.8 * 0.75 * 0.5 = 0.3
    expect(result.bridge_modifier_product).toBeCloseTo(0.3);
    // 90 * 0.3 = 27
    expect(result.final_threshold).toBeCloseTo(27);
    expect(result.passes).toBe(true); // 50 >= 27
  });

  it("produces correct running totals in the breakdown", () => {
    const input: BridgeStackInput = {
      base_threshold: 90,
      actual_value: 50,
      comparison_operator: "gte",
      selected_bridges: [
        bridge("Sprinklers", 0.8),
        bridge("Fire Barrier", 0.75),
        bridge("Setback", 0.5),
      ],
    };

    const result = computeBridgeStack(input);

    expect(result.breakdown).toEqual([
      { bridge: "Sprinklers", modifier: 0.8, running_threshold: 72 },    // 90 * 0.8
      { bridge: "Fire Barrier", modifier: 0.75, running_threshold: 54 }, // 72 * 0.75
      { bridge: "Setback", modifier: 0.5, running_threshold: 27 },      // 54 * 0.5
    ]);
  });

  it("uses strict greater-than when comparison_operator is 'gt'", () => {
    // Exact boundary case: actual equals final threshold
    const input: BridgeStackInput = {
      base_threshold: 100,
      actual_value: 50,
      comparison_operator: "gt",
      selected_bridges: [bridge("Sprinklers", 0.5)],
    };

    const result = computeBridgeStack(input);

    expect(result.final_threshold).toBe(50); // 100 * 0.5
    // 50 > 50 is false (strict)
    expect(result.passes).toBe(false);

    // Bump actual_value just above
    const passingResult = computeBridgeStack({ ...input, actual_value: 50.01 });
    expect(passingResult.passes).toBe(true);
  });

  it("handles gte at the exact boundary (actual equals final threshold)", () => {
    const input: BridgeStackInput = {
      base_threshold: 100,
      actual_value: 50,
      comparison_operator: "gte",
      selected_bridges: [bridge("Sprinklers", 0.5)],
    };

    const result = computeBridgeStack(input);

    // 50 >= 50 is true
    expect(result.passes).toBe(true);
  });
});
