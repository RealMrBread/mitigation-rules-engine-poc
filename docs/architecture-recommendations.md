# Architecture Recommendations -- Mitigation Rules Engine

**Author**: Backend Architect Agent
**Date**: 2026-03-14
**Status**: Review
**References**: [HLD-final.md](./HLD-final.md)

> These recommendations are opinionated and concrete. They prioritize **completeness and extensibility** over performance and scalability, per the stated priority. Code examples are TypeScript pseudocode illustrating the contracts, not production-ready implementations.

---

## 1. Shared Types Strategy

### Problem

The monorepo has three consumers of the same domain types: the engine (pure functions), the server (API layer + Prisma), and the client (React). If types drift between these layers, bugs become invisible until runtime. Zod schemas must be the single source of truth for validation, and TypeScript types must be derived from them -- never maintained independently.

### Proposed `/shared/types/` Structure

```
shared/
  types/
    index.ts                    # Re-exports everything
    rule.ts                     # Rule domain types + Zod schemas
    evaluation.ts               # Evaluation input/output types + Zod schemas
    mitigation.ts               # Mitigation types + Zod schemas
    release.ts                  # Release types + Zod schemas
    user.ts                     # User/auth types + Zod schemas
    settings.ts                 # Admin settings types + Zod schemas
    api.ts                      # API request/response wrappers + error format
    common.ts                   # Shared primitives (operators, enums, pagination)
```

### Key Principle: Zod First, TypeScript Derived

Every domain type must be defined as a Zod schema first, with the TypeScript type inferred from it. This guarantees that runtime validation and compile-time checking use the same shape. Never define a `type` or `interface` independently and then write a matching Zod schema -- they will drift.

```typescript
// shared/types/common.ts

import { z } from 'zod';

export const OperatorSchema = z.enum(['eq', 'neq', 'in', 'gt', 'gte', 'lt', 'lte']);
export type Operator = z.infer<typeof OperatorSchema>;

export const MitigationCategorySchema = z.enum(['full', 'bridge']);
export type MitigationCategory = z.infer<typeof MitigationCategorySchema>;

export const RuleTypeSchema = z.enum([
  'simple_threshold',
  'conditional_threshold',
  'computed_with_modifiers',
]);
export type RuleType = z.infer<typeof RuleTypeSchema>;

export const UserRoleSchema = z.enum(['underwriter', 'applied_science', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;
```

### Rule Types: Discriminated Union on `type`

The rule config must be a discriminated union keyed on `type`. This is critical because Zod's `discriminatedUnion` gives precise error messages ("Expected simple_threshold config but got computed_with_modifiers shape") and TypeScript narrows the config type after a `type` check.

```typescript
// shared/types/rule.ts

import { z } from 'zod';
import { OperatorSchema, MitigationCategorySchema, RuleTypeSchema } from './common';

// --- Bridge effect: discriminated union ---
export const BridgeEffectMultiplierSchema = z.object({
  type: z.literal('multiplier'),
  value: z.number().gt(0).lt(1), // Must reduce threshold, not increase
});

export const BridgeEffectOverrideSchema = z.object({
  type: z.literal('override'),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const BridgeEffectSchema = z.discriminatedUnion('type', [
  BridgeEffectMultiplierSchema,
  BridgeEffectOverrideSchema,
]);
export type BridgeEffect = z.infer<typeof BridgeEffectSchema>;

// --- Mitigations ---
export const FullMitigationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.literal('full'),
  description: z.string().min(1),
});

export const BridgeMitigationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.literal('bridge'),
  description: z.string().min(1),
  effect: BridgeEffectSchema,
});

export const MitigationSchema = z.discriminatedUnion('category', [
  FullMitigationSchema,
  BridgeMitigationSchema,
]);
export type Mitigation = z.infer<typeof MitigationSchema>;

// --- Rule configs per type ---
export const SimpleThresholdConfigSchema = z.object({
  field: z.string().min(1),
  operator: OperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});
export type SimpleThresholdConfig = z.infer<typeof SimpleThresholdConfigSchema>;

export const ConditionBranchSchema = z.object({
  when: z.object({
    field: z.string().min(1),
    operator: OperatorSchema,
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  }),
  then: z.object({
    field: z.string().min(1),
    operator: OperatorSchema,
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  }),
});

export const ConditionalThresholdConfigSchema = z.object({
  conditions: z.array(ConditionBranchSchema).min(1),
  default: z.object({
    field: z.string().min(1),
    operator: OperatorSchema,
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  }),
});
export type ConditionalThresholdConfig = z.infer<typeof ConditionalThresholdConfigSchema>;

export const ModifierSchema = z.object({
  field: z.string().min(1),
  operation: z.enum(['multiply', 'divide']),
  mapping: z.record(z.string(), z.number()),
});

export const ComputedWithModifiersConfigSchema = z.object({
  baseValue: z.number().positive(),
  unit: z.string().min(1),
  modifiers: z.array(ModifierSchema).min(1),
  comparisonField: z.string().min(1),
  comparisonOperator: OperatorSchema,
  arrayField: z.string().optional(), // Present when evaluating array items
});
export type ComputedWithModifiersConfig = z.infer<typeof ComputedWithModifiersConfigSchema>;

// --- Unified Rule schema (discriminated on type) ---
const BaseRuleFields = {
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  mitigations: z.array(MitigationSchema),
  version: z.number().int().positive(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

export const SimpleThresholdRuleSchema = z.object({
  ...BaseRuleFields,
  type: z.literal('simple_threshold'),
  config: SimpleThresholdConfigSchema,
});

export const ConditionalThresholdRuleSchema = z.object({
  ...BaseRuleFields,
  type: z.literal('conditional_threshold'),
  config: ConditionalThresholdConfigSchema,
});

export const ComputedWithModifiersRuleSchema = z.object({
  ...BaseRuleFields,
  type: z.literal('computed_with_modifiers'),
  config: ComputedWithModifiersConfigSchema,
});

export const RuleSchema = z.discriminatedUnion('type', [
  SimpleThresholdRuleSchema,
  ConditionalThresholdRuleSchema,
  ComputedWithModifiersRuleSchema,
]);
export type Rule = z.infer<typeof RuleSchema>;
```

