# Mitigation Rules Engine — High-Level Design

**Version**: 1.0
**Date**: 2026-03-13
**Author**: Backend Architecture Review

---

## 1. Requirements Assessment

### 1.1 Gaps, Ambiguities, and Risks

| # | Area | Issue | Severity | Recommendation |
|---|------|-------|----------|----------------|
| G-1 | FR-2.2 | Severity model is marked OPEN. Without severity, all vulnerabilities are equal weight. This affects underwriter prioritization and potentially the auto-decline logic. | Medium | For POC, define a simple enum (High/Medium/Low) or defer entirely. If deferred, document that all vulnerabilities are treated equally. Do not leave it ambiguous. |
| G-2 | FR-1.4 | "Required fields for applicable rules" — who defines which fields are required? If a rule references `attic_vent_screens` but the observation omits it, is that a validation error or does the rule simply not apply? | High | **RESOLVED**: Two categories: (1) globally required fields → validation error, (2) rule-referenced fields → rule skipped with warning. Updated in FR-1.4. |
| G-3 | FR-6.4 | Policy Lock ties a property to a release on first evaluation. But what entity is "property"? There is no `properties` table in the data model. `evaluations` has `property_id` but it is not a foreign key to anything. | High | **RESOLVED**: Added `policy_locks` table (property_id VARCHAR unique, release_id FK, locked_at, locked_by). property_id is an opaque user-provided identifier. Updated in architecture data model. |
| G-4 | FR-4.6 | Bridge mitigation count is "per property" but the data model tracks mitigations per evaluation (`evaluation_mitigations`). If a property is re-evaluated, do previously selected bridges carry over? Are they re-counted? | High | **RESOLVED**: Per-latest-evaluation for POC. Re-evaluation resets mitigation selections; bridge count reflects only the current evaluation. Updated in FR-4.6. |
| G-5 | FR-5.4 | "State applicability: rules are uniform across states" — but NFR-5 mentions 3-5 states for POC. If rules are uniform, what role do states play? | Low | Clarify: states determine property eligibility (can we insure in this state at all?), not rule variation. This should be a simple lookup table, not part of the rules engine. |
| G-6 | FR-6.2 | Draft editing model is unclear. Can multiple Applied Science users edit drafts concurrently? Is there a single shared draft workspace or per-user drafts? | Medium | Recommend a single shared draft workspace (simplest for POC). Add optimistic locking (version column) on the `rules` table to prevent silent overwrites. |
| G-7 | FR-3.4 | Bridge mitigation display requirements reference "current computed value" and "modified value" — but for Simple Threshold and Conditional Threshold rules, bridge mitigations don't have a numeric modifier model. | Medium | **RESOLVED**: Expanded `BridgeEffect` to a discriminated union: `{ type: "multiplier", value: number }` for computed rules, `{ type: "override", value: string \| number }` for simple/conditional rules. Updated in architecture type definitions. |
| G-8 | FR-2.5.3 | The computed rule example shows modifiers from both the observation (window type, vegetation type) AND bridge mitigations feeding into the same formula. But the architecture separates these — observation modifiers are in `ComputedConfig.modifiers` and bridge effects are in `Mitigation.effect`. The evaluation must merge them. | Medium | Document this merge explicitly in the evaluator contract. See Section 2.4 for the proposed algorithm. |
| G-9 | API | `POST /api/evaluate` creates an evaluation record AND returns results in one call. But mitigation selection is a separate `POST /api/evaluate/:id/mitigations`. What if the underwriter abandons the evaluation? We accumulate orphan evaluation records. | Low | Acceptable for POC. Post-POC, consider a two-phase model or TTL cleanup for evaluations without mitigation selections. |
| G-10 | Data Model | `release_rules` has no `id` column and no `rule_id` reference — just `release_id` + `rule_snapshot`. This makes it impossible to correlate a vulnerability result back to a specific release_rule row without parsing the snapshot JSON. | Medium | Add a surrogate `id` and preserve the original `rule_id` as a column (not just inside the JSON) for efficient joins and lookups. |

### 1.2 Rule Type System Assessment

The three evaluation types (simple threshold, conditional threshold, computed with modifiers) are **sufficient for the POC** but have the following edge cases:

**Covered well:**
- Single-field comparisons (simple threshold)
- Two-field dependent logic (conditional threshold)
- Numeric formulas with array iteration (computed with modifiers)

