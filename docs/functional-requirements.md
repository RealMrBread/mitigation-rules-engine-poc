# Mitigation Rules Engine — Functional Requirements

**Version**: 0.2 (Requirements Complete)
**Date**: 2026-03-13
**Status**: In Review

---

## 1. Overview

The Mitigation Rules Engine is a web application for a wildfire-focused property insurance company. It evaluates property observations against underwriting rules to identify vulnerabilities and suggest mitigations, enabling underwriters to assess insurability and communicate requirements to policyholders.

### 1.1 Users

| User | Description |
|---|---|
| **Underwriter** | Evaluates properties, reviews vulnerabilities and mitigations, makes underwriting decisions |
| **Applied Science** | Manages rules (create, update, delete), tests and validates rule correctness |
| **Admin** | Configures system settings including bridge mitigation limits |

### 1.2 Core Capabilities

| # | Capability | Description |
|---|---|---|
| C1 | Property Observation Processing | Accept a structured observation hash containing property details |
| C2 | Vulnerability Identification | Evaluate observations against underwriting rules, return all triggered vulnerabilities |
| C3 | Mitigation Suggestion | For each vulnerability, return applicable full and bridge mitigations |
| C4 | Bridge Mitigation Tracking | Track bridge mitigations applied per property, enforce admin-configurable limits |
| C5 | Rule Management | CRUD operations on underwriting rules |
| C6 | Rule Versioning | Point-in-time rule evaluation; policies evaluated against a locked rule version |
| C7 | Rule Testing | Validate rules against sample observations before deployment |

---

## 2. Functional Requirements

### FR-1: Property Observation Input

**FR-1.1** The system SHALL accept a structured observation hash as input for evaluation.

**FR-1.2** The observation hash SHALL support the following field types:
- **Enum fields**: Predefined set of valid values (e.g., Roof Type: Class A / Class B / Class C)
- **Numeric fields**: Measured values with defined units (e.g., distance in feet)
- **Boolean fields**: Yes/No property characteristics
- **Array fields**: Repeating groups of related observations (e.g., multiple vegetation items)

**FR-1.3** The following observation fields are known (non-exhaustive — rules may reference additional fields):

| Field | Type | Values / Units |
|---|---|---|
| Attic Vent Screens | Enum | None, Standard, Ember Resistant |
| Roof Type | Enum | Class A, Class B, Class C |
| Window Type | Enum | Single Pane, Double Pane, Tempered Glass |
| Wildfire Risk Category | Enum | A, B, C, D |
| Vegetation[] | Array | Each item: Type (Tree/Shrub/Grass), Distance to Window (feet) |
| Home-to-Home Distance | Numeric | Feet (minimum edge-to-edge between building footprints) |

**FR-1.4** Observation fields fall into two categories:
- **Globally required fields**: Must be present in every observation (e.g., state, property address). Missing globally required fields cause a validation error — the evaluation does not proceed.
- **Rule-referenced fields**: Fields that specific rules check against. If a rule-referenced field is absent from the observation, the rule is **skipped** (not evaluated), and a warning is included in the result indicating which rules were skipped and why.

**FR-1.5** The system SHALL return clear error messages for missing globally required fields, and warnings for skipped rules due to missing rule-referenced fields.

**FR-1.6** The system SHALL support manual entry of property observations via a web form.

---

### FR-2: Vulnerability Identification

**FR-2.1** The system SHALL evaluate a property observation against all applicable rules and return a list of triggered vulnerabilities.

**FR-2.2** Each vulnerability SHALL include:
- Vulnerability name
- Human-readable description of the rule (as written for policyholders)
- The functional rule logic that was evaluated
- The specific observation values that triggered the vulnerability
- Severity or category: For the POC, all vulnerabilities are treated as equal weight. No severity model. _(Post-POC: may add High/Medium/Low severity)_

**FR-2.3** A single observation MAY trigger multiple vulnerabilities.

**FR-2.4** Rules SHALL be evaluated independently — no rule depends on the output of another rule.

**FR-2.5** The system SHALL support 3 evaluation types. Any evaluation type may be mitigatable (has full/bridge mitigations) or unmitigatable (empty mitigation list → auto-decline per FR-2.6).

#### FR-2.5.1 Simple Threshold
A single observation field compared against a required value.
> Example (mitigatable): Attic Vent Screens must be "Ember Resistant"
> Example (unmitigatable): Home-to-Home Distance must be >= 15.0 ft

#### FR-2.5.2 Conditional Threshold
The pass/fail criteria for one field changes based on the value of another field.
> Example: Roof must be Class A, UNLESS Wildfire Risk Category = A, in which case Class B is acceptable.
> Functional: (Roof Type = Class A) OR (Wildfire Risk Category = A AND Roof Type IN (Class A, Class B))

