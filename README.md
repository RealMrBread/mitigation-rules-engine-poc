# Mitigation Rules Engine (POC)

A web-based rules engine for wildfire-focused property insurance that evaluates property observations against versioned underwriting rules, identifies vulnerabilities, and suggests categorized mitigations (full or bridge) -- enabling underwriters to make consistent, explainable, and auditable decisions.

---

## Architecture Overview

```
                         +---------------------------+
                         |        Browser            |
                         |  React + Vite + Tailwind  |
                         +------------+--------------+
                                      |
                              HTTP (port 5173)
                              Vite proxy /api ->
                                      |
                         +------------+--------------+
                         |     Express API (3000)     |
                         |  JWT Auth + RBAC Middleware |
                         |  Zod Request Validation    |
                         +---+--------+---------+----+
                             |        |         |
                     +-------+  +-----+---+  +--+--------+
                     | Rules |  | Releases|  |  Admin    |
                     | CRUD  |  | Publish |  |  Settings |
                     +-------+  | Lock    |  +-----------+
                                +----+----+
                                     |
                         +-----------+-----------+
                         |   Engine (pure fns)   |
                         |  Registry + Strategy  |
                         +---+------+-------+----+
                             |      |       |
                       Simple  Conditional  Computed
                      Threshold Threshold  w/ Modifiers
                             |      |       |
                         +---+------+-------+----+
                         |  Bridge Stacker       |
                         |  (multiplicative)     |
                         +-----------+-----------+
                                     |
                         +-----------+-----------+
                         |   PostgreSQL (Prisma)  |
                         |  Users, Rules, Releases|
                         |  Evaluations, Locks    |
                         |  Audit Log, Settings   |
                         +------------------------+
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Hook Form |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Validation | Zod (shared schemas across client and server) |
| Auth | JWT + bcrypt (3 roles: Underwriter, Applied Science, Admin) |
| Testing | Vitest, Supertest |
| Build | Vite (client), tsc (server), npm workspaces |

---

## Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL (running locally)
- npm

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd mitigation-rules-engine
npm install

# 2. Create databases
createdb mitigation_rules_engine
createdb mitigation_rules_engine_test

# 3. Set environment variable (or create server/.env)
export DATABASE_URL="postgresql://<user>@localhost:5432/mitigation_rules_engine"

# 4. Run migrations
cd server && npx prisma migrate dev

# 5. Seed the database (choose one)
npx prisma db seed          # Base seed: 3 users, 4 rules, 1 release
npm run seed:demo           # Demo seed: + 7 evaluations, 2 releases, audit log

# 6. Start the backend
npx tsx src/index.ts        # Runs on port 3000

# 7. Start the frontend (new terminal)
cd client && npx vite       # Runs on port 5173, proxies /api to :3000
```

Open http://localhost:5173 in your browser.

### Test Accounts

| Email | Password | Role |
|-------|----------|------|
| `underwriter@test.com` | `password123` | Underwriter -- evaluate properties, select mitigations |
| `scientist@test.com` | `password123` | Applied Science -- manage rules, publish releases |
| `admin@test.com` | `password123` | Admin -- configure settings, manage users |

---

## Available Scripts

### Root

| Script | Command | Description |
|--------|---------|-------------|
| Install all | `npm install` | Install all workspace dependencies |
| Build all | `npm run build` | Build all workspaces |
| Test all | `npm run test` | Run tests across all workspaces |
| Typecheck all | `npm run typecheck` | Type-check all workspaces |

### Server (`cd server`)

| Script | Command | Description |
|--------|---------|-------------|
| Run server | `npx tsx src/index.ts` | Start Express server on port 3000 |
| Run tests | `npx vitest run` | Run all server tests (128 tests) |
| Base seed | `npx prisma db seed` | Seed with base data |
| Demo seed | `npm run seed:demo` | Seed with extended demo data |
| Migrations | `npx prisma migrate dev` | Run database migrations |
| Prisma Studio | `npx prisma studio` | Open Prisma database browser |

