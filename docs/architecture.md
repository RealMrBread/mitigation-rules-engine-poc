# Mitigation Rules Engine — Architecture

**Version**: 0.1 (Draft)
**Date**: 2026-03-13

---

## 1. Tech Stack

### Recommended Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React + TypeScript | Component-based, strong typing, large ecosystem. Good for form-heavy UIs. |
| **UI Framework** | Tailwind CSS + shadcn/ui | Rapid styling, accessible components out of the box |
| **Backend** | Node.js (Express or Fastify) + TypeScript | Same language as frontend, fast for POC, strong JSON handling |
| **Database** | PostgreSQL | Relational model fits rules/versions/releases well. JSONB for flexible rule definitions. |
| **ORM** | Prisma | Type-safe DB access, easy migrations, good DX |
| **Auth** | Simple role-based (JWT + bcrypt) | 3 roles: Underwriter, Applied Science, Admin. No OAuth needed for POC. |
| **Monorepo** | Single repo, separate `/client` and `/server` dirs | Simple for POC, easy to deploy |

### Why Not...

| Alternative | Why not for POC |
|---|---|
| Next.js (fullstack) | Adds SSR complexity we don't need. API routes less flexible than a standalone backend. |
| Python/Django | Would work well, but TypeScript end-to-end means shared types for rule definitions — big win for this domain. |
| MongoDB | Rule versioning and releases need strong relational integrity. JSONB in Postgres gives us flexibility where needed. |
| Microservices | Overkill for POC. Monolith with clean separation is simpler. |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐ │
│  │Evaluation │  │  Rule    │  │ Admin  │  │  Auth  │ │
│  │   Flow   │  │ Manager  │  │ Config │  │  Login │ │
│  └────┬─────┘  └────┬─────┘  └───┬────┘  └───┬────┘ │
└───────┼──────────────┼────────────┼───────────┼──────┘
        │              │            │           │
        ▼              ▼            ▼           ▼
┌─────────────────────────────────────────────────────┐
│                  REST API (Express)                   │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌────────┐ │
│  │Evaluation │  │  Rule    │  │ Admin  │  │  Auth  │ │
│  │   API    │  │   API    │  │  API   │  │  API   │ │
│  └────┬─────┘  └────┬─────┘  └───┬────┘  └───┬────┘ │
│       │              │            │           │       │
│       ▼              │            │           │       │
│  ┌──────────┐        │            │           │       │
│  │  Rules   │        │            │           │       │
│  │  Engine  │        │            │           │       │
│  └────┬─────┘        │            │           │       │
└───────┼──────────────┼────────────┼───────────┼──────┘
        │              │            │           │
        ▼              ▼            ▼           ▼
┌─────────────────────────────────────────────────────┐
│                   PostgreSQL                         │
│                                                       │
│  rules | releases | evaluations | mitigations | users │
└─────────────────────────────────────────────────────┘
```

---

## 3. Rules Engine Design

The rules engine is the core of the system. It's a pure function:

```
evaluate(observations, ruleSet) → EvaluationResult
```

### 3.1 Rule Representation

Each rule is stored as a JSON document with a defined schema. The `type` field determines which evaluator processes it.

```typescript
type Rule = {
  id: string;
  name: string;
  description: string;           // Human-readable (for policyholders)
  type: "simple_threshold" | "conditional_threshold" | "computed_with_modifiers";
  config: SimpleConfig | ConditionalConfig | ComputedConfig;
  mitigations: Mitigation[];     // Empty array = unmitigatable → auto-decline
};

// --- Simple Threshold ---
type SimpleConfig = {
  field: string;                  // e.g., "attic_vent_screens"
  operator: "eq" | "neq" | "in" | "gte" | "lte" | "gt" | "lt";
  value: string | number | string[];
};

// --- Conditional Threshold ---
type ConditionalConfig = {
  conditions: ConditionalBranch[];
  default: ThresholdCheck;        // Fallback if no condition matches
};

