/**
 * Integration tests for auth routes (POST /api/auth/login, POST /api/auth/register).
 *
 * Uses a dedicated test database and seeds users via Prisma directly.
 * DATABASE_URL and JWT_SECRET are set in vitest.config.ts so the singleton
 * PrismaClient used by the app connects to the test DB.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { hashSync } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../app.js';
import { signToken } from '../../lib/jwt.js';

// ---------------------------------------------------------------------------
// Test PrismaClient (same URL as the one the app will use via env var)
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
  // Use TRUNCATE CASCADE to avoid FK ordering issues when running in
  // parallel with other test files that share the same test database.
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

function adminToken(user: { id: string; email: string; role: string }) {
  return signToken({ userId: user.id, email: user.email, role: user.role });
}

// ===========================================================================
// POST /api/auth/login
// ===========================================================================

describe('POST /api/auth/login', () => {
  it('1 - returns token and user for correct credentials', async () => {
    await seedUser('alice@example.com', 'admin');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toMatchObject({
      email: 'alice@example.com',
      role: 'admin',
    });
    // user should NOT expose passwordHash
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('2 - returns 401 for wrong password', async () => {
    await seedUser('bob@example.com', 'underwriter');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'WrongPassword99!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('3 - returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Whatever1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('4 - returns 400 for invalid body (missing email)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Test1234!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ===========================================================================
// POST /api/auth/register
// ===========================================================================

describe('POST /api/auth/register', () => {
  it('5 - admin creates a new user and gets 201', async () => {
    const admin = await seedUser('admin@example.com', 'admin');
    const token = adminToken(admin);

    const res = await request(app)
      .post('/api/auth/register')
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

  it('6 - non-admin gets 403', async () => {
    const viewer = await seedUser('viewer@example.com', 'underwriter');
    const token = adminToken(viewer);

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'another@example.com',
        password: 'Secure1234!',
        role: 'underwriter',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('7 - duplicate email returns 409', async () => {
    const admin = await seedUser('admin2@example.com', 'admin');
    const token = adminToken(admin);

    // First registration should succeed
    await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'duplicate@example.com',
        password: 'Secure1234!',
        role: 'underwriter',
      });

    // Second registration with same email should fail
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'duplicate@example.com',
        password: 'Secure1234!',
        role: 'applied_science',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});