### Client (`cd client`)

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npx vite` | Start Vite dev server on port 5173 |
| Build | `npx vite build` | Production build |
| Typecheck | `npx tsc --noEmit` | Type-check frontend |

### Shared (`cd shared`)

| Script | Command | Description |
|--------|---------|-------------|
| Run tests | `npx vitest run` | Run schema tests (24 tests) |

---

## Project Structure

```
mitigation-rules-engine/
  shared/                          # Shared types, schemas, seed data
    types/                         #   TypeScript type definitions
      observation.ts               #     ObservationHash, VegetationItem
      rule.ts                      #     Rule (discriminated union), Mitigation
      evaluation.ts                #     EvaluationResult, VulnerabilityResult
    schemas/                       #   Zod validation schemas
      observation.schema.ts        #     Observation field validation
      rule.schema.ts               #     Rule config schemas (per type)
    data/                          #   Seed data constants
      seed-rules.ts                #     4 example rules (Attic Vent, Roof, Windows, Home-to-Home)
      seed-observations.ts         #     5 observation sets for testing

  server/                          # Express backend
    prisma/
      schema.prisma                #   Database schema (9 models)
      seed.ts                      #   Base seed (3 users, 4 rules, 1 release)
      seed-demo.ts                 #   Extended demo seed (+ evaluations, audit log)
    src/
      engine/                      #   Rules engine (pure functions)
        engine.ts                  #     Main evaluate() function
        registry.ts                #     EvaluatorRegistry (Strategy pattern)
        bridge-stacker.ts          #     Bridge mitigation stacking
        evaluators/                #     Evaluator implementations
          simple-threshold.evaluator.ts
          conditional-threshold.evaluator.ts
          computed-with-modifiers.evaluator.ts
      routes/                      #   Express route handlers
        auth.routes.ts             #     POST /auth/login, /auth/register
        evaluation.routes.ts       #     POST /evaluate, GET /evaluations
        rule.routes.ts             #     CRUD /rules, POST /rules/:id/test
        release.routes.ts          #     /releases, /releases/:id/activate
        admin.routes.ts            #     /settings, /users
        audit.routes.ts            #     GET /audit-log
      services/                    #   Business logic layer
      middleware/                  #   Auth, RBAC, validation, error handling
      db/                          #   Prisma client + repositories

  client/                          # React frontend
    src/
      pages/                       #   Route pages
        login.tsx                  #     Login
        evaluation/                #     Evaluation form, results, history
        rules/                     #     Rule list, editor, test sandbox
        releases/                  #     Release manager
        admin/                     #     Settings, users, audit log
        rule-reference/            #     Read-only rule reference (underwriter)
      components/                  #   Reusable UI components
      contexts/                    #   Auth context
      hooks/                       #   React Query hooks
      lib/                         #   API client

  docs/                            # Design documents
    HLD-final.md                   #   Authoritative high-level design
    iteration-plan.md              #   8-iteration plan with FR/NFR matrix
    functional-requirements.md     #   Full FR/NFR specification
```

---

## How to Add a New Rule Type

The engine uses the **Registry + Strategy** pattern. Adding a new evaluator type requires 3 steps:

### 1. Create the Evaluator

```typescript
// server/src/engine/evaluators/my-evaluator.ts
import type { Evaluator, EvalResult } from '../evaluator.interface.js';

export class MyEvaluator implements Evaluator {
  evaluate(config: any, observations: Record<string, any>): { result: EvalResult } {
    // Your evaluation logic here
    return {
      result: {
        triggered: /* true if vulnerability found */,
        details: {
          observedValues: { /* what was observed */ },
          requiredValues: { /* what was required */ },
          explanation: 'Human-readable explanation',
        },
      },
    };
  }
}
```

### 2. Register the Evaluator

```typescript
// server/src/engine/engine.ts -- add to the defaultRegistry setup
import { MyEvaluator } from './evaluators/my-evaluator.js';

defaultRegistry.register('my_type', new MyEvaluator());
```

### 3. Add to the Schema

```typescript
// shared/schemas/rule.schema.ts -- add a new config schema
export const MyConfigSchema = z.object({
  // your config fields
});