### API Types: Wrap Domain Types in Request/Response Envelopes

```typescript
// shared/types/api.ts

import { z } from 'zod';

// Standard error response -- matches HLD section 6.8
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// Standard success envelope
export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z.object({
      timestamp: z.string().datetime(),
    }).optional(),
  });

// Pagination
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;
```

### What NOT to Put in `/shared/types/`

- Prisma-generated types. They live in `node_modules/.prisma/client`. The server maps between Prisma types and shared domain types at the repository/service boundary.
- React component props. Those are client-side concerns that consume shared types but should not pollute the shared layer.
- Server-only middleware types (Express `Request` extensions, JWT payload shapes). These belong in `/server/types/`.

---

## 2. Engine Extensibility

### The Contract: What "Adding a New Rule Type" Must Look Like

The goal stated in the HLD (Tenet 6) is that adding a 4th or 5th rule type requires ONLY:
1. Writing a new evaluator class implementing the interface
2. Writing a Zod schema for the new config shape
3. Registering it

No changes to: core engine loop, API routes, frontend rule editor framework, or database schema.

Here is the concrete interface contract that makes this possible.

### Evaluator Interface

```typescript
// shared/types/engine.ts

import { z } from 'zod';

/**
 * Result of evaluating a single rule against observations.
 */
export const RuleEvalResultSchema = z.object({
  ruleId: z.string().uuid(),
  ruleName: z.string(),
  ruleDescription: z.string(),
  status: z.enum(['pass', 'fail', 'skipped', 'error']),
  // Present when status is 'fail'
  vulnerability: z.object({
    observedValues: z.record(z.string(), z.unknown()),
    requiredValues: z.record(z.string(), z.unknown()),
    explanation: z.string(), // Human-readable, for policyholders
    computationSteps: z.array(z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
    })).optional(), // Present for computed rules
    mitigations: z.array(z.any()), // Typed as Mitigation[] at runtime
  }).optional(),
  // Present when status is 'skipped'
  skippedReason: z.string().optional(),
  // Present when status is 'error'
  errorMessage: z.string().optional(),
});
export type RuleEvalResult = z.infer<typeof RuleEvalResultSchema>;

/**
 * The interface every evaluator must implement.
 * This is the extension point. The engine never looks inside config --
 * it hands the opaque config to the evaluator and trusts the result.
 */
export interface Evaluator {
  /**
   * Evaluate a rule's config against observations.
   * Must be a pure function. No side effects, no DB calls.
   */
  evaluate(
    config: unknown,  // The evaluator casts this after validation
    observations: Record<string, unknown>,
    mitigations: Mitigation[],
  ): RuleEvalResult;

  /**
   * Validate that a config object is well-formed for this rule type.
   * Called at rule authoring (save) and at publish time.
   * Returns field-level errors for the rule editor UI.
   */
  validate(config: unknown): ValidationResult;

  /**
   * Return the Zod schema for this evaluator's config.
   * Used by the API layer for request validation and by the
   * frontend for form generation. This is how a new rule type
   * teaches the system its shape without any core changes.
   */
  getConfigSchema(): z.ZodType;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;    // e.g., "config.modifiers[0].mapping"
    message: string; // e.g., "Mapping must include at least one entry"
  }>;
}
```

### Evaluator Registry

```typescript
// server/engine/registry.ts

import { Evaluator } from '@shared/types/engine';
import { RuleType } from '@shared/types/common';

class EvaluatorRegistry {
  private evaluators = new Map<string, Evaluator>();

  register(type: string, evaluator: Evaluator): void {
    if (this.evaluators.has(type)) {
      throw new Error(`Evaluator already registered for type: ${type}`);
    }
    this.evaluators.set(type, evaluator);
  }

  get(type: string): Evaluator {
    const evaluator = this.evaluators.get(type);
    if (!evaluator) {
      throw new Error(
        `No evaluator registered for rule type: "${type}". ` +
        `Registered types: ${[...this.evaluators.keys()].join(', ')}`
      );
    }
    return evaluator;
  }

  /**
   * Returns a merged Zod discriminated union of all registered config schemas.
   * The API layer uses this for request validation without knowing about
   * individual rule types.
   */
  getRegisteredTypes(): string[] {
    return [...this.evaluators.keys()];
  }

  getConfigSchema(type: string): z.ZodType {
    return this.get(type).getConfigSchema();
  }
}

// Singleton -- initialized at application startup
export const registry = new EvaluatorRegistry();
```

### Startup Registration

