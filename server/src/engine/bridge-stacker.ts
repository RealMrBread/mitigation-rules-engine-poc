import type {
  BridgeStackBreakdown,
  BridgeStackBreakdownItem,
} from "@shared/types/evaluation.js";
import type { BridgeEffect } from "@shared/types/rule.js";

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface BridgeStackInput {
  base_threshold: number;
  actual_value: number;
  comparison_operator: "gte" | "gt";
  selected_bridges: Array<{
    name: string;
    effect: { type: "multiplier"; value: number };
  }>;
}

export type BridgeStackResult = BridgeStackBreakdown;

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Computes the stacked effect of one or more bridge mitigations on a
 * numeric threshold.
 *
 * Each bridge carries a multiplier that is applied cumulatively to the
 * base threshold.  The final (relaxed) threshold is then compared against
 * the actual observed value using the supplied comparison operator.
 *
 * @example
 *   // Two bridges relax the threshold: 90 * 0.8 * 0.5 = 36
 *   computeBridgeStack({
 *     base_threshold: 90,
 *     actual_value: 50,
 *     comparison_operator: "gte",
 *     selected_bridges: [
 *       { name: "Sprinklers",   effect: { type: "multiplier", value: 0.8 } },
 *       { name: "Fire Barrier", effect: { type: "multiplier", value: 0.5 } },
 *     ],
 *   });
 */
export function computeBridgeStack(input: BridgeStackInput): BridgeStackResult {
  const { base_threshold, actual_value, comparison_operator, selected_bridges } =
    input;

  // 1. Compute the cumulative modifier product
  const bridge_modifier_product =
    selected_bridges.length === 0
      ? 1
      : selected_bridges.reduce((product, b) => product * b.effect.value, 1);

  // 2. Derive the final (relaxed) threshold
  const final_threshold = base_threshold * bridge_modifier_product;

  // 3. Build the per-bridge breakdown with running totals
  const breakdown: BridgeStackBreakdownItem[] = [];
  let running = base_threshold;

  for (const bridge of selected_bridges) {
    running = running * bridge.effect.value;
    breakdown.push({
      bridge: bridge.name,
      modifier: bridge.effect.value,
      running_threshold: running,
    });
  }

  // 4. Evaluate the comparison
  const passes =
    comparison_operator === "gte"
      ? actual_value >= final_threshold
      : actual_value > final_threshold;

  return {
    base_threshold,
    bridge_modifier_product,
    final_threshold,
    actual_value,
    passes,
    breakdown,
  };
}