type ConditionalBranch = {
  when: {
    field: string;
    operator: "eq" | "in" | "gte" | "lte" | "gt" | "lt";
    value: string | number | string[];
  };
  then: ThresholdCheck;
};

type ThresholdCheck = {
  field: string;
  operator: "eq" | "in" | "gte" | "lte" | "gt" | "lt";
  value: string | number | string[];
};

// --- Computed with Modifiers ---
type ComputedConfig = {
  baseValue: number;              // e.g., 30 (feet)
  unit: string;                   // e.g., "feet"
  modifiers: Modifier[];
  comparisonField: string;        // The observation field to compare against (e.g., "vegetation[].distance")
  comparisonOperator: "gte" | "gt";  // Passes if actual >= threshold
  arrayField?: string;            // If set, evaluate each item independently (e.g., "vegetation")
};

type Modifier = {
  field: string;                  // Observation field (e.g., "window_type")
  mapping: Record<string, number>; // Value → multiplier (e.g., { "Single Pane": 3, "Double Pane": 2 })
  operation: "multiply" | "divide";
};

// --- Mitigations ---
type Mitigation = {
  id: string;
  name: string;
  description: string;
  category: "full" | "bridge";
  effect?: BridgeEffect;         // Only for bridge mitigations
};

type BridgeEffect =
  | { type: "multiplier"; value: number }       // For computed rules: multiplies the threshold (e.g., 0.8 = 20% reduction)
  | { type: "override"; value: string | number } // For simple/conditional rules: changes the required value to pass
;
```

### 3.2 Evaluation Pipeline

```
Input: observations + releaseId
                │
                ▼
   ┌─────────────────────┐
   │  1. Load Rule Set   │  Fetch all rules for the given release
   │     (by release)    │
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  2. Validate Input  │  Check required fields exist for each rule
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  3. Evaluate Rules  │  For each rule, dispatch to the correct evaluator:
   │     (independent)   │    - SimpleEvaluator
   └──────────┬──────────┘    - ConditionalEvaluator
              │               - ComputedEvaluator
              ▼
   ┌─────────────────────┐
   │  4. Collect Results │  List of triggered vulnerabilities
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  5. Check for       │  If any triggered vulnerability has empty
   │     Auto-Decline    │  mitigations → property is auto-declined
   └──────────┬──────────┘
              │
              ▼
   ┌─────────────────────┐
   │  6. Return Result   │  Vulnerabilities + mitigations + computation details
   └─────────────────────┘
```

### 3.3 Evaluator Functions

Each evaluator is a pure function:

```typescript
// All evaluators follow this interface
interface Evaluator {
  evaluate(config: RuleConfig, observations: Record<string, any>): EvalResult;
}

type EvalResult = {
  triggered: boolean;
  details: {
    observedValues: Record<string, any>;  // What values were checked
    requiredValues: any;                   // What was required
    computedThreshold?: number;            // For computed rules
    explanation: string;                   // Human-readable
  };
};
```

---

## 4. Data Model

### 4.1 Entity Relationship

```
users
  id, email, password_hash, role (underwriter|applied_science|admin)

rules (draft workspace — single shared workspace, optimistic locking)
  id, name, description, type, config (JSONB), mitigations (JSONB),
  created_by, created_at, updated_at, version (integer, for optimistic locking)

releases
  id, name (e.g., "2026-Q2-v3.1"), published_at, published_by, is_active

release_rules (immutable snapshot)
  id, release_id → releases.id, rule_id (original draft rule ID),
  rule_snapshot (JSONB)  -- full copy of rule at time of publish

policy_locks (release lock per property — FR-6.4)
  id, property_id (VARCHAR, unique), release_id → releases.id,
  locked_at, locked_by → users.id

evaluations
  id, property_id, release_id, observations (JSONB), result (JSONB),
  is_auto_declined, created_by, created_at

