# Mitigation Rules Engine -- Iteration Plan

**Version**: 1.0
**Date**: 2026-03-14
**Author**: Tech Lead
**Priority**: Completeness and extensibility over performance and scalability

> This plan covers 100% of FRs (FR-1 through FR-10) and NFRs (NFR-1 through NFR-7) from the authoritative HLD-final.md. 8 iterations, each independently shippable and testable.

---

## Design Rationale for Ordering

The HLD's Appendix C suggests 4 phases. We expand to 8 iterations for tighter scoping and testability. Key ordering decisions:

1. **Engine core first** (Iterations 1-2): Highest-risk component per T-5. Pure functions with zero dependencies means exhaustive testing of all 3 evaluator types and bridge stacker before touching infrastructure.
2. **Data layer before API**: Prisma schema + seed data must exist before endpoints can be built.
3. **API before frontend**: Frontend consumes the API -- build against real endpoints from the start.
4. **Evaluation flow before rule management**: Underwriters are the primary users. Core value prop validated early.
5. **Admin and polish last**: Lower-risk features that layer on top of the existing foundation.

---

## Iteration 1: Shared Types and Zod Schemas

**Goal**: Establish the shared type system and validation schemas that the entire codebase depends on.

**FRs/NFRs covered**: FR-1.2, FR-2.4, FR-3.2, FR-3.4, NFR-7

**Scope**:
- `/shared/types/observation.ts` -- ObservationHash type with enum, numeric, boolean, array field support
- `/shared/types/rule.ts` -- Rule type (discriminated union over `simple_threshold | conditional_threshold | computed_with_modifiers`), RuleConfig per type, Mitigation type with Full/Bridge categories, BridgeEffect discriminated union (`multiplier` | `override`)
- `/shared/types/evaluation.ts` -- EvaluationResult, VulnerabilityResult, MitigationSuggestion, BridgeStackBreakdown, SkippedRule, AutoDeclineInfo
- `/shared/types/release.ts` -- Release, ReleaseRule types
- `/shared/types/user.ts` -- User, Role enum (underwriter, applied_science, admin)
- `/shared/types/settings.ts` -- Settings type (bridge_mitigation_limit)
- `/shared/types/api.ts` -- Standard error response format, API request/response wrappers
- `/shared/schemas/observation.schema.ts` -- Zod schema for observation validation (globally required vs rule-referenced)
- `/shared/schemas/rule.schema.ts` -- Zod schemas for each rule type config, mitigation array, bridge effects. Discriminated union on `type` field.
- `/shared/schemas/evaluation.schema.ts` -- Zod schemas for evaluation request/response
- `/shared/schemas/release.schema.ts` -- Zod schema for release creation
- `/shared/schemas/index.ts` -- Barrel exports
- `/shared/data/seed-rules.ts` -- The 4 example rules from HLD Appendix A as typed constants
- Monorepo scaffolding: `package.json` at root, `/client`, `/server`, `/shared` workspace setup with TypeScript path aliases

**Acceptance criteria**:
- All types compile with strict TypeScript
- Zod schemas parse the 4 example rules without error
- Zod schemas reject malformed rules (wrong type, missing fields, invalid operator) with meaningful errors
- Discriminated union on rule type narrows correctly in TypeScript
- BridgeEffect discriminated union (`multiplier` vs `override`) narrows correctly
- Unit tests: at least 15 tests covering valid/invalid parsing for each rule type, observation types, and mitigation structures

**Dependencies**: None (greenfield)

**Estimated complexity**: M

---

## Iteration 2: Engine Core -- Evaluators, Registry, and Bridge Stacker

**Goal**: Build the pure-function rules engine with all 3 evaluator types and the bridge stacking algorithm.

**FRs/NFRs covered**: FR-2.1, FR-2.2, FR-2.3, FR-2.4.1, FR-2.4.2, FR-2.4.3, FR-2.5, FR-2.6, FR-2.7, FR-3.1, FR-3.3, FR-3.5, FR-3.7, FR-3.8, FR-3.9, FR-9.1, FR-9.2, FR-9.3, FR-1.3, FR-1.4, NFR-1, NFR-7

