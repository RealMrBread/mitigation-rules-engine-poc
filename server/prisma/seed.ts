/**
 * Database seed script for the Mitigation Rules Engine.
 *
 * Idempotent: clears all existing data before inserting.
 * Run with: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SEED_RULES } from '../../shared/data/seed-rules.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Seed users
// ---------------------------------------------------------------------------

const SEED_USERS = [
  { email: 'underwriter@test.com', password: 'password123', role: 'underwriter' },
  { email: 'scientist@test.com', password: 'password123', role: 'applied_science' },
  { email: 'admin@test.com', password: 'password123', role: 'admin' },
] as const;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('--- Mitigation Rules Engine: Seeding database ---\n');

  // ── 1. Clear existing data (reverse FK order) ───────────────────────────
  console.log('Clearing existing data...');

  await prisma.evaluationMitigation.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.policyLock.deleteMany();
  await prisma.releaseRule.deleteMany();
  await prisma.release.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  console.log('  All tables cleared.\n');

  // ── 2. Create users ─────────────────────────────────────────────────────
  console.log('Creating users...');

  const saltRounds = 10;
  const createdUsers: Record<string, { id: string; email: string; role: string }> = {};

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, saltRounds);
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        role: u.role,
      },
    });
    createdUsers[u.role] = { id: user.id, email: user.email, role: user.role };
    console.log(`  Created user: ${user.email} (${u.role})`);
  }

  const scientistId = createdUsers['applied_science'].id;

  // ── 3. Create draft rules from seed data ────────────────────────────────
  console.log('\nCreating draft rules...');

  const createdRules: Array<{ id: string; name: string; type: string; config: unknown; mitigations: unknown }> = [];

  for (const seedRule of SEED_RULES) {
    const rule = await prisma.rule.create({
      data: {
        id: seedRule.id,
        name: seedRule.name,
        description: seedRule.description ?? null,
        type: seedRule.type,
        config: seedRule.config as object,
        mitigations: seedRule.mitigations as object[],
        createdById: scientistId,
      },
    });
    createdRules.push({
      id: rule.id,
      name: rule.name,
      type: rule.type,
      config: rule.config,
      mitigations: rule.mitigations,
    });
    console.log(`  Created rule: ${rule.name} (${rule.type})`);
  }

  // ── 4. Publish release "2026-POC-v1.0" ─────────────────────────────────
  console.log('\nPublishing release "2026-POC-v1.0"...');

  const release = await prisma.release.create({
    data: {
      name: '2026-POC-v1.0',
      publishedBy: scientistId,
      isActive: false,
    },
  });

  // Create release_rules with full rule snapshots
  for (const rule of createdRules) {
    await prisma.releaseRule.create({
      data: {
        releaseId: release.id,
        ruleId: rule.id,
        ruleSnapshot: {
          id: rule.id,
          name: rule.name,
          type: rule.type,
          config: rule.config,
          mitigations: rule.mitigations,
        },
      },
    });
  }

  console.log(`  Release created with ${createdRules.length} rule snapshots.`);

  // ── 5. Activate the release ─────────────────────────────────────────────
  console.log('\nActivating release...');

  await prisma.release.update({
    where: { id: release.id },
    data: { isActive: true },
  });

  console.log('  Release "2026-POC-v1.0" is now active.');

  // ── 6. Set settings ────────────────────────────────────────────────────
  console.log('\nSetting configuration...');

  await prisma.setting.create({
    data: {
      key: 'bridge_mitigation_limit',
      value: 3,
    },
  });

  console.log('  bridge_mitigation_limit = 3');

  // ── 7. Summary ──────────────────────────────────────────────────────────
  console.log('\n--- Seed complete ---');
  console.log(`  Users:         ${SEED_USERS.length}`);
  console.log(`  Rules:         ${createdRules.length}`);
  console.log(`  Releases:      1 (active)`);
  console.log(`  Release Rules: ${createdRules.length}`);
  console.log(`  Settings:      1`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