evaluation_mitigations (selected mitigations per evaluation)
  evaluation_id → evaluations.id
  rule_id, mitigation_id, category (full|bridge)

settings
  key, value (JSONB)  -- e.g., { "bridge_mitigation_limit": 3 }

audit_log (release overrides, admin changes — FR-6.5)
  id, action (VARCHAR), entity_type (VARCHAR), entity_id (VARCHAR),
  user_id → users.id, details (JSONB), created_at
```

### 4.2 Key Design Decisions

**Rules stored as JSONB:** The `config` and `mitigations` fields are JSONB columns. This gives us flexibility for the 3 rule types without needing separate tables per type, while still allowing Postgres to query into the JSON.

**Release snapshots are full copies:** When a release is published, each rule is serialized into `release_rules.rule_snapshot`. This guarantees immutability — even if the draft rule is later modified, the release version is frozen.

**Evaluations store both input and output:** The `observations` and `result` fields capture the full evaluation for audit purposes. Given a release + observations, the result is reproducible.

---

## 5. API Design

### 5.1 Auth

| Method | Endpoint | Description | Role |
|---|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT | All |
| POST | `/api/auth/register` | Register user (admin-created) | Admin |

### 5.2 Evaluation (Underwriter)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/evaluate` | Submit observations, get vulnerabilities + mitigations |
| POST | `/api/evaluate/:id/mitigations` | Select mitigations for an evaluation |
| GET | `/api/evaluations` | List past evaluations |
| GET | `/api/evaluations/:id` | Get evaluation detail with results |

**POST /api/evaluate — Request:**
```json
{
  "observations": {
    "attic_vent_screens": "Standard",
    "roof_type": "Class B",
    "window_type": "Single Pane",
    "wildfire_risk_category": "C",
    "vegetation": [
      { "type": "Tree", "distance_to_window": 50 },
      { "type": "Shrub", "distance_to_window": 20 }
    ],
    "home_to_home_distance": 18
  },
  "release_id": null
}
```
`release_id: null` → uses the active release.

**POST /api/evaluate — Response:**
```json
{
  "evaluation_id": "eval-123",
  "release": { "id": "rel-5", "name": "2026-Q1-v2.0" },
  "auto_declined": false,
  "vulnerabilities": [
    {
      "rule_id": "rule-1",
      "rule_name": "Attic Vent",
      "description": "Ensure all vents can withstand embers",
      "triggered": true,
      "details": {
        "observed": { "attic_vent_screens": "Standard" },
        "required": "Ember Resistant",
        "explanation": "Attic vent screens are 'Standard' but must be 'Ember Resistant'"
      },
      "mitigations": [
        {
          "id": "mit-1",
          "name": "Install Ember-Rated Vents",
          "category": "full",
          "description": "Replace all vents with ember-rated vents"
        }
      ]
    },
    {
      "rule_id": "rule-3",
      "rule_name": "Window Safety Distance",
      "description": "Ensure windows can withstand heat from surrounding vegetation",
      "triggered": true,
      "details": {
        "observed": { "window_type": "Single Pane", "vegetation": [{"type": "Tree", "distance": 50}] },
        "computed_threshold": 90,
        "required": ">= 90 ft",
        "explanation": "Tree at 50ft but safe distance is 90ft (base 30 × 3 for Single Pane)"
      },
      "mitigations": [
        { "id": "mit-5", "name": "Replace with Tempered Glass", "category": "full" },
        { "id": "mit-6", "name": "Apply Film", "category": "bridge", "effect": { "type": "multiplier", "value": 0.8 } },
        { "id": "mit-7", "name": "Prune Trees", "category": "bridge", "effect": { "type": "multiplier", "value": 0.5 } }
      ]
    }
  ],
  "summary": {
    "total_vulnerabilities": 2,
    "auto_decline_vulnerabilities": 0,
    "mitigatable": 2,
    "bridge_mitigations_available": 3,
    "bridge_mitigation_limit": 3
  }
}
```