```typescript
// server/engine/index.ts

import { registry } from './registry';
import { SimpleThresholdEvaluator } from './evaluators/simple-threshold';
import { ConditionalThresholdEvaluator } from './evaluators/conditional-threshold';
import { ComputedWithModifiersEvaluator } from './evaluators/computed-with-modifiers';

export function initializeEngine(): void {
  registry.register('simple_threshold', new SimpleThresholdEvaluator());
  registry.register('conditional_threshold', new ConditionalThresholdEvaluator());
  registry.register('computed_with_modifiers', new ComputedWithModifiersEvaluator());
}
```

### The Core Engine Loop (Never Changes)

```typescript
// server/engine/evaluate.ts

import { registry } from './registry';
import { Rule, Mitigation } from '@shared/types/rule';
import { RuleEvalResult } from '@shared/types/engine';

export interface EvaluationInput {
  observations: Record<string, unknown>;
  rules: Rule[];
}

export interface EvaluationOutput {
  results: RuleEvalResult[];
  isAutoDeclined: boolean;
  declineReasons: string[];
  warnings: Array<{ ruleId: string; ruleName: string; missingFields: string[] }>;
  summary: {
    totalRules: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  };
}

/**
 * Pure function. No database access. No side effects.
 * This function does NOT change when new rule types are added.
 */
export function evaluate(input: EvaluationInput): EvaluationOutput {
  const results: RuleEvalResult[] = [];
  const warnings: EvaluationOutput['warnings'] = [];

  for (const rule of input.rules) {
    // 1. Check if referenced fields exist (skip with warning if not)
    const missingFields = getMissingFields(rule, input.observations);
    if (missingFields.length > 0) {
      warnings.push({ ruleId: rule.id, ruleName: rule.name, missingFields });
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleDescription: rule.description,
        status: 'skipped',
        skippedReason: `Missing observation fields: ${missingFields.join(', ')}`,
      });
      continue;
    }

    // 2. Dispatch to the appropriate evaluator (registry handles unknown types)
    try {
      const evaluator = registry.get(rule.type);
      const result = evaluator.evaluate(rule.config, input.observations, rule.mitigations);
      results.push({ ...result, ruleId: rule.id, ruleName: rule.name, ruleDescription: rule.description });
    } catch (error) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleDescription: rule.description,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // 3. Check for auto-decline
  const declineReasons = results
    .filter(r => r.status === 'fail' && r.vulnerability?.mitigations.length === 0)
    .map(r => r.ruleName);

  return {
    results,
    isAutoDeclined: declineReasons.length > 0,
    declineReasons,
    warnings,
    summary: {
      totalRules: input.rules.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    },
  };
}
```

### Why This Achieves Zero-Touch Extensibility

When someone adds a `composite_boolean` rule type in the future:

1. They write `ComputedBooleanConfigSchema` in `/shared/types/rule.ts` and add a new literal to `RuleTypeSchema`.
2. They write `CompositeBooleanEvaluator` implementing the `Evaluator` interface.
3. They call `registry.register('composite_boolean', new CompositeBooleanEvaluator())` in `initializeEngine()`.
4. They add the new schema to the `RuleSchema` discriminated union.

The engine loop, API validation middleware, and release publishing all work automatically because they operate on the `Evaluator` interface, not on concrete types. The frontend rule editor form would need a new config panel for the new type, but the editor framework should use a component registry pattern that mirrors the backend (see Section 6 for risks here).

### Important: `getConfigSchema()` as the Extensibility Linchpin

Each evaluator exposes its Zod schema via `getConfigSchema()`. This means:
- The API validation middleware can validate rule creation requests by asking the registry for the schema, not by hardcoding a switch statement.
- The publish endpoint can validate all rules in a release by iterating rules and asking the registry to validate each one's config.
- The frontend can (post-POC) fetch registered schemas to dynamically render form fields.

For the POC, the frontend will have hardcoded form components per rule type. This is acceptable. But the backend must not hardcode.

---

## 3. Data Layer Design

### Prisma Schema Recommendations

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  underwriter
  applied_science
  admin
}

enum MitigationCategory {
  full
  bridge
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String   @map("password_hash")
  role         UserRole
  createdAt    DateTime @default(now()) @map("created_at")

  // Relations
  createdRules     Rule[]       @relation("RuleCreatedBy")
  publishedReleases Release[]   @relation("ReleasePublishedBy")
  policyLocks      PolicyLock[] @relation("PolicyLockLockedBy")
  evaluations      Evaluation[] @relation("EvaluationCreatedBy")
  auditLogs        AuditLog[]   @relation("AuditLogUser")

  @@map("users")
}

model Rule {
  id          String   @id @default(uuid()) @db.Uuid
  name        String
  description String
  type        String   // simple_threshold | conditional_threshold | computed_with_modifiers
  config      Json     @db.JsonB
  mitigations Json     @db.JsonB  // Array of Mitigation objects
  createdBy   String   @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  version     Int      @default(1)

  // Relations
  creator User @relation("RuleCreatedBy", fields: [createdBy], references: [id])

  @@map("rules")
}

model Release {
  id          String    @id @default(uuid()) @db.Uuid
  name        String    @unique
  publishedAt DateTime  @default(now()) @map("published_at")
  publishedBy String    @map("published_by") @db.Uuid
  isActive    Boolean   @default(false) @map("is_active")

  // Relations
  publisher     User          @relation("ReleasePublishedBy", fields: [publishedBy], references: [id])
  releaseRules  ReleaseRule[]
  policyLocks   PolicyLock[]
  evaluations   Evaluation[]

  @@map("releases")
}

