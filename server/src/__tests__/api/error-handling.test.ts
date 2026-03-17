/**
 * Comprehensive error-handling hardening tests.
 *
 * Validates that every documented error code (HLD Section 6.8) is returned
 * with the correct status, error.code, and error.message shape.
 *
 * Uses a dedicated test database seeded via Prisma directly.
 * DATABASE_URL and JWT_SECRET are set in vitest.config.ts.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { hashSync } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import app from '../../app.js';
import { signToken } from '../../lib/jwt.js';
import { SEED_RULES } from '@shared/data/seed-rules.js';
import { OBS_ATTIC_VENT_FAIL, OBS_ALL_PASSING } from '@shared/data/seed-observations.js';

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
const JWT_SECRET = 'test-jwt-secret-do-not-use'; // must match vitest.config.ts

const VALID_RULE_BODY = {
  name: 'Roof Age Check',
  description: 'Flag properties with old roofs',
  type: 'simple_threshold' as const,
  config: {
    field: 'roof_age',
    operator: 'gte',
    value: 20,
  },
  mitigations: [
    {
      id: '00000000-0000-4000-a000-000000000001',
      name: 'Roof replacement',
      description: 'Full roof replacement required',
      category: 'full' as const,
    },
  ],
};

// A UUID that does not exist in the DB
const NONEXISTENT_UUID = '00000000-0000-4000-a000-ffffffffffff';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await testDb.$connect();
});

beforeEach(async () => {
  await testDb.$executeRawUnsafe(
    `TRUNCATE TABLE users, rules, releases, release_rules, evaluations,
     evaluation_mitigations, policy_locks, audit_log, settings
     CASCADE`,
  );
});

afterAll(async () => {
  await testDb.$disconnect();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedUser(email: string, role = 'applied_science') {
  return testDb.user.create({
    data: { email, passwordHash: PASSWORD_HASH, role },
  });
}

function tokenFor(user: { id: string; email: string; role: string }) {
  return signToken({ userId: user.id, email: user.email, role: user.role });
}

/** Seed 4 rules, publish a release, activate it, and return the release id. */
async function seedActiveRelease(userId: string): Promise<string> {
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

  const release = await testDb.release.create({
    data: { name: 'v-err-test', publishedBy: userId, isActive: true },
  });

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

  await testDb.setting.upsert({
    where: { key: 'bridge_mitigation_limit' },
    update: { value: 2 as any },
    create: { key: 'bridge_mitigation_limit', value: 2 as any },
  });

  return release.id;
}

// ===========================================================================
// 401 -- Authentication errors
// ===========================================================================

describe('401 -- Authentication errors', () => {
  it('1 - No token: GET /api/rules without auth returns 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/rules');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('2 - Invalid token: GET /api/rules with bad JWT returns 401', async () => {
    const res = await request(app)
      .get('/api/rules')
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt');

    expect(res.status).toBe(401);
    // Auth middleware catches all JWT errors as UNAUTHORIZED
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('3 - Expired token: GET /api/rules with expired JWT returns 401', async () => {
    const user = await seedUser('expired@example.com');

    // Sign a token that expired 10 seconds ago
    const expiredToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '-10s' },
    );

    const res = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    // Auth middleware catches TokenExpiredError as UNAUTHORIZED
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(typeof res.body.error.message).toBe('string');
  });
});

// ===========================================================================
// 403 -- Authorization / role errors
// ===========================================================================

describe('403 -- Authorization / role errors', () => {
  it('4 - Underwriter cannot POST /api/rules (requires applied_science)', async () => {
    const underwriter = await seedUser('uw@example.com', 'underwriter');
    const token = tokenFor(underwriter);

    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('5 - Applied science cannot GET /api/admin/settings (requires admin)', async () => {
    const scientist = await seedUser('sci@example.com', 'applied_science');
    const token = tokenFor(scientist);

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(typeof res.body.error.message).toBe('string');
  });
});

// ===========================================================================
// 404 -- Not Found
// ===========================================================================

describe('404 -- Not Found', () => {
  it('6 - Unknown rule: GET /api/rules/:id returns 404 NOT_FOUND', async () => {
    const user = await seedUser('sci@example.com', 'applied_science');
    const token = tokenFor(user);

    const res = await request(app)
      .get(`/api/rules/${NONEXISTENT_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('7 - Unknown evaluation: GET /api/evaluations/:id returns 404 NOT_FOUND', async () => {
    const user = await seedUser('uw@example.com', 'underwriter');
    const token = tokenFor(user);

    const res = await request(app)
      .get(`/api/evaluations/${NONEXISTENT_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });
});

// ===========================================================================
// 400 -- Validation errors
// ===========================================================================

describe('400 -- Validation errors', () => {
  it('8 - Invalid rule config: POST /api/rules with missing config.field returns 400', async () => {
    const user = await seedUser('sci@example.com', 'applied_science');
    const token = tokenFor(user);

    const badBody = {
      name: 'Bad Rule',
      description: 'Missing config field',
      type: 'simple_threshold',
      config: {
        // field is missing
        operator: 'gte',
        value: 20,
      },
      mitigations: [],
    };

    const res = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(badBody);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('9 - Invalid evaluation body: POST /api/evaluate with empty observations returns 400', async () => {
    const user = await seedUser('uw@example.com', 'underwriter');
    const token = tokenFor(user);

    // Send a body missing the required observations/release_id fields
    const res = await request(app)
      .post('/api/evaluate')
      .set('Authorization', `Bearer ${token}`)
      .send({ bad: 'data' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof res.body.error.message).toBe('string');
  });
});

// ===========================================================================
// 409 -- Optimistic locking conflict
// ===========================================================================

describe('409 -- Optimistic locking conflict', () => {
  it('10 - Update a rule with wrong version returns 409 CONFLICT', async () => {
    const user = await seedUser('sci@example.com', 'applied_science');
    const token = tokenFor(user);

    // Create rule via API
    const createRes = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RULE_BODY);

    const ruleId = createRes.body.data.id;

    // Attempt update with stale version
    const res = await request(app)
      .put(`/api/rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Stale Update',
        version: 999, // wrong version
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(typeof res.body.error.message).toBe('string');
  });
});

// ===========================================================================
// 503 -- No active release
// ===========================================================================

describe('503 -- No active release', () => {
  it('11 - Evaluate when no active release exists returns 503 NO_ACTIVE_RELEASE', async () => {
    const user = await seedUser('uw@example.com', 'underwriter');
    const token = tokenFor(user);

    // No releases seeded -- DB is empty after truncate
    const res = await request(app)
      .post('/api/evaluate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        observations: OBS_ALL_PASSING,
        release_id: null,
      });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('NO_ACTIVE_RELEASE');
    expect(typeof res.body.error.message).toBe('string');
  });
});