**Edge cases the type system cannot handle:**
1. **Multi-field boolean logic beyond two fields** — A rule like "IF risk_category = D AND roof_type = C AND vegetation distance < 20ft THEN fail" requires either nesting conditional thresholds (not supported) or a new composite type. **Recommendation**: For POC, model these as separate rules. Post-POC, consider adding a `"composite"` type or a lightweight expression language.
2. **Cross-array-item logic** — "Fail if there are more than 3 vegetation items within 50ft" requires aggregation across array items, not per-item evaluation. The current computed type evaluates each item independently. **Recommendation**: Flag as a known limitation. If needed, add an `"aggregation"` type post-POC.
3. **Relative comparisons between fields** — "Distance to neighbor must be >= 2x the height of the tallest adjacent structure" compares two observation fields dynamically. Not expressible in current types. **Recommendation**: Low priority for wildfire use case, but note the limitation.

### 1.3 Data Model Completeness

**Missing entities:**
- `policy_locks` — needed for FR-6.4 (see G-3 above)
- `audit_log` — FR-6.5 requires logging release overrides; the current model has no dedicated audit table
- `rule_id` on `release_rules` — for efficient lookups (see G-10)

**Missing relationships:**
- `evaluation_mitigations` references `rule_id` and `mitigation_id`, but mitigations are embedded in rule JSON, not a separate table. The `mitigation_id` is a JSON-internal ID with no referential integrity. This is acceptable for POC if mitigation IDs are UUIDs generated at rule creation time.

### 1.4 Requirements-Architecture Consistency Issues

| Issue | Details |
|-------|---------|
| Missing property_id management | FR-4.1 tracks bridges "per property" but architecture has no property entity or API for property management |
| Rule Reference API incomplete | FR-7A.3 requires search/browse capability but API only has list endpoints, no search/filter parameters |
| No release diff capability | FR-6.2 implies Applied Science needs to see what changed before publishing. No API or UI support for comparing draft vs. last published release |
| SimpleConfig missing pass semantics | The `SimpleConfig` defines what to check but not the pass direction. `operator: "eq", value: "Ember Resistant"` — does the rule PASS when equal (observation meets requirement) or FAIL when equal (observation triggers vulnerability)? The architecture must clarify: **the rule triggers (vulnerability fires) when the condition is NOT met**. This means the config defines the passing condition, and the evaluator negates it. |

---

## 2. High-Level Design

### 2.1 Component Diagram

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
│                        API Gateway Layer                            │
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
│  │  │ Bridge     │  │    │               │               │         │
│  │  │ Stacker    │  │    │               │               │         │
│  │  └────────────┘  │    │               │               │         │
│  └──────────────────┘    │               │               │         │
│         │                │               │               │         │
└─────────┼────────────────┼───────────────┼───────────────┼─────────┘
          │                │               │               │
          ▼                ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Access Layer                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Prisma ORM Client                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  PostgreSQL                                                         │
│  ┌────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────┐         │
│  │ rules  │ │ releases │ │release_rules │ │ evaluations │         │
│  └────────┘ └──────────┘ └──────────────┘ └─────────────┘         │
│  ┌──────────────────────┐ ┌──────────────┐ ┌────────────┐         │
│  │evaluation_mitigations│ │policy_locks  │ │  settings  │         │
│  └──────────────────────┘ └──────────────┘ └────────────┘         │
│  ┌────────┐ ┌────────────┐                                         │
│  │ users  │ │ audit_log  │                                         │
│  └────────┘ └────────────┘                                         │
└─────────────────────────────────────────────────────────────────────┘
```

Key additions over the original architecture:
- **Evaluator Registry** — dispatches rules to the correct evaluator by type (see 2.2)
- **Bridge Stacker** — isolated component for computing stacked bridge effects (see 2.4)
- **Policy Locks table** — explicit entity for release locking per property
- **Audit Log table** — captures release overrides and admin changes

### 2.2 Rule Engine Internals

**Recommended pattern: Registry + Strategy**

The evaluator dispatch should use a **registry of strategy implementations**, not a switch statement. This ensures extensibility without modifying the core engine.

```
EvaluatorRegistry
  ├── register(type: string, evaluator: Evaluator)
  ├── get(type: string): Evaluator
  └── evaluate(rule: Rule, observations: Observations): EvalResult

