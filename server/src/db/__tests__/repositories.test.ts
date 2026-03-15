import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { UserRepository } from "../repositories/user.repository.js";
import { RuleRepository } from "../repositories/rule.repository.js";
import { ReleaseRepository } from "../repositories/release.repository.js";
import { EvaluationRepository } from "../repositories/evaluation.repository.js";
import { PolicyLockRepository } from "../repositories/policy-lock.repository.js";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { ConflictError } from "../errors.js";
import { SEED_RULES } from "../../../../shared/data/seed-rules.js";

// ---------------------------------------------------------------------------
// Test PrismaClient pointing at the dedicated test database
// ---------------------------------------------------------------------------

const testDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://managpan@localhost:5432/mitigation_rules_engine_test",
    },
  },
});

// Repository instances wired to the test database
const userRepo = new UserRepository(testDb);
const ruleRepo = new RuleRepository(testDb);
const releaseRepo = new ReleaseRepository(testDb);
const evalRepo = new EvaluationRepository(testDb);
const lockRepo = new PolicyLockRepository(testDb);
const settingsRepo = new SettingsRepository(testDb);
const auditRepo = new AuditLogRepository(testDb);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASSWORD_HASH = hashSync("Test1234!", 4);

/** Create a test user and return it. */
async function createTestUser(
  email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
  role = "admin",
) {
  return userRepo.create(email, PASSWORD_HASH, role);
}

