/**
 * Performance benchmark tests for the evaluation engine.
 *
 * 1. Evaluation latency: each request completes in < 2000ms.
 * 2. Reproducibility: identical inputs produce identical outputs.
 *
 * Uses a dedicated test database seeded via Prisma directly.
 * DATABASE_URL and JWT_SECRET are set in vitest.config.ts.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { hashSync } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../app.js';
import { signToken } from '../../lib/jwt.js';
import { SEED_RULES } from '@shared/data/seed-rules.js';
import { OBS_ATTIC_VENT_FAIL } from '@shared/data/seed-observations.js';

// ---------------------------------------------------------------------------
// Test PrismaClient
// ---------------------------------------------------------------------------

const testDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://managpan@localhost:5432/mitigation_rules_engine_test',
    },
  },
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'Test1234!';
const PASSWORD_HASH = hashSync(TEST_PASSWORD, 4);
const ITERATIONS = 10;
const MAX_LATENCY_MS = 2000;

// State seeded by beforeEach
let token: string;
let releaseId: string;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await testDb.$connect();
});

beforeEach(async () => {
  // Truncate all tables
  await testDb.$executeRawUnsafe(
    `TRUNCATE TABLE users, rules, releases, release_rules, evaluations,
     evaluation_mitigations, policy_locks, audit_log, settings
     CASCADE`,
  );

  // Seed a user
  const user = await testDb.user.create({
    data: { email: 'perf-user@example.com', passwordHash: PASSWORD_HASH, role: 'underwriter' },
  });
  token = signToken({ userId: user.id, email: user.email, role: user.role });

  // Seed all 4 rules
  for (const rule of SEED_RULES) {
    await testDb.rule.create({
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description ?? '',
        type: rule.type,
        config: rule.config as any,
        mitigations: rule.mitigations as any,
        createdById: user.id,
      },
    });
  }

  // Create and activate a release
  const release = await testDb.release.create({
    data: { name: 'v-perf-test', publishedBy: user.id, isActive: true },
  });
  releaseId = release.id;

  // Snapshot rules into release_rules
  for (const rule of SEED_RULES) {
    await testDb.releaseRule.create({
      data: {
        releaseId: release.id,
        ruleId: rule.id,
        ruleSnapshot: {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          type: rule.type,
          config: rule.config,
          mitigations: rule.mitigations,
          version: 1,
        } as any,
      },
    });
  }

  // Seed bridge limit setting
  await testDb.setting.upsert({
    where: { key: 'bridge_mitigation_limit' },
    update: { value: 2 as any },
    create: { key: 'bridge_mitigation_limit', value: 2 as any },
  });
});

afterAll(async () => {
  await testDb.$disconnect();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeader() {
  return { Authorization: `Bearer ${token}` };
}

async function runEvaluation() {
  return request(app)
    .post('/api/evaluate')
    .set(authHeader())
    .send({
      observations: OBS_ATTIC_VENT_FAIL,
      release_id: null,
    });
}

// ===========================================================================
// Performance benchmarks
// ===========================================================================

describe('Evaluation performance', () => {
  it('1 - Each evaluation completes in under 2000ms (10 iterations)', async () => {
    const durations: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      const res = await runEvaluation();
      const elapsed = performance.now() - start;

      expect(res.status).toBe(200);
      durations.push(elapsed);
    }

    // Assert every single request was under the threshold
    for (let i = 0; i < durations.length; i++) {
      expect(durations[i]).toBeLessThan(MAX_LATENCY_MS);
    }

    // Log summary for visibility
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);
    console.log(
      `[perf] ${ITERATIONS} evaluations: avg=${avg.toFixed(1)}ms, min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms`,
    );
  });

  it('2 - Identical observations produce identical results (reproducibility)', async () => {
    const results: string[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const res = await runEvaluation();
      expect(res.status).toBe(200);

      // Strip fields that are expected to differ between runs
      const body = { ...res.body.data };
      delete body.evaluation_id;
      delete body.created_at;
      if (body.release) {
        delete body.release.created_at;
      }

      results.push(JSON.stringify(body));
    }

    // Every result should be identical to the first
    const baseline = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBe(baseline);
    }
  });
});