Evaluator (interface)
  ├── evaluate(config, observations): EvalResult
  └── validate(config): ValidationResult     // Validates rule config at authoring time
```

**Implementation approach:**

```typescript
// Registry — initialized once at application startup
const registry = new EvaluatorRegistry();
registry.register("simple_threshold", new SimpleThresholdEvaluator());
registry.register("conditional_threshold", new ConditionalThresholdEvaluator());
registry.register("computed_with_modifiers", new ComputedWithModifiersEvaluator());

// Main evaluate function
function evaluate(observations: Observations, rules: Rule[]): EvaluationResult {
  const results = rules.map(rule => {
    const evaluator = registry.get(rule.type);
    if (!evaluator) throw new UnknownRuleTypeError(rule.type);
    return {
      rule,
      result: evaluator.evaluate(rule.config, observations)
    };
  });
  // ... collect vulnerabilities, check auto-decline, etc.
}
```

**Why Registry + Strategy over alternatives:**
- **vs. switch/if-else**: Adding a new rule type requires only implementing the interface and registering it. No core engine changes.
- **vs. plugin/dynamic loading**: Overkill for POC. Registry gives the same extensibility with compile-time safety.
- **Validation at authoring time**: Each evaluator also validates its own config shape, so Applied Science gets errors when creating rules, not at evaluation time.

### 2.3 Release Publishing Flow

**Step-by-step: Applied Science publishes a release**

```
1. Applied Science clicks "Publish Release"
   │
   ├─ Frontend sends POST /api/releases
   │   body: { name: "2026-Q2-v3.1" }
   │
   ▼
2. Release Service: Validate release name
   │  - Must be unique
   │  - Must follow naming convention (optional for POC)
   │
   ▼
3. Release Service: Load all current draft rules
   │  - SELECT * FROM rules
   │  - Validate every rule config using the evaluator registry
   │  - If ANY rule fails validation → reject publish with errors
   │
   ▼
4. Release Service: BEGIN TRANSACTION
   │
   ├─ 4a. INSERT INTO releases (name, published_at, published_by, is_active)
   │       VALUES ('2026-Q2-v3.1', NOW(), user_id, false)
   │       → returns release_id
   │
   ├─ 4b. For each draft rule:
   │       INSERT INTO release_rules (id, release_id, rule_id, rule_snapshot)
   │       VALUES (uuid, release_id, rule.id, serialize(rule))
   │       → rule_snapshot is a deep copy of the entire rule JSON
   │
   ├─ 4c. COMMIT TRANSACTION
   │
   ▼
5. Release is created but NOT active
   │  - Applied Science can review the release contents
   │  - Applied Science can test against it
   │
   ▼
6. Applied Science clicks "Activate Release"
   │
   ├─ PUT /api/releases/:id/activate
   │
   ▼
7. Release Service: BEGIN TRANSACTION
   │
   ├─ 7a. UPDATE releases SET is_active = false WHERE is_active = true
   │
   ├─ 7b. UPDATE releases SET is_active = true WHERE id = :id
   │
   ├─ 7c. INSERT INTO audit_log (action, entity_type, entity_id, user_id, details)
   │       VALUES ('activate_release', 'release', :id, user_id, {...})
   │
   ├─ 7d. COMMIT TRANSACTION
   │
   ▼
8. New evaluations now use the newly activated release
   │  - Existing policy-locked evaluations are unaffected
   │  - In-flight evaluations that already loaded the old release continue with it
```

**Key design decisions:**
- Publishing and activating are **separate steps**. This allows Applied Science to review a published release before making it live.
- Snapshot is a **full deep copy**, not a reference. This guarantees immutability even if draft rules are later modified.
- Validation runs at publish time, not just at rule save time. This catches cross-rule issues (e.g., duplicate rule names).

### 2.4 Bridge Stacking Computation

**Algorithm for computing stacked bridge mitigations on computed rules:**

```
Input:
  - rule: ComputedConfig (base_value, modifiers[], comparison_field, comparison_operator)
  - observation: the property observation hash
  - selected_bridges: BridgeEffect[] (multiplier values the underwriter has selected)

Algorithm:

1. COMPUTE observation_modifier_product = 1.0
   FOR each modifier in rule.modifiers:
     observed_value = observation[modifier.field]
     multiplier = modifier.mapping[observed_value]
     IF modifier.operation == "multiply":
       observation_modifier_product *= multiplier
     ELSE IF modifier.operation == "divide":
       observation_modifier_product /= multiplier

