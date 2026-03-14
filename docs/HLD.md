# Mitigation Rules Engine — High-Level Design

**Version**: 1.0
**Date**: 2026-03-14
**Status**: Approved for POC

---

## 1. Problem Statement

### Context

A wildfire-focused property insurance company underwrites properties in select US states. Today, the process of evaluating a property's vulnerabilities and determining what mitigations are needed to make it insurable is **manual, inconsistent, and opaque**. Underwriters rely on institutional knowledge to map property characteristics to underwriting rules, identify gaps, and communicate requirements to policyholders. Applied Science teams who define these rules have no systematic way to encode, version, test, or deploy them.

### Problem

There is no system that:
- Translates structured property observations into a deterministic list of vulnerabilities based on codified underwriting rules
- Distinguishes between vulnerabilities that can be fully mitigated, partially mitigated (bridge), or not mitigated at all (auto-decline)
- Tracks bridge mitigations and enforces configurable limits, since bridge mitigations represent accepted residual risk
- Allows Applied Science to manage rules independently of engineering — creating, testing, and deploying rule changes without code releases
- Guarantees policyholders are evaluated against a stable, versioned rule set so rules don't become a "moving target"
- Provides underwriters with human-readable explanations they can share with policyholders

### Desired Outcome

A web-based Mitigation Rules Engine that accepts property observations, evaluates them against versioned underwriting rules, identifies all vulnerabilities, and suggests categorized mitigations — enabling underwriters to make consistent, explainable, and auditable decisions.

---

## 2. Design Tenets

Listed in priority order. When tenets conflict, higher-ranked tenets win.

1. **Correctness over speed** — The engine must produce deterministic, reproducible results. A property evaluated against the same rules and observations must always yield the same vulnerabilities and mitigations. We will not trade evaluation accuracy for performance.

2. **Transparency over simplicity** — Every vulnerability must explain *why* it was triggered (observed values vs. required values, computation steps). Underwriters must be able to explain any result to a policyholder. We accept added complexity in the output format to achieve this.

3. **Rules are data, not code** — Underwriting rules must be configurable by Applied Science users without engineering involvement. Rule changes flow through a publish/activate lifecycle, not through code deploys. We accept the added complexity of a rule schema and validation layer to achieve this.

4. **Immutability for trust** — Published rule releases are immutable. Evaluations are reproducible against any historical release. Policy locks guarantee stability. We accept storage overhead (full rule snapshots per release) to guarantee auditability.

5. **POC-scoped pragmatism** — We build the minimum needed to validate the concept. We defer features (severity models, bridge lifecycle, state-specific rules, batch evaluation) rather than build them partially. Every deferred feature is documented with a clear path to add it post-POC.

6. **Extensibility without over-engineering** — The rule engine uses a Registry + Strategy pattern so new rule types can be added by implementing an interface, not by modifying core logic. But we do not build plugin systems, DSLs, or abstractions beyond what the 3 current rule types require.

---

## 3. Functional Requirements

### 3.1 Users

| User | Description |
|---|---|
| **Underwriter** | Submits property observations, reviews vulnerabilities and mitigations, selects mitigations, browses rule reference |
| **Applied Science** | Creates/edits/deletes rules, tests rules against sample data, publishes and activates rule releases |
| **Admin** | Configures system settings (bridge mitigation limits), manages user accounts |

### 3.2 Core Capabilities

| # | Capability | Description |
|---|---|---|
| C1 | Property Observation Processing | Accept a structured observation hash via web form. Validate globally required fields (error on missing) and rule-referenced fields (skip rule with warning on missing). |
| C2 | Vulnerability Identification | Evaluate observations against all rules in the active (or specified) release. Return triggered vulnerabilities with human-readable explanations and observed vs. required values. |
| C3 | Mitigation Suggestion | For each vulnerability, return applicable mitigations categorized as Full or Bridge. For computed rules, show threshold math before and after bridge application. |
| C4 | Bridge Mitigation Tracking | Track bridge mitigations per property (per latest evaluation). Enforce admin-configurable limit. Display count and remaining allowance proactively. Hard block at limit. |
| C5 | Rule Management | CRUD on rules in a shared draft workspace. Structured form + JSON editor. Optimistic locking prevents silent overwrites. |
| C6 | Rule Versioning | Release-based: immutable named snapshots. Auto policy lock on first evaluation. Underwriter override with audit trail. |
| C7 | Rule Testing | Test draft rules against sample observations without affecting production. Show intermediate computation steps. |
| C8 | Rule Reference | Read-only view for underwriters to browse all active rules with descriptions and mitigations. Searchable. |
| C9 | Auto-Decline | If any triggered vulnerability has no mitigations (unmitigatable), the property is automatically declined. Result clearly indicates which rule caused the decline. |

