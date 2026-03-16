import { releaseRepository, type ReleaseWithRules } from '../db/repositories/release.repository.js';
import { ruleRepository } from '../db/repositories/rule.repository.js';
import { auditLogRepository } from '../db/repositories/audit-log.repository.js';
import { defaultRegistry } from '../engine/engine.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { Release } from '@prisma/client';

/** Map a Prisma Release to consistent snake_case API format. */
function toApiRelease(r: Release) {
  return {
    id: r.id,
    name: r.name,
    published_at: r.publishedAt.toISOString(),
    published_by: r.publishedBy,
    is_active: r.isActive,
  };
}

/** Map a ReleaseWithRules to API format including release_rules. */
function toApiReleaseWithRules(r: ReleaseWithRules) {
  return {
    ...toApiRelease(r),
    release_rules: r.releaseRules.map((rr) => ({
      id: rr.id,
      release_id: rr.releaseId,
      rule_id: rr.ruleId,
      rule_snapshot: rr.ruleSnapshot,
    })),
  };
}

/**
 * Publish a new release by snapshotting all current draft rules.
 * Validates every draft rule before publishing.
 */
export async function publish(name: string, userId: string) {
  // Validate all draft rules before publishing
  const draftRules = await ruleRepository.list();

  if (draftRules.length === 0) {
    throw new ValidationError('Cannot publish a release with no rules');
  }

  const allErrors: string[] = [];
  for (const rule of draftRules) {
    const evaluator = defaultRegistry.get(rule.type);
    const { valid, errors } = evaluator.validate(rule.config);
    if (!valid) {
      allErrors.push(`Rule "${rule.name}" (${rule.id}): ${errors.join(', ')}`);
    }
  }

  if (allErrors.length > 0) {
    throw new ValidationError('Some rules have invalid configurations', allErrors);
  }

  const release = await releaseRepository.publish(name, userId);

  await auditLogRepository.append(
    'release.published',
    'release',
    release.id,
    userId,
    { name, ruleCount: release.releaseRules.length },
  );

  return toApiReleaseWithRules(release);
}

/**
 * Activate a release. Only one release may be active at a time.
 */
export async function activate(id: string, userId: string) {
  // Verify the release exists
  const release = await releaseRepository.findById(id);
  if (!release) {
    throw new NotFoundError(`Release ${id} not found`);
  }

  const activated = await releaseRepository.activate(id);

  await auditLogRepository.append(
    'release.activated',
    'release',
    id,
    userId,
    { name: activated.name },
  );

  return toApiRelease(activated);
}

/**
 * Find a release by id or throw NotFoundError.
 */
export async function findById(id: string) {
  const release = await releaseRepository.findById(id);
  if (!release) {
    throw new NotFoundError(`Release ${id} not found`);
  }
  return release;
}

/**
 * Find a release by id with its rule snapshots, or throw NotFoundError.
 */
export async function findByIdWithRules(id: string) {
  const release = await releaseRepository.findByIdWithRules(id);
  if (!release) {
    throw new NotFoundError(`Release ${id} not found`);
  }
  return release;
}

/**
 * Get rules from the currently active release.
 * Returns the rule snapshots from the active release.
 */
export async function getActiveRules() {
  const active = await releaseRepository.findActive();
  if (!active) {
    return [];
  }

  const release = await releaseRepository.findByIdWithRules(active.id);
  if (!release) {
    return [];
  }

  return release.releaseRules.map((rr) => rr.ruleSnapshot);
}

/**
 * Get rules for a specific release, mapped to API format.
 */
export async function getRulesForRelease(id: string) {
  const release = await releaseRepository.findByIdWithRules(id);
  if (!release) {
    throw new NotFoundError(`Release ${id} not found`);
  }
  return release.releaseRules.map((rr) => ({
    id: rr.id,
    release_id: rr.releaseId,
    rule_id: rr.ruleId,
    rule_snapshot: rr.ruleSnapshot,
  }));
}

/**
 * List all releases, mapped to a consistent API format.
 */
export async function list() {
  const releases = await releaseRepository.list();
  return releases.map(toApiRelease);
}