2. COMPUTE base_threshold = rule.base_value * observation_modifier_product
   // e.g., 30 (base) * 3 (Single Pane) * 1 (Trees) = 90 ft

3. COMPUTE bridge_modifier_product = 1.0
   FOR each bridge in selected_bridges:
     bridge_modifier_product *= bridge.value
   // e.g., 0.8 (Film) * 0.5 (Prune) = 0.4

4. COMPUTE final_threshold = base_threshold * bridge_modifier_product
   // e.g., 90 * 0.4 = 36 ft

5. COMPARE actual_value = observation[rule.comparison_field]
   passes = (actual_value comparison_operator final_threshold)
   // e.g., 50 >= 36 → PASSES with bridges applied

6. RETURN {
     base_threshold,                    // 90 ft
     bridge_modifier_product,           // 0.4
     final_threshold,                   // 36 ft
     actual_value,                      // 50 ft
     passes,                            // true
     breakdown: [                       // For UI display
       { bridge: "Apply Film", modifier: 0.8, running_threshold: 72 },
       { bridge: "Prune Trees", modifier: 0.5, running_threshold: 36 }
     ]
   }
```

**For array fields** (e.g., vegetation[]):
- Steps 1-5 are executed **per array item**, because each item may have different modifier values (e.g., Tree vs Shrub).
- The rule triggers if **any** array item fails (even after bridges are applied).
- Bridge modifiers apply uniformly across all array items (a bridge like "Apply Film" reduces the threshold for every vegetation item equally).

**Important edge case:** If the underwriter selects bridges that make some array items pass but not all, the UI must clearly show which items still fail. The `breakdown` should be per-item.

### 2.5 Concurrency Considerations

**Scenario 1: Two underwriters evaluate the same property simultaneously**

- Evaluations are **read-heavy, write-light**. The evaluation itself is a pure function over a snapshot of rules + observations. Two concurrent evaluations will produce identical results (given the same release and observations), so this is safe.
- The race condition is on **mitigation selection**: both underwriters might select mitigations, and the bridge count could exceed the limit.
- **Mitigation**: Use `SELECT ... FOR UPDATE` on the property's bridge count when selecting mitigations. Wrap mitigation selection in a transaction that checks the bridge limit atomically.

```sql
BEGIN;
  SELECT COUNT(*) as bridge_count
  FROM evaluation_mitigations em
  JOIN evaluations e ON e.id = em.evaluation_id
  WHERE e.property_id = :property_id AND em.category = 'bridge'
  FOR UPDATE;

  -- Check bridge_count + new_bridges <= limit
  -- If OK, INSERT new mitigations
  -- If not, ROLLBACK with error