### 3.3 Rule Evaluation Types

The engine supports 3 evaluation types. Any type may be mitigatable or unmitigatable (empty mitigation list → auto-decline).

**Simple Threshold**: Single field compared against a required value.
> Attic Vent Screens must be "Ember Resistant". Home-to-Home Distance must be >= 15ft.

**Conditional Threshold**: Pass/fail criteria shift based on another field's value.
> Roof must be Class A, UNLESS Wildfire Risk Category = A, then Class B is acceptable.

**Computed with Modifiers**: Base threshold modified by multipliers/divisors from observation fields. Array items evaluated independently. Bridge mitigations apply as additional multipliers (stackable, multiplicative).
> Window safe distance: base 30ft × window modifier × vegetation modifier. Bridge Film (×0.8) and Prune (×0.5) stack to ×0.4.

**Rule config defines the passing condition.** The evaluator reports a vulnerability when the condition is NOT met.

### 3.4 Bridge Mitigation Effects

Bridge mitigations use a discriminated union for their effect type:
- **`multiplier`** — For computed rules: multiplies the threshold (e.g., 0.8 = 20% reduction). Stackable multiplicatively.
- **`override`** — For simple/conditional rules: changes the required value to a less strict one that the property can meet.

### 3.5 Observation Field Validation

Two categories:
- **Globally required fields** (e.g., state, property_id): Missing → validation error, evaluation does not proceed.
- **Rule-referenced fields** (e.g., attic_vent_screens): Missing → rule is skipped with a warning in the result. Evaluation continues for other rules.

---

## 4. Non-Functional Requirements

| # | Requirement | Target |
|---|---|---|
| NFR-1 | Evaluation latency | < 2 seconds for a single property |
| NFR-2 | Platform | Web-based, modern browsers (Chrome, Firefox, Safari, Edge) |
| NFR-3 | Authentication | JWT-based with role-based authorization (3 roles) |
| NFR-4 | POC rule count | 4 example rules (extensible to 100s) |
| NFR-5 | Auditability | Every evaluation stores full input (observations) and output (result). Release overrides logged. |
| NFR-6 | Data integrity | Published releases are immutable. Optimistic locking on draft edits. Atomic bridge limit enforcement. |
| NFR-7 | Reproducibility | Given the same release + observations, the engine produces identical results every time. |

---

## 5. High-Level Design Architecture

### 5.1 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + TypeScript + Tailwind + shadcn/ui | Component-based, strong typing, shared types with backend |
| Backend | Node.js + Express + TypeScript | Same language end-to-end, strong JSON handling |
| Database | PostgreSQL | Relational integrity for versioning/releases, JSONB for flexible rule configs |
| ORM | Prisma | Type-safe DB access, migrations |
| Auth | JWT + bcrypt | Simple role-based, 3 roles |

### 5.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                           │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌───────┐ ┌────────┐  │
│  │ Evaluation  │ │   Rule     │ │  Rule    │ │ Admin │ │  Auth  │  │
│  │   Flow     │ │  Manager   │ │Reference │ │Config │ │        │  │
│  └─────┬──────┘ └─────┬──────┘ └────┬─────┘ └──┬────┘ └───┬────┘  │
└────────┼──────────────┼─────────────┼──────────┼──────────┼────────┘
         │              │             │          │          │
         ▼              ▼             ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Layer (Express)                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Middleware: Auth (JWT) → Role Check → Request Validation    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐  │
