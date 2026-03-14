import type { EvalResult } from "../../../shared/types/evaluation.js";
import type { Rule } from "../../../shared/types/rule.js";
import type { Evaluator } from "./evaluator.interface.js";
import { UnknownRuleTypeError } from "./errors.js";

/**
 * Central registry that maps rule type strings to their Evaluator
 * implementations. The engine uses this to dispatch evaluation for any rule.
 */
export class EvaluatorRegistry {
  private evaluators = new Map<string, Evaluator>();

  /**
   * Register an evaluator for the given rule type.
   * If an evaluator is already registered for that type it will be replaced.
   */
  register(type: string, evaluator: Evaluator): void {
    this.evaluators.set(type, evaluator);
  }

  /**
   * Retrieve the evaluator for the given rule type.
   * @throws {UnknownRuleTypeError} if no evaluator has been registered.
   */
  get(type: string): Evaluator {
    const evaluator = this.evaluators.get(type);
    if (!evaluator) {
      throw new UnknownRuleTypeError(type);
    }
    return evaluator;
  }

  /**
   * Convenience method: look up the correct evaluator for `rule.type`,
   * run it against the provided observations, and return both the rule
   * and its evaluation result.
   */
  evaluate(
    rule: Rule,
    observations: Record<string, any>,
  ): { rule: Rule; result: EvalResult } {
    const evaluator = this.get(rule.type);
    const result = evaluator.evaluate(rule.config, observations);
    return { rule, result };
  }
}