COMMIT;
```

**Scenario 2: Applied Science publishes a release while an evaluation is in flight**

- The evaluation loaded its rule set at the start of the request. Publishing a new release (or activating it) does not affect in-flight evaluations because the rule data is already in memory.
- The policy lock is set on first evaluation, not on release activation. Even if a new release is activated between the evaluation starting and finishing, the evaluation result is tied to the release that was loaded.
- **No special handling needed** — the release-based snapshot model naturally isolates in-flight evaluations.

**Scenario 3: Two Applied Science users edit the same draft rule concurrently**

- Without protection, the last writer wins silently.
- **Mitigation**: Add an `updated_at` or `version` column to the `rules` table. On update, include the expected version in the request. If it doesn't match, return a 409 Conflict.

### 2.6 Error Handling Strategy

| Scenario | Handling |
|----------|----------|
| **Partial rule failure** (one rule throws during evaluation) | Log the error. Include the failed rule in the result with `status: "error"` and an error message. Do NOT abort the entire evaluation — return results for all other rules. The underwriter needs to see what succeeded. Flag the evaluation as having partial failures. |
| **Invalid rule config** (bad JSON, missing fields) | Catch at two points: (1) at rule save time via evaluator-specific validation, (2) at release publish time via full validation pass. If somehow an invalid config reaches evaluation (shouldn't happen), treat as a partial rule failure. |
| **Missing observation fields** | Per G-2 above: if a rule references a field not present in the observation, **skip the rule** and include it in the result with `status: "skipped"` and a message listing the missing fields. Do not fail the entire evaluation. The underwriter can re-submit with the missing fields. |
| **Bridge limit exceeded** | Return a 422 with a clear message: "Bridge mitigation limit reached. Current: X, Limit: Y. Remove an existing bridge mitigation before adding a new one." |
| **Release not found** | Return 404. If the active release is somehow missing (no release activated), return 503 with "No active release configured. Contact Applied Science." |
| **Concurrency conflict** (rule version mismatch) | Return 409 Conflict with the current version and a message to reload. |

**General error response format:**

```json
{
  "error": {
    "code": "BRIDGE_LIMIT_EXCEEDED",
    "message": "Bridge mitigation limit reached (3/3). Remove an existing bridge before adding a new one.",
    "details": { "current": 3, "limit": 3 }
  }
}
```

---

## 3. Data Flow Diagrams

### 3.1 Evaluation Flow (observation in -> result out)

```
Underwriter                    API                     Engine                    Database
    │                           │                        │                          │
    │  POST /api/evaluate       │                        │                          │
    │  { observations, null }   │                        │                          │
    │ ─────────────────────────>│                        │                          │
    │                           │                        │                          │
    │                           │  Resolve release_id    │                          │
    │                           │  (null → active)       │                          │
    │                           │───────────────────────────────────────────────────>│
    │                           │                        │      active release_id   │
    │                           │<───────────────────────────────────────────────────│
    │                           │                        │                          │
    │                           │  Check policy lock     │                          │
    │                           │  for property_id       │                          │
    │                           │───────────────────────────────────────────────────>│
    │                           │                        │   lock (or none)         │
    │                           │<───────────────────────────────────────────────────│
    │                           │                        │                          │
    │                           │  Load rule snapshots   │                          │
    │                           │  for release_id        │                          │
    │                           │───────────────────────────────────────────────────>│
    │                           │                        │   Rule[]                 │
    │                           │<───────────────────────────────────────────────────│
    │                           │                        │                          │
    │                           │  evaluate(obs, rules)  │                          │
    │                           │───────────────────────>│                          │
    │                           │                        │                          │
    │                           │                   For each rule:                  │
    │                           │                   ┌─────────────────────┐         │
    │                           │                   │ registry.get(type)  │         │
    │                           │                   │ evaluator.evaluate()│         │
    │                           │                   │ collect results     │         │
    │                           │                   └─────────────────────┘         │
    │                           │                        │                          │
    │                           │                   Check auto-decline              │
    │                           │                   (any unmitigatable              │
    │                           │                    vulnerability?)                │
    │                           │                        │                          │
    │                           │   EvaluationResult     │                          │
    │                           │<──────────────────────-│                          │
    │                           │                        │                          │
    │                           │  Save evaluation       │                          │
    │                           │  (obs + result)        │                          │
    │                           │───────────────────────────────────────────────────>│
    │                           │                        │                          │
    │                           │  Create policy lock    │                          │
    │                           │  (if first eval)       │                          │
    │                           │───────────────────────────────────────────────────>│
    │                           │                        │                          │
    │   Evaluation response     │                        │                          │
    │   (vulnerabilities,       │                        │                          │
    │    mitigations, details)  │                        │                          │
    │ <─────────────────────────│                        │                          │
```

### 3.2 Rule Management Flow (draft -> test -> publish -> activate)

```
Applied Science            API                    Database
    │                       │                        │
    │  POST /api/rules      │                        │
    │  { rule definition }  │                        │
    │ ─────────────────────>│                        │
    │                       │  Validate config       │
    │                       │  via evaluator.validate()
    │                       │                        │
    │                       │  INSERT rule (draft)   │
    │                       │───────────────────────>│
    │   Rule created        │                        │
    │ <─────────────────────│                        │
    │                       │                        │
    │  POST /api/rules/:id/test                      │
    │  { sample observations }                       │
    │ ─────────────────────>│                        │
    │                       │  Load draft rule       │
    │                       │  evaluate(obs, [rule]) │
    │                       │                        │
    │   Test result         │                        │
    │   (triggered? details)│                        │
    │ <─────────────────────│                        │
    │                       │                        │
    │  ... iterate on rule until satisfied ...        │
    │                       │                        │
    │  POST /api/releases   │                        │
    │  { name: "Q2-v3.1" } │                        │
    │ ─────────────────────>│                        │
    │                       │  BEGIN TRANSACTION     │
    │                       │  Load all draft rules  │
    │                       │  Validate ALL rules    │
    │                       │  Snapshot each rule    │
    │                       │  INSERT release        │
    │                       │  INSERT release_rules  │
    │                       │  COMMIT                │
    │                       │───────────────────────>│
    │   Release published   │                        │
    │   (not yet active)    │                        │
    │ <─────────────────────│                        │
    │                       │                        │
    │  PUT /api/releases/:id/activate                │
    │ ─────────────────────>│                        │
    │                       │  BEGIN TRANSACTION     │
    │                       │  Deactivate old release│
    │                       │  Activate new release  │
    │                       │  Write audit log       │
    │                       │  COMMIT                │
    │                       │───────────────────────>│
    │   Release activated   │                        │
    │ <─────────────────────│                        │