### 5.3 Rule Reference (Underwriter)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/releases/active/rules` | Get all rules from the active release in human-readable format (read-only) |
| GET | `/api/releases/:id/rules` | Get all rules from a specific release |

### 5.4 Rules (Applied Science)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rules` | List all draft rules |
| POST | `/api/rules` | Create a new rule |
| GET | `/api/rules/:id` | Get rule detail |
| PUT | `/api/rules/:id` | Update a rule |
| DELETE | `/api/rules/:id` | Delete (deactivate) a rule |
| POST | `/api/rules/:id/test` | Test a rule against sample observations |

### 5.5 Releases (Applied Science)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/releases` | List all releases |
| POST | `/api/releases` | Publish a new release (snapshots current draft rules) |
| GET | `/api/releases/:id` | Get release detail with rules |
| PUT | `/api/releases/:id/activate` | Set as active release |

### 5.6 Admin

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/settings` | Get all settings |
| PUT | `/api/settings` | Update settings (e.g., bridge limit) |
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user with role |

---

## 6. Frontend Structure

```
/client
  /src
    /components
      /ui              -- shadcn/ui base components
      /evaluation      -- Observation form, vulnerability cards, mitigation selector
      /rules           -- Rule editor, rule list, rule test interface
      /admin           -- Settings panel, user management
      /auth            -- Login form
    /pages
      /login
      /evaluate        -- Main underwriter flow
      /evaluations     -- Past evaluations list
      /rule-reference  -- Browse active rules (read-only)
      /rules           -- Rule management (Applied Science)
      /rules/test      -- Rule testing sandbox
      /admin           -- Admin settings
    /lib
      /api             -- API client functions
      /types           -- Shared TypeScript types (mirrored from backend)
    /hooks             -- Custom React hooks
```

### Key UI Screens

| Screen | User | Purpose |
|---|---|---|
| **Evaluation Form** | Underwriter | Enter property observations |
| **Evaluation Results** | Underwriter | View vulnerabilities, select mitigations |
| **Evaluation History** | Underwriter | Browse past evaluations |
| **Rule Reference** | Underwriter | Browse all active rules with descriptions and mitigation options (read-only) |
| **Rule List** | Applied Science | View/manage all draft rules |
| **Rule Editor** | Applied Science | Create/edit rules via form + JSON |
| **Rule Test Sandbox** | Applied Science | Test rules against sample observations |
| **Release Manager** | Applied Science | Publish releases, set active |
| **Admin Settings** | Admin | Configure bridge limits, manage users |

---

## 7. Project Structure

```
/mitigation-rules-engine
  /client                    -- React frontend
    /src
    package.json
  /server                    -- Express backend
    /src
      /routes                -- API route handlers
      /engine                -- Rules engine (pure functions)
        /evaluators          -- SimpleEvaluator, ConditionalEvaluator, ComputedEvaluator
        index.ts             -- Main evaluate() function
      /models                -- Prisma models
      /middleware             -- Auth, validation, error handling
      /services              -- Business logic layer
    /prisma
      schema.prisma
    package.json
  /shared                    -- Shared TypeScript types
    /types
  package.json               -- Root (workspaces)
```

---

## 8. POC Scope Boundaries

### In Scope
- 4 example rules (Attic Vent, Roof, Windows, Home-to-Home Distance)
- Full evaluation pipeline
- Mitigation selection with bridge stacking and limit enforcement
- Rule CRUD with structured form + JSON editor
- Release publishing and active release management
- Rule testing sandbox
- Role-based auth (3 roles)
- Evaluation audit trail

### Deferred
- Additional rules beyond the 4 examples (easy to add)
- State eligibility checking
- Bridge mitigation lifecycle/expiry
- Automated test cases
- Batch evaluation
- External data integrations
