import { evaluationRepository } from '../db/repositories/evaluation.repository.js';
import { releaseRepository } from '../db/repositories/release.repository.js';
import { policyLockRepository } from '../db/repositories/policy-lock.repository.js';
import { settingsRepository } from '../db/repositories/settings.repository.js';
import { evaluate as engineEvaluate } from '../engine/engine.js';
import { AppError, BridgeLimitError, NotFoundError } from '../lib/errors.js';
import type { Rule } from '@shared/types/rule.js';
import type { EvaluationResult } from '@shared/types/evaluation.js';

/**
 * Evaluate observations against the rule set from a specific (or active) release.
 *
 * 1. Resolve the release (explicit, policy-locked, or active).
 * 2. Load rule snapshots from the resolved release.
 * 3. Run the engine's evaluate() function.
 * 4. Persist the evaluation record.
 * 5. Create a policy lock if this is the property's first evaluation.
 * 6. Return the result enriched with release info and evaluation_id.
 */
export async function evaluate(
  observations: Record<string, any>,
  releaseId: string | null,
  userId: string,
): Promise<EvaluationResult & { evaluation_id: string }> {
  const propertyId = observations.property_id as string;

  // ── Step 1: Resolve release ──────────────────────────────────────────────
  let resolvedReleaseId: string;

  if (releaseId) {
    resolvedReleaseId = releaseId;
  } else {
    // Check for policy lock on this property
    const lock = await policyLockRepository.findByPropertyId(propertyId);
    if (lock) {
      resolvedReleaseId = lock.releaseId;
    } else {
      const active = await releaseRepository.findActive();
      if (!active) {
        throw new AppError(503, 'NO_ACTIVE_RELEASE', 'No active release available');
      }
      resolvedReleaseId = active.id;
    }
  }

  // ── Step 2: Load rule snapshots ──────────────────────────────────────────
  const release = await releaseRepository.findByIdWithRules(resolvedReleaseId);
  if (!release) {
    throw new NotFoundError(`Release ${resolvedReleaseId} not found`);
  }

  const rules: Rule[] = release.releaseRules.map(
    (rr) => rr.ruleSnapshot as unknown as Rule,
  );

  // ── Step 3: Evaluate ────────────────────────────────────────────────────
  const result = engineEvaluate(observations, rules);

  // Enrich with release info
  result.release = { id: release.id, name: release.name };

  // ── Step 4: Persist evaluation ──────────────────────────────────────────
  const saved = await evaluationRepository.save({
    propertyId,
    releaseId: release.id,
    observations,
    result,
    isAutoDeclined: result.auto_declined,
    createdById: userId,
  });

  // Override the engine-generated evaluation_id with the persisted one
  result.evaluation_id = saved.id;

  // ── Step 5: Create policy lock (first evaluation for this property) ────
  try {
    await policyLockRepository.create(propertyId, release.id, userId);
  } catch (_err: unknown) {
    // Unique constraint violation means the lock already exists -- ignore
  }

  // ── Step 6: Return ─────────────────────────────────────────────────────
  return result;
}

/**
 * Save mitigation selections for an evaluation, enforcing the bridge limit.
 */
export async function selectMitigations(
  evaluationId: string,
  selections: Array<{ rule_id: string; mitigation_id: string; category: string }>,
  _userId: string,
): Promise<void> {
  // 1. Load the evaluation (validates it exists)
  const evaluation = await evaluationRepository.findById(evaluationId);
  if (!evaluation) {
    throw new NotFoundError(`Evaluation ${evaluationId} not found`);
  }

  // 2. Count bridge selections
  const bridgeCount = selections.filter((s) => s.category === 'bridge').length;

  // 3. Load bridge limit from settings (default to 3)
  const bridgeLimitSetting = await settingsRepository.get('bridge_mitigation_limit');
  const bridgeLimit =
    typeof bridgeLimitSetting === 'number' ? bridgeLimitSetting : 3;

  // 4. Enforce bridge limit
  if (bridgeCount > bridgeLimit) {
    throw new BridgeLimitError(bridgeCount, bridgeLimit);
  }

  // 5. Save selections
  await evaluationRepository.saveMitigations(
    evaluationId,
    selections.map((s) => ({
      ruleId: s.rule_id,
      mitigationId: s.mitigation_id,
      category: s.category,
    })),
  );
}

/**
 * List evaluations, optionally filtered by property_id.
 */
export async function listEvaluations(propertyId?: string) {
  if (propertyId) {
    return evaluationRepository.listByProperty(propertyId);
  }
  return evaluationRepository.list();
}

/**
 * Get a single evaluation by id.
 */
export async function getEvaluationById(id: string) {
  const evaluation = await evaluationRepository.findById(id);
  if (!evaluation) {
    throw new NotFoundError(`Evaluation ${id} not found`);
  }
  return evaluation;
}