model ReleaseRule {
  id           String @id @default(uuid()) @db.Uuid
  releaseId    String @map("release_id") @db.Uuid
  ruleId       String @map("rule_id") @db.Uuid  // Original draft rule ID for correlation
  ruleSnapshot Json   @map("rule_snapshot") @db.JsonB

  // Relations
  release Release @relation(fields: [releaseId], references: [id])

  @@map("release_rules")
}

model PolicyLock {
  id         String   @id @default(uuid()) @db.Uuid
  propertyId String   @unique @map("property_id")
  releaseId  String   @map("release_id") @db.Uuid
  lockedAt   DateTime @default(now()) @map("locked_at")
  lockedBy   String   @map("locked_by") @db.Uuid

  // Relations
  release Release @relation(fields: [releaseId], references: [id])
  locker  User    @relation("PolicyLockLockedBy", fields: [lockedBy], references: [id])

  @@map("policy_locks")
}

model Evaluation {
  id             String   @id @default(uuid()) @db.Uuid
  propertyId     String   @map("property_id")
  releaseId      String   @map("release_id") @db.Uuid
  observations   Json     @db.JsonB
  result         Json     @db.JsonB
  isAutoDeclined Boolean  @default(false) @map("is_auto_declined")
  createdBy      String   @map("created_by") @db.Uuid
  createdAt      DateTime @default(now()) @map("created_at")

  // Relations
  release    Release               @relation(fields: [releaseId], references: [id])
  creator    User                  @relation("EvaluationCreatedBy", fields: [createdBy], references: [id])
  mitigations EvaluationMitigation[]

  @@index([propertyId])
  @@map("evaluations")
}

model EvaluationMitigation {
  id           String             @id @default(uuid()) @db.Uuid
  evaluationId String             @map("evaluation_id") @db.Uuid
  ruleId       String             @map("rule_id")
  mitigationId String             @map("mitigation_id")
  category     MitigationCategory

  // Relations
  evaluation Evaluation @relation(fields: [evaluationId], references: [id])

  @@unique([evaluationId, ruleId, mitigationId])
  @@map("evaluation_mitigations")
}

model Setting {
  key   String @id
  value Json   @db.JsonB

  @@map("settings")
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  action     String
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  userId     String   @map("user_id") @db.Uuid
  details    Json?    @db.JsonB
  createdAt  DateTime @default(now()) @map("created_at")

  // Relations
  user User @relation("AuditLogUser", fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([userId])
  @@map("audit_log")
}
```

### JSONB Type Safety

Prisma types JSONB columns as `Prisma.JsonValue`, which is `string | number | boolean | null | JsonObject | JsonArray`. This is too loose. The solution is a thin mapping layer at the repository boundary.

**Recommendation: Repository pattern with Zod parsing at the boundary.**

```typescript
// server/repositories/rule-repository.ts

import { PrismaClient } from '@prisma/client';
import { RuleSchema, Rule } from '@shared/types/rule';

export class RuleRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Rule | null> {
    const row = await this.prisma.rule.findUnique({ where: { id } });
    if (!row) return null;

    // Parse the JSONB columns through Zod at the boundary
    return RuleSchema.parse({
      ...row,
      config: row.config,       // JsonValue -> validated config
      mitigations: row.mitigations, // JsonValue -> validated Mitigation[]
    });
  }

  async create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Rule> {
    // Validate before writing
    const config = registry.get(rule.type).getConfigSchema().parse(rule.config);

    const row = await this.prisma.rule.create({
      data: {
        name: rule.name,
        description: rule.description,
        type: rule.type,
        config: config as any,         // Prisma accepts JsonValue
        mitigations: rule.mitigations as any,
        createdBy: rule.createdBy,
      },
    });

    return this.findById(row.id) as Promise<Rule>;
  }
}
```

**Why parse on read, not just on write:** Data may have been written by a migration, seed script, or direct SQL. Parsing on read catches any corruption early. The performance cost is negligible for this use case.

### Immutability of Release Snapshots

The HLD requires that published releases are immutable. Here is how to enforce this at multiple levels.

**Level 1: Application layer.** The release service must not expose any update or delete methods for `ReleaseRule` rows. The only write path is the `publishRelease()` method.

**Level 2: Database trigger (defense in depth).** Add a migration that installs a trigger preventing updates and deletes on `release_rules`:

```sql
-- migrations/XXXXXX_immutable_release_rules.sql

CREATE OR REPLACE FUNCTION prevent_release_rule_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'release_rules rows are immutable. Cannot % on release_rules.', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_release_rules_immutable
  BEFORE UPDATE OR DELETE ON release_rules
  FOR EACH ROW
  EXECUTE FUNCTION prevent_release_rule_mutation();
```

Do the same for the `releases` table (prevent updates to any column except `is_active`, and prevent deletes):

```sql
CREATE OR REPLACE FUNCTION prevent_release_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'releases rows cannot be deleted.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Only allow is_active to change
    IF NEW.name != OLD.name OR NEW.published_at != OLD.published_at OR NEW.published_by != OLD.published_by THEN
      RAISE EXCEPTION 'Only is_active can be updated on releases.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_releases_immutable
  BEFORE UPDATE OR DELETE ON releases
  FOR EACH ROW
  EXECUTE FUNCTION prevent_release_mutation();
