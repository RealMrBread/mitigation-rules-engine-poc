import { ruleRepository } from '../db/repositories/rule.repository.js';
import { defaultRegistry } from '../engine/engine.js';
import { evaluate } from '../engine/engine.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { Rule } from '@shared/types/rule.js';

/**
 * Create a new rule. Validates the config against the evaluator registry
 * before persisting.
 */
export async function create(
  data: { name: string; description: string; type: string; config: unknown; mitigations: unknown },
  userId: string,
) {
  // Validate config against the evaluator for this rule type
  validateConfig(data.type, data.config);

  return ruleRepository.create({
    name: data.name,
    description: data.description,
    type: data.type,
    config: data.config,
    mitigations: data.mitigations,
    createdById: userId,
  });
}

/**
 * Update an existing rule with optimistic locking.
 * If config or type changes, re-validates.
 */
export async function update(
  id: string,
  data: { name?: string; description?: string; type?: string; config?: unknown; mitigations?: unknown },
  expectedVersion: number,
) {
  // If config is provided, validate it against the evaluator
  if (data.config !== undefined) {
    // If type is also being changed, use new type; otherwise load current rule to get type
    let ruleType = data.type;
    if (!ruleType) {
      const existing = await ruleRepository.findById(id);
      if (!existing) {
        throw new NotFoundError(`Rule ${id} not found`);
      }
      ruleType = existing.type;
    }
    validateConfig(ruleType, data.config);
  }

  return ruleRepository.update(id, data, expectedVersion);
}

/**
 * Delete a rule by id.
 */
export async function remove(id: string) {
  return ruleRepository.delete(id);
}

/**
 * Find a rule by id or throw NotFoundError.
 */
export async function findById(id: string) {
  const rule = await ruleRepository.findById(id);
  if (!rule) {
    throw new NotFoundError(`Rule ${id} not found`);
  }
  return rule;
}

/**
 * List all draft rules.
 */
export async function list() {
  return ruleRepository.list();
}

/**
 * Test a single rule against provided observations without persisting.
 * Loads the rule from DB, runs the engine's evaluate() with just that rule,
 * and returns the result.
 */
export async function test(ruleId: string, observations: Record<string, any>) {
  const dbRule = await findById(ruleId);

  // Convert DB rule to engine Rule shape
  const rule: Rule = {
    id: dbRule.id,
    name: dbRule.name,
    description: dbRule.description ?? '',
    type: dbRule.type as Rule['type'],
    config: dbRule.config as any,
    mitigations: dbRule.mitigations as any,
  };

  return evaluate(observations, [rule], defaultRegistry);
}

/**
 * Validate a rule config using the evaluator registry.
 * Throws ValidationError if invalid.
 */
function validateConfig(type: string, config: unknown): void {
  const evaluator = defaultRegistry.get(type);
  const { valid, errors } = evaluator.validate(config);
  if (!valid) {
    throw new ValidationError('Invalid rule configuration', errors);
  }
}