**Scope**:
- `/server/src/engine/evaluator.interface.ts` -- `Evaluator` interface with `evaluate(config, observations)` and `validate(config)` methods
- `/server/src/engine/registry.ts` -- `EvaluatorRegistry` class with `register(type, evaluator)`, `get(type)`, typed dispatch
- `/server/src/engine/evaluators/simple-threshold.evaluator.ts` -- Operators: eq, neq, in, gte, lte, gt, lt. Returns VulnerabilityResult with observed vs required values.
- `/server/src/engine/evaluators/conditional-threshold.evaluator.ts` -- Evaluates condition branches (when/then), falls back to default. Reports which branch matched.
- `/server/src/engine/evaluators/computed-with-modifiers.evaluator.ts` -- Base value * modifier product. Array field support (per-item evaluation). Reports full computation breakdown.
- `/server/src/engine/bridge-stacker.ts` -- Takes base threshold + selected bridge mitigations, returns BridgeStackBreakdown with per-bridge running totals
- `/server/src/engine/engine.ts` -- `evaluate(observations, rules[])` pure function. Orchestrates: validate globally required fields, iterate rules, check field presence (skip with warning if missing), dispatch to evaluator, collect results, check auto-decline.
- `/server/src/engine/__tests__/simple-threshold.test.ts` -- Tests with Rule 1 (Attic Vent) and Rule 4 (Home-to-Home Distance)
- `/server/src/engine/__tests__/conditional-threshold.test.ts` -- Tests with Rule 2 (Roof) covering all condition branches + default
- `/server/src/engine/__tests__/computed-with-modifiers.test.ts` -- Tests with Rule 3 (Windows) covering array evaluation, multiple modifiers, per-item pass/fail
- `/server/src/engine/__tests__/bridge-stacker.test.ts` -- Single bridge, stacked bridges (Film + Prune = 0.4), threshold reduction math, pass/fail after stacking
- `/server/src/engine/__tests__/engine.test.ts` -- Integration tests: all 4 rules together, auto-decline scenario, missing field skip + warning, multiple vulnerabilities, determinism
- `/server/src/engine/__tests__/validation.test.ts` -- Evaluator-specific `validate()` tests for each rule type

**Acceptance criteria**:
- `evaluate()` with all 4 seed rules produces correct vulnerabilities for at least 5 distinct observation sets
- Auto-decline triggered when Rule 4 (Home-to-Home) fails, with other vulnerabilities still reported
- Bridge stacker: Film (0.8) + Prune (0.5) on a 90ft threshold yields 36ft, marked as passing for 50ft actual distance
- Missing rule-referenced field skips rule with warning; missing globally required field returns validation error
- Each evaluator's `validate()` rejects invalid configs
- Computed evaluator handles array fields correctly (each vegetation item evaluated independently)
- All tests pass. Minimum 40 unit tests across the engine module.
- Performance: evaluating 4 rules completes in under 10ms

**Dependencies**: Iteration 1

**Estimated complexity**: XL

---

## Iteration 3: Data Layer -- Prisma Schema, Migrations, and Seed Data

**Goal**: Establish the database schema, ORM layer, and seed the database with the 4 example rules as a published + active release.

**FRs/NFRs covered**: FR-5.5, FR-6.1, FR-6.3, FR-6.7, NFR-5, NFR-6

**Scope**:
- `/server/prisma/schema.prisma` -- Full data model: `users`, `rules` (with version column), `releases`, `release_rules`, `policy_locks`, `evaluations`, `evaluation_mitigations`, `settings`, `audit_log`
- `/server/prisma/migrations/` -- Initial migration
- `/server/prisma/seed.ts` -- Seed script:
  - 3 users (one per role) with bcrypt-hashed passwords
  - 4 example rules from `/shared/data/seed-rules.ts`
  - Published release "2026-POC-v1.0" with snapshots of all 4 rules
  - Activate the release
  - Set `bridge_mitigation_limit` to 3