│  │  Evaluation   │ │    Rule      │ │  Release   │ │   Admin    │  │
│  │   Service    │ │   Service    │ │  Service   │ │  Service   │  │
│  └──────┬───────┘ └──────┬───────┘ └─────┬──────┘ └─────┬──────┘  │
│         │                │               │               │         │
│         ▼                │               │               │         │
│  ┌──────────────────┐    │               │               │         │
│  │   Rules Engine   │    │               │               │         │
│  │                  │    │               │               │         │
│  │  ┌────────────┐  │    │               │               │         │
│  │  │ Evaluator  │  │    │               │               │         │
│  │  │ Registry   │  │    │               │               │         │
│  │  │ ┌────────┐ │  │    │               │               │         │
│  │  │ │Simple  │ │  │    │               │               │         │
│  │  │ ├────────┤ │  │    │               │               │         │
│  │  │ │Condit. │ │  │    │               │               │         │
│  │  │ ├────────┤ │  │    │               │               │         │
│  │  │ │Computed│ │  │    │               │               │         │
│  │  │ └────────┘ │  │    │               │               │         │
│  │  └────────────┘  │    │               │               │         │
│  │  ┌────────────┐  │    │               │               │         │
│  │  │  Bridge    │  │    │               │               │         │
│  │  │  Stacker   │  │    │               │               │         │
│  │  └────────────┘  │    │               │               │         │
│  └──────────────────┘    │               │               │         │
└──────────┬───────────────┼───────────────┼───────────────┼─────────┘
           │               │               │               │
           ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Data Layer (Prisma + PostgreSQL)               │
│                                                                     │
│  ┌────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ users  │ │  rules   │ │  releases    │ │ release_rules│        │
│  │        │ │ (drafts) │ │              │ │ (snapshots)  │        │
│  └────────┘ └──────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────────────┐ ┌────────────┐         │
│  │ policy_locks │ │    evaluations       │ │  settings  │         │
│  └──────────────┘ └──────────┬───────────┘ └────────────┘         │
│                    ┌─────────┴──────────┐  ┌────────────┐         │
│                    │eval_mitigations    │  │ audit_log  │         │
│                    └────────────────────┘  └────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Rules Engine Design

The engine is a **pure function** with no database dependencies:

```
evaluate(observations, rules[]) → EvaluationResult
```

**Evaluator Registry + Strategy Pattern**: Each rule type has a dedicated evaluator implementing a common interface. The registry dispatches by `rule.type`. Adding a new rule type requires only implementing the interface and registering it — no core engine changes.

```
EvaluatorRegistry
  ├── register(type, evaluator)    // At startup
  ├── get(type) → Evaluator        // At evaluation time
  └── evaluate(rule, obs) → Result

Evaluator (interface)
  ├── evaluate(config, observations) → EvalResult
  └── validate(config) → ValidationResult    // At authoring/publish time
```

**Bridge Stacker**: Isolated component for computing stacked bridge effects on computed rules.

```
Algorithm (Computed rules):
1. Compute observation_modifier_product from rule modifiers + observation values
2. base_threshold = baseValue × observation_modifier_product
3. bridge_modifier_product = product of all selected bridge multipliers
4. final_threshold = base_threshold × bridge_modifier_product
5. Compare actual_value against final_threshold
6. Return breakdown with running thresholds per bridge for UI display

For array fields: steps 1-5 execute per item. Rule triggers if ANY item fails.
```

### 5.4 Data Model

```
users
  id, email, password_hash, role (underwriter|applied_science|admin)

rules (draft workspace — shared, optimistic locking)
  id, name, description, type, config (JSONB), mitigations (JSONB),
  created_by, created_at, updated_at, version (integer)

releases
  id, name (e.g., "2026-Q2-v3.1"), published_at, published_by, is_active

release_rules (immutable snapshots)
  id, release_id → releases.id, rule_id (original draft ID),
  rule_snapshot (JSONB)

policy_locks (one per property)
  id, property_id (VARCHAR, unique), release_id → releases.id,
  locked_at, locked_by → users.id

evaluations
  id, property_id, release_id, observations (JSONB), result (JSONB),
  is_auto_declined, created_by, created_at

evaluation_mitigations
  evaluation_id → evaluations.id,
  rule_id, mitigation_id, category (full|bridge)

settings
  key, value (JSONB)

audit_log
  id, action, entity_type, entity_id, user_id → users.id,
  details (JSONB), created_at
```

**Key design choices:**
- **Rules as JSONB**: Flexible schema per rule type in a single table. Postgres JSONB allows querying into the JSON when needed.
- **Full snapshot per release**: `release_rules.rule_snapshot` is a deep copy. Guarantees immutability even if drafts are later modified.
- **Evaluations store input + output**: Full audit trail. Given release + observations, the result is reproducible.
- **Policy locks as a dedicated table**: Clean lookup for "which release should this property use?" vs. fragile query over evaluation history.

### 5.5 Key Flows

