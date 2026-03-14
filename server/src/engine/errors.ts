/**
 * Thrown when the EvaluatorRegistry is asked for a rule type that has not been
 * registered.
 */
export class UnknownRuleTypeError extends Error {
  public readonly ruleType: string;

  constructor(type: string) {
    super(`No evaluator registered for rule type: "${type}"`);
    this.name = "UnknownRuleTypeError";
    this.ruleType = type;
  }
}