/** Create a draft rule from the first seed rule, owned by `userId`. */
async function createSeedRule(userId: string, index = 0) {
  const seed = SEED_RULES[index];
  return ruleRepo.create({
    name: seed.name,
    description: seed.description ?? undefined,
    type: seed.type,
    config: seed.config,
    mitigations: seed.mitigations,
    createdById: userId,
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await testDb.$connect();
});

beforeEach(async () => {
  // Delete in reverse-FK order to respect constraints
  await testDb.evaluationMitigation.deleteMany();
  await testDb.evaluation.deleteMany();
  await testDb.policyLock.deleteMany();
  await testDb.releaseRule.deleteMany();
  await testDb.release.deleteMany();
  await testDb.rule.deleteMany();
  await testDb.auditLog.deleteMany();
  await testDb.setting.deleteMany();
  await testDb.user.deleteMany();
});

afterAll(async () => {
  await testDb.$disconnect();
});

// ===========================================================================
// USER REPOSITORY
// ===========================================================================

describe("UserRepository", () => {
  it("1 - creates a user and retrieves by email", async () => {
    const user = await userRepo.create("alice@example.com", PASSWORD_HASH, "admin");

    const found = await userRepo.findByEmail("alice@example.com");

    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
    expect(found!.email).toBe("alice@example.com");
    expect(found!.role).toBe("admin");
  });

  it("2 - creates a user and retrieves by id", async () => {
    const user = await userRepo.create("bob@example.com", PASSWORD_HASH, "underwriter");

    const found = await userRepo.findById(user.id);

    expect(found).not.toBeNull();
    expect(found!.email).toBe("bob@example.com");
    expect(found!.role).toBe("underwriter");
  });

  it("3 - rejects duplicate email (unique constraint)", async () => {
    await userRepo.create("dup@example.com", PASSWORD_HASH, "admin");

    await expect(
      userRepo.create("dup@example.com", PASSWORD_HASH, "admin"),
    ).rejects.toThrow();
  });

  it("4 - list returns all users", async () => {
    await userRepo.create("u1@example.com", PASSWORD_HASH, "admin");
    await userRepo.create("u2@example.com", PASSWORD_HASH, "underwriter");
    await userRepo.create("u3@example.com", PASSWORD_HASH, "applied_science");

    const users = await userRepo.list();

    expect(users).toHaveLength(3);
    const emails = users.map((u) => u.email).sort();
    expect(emails).toEqual(["u1@example.com", "u2@example.com", "u3@example.com"]);
  });
});

// ===========================================================================
// RULE REPOSITORY
// ===========================================================================

describe("RuleRepository", () => {
  it("5 - creates a rule with version 1", async () => {
    const user = await createTestUser();
    const rule = await createSeedRule(user.id, 0);

    expect(rule.version).toBe(1);
    expect(rule.name).toBe(SEED_RULES[0].name);
    expect(rule.type).toBe(SEED_RULES[0].type);
  });

  it("6 - update increments version", async () => {
    const user = await createTestUser();
    const rule = await createSeedRule(user.id, 0);

    const updated = await ruleRepo.update(rule.id, { name: "Renamed Rule" }, 1);

    expect(updated.version).toBe(2);
    expect(updated.name).toBe("Renamed Rule");
  });

  it("7 - update with wrong version throws ConflictError", async () => {
    const user = await createTestUser();
    const rule = await createSeedRule(user.id, 0);

    await expect(
      ruleRepo.update(rule.id, { name: "Bad Update" }, 99),
    ).rejects.toThrow(ConflictError);
  });

  it("8 - delete removes the rule", async () => {
    const user = await createTestUser();
    const rule = await createSeedRule(user.id, 0);

    await ruleRepo.delete(rule.id);

    const found = await ruleRepo.findById(rule.id);
    expect(found).toBeNull();
  });

  it("9 - list returns all rules", async () => {
    const user = await createTestUser();
    await createSeedRule(user.id, 0);
    await createSeedRule(user.id, 1);
    await createSeedRule(user.id, 2);
    await createSeedRule(user.id, 3);

    const rules = await ruleRepo.list();

    expect(rules).toHaveLength(4);
  });
});

// ===========================================================================
// RELEASE REPOSITORY
// ===========================================================================

describe("ReleaseRepository", () => {
  it("10 - publish creates release with snapshots of all draft rules", async () => {
    const user = await createTestUser();
    await createSeedRule(user.id, 0);
    await createSeedRule(user.id, 1);

    const release = await releaseRepo.publish("v1.0", user.id);

    expect(release.name).toBe("v1.0");
    expect(release.releaseRules).toHaveLength(2);
    // Each snapshot should contain the rule's name
    const snapshotNames = release.releaseRules.map(
      (rr) => (rr.ruleSnapshot as any).name,
    );
    expect(snapshotNames.sort()).toEqual(
      [SEED_RULES[0].name, SEED_RULES[1].name].sort(),
    );
  });

  it("11 - published release has is_active = false by default", async () => {
    const user = await createTestUser();
    await createSeedRule(user.id, 0);

    const release = await releaseRepo.publish("v1.0", user.id);

    expect(release.isActive).toBe(false);
  });

  it("12 - activate sets is_active = true and deactivates others", async () => {
    const user = await createTestUser();
    await createSeedRule(user.id, 0);

    const r1 = await releaseRepo.publish("v1.0", user.id);
    const r2 = await releaseRepo.publish("v2.0", user.id);

    await releaseRepo.activate(r1.id);
    await releaseRepo.activate(r2.id);

    const foundR1 = await releaseRepo.findById(r1.id);
    const foundR2 = await releaseRepo.findById(r2.id);

    expect(foundR1!.isActive).toBe(false);
    expect(foundR2!.isActive).toBe(true);
  });

  it("13 - findActive returns the active release", async () => {
    const user = await createTestUser();
    await createSeedRule(user.id, 0);

    const r1 = await releaseRepo.publish("v1.0", user.id);
    await releaseRepo.activate(r1.id);

    const active = await releaseRepo.findActive();

    expect(active).not.toBeNull();
    expect(active!.id).toBe(r1.id);
    expect(active!.isActive).toBe(true);
  });

  it("14 - snapshot is a deep copy (modify draft after publish, snapshot unchanged)", async () => {
    const user = await createTestUser();
    const rule = await createSeedRule(user.id, 0);

    const release = await releaseRepo.publish("v1.0", user.id);
    const snapshotBefore = release.releaseRules[0].ruleSnapshot as any;

    // Modify the draft rule after publishing
    await ruleRepo.update(rule.id, { name: "Modified After Publish" }, 1);

    // Re-fetch the release snapshot
    const releaseAfter = await releaseRepo.findByIdWithRules(release.id);
    const snapshotAfter = releaseAfter!.releaseRules[0].ruleSnapshot as any;

    // Snapshot should still have the original name
    expect(snapshotAfter.name).toBe(snapshotBefore.name);
    expect(snapshotAfter.name).toBe(SEED_RULES[0].name);
    expect(snapshotAfter.name).not.toBe("Modified After Publish");
  });
});

// ===========================================================================
// EVALUATION REPOSITORY
// ===========================================================================

describe("EvaluationRepository", () => {
  /** Helper: create a release so we have a valid releaseId for evaluations. */
  async function createRelease(userId: string) {
    await createSeedRule(userId, 0);
    return releaseRepo.publish("eval-release-" + Date.now(), userId);
  }

  it("15 - saves evaluation and retrieves by id", async () => {
    const user = await createTestUser();
    const release = await createRelease(user.id);

    const evaluation = await evalRepo.save({
      propertyId: "PROP-001",
      releaseId: release.id,
      observations: { attic_vent_screens: "Ember Resistant" },
      result: { vulnerabilities: [] },
      isAutoDeclined: false,
      createdById: user.id,
    });

    const found = await evalRepo.findById(evaluation.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(evaluation.id);
    expect(found!.propertyId).toBe("PROP-001");
    expect(found!.isAutoDeclined).toBe(false);
  });

  it("16 - saves mitigations for evaluation", async () => {
    const user = await createTestUser();
    const release = await createRelease(user.id);

    const evaluation = await evalRepo.save({
      propertyId: "PROP-002",
      releaseId: release.id,
      observations: { attic_vent_screens: "Standard" },
      result: { vulnerabilities: [{ ruleId: "r1" }] },
      isAutoDeclined: false,
      createdById: user.id,
    });

    await evalRepo.saveMitigations(evaluation.id, [
      { ruleId: "r1", mitigationId: "m1", category: "full" },
      { ruleId: "r1", mitigationId: "m2", category: "bridge" },
    ]);

    const found = await evalRepo.findById(evaluation.id);

    expect(found!.mitigations).toHaveLength(2);
    expect(found!.mitigations.map((m) => m.category).sort()).toEqual(["bridge", "full"]);
  });

  it("17 - listByProperty returns evaluations for that property", async () => {
    const user = await createTestUser();
    const release = await createRelease(user.id);

    await evalRepo.save({
      propertyId: "PROP-A",
      releaseId: release.id,
      observations: {},
      result: {},
      isAutoDeclined: false,
      createdById: user.id,
    });
    await evalRepo.save({
      propertyId: "PROP-A",
      releaseId: release.id,
      observations: {},
      result: {},
      isAutoDeclined: true,
      createdById: user.id,
    });
    await evalRepo.save({
      propertyId: "PROP-B",
      releaseId: release.id,
      observations: {},
      result: {},
      isAutoDeclined: false,
      createdById: user.id,
    });

    const propAEvals = await evalRepo.listByProperty("PROP-A");
    const propBEvals = await evalRepo.listByProperty("PROP-B");

    expect(propAEvals).toHaveLength(2);
    expect(propBEvals).toHaveLength(1);
  });
});

// ===========================================================================
// POLICY LOCK REPOSITORY
// ===========================================================================

describe("PolicyLockRepository", () => {
  it("18 - creates lock and finds by property", async () => {
    const user = await createTestUser();
    await createSeedRule(user.id, 0);
    const release = await releaseRepo.publish("lock-release", user.id);

    const lock = await lockRepo.create("PROP-LOCK-1", release.id, user.id);

    const found = await lockRepo.findByPropertyId("PROP-LOCK-1");

    expect(found).not.toBeNull();
    expect(found!.id).toBe(lock.id);
    expect(found!.propertyId).toBe("PROP-LOCK-1");
    expect(found!.releaseId).toBe(release.id);
  });

  it("19 - rejects duplicate property_id (unique constraint)", async () => {
    const user = await createTestUser();
    await createSeedRule(user.id, 0);
    const release = await releaseRepo.publish("lock-release-2", user.id);

    await lockRepo.create("PROP-DUP", release.id, user.id);

    await expect(
      lockRepo.create("PROP-DUP", release.id, user.id),
    ).rejects.toThrow();
  });
});

// ===========================================================================
// SETTINGS REPOSITORY
// ===========================================================================

describe("SettingsRepository", () => {
  it("20 - set and get a setting", async () => {
    await settingsRepo.set("theme", "dark");

    const value = await settingsRepo.get("theme");

    expect(value).toBe("dark");
  });

  it("21 - update existing setting (upsert)", async () => {
    await settingsRepo.set("max_retries", 3);

    const valueBefore = await settingsRepo.get("max_retries");
    expect(valueBefore).toBe(3);

    await settingsRepo.set("max_retries", 5);

    const valueAfter = await settingsRepo.get("max_retries");
    expect(valueAfter).toBe(5);
  });
});

// ===========================================================================
// AUDIT LOG REPOSITORY
// ===========================================================================

describe("AuditLogRepository", () => {
  it("22 - appends entry and lists", async () => {
    const user = await createTestUser();

    await auditRepo.append("CREATE_RULE", "rule", "rule-123", user.id, {
      name: "Test Rule",
    });

    const logs = await auditRepo.list();

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("CREATE_RULE");
    expect(logs[0].entityType).toBe("rule");
    expect(logs[0].entityId).toBe("rule-123");
    expect(logs[0].userId).toBe(user.id);
    expect((logs[0].details as any).name).toBe("Test Rule");
  });

  it("23 - list respects limit parameter", async () => {
    const user = await createTestUser();

    // Create 5 audit log entries
    for (let i = 0; i < 5; i++) {
      await auditRepo.append("ACTION_" + i, "entity", `id-${i}`, user.id);
    }

    const limited = await auditRepo.list(2);

    expect(limited).toHaveLength(2);

    const all = await auditRepo.list();
    expect(all).toHaveLength(5);
  });
});