**Evaluation Flow:**
1. Underwriter submits observations (+ optional release_id)
2. System resolves release (null → check policy lock → fall back to active release)
3. Load rule snapshots for the resolved release
4. Engine evaluates all rules independently, skipping rules with missing fields
5. Check for auto-decline (any unmitigatable vulnerability)
6. Save evaluation record (observations + result)
7. Create policy lock if this is the property's first evaluation
8. Return vulnerabilities, mitigations, computation details, and summary

**Rule Lifecycle:**
1. Applied Science creates/edits rules in draft workspace
2. Tests rules against sample observations (no production impact)
3. Publishes a release (validates all rules, snapshots in a transaction)
4. Activates the release (separate step — allows review before going live)
5. New evaluations now use the activated release; existing policy locks unaffected

**Mitigation Selection:**
1. Underwriter views evaluation results
2. Selects mitigations (full and/or bridge) per vulnerability
3. System validates: selections match evaluation results, bridge count within limit (atomic check with FOR UPDATE)
4. For computed rules with bridges: re-computes threshold with stacked modifiers
5. Saves selections; returns updated bridge count

### 5.6 API Summary

| Group | Endpoints | Role |
|---|---|---|
| Auth | `POST /auth/login`, `POST /auth/register` | All / Admin |
| Evaluation | `POST /evaluate`, `POST /evaluate/:id/mitigations`, `GET /evaluations`, `GET /evaluations/:id` | Underwriter |
| Rule Reference | `GET /releases/active/rules`, `GET /releases/:id/rules` | Underwriter |
| Rules | `GET/POST /rules`, `GET/PUT/DELETE /rules/:id`, `POST /rules/:id/test` | Applied Science |
| Releases | `GET/POST /releases`, `GET /releases/:id`, `PUT /releases/:id/activate` | Applied Science |
| Admin | `GET/PUT /settings`, `GET/POST /users` | Admin |

### 5.7 Frontend Screens

| Screen | User | Purpose |
|---|---|---|
| Evaluation Form | Underwriter | Enter property observations via sectioned form |
| Evaluation Results | Underwriter | View vulnerabilities, select mitigations, see computation math |
| Evaluation History | Underwriter | Browse past evaluations |
| Rule Reference | Underwriter | Browse active rules with descriptions and mitigations (read-only) |
| Rule List | Applied Science | View/manage draft rules |
| Rule Editor | Applied Science | Create/edit via structured form + JSON editor |
| Rule Test Sandbox | Applied Science | Test rules against sample observations |
| Release Manager | Applied Science | Publish releases, activate, review snapshots |
| Admin Settings | Admin | Configure bridge limits, manage users |

---

## 6. Assumptions

| # | Assumption | Impact if Wrong |
|---|---|---|
| A-1 | `property_id` is an opaque, user-provided identifier. The system trusts it as canonical. Two evaluations with the same `property_id` refer to the same physical property. | Policy locks and bridge counts may be inconsistent if the same property gets different IDs. Post-POC: consider a property registry. |
| A-2 | Rules are uniform across all states. State determines only whether a property is eligible for insurance, not which rules apply. | If state-specific rule variants are needed, the rule schema and engine need extension. Designed for easy addition post-POC. |
| A-3 | The 3 rule evaluation types (Simple, Conditional, Computed) are sufficient for the POC scope. | If rules require multi-field boolean logic (3+ fields), cross-array aggregation, or field-to-field comparison, new types are needed. These can be added via the Registry pattern without core changes. |
| A-4 | A single shared draft workspace is acceptable. Multiple Applied Science users editing concurrently is handled by optimistic locking (version conflict → 409 error). | If concurrent editing becomes frequent, may need a more sophisticated merge/conflict resolution model. |
| A-5 | Bridge mitigations are counted per latest evaluation only. Re-evaluation resets the mitigation selections and bridge count for that property. | If cumulative tracking across evaluations is needed, the data model supports it but the counting logic must change. |
| A-6 | The POC will operate with 4 example rules and scale to ~100 rules post-POC. The engine does not need to support 1000s of rules. | At 500+ rules, consider caching, parallel evaluation, or rule pre-filtering. Current architecture handles 100 rules within the 2s latency target. |
| A-7 | No external data integrations (GIS, mapping, third-party property databases). All observation values are entered manually via the web form. | If automated data ingestion is needed, add API-based input alongside the web form. The engine itself is input-method agnostic. |

---

## 7. Trade-offs

