import { ComputedConfigSchema } from "../../../../shared/schemas/rule.schema.js";
import type { EvalResult } from "../../../../shared/types/evaluation.js";
import type { ComputedConfig, Modifier } from "../../../../shared/types/rule.js";
import type { Evaluator } from "../evaluator.interface.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ItemComputationDetail {
  item: Record<string, any>;
  modifiers: Array<{
    field: string;
    observedValue: string;
    mappedValue: number;
    operation: "multiply" | "divide";
  }>;
  observationModifierProduct: number;
  threshold: number;
  actualValue: number;
  passes: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a modifier's value from either the current array item or the
 * top-level observations, depending on whether the field contains "[]."
 */
function resolveModifierValue(
  modifier: Modifier,
  observations: Record<string, any>,
  arrayItem?: Record<string, any>,
): string {
  if (modifier.field.includes("[].")) {
    // Array-scoped field -- read from the current item
    const property = modifier.field.split("[].")[1];
    return arrayItem ? String(arrayItem[property]) : "";
  }
  // Top-level observation field
  return String(observations[modifier.field]);
}

/**
 * Resolve the comparison value from either the array item or top-level
 * observations based on the comparisonField format.
 */
function resolveComparisonValue(
  comparisonField: string,
  observations: Record<string, any>,
  arrayItem?: Record<string, any>,
): number {
  if (comparisonField.includes("[].")) {
    const property = comparisonField.split("[].")[1];
    return arrayItem ? Number(arrayItem[property]) : 0;
  }
  return Number(observations[comparisonField]);
}

/**
 * Compare using the specified operator.
 * The passing condition is: actualValue <operator> threshold.
 */
function compare(
  operator: "gte" | "gt",
  actualValue: number,
  threshold: number,
): boolean {
  return operator === "gte"
    ? actualValue >= threshold
    : actualValue > threshold;
}

/**
 * Compute modifiers and threshold for a single evaluation target
 * (either a single observation set or one array item).
 */
function computeForItem(
  config: ComputedConfig,
  observations: Record<string, any>,
  arrayItem?: Record<string, any>,
): ItemComputationDetail {
  const modifierDetails: ItemComputationDetail["modifiers"] = [];
  let observationModifierProduct = 1.0;

  for (const modifier of config.modifiers) {
    const observedValue = resolveModifierValue(modifier, observations, arrayItem);
    const mappedValue = modifier.mapping[observedValue];

    if (mappedValue === undefined) {
      // If the observed value has no mapping entry, skip this modifier
      // (use neutral value of 1)
      modifierDetails.push({
        field: modifier.field,
        observedValue,
        mappedValue: 1,
        operation: modifier.operation,
      });
      continue;
    }

    if (modifier.operation === "multiply") {
      observationModifierProduct *= mappedValue;
    } else {
      observationModifierProduct /= mappedValue;
    }

    modifierDetails.push({
      field: modifier.field,
      observedValue,
      mappedValue,
      operation: modifier.operation,
    });
  }

  const threshold = config.baseValue * observationModifierProduct;
  const actualValue = resolveComparisonValue(
    config.comparisonField,
    observations,
    arrayItem,
  );
  const passes = compare(config.comparisonOperator, actualValue, threshold);

  return {
    item: arrayItem ?? observations,
    modifiers: modifierDetails,
    observationModifierProduct,
    threshold,
    actualValue,
    passes,
  };
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export class ComputedWithModifiersEvaluator implements Evaluator {
  evaluate(config: ComputedConfig, observations: Record<string, any>): EvalResult {
    // Array-based evaluation
    if (config.arrayField) {
      const array: Record<string, any>[] = observations[config.arrayField] ?? [];
      const itemResults: ItemComputationDetail[] = [];

      for (const item of array) {
        itemResults.push(computeForItem(config, observations, item));
      }

      // Rule triggers if ANY item fails
      const anyFailed = itemResults.some((r) => !r.passes);

      const failedItems = itemResults.filter((r) => !r.passes);
      const explanation = anyFailed
        ? `${failedItems.length} of ${itemResults.length} ${config.arrayField} item(s) failed the threshold check.`
        : `All ${itemResults.length} ${config.arrayField} item(s) passed the threshold check.`;

      return {
        triggered: anyFailed,
        details: {
          observedValues: {
            [config.arrayField]: array,
            ...this.extractTopLevelObservedValues(config, observations),
          },
          requiredValues: {
            baseValue: config.baseValue,
            unit: config.unit,
            comparisonOperator: config.comparisonOperator,
          },
          explanation,
          computedThreshold: itemResults.length > 0
            ? itemResults[0].threshold
            : config.baseValue,
          itemBreakdown: itemResults.map((r) => ({
            item: r.item,
            modifiers: r.modifiers,
            observationModifierProduct: r.observationModifierProduct,
            threshold: r.threshold,
            actualValue: r.actualValue,
            passes: r.passes,
          })),
        } as EvalResult["details"],
      };
    }

    // Non-array evaluation
    const result = computeForItem(config, observations);

    const explanation = result.passes
      ? `${config.comparisonField} ${result.actualValue} ${config.comparisonOperator === "gte" ? ">=" : ">"} ${result.threshold} ${config.unit}: Condition met -- no vulnerability.`
      : `${config.comparisonField} ${result.actualValue} ${config.comparisonOperator === "gte" ? "<" : "<="} ${result.threshold} ${config.unit}: Condition NOT met -- vulnerability triggered.`;

    return {
      triggered: !result.passes,
      details: {
        observedValues: this.extractTopLevelObservedValues(config, observations),
        requiredValues: {
          baseValue: config.baseValue,
          unit: config.unit,
          comparisonOperator: config.comparisonOperator,
        },
        computedThreshold: result.threshold,
        explanation,
      },
    };
  }

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = ComputedConfigSchema.safeParse(config);
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

  /**
   * Extract top-level observation values referenced by non-array modifiers.
   */
  private extractTopLevelObservedValues(
    config: ComputedConfig,
    observations: Record<string, any>,
  ): Record<string, any> {
    const values: Record<string, any> = {};
    for (const modifier of config.modifiers) {
      if (!modifier.field.includes("[]")) {
        values[modifier.field] = observations[modifier.field];
      }
    }
    return values;
  }
}