```

### 3.3 Mitigation Selection Flow

```
Underwriter                API                         Database
    │                       │                             │
    │  (Viewing evaluation  │                             │
    │   results with        │                             │
    │   vulnerabilities)    │                             │
    │                       │                             │
    │  POST /api/evaluate/:id/mitigations                 │
    │  { selections: [      │                             │
    │    { rule_id, mitigation_id, category },            │
    │    { rule_id, mitigation_id, category },            │
    │  ]}                   │                             │
    │ ─────────────────────>│                             │
    │                       │                             │
    │                       │  Load evaluation            │
    │                       │──────────────────────────  >│
    │                       │                             │
    │                       │  Validate selections:       │
    │                       │  1. Each rule_id exists in  │
    │                       │     evaluation result       │
    │                       │  2. Each mitigation_id is   │
    │                       │     valid for that rule     │
    │                       │  3. Categories match        │
    │                       │                             │
    │                       │  Count bridges (with lock)  │
    │                       │  SELECT count(*) FROM       │
    │                       │  evaluation_mitigations     │
    │                       │  WHERE property_id AND      │
    │                       │  category = 'bridge'        │
    │                       │  FOR UPDATE                 │
    │                       │──────────────────────────  >│
    │                       │                             │
    │                       │  Check: current_bridges +   │
    │                       │  new_bridges <= limit       │
    │                       │                             │
    │                       │  For computed rules with    │
    │                       │  bridge selections:         │
    │                       │  Re-compute threshold with  │
    │                       │  stacked bridges (Sec 2.4)  │
    │                       │  Store computed results     │
    │                       │                             │
    │                       │  INSERT mitigations         │
    │                       │──────────────────────────  >│
    │                       │                             │
    │   Mitigations saved   │                             │
    │   { bridge_count: 2,  │                             │
    │     bridge_limit: 3,  │                             │
    │     computed_effects:  │                             │
    │     [...] }           │                             │
    │ <─────────────────────│                             │