### T-1: Full Snapshot vs. Delta-Based Versioning

**Chosen: Full snapshot per release.**

| Factor | Full Snapshot | Delta-Based |
|---|---|---|
| Immutability | Guaranteed — each release is self-contained | Requires reconstructing from base + deltas |
| Storage | Higher — duplicates unchanged rules per release | Lower — stores only changes |
| Complexity | Simple — read one row, get the full rule | Complex — reconstruct chain of deltas |
| Query performance | Fast — single join to get all rules for a release | Slower — must resolve delta chain |
| Auditability | Each release is a complete, citable artifact | Harder to audit; must reconstruct state |

**Rationale**: For a POC with ~20 rules and ~2KB per rule, storage is trivial (~200KB per release). The simplicity and auditability of full snapshots outweigh the storage cost. Delta-based storage is only justified at 500+ rules with frequent releases.

### T-2: Structured Form vs. DSL for Rule Authoring

**Chosen: Structured form + JSON editor fallback.**

| Factor | Structured Form | DSL |
|---|---|---|
| Learning curve | Low — point and click | High — must learn syntax |
| Expressiveness | Limited to supported patterns | Unlimited |
| Validation | Built into the form controls | Requires a parser and error reporting |
| POC timeline | Faster to build | Significant additional effort |

**Rationale**: The 3 rule types are well-defined and finite. A structured form covers them without forcing Applied Science to learn a syntax. JSON editor fallback handles edge cases. A DSL can be added post-POC if the rule types expand beyond what forms can support.

### T-3: Monolith vs. Microservices

**Chosen: Monolith with clean internal separation.**

| Factor | Monolith | Microservices |
|---|---|---|
| Deployment | Single deploy | Multiple deploys, orchestration needed |
| Latency | In-process calls | Network hops between services |
| Complexity | Lower | Higher (service discovery, API contracts) |
| Scalability | Scale the whole app | Scale individual services |

**Rationale**: The POC has a single team, a single database, and low traffic. Microservices add coordination overhead with no benefit. The internal architecture (services, engine, data layer) is cleanly separated and can be extracted into services later if needed.

### T-4: Per-Latest-Evaluation Bridge Count vs. Cumulative

**Chosen: Per-latest-evaluation.**

| Factor | Per-Latest | Cumulative |
|---|---|---|
| Simplicity | Simple — count within one evaluation | Complex — track across evaluations, handle deletions |
| Re-evaluation behavior | Clean reset — fresh start | Must reconcile old and new selections |
| Business accuracy | Less accurate for long-lived policies | More accurate reflection of total bridges applied |
| POC scope | Sufficient | Over-engineered for POC |

**Rationale**: Cumulative tracking requires handling edge cases (what if a vulnerability disappears in a re-evaluation? do its bridges "un-count"?). Per-latest is simple and sufficient for validating the concept. The data model supports cumulative if needed post-POC.

### T-5: Rules Engine as Pure Function vs. DB-Integrated

**Chosen: Pure function.**

| Factor | Pure Function | DB-Integrated |
|---|---|---|
| Testability | Unit tests with no DB setup | Requires DB fixtures |
| Performance | In-memory, sub-millisecond per rule | DB queries per rule evaluation |
| Portability | Can run anywhere (server, CLI, browser) | Tied to the database |
| Complexity | Rules loaded once, evaluated in memory | Rules fetched per evaluation |

**Rationale**: The engine is the highest-risk component. Making it a pure function means it can be exhaustively unit-tested in isolation. Rules are loaded once per request from the database, then handed to the engine as plain data. This clean boundary also means the engine could theoretically run client-side for instant previews.

---

## 8. Appendix

### A. Example Rule Definitions (POC Seed Data)

**Rule 1 — Attic Vent (Simple Threshold, mitigatable)**
```json
{
  "name": "Attic Vent",
  "description": "Ensure all vents, chimneys, and screens can withstand embers",
  "type": "simple_threshold",
  "config": {
    "field": "attic_vent_screens",
    "operator": "eq",
    "value": "Ember Resistant"
  },
  "mitigations": [
    { "name": "Install Ember-Rated Vents", "category": "full",
      "description": "Replace all vents with ember-rated vents" }
  ]
}
```

