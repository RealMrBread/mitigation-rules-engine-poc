/**
 * Integration tests for evaluation routes:
 *   POST /api/evaluate
 *   POST /api/evaluate/:id/mitigations
 *   GET  /api/evaluations
 *   GET  /api/evaluations/:id
 *
 * Uses a dedicated test database. Sets up users, rules, a release, and
 * activates it before tests run.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { hashSync } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../app.js';
import { signToken } from '../../lib/jwt.js';
import { SEED_RULES } from '@shared/data/seed-rules.js';
import {
  OBS_ALL_PASSING,
  OBS_AUTO_DECLINE,
  OBS_ATTIC_VENT_FAIL,
} from '@shared/data/seed-observations.js';

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

// State seeded by beforeAll
let userId: string;
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
    data: { email: 'eval-user@example.com', passwordHash: PASSWORD_HASH, role: 'underwriter' },
  });
  userId = user.id;
  token = signToken({ userId: user.id, email: user.email, role: user.role });

  // Seed rules into draft workspace
  for (const rule of SEED_RULES) {
    await testDb.rule.create({
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description ?? '',
        type: rule.type,
        config: rule.config as any,
        mitigations: rule.mitigations as any,
        createdById: userId,
      },
    });
  }

  // Create and activate a release
  const release = await testDb.release.create({
    data: { name: 'v1.0-test', publishedBy: userId, isActive: true },
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

// ===========================================================================
// POST /api/evaluate
// ===========================================================================

describe('POST /api/evaluate', () => {
  it('1 - returns vulnerabilities for valid observations', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({
        observations: OBS_ATTIC_VENT_FAIL,
        release_id: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('evaluation_id');
    expect(res.body.data).toHaveProperty('vulnerabilities');
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data.release.id).toBe(releaseId);
    // Attic vent should trigger
    const triggered = res.body.data.vulnerabilities.filter(
      (v: any) => v.triggered,
    );
    expect(triggered.length).toBeGreaterThan(0);
  });

  it('2 - auto-decline when home_to_home_distance < 15', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({
        observations: OBS_AUTO_DECLINE,
        release_id: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.auto_declined).toBe(true);
    expect(res.body.data.summary.auto_decline_vulnerabilities).toBeGreaterThan(0);
  });

  it('3 - release_id null uses active release', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({
        observations: OBS_ALL_PASSING,
        release_id: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.release.id).toBe(releaseId);
  });

  it('4 - without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .send({
        observations: OBS_ALL_PASSING,
        release_id: null,
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('5 - invalid body returns 400', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({ bad: 'data' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('6 - explicit release_id works', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({
        observations: OBS_ALL_PASSING,
        release_id: releaseId,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.release.id).toBe(releaseId);
  });
});

// ===========================================================================
// POST /api/evaluate/:id/mitigations
// ===========================================================================

describe('POST /api/evaluate/:id/mitigations', () => {
  let evaluationId: string;

  beforeEach(async () => {
    // Create an evaluation to work with
    const res = await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({
        observations: OBS_ATTIC_VENT_FAIL,
        release_id: null,
      });
    evaluationId = res.body.data.evaluation_id;
  });

  it('7 - saves mitigation selections', async () => {
    // The attic vent rule triggers and has a full mitigation
    const res = await request(app)
      .post(`/api/evaluate/${evaluationId}/mitigations`)
      .set(authHeader())
      .send({
        selections: [
          {
            rule_id: SEED_RULES[0].id,
            mitigation_id: SEED_RULES[0].mitigations[0].id,
            category: 'full',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true });
  });

  it('8 - enforces bridge limit (422)', async () => {
    // Bridge limit is set to 2 in beforeEach; send 3 bridge selections
    const windowsRule = SEED_RULES[2]; // Windows rule has bridge mitigations
    const res = await request(app)
      .post(`/api/evaluate/${evaluationId}/mitigations`)
      .set(authHeader())
      .send({
        selections: [
          {
            rule_id: windowsRule.id,
            mitigation_id: windowsRule.mitigations[2].id, // Apply Film (bridge)
            category: 'bridge',
          },
          {
            rule_id: windowsRule.id,
            mitigation_id: windowsRule.mitigations[3].id, // Flame Retardant (bridge)
            category: 'bridge',
          },
          {
            rule_id: windowsRule.id,
            mitigation_id: windowsRule.mitigations[4].id, // Prune Trees (bridge)
            category: 'bridge',
          },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BRIDGE_LIMIT_EXCEEDED');
  });
});

// ===========================================================================
// GET /api/evaluations
// ===========================================================================

describe('GET /api/evaluations', () => {
  it('9 - returns list of evaluations', async () => {
    // Create two evaluations
    await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({ observations: OBS_ALL_PASSING, release_id: null });
    await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({ observations: OBS_ATTIC_VENT_FAIL, release_id: null });

    const res = await request(app)
      .get('/api/evaluations')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('10 - filters by property_id query param', async () => {
    await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({ observations: OBS_ALL_PASSING, release_id: null });
    await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({ observations: OBS_ATTIC_VENT_FAIL, release_id: null });

    const res = await request(app)
      .get('/api/evaluations')
      .query({ property_id: 'PROP-001' })
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].propertyId).toBe('PROP-001');
  });
});

// ===========================================================================
// GET /api/evaluations/:id
// ===========================================================================

describe('GET /api/evaluations/:id', () => {
  it('11 - returns evaluation detail', async () => {
    const evalRes = await request(app)
      .post('/api/evaluate')
      .set(authHeader())
      .send({ observations: OBS_ALL_PASSING, release_id: null });
    const evalId = evalRes.body.data.evaluation_id;

    const res = await request(app)
      .get(`/api/evaluations/${evalId}`)
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.evaluation_id).toBe(evalId);
    expect(res.body.data).toHaveProperty('vulnerabilities');
    expect(res.body.data).toHaveProperty('summary');
  });

  it('12 - unknown id returns 404', async () => {
    const res = await request(app)
      .get('/api/evaluations/00000000-0000-4000-a000-000000000099')
      .set(authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