```

**Level 3: Unique constraint on active release.** To enforce "exactly one active release," use a partial unique index:

```sql
CREATE UNIQUE INDEX idx_releases_single_active
  ON releases (is_active)
  WHERE is_active = true;
```

This guarantees at the database level that at most one release can be active. The `activateRelease` service method should wrap the deactivation of the old release and activation of the new one in a single transaction.

### Migration Strategy

- Use Prisma Migrate for schema changes. Each migration is a numbered SQL file checked into version control.
- Seed data (4 example rules, 1 release, sample users) should be a separate `prisma/seed.ts` script, NOT part of a migration. Migrations are structural; seeds are data.
- For the JSONB triggers above, use a raw SQL migration (`prisma migrate --create-only` then edit the SQL). Prisma does not support triggers natively, so these must be hand-written SQL within the Prisma migration workflow.

---

## 4. API Design Patterns

### Middleware Chain

Every request flows through this chain. The order matters.

```
Request
  -> errorHandler (wraps everything in try/catch, catches async errors)
  -> requestId (attaches a unique request ID for tracing)
  -> authenticate (verify JWT, attach user to request -- skip for /auth/login)
  -> authorize(roles[]) (check user.role against allowed roles for the route)
  -> validate(schema) (parse request body/params/query through Zod schema)
  -> handler (business logic)
  -> response
```

### Concrete Middleware Implementations

```typescript
// server/middleware/validate.ts

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Validates request body, params, and/or query against Zod schemas.
 * Returns 400 with field-level errors on failure.
 */
export function validate(schema: {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ location: string; path: string; message: string }> = [];

    for (const [location, zodSchema] of Object.entries(schema)) {
      if (!zodSchema) continue;
      const source = location === 'body' ? req.body
                   : location === 'params' ? req.params
                   : req.query;

      const result = zodSchema.safeParse(source);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            location,
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        // Replace with parsed (coerced, defaulted) values
        if (location === 'body') req.body = result.data;
        if (location === 'query') (req as any).query = result.data;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: { errors },
        },
      });
    }

    next();
  };
}
```

```typescript
// server/middleware/authorize.ts

import { UserRole } from '@shared/types/common';

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // Attached by authenticate middleware
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
          details: { requiredRoles: allowedRoles, yourRole: user?.role },
        },
      });
    }
    next();
  };
}
```

### Route Registration Example

```typescript
// server/routes/rules.ts

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { CreateRuleRequestSchema, UpdateRuleRequestSchema } from '@shared/types/api';

const router = Router();

router.post('/rules',
  authenticate,
  authorize('applied_science', 'admin'),
  validate({ body: CreateRuleRequestSchema }),
  ruleController.create,
);

router.put('/rules/:id',
  authenticate,
  authorize('applied_science', 'admin'),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: UpdateRuleRequestSchema,
  }),
  ruleController.update,
);
```

### Error Response Consistency

All errors from all layers must conform to the same shape defined in the HLD:

```typescript
// server/middleware/error-handler.ts

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Prisma known errors (e.g., unique constraint violation)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'A record with this value already exists',
          details: { fields: err.meta?.target },
        },
      });
    }
  }

  // Unknown errors -- do not leak internals
  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

Define a small set of `AppError` subclasses rather than throwing raw errors:

```typescript
// server/errors.ts

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(404, `${entity.toUpperCase()}_NOT_FOUND`, `${entity} not found: ${id}`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, 'CONFLICT', message, details);
  }
}

export class BridgeLimitError extends AppError {
  constructor(current: number, limit: number) {
    super(422, 'BRIDGE_LIMIT_EXCEEDED',
      `Bridge mitigation limit reached (${current}/${limit}). Remove an existing bridge before adding a new one.`,
      { current, limit });
  }
}
```

### Shared Validation Between Frontend and Backend

Because Zod schemas live in `/shared/types/`, both the frontend and backend import the same schemas. The frontend uses them for form validation (with `react-hook-form` + `@hookform/resolvers/zod`), and the backend uses them in the `validate` middleware. This eliminates the possibility of client-side validation accepting input that the server rejects.

```typescript
// Client-side usage example (React)
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateRuleRequestSchema } from '@shared/types/api';

const form = useForm({
  resolver: zodResolver(CreateRuleRequestSchema),
});
```

---

## 5. Testing Strategy

### Layer 1: Engine Unit Tests (Highest Priority)

The engine is a pure function. It is the most critical component and the easiest to test. This is where the bulk of test investment should go.

**What to test:**

| Test Category | Examples | Count Estimate |
|---|---|---|
| SimpleThresholdEvaluator | Each operator (eq, neq, in, gte, lte, gt, lt) x pass/fail | ~14 tests |
| ConditionalThresholdEvaluator | Branch match, branch fallthrough to default, no match (default), multiple branches (first match wins) | ~8 tests |
| ComputedWithModifiersEvaluator | Single modifier, multiple modifiers, multiply vs divide, array field (all pass, one fails, all fail) | ~12 tests |
| Bridge stacking | No bridges, single bridge, multiple bridges stacking multiplicatively, bridge brings threshold below observed (pass), bridge insufficient (still fail), edge: modifier product near zero | ~10 tests |
| Core engine loop | Rule with missing fields (skipped), evaluator throws (error status), mix of pass/fail/skip, auto-decline detection, all pass (no vulnerabilities) | ~10 tests |
| Config validation | Valid configs per type, invalid configs (missing fields, wrong types, empty arrays), edge cases per evaluator | ~15 tests |

