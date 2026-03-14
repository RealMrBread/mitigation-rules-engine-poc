# Mitigation Rules Engine -- High-Level Design

**Version**: 1.0
**Date**: 2026-03-14
**Status**: Approved for POC

> This is the authoritative design document for the Mitigation Rules Engine POC. It consolidates and supersedes all prior design documents (functional-requirements.md, architecture.md, high-level-design.md, HLD.md, architecture-diagram.md).

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Design Tenets](#2-design-tenets)
3. [Personas](#3-personas)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [High-Level Design](#6-high-level-design)
7. [Assumptions](#7-assumptions)
8. [Trade-offs](#8-trade-offs)
9. [Appendix A: Example Rule Definitions](#appendix-a-example-rule-definitions)
10. [Appendix B: Known Limitations](#appendix-b-known-limitations)
11. [Appendix C: Implementation Order](#appendix-c-implementation-order)

---

## 1. Problem Statement

### Context

A wildfire-focused property insurance company underwrites properties in select US states. Today, the process of evaluating a property's vulnerabilities and determining what mitigations are needed to make it insurable is **manual, inconsistent, and opaque**. Underwriters rely on institutional knowledge to map property characteristics to underwriting rules, identify gaps, and communicate requirements to policyholders. Applied Science teams who define these rules have no systematic way to encode, version, test, or deploy them.

### Problem

There is no system that:

- Translates structured property observations into a deterministic list of vulnerabilities based on codified underwriting rules
- Distinguishes between vulnerabilities that can be fully mitigated, partially mitigated (bridge), or not mitigated at all (auto-decline)
- Tracks bridge mitigations and enforces configurable limits, since bridge mitigations represent accepted residual risk
- Allows Applied Science to manage rules independently of engineering -- creating, testing, and deploying rule changes without code releases
- Guarantees policyholders are evaluated against a stable, versioned rule set so rules do not become a moving target
- Provides underwriters with human-readable explanations they can share with policyholders

### Desired Outcome

A web-based Mitigation Rules Engine that accepts property observations, evaluates them against versioned underwriting rules, identifies all vulnerabilities, and suggests categorized mitigations -- enabling underwriters to make consistent, explainable, and auditable decisions.

---

## 2. Design Tenets

Listed in priority order. When tenets conflict, higher-ranked tenets win.

| Priority | Tenet | Description |
|----------|-------|-------------|
| 1 | **Correctness over speed** | The engine must produce deterministic, reproducible results. A property evaluated against the same rules and observations must always yield the same vulnerabilities and mitigations. We do not trade evaluation accuracy for performance. |
| 2 | **Transparency over simplicity** | Every vulnerability must explain *why* it was triggered (observed values vs. required values, computation steps). Underwriters must be able to explain any result to a policyholder. We accept added complexity in the output format to achieve this. |
| 3 | **Rules are data, not code** | Underwriting rules must be configurable by Applied Science users without engineering involvement. Rule changes flow through a publish/activate lifecycle, not through code deploys. We accept the added complexity of a rule schema and validation layer to achieve this. |
| 4 | **Immutability for trust** | Published rule releases are immutable. Evaluations are reproducible against any historical release. Policy locks guarantee stability. We accept storage overhead (full rule snapshots per release) to guarantee auditability. |
| 5 | **POC-scoped pragmatism** | We build the minimum needed to validate the concept. We defer features (severity models, bridge lifecycle, state-specific rules, batch evaluation) rather than build them partially. Every deferred feature is documented with a clear path to add it post-POC. |
| 6 | **Extensibility without over-engineering** | The rule engine uses a Registry + Strategy pattern so new rule types can be added by implementing an interface, not by modifying core logic. But we do not build plugin systems, DSLs, or abstractions beyond what the 3 current rule types require. |

---

## 3. Personas

### 3.1 Underwriter

| Attribute | Detail |
|-----------|--------|
| **Role** | Property risk evaluator and primary system user |
| **Goal** | Evaluate properties quickly and consistently; communicate clear, explainable decisions to policyholders |
| **Responsibilities** | Submit property observations via web form; review triggered vulnerabilities; select appropriate mitigations (full and/or bridge); manage bridge mitigation budget within limits; access past evaluations for reference |
| **System Interactions** | Evaluation Form (enter observations) -> Evaluation Results (review vulnerabilities, select mitigations) -> Evaluation History (browse past evaluations) -> Rule Reference (browse active rules with descriptions, read-only) |
| **Key Need** | Human-readable explanations for every vulnerability that can be shared directly with policyholders. Transparency into how computed thresholds are derived. |

### 3.2 Applied Science

| Attribute | Detail |
|-----------|--------|
| **Role** | Rule author and domain expert |
| **Goal** | Encode underwriting knowledge into testable, versioned rules that produce correct evaluation outcomes without engineering involvement |
| **Responsibilities** | Create, edit, and delete underwriting rules in the draft workspace; define mitigations (full and bridge) with their effects; test rules against sample observations before deployment; publish immutable rule releases; activate releases for production use |
| **System Interactions** | Rule List (manage drafts) -> Rule Editor (structured form + JSON editor) -> Rule Test Sandbox (validate with sample data) -> Release Manager (publish, review, activate) |
| **Key Need** | Confidence that a published rule set behaves as intended. The test sandbox and publish/activate separation provide a safety net before rules affect real evaluations. |

### 3.3 Admin

| Attribute | Detail |
|-----------|--------|
| **Role** | System administrator and configuration manager |
| **Goal** | Control system-wide settings and manage user access |
| **Responsibilities** | Configure the bridge mitigation limit per property (system-wide integer); manage user accounts and role assignments (Underwriter, Applied Science, Admin) |
| **System Interactions** | Admin Settings (configure bridge limits and system parameters) -> User Management (create accounts, assign roles) |
| **Key Need** | Simple, auditable configuration changes. Bridge limit changes take effect immediately for new mitigation selections. |

---

## 4. Functional Requirements

### FR-1: Property Observation Input

| ID | Requirement |
|----|-------------|
| FR-1.1 | The system SHALL accept a structured observation hash as input for evaluation. |
| FR-1.2 | The observation hash SHALL support enum fields (predefined values), numeric fields (measured values with units), boolean fields (yes/no), and array fields (repeating groups of related observations). |
| FR-1.3 | Observation fields fall into two categories: **globally required fields** (e.g., state, property_id) whose absence causes a validation error that halts evaluation, and **rule-referenced fields** (e.g., attic_vent_screens) whose absence causes the referencing rule to be skipped with a warning. |
| FR-1.4 | The system SHALL return clear error messages for missing globally required fields and warnings listing skipped rules with the specific missing fields. |
| FR-1.5 | The system SHALL support manual entry of property observations via a web form. |

**Known observation fields** (non-exhaustive -- rules may reference additional fields):

| Field | Type | Values / Units |
|-------|------|----------------|
| Attic Vent Screens | Enum | None, Standard, Ember Resistant |
| Roof Type | Enum | Class A, Class B, Class C |
| Window Type | Enum | Single Pane, Double Pane, Tempered Glass |
| Wildfire Risk Category | Enum | A, B, C, D |
| Vegetation[] | Array | Each item: Type (Tree/Shrub/Grass), Distance to Window (feet) |
| Home-to-Home Distance | Numeric | Feet (minimum edge-to-edge between building footprints) |

### FR-2: Vulnerability Identification

| ID | Requirement |
|----|-------------|
| FR-2.1 | The system SHALL evaluate a property observation against all applicable rules in the active (or specified) release and return a list of triggered vulnerabilities. |
| FR-2.2 | Each vulnerability SHALL include: name, human-readable description (as written for policyholders), functional rule logic evaluated, specific observation values that triggered it, and observed vs. required values. |
| FR-2.3 | A single observation MAY trigger multiple vulnerabilities. Rules are evaluated independently -- no rule depends on the output of another. |
| FR-2.4 | The system SHALL support 3 evaluation types. Any type may be mitigatable (has full/bridge mitigations) or unmitigatable (empty mitigation list triggers auto-decline per FR-2.7). |

**FR-2.4.1 -- Simple Threshold**: A single observation field compared against a required value.

> Example (mitigatable): Attic Vent Screens must be "Ember Resistant"
> Example (unmitigatable): Home-to-Home Distance must be >= 15.0 ft

**FR-2.4.2 -- Conditional Threshold**: The pass/fail criteria for one field change based on the value of another field.

> Example: Roof must be Class A, UNLESS Wildfire Risk Category = A, in which case Class B is acceptable.

**FR-2.4.3 -- Computed with Modifiers**: A base threshold modified by multipliers/divisors derived from observation field values. Each item in an array field is evaluated independently. Bridge mitigations apply as additional multipliers in the same formula.

> Example: Window safe distance -- base 30ft, modified by window type (Single Pane x3, Double Pane x2, Tempered Glass x1) and vegetation type (Tree x1, Shrub /2, Grass /3). Bridges stack multiplicatively: Film (x0.8) + Prune (x0.5) = x0.4.

| ID | Requirement |
|----|-------------|
| FR-2.5 | Rule config defines the **passing condition**. The evaluator reports a vulnerability when the condition is NOT met. |
| FR-2.6 | For the POC, all vulnerabilities are treated as equal weight. No severity model. |
| FR-2.7 | When an unmitigatable rule is triggered (empty mitigation list), the system SHALL automatically decline the property. The result SHALL clearly indicate which rule caused the decline. |

### FR-3: Mitigation Suggestion

| ID | Requirement |
|----|-------------|
| FR-3.1 | For each triggered vulnerability, the system SHALL return a list of applicable mitigations. |
| FR-3.2 | Each mitigation SHALL be categorized as **Full** (completely eliminates the vulnerability) or **Bridge** (partially addresses it; tracked and subject to limits). |
| FR-3.3 | Each mitigation SHALL include: name, category, human-readable description, and effect on the rule evaluation. |
| FR-3.4 | Bridge mitigations use a discriminated union for their effect type: **multiplier** (for computed rules -- multiplies the threshold, stackable multiplicatively) or **override** (for simple/conditional rules -- changes the required value to a less strict one). |
| FR-3.5 | For computed rules with bridge mitigations, the system SHALL show the current threshold, the modified threshold after each bridge, and whether the property passes. |
| FR-3.6 | A vulnerability MAY have only full mitigations, only bridge mitigations, both, or none (unmitigatable). |
| FR-3.7 | Each mitigation resolves only the single vulnerability it is associated with. Mitigations do NOT resolve multiple vulnerabilities simultaneously. |
| FR-3.8 | Multiple bridge mitigations MAY be applied to the same vulnerability. Modifiers stack multiplicatively. |
| FR-3.9 | The system SHALL display the cumulative effect of stacked bridge mitigations with intermediate and final computed values. |

### FR-4: Bridge Mitigation Tracking and Limits

| ID | Requirement |
|----|-------------|
| FR-4.1 | The system SHALL track all bridge mitigations applied to a property. |
| FR-4.2 | The system SHALL enforce a configurable maximum number of bridge mitigations per property (system-wide setting). |
| FR-4.3 | An Admin user SHALL be able to configure the bridge mitigation limit via the Admin interface. |
| FR-4.4 | The system SHALL display the current bridge mitigation count and remaining allowance before the user selects a bridge mitigation. |
| FR-4.5 | When the bridge mitigation limit is reached, the system SHALL prevent selection of additional bridge mitigations and clearly communicate the limit. |
| FR-4.6 | For the POC, bridge mitigations are tracked per **latest evaluation only**. Re-evaluation resets mitigation selections; the bridge count reflects only the current evaluation's selections. |

### FR-5: Rule Management (Applied Science)

| ID | Requirement |
|----|-------------|
| FR-5.1 | The system SHALL allow Applied Science users to create, update, and delete (or deactivate) rules. |
| FR-5.2 | Each rule definition SHALL include: name, human-readable description, functional logic, observation fields referenced, associated mitigations with category and effects, and state applicability (uniform for POC). |
| FR-5.3 | The system SHALL validate rule definitions for completeness and consistency before saving, using evaluator-specific validation. |
| FR-5.4 | Rules SHALL be authored via a **structured web form** for standard patterns, with a **JSON editor fallback** for complex rules. |
| FR-5.5 | Rules are edited in a single shared draft workspace. Optimistic locking (version column) prevents silent overwrites; concurrent edits produce a 409 Conflict. |

### FR-6: Rule Versioning (Release-Based)

| ID | Requirement |
|----|-------------|
| FR-6.1 | The system SHALL support **Rule Releases**: immutable, named snapshots of the complete rule set (e.g., "2026-Q2-v3.1"). |
| FR-6.2 | Applied Science users publish rule changes as a new release. Editing rules creates a draft with no effect on production evaluations until published. Publishing and activating are separate steps. |
| FR-6.3 | Exactly one release SHALL be designated as the **Active Release** -- the default rule set for new evaluations. |
| FR-6.4 | On a property's first evaluation, the system SHALL automatically lock the evaluation to the current Active Release (**Policy Lock**). Subsequent re-evaluations default to the locked release. |
| FR-6.5 | An underwriter MAY explicitly override the locked release. All overrides SHALL be logged in the audit trail. |
| FR-6.6 | The system SHALL display the release name and version in every evaluation result. |
| FR-6.7 | All published releases are preserved, queryable, and immutable. No deletion or modification of published releases. |

### FR-7: Rule Testing and Validation (Applied Science)

| ID | Requirement |
|----|-------------|
| FR-7.1 | The system SHALL provide a testing interface where Applied Science users can run sample observations against a rule or rule set and view evaluation results. |
| FR-7.2 | The testing interface SHALL show triggered vulnerabilities, intermediate computation steps, and suggested mitigations. |
| FR-7.3 | Testing draft/unpublished rules SHALL NOT affect production evaluations. |
| FR-7.4 | Automated test cases (saved observation + expected result pairs) are deferred post-POC. |

### FR-8: Rule Reference (Underwriter)

| ID | Requirement |
|----|-------------|
| FR-8.1 | The system SHALL provide a read-only Rule Reference view accessible to underwriters. |
| FR-8.2 | The Rule Reference SHALL display all rules from the active release with name, human-readable description, and all associated mitigations. |
| FR-8.3 | Underwriters SHALL be able to browse and search rules independently of running an evaluation. |
| FR-8.4 | The Rule Reference SHALL indicate which release the rules belong to. |

### FR-9: Auto-Decline

| ID | Requirement |
|----|-------------|
| FR-9.1 | When a triggered vulnerability has an empty mitigation list (unmitigatable), the system SHALL automatically decline the property as uninsurable. |
| FR-9.2 | The evaluation result SHALL clearly indicate which rule(s) caused the automatic decline. |
| FR-9.3 | Auto-declined properties may still show other vulnerabilities and their mitigations for informational purposes. |

### FR-10: Admin Configuration

| ID | Requirement |
|----|-------------|
| FR-10.1 | The system SHALL provide an Admin interface for configuring system settings. |
| FR-10.2 | Admin-configurable settings SHALL include (at minimum): bridge mitigation limit per property (integer, default 3). |
| FR-10.3 | The Admin SHALL be able to create user accounts and assign roles. |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Evaluation latency | < 2 seconds for a single property evaluation |
| NFR-2 | Platform | Web-based, modern browsers (Chrome, Firefox, Safari, Edge) |
| NFR-3 | Authentication | JWT-based with role-based authorization (3 roles: Underwriter, Applied Science, Admin) |
| NFR-4 | POC rule count | 4 example rules (architecture supports scaling to 100s) |
| NFR-5 | Auditability | Every evaluation stores full input (observations) and output (result). Release overrides logged in audit trail. |
| NFR-6 | Data integrity | Published releases are immutable. Optimistic locking on draft edits. Atomic bridge limit enforcement via SELECT FOR UPDATE. |
| NFR-7 | Reproducibility | Given the same release + observations, the engine produces identical results every time. |

---

## 6. High-Level Design

### 6.1 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React + TypeScript + Tailwind CSS + shadcn/ui | Component-based, strong typing, shared types with backend, accessible components |
| Backend | Node.js + Express + TypeScript | Same language end-to-end, strong JSON handling, fast for POC |
| Database | PostgreSQL | Relational integrity for versioning/releases, JSONB for flexible rule configs |
| ORM | Prisma | Type-safe DB access, migrations, good developer experience |
| Auth | JWT + bcrypt | Simple role-based, 3 roles hardcoded as string enum |
| Structure | Monorepo (`/client`, `/server`, `/shared`) | Simple for POC, shared TypeScript types across frontend and backend |

### 6.2 System Architecture

```
+---------------------------------------------------------------------------+
|                          FRONTEND (React + TypeScript)                     |
|                                                                           |
|  +-------------+ +-------------+ +-----------+ +---------+ +-----------+ |
|  | Evaluation  | |    Rule     | |   Rule    | |  Admin  | |   Auth    | |
|  |    Flow     | |   Manager   | | Reference | |  Config | |   Login   | |
|  |             | |             | |           | |         | |           | |
|  | - Obs Form  | | - CRUD      | | - Browse  | | - Bridge| | - Login   | |
|  | - Results   | | - Editor    | | - Search  | |   Limits| | - Roles   | |
|  | - History   | | - Test      | | (readonly)| | - Users | |           | |
|  | - Mitigate  | | - Releases  | |           | |         | |           | |
|  +------+------+ +------+------+ +-----+-----+ +----+----+ +-----+-----+ |
+---------|-----------------|--------------|-----------|-----------|---------+
          |                 |              |           |           |
          v                 v              v           v           v
+---------------------------------------------------------------------------+
|                       API LAYER (Node.js + Express)                       |
|  +-------------------------------------------------------------------+   |
|  |  Middleware: Auth (JWT) --> Role Check --> Request Validation       |   |
|  +-------------------------------------------------------------------+   |
|                                                                           |
|  +--------------+ +--------------+ +------------+ +------------+         |
|  |  Evaluation  | |    Rule      | |  Release   | |   Admin    |         |
|  |   Service    | |   Service    | |  Service   | |  Service   |         |
|  +------+-------+ +------+-------+ +-----+------+ +-----+------+         |
|         |                |               |               |                |
|         v                |               |               |                |
|  +--------------------+  |               |               |                |
|  |   RULES ENGINE     |  |               |               |                |
|  |  (Pure Functions)   |  |               |               |                |
|  |                     |  |               |               |                |
|  |  +--------------+   |  |               |               |                |
|  |  |  Evaluator   |   |  |               |               |                |
|  |  |  Registry    |   |  |               |               |                |
|  |  |  +--------+  |   |  |               |               |                |
|  |  |  |Simple  |  |   |  |               |               |                |
|  |  |  +--------+  |   |  |               |               |                |
|  |  |  |Condit. |  |   |  |               |               |                |
|  |  |  +--------+  |   |  |               |               |                |
|  |  |  |Computed|  |   |  |               |               |                |
|  |  |  +--------+  |   |  |               |               |                |
|  |  +--------------+   |  |               |               |                |
|  |  +--------------+   |  |               |               |                |
|  |  |   Bridge     |   |  |               |               |                |
|  |  |   Stacker    |   |  |               |               |                |
|  |  +--------------+   |  |               |               |                |
|  +----------+----------+  |               |               |                |
+---------------------------------------------------------------------------+
              |                 |               |               |
              v                 v               v               v
+---------------------------------------------------------------------------+
|                     DATA LAYER (Prisma + PostgreSQL)                       |
|                                                                           |
|  +--------+ +----------+ +--------------+ +--------------+               |
|  | users  | |  rules   | |  releases    | | release_rules|               |
|  |        | | (drafts) | |              | | (snapshots)  |               |
|  +--------+ +----------+ +--------------+ +--------------+               |
|  +--------------+ +---------------------+ +------------+                 |
|  | policy_locks | |    evaluations      | |  settings  |                 |
|  +--------------+ +----------+----------+ +------------+                 |
|                    +----------+----------+ +------------+                 |
|                    | eval_mitigations    | | audit_log  |                 |
|                    +---------------------+ +------------+                 |
+---------------------------------------------------------------------------+
```

### 6.3 Rules Engine Internals

The engine is a **pure function** with no database dependencies:

```
evaluate(observations, rules[]) --> EvaluationResult
```

#### Evaluator Registry + Strategy Pattern

Each rule type has a dedicated evaluator implementing a common interface. The registry dispatches by `rule.type`. Adding a new rule type requires only implementing the interface and registering it -- no core engine changes.

```
EvaluatorRegistry
  +-- register(type, evaluator)          // At application startup
  +-- get(type) --> Evaluator            // At evaluation time
  +-- evaluate(rule, observations) --> EvalResult

Evaluator (interface)
  +-- evaluate(config, observations) --> EvalResult
  +-- validate(config) --> ValidationResult    // At authoring and publish time
```

**Three evaluator implementations:**

| Evaluator | Rule Type | Behavior |
|-----------|-----------|----------|
| SimpleThresholdEvaluator | `simple_threshold` | Compares a single observation field against a required value using an operator (eq, neq, in, gte, lte, gt, lt). Triggers when the passing condition is not met. |
| ConditionalThresholdEvaluator | `conditional_threshold` | Evaluates a series of condition branches. Each branch has a `when` clause (checked against one observation field) and a `then` clause (the threshold to apply). Falls back to a `default` threshold if no branch matches. |
| ComputedWithModifiersEvaluator | `computed_with_modifiers` | Computes a numeric threshold from a base value modified by observation-derived multipliers/divisors. For array fields, evaluates each item independently. Triggers if any item fails. |

**Why Registry + Strategy:**
- Adding a new rule type requires only implementing the interface and calling `register()`. No switch statements, no core engine changes.
- Each evaluator validates its own config shape, so errors surface at rule authoring and publish time, not at evaluation time.
- Compile-time type safety without the overhead of a plugin or dynamic loading system.

#### Bridge Stacker

Isolated component for computing stacked bridge effects on computed rules:

```
Algorithm (Computed Rules with Bridge Mitigations):

1. COMPUTE observation_modifier_product = 1.0
   FOR each modifier in rule.modifiers:
     observed_value = observation[modifier.field]
     multiplier = modifier.mapping[observed_value]
     IF modifier.operation == "multiply":
       observation_modifier_product *= multiplier
     ELSE IF modifier.operation == "divide":
       observation_modifier_product /= multiplier

2. base_threshold = rule.baseValue * observation_modifier_product
   // e.g., 30 (base) * 3 (Single Pane) * 1 (Trees) = 90 ft

3. bridge_modifier_product = 1.0
   FOR each bridge in selected_bridges:
     bridge_modifier_product *= bridge.value
   // e.g., 0.8 (Film) * 0.5 (Prune) = 0.4

4. final_threshold = base_threshold * bridge_modifier_product
   // e.g., 90 * 0.4 = 36 ft

5. COMPARE actual_value against final_threshold
   passes = (actual_value >= final_threshold)
   // e.g., 50 >= 36 --> PASSES

6. RETURN {
     base_threshold,              // 90 ft
     bridge_modifier_product,     // 0.4
     final_threshold,             // 36 ft
     actual_value,                // 50 ft
     passes,                      // true
     breakdown: [                 // Per-bridge running totals for UI
       { bridge: "Apply Film",  modifier: 0.8, running_threshold: 72 },
       { bridge: "Prune Trees", modifier: 0.5, running_threshold: 36 }
     ]
   }
```

**Array field behavior:** Steps 1-5 execute per array item (e.g., each vegetation entry), because each item may have different modifier values. The rule triggers if ANY item fails. Bridge modifiers apply uniformly across all items. The UI breakdown is per-item.

#### Bridge Stacking Example (Windows Rule)

```
WINDOWS RULE -- Single Pane, Tree at 50ft

Step 1: Compute required safe distance
+---------------------------------------------------+
|  Base Distance     30 ft                          |
|  x Window Modifier  3  (Single Pane)              |
|  x Veg Modifier     1  (Tree)                     |
|  -------------------------                        |
|  = Required Distance: 90 ft                       |
|                                                    |
|  Actual Distance: 50 ft                            |
|  50 < 90 --> FAIL                                  |
+---------------------------------------------------+

Step 2: Apply Bridge -- "Apply Film" (x0.8)
+---------------------------------------------------+
|  Required Distance  90 ft                         |
|  x Film Modifier    0.8                           |
|  -------------------------                        |
|  = New Required: 72 ft                            |
|                                                    |
|  50 < 72 --> still FAIL                            |
|  Bridge count: 1                                   |
+---------------------------------------------------+

Step 3: Stack Bridge -- "Prune Trees" (x0.5)
+---------------------------------------------------+
|  Required Distance  72 ft (after film)            |
|  x Prune Modifier   0.5                           |
|  -------------------------                        |
|  = New Required: 36 ft                            |
|                                                    |
|  50 >= 36 --> PASS                                 |
|  Bridge count: 2                                   |
|  (cumulative: 90 x 0.8 x 0.5 = 36)               |
+---------------------------------------------------+
```

### 6.4 Data Model

```
users
  id          UUID PK
  email       VARCHAR UNIQUE
  password_hash VARCHAR
  role        ENUM (underwriter | applied_science | admin)

rules (draft workspace -- shared, optimistic locking)
  id          UUID PK
  name        VARCHAR
  description TEXT            -- Human-readable (for policyholders)
  type        VARCHAR         -- simple_threshold | conditional_threshold | computed_with_modifiers
  config      JSONB           -- Type-specific configuration
  mitigations JSONB           -- Array of mitigations with categories and effects
  created_by  UUID FK -> users.id
  created_at  TIMESTAMP
  updated_at  TIMESTAMP
  version     INTEGER         -- Optimistic locking (starts at 1, increments on update)

releases
  id          UUID PK
  name        VARCHAR UNIQUE  -- e.g., "2026-Q2-v3.1"
  published_at TIMESTAMP
  published_by UUID FK -> users.id
  is_active   BOOLEAN         -- Exactly one release is active at a time

release_rules (immutable snapshots)
  id          UUID PK
  release_id  UUID FK -> releases.id
  rule_id     UUID            -- Original draft rule ID for correlation
  rule_snapshot JSONB          -- Full deep copy of rule at publish time

policy_locks (one per property -- FR-6.4)
  id          UUID PK
  property_id VARCHAR UNIQUE  -- Opaque user-provided identifier
  release_id  UUID FK -> releases.id
  locked_at   TIMESTAMP
  locked_by   UUID FK -> users.id

evaluations
  id          UUID PK
  property_id VARCHAR
  release_id  UUID FK -> releases.id
  observations JSONB          -- Full input for audit
  result      JSONB           -- Full output for audit
  is_auto_declined BOOLEAN
  created_by  UUID FK -> users.id
  created_at  TIMESTAMP

evaluation_mitigations (selected mitigations per evaluation)
  evaluation_id UUID FK -> evaluations.id
  rule_id     VARCHAR         -- Rule ID from the evaluation result
  mitigation_id VARCHAR       -- Mitigation ID (UUID generated at rule creation)
  category    ENUM (full | bridge)

settings
  key         VARCHAR PK      -- e.g., "bridge_mitigation_limit"
  value       JSONB           -- e.g., 3

audit_log
  id          UUID PK
  action      VARCHAR         -- e.g., activate_release, override_lock, update_setting
  entity_type VARCHAR         -- e.g., release, evaluation, setting
  entity_id   VARCHAR
  user_id     UUID FK -> users.id
  details     JSONB           -- Action-specific context
  created_at  TIMESTAMP
```

**Key design decisions:**

| Decision | Rationale |
|----------|-----------|
| Rules stored as JSONB | Flexible schema per rule type in a single table. Avoids separate tables per type. Postgres JSONB supports querying into the JSON when needed. |
| Full snapshot per release | `release_rules.rule_snapshot` is a deep copy. Guarantees immutability even if drafts are later modified. Trade-off: higher storage, but trivial at POC scale. |
| Evaluations store input + output | Full audit trail. Given a release + observations, the result is reproducible. |
| Policy locks as a dedicated table | Clean lookup for "which release should this property use?" vs. fragile inference from evaluation history. |
| Optimistic locking on rules | `version` column prevents silent overwrites when multiple Applied Science users edit concurrently. Update includes expected version; mismatch returns 409 Conflict. |

### 6.5 Evaluation Pipeline

```
Underwriter                    API                     Engine                    Database
    |                           |                        |                          |
    |  POST /api/evaluate       |                        |                          |
    |  { observations,          |                        |                          |
    |    release_id: null }     |                        |                          |
    |-------------------------->|                        |                          |
    |                           |                        |                          |
    |                           |  1. Resolve release    |                          |
    |                           |  (null --> policy lock  |                          |
    |                           |   --> active release)  |                          |
    |                           |----------------------------------------------->  |
    |                           |<-----------------------------------------------  |
    |                           |                        |                          |
    |                           |  2. Load rule snapshots|                          |
    |                           |  for resolved release  |                          |
    |                           |----------------------------------------------->  |
    |                           |<-----------------------------------------------  |
    |                           |                        |                          |
    |                           |  3. evaluate(obs,rules)|                          |
    |                           |----------------------->|                          |
    |                           |                        |                          |
    |                           |               For each rule:                     |
    |                           |               +-------------------------+        |
    |                           |               | a. Check required fields|        |
    |                           |               |    (skip if missing)    |        |
    |                           |               | b. registry.get(type)  |        |
    |                           |               | c. evaluator.evaluate()|        |
    |                           |               | d. Collect result       |        |
    |                           |               +-------------------------+        |
    |                           |                        |                          |
    |                           |               Check auto-decline                 |
    |                           |               (unmitigatable vulnerability?)     |
    |                           |                        |                          |
    |                           |   EvaluationResult     |                          |
    |                           |<-----------------------|                          |
    |                           |                        |                          |
    |                           |  4. Save evaluation    |                          |
    |                           |  5. Create policy lock |                          |
    |                           |     (if first eval)    |                          |
    |                           |----------------------------------------------->  |
    |                           |                        |                          |
    |   Evaluation response     |                        |                          |
    |   (vulnerabilities,       |                        |                          |
    |    mitigations, details,  |                        |                          |
    |    summary)               |                        |                          |
    |<--------------------------|                        |                          |
```

**Pipeline steps in detail:**

| Step | Action | Details |
|------|--------|---------|
| 1 | Resolve release | If `release_id` is null, check policy lock for the property. If locked, use locked release. If no lock, use active release. If explicit `release_id` provided, use it and log override in audit trail. |
| 2 | Load rules | Fetch all `release_rules` rows for the resolved release. Deserialize `rule_snapshot` JSONB into typed Rule objects. |
| 3 | Validate input | Check globally required fields. If missing, return validation error immediately. |
| 4 | Evaluate rules | For each rule, check if referenced fields are present (skip with warning if not). Dispatch to the appropriate evaluator via the registry. Collect results. |
| 5 | Check auto-decline | If any triggered vulnerability has an empty mitigation list, mark the evaluation as auto-declined. |
| 6 | Persist | Save evaluation record (observations + result + auto-decline status). Create policy lock if this is the property's first evaluation. |
| 7 | Return | Full result with vulnerabilities, mitigations, computation details, skipped rules, and summary counts. |

### 6.6 API Surface Summary

All endpoints are prefixed with `/api`.

**Authentication**

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/auth/login` | Authenticate, returns JWT | All |
| POST | `/auth/register` | Create user account | Admin |

**Evaluation (Underwriter)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/evaluate` | Submit observations, get vulnerabilities + mitigations |
| POST | `/evaluate/:id/mitigations` | Select mitigations for an evaluation |
| GET | `/evaluations` | List past evaluations |
| GET | `/evaluations/:id` | Get evaluation detail with full results |

**Rule Reference (Underwriter)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/releases/active/rules` | All rules from the active release (read-only, human-readable) |
| GET | `/releases/:id/rules` | All rules from a specific release |

**Rules (Applied Science)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rules` | List all draft rules |
| POST | `/rules` | Create a new rule |
| GET | `/rules/:id` | Get rule detail |
| PUT | `/rules/:id` | Update a rule (with version for optimistic locking) |
| DELETE | `/rules/:id` | Delete (deactivate) a rule |
| POST | `/rules/:id/test` | Test a rule against sample observations |

**Releases (Applied Science)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/releases` | List all releases |
| POST | `/releases` | Publish a new release (snapshot current draft rules) |
| GET | `/releases/:id` | Get release detail with rules |
| PUT | `/releases/:id/activate` | Set as active release |

**Admin**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/settings` | Get all settings |
| PUT | `/settings` | Update settings (e.g., bridge limit) |
| GET | `/users` | List users |
| POST | `/users` | Create user with role |

### 6.7 Frontend Screens

| Screen | User | Purpose |
|--------|------|---------|
| Evaluation Form | Underwriter | Enter property observations via sectioned web form |
| Evaluation Results | Underwriter | View triggered vulnerabilities, select mitigations, see computation math and bridge stacking |
| Evaluation History | Underwriter | Browse past evaluations by property |
| Rule Reference | Underwriter | Browse active rules with descriptions and mitigations (read-only, searchable) |
| Rule List | Applied Science | View and manage all draft rules |
| Rule Editor | Applied Science | Create/edit rules via structured form + JSON editor fallback |
| Rule Test Sandbox | Applied Science | Test rules against sample observations with full result display |
| Release Manager | Applied Science | Publish releases, review snapshots, activate for production |
| Admin Settings | Admin | Configure bridge mitigation limits, manage user accounts |

### 6.8 Error Handling

| Scenario | Handling |
|----------|----------|
| Missing globally required field | 400 error with field name. Evaluation does not proceed. |
| Missing rule-referenced field | Rule skipped. Warning included in result listing the rule and missing fields. Other rules still evaluated. |
| Partial rule failure (evaluator throws) | Error logged. Failed rule included in result with `status: "error"`. Other rules still evaluated. Evaluation flagged as having partial failures. |
| Invalid rule config at save time | Evaluator-specific validation rejects with field-level errors. |
| Invalid rule config at publish time | Full validation pass on all rules. Publish rejected with errors if any rule fails. |
| Bridge limit exceeded | 422 with message: "Bridge mitigation limit reached. Current: X, Limit: Y." |
| Concurrency conflict on rule edit | 409 Conflict with current version. Client must reload. |
| No active release configured | 503 with message: "No active release configured. Contact Applied Science." |
| Release not found | 404. |

**Standard error response format:**

```json
{
  "error": {
    "code": "BRIDGE_LIMIT_EXCEEDED",
    "message": "Bridge mitigation limit reached (3/3). Remove an existing bridge before adding a new one.",
    "details": { "current": 3, "limit": 3 }
  }
}
```

### 6.9 Concurrency Considerations

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Two underwriters evaluate the same property simultaneously | Evaluation is a pure function over immutable data -- concurrent evaluations produce identical results. Race condition on mitigation selection could exceed bridge limit. | Use `SELECT ... FOR UPDATE` on the property's bridge count when selecting mitigations. Atomic check within transaction. |
| Release published/activated during in-flight evaluation | The evaluation already loaded its rule set into memory at the start of the request. | No special handling needed. Snapshot model naturally isolates in-flight evaluations. |
| Two Applied Science users edit the same draft rule | Last writer wins silently without protection. | Optimistic locking via `version` column. Update request includes expected version; mismatch returns 409 Conflict. |

---

## 7. Assumptions

| # | Assumption | Impact if Wrong |
|---|------------|-----------------|
| A-1 | `property_id` is an opaque, user-provided identifier. The system trusts it as canonical. Two evaluations with the same `property_id` refer to the same physical property. | Policy locks and bridge counts may be inconsistent if the same property gets different IDs. Post-POC: consider a property registry. |
| A-2 | Rules are uniform across all states. State determines only whether a property is eligible for insurance, not which rules apply. | If state-specific rule variants are needed, the rule schema and engine need extension. Designed for easy addition post-POC. |
| A-3 | The 3 rule evaluation types (Simple, Conditional, Computed) are sufficient for the POC scope. | If rules require multi-field boolean logic (3+ fields), cross-array aggregation, or field-to-field comparison, new evaluator types are needed. These can be added via the Registry pattern without core changes. |
| A-4 | A single shared draft workspace is acceptable for Applied Science. Concurrent editing is handled by optimistic locking (version conflict produces 409 error). | If concurrent editing becomes frequent, may need a more sophisticated merge/conflict resolution model. |
| A-5 | Bridge mitigations are counted per latest evaluation only. Re-evaluation resets the mitigation selections and bridge count for that property. | If cumulative tracking across evaluations is needed, the data model supports it but the counting logic must change. |
| A-6 | The POC will operate with 4 example rules and scale to approximately 100 rules post-POC. The engine does not need to support thousands of rules. | At 500+ rules, consider caching, parallel evaluation, or rule pre-filtering. Current architecture handles 100 rules within the 2-second latency target. |
| A-7 | No external data integrations (GIS, mapping, third-party property databases). All observation values are entered manually via the web form. | If automated data ingestion is needed, add API-based input alongside the web form. The engine itself is input-method agnostic. |
| A-8 | Single company, single tenant. No multi-tenant isolation needed. | If multi-tenant support is needed post-POC, add tenant scoping to all tables and API calls. |

---

## 8. Trade-offs

### T-1: Full Snapshot vs. Delta-Based Versioning

**Chosen: Full snapshot per release.**

| Factor | Full Snapshot (chosen) | Delta-Based |
|--------|----------------------|-------------|
| Immutability | Guaranteed -- each release is self-contained | Requires reconstructing from base + chain of deltas |
| Storage | Higher -- duplicates unchanged rules per release | Lower -- stores only changes |
| Complexity | Simple -- read one row, get the full rule | Complex -- must resolve delta chain |
| Query performance | Fast -- single join to get all rules for a release | Slower -- must reconstruct state |
| Auditability | Each release is a complete, citable artifact | Harder to audit; must reconstruct state at a point in time |

**Rationale:** For a POC with approximately 20 rules at approximately 2KB each, storage is trivial (approximately 200KB per release). The simplicity and auditability of full snapshots outweigh the storage cost. Delta-based storage is only justified at 500+ rules with frequent releases.

### T-2: Structured Form vs. DSL for Rule Authoring

**Chosen: Structured form + JSON editor fallback.**

| Factor | Structured Form (chosen) | DSL |
|--------|-------------------------|-----|
| Learning curve | Low -- point and click | High -- must learn syntax |
| Expressiveness | Limited to supported patterns | Unlimited |
| Validation | Built into form controls | Requires a parser and error reporting |
| POC timeline | Faster to build | Significant additional effort |

**Rationale:** The 3 rule types are well-defined and finite. A structured form covers them without forcing Applied Science to learn a syntax. JSON editor fallback handles edge cases. A DSL can be added post-POC if rule types expand beyond what forms can support.

### T-3: Monolith vs. Microservices

**Chosen: Monolith with clean internal separation.**

| Factor | Monolith (chosen) | Microservices |
|--------|-------------------|---------------|
| Deployment | Single deploy | Multiple deploys, orchestration needed |
| Latency | In-process function calls | Network hops between services |
| Complexity | Lower -- single codebase | Higher -- service discovery, API contracts, distributed debugging |
| Scalability | Scale the whole application | Scale individual services independently |

**Rationale:** The POC has a single team, a single database, and low traffic. Microservices add coordination overhead with no benefit at this scale. The internal architecture (services, engine, data layer) is cleanly separated and can be extracted into services post-POC if needed.

### T-4: Per-Latest-Evaluation Bridge Count vs. Cumulative

**Chosen: Per-latest-evaluation.**

| Factor | Per-Latest (chosen) | Cumulative |
|--------|---------------------|------------|
| Simplicity | Simple -- count within one evaluation | Complex -- track across evaluations, handle deletions and re-evaluations |
| Re-evaluation behavior | Clean reset -- fresh start each time | Must reconcile old and new mitigation selections |
| Business accuracy | Less accurate for long-lived policies | More accurate reflection of total bridges ever applied |
| POC scope | Sufficient for concept validation | Over-engineered for POC |

**Rationale:** Cumulative tracking requires handling edge cases (what if a vulnerability disappears in a re-evaluation? do its bridges "un-count"?). Per-latest is simple and sufficient for validating the concept. The `evaluation_mitigations` data model supports cumulative counting if needed post-POC by changing only the counting query.

### T-5: Pure Function Engine vs. DB-Integrated

**Chosen: Pure function.**

| Factor | Pure Function (chosen) | DB-Integrated |
|--------|----------------------|---------------|
| Testability | Unit tests with no DB setup | Requires database fixtures |
| Performance | In-memory, sub-millisecond per rule | Database queries per rule evaluation |
| Portability | Can run anywhere (server, CLI, theoretically browser) | Tied to the database |
| Boundary | Clean -- rules loaded once, handed to engine as data | Blurred -- engine interleaves logic and data access |

**Rationale:** The engine is the highest-risk component. Making it a pure function means it can be exhaustively unit-tested in isolation with the 4 example rules before any database or API layer exists. Rules are loaded once per request from the database, then passed to the engine as plain data. This clean boundary also means the engine could theoretically run client-side for instant previews in the Rule Test Sandbox.

---

## Appendix A: Example Rule Definitions

These 4 rules serve as POC seed data and validate all 3 evaluation types.

### Rule 1 -- Attic Vent (Simple Threshold, mitigatable)

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
    {
      "name": "Install Ember-Rated Vents",
      "category": "full",
      "description": "Replace all vents with ember-rated vents"
    }
  ]
}
```

**Behavior:** Triggers when `attic_vent_screens` is anything other than "Ember Resistant". Full mitigation available.

### Rule 2 -- Roof (Conditional Threshold, mitigatable)

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
    {
      "name": "Replace Roof",
      "category": "full",
      "description": "Upgrade to Class A roof"
    }
  ]
}
```

**Behavior:** In Wildfire Risk Category A, Class A or Class B roofs pass. In all other categories, only Class A passes. Full mitigation available.

### Rule 3 -- Windows (Computed with Modifiers, full + bridge mitigations)

```json
{
  "name": "Window Safety Distance",
  "description": "Ensure windows can withstand heat exposure from surrounding vegetation",
  "type": "computed_with_modifiers",
  "config": {
    "baseValue": 30,
    "unit": "feet",
    "modifiers": [
      {
        "field": "window_type",
        "operation": "multiply",
        "mapping": { "Single Pane": 3, "Double Pane": 2, "Tempered Glass": 1 }
      },
      {
        "field": "vegetation[].type",
        "operation": "divide",
        "mapping": { "Tree": 1, "Shrub": 2, "Grass": 3 }
      }
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

**Behavior:** Computes a required safe distance per vegetation item based on window type and vegetation type modifiers. Triggers if any vegetation item is closer than its computed safe distance. Two full mitigations and three bridge mitigations (stackable multiplicatively).

### Rule 4 -- Home-to-Home Distance (Simple Threshold, unmitigatable)

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

**Behavior:** Triggers when `home_to_home_distance` is less than 15 feet. Empty mitigation list means auto-decline -- the property is uninsurable.

---

## Appendix B: Known Limitations

These are documented POC-scope limitations with paths to resolution post-POC.

| # | Limitation | Path to Resolution |
|---|-----------|-------------------|
| L-1 | No severity model -- all vulnerabilities are treated as equal weight | Add High/Medium/Low enum to rule definition; sort and filter results by severity |
| L-2 | No state-specific rule variants -- rules are uniform across states | Add state field to rules; filter applicable rules by property state at evaluation time |
| L-3 | No multi-field boolean logic (3+ fields in a single rule) | Add a `composite` rule type or lightweight expression language |
| L-4 | No cross-array aggregation (e.g., "more than 3 trees within 50ft") | Add an `aggregation` rule type with count/sum/min/max operations |
| L-5 | No field-to-field comparison (e.g., "distance >= 2x height") | Add dynamic field references to computed rules |
| L-6 | No bridge mitigation floor -- stacking can reduce threshold to near-zero | Add configurable minimum threshold percentage per rule |
| L-7 | No automated test cases for rules -- testing is manual via UI | Add saved observation + expected result pairs per rule |
| L-8 | No release diff -- cannot compare draft vs. last published release | Add diff API endpoint and UI comparison view |
| L-9 | Bridge count is per-latest-evaluation only, not cumulative across evaluations | Change counting query to aggregate across evaluations per property |
| L-10 | No batch/bulk property evaluation -- single property at a time | Add batch endpoint accepting an array of observations |
| L-11 | No external data integrations (GIS, mapping) -- all data entered manually | Add API-based input alongside web form; engine is input-method agnostic |
| L-12 | No Rule Reference search/filter -- only list endpoints in the API | Add query parameters for search by name, field, mitigation type |

---

## Appendix C: Implementation Order

| Phase | Scope | Key Deliverables |
|-------|-------|------------------|
| **1. Engine Core** | Rule types, evaluators, bridge stacker (no API, no UI) | Rule type definitions + Zod schemas; Evaluator Registry with 3 implementations; Bridge Stacker; Unit tests with 4 example rules |
| **2. Data Layer + API** | Prisma schema, REST endpoints, auth | Prisma schema + migrations; Seed script (4 rules, 1 release, sample users); Evaluation API; Rule CRUD API; Release publish/activate API; Auth (JWT + roles) |
| **3. Frontend** | All user-facing screens | Auth (login, role-based routing); Evaluation form + results display; Mitigation selection with bridge stacking UI; Rule editor (form + JSON); Rule testing sandbox; Release manager |
| **4. Polish** | Secondary features and edge cases | Rule Reference view (underwriter); Admin settings; Evaluation history; Error handling and edge cases; Seed data for demos |

---

*End of document.*
