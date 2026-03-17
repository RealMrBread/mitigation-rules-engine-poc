# FR/NFR Coverage Matrix

Traceability from each functional and non-functional requirement to the iteration where it was implemented and the test file(s) that verify it.

---

## Functional Requirements

| Req | Description | Iteration(s) | Implementation | Test File(s) |
|-----|-------------|:------------:|----------------|--------------|
| FR-1.1 | Observation hash input | 1, 4 | `shared/schemas/observation.schema.ts`, `server/src/routes/evaluation.routes.ts` | `schemas.test.ts`, `evaluation.test.ts` |
| FR-1.2 | Field types (enum, numeric, boolean, array) | 1, 5 | `shared/types/observation.ts`, `client/src/pages/evaluation/form.tsx` | `schemas.test.ts` |
| FR-1.3 | Globally required vs rule-referenced fields | 2 | `server/src/engine/engine.ts` | `engine.test.ts` (tests 6-8) |
| FR-1.4 | Error messages for missing fields / warnings for skipped rules | 2, 4 | `server/src/engine/engine.ts`, `server/src/middleware/error-handler.middleware.ts` | `engine.test.ts` (tests 6-8, 13), `evaluation.test.ts` |
| FR-1.5 | Web form for manual observation entry | 5 | `client/src/pages/evaluation/form.tsx` | Manual (UI) |
| FR-2.1 | Evaluate against all applicable rules | 2 | `server/src/engine/engine.ts` | `engine.test.ts` (test 5) |
| FR-2.2 | Vulnerability details (name, description, values) | 2, 5 | `server/src/engine/engine.ts`, `client/src/components/evaluation/vulnerability-card.tsx` | `engine.test.ts` (test 11) |
| FR-2.3 | Multiple vulnerabilities per observation | 2 | `server/src/engine/engine.ts` | `engine.test.ts` (test 5) |
| FR-2.4 | Independent rule evaluation | 2 | `server/src/engine/engine.ts` | `engine.test.ts` (test 12) |
| FR-2.4.1 | Simple threshold evaluator | 2 | `server/src/engine/evaluators/simple-threshold.evaluator.ts` | `simple-threshold.evaluator.test.ts` |
| FR-2.4.2 | Conditional threshold evaluator | 2 | `server/src/engine/evaluators/conditional-threshold.evaluator.ts` | `conditional-threshold.evaluator.test.ts` |
| FR-2.4.3 | Computed with modifiers evaluator | 2 | `server/src/engine/evaluators/computed-with-modifiers.evaluator.ts` | `computed-with-modifiers.evaluator.test.ts` |
| FR-2.5 | Config = passing condition | 2 | All evaluator implementations | All evaluator test files |
| FR-2.6 | Equal weight (no severity model) | 2 | `server/src/engine/engine.ts` | `engine.test.ts` |
| FR-2.7 | Auto-decline (unmitigatable rule triggered) | 2, 4 | `server/src/engine/engine.ts`, `server/src/services/evaluation.service.ts` | `engine.test.ts` (tests 4, 12), `evaluation.test.ts` |
| FR-3.1 | Mitigations per vulnerability | 2 | `server/src/engine/engine.ts` | `engine.test.ts` (test 11) |
| FR-3.2 | Full/bridge mitigation categories | 1 | `shared/types/rule.ts` | `schemas.test.ts` |
| FR-3.3 | Mitigation details (name, category, description, effect) | 2 | `shared/data/seed-rules.ts` | `engine.test.ts` (test 11) |
| FR-3.4 | Bridge effect discriminated union (multiplier/override) | 1, 2 | `shared/types/rule.ts`, `server/src/engine/bridge-stacker.ts` | `schemas.test.ts`, `bridge-stacker.test.ts` |
| FR-3.5 | Threshold changes with bridges | 2, 5 | `server/src/engine/bridge-stacker.ts`, `client/src/components/evaluation/bridge-stacker-ui.tsx` | `bridge-stacker.test.ts` |
| FR-3.6 | 1:1 mitigation-to-vulnerability mapping | 2 | `server/src/engine/engine.ts` | `engine.test.ts` |
| FR-3.7 | Multiple bridge mitigations on same vulnerability | 2 | `server/src/engine/bridge-stacker.ts` | `bridge-stacker.test.ts` |
| FR-3.8 | Multiplicative stacking | 2 | `server/src/engine/bridge-stacker.ts` | `bridge-stacker.test.ts` |
| FR-3.9 | Cumulative effect display | 2, 5 | `server/src/engine/bridge-stacker.ts`, `client/src/components/evaluation/bridge-stacker-ui.tsx` | `bridge-stacker.test.ts` |
| FR-4.1 | Track bridge mitigations per property | 4 | `server/src/services/evaluation.service.ts`, `server/src/db/repositories/evaluation.repository.ts` | `evaluation.test.ts` |
| FR-4.2 | Enforce bridge mitigation limit | 4 | `server/src/services/evaluation.service.ts` | `evaluation.test.ts` |
| FR-4.3 | Admin configures bridge limit | 7 | `client/src/pages/admin/settings.tsx`, `server/src/routes/admin.routes.ts` | `admin.test.ts` |
| FR-4.4 | Display bridge count/allowance | 5 | `client/src/components/evaluation/bridge-budget.tsx` | Manual (UI) |
| FR-4.5 | Prevent exceeding bridge limit | 4, 5 | `server/src/services/evaluation.service.ts`, `client/src/components/evaluation/bridge-budget.tsx` | `evaluation.test.ts` |
| FR-4.6 | Per-latest-evaluation bridge count | 4 | `server/src/services/evaluation.service.ts` | `evaluation.test.ts` |
| FR-5.1 | CRUD rules | 4, 6 | `server/src/routes/rule.routes.ts`, `client/src/pages/rules/` | `rules.test.ts` |
| FR-5.2 | Rule definition fields | 1, 6 | `shared/types/rule.ts`, `client/src/pages/rules/editor.tsx` | `schemas.test.ts`, `rules.test.ts` |
| FR-5.3 | Validate rules before saving | 2, 4 | Evaluator `validate()`, `server/src/services/rule.service.ts` | `rules.test.ts` |
| FR-5.4 | Structured form + JSON fallback | 6 | `client/src/pages/rules/editor.tsx`, `client/src/components/rules/json-editor.tsx` | Manual (UI) |
| FR-5.5 | Optimistic locking (version column) | 3, 4, 6 | `server/src/db/repositories/rule.repository.ts`, `server/src/routes/rule.routes.ts` | `repositories.test.ts`, `rules.test.ts` |
| FR-6.1 | Release snapshots (immutable) | 3, 4 | `server/src/db/repositories/release.repository.ts` | `repositories.test.ts`, `rules.test.ts` |
| FR-6.2 | Publish/activate separation | 4, 6 | `server/src/routes/release.routes.ts`, `client/src/pages/releases/manager.tsx` | `rules.test.ts` |
| FR-6.3 | Active release (exactly one) | 3, 4 | `server/src/db/repositories/release.repository.ts` | `repositories.test.ts` |
| FR-6.4 | Auto policy lock on first eval | 4 | `server/src/services/evaluation.service.ts` | `evaluation.test.ts` |
| FR-6.5 | Release override + audit trail | 4, 7 | `server/src/services/evaluation.service.ts`, `server/src/middleware/audit.middleware.ts` | `evaluation.test.ts`, `admin.test.ts` |
| FR-6.6 | Release name in evaluation results | 4, 5 | `server/src/services/evaluation.service.ts`, `client/src/pages/evaluation/results.tsx` | `evaluation.test.ts` |
| FR-6.7 | Immutable published releases | 3, 4 | Prisma schema (no update route), `server/src/routes/release.routes.ts` | `rules.test.ts` |
| FR-7.1 | Test sandbox | 4, 6 | `server/src/routes/rule.routes.ts` (POST /rules/:id/test), `client/src/pages/rules/test-sandbox.tsx` | `rules.test.ts` |
| FR-7.2 | Test results with computation details | 6 | `client/src/pages/rules/test-sandbox.tsx` | `rules.test.ts` |
| FR-7.3 | Test != production (no DB save) | 4, 6 | `server/src/routes/rule.routes.ts` | `rules.test.ts` |
| FR-8.1 | Rule reference view | 4, 7 | `server/src/routes/release.routes.ts` (GET /releases/active/rules), `client/src/pages/rule-reference/` | `rules.test.ts` |
| FR-8.2 | Display rule descriptions and mitigations | 7 | `client/src/pages/rule-reference/index.tsx` | Manual (UI) |
| FR-8.3 | Search/filter rules | 7 | `client/src/pages/rule-reference/index.tsx` | Manual (UI) |
| FR-8.4 | Show release indicator | 7 | `client/src/pages/rule-reference/index.tsx` | Manual (UI) |
| FR-9.1 | Auto-decline identification | 2, 4 | `server/src/engine/engine.ts` | `engine.test.ts` (test 4) |
| FR-9.2 | Auto-decline banner in results | 5 | `client/src/components/evaluation/auto-decline-banner.tsx` | Manual (UI) |
| FR-9.3 | Other vulnerabilities still shown on auto-decline | 2, 5 | `server/src/engine/engine.ts` | `engine.test.ts` (test 12) |
| FR-10.1 | Admin settings interface | 4, 7 | `server/src/routes/admin.routes.ts`, `client/src/pages/admin/settings.tsx` | `admin.test.ts` |
| FR-10.2 | User management | 4, 7 | `server/src/routes/admin.routes.ts`, `client/src/pages/admin/users.tsx` | `admin.test.ts` |
| FR-10.3 | Audit log viewer | 7 | `server/src/routes/audit.routes.ts`, `client/src/pages/admin/audit-log.tsx` | `admin.test.ts` |