**Bridge stacking edge cases that MUST be tested:**

```typescript
describe('Bridge Stacking Edge Cases', () => {
  it('should handle single bridge that makes property pass', () => {
    // base=90, observed=75, bridge=0.8 -> threshold=72, 75>=72 -> pass
  });

  it('should handle multiple bridges that cumulatively make property pass', () => {
    // base=90, observed=50, bridges=[0.8, 0.5] -> 90*0.8*0.5=36, 50>=36 -> pass
  });

  it('should handle bridges that are insufficient', () => {
    // base=90, observed=20, bridges=[0.8, 0.5] -> 36, 20<36 -> still fail
  });

  it('should return per-bridge breakdown with running thresholds', () => {
    // Verify breakdown array has correct intermediate values
  });

  it('should apply bridges uniformly across array items', () => {
    // Two vegetation items, same bridges applied to both
    // One passes, one still fails -> rule triggers
  });

  it('should handle bridge modifier product approaching zero', () => {
    // bridges=[0.1, 0.1, 0.1] -> product=0.001 -> threshold near zero
    // This is a known limitation (L-6) but engine should not crash
  });

  it('should compute correctly with division modifiers', () => {
    // Grass divides by 3, so threshold is reduced
  });
});
```

**Test structure:**

```typescript
// server/engine/__tests__/evaluate.test.ts

import { evaluate } from '../evaluate';
import { Rule } from '@shared/types/rule';

// Use the 4 seed rules from Appendix A as test fixtures
import { SEED_RULES } from '../__fixtures__/seed-rules';

describe('evaluate()', () => {
  describe('Attic Vent Rule (simple threshold)', () => {
    const rules = [SEED_RULES.atticVent];

    it('should pass when attic_vent_screens is Ember Resistant', () => {
      const result = evaluate({
        observations: { attic_vent_screens: 'Ember Resistant' },
        rules,
      });
      expect(result.results[0].status).toBe('pass');
      expect(result.summary.failed).toBe(0);
    });

    it('should fail when attic_vent_screens is Standard', () => {
      const result = evaluate({
        observations: { attic_vent_screens: 'Standard' },
        rules,
      });
      expect(result.results[0].status).toBe('fail');
      expect(result.results[0].vulnerability).toBeDefined();
      expect(result.results[0].vulnerability!.mitigations).toHaveLength(1);
    });

    it('should skip when attic_vent_screens is missing', () => {
      const result = evaluate({
        observations: {},
        rules,
      });
      expect(result.results[0].status).toBe('skipped');
      expect(result.warnings).toHaveLength(1);
    });
  });
});
```

### Layer 2: API Integration Tests (High Priority)

Test the full request lifecycle: HTTP request -> middleware -> service -> database -> response. Use a real test database (not mocks).

**Setup:** Use a Docker-based PostgreSQL for tests. Run migrations and seed before each test suite. Wrap each test in a transaction and roll back (or truncate tables between tests).

**What to test:**

| Area | What | Priority |
|---|---|---|
| Auth | Login returns JWT, invalid credentials rejected, expired token rejected | High |
| Role authorization | Underwriter cannot create rules, Applied Science cannot access admin settings | High |
| Rule CRUD | Create, read, update with version (optimistic lock), 409 on version mismatch | High |
| Evaluate | Full pipeline: submit observations, get results, verify structure matches schema | High |
| Release publish | Publishes snapshot of current rules, snapshot is immutable, activate works | High |
| Mitigation selection | Select mitigations, bridge limit enforcement, 422 on limit exceeded | High |
| Policy lock | First eval creates lock, subsequent eval uses locked release, override logged | Medium |
| Validation | Invalid observation input returns 400 with field errors | Medium |