- `/server/src/db/client.ts` -- Prisma client singleton
- `/server/src/db/repositories/rule.repository.ts` -- CRUD with optimistic locking
- `/server/src/db/repositories/release.repository.ts` -- Create release (snapshot drafts), activate, list, get with rules
- `/server/src/db/repositories/evaluation.repository.ts` -- Save evaluation, save mitigations, list by property
- `/server/src/db/repositories/policy-lock.repository.ts` -- Create/read policy locks
- `/server/src/db/repositories/settings.repository.ts` -- Get/update settings
- `/server/src/db/repositories/audit-log.repository.ts` -- Append-only insert
- `/server/src/db/repositories/user.repository.ts` -- User CRUD, find by email

**Acceptance criteria**:
- `npx prisma migrate dev` runs clean on fresh PostgreSQL
- Seed populates all tables: 3 users, 4 draft rules, 1 published release with 4 snapshots, settings
- Rule update with wrong version returns conflict error
- Release creation atomically snapshots all draft rules
- Activating a release deactivates the previous one (exactly one active)
- Snapshots are deep copies (modifying draft does not affect snapshot)
- Integration tests for each repository (at least 20 tests)

**Dependencies**: Iterations 1-2

**Estimated complexity**: L

---

## Iteration 4: API Layer -- Endpoints, Auth, and Middleware

**Goal**: Build the complete REST API with JWT auth, role-based authorization, request validation, and all 22 endpoints from HLD Section 6.6.

**FRs/NFRs covered**: FR-1.1, FR-4.1, FR-4.2, FR-4.5, FR-4.6, FR-5.1, FR-5.2, FR-5.3, FR-5.5, FR-6.2, FR-6.3, FR-6.4, FR-6.5, FR-6.6, FR-6.7, FR-7.1, FR-7.2, FR-7.3, FR-8.1-8.4, FR-9.1-9.3, FR-10.1-10.3, NFR-3, NFR-5, NFR-6

**Scope**:
- `/server/src/middleware/auth.middleware.ts` -- JWT verification, extract user, attach to request
- `/server/src/middleware/role.middleware.ts` -- `requireRole('admin')`, etc.
- `/server/src/middleware/validate.middleware.ts` -- Generic Zod validation middleware
- `/server/src/middleware/error-handler.middleware.ts` -- Global error handler, standard error format
- `/server/src/routes/auth.routes.ts` -- `POST /auth/login`, `POST /auth/register`
- `/server/src/routes/evaluation.routes.ts` -- `POST /evaluate`, `POST /evaluate/:id/mitigations`, `GET /evaluations`, `GET /evaluations/:id`
- `/server/src/routes/rule.routes.ts` -- `GET /rules`, `POST /rules`, `GET /rules/:id`, `PUT /rules/:id`, `DELETE /rules/:id`, `POST /rules/:id/test`
- `/server/src/routes/release.routes.ts` -- `GET /releases`, `POST /releases`, `GET /releases/:id`, `PUT /releases/:id/activate`, `GET /releases/active/rules`, `GET /releases/:id/rules`
- `/server/src/routes/admin.routes.ts` -- `GET /settings`, `PUT /settings`, `GET /users`, `POST /users`
- `/server/src/services/evaluation.service.ts` -- Full pipeline: resolve release, load rules, call engine, save, policy lock
- `/server/src/services/rule.service.ts` -- Rule CRUD with evaluator validation
- `/server/src/services/release.service.ts` -- Publish (snapshot + validate), activate, list
- `/server/src/services/admin.service.ts` -- Settings, user management
- `/server/src/services/auth.service.ts` -- Login, register
- `/server/src/app.ts` -- Express app setup
- `/server/src/index.ts` -- Server entry point
- `/server/src/__tests__/api/` -- Integration tests (supertest) for all endpoints

**Acceptance criteria**:
- All 22 endpoints implemented with correct status codes
- JWT rejects unauthenticated requests (401)
- Role-based access enforced (underwriter cannot CRUD rules, etc.)
- Evaluation pipeline returns correct vulnerabilities for test observations
- Policy lock created on first evaluation; subsequent evals use locked release
- Release override logged in audit_log
- Bridge limit: 4th bridge when limit=3 returns 422 BRIDGE_LIMIT_EXCEEDED
- Optimistic locking: stale version returns 409
- Rule validation: invalid config returns 400 with field-level errors
- POST /rules/:id/test returns result without saving to evaluations table
- Error responses follow standard format (Section 6.8)
- At least 35 integration tests