#### FR-2.5.3 Computed with Modifiers
A base threshold modified by multipliers/divisors derived from observation field values. Each item in an array field is evaluated independently. Bridge mitigations apply as additional multipliers in the same formula.
> Example — Windows rule:
> - Base safe distance (Tempered Glass, Trees) = 30 ft
> - Window type modifiers: Single Pane = x3, Double Pane = x2, Tempered Glass = x1
> - Vegetation type modifiers: Trees = x1, Shrubs = /2, Grass = /3
> - Vulnerability triggered if any vegetation item's distance < computed safe distance
> - Bridge mitigations add multipliers: Film (x0.8), Prune (x0.5), stackable multiplicatively

**FR-2.6** When an unmitigatable rule is triggered, the system SHALL automatically decline the property (property is uninsurable). The evaluation result SHALL clearly indicate which rule caused the automatic decline.

---

### FR-3: Mitigation Suggestion

**FR-3.1** For each triggered vulnerability, the system SHALL return a list of applicable mitigations.

**FR-3.2** Each mitigation SHALL be categorized as one of:

| Category | Definition |
|---|---|
| **Full Mitigation** | Completely eliminates the vulnerability. After applying, the property meets underwriting standards. |
| **Bridge Mitigation** | Partially addresses the vulnerability. The property may still be underwritten, but the bridge mitigation is tracked and subject to limits. |

**FR-3.3** Each mitigation SHALL include:
- Name (e.g., "Replace Roof", "Apply Film to Windows")
- Category (Full / Bridge)
- Human-readable description
- Effect on the rule evaluation (how it changes the pass/fail outcome)

**FR-3.4** For bridge mitigations that modify computed thresholds, the system SHALL show:
- The current computed value (e.g., required safe distance = 90 ft)
- The modified value after applying the bridge (e.g., 90 ft x 0.8 = 72 ft)
- Whether the property passes after the bridge is applied

**FR-3.5** A vulnerability MAY have:
- Only full mitigations
- Only bridge mitigations
- Both full and bridge mitigations
- No mitigations (unmitigatable — see FR-2.6)

**FR-3.6** Each mitigation resolves only the single vulnerability it is associated with. Mitigations do NOT resolve multiple vulnerabilities simultaneously. If the same physical action (e.g., removing vegetation) would address multiple vulnerabilities, each vulnerability has its own distinct mitigation entry.

**FR-3.7** Multiple bridge mitigations MAY be applied to the same vulnerability. When stacked, modifiers apply multiplicatively.
> Example: For the Windows rule, applying "Apply Film" (x0.8) AND "Prune Trees" (x0.5) results in a combined modifier of 0.8 x 0.5 = 0.4 (60% reduction in required safe distance).

**FR-3.8** The system SHALL display the cumulative effect of stacked bridge mitigations, showing the intermediate and final computed values.

---

### FR-4: Bridge Mitigation Tracking & Limits

**FR-4.1** The system SHALL track all bridge mitigations applied to a property.

**FR-4.2** The system SHALL enforce a configurable maximum number of bridge mitigations per property.

**FR-4.3** An Admin user SHALL be able to configure the bridge mitigation limit (the maximum number of bridge mitigations allowed per property). This setting applies system-wide.

**FR-4.4** The system SHALL display the current bridge mitigation count and remaining allowance (based on the admin-configured limit) before the user selects a bridge mitigation.

**FR-4.5** When the bridge mitigation limit is reached, the system SHALL:
- Prevent selection of additional bridge mitigations
- Clearly communicate that the limit has been reached and what the configured limit is

**FR-4.6** For the POC, bridge mitigations are tracked as a simple count per property based on the **most recent evaluation only**. When a property is re-evaluated, previously selected mitigations do not carry over — the underwriter selects mitigations fresh, and the bridge count resets to reflect only the current evaluation's selections. _(Post-POC: may add cumulative tracking across evaluations, lifecycle states, and expiry)_

### FR-4A: Admin Configuration

**FR-4A.1** The system SHALL provide an Admin interface for configuring system settings.

**FR-4A.2** Admin-configurable settings SHALL include (at minimum):
- Bridge mitigation limit per property (integer, e.g., default 3)
- [OPEN] Additional configurable settings TBD (e.g., eligible states, severity thresholds)

---

### FR-5: Rule Management (Applied Science)

**FR-5.1** The system SHALL allow Applied Science users to create new rules.

**FR-5.2** The system SHALL allow Applied Science users to update existing rules.

**FR-5.3** The system SHALL allow Applied Science users to delete (or deactivate) rules.

**FR-5.4** Each rule definition SHALL include:
- Rule name
- Human-readable description (the "written rule")
- Functional rule logic (the evaluation criteria)
- Observation fields referenced
- Associated mitigations (with category: Full / Bridge)
- Mitigation effects (for bridge mitigations: modifier values)
- State applicability: rules are uniform across states for the POC. State determines eligibility only (insurable or not). _(Post-POC: may add state-specific rule variants)_

**FR-5.5** The system SHALL validate rule definitions for completeness and consistency before saving.

