/**
 * End-to-end smoke test that validates the full API flow:
 *   1. Login as underwriter, evaluate observations, select mitigations, verify result
 *   2. Login as applied_science, create rule, publish release, activate
 *   3. Login as admin, update settings
 *
 * Uses a dedicated test database. Seeds users and rules via Prisma directly.
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

async function seedUser(email: string, role: string) {
  return testDb.user.create({
    data: { email, passwordHash: PASSWORD_HASH, role },
  });
}

function tokenFor(user: { id: string; email: string; role: string }) {
  return signToken({ userId: user.id, email: user.email, role: user.role });
}

async function seedRulesAndRelease(userId: string) {
  // Seed draft rules
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
    data: { name: 'v1.0-smoke', publishedBy: userId, isActive: true },
  });

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
    update: { value: 3 as any },
    create: { key: 'bridge_mitigation_limit', value: 3 as any },
  });

  return release;
}

// ===========================================================================
// Smoke Test
// ===========================================================================

describe('End-to-end smoke test', () => {
  it('validates the full API flow across all roles', async () => {
    // ── Seed users ──────────────────────────────────────────────────────
    const uwUser = await seedUser('underwriter@smoke.com', 'underwriter');
    const sciUser = await seedUser('scientist@smoke.com', 'applied_science');
    const adminUser = await seedUser('admin@smoke.com', 'admin');

    // Seed rules + release for initial underwriter flow
    await seedRulesAndRelease(sciUser.id);

    // ── Step 1: Login as underwriter ────────────────────────────────────
    const uwLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'underwriter@smoke.com', password: TEST_PASSWORD });

    expect(uwLoginRes.status).toBe(200);
    const uwToken = uwLoginRes.body.data.token;
    expect(uwToken).toBeTruthy();

    // ── Step 2: Evaluate with OBS_ATTIC_VENT_FAIL ──────────────────────
    const evalRes = await request(app)
      .post('/api/evaluate')
      .set('Authorization', `Bearer ${uwToken}`)
      .send({ observations: OBS_ATTIC_VENT_FAIL, release_id: null });

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.data).toHaveProperty('evaluation_id');
    expect(evalRes.body.data).toHaveProperty('vulnerabilities');

    const evaluationId = evalRes.body.data.evaluation_id;
    const triggered = evalRes.body.data.vulnerabilities.filter(
      (v: any) => v.triggered,
    );
    expect(triggered.length).toBeGreaterThan(0);

    // ── Step 3: Select a full mitigation ────────────────────────────────
    const atticVentVuln = triggered.find(
      (v: any) => v.rule_id === SEED_RULES[0].id,
    );
    expect(atticVentVuln).toBeTruthy();

    const mitRes = await request(app)
      .post(`/api/evaluate/${evaluationId}/mitigations`)
      .set('Authorization', `Bearer ${uwToken}`)
      .send({
        selections: [
          {
            rule_id: SEED_RULES[0].id,
            mitigation_id: SEED_RULES[0].mitigations[0].id,
            category: 'full',
          },
        ],
      });

    expect(mitRes.status).toBe(200);
    expect(mitRes.body.data).toEqual({ success: true });

    // ── Step 4: GET evaluation by id ────────────────────────────────────
    const getEvalRes = await request(app)
      .get(`/api/evaluations/${evaluationId}`)
      .set('Authorization', `Bearer ${uwToken}`);

    expect(getEvalRes.status).toBe(200);
    expect(getEvalRes.body.data.evaluation_id).toBe(evaluationId);
    expect(getEvalRes.body.data).toHaveProperty('vulnerabilities');
    expect(getEvalRes.body.data).toHaveProperty('summary');

    // ── Step 5: Login as applied_science ────────────────────────────────
    const sciLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'scientist@smoke.com', password: TEST_PASSWORD });

    expect(sciLoginRes.status).toBe(200);
    const sciToken = sciLoginRes.body.data.token;

    // ── Step 6: Create a new rule ───────────────────────────────────────
    const newRuleRes = await request(app)
      .post('/api/rules')
      .set('Authorization', `Bearer ${sciToken}`)
      .send({
        name: 'Smoke Test Rule',
        description: 'A rule created during smoke testing',
        type: 'simple_threshold',
        config: {
          field: 'roof_age',
          operator: 'gte',
          value: 30,
        },
        mitigations: [
          {
            id: 'c0000000-0000-4000-a000-000000000001',
            name: 'Replace Roof',
            description: 'Full roof replacement',
            category: 'full',
          },
        ],
      });

    expect(newRuleRes.status).toBe(201);
    expect(newRuleRes.body.data).toHaveProperty('id');
    expect(newRuleRes.body.data.name).toBe('Smoke Test Rule');

    // ── Step 7: Publish a new release ───────────────────────────────────
    const publishRes = await request(app)
      .post('/api/releases')
      .set('Authorization', `Bearer ${sciToken}`)
      .send({ name: 'v2.0-smoke' });

    expect(publishRes.status).toBe(201);
    const newReleaseId = publishRes.body.data.id;

    // ── Step 8: Activate the new release ────────────────────────────────
    const activateRes = await request(app)
      .put(`/api/releases/${newReleaseId}/activate`)
      .set('Authorization', `Bearer ${sciToken}`);

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.isActive).toBe(true);

    // ── Step 9: Login as admin ──────────────────────────────────────────
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@smoke.com', password: TEST_PASSWORD });

    expect(adminLoginRes.status).toBe(200);
    const adminToken = adminLoginRes.body.data.token;

    // ── Step 10: Update settings (bridge limit) ─────────────────────────
    const settingsRes = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bridge_mitigation_limit: 5 });

    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.data.bridge_mitigation_limit).toBe(5);

    // Verify the setting persisted
    const getSettingsRes = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getSettingsRes.status).toBe(200);
    expect(getSettingsRes.body.data.bridge_mitigation_limit).toBe(5);
  });
});