**Dependencies**: Iterations 1-3

**Estimated complexity**: XL

---

## Iteration 5: Frontend -- Evaluation Flow (Underwriter)

**Goal**: Build the underwriter-facing screens: evaluation form, results with mitigation selection, and bridge stacking UI.

**FRs/NFRs covered**: FR-1.5, FR-1.2, FR-2.2, FR-3.5, FR-3.9, FR-4.4, FR-4.5, FR-9.2, FR-9.3, NFR-2

**Scope**:
- `/client/src/` -- React + TypeScript + Tailwind + shadcn/ui scaffolding (Vite)
- `/client/src/lib/api.ts` -- API client with JWT token management, typed with shared types
- `/client/src/contexts/auth.context.tsx` -- Auth context (login, logout, current user, role)
- `/client/src/components/layout/` -- AppShell, Sidebar (role-based nav), Header
- `/client/src/pages/login.tsx` -- Login page
- `/client/src/pages/evaluation/form.tsx` -- Observation form (based on `evaluation-form.html` mock): sections for property info, roof, vents, windows, vegetation (dynamic array), home-to-home distance. Validation via shared Zod schemas.
- `/client/src/pages/evaluation/results.tsx` -- Results page (based on `evaluation-results.html` mock): vulnerability cards, auto-decline banner, mitigation selection, bridge stacking visualization
- `/client/src/components/evaluation/vulnerability-card.tsx` -- Individual vulnerability with expandable mitigations
- `/client/src/components/evaluation/bridge-stacker-ui.tsx` -- Visual bridge stacking: base threshold, each modifier, running total, pass/fail
- `/client/src/components/evaluation/bridge-budget.tsx` -- "2 of 3 bridge mitigations used" counter
- `/client/src/components/evaluation/auto-decline-banner.tsx` -- Auto-decline indicator
- `/client/src/hooks/useEvaluation.ts` -- React Query hook for evaluation
- `/client/src/hooks/useMitigations.ts` -- Hook for mitigation selection with bridge count tracking
- Route setup with role-based guards

**Acceptance criteria**:
- Form renders all field types (enum dropdowns, numeric, boolean, vegetation array with add/remove)
- Submission sends correct observation hash and displays results
- Results show vulnerabilities with human-readable descriptions and observed vs required values
- Bridge stacking UI matches Windows rule example (90ft -> 72ft -> 36ft)
- Bridge budget shows count/limit and disables selection at limit
- Auto-decline banner appears with specific rule identified; other vulns still shown
- Mitigations persisted via POST /evaluate/:id/mitigations
- Matches mock styles; responsive on modern browsers

**Dependencies**: Iteration 4

**Estimated complexity**: XL

---

## Iteration 6: Frontend -- Rule Management and Releases (Applied Science)

**Goal**: Build the Applied Science screens: rule list, rule editor (structured form + JSON fallback), rule test sandbox, and release manager.

**FRs/NFRs covered**: FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5, FR-6.1, FR-6.2, FR-6.3, FR-6.6, FR-6.7, FR-7.1, FR-7.2, FR-7.3

**Scope**:
- `/client/src/pages/rules/list.tsx` -- Rule list: table of draft rules, create/delete actions
- `/client/src/pages/rules/editor.tsx` -- Rule editor (based on `rule-editor.html` mock):
  - Form View: type selector, dynamic form per type (Simple, Conditional, Computed), mitigations editor with bridge effect config
  - JSON View: code editor with Zod validation, bidirectional sync with form
  - Version conflict handling (409 -> "Modified by another user" with reload)
- `/client/src/pages/rules/test-sandbox.tsx` -- Test sandbox: select rule, enter observations, submit to test endpoint, display results. "SANDBOX" indicator.
- `/client/src/pages/releases/manager.tsx` -- Release manager (based on `release-manager.html` mock): release list with status badges, publish button, activate button, expandable rule details, immutability indicator
- `/client/src/components/rules/rule-form-simple.tsx` -- Simple threshold form
- `/client/src/components/rules/rule-form-conditional.tsx` -- Conditional form with dynamic condition rows
- `/client/src/components/rules/rule-form-computed.tsx` -- Computed form with dynamic modifier rows
- `/client/src/components/rules/mitigation-editor.tsx` -- Mitigation list with category and effect config
- `/client/src/components/rules/json-editor.tsx` -- JSON editor with syntax highlighting + Zod validation
- `/client/src/hooks/useRules.ts` -- React Query hooks for rule CRUD
- `/client/src/hooks/useReleases.ts` -- React Query hooks for releases

