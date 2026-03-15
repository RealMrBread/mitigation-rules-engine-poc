/**
 * Integration tests for admin routes:
 *   GET  /api/admin/settings
 *   PUT  /api/admin/settings
 *   GET  /api/admin/users
 *   POST /api/admin/users
 *   GET  /api/health
 *
 * Uses a dedicated test database. Truncates all tables between tests.
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

async function seedUser(email: string, role = 'admin') {
  return testDb.user.create({
    data: { email, passwordHash: PASSWORD_HASH, role },
  });
}

function tokenFor(user: { id: string; email: string; role: string }) {
  return signToken({ userId: user.id, email: user.email, role: user.role });
}

// ===========================================================================
// GET /api/admin/settings
// ===========================================================================

describe('GET /api/admin/settings', () => {
  it('1 - returns settings for admin user', async () => {
    const admin = await seedUser('admin@example.com', 'admin');
    const token = tokenFor(admin);

    // Seed a setting
    await testDb.setting.create({
      data: { key: 'bridge_mitigation_limit', value: 5 as any },
    });

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('bridge_mitigation_limit');
    expect(res.body.data.bridge_mitigation_limit).toBe(5);
  });
});

// ===========================================================================
// PUT /api/admin/settings
// ===========================================================================

describe('PUT /api/admin/settings', () => {
  it('2 - updates bridge_mitigation_limit', async () => {
    const admin = await seedUser('admin@example.com', 'admin');
    const token = tokenFor(admin);

    // Seed initial setting
    await testDb.setting.create({
      data: { key: 'bridge_mitigation_limit', value: 3 as any },
    });

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ bridge_mitigation_limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.bridge_mitigation_limit).toBe(10);

    // Verify it persisted
    const check = await testDb.setting.findUnique({
      where: { key: 'bridge_mitigation_limit' },
    });
    expect(check?.value).toBe(10);
  });
});

// ===========================================================================
// GET /api/admin/users
// ===========================================================================

describe('GET /api/admin/users', () => {
  it('3 - returns users without password hashes', async () => {
    const admin = await seedUser('admin@example.com', 'admin');
    await seedUser('underwriter@example.com', 'underwriter');
    const token = tokenFor(admin);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    // No user should expose passwordHash
    for (const user of res.body.data) {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password_hash');
    }
  });
});

// ===========================================================================
// POST /api/admin/users
// ===========================================================================

describe('POST /api/admin/users', () => {
  it('4 - admin creates a new user and gets 201', async () => {
    const admin = await seedUser('admin@example.com', 'admin');
    const token = tokenFor(admin);

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newuser@example.com',
        password: 'Secure1234!',
        role: 'underwriter',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      email: 'newuser@example.com',
      role: 'underwriter',
    });
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });
});

// ===========================================================================
// Non-admin gets 403
// ===========================================================================

describe('Admin endpoints require admin role', () => {
  it('5 - non-admin gets 403 on all admin endpoints', async () => {
    const underwriter = await seedUser('uw@example.com', 'underwriter');
    const token = tokenFor(underwriter);

    const getSettings = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(getSettings.status).toBe(403);

    const putSettings = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ bridge_mitigation_limit: 5 });
    expect(putSettings.status).toBe(403);

    const getUsers = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);
    expect(getUsers.status).toBe(403);

    const postUsers = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'hack@example.com',
        password: 'Secure1234!',
        role: 'admin',
      });
    expect(postUsers.status).toBe(403);
  });
});

// ===========================================================================
// GET /api/health
// ===========================================================================

describe('GET /api/health', () => {
  it('6 - returns 200 without authentication', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
