/**
 * Extended demo seed script for the Mitigation Rules Engine.
 *
 * Builds on the base seed to add realistic evaluation data that
 * populates all screens (history, audit log, releases, mitigations).
 *
 * Run with: npx tsx prisma/seed-demo.ts
 *
 * IMPORTANT: This script clears all existing data, runs the base seed
 * setup, then layers on demo-specific data.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SEED_RULES } from '../../shared/data/seed-rules.js';
import { evaluate } from '../src/engine/engine.js';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Seed users (same as base seed)
// ---------------------------------------------------------------------------

const SEED_USERS = [
  { email: 'underwriter@test.com', password: 'password123', role: 'underwriter' },
  { email: 'scientist@test.com', password: 'password123', role: 'applied_science' },
  { email: 'admin@test.com', password: 'password123', role: 'admin' },
] as const;

// ---------------------------------------------------------------------------
// Demo observations -- realistic property data
// ---------------------------------------------------------------------------

const DEMO_OBSERVATIONS = {
  // 1. All passing -- clean property
  allPassing: {
    property_id: 'PROP-DEMO-001',
    state: 'CA',
    attic_vent_screens: 'Ember Resistant',
    roof_type: 'Class A',
    wildfire_risk_category: 'B',
    window_type: 'Tempered Glass',
    vegetation: [
      { type: 'Tree', distance_to_window: 55 },
      { type: 'Shrub', distance_to_window: 40 },
    ],
    home_to_home_distance: 25,
  },

  // 2. Attic vent failure -- standard vents in high-risk area
  atticVentFail: {
    property_id: 'PROP-DEMO-002',
    state: 'CA',
    attic_vent_screens: 'Standard',
    roof_type: 'Class A',
    wildfire_risk_category: 'C',
    window_type: 'Double Pane',
    vegetation: [
      { type: 'Shrub', distance_to_window: 35 },
    ],
    home_to_home_distance: 30,
  },

  // 3. Windows fail -- Single Pane with close trees (bridge stacking demo)
  //    Threshold: 30 * 3 (Single Pane) / 1 (Tree) = 90ft
  //    Actual: 50ft < 90ft --> FAIL
  //    With Film (0.8) + Prune (0.5): 90 * 0.4 = 36ft, 50 >= 36 --> PASS
  windowsFail: {
    property_id: 'PROP-DEMO-003',
    state: 'OR',
    attic_vent_screens: 'Ember Resistant',
    roof_type: 'Class A',
    wildfire_risk_category: 'B',
    window_type: 'Single Pane',
    vegetation: [
      { type: 'Tree', distance_to_window: 50 },
      { type: 'Shrub', distance_to_window: 25 },
    ],
    home_to_home_distance: 22,
  },

  // 4. Auto-decline -- home-to-home < 15ft (unmitigatable)
  autoDecline: {
    property_id: 'PROP-DEMO-004',
    state: 'CA',
    attic_vent_screens: 'Ember Resistant',
    roof_type: 'Class A',
    wildfire_risk_category: 'A',
    window_type: 'Tempered Glass',
    vegetation: [
      { type: 'Grass', distance_to_window: 60 },
    ],
    home_to_home_distance: 12,
  },

  // 5. Multiple vulnerabilities -- bad across the board
  multipleVulns: {
    property_id: 'PROP-DEMO-005',
    state: 'OR',
    attic_vent_screens: 'None',
    roof_type: 'Class C',
    wildfire_risk_category: 'D',
    window_type: 'Single Pane',
    vegetation: [
      { type: 'Tree', distance_to_window: 15 },
      { type: 'Shrub', distance_to_window: 10 },
    ],
    home_to_home_distance: 18,
  },

  // 6. Roof conditional pass -- low risk area with Class B (should pass)
  roofConditionalPass: {
    property_id: 'PROP-DEMO-006',
    state: 'CA',
    attic_vent_screens: 'Ember Resistant',
    roof_type: 'Class B',
    wildfire_risk_category: 'A',
    window_type: 'Double Pane',
    vegetation: [
      { type: 'Shrub', distance_to_window: 50 },
    ],
    home_to_home_distance: 35,
  },

  // 7. Windows edge case -- Double Pane with moderate vegetation
  //    Threshold: 30 * 2 (Double Pane) / 1 (Tree) = 60ft
  //    Tree at 55ft < 60ft --> FAIL (barely)
  windowsEdgeCase: {
    property_id: 'PROP-DEMO-007',
    state: 'OR',
    attic_vent_screens: 'Ember Resistant',
    roof_type: 'Class A',
    wildfire_risk_category: 'B',
    window_type: 'Double Pane',
    vegetation: [
      { type: 'Tree', distance_to_window: 55 },
      { type: 'Grass', distance_to_window: 15 },
    ],
    home_to_home_distance: 28,
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Mitigation Rules Engine: DEMO Seed ===\n');

  // ── 1. Clear existing data (reverse FK order) ─────────────────────────
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

  // ── 2. Create users ───────────────────────────────────────────────────
  console.log('Creating users...');

  const createdUsers: Record<string, { id: string; email: string; role: string }> = {};

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email: u.email, passwordHash, role: u.role },
    });
    createdUsers[u.role] = { id: user.id, email: user.email, role: user.role };
    console.log(`  Created user: ${user.email} (${u.role})`);
  }

  const scientistId = createdUsers['applied_science'].id;
  const underwriterId = createdUsers['underwriter'].id;
  const adminId = createdUsers['admin'].id;

  // ── 3. Create draft rules from seed data ──────────────────────────────
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

  // ── 4. Publish release v1.0 (active) ─────────────────────────────────
  console.log('\nPublishing release "2026-POC-v1.0"...');

  const releaseV1 = await prisma.release.create({
    data: {
      name: '2026-POC-v1.0',
      publishedBy: scientistId,
      isActive: true,
    },
  });

  for (const rule of createdRules) {
    await prisma.releaseRule.create({
      data: {
        releaseId: releaseV1.id,
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

  console.log(`  Release v1.0 created and activated with ${createdRules.length} rules.`);

  // ── 5. Publish release v2.0 (not active, for history) ────────────────
  console.log('\nPublishing release "2026-POC-v2.0" (inactive, for history)...');

  const releaseV2 = await prisma.release.create({
    data: {
      name: '2026-POC-v2.0',
      publishedBy: scientistId,
      isActive: false,
      publishedAt: new Date('2026-03-15T14:00:00Z'),
    },
  });

  for (const rule of createdRules) {
    await prisma.releaseRule.create({
      data: {
        releaseId: releaseV2.id,
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

  console.log(`  Release v2.0 created (inactive) with ${createdRules.length} rules.`);

  // ── 6. Set settings ──────────────────────────────────────────────────
  console.log('\nSetting configuration...');

  await prisma.setting.create({
    data: { key: 'bridge_mitigation_limit', value: 3 },
  });

  console.log('  bridge_mitigation_limit = 3');

  // ── 7. Create demo evaluations ────────────────────────────────────────
  console.log('\nCreating demo evaluations...');

  // Helper: run engine and save evaluation
  async function createEvaluation(
    obs: Record<string, any>,
    userId: string,
    releaseId: string,
    label: string,
  ) {
    const result = evaluate(obs, SEED_RULES);
    const evalRecord = await prisma.evaluation.create({
      data: {
        propertyId: obs.property_id,
        releaseId,
        observations: obs as any,
        result: result as any,
        isAutoDeclined: result.auto_declined,
        createdById: userId,
      },
    });
    console.log(
      `  [${label}] ${obs.property_id}: ${result.vulnerabilities.length} vuln(s), auto_declined=${result.auto_declined}`,
    );
    return { evalRecord, result };
  }

  // Eval 1: All passing -- clean property
  const { evalRecord: eval1 } = await createEvaluation(
    DEMO_OBSERVATIONS.allPassing,
    underwriterId,
    releaseV1.id,
    'All Passing',
  );

  // Eval 2: Attic vent failure -- select full mitigation
  const { evalRecord: eval2, result: result2 } = await createEvaluation(
    DEMO_OBSERVATIONS.atticVentFail,
    underwriterId,
    releaseV1.id,
    'Attic Vent Fail',
  );

  // Save mitigation selection: Install Ember-Rated Vents (full)
  const atticVuln = result2.vulnerabilities.find((v) => v.rule_name === 'Attic Vent');
  if (atticVuln) {
    const fullMit = atticVuln.mitigations.find((m) => m.category === 'full');
    if (fullMit) {
      await prisma.evaluationMitigation.create({
        data: {
          evaluationId: eval2.id,
          ruleId: atticVuln.rule_id,
          mitigationId: fullMit.id,
          category: 'full',
        },
      });
      console.log(`    Selected mitigation: ${fullMit.name} (full)`);
    }
  }

  // Eval 3: Windows fail -- select bridge mitigations (Film + Prune)
  const { evalRecord: eval3, result: result3 } = await createEvaluation(
    DEMO_OBSERVATIONS.windowsFail,
    underwriterId,
    releaseV1.id,
    'Windows Fail + Bridges',
  );

  const windowsVuln = result3.vulnerabilities.find((v) => v.rule_name === 'Window Safety Distance');
  if (windowsVuln) {
    const bridgeMits = windowsVuln.mitigations.filter((m) => m.category === 'bridge');
    const filmMit = bridgeMits.find((m) => m.name === 'Apply Film');
    const pruneMit = bridgeMits.find((m) => m.name === 'Prune Trees');

    if (filmMit) {
      await prisma.evaluationMitigation.create({
        data: {
          evaluationId: eval3.id,
          ruleId: windowsVuln.rule_id,
          mitigationId: filmMit.id,
          category: 'bridge',
        },
      });
      console.log(`    Selected mitigation: ${filmMit.name} (bridge, x0.8)`);
    }
    if (pruneMit) {
      await prisma.evaluationMitigation.create({
        data: {
          evaluationId: eval3.id,
          ruleId: windowsVuln.rule_id,
          mitigationId: pruneMit.id,
          category: 'bridge',
        },
      });
      console.log(`    Selected mitigation: ${pruneMit.name} (bridge, x0.5)`);
    }
  }

  // Eval 4: Auto-decline (home-to-home < 15ft)
  await createEvaluation(
    DEMO_OBSERVATIONS.autoDecline,
    underwriterId,
    releaseV1.id,
    'Auto-Decline',
  );

  // Eval 5: Multiple vulnerabilities (Attic + Roof + Windows)
  const { evalRecord: eval5, result: result5 } = await createEvaluation(
    DEMO_OBSERVATIONS.multipleVulns,
    underwriterId,
    releaseV1.id,
    'Multiple Vulns',
  );

  // Select full mitigation for Attic Vent, full for Roof
  const atticVuln5 = result5.vulnerabilities.find((v) => v.rule_name === 'Attic Vent');
  if (atticVuln5) {
    const fullMit = atticVuln5.mitigations.find((m) => m.category === 'full');
    if (fullMit) {
      await prisma.evaluationMitigation.create({
        data: {
          evaluationId: eval5.id,
          ruleId: atticVuln5.rule_id,
          mitigationId: fullMit.id,
          category: 'full',
        },
      });
      console.log(`    Selected mitigation: ${fullMit.name} (full)`);
    }
  }
  const roofVuln5 = result5.vulnerabilities.find((v) => v.rule_name === 'Roof');
  if (roofVuln5) {
    const fullMit = roofVuln5.mitigations.find((m) => m.category === 'full');
    if (fullMit) {
      await prisma.evaluationMitigation.create({
        data: {
          evaluationId: eval5.id,
          ruleId: roofVuln5.rule_id,
          mitigationId: fullMit.id,
          category: 'full',
        },
      });
      console.log(`    Selected mitigation: ${fullMit.name} (full)`);
    }
  }

  // Eval 6: Roof conditional pass (Class B in risk category A)
  await createEvaluation(
    DEMO_OBSERVATIONS.roofConditionalPass,
    underwriterId,
    releaseV1.id,
    'Roof Conditional Pass',
  );

  // Eval 7: Windows edge case (Double Pane, barely fails)
  const { evalRecord: eval7, result: result7 } = await createEvaluation(
    DEMO_OBSERVATIONS.windowsEdgeCase,
    underwriterId,
    releaseV1.id,
    'Windows Edge Case',
  );

  // Select single bridge mitigation (Film only)
  const windowsVuln7 = result7.vulnerabilities.find((v) => v.rule_name === 'Window Safety Distance');
  if (windowsVuln7) {
    const filmMit = windowsVuln7.mitigations.find((m) => m.name === 'Apply Film');
    if (filmMit) {
      await prisma.evaluationMitigation.create({
        data: {
          evaluationId: eval7.id,
          ruleId: windowsVuln7.rule_id,
          mitigationId: filmMit.id,
          category: 'bridge',
        },
      });
      console.log(`    Selected mitigation: ${filmMit.name} (bridge, x0.8)`);
    }
  }

  // ── 8. Create policy locks for evaluated properties ───────────────────
  console.log('\nCreating policy locks...');

  const propertyIds = [
    DEMO_OBSERVATIONS.allPassing.property_id,
    DEMO_OBSERVATIONS.atticVentFail.property_id,
    DEMO_OBSERVATIONS.windowsFail.property_id,
    DEMO_OBSERVATIONS.autoDecline.property_id,
    DEMO_OBSERVATIONS.multipleVulns.property_id,
  ];

  for (const propId of propertyIds) {
    await prisma.policyLock.create({
      data: {
        propertyId: propId,
        releaseId: releaseV1.id,
        lockedById: underwriterId,
      },
    });
    console.log(`  Locked ${propId} to release v1.0`);
  }

  // ── 9. Create audit log entries ──────────────────────────────────────
  console.log('\nCreating audit log entries...');

  const auditEntries = [
    {
      action: 'release.publish',
      entityType: 'release',
      entityId: releaseV1.id,
      userId: scientistId,
      details: { name: '2026-POC-v1.0', ruleCount: 4 },
    },
    {
      action: 'release.activate',
      entityType: 'release',
      entityId: releaseV1.id,
      userId: scientistId,
      details: { name: '2026-POC-v1.0' },
    },
    {
      action: 'release.publish',
      entityType: 'release',
      entityId: releaseV2.id,
      userId: scientistId,
      details: { name: '2026-POC-v2.0', ruleCount: 4 },
    },
    {
      action: 'settings.update',
      entityType: 'setting',
      entityId: 'bridge_mitigation_limit',
      userId: adminId,
      details: { key: 'bridge_mitigation_limit', oldValue: null, newValue: 3 },
    },
    {
      action: 'user.create',
      entityType: 'user',
      entityId: underwriterId,
      userId: adminId,
      details: { email: 'underwriter@test.com', role: 'underwriter' },
    },
    {
      action: 'user.create',
      entityType: 'user',
      entityId: scientistId,
      userId: adminId,
      details: { email: 'scientist@test.com', role: 'applied_science' },
    },
  ];

  for (const entry of auditEntries) {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
        details: entry.details as any,
      },
    });
    console.log(`  Audit: ${entry.action} on ${entry.entityType}`);
  }

  // ── 10. Summary ──────────────────────────────────────────────────────
  console.log('\n=== Demo Seed Complete ===');
  console.log(`  Users:           ${SEED_USERS.length}`);
  console.log(`  Rules:           ${createdRules.length}`);
  console.log(`  Releases:        2 (v1.0 active, v2.0 inactive)`);
  console.log(`  Evaluations:     7`);
  console.log(`  Policy Locks:    ${propertyIds.length}`);
  console.log(`  Audit Entries:   ${auditEntries.length}`);
  console.log(`  Settings:        1`);
  console.log('\nTest accounts (all password: password123):');
  console.log('  underwriter@test.com  (Underwriter)');
  console.log('  scientist@test.com    (Applied Science)');
  console.log('  admin@test.com        (Admin)');
}

main()
  .catch((e) => {
    console.error('Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