```typescript
// server/__tests__/api/evaluate.integration.test.ts

describe('POST /api/evaluate', () => {
  let token: string;

  beforeAll(async () => {
    // Seed users, rules, and an active release
    token = await loginAs('underwriter@test.com');
  });

  it('should evaluate observations against active release', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        observations: {
          property_id: 'PROP-001',
          state: 'CA',
          attic_vent_screens: 'Standard',
          roof_type: 'Class A',
          wildfire_risk_category: 'B',
          home_to_home_distance: 20,
          window_type: 'Single Pane',
          vegetation: [
            { type: 'Tree', distance_to_window: 50 },
          ],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.results).toBeInstanceOf(Array);
    expect(res.body.data.summary.totalRules).toBe(4);
    // Attic vent should fail (Standard != Ember Resistant)
    const atticResult = res.body.data.results.find(
      (r: any) => r.ruleName === 'Attic Vent'
    );
    expect(atticResult.status).toBe('fail');
  });

  it('should create a policy lock on first evaluation', async () => {
    // Verify policy_locks table has an entry for PROP-001
  });

  it('should return 400 for missing globally required fields', async () => {
    const res = await request(app)
      .post('/api/evaluate')
      .set('Authorization', `Bearer ${token}`)
      .send({ observations: {} }); // Missing property_id and state

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### Layer 3: Zod Schema Tests (Medium Priority)

Validate that the Zod schemas accept valid data and reject invalid data. These are fast and catch schema regressions.

```typescript
describe('RuleSchema', () => {
  it('should accept a valid simple_threshold rule', () => {
    const result = RuleSchema.safeParse(SEED_RULES.atticVent);
    expect(result.success).toBe(true);
  });

  it('should reject a rule with unknown type', () => {
    const result = RuleSchema.safeParse({ ...SEED_RULES.atticVent, type: 'unknown' });
    expect(result.success).toBe(false);
  });

  it('should reject a bridge mitigation without an effect', () => {
    const badMitigation = { name: 'Test', category: 'bridge', description: 'Missing effect' };
    const result = BridgeMitigationSchema.safeParse(badMitigation);
    expect(result.success).toBe(false);
  });
});
```

### Layer 4: E2E Smoke Tests (Lower Priority for POC)

A small number of end-to-end tests that verify the critical user flows work through the actual UI. Use Playwright or Cypress.

**Recommended smoke tests (5-8 total):**

1. Login as underwriter, submit an observation, see results.
2. Login as applied science, create a rule, test it in sandbox.
3. Login as applied science, publish a release, activate it.
4. Login as underwriter, evaluate property, select mitigations, hit bridge limit.
5. Login as admin, change bridge limit, verify new limit is enforced.

These are expensive to write and maintain. Do not aim for comprehensive coverage here. The engine unit tests and API integration tests carry the reliability burden.

### What NOT to Test

- Do not unit test Prisma queries. Prisma is a well-tested library. Test the repository methods through integration tests against a real database.
- Do not mock the engine in API tests. The engine is fast (pure functions, in-memory). Let it run. Mock the database if anything, not the engine.
- Do not test React component rendering in isolation for the POC. Focus backend testing on the engine and API. Frontend testing can come post-POC.

---

## 6. Extensibility Risks

### Risk 1: Frontend Rule Editor Coupling (HIGH RISK)

**The problem:** The backend achieves extensibility through the Registry + Strategy pattern. The frontend rule editor will likely have hardcoded form components per rule type (a `SimpleThresholdForm`, a `ConditionalThresholdForm`, a `ComputedWithModifiersForm`). When a 4th rule type is added, someone must also write a new form component and add it to a switch statement in the editor.

**Recommendation:** Accept this coupling for the POC but mitigate it with a simple component registry on the frontend:

```typescript
// client/components/rule-editor/form-registry.ts

import { SimpleThresholdForm } from './simple-threshold-form';
import { ConditionalThresholdForm } from './conditional-threshold-form';
import { ComputedWithModifiersForm } from './computed-with-modifiers-form';

const formRegistry: Record<string, React.ComponentType<RuleFormProps>> = {
  simple_threshold: SimpleThresholdForm,
  conditional_threshold: ConditionalThresholdForm,
  computed_with_modifiers: ComputedWithModifiersForm,
};

export function getRuleForm(type: string): React.ComponentType<RuleFormProps> | null {
  return formRegistry[type] ?? null;
}
```

This is not zero-touch (you still write a component and register it), but it ensures the rest of the editor code does not need to change.

**Invest now:** Define a clear `RuleFormProps` interface. Every form component receives the same props and emits the same shape. This is the contract that makes adding forms predictable.

### Risk 2: Observation Schema Drift (MEDIUM RISK)

**The problem:** The observation hash is currently untyped -- it is `Record<string, unknown>`. Rules reference fields by string name (`"attic_vent_screens"`, `"vegetation[].type"`). There is no central registry of valid observation field names, types, or allowed values. If a rule references `"attic_vent_screen"` (typo, missing `s`), the error surfaces only at evaluation time as a silent skip.

**Recommendation for POC:** Create a `shared/types/observations.ts` file that defines the known observation fields as a Zod schema. Use this for input validation on the evaluate endpoint. Rules can still reference any string field (to allow for future flexibility), but the evaluation input is validated against the known schema.

```typescript
// shared/types/observations.ts

export const VegetationItemSchema = z.object({
  type: z.enum(['Tree', 'Shrub', 'Grass']),
  distance_to_window: z.number().positive(),
});