**FR-5.6** Rules SHALL be authored via a structured web form for standard rule patterns, with a JSON editor fallback for complex rules. _(POC default — can evolve to a DSL post-POC)_

---

### FR-6: Rule Versioning (Release-Based)

The system uses a release-based versioning model. Rules are grouped into immutable, named releases — the unit of audit, deployment, and evaluation.

**FR-6.1** The system SHALL support **Rule Releases**: immutable, named snapshots of the complete rule set (e.g., "2026-Q2-v3.1").

**FR-6.2** Applied Science users SHALL publish rule changes as a new release. Editing rules creates a **draft** that has no effect on production evaluations until published.

**FR-6.3** Exactly one release SHALL be designated as the **Active Release** — the default rule set used for new evaluations.

**FR-6.4** On a property's first evaluation, the system SHALL automatically lock the evaluation to the current Active Release. This is the **Policy Lock**. Subsequent re-evaluations for the same property/policy SHALL default to the locked release.

**FR-6.5** An underwriter MAY explicitly override the locked release and evaluate against a different published release. All overrides SHALL be logged in the audit trail.

**FR-6.6** The system SHALL display the release name and version used in every evaluation result.

**FR-6.7** All published releases SHALL be preserved and remain queryable indefinitely.

**FR-6.8** The system SHALL prevent deletion or modification of published releases (immutability).

---

### FR-7A: Rule Reference (Underwriter)

**FR-7A.1** The system SHALL provide a read-only Rule Reference view accessible to underwriters.

**FR-7A.2** The Rule Reference SHALL display all rules from the currently active release, including:
- Rule name
- Human-readable description (suitable for explaining to policyholders)
- All associated mitigations (full and bridge) with descriptions

**FR-7A.3** Underwriters SHALL be able to browse and search rules and their mitigations independently of running an evaluation.

**FR-7A.4** The Rule Reference SHALL indicate which release the rules belong to.

---

### FR-7: Rule Testing & Validation (Applied Science)

**FR-7.1** The system SHALL provide a testing interface where Applied Science users can run a sample observation against a rule (or rule set) and see the evaluation result.

**FR-7.2** The testing interface SHALL show:
- Which vulnerabilities were triggered
- The intermediate computation steps (e.g., computed safe distance before and after modifiers)
- Which mitigations would be suggested

**FR-7.3** The system SHALL allow testing of draft/unpublished rules without affecting production evaluations.

**FR-7.4** Automated test cases (saved observation + expected result pairs) are deferred post-POC. For the POC, Applied Science tests rules via manual observation input in the testing interface.

---

## 3. Non-Functional Requirements (for POC)

| # | Requirement |
|---|---|
| NFR-1 | Evaluation latency < 2 seconds for a single property |
| NFR-2 | Web-based UI accessible via modern browsers |
| NFR-3 | Authentication and role-based authorization required (3 roles: Underwriter, Applied Science, Admin) |
| NFR-4 | [OPEN] Number of rules for POC target (15-20 suggested) |
| NFR-5 | [OPEN] Number of states for POC target (3-5 suggested) |

---

## 4. Out of Scope (POC)

| # | Item | Notes |
|---|---|---|
| OS-1 | Batch/bulk property evaluation | Single property at a time for POC |
| OS-2 | External data integrations (GIS, mapping) | Distances entered manually |
| OS-3 | Policy lifecycle management | POC focuses on evaluation, not policy issuance |
| OS-4 | Reporting and analytics dashboards | Basic tracking only |
| OS-5 | Multi-tenant / multi-company support | Single company |
| OS-6 | Regulatory compliance workflows | Awareness only, no formal compliance |

---

## 5. Resolved Questions

| # | Question | Resolution |
|---|---|---|
| OQ-1 | Can bridge mitigations stack on the same vulnerability? | **Yes** — modifiers stack multiplicatively |
| OQ-2 | Bridge limit model? | **Admin-configurable** per-property global limit |
| OQ-3 | Unmitigatable rule outcome? | **Auto-decline** — property is uninsurable |
| OQ-4 | Can one mitigation resolve multiple vulnerabilities? | **No** — each mitigation is scoped to a single vulnerability |
| OQ-5 | Do rules depend on other rules' output? | **Independent** — each rule evaluates on its own |
| OQ-9 | Input method for POC? | **Web form** only |
| OQ-7 | Rule version locking model? | **Release-based** — immutable named releases, auto policy lock on first eval, explicit override with audit trail |
| OQ-10 | Auth/roles needed for POC? | **Yes** — 3 roles: Underwriter, Applied Science, Admin |

## 6. POC Defaults (revisit post-POC)

| # | Question | POC Default |
|---|---|---|
| OQ-6 | Rule authoring format | Structured form + JSON editor fallback |
| OQ-8 | Bridge mitigation lifecycle | Simple count tracking, no expiry/states |
| OQ-11 | State-specific rules | Uniform rules; state = eligibility only |
| OQ-12 | Automated test cases | Deferred; manual testing via UI |