// Add to the discriminated union in RuleSchema
```

Then write tests in `server/src/engine/__tests__/my-evaluator.test.ts`.

---

## Testing

### Test Suites

| Suite | Location | Count | Command |
|-------|----------|-------|---------|
| Schema validation | `shared/__tests__/` | 24 | `cd shared && npx vitest run` |
| Engine unit tests | `server/src/engine/__tests__/` | ~55 | `cd server && npx vitest run` |
| Repository tests | `server/src/db/__tests__/` | ~15 | (included in server tests) |
| API integration | `server/src/__tests__/api/` | ~58 | (included in server tests) |
| **Total** | | **152** | `npm run test` |

### Test Files

| File | Coverage |
|------|----------|
| `simple-threshold.evaluator.test.ts` | Simple threshold evaluator (eq, neq, in, gte, lte, gt, lt) |
| `conditional-threshold.evaluator.test.ts` | Conditional branches, default fallback |
| `computed-with-modifiers.evaluator.test.ts` | Base value, modifiers, array fields, per-item eval |
| `bridge-stacker.test.ts` | Single/stacked bridges, multiplicative math, pass/fail |
| `engine.test.ts` | Full integration: all 4 rules, auto-decline, missing fields, determinism |
| `registry.test.ts` | Evaluator registration, dispatch, unknown type errors |
| `repositories.test.ts` | CRUD for all repositories, optimistic locking |
| `auth.test.ts` | Login, register, JWT verification, role checks |
| `evaluation.test.ts` | POST /evaluate, mitigations, policy lock, bridge limits |
| `rules.test.ts` | Rule CRUD, validation, test sandbox |
| `admin.test.ts` | Settings, user management, audit log |
| `smoke.test.ts` | Health check, CORS, error format |
| `schemas.test.ts` | Zod schema validation (valid/invalid for all types) |

---

## Seed Data

### Base Seed (`npx prisma db seed`)

Minimal data for development:

| Entity | Count | Details |
|--------|-------|---------|
| Users | 3 | One per role |
| Rules | 4 | Attic Vent, Roof, Windows, Home-to-Home |
| Releases | 1 | "2026-POC-v1.0" (active) |
| Settings | 1 | bridge_mitigation_limit = 3 |

### Demo Seed (`npm run seed:demo`)

Extended data for demos and screen population:

| Entity | Count | Details |
|--------|-------|---------|
| Users | 3 | Same as base |
| Rules | 4 | Same as base |
| Releases | 2 | v1.0 (active), v2.0 (inactive) |
| Evaluations | 7 | Varied scenarios (see below) |
| Mitigations | 6 | Full and bridge selections |
| Policy Locks | 5 | Properties locked to v1.0 |
| Audit Entries | 6 | Release publish/activate, settings, users |
| Settings | 1 | bridge_mitigation_limit = 3 |

**Demo evaluation scenarios:**

| Property | Scenario | Vulnerabilities | Mitigations Selected |
|----------|----------|-----------------|---------------------|
| PROP-DEMO-001 | All passing | 0 | None |
| PROP-DEMO-002 | Attic vent fail | 1 (Attic Vent) | Install Ember-Rated Vents (full) |
| PROP-DEMO-003 | Windows fail | 1+ (Windows) | Apply Film (bridge) + Prune Trees (bridge) |
| PROP-DEMO-004 | Auto-decline | 1 (Home-to-Home) | N/A (unmitigatable) |
| PROP-DEMO-005 | Multiple failures | 3 (Attic + Roof + Windows) | Ember Vents (full) + Replace Roof (full) |
| PROP-DEMO-006 | Roof conditional pass | 0 (Class B OK in risk A) | None |
| PROP-DEMO-007 | Windows edge case | 1 (barely fails) | Apply Film (bridge) |

---

## Domain Concepts

| Concept | Definition |
|---------|-----------|
| **Observation Hash** | Structured property data submitted for evaluation (roof type, vents, vegetation, etc.) |
| **Vulnerability** | A rule that the property fails; includes description and applicable mitigations |
| **Full Mitigation** | Completely eliminates a vulnerability (e.g., "Replace Roof") |
| **Bridge Mitigation** | Partially addresses a vulnerability with a multiplier effect; tracked and limited |
| **Bridge Stacking** | Multiple bridge mitigations on one vulnerability stack multiplicatively (e.g., 0.8 x 0.5 = 0.4) |
| **Auto-Decline** | A triggered vulnerability with no mitigations; property is uninsurable |
| **Release** | Immutable, named snapshot of the complete rule set |
| **Policy Lock** | Binds a property to a specific release on first evaluation |

---

## Design Documents

- [HLD Final](docs/HLD-final.md) -- Authoritative high-level design (problem, tenets, requirements, architecture, trade-offs)
- [Iteration Plan](docs/iteration-plan.md) -- 8-iteration implementation plan with FR/NFR coverage matrix
- [Functional Requirements](docs/functional-requirements.md) -- Complete FR and NFR specification
- [Architecture Recommendations](docs/architecture-recommendations.md) -- Extensibility patterns and testing strategy
- [FR/NFR Coverage Matrix](docs/coverage-matrix.md) -- Requirement-to-implementation traceability

---

## Iteration Status

- [x] Iteration 1: Shared types, Zod schemas, seed data (24 tests)
- [x] Iteration 2: Engine core -- 3 evaluators, registry, bridge stacker (~55 tests)
- [x] Iteration 3: Data layer -- Prisma schema, repositories, seed (~15 tests)
- [x] Iteration 4: API layer -- 23 endpoints, JWT auth, middleware (~58 tests)
- [x] Iteration 5: Frontend -- evaluation form, results, bridge stacking UI
- [x] Iteration 6: Frontend -- rule management, releases (Applied Science)
- [x] Iteration 7: Admin settings, user management, rule reference, audit log
- [x] Iteration 8: E2E testing, demo seed, polish