export const ObservationsSchema = z.object({
  property_id: z.string().min(1),
  state: z.string().min(1),
  attic_vent_screens: z.enum(['None', 'Standard', 'Ember Resistant']).optional(),
  roof_type: z.enum(['Class A', 'Class B', 'Class C']).optional(),
  window_type: z.enum(['Single Pane', 'Double Pane', 'Tempered Glass']).optional(),
  wildfire_risk_category: z.enum(['A', 'B', 'C', 'D']).optional(),
  vegetation: z.array(VegetationItemSchema).optional(),
  home_to_home_distance: z.number().positive().optional(),
}).passthrough(); // Allow unknown fields for forward compatibility
```

The `.passthrough()` is important: it allows observations to include fields that rules reference but that are not in the known schema yet. Strict validation would break extensibility.

**Post-POC:** Build a dynamic observation field registry that rule authors manage, replacing the hardcoded schema.

### Risk 3: JSONB Column Evolution (MEDIUM RISK)

**The problem:** Rule configs are stored as JSONB. When a new rule type is added, its config shape is different. When an existing config schema evolves (e.g., adding an optional `minThreshold` field to computed rules for L-6), old data in the database does not automatically conform to the new schema.

**Recommendation:** The Zod schemas in `/shared/types/rule.ts` are the migration path. New optional fields should have defaults in the Zod schema (`.default()`). Mandatory new fields require a data migration script.

```typescript
// Example: adding minThresholdPercent to computed rules (post-POC, for L-6)
export const ComputedWithModifiersConfigSchema = z.object({
  baseValue: z.number().positive(),
  unit: z.string().min(1),
  modifiers: z.array(ModifierSchema).min(1),
  comparisonField: z.string().min(1),
  comparisonOperator: OperatorSchema,
  arrayField: z.string().optional(),
  minThresholdPercent: z.number().min(0).max(100).default(0), // NEW: defaults to 0 (no floor)
});
```

Because the repository layer parses JSONB through Zod on read (Section 3), the `.default(0)` ensures old records without `minThresholdPercent` are automatically filled in. No data migration needed for optional fields with defaults.

For published releases, the `rule_snapshot` JSONB was captured at publish time and must remain as-is. The evaluator must handle both old and new config shapes. This is another reason each evaluator owns its own schema and validation -- it can version its own config format.

### Risk 4: Bridge Effect Types Growing (LOW RISK for POC)

**The problem:** Currently bridge effects are `multiplier | override`. Post-POC, there might be `additive` (subtract a fixed amount from threshold), `conditional_override` (override that only applies under certain conditions), etc.

**Recommendation:** The discriminated union on `type` handles this naturally. Adding a new bridge effect type is: write a Zod schema with a new `type` literal, add it to the `BridgeEffectSchema` union, handle it in the evaluator. No risk here as long as the discriminated union pattern is maintained.

**Do NOT abstract this further.** A plugin system or effect interpreter would be over-engineering for a POC with 2 effect types.

### Risk 5: The Evaluate Endpoint Doing Too Much (MEDIUM RISK)

**The problem:** The `POST /api/evaluate` endpoint does many things: resolve release (policy lock logic), load rules, run engine, check auto-decline, persist evaluation, create policy lock. This is the most complex endpoint and the most likely to accumulate tech debt.

**Recommendation:** Decompose the handler into an explicit pipeline of service methods. Each step is independently testable:

```typescript
// server/services/evaluation-service.ts

class EvaluationService {
  async evaluateProperty(input: EvaluateRequest, userId: string): Promise<EvaluationResponse> {
    // Step 1: Resolve which release to use
    const release = await this.releaseResolver.resolve(
      input.observations.property_id,
      input.releaseId,
      userId,
    );

    // Step 2: Load rules from the release snapshot
    const rules = await this.releaseRepository.getRulesForRelease(release.id);

    // Step 3: Run the engine (pure function)
    const engineResult = evaluate({
      observations: input.observations,
      rules,
    });

    // Step 4: Persist
    const evaluation = await this.evaluationRepository.save({
      propertyId: input.observations.property_id,
      releaseId: release.id,
      observations: input.observations,
      result: engineResult,
      isAutoDeclined: engineResult.isAutoDeclined,
      createdBy: userId,
    });

    // Step 5: Ensure policy lock exists
    await this.policyLockService.ensureLock(
      input.observations.property_id,
      release.id,
      userId,
    );

    return { evaluation, engineResult, release };
  }
}
```

Each of `releaseResolver`, `releaseRepository`, `evaluationRepository`, and `policyLockService` is a focused class that can be unit-tested or mocked independently.

### Where NOT to Over-Abstract

1. **Do not build a generic plugin loader.** The registry is sufficient. Evaluators are compiled TypeScript classes, not dynamically loaded modules. Keep it simple.

2. **Do not abstract the database behind a generic repository interface.** Prisma is already an abstraction. A thin repository layer (Section 3) is enough. Generic `IRepository<T>` interfaces add ceremony without value at POC scale.

3. **Do not build a rule DSL.** The HLD explicitly chose structured forms over a DSL (Trade-off T-2). Resist the temptation to create a mini-language for rule definitions. The Zod schemas are the "language."

4. **Do not build a generic workflow engine for the publish/activate lifecycle.** It is two states (draft and published) with one transition (publish) and one flag (is_active). A state machine library would be absurd here.

5. **Do not pre-build multi-tenancy.** The HLD says single-tenant (A-8). Adding tenant scoping to every query now would slow development for a need that may never materialize.

---

## Summary of Recommendations

| Area | Key Recommendation | Effort |
|---|---|---|
| Shared Types | Zod-first, TypeScript-derived. Discriminated unions for rules and bridge effects. | Medium |
| Engine Extensibility | `Evaluator` interface with `evaluate()`, `validate()`, `getConfigSchema()`. Registry singleton. Engine loop never changes. | Low (design), Medium (implement) |
| Data Layer | Prisma with JSONB. Parse through Zod at repository boundary. Database triggers for release immutability. Partial unique index for single active release. | Medium |
| API Design | Middleware chain: auth -> role -> validate -> handler. `AppError` hierarchy. Shared Zod validation. | Medium |
| Testing | Engine unit tests are highest priority (~70 tests). API integration tests with real DB (~30 tests). E2E smoke tests (~5 tests). | High (time investment) |
| Extensibility | Invest in frontend form registry and observation schema. Accept JSONB evolution via Zod defaults. Do NOT over-abstract plugins, DSLs, repositories, or multi-tenancy. | Low |

---

*End of document.*