**Acceptance criteria**:
- Rule CRUD works end-to-end through the UI
- Editor form renders correct fields per type; type switch clears and re-renders
- JSON editor syncs with form; invalid JSON shows Zod errors inline
- Bridge mitigations require effect type and value
- Version conflict shows error with reload option
- Test sandbox runs without creating evaluation records
- Release manager: publish creates release, activate changes active, published releases cannot be edited/deleted
- Matches rule-editor.html and release-manager.html mock layouts

**Dependencies**: Iterations 4-5

**Estimated complexity**: XL

---

## Iteration 7: Admin, Rule Reference, Evaluation History, and Audit

**Goal**: Build all remaining screens: admin config, rule reference, evaluation history, and audit logging.

**FRs/NFRs covered**: FR-4.3, FR-8.1, FR-8.2, FR-8.3, FR-8.4, FR-10.1, FR-10.2, FR-10.3, NFR-5

**Scope**:
- `/client/src/pages/admin/settings.tsx` -- Bridge limit config, system settings
- `/client/src/pages/admin/users.tsx` -- User list, create user with role
- `/client/src/pages/rule-reference/index.tsx` -- Rule reference (based on `rule-reference.html` mock): all active release rules, expandable cards with descriptions and mitigations, search/filter, release indicator. Read-only.
- `/client/src/pages/evaluation/history.tsx` -- Past evaluations list: property_id, date, release, auto-decline status. Click to view detail. Filter by property_id.
- `/client/src/pages/evaluation/detail.tsx` -- Full evaluation detail: results, observations, release info, policy lock status
- `/server/src/middleware/audit.middleware.ts` -- Centralized audit logging helper
- Wire audit logging into: release activation, policy lock override, settings changes, user creation
- `/server/src/routes/audit.routes.ts` -- `GET /audit-log` (admin-only)
- `/client/src/pages/admin/audit-log.tsx` -- Audit log viewer (table of recent actions)

**Acceptance criteria**:
- Admin can change bridge limit; takes effect immediately
- Admin can create users with roles
- Rule reference shows active release rules with descriptions and mitigations
- Rule reference search filters by name in real-time
- Evaluation history lists past evaluations; detail view shows full results
- Audit log records: release activations, lock overrides, settings changes, user creation
- Role-based access enforced on all pages

**Dependencies**: Iterations 4-6

**Estimated complexity**: L

---

## Iteration 8: Integration Testing, Error Handling Polish, and E2E Validation

**Goal**: Validate all end-to-end flows, harden error handling, ensure every FR and NFR is demonstrably met.

**FRs/NFRs covered**: All FRs and NFRs -- verification pass. Specifically validates NFR-1 (latency), NFR-4 (4 rules), NFR-7 (reproducibility).

**Scope**:
- `/e2e/` -- E2E test suite (Playwright) covering 5 critical user journeys:
  1. **Underwriter evaluation**: Login, enter observations, submit, view results, select mitigations (full + bridge), verify stacking math, verify bridge budget, verify policy lock
  2. **Auto-decline**: Observations triggering Rule 4 (Home-to-Home < 15ft), verify banner, verify other vulns shown
  3. **Rule management**: Login as applied_science, create rule, edit (test optimistic locking), test in sandbox, publish release, activate, verify in evaluation
  4. **Release versioning**: Evaluate property (creates lock), publish new release, re-evaluate (uses locked release), override to new release (verify audit)
  5. **Admin**: Change bridge limit, create user, verify limit enforced
- Error handling hardening: verify all status codes from Section 6.8 (400, 401, 403, 404, 409, 422, 503)
- Partial rule failure: if one evaluator throws, others still evaluate
- Performance benchmark: evaluate 4 rules < 2 seconds including DB (NFR-1)
- Reproducibility: 10 identical evaluations produce identical JSON (NFR-7)
- `/server/prisma/seed-demo.ts` -- Extended seed for demos: multiple evaluations, varied observations, auto-declines, bridge selections, multiple releases
- `/README.md` -- Setup instructions, architecture overview, how to run, how to add new rule types