```

---

## 4. Risk Assessment

### 4.1 Biggest Technical Risks for the POC

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-1 | **Rule config schema drift** — As Applied Science creates rules, the JSON configs may diverge from the expected schema, causing runtime errors during evaluation. | High | High | Implement strict JSON schema validation per rule type. Each evaluator must have a `validate()` method that runs at save and publish time. Consider using Zod schemas shared between frontend and backend. |
| R-2 | **Bridge stacking produces unreasonable thresholds** — Multiplicative stacking can reduce thresholds to near-zero (e.g., 0.1 * 0.2 * 0.3 = 0.006x), effectively nullifying the rule. | Medium | Medium | Add a configurable minimum threshold floor per rule (e.g., "bridge modifiers cannot reduce threshold below 20% of base"). This is not in the requirements but should be discussed with Applied Science. |
| R-3 | **Policy lock ambiguity** — Without a clear property identity model, policy locks may be inconsistent. What if the same physical property gets different property_ids across evaluations? | Medium | High | Define a canonical property identifier. For POC, accept that property_id is user-provided and trust it. Document the assumption. |
| R-4 | **Rule authoring UX complexity** — Computed rules with modifiers are complex. Applied Science may struggle to author them correctly via a form + JSON editor. | High | Medium | Invest in a good rule preview/test cycle. Show a live computed example as the user edits modifier values. The testing sandbox (FR-7) is critical — prioritize it. |
| R-5 | **Snapshot storage growth** — Every release copies every rule. With 20 rules and frequent releases, this grows linearly but is manageable for POC. | Low | Low | Acceptable for POC. Post-POC, consider delta-based storage or deduplication. |

### 4.2 Performance Concerns at Scale (100s of rules)

| Concern | Analysis | Recommendation |
|---------|----------|----------------|
| **Evaluation latency** | 100 rules, each a simple JSON comparison, should evaluate in < 50ms. Computed rules with array iteration are slower but still sub-100ms each. The 2-second NFR-1 target is achievable. | No concern for POC. If post-POC rules reach 500+, consider parallel evaluation or rule pre-filtering based on observation fields present. |
| **Rule set loading** | Loading 100 rule snapshots (each ~1-2KB of JSON) from Postgres is ~200KB, well within acceptable response times. | Cache the active release's rule set in memory. Invalidate on release activation. Avoids a DB round-trip per evaluation. |
| **Release snapshot size** | 100 rules x 2KB = 200KB per release. 50 releases = 10MB. Trivial. | No concern. |
| **Bridge count queries** | Per-property bridge count requires scanning `evaluation_mitigations` joined with `evaluations`. Without an index, this could slow down at scale. | Add a composite index on `evaluations(property_id)` and `evaluation_mitigations(evaluation_id, category)`. |

### 4.3 Implementation Watch-Outs

1. **Test the engine in isolation first.** The rules engine should be a pure function with no database dependencies. Write unit tests for each evaluator type before integrating with the API layer. This is the highest-risk component.

2. **Define the pass/fail semantics clearly.** The architecture's `SimpleConfig` is ambiguous about whether the config defines the passing condition or the failing condition. Pick one convention and enforce it everywhere. Recommendation: **config defines the passing condition; the evaluator reports a vulnerability when the condition is NOT met.**

3. **Bridge effect types will expand.** The current `BridgeEffect` only supports `"multiplier"`. Simple/conditional rules will need different effect types (e.g., `"value_override"` to change the required value, or `"exempt"` to suppress the vulnerability entirely). Design the `BridgeEffect` type as a discriminated union from the start.

4. **Frontend form validation must mirror backend.** With TypeScript end-to-end, share Zod schemas or similar validation logic between client and server. Duplicate validation is a bug magnet.

5. **Seed data is critical for demos.** Create a seed script with the 4 example rules (Attic Vent, Roof, Windows, Home-to-Home Distance), a published release, and sample observations. This accelerates both development and stakeholder demos.

6. **Do not over-engineer the auth.** JWT + bcrypt with 3 hardcoded roles is sufficient. Do not build a full RBAC system. Store role as a string enum on the user record.

---

## Appendix A: Proposed Data Model Additions

```sql
-- Add to the existing model:

CREATE TABLE policy_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id VARCHAR(255) NOT NULL,
  release_id UUID NOT NULL REFERENCES releases(id),
  locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  locked_by UUID NOT NULL REFERENCES users(id),
  UNIQUE(property_id)  -- One lock per property
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,       -- e.g., 'activate_release', 'override_lock', 'update_setting'
  entity_type VARCHAR(50) NOT NULL,   -- e.g., 'release', 'evaluation', 'setting'
  entity_id VARCHAR(255),
  user_id UUID NOT NULL REFERENCES users(id),
  details JSONB,                      -- Action-specific context
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add to release_rules:
ALTER TABLE release_rules ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE release_rules ADD COLUMN rule_id UUID NOT NULL;  -- Original draft rule ID for correlation

-- Add optimistic locking to rules:
ALTER TABLE rules ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```

## Appendix B: Recommended Implementation Order

1. **Phase 1 — Engine core** (no API, no UI)
   - Rule type definitions + Zod schemas
   - Evaluator registry + 3 evaluators
   - Bridge stacking computation
   - Unit tests with the 4 example rules

2. **Phase 2 — Data layer + API**
   - Prisma schema + migrations
   - Seed script (4 rules, 1 release, sample users)
   - Evaluation API (POST /evaluate, GET /evaluations)
   - Rule CRUD API
   - Release publish + activate API

3. **Phase 3 — Frontend**
   - Auth (login page, JWT storage, role-based routing)
   - Evaluation form + results display
   - Mitigation selection with bridge stacking UI
   - Rule editor (form + JSON)
   - Rule testing sandbox
   - Release manager

4. **Phase 4 — Polish**
   - Rule Reference view (underwriter)
   - Admin settings
   - Evaluation history
   - Error handling + edge cases
