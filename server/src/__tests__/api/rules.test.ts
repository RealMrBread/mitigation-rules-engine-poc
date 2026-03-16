/**
 * Integration tests for rule CRUD routes and release routes.
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

/** A valid simple_threshold rule body (no id — server generates it) */
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

/** Invalid config (missing required field) */
const INVALID_RULE_BODY = {
  name: 'Bad Rule',
  description: 'Missing config field',
  type: 'simple_threshold' as const,
  config: {
    // field is missing
    operator: 'gte',
    value: 20,
  },
  mitigations: [],
};

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

async function createRuleViaApi(token: string, body = VALID_RULE_BODY) {
  return request(app)
    .post('/api/rules')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

// ===========================================================================
// Rule CRUD Routes
// ===========================================================================

describe('Rule CRUD — /api/rules', () => {
  it('1 - POST /api/rules creates a rule (201)', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    const res = await createRuleViaApi(token);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: VALID_RULE_BODY.name,
      type: VALID_RULE_BODY.type,
    });
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.version).toBe(1);
  });

  it('2 - GET /api/rules lists rules', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    await createRuleViaApi(token);
    await createRuleViaApi(token, {
      ...VALID_RULE_BODY,
      name: 'Second Rule',
    });

    const res = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('3 - GET /api/rules/:id returns rule detail', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    const createRes = await createRuleViaApi(token);
    const ruleId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ruleId);
    expect(res.body.data.name).toBe(VALID_RULE_BODY.name);
  });

  it('4 - PUT /api/rules/:id updates rule', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    const createRes = await createRuleViaApi(token);
    const ruleId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Roof Check',
        version: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Roof Check');
    expect(res.body.data.version).toBe(2);
  });

  it('5 - PUT /api/rules/:id with wrong version returns 409', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    const createRes = await createRuleViaApi(token);
    const ruleId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Stale Update',
        version: 99, // wrong version
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('6 - DELETE /api/rules/:id removes rule (204)', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    const createRes = await createRuleViaApi(token);
    const ruleId = createRes.body.data.id;

    const delRes = await request(app)
      .delete(`/api/rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(204);

    // Verify it's gone
    const getRes = await request(app)
      .get(`/api/rules/${ruleId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(404);
  });

  it('7 - POST /api/rules with invalid config returns 400', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    const res = await createRuleViaApi(token, INVALID_RULE_BODY as any);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('8 - POST /api/rules/:id/test returns evaluation without saving', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    const createRes = await createRuleViaApi(token);
    const ruleId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/rules/${ruleId}/test`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        observations: {
          property_id: 'PROP-001',
          state: 'CA',
          year_built: 1990,
          roof_age: 10,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('evaluation_id');
    expect(res.body.data).toHaveProperty('vulnerabilities');
    // Rule should trigger since roof_age (10) < 20 (fails the gte 20 passing condition)
    expect(res.body.data.vulnerabilities.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.vulnerabilities[0].triggered).toBe(true);
  });
});

// ===========================================================================
// Release Routes
// ===========================================================================

describe('Release Routes — /api/releases', () => {
  it('9 - POST /api/releases publishes release (201)', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    // First create a rule so the release has something to snapshot
    await createRuleViaApi(token);

    const res = await request(app)
      .post('/api/releases')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v1.0' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'v1.0',
      is_active: false,
    });
    expect(res.body.data.release_rules).toHaveLength(1);
  });

  it('10 - PUT /api/releases/:id/activate activates release', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    await createRuleViaApi(token);

    const publishRes = await request(app)
      .post('/api/releases')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v1.0' });

    const releaseId = publishRes.body.data.id;

    const res = await request(app)
      .put(`/api/releases/${releaseId}/activate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(true);
  });

  it('11 - GET /api/releases/active/rules returns rules from active release', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    // Create a rule, publish, and activate
    await createRuleViaApi(token);

    const publishRes = await request(app)
      .post('/api/releases')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v1.0' });

    const releaseId = publishRes.body.data.id;

    await request(app)
      .put(`/api/releases/${releaseId}/activate`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/releases/active/rules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('name', VALID_RULE_BODY.name);
  });

  it('12 - Non-applied-science user gets 403 on rule routes', async () => {
    const underwriter = await seedUser('uw@example.com', 'underwriter');
    const token = tokenFor(underwriter);

    const res = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('13 - Underwriter CAN access GET /api/releases/active/rules', async () => {
    const scientist = await seedUser('scientist@example.com', 'applied_science');
    const sciToken = tokenFor(scientist);

    // Create rule, publish, activate as scientist
    await createRuleViaApi(sciToken);

    const publishRes = await request(app)
      .post('/api/releases')
      .set('Authorization', `Bearer ${sciToken}`)
      .send({ name: 'v1.0' });

    await request(app)
      .put(`/api/releases/${publishRes.body.data.id}/activate`)
      .set('Authorization', `Bearer ${sciToken}`);

    // Now an underwriter should be able to read active rules
    const underwriter = await seedUser('uw@example.com', 'underwriter');
    const uwToken = tokenFor(underwriter);

    const res = await request(app)
      .get('/api/releases/active/rules')
      .set('Authorization', `Bearer ${uwToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('14 - GET /api/releases lists all releases', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    await createRuleViaApi(token);

    await request(app)
      .post('/api/releases')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v1.0' });

    await request(app)
      .post('/api/releases')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v2.0' });

    const res = await request(app)
      .get('/api/releases')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('15 - GET /api/releases/:id/rules returns rules for a release', async () => {
    const user = await seedUser('scientist@example.com');
    const token = tokenFor(user);

    await createRuleViaApi(token);

    const publishRes = await request(app)
      .post('/api/releases')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'v1.0' });

    const releaseId = publishRes.body.data.id;

    const res = await request(app)
      .get(`/api/releases/${releaseId}/rules`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