**Acceptance criteria**:
- All 5 E2E journeys pass
- Every error scenario from Section 6.8 tested with correct status + format
- Latency < 2 seconds per evaluation including DB
- 10 identical evaluations produce byte-identical results
- Demo seed data populates all screens with realistic data
- README documents setup, running, testing, and extending
- FR/NFR coverage matrix: checklist mapping each requirement to its test(s)

**Dependencies**: Iterations 1-7

**Estimated complexity**: L

---

## FR/NFR Coverage Matrix

| Requirement | Iteration(s) |
|---|---|
| FR-1.1 (observation hash input) | 1, 4 |
| FR-1.2 (field types) | 1, 5 |
| FR-1.3 (globally required vs rule-referenced) | 2 |
| FR-1.4 (error messages / warnings) | 2, 4 |
| FR-1.5 (web form) | 5 |
| FR-2.1 (evaluate against all rules) | 2 |
| FR-2.2 (vulnerability details) | 2, 5 |
| FR-2.3 (independent evaluation) | 2 |
| FR-2.4.1 (simple threshold) | 2 |
| FR-2.4.2 (conditional threshold) | 2 |
| FR-2.4.3 (computed with modifiers) | 2 |
| FR-2.5 (config = passing condition) | 2 |
| FR-2.6 (equal weight) | 2 |
| FR-2.7 (auto-decline) | 2, 4 |
| FR-3.1 (mitigations per vulnerability) | 2 |
| FR-3.2 (full/bridge categories) | 1 |
| FR-3.3 (mitigation details) | 2 |
| FR-3.4 (bridge effect discriminated union) | 1, 2 |
| FR-3.5 (threshold changes with bridges) | 2, 5 |
| FR-3.6 (mitigation combinations) | 2 |
| FR-3.7 (1:1 mitigation-to-vulnerability) | 2 |
| FR-3.8 (multiplicative stacking) | 2 |
| FR-3.9 (cumulative effect display) | 2, 5 |
| FR-4.1 (track bridge mitigations) | 4 |
| FR-4.2 (enforce bridge limit) | 4 |
| FR-4.3 (admin configures limit) | 7 |
| FR-4.4 (display count/allowance) | 5 |
| FR-4.5 (prevent exceeding limit) | 4, 5 |
| FR-4.6 (per-latest-evaluation count) | 4 |
| FR-5.1 (CRUD rules) | 4, 6 |
| FR-5.2 (rule definition fields) | 1, 6 |
| FR-5.3 (validate before saving) | 2, 4 |
| FR-5.4 (structured form + JSON fallback) | 6 |
| FR-5.5 (optimistic locking) | 3, 4, 6 |
| FR-6.1 (release snapshots) | 3, 4 |
| FR-6.2 (publish/activate separation) | 4, 6 |
| FR-6.3 (active release) | 3, 4 |
| FR-6.4 (auto policy lock) | 4 |
| FR-6.5 (release override + audit) | 4, 7 |
| FR-6.6 (release name in results) | 4, 5 |
| FR-6.7 (immutable releases) | 3, 4 |
| FR-7.1 (test sandbox) | 4, 6 |
| FR-7.2 (test results with details) | 6 |
| FR-7.3 (test != production) | 4, 6 |
| FR-8.1-8.4 (rule reference) | 4, 7 |
| FR-9.1-9.3 (auto-decline) | 2, 4, 5 |
| FR-10.1-10.3 (admin config) | 4, 7 |
| NFR-1 (< 2s latency) | 2, 8 |
| NFR-2 (web-based, modern browsers) | 5, 6, 7 |
| NFR-3 (JWT + RBAC) | 4 |
| NFR-4 (4 example rules) | 1, 3 |
| NFR-5 (auditability) | 3, 4, 7 |
| NFR-6 (data integrity) | 3, 4 |
| NFR-7 (reproducibility) | 2, 8 |

---

*End of iteration plan.*