---

## Non-Functional Requirements

| Req | Description | Iteration(s) | Implementation | Test/Verification |
|-----|-------------|:------------:|----------------|-------------------|
| NFR-1 | Evaluation latency < 2s | 2, 8 | Pure-function engine, indexed DB queries | `engine.test.ts` (test 15: < 10ms for 4 rules), `evaluation.test.ts` |
| NFR-2 | Web-based, modern browsers | 5, 6, 7 | React + Vite + Tailwind, responsive design | Manual (browser testing) |
| NFR-3 | JWT + RBAC (3 roles) | 4 | `server/src/middleware/auth.middleware.ts`, `server/src/middleware/role.middleware.ts` | `auth.test.ts`, `admin.test.ts`, `rules.test.ts` |
| NFR-4 | 4 example rules (scalable architecture) | 1, 3 | `shared/data/seed-rules.ts`, Registry pattern | `engine.test.ts`, `schemas.test.ts` |
| NFR-5 | Auditability (full I/O stored, overrides logged) | 3, 4, 7 | `evaluations` table stores observations + result, `audit_log` table | `evaluation.test.ts`, `admin.test.ts`, `repositories.test.ts` |
| NFR-6 | Data integrity (immutable releases, optimistic locking) | 3, 4 | Prisma schema, version column, release immutability | `repositories.test.ts`, `rules.test.ts` |
| NFR-7 | Reproducibility (same input = same output) | 2, 8 | Pure-function engine, deterministic evaluation | `engine.test.ts` (test 9: deterministic results) |

---

## Test File Quick Reference

All test files are located under these paths:

```
shared/__tests__/
  schemas.test.ts               # 24 tests -- Zod schema validation
  smoke.test.ts                 # Shared module smoke tests

server/src/engine/__tests__/
  simple-threshold.evaluator.test.ts    # Simple threshold operator tests
  conditional-threshold.evaluator.test.ts  # Conditional branch tests
  computed-with-modifiers.evaluator.test.ts  # Computed evaluator tests
  bridge-stacker.test.ts        # Bridge stacking math tests
  engine.test.ts                # Full engine integration (17 tests)
  registry.test.ts              # Evaluator registry tests

server/src/db/__tests__/
  repositories.test.ts          # Repository CRUD + locking tests

server/src/__tests__/api/
  auth.test.ts                  # Auth endpoints (login, register, JWT)
  evaluation.test.ts            # Evaluation flow (POST, mitigations, locks)
  rules.test.ts                 # Rule CRUD + test sandbox + releases
  admin.test.ts                 # Settings, users, audit log
  smoke.test.ts                 # Health check, error format
```
