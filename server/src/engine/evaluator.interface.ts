import type { EvalResult } from "../../../shared/types/evaluation.js";

/**
 * Contract that every rule-type evaluator must implement.
 *
 * `config` is typed as `any` because each evaluator narrows it internally to
 * its specific configuration shape (SimpleConfig, ConditionalConfig, etc.).
 */
export interface Evaluator {
  /** Run the evaluation logic and return a result. */
  evaluate(config: any, observations: Record<string, any>): EvalResult;

  /** Validate that `config` conforms to the expected shape for this evaluator. */
  validate(config: unknown): { valid: boolean; errors: string[] };
}