**Rule 2 — Roof (Conditional Threshold, mitigatable)**
```json
{
  "name": "Roof",
  "description": "Ensure the roof is Class A. In low wildfire areas (Category A), Class B is acceptable.",
  "type": "conditional_threshold",
  "config": {
    "conditions": [
      {
        "when": { "field": "wildfire_risk_category", "operator": "eq", "value": "A" },
        "then": { "field": "roof_type", "operator": "in", "value": ["Class A", "Class B"] }
      }
    ],
    "default": { "field": "roof_type", "operator": "eq", "value": "Class A" }
  },
  "mitigations": [
    { "name": "Replace Roof", "category": "full",
      "description": "Upgrade to Class A roof" }
  ]
}
```

**Rule 3 — Windows (Computed with Modifiers, full + bridge mitigations)**
```json
{
  "name": "Window Safety Distance",
  "description": "Ensure windows can withstand heat exposure from surrounding vegetation",
  "type": "computed_with_modifiers",
  "config": {
    "baseValue": 30,
    "unit": "feet",
    "modifiers": [
      { "field": "window_type", "operation": "multiply",
        "mapping": { "Single Pane": 3, "Double Pane": 2, "Tempered Glass": 1 } },
      { "field": "vegetation[].type", "operation": "divide",
        "mapping": { "Tree": 1, "Shrub": 2, "Grass": 3 } }
    ],
    "comparisonField": "vegetation[].distance_to_window",
    "comparisonOperator": "gte",
    "arrayField": "vegetation"
  },
  "mitigations": [
    { "name": "Remove Vegetation", "category": "full",
      "description": "Remove all vegetation within the required safe distance" },
    { "name": "Replace with Tempered Glass", "category": "full",
      "description": "Replace windows with tempered glass" },
    { "name": "Apply Film", "category": "bridge",
      "description": "Apply protective film to windows",
      "effect": { "type": "multiplier", "value": 0.8 } },
    { "name": "Apply Flame Retardant to Shrubs", "category": "bridge",
      "description": "Apply flame retardants to shrubs near windows",
      "effect": { "type": "multiplier", "value": 0.75 } },
    { "name": "Prune Trees", "category": "bridge",
      "description": "Prune trees to a safe height",
      "effect": { "type": "multiplier", "value": 0.5 } }
  ]
}
```

**Rule 4 — Home-to-Home Distance (Simple Threshold, unmitigatable)**
```json
{
  "name": "Home-to-Home Distance",
  "description": "Neighboring homes must be at least 15ft away",
  "type": "simple_threshold",
  "config": {
    "field": "home_to_home_distance",
    "operator": "gte",
    "value": 15
  },
  "mitigations": []
}
```

### B. Known Limitations (POC)

| # | Limitation | Path to Resolution |
|---|---|---|
| L-1 | No severity model — all vulnerabilities are equal weight | Add High/Medium/Low enum to rule definition and sort results by severity |
| L-2 | No state-specific rule variants — rules are uniform | Add state field to rules; filter applicable rules by property state at evaluation time |
| L-3 | No multi-field boolean logic (3+ fields in one rule) | Add a `composite` rule type or lightweight expression language |
| L-4 | No cross-array aggregation (e.g., "more than 3 trees within 50ft") | Add an `aggregation` rule type with count/sum/min/max operations |
| L-5 | No field-to-field comparison (e.g., "distance >= 2x height") | Add dynamic field references to computed rules |
| L-6 | No bridge mitigation floor (stacking can reduce threshold to near-zero) | Add configurable minimum threshold percentage per rule |
| L-7 | No automated test cases for rules | Add saved observation + expected result pairs per rule |
| L-8 | No release diff (compare draft vs. last published) | Add diff API endpoint and UI comparison view |
| L-9 | Bridge count per-latest-evaluation only, not cumulative | Change counting logic to aggregate across evaluations per property |
| L-10 | No batch/bulk evaluation | Add batch endpoint accepting array of observations |

### C. Implementation Order

| Phase | Scope | Dependencies |
|---|---|---|
| **1. Engine Core** | Rule types + Zod schemas, Evaluator Registry + 3 evaluators, Bridge Stacker, unit tests with 4 example rules | None |
| **2. Data Layer + API** | Prisma schema + migrations, seed script, evaluation API, rule CRUD API, release publish/activate API, auth | Phase 1 |
| **3. Frontend** | Auth, evaluation form + results, mitigation selection, rule editor + test sandbox, release manager | Phase 2 |
| **4. Polish** | Rule reference view, admin settings, evaluation history, error handling, edge cases | Phase 3 |
