# Mitigation Rules Engine — Architecture Diagrams

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + TypeScript)            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Evaluation  │  │    Rule     │  │  Admin   │  │   Auth    │ │
│  │    Flow     │  │  Manager   │  │  Panel   │  │   Login   │ │
│  │             │  │            │  │          │  │           │ │
│  │ - Obs Form  │  │ - CRUD     │  │ - Bridge │  │ - Login   │ │
│  │ - Results   │  │ - Editor   │  │   Limits │  │ - Roles   │ │
│  │ - History   │  │ - Test     │  │ - Users  │  │           │ │
│  │ - Mitigate  │  │ - Releases │  │          │  │           │ │
│  └──────┬──────┘  └──────┬─────┘  └────┬─────┘  └─────┬─────┘ │
└─────────┼────────────────┼─────────────┼───────────────┼───────┘
          │                │             │               │
          ▼                ▼             ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REST API (Node.js + Express + TypeScript)      │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────┐ │
│  │ /api/       │  │ /api/       │  │ /api/    │  │ /api/     │ │
│  │ evaluate    │  │ rules       │  │ settings │  │ auth      │ │
│  │ evaluations │  │ releases    │  │ users    │  │           │ │
│  └──────┬──────┘  └──────┬─────┘  └────┬─────┘  └─────┬─────┘ │
│         │                │             │               │        │
│         ▼                │             │               │        │
│  ┌─────────────────┐     │             │               │        │
│  │  RULES ENGINE   │     │             │               │        │
│  │  (Pure Functions)│     │             │               │        │
│  │                  │     │             │               │        │
│  │ ┌──────────────┐│     │             │               │        │
│  │ │  Evaluators  ││     │             │               │        │
│  │ │ - Simple     ││     │             │               │        │
│  │ │ - Conditional││     │             │               │        │
│  │ │ - Computed   ││     │             │               │        │
│  │ └──────────────┘│     │             │               │        │
│  └─────────────────┘     │             │               │        │
│                          │             │               │        │
│  ┌───────────────────────┴─────────────┴───────────────┴──────┐ │
│  │                    MIDDLEWARE                                │ │
│  │         Auth (JWT) · Role Check · Validation                │ │
│  └─────────────────────────────┬──────────────────────────────┘ │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL DATABASE                         │
│                                                                  │
│  ┌─────────┐ ┌─────────┐ ┌───────────────┐ ┌───────────────┐   │
│  │  users  │ │  rules  │ │   releases    │ │  evaluations  │   │
│  │         │ │ (draft) │ │               │ │               │   │
│  │ - email │ │ - name  │ │ - name        │ │ - property_id │   │
│  │ - role  │ │ - type  │ │ - is_active   │ │ - release_id  │   │
│  │ - hash  │ │ - config│ │ - published_at│ │ - observations│   │
│  │         │ │ (JSONB) │ │               │ │ - result      │   │
│  └─────────┘ └─────────┘ └───────┬───────┘ └───────┬───────┘   │
│                                  │                  │           │
│                           ┌──────┴──────┐    ┌──────┴────────┐  │
│                           │release_rules│    │  evaluation   │  │
│                           │ (snapshots) │    │  _mitigations │  │
│                           │             │    │               │  │
│                           │-rule_snapshot│    │- mitigation_id│  │
│                           │ (JSONB)     │    │- category     │  │
│                           └─────────────┘    └───────────────┘  │
│                                                                  │
│  ┌───────────┐                                                   │
│  │ settings  │                                                   │
│  │ - key     │                                                   │
│  │ - value   │                                                   │
│  └───────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Evaluation Flow (Core Workflow)

```
  UNDERWRITER                    SYSTEM                         DATABASE
      │                            │                               │
      │  1. Submit Observations    │                               │
      │  (+ optional release_id)   │                               │
      ├───────────────────────────►│                               │
      │                            │  2. Load Rule Set             │
      │                            │  (by release or active)       │
      │                            ├──────────────────────────────►│
      │                            │◄──────────────────────────────┤
      │                            │                               │
      │                            │  3. Validate Observations     │
      │                            │  (check required fields)      │
      │                            │                               │
      │                            │  4. For each rule:            │
      │                            │  ┌─────────────────────────┐  │
      │                            │  │ Dispatch to evaluator:  │  │
      │                            │  │ Simple / Conditional /  │  │
      │                            │  │ Computed                │  │
      │                            │  │                         │  │
      │                            │  │ Returns:                │  │
      │                            │  │ - triggered (bool)      │  │
      │                            │  │ - details (explanation) │  │
      │                            │  │ - mitigations list      │  │
      │                            │  └─────────────────────────┘  │
      │                            │                               │
      │                            │  5. Check auto-decline        │
      │                            │  (any unmitigatable fail?)    │
      │                            │                               │
      │                            │  6. Save evaluation           │
      │                            ├──────────────────────────────►│
      │                            │                               │
      │  7. Return results         │                               │
      │  (vulnerabilities +        │                               │
      │   mitigations + summary)   │                               │
      │◄───────────────────────────┤                               │
      │                            │                               │
      │  8. Select mitigations     │                               │
      │  (full / bridge)           │                               │
      ├───────────────────────────►│                               │
      │                            │  9. Validate bridge limits    │
      │                            │  10. Save selections          │
      │                            ├──────────────────────────────►│
      │  11. Confirmation          │                               │
      │◄───────────────────────────┤                               │
```

## 3. Rule Lifecycle (Applied Science → Production)

```
  APPLIED SCIENCE                    SYSTEM                    UNDERWRITER
      │                                │                           │
      │  Create / Edit Rules           │                           │
      │  (draft workspace)             │                           │
      ├───────────────────────────────►│                           │
      │                                │                           │
      │  Test Rule                     │                           │
      │  (sample observations)         │                           │
      ├───────────────────────────────►│                           │
      │◄───────────────────────────────┤                           │
      │  (test results, no DB impact)  │                           │
      │                                │                           │
      │  Publish Release               │                           │
      │  ("2026-Q2-v3.1")             │                           │
      ├───────────────────────────────►│                           │
      │                                │                           │
      │                    ┌───────────┴───────────┐               │
      │                    │  Snapshot all draft    │               │
      │                    │  rules into immutable  │               │
      │                    │  release_rules         │               │
      │                    └───────────┬───────────┘               │
      │                                │                           │
      │  Activate Release              │                           │
      ├───────────────────────────────►│                           │
      │                                │                           │
      │                    ┌───────────┴───────────┐               │
      │                    │  Set as Active Release │               │
      │                    │  (new evals use this)  │               │
      │                    └───────────┬───────────┘               │
      │                                │                           │
      │                                │  New evaluations now      │
      │                                │  use this release         │
      │                                ├──────────────────────────►│
      │                                │                           │
      │  Continue editing drafts       │                           │
      │  (no impact on production)     │                           │
      ├───────────────────────────────►│                           │
```

## 4. Bridge Mitigation Stacking (Computed Rule Example)

```
  WINDOWS RULE — Single Pane, Tree at 50ft
  ─────────────────────────────────────────

  Step 1: Compute required safe distance
  ┌─────────────────────────────────────────────────┐
  │  Base Distance     30 ft                        │
  │  × Window Modifier  3  (Single Pane)            │
  │  × Veg Modifier     1  (Tree)                   │
  │  ─────────────────────────                      │
  │  = Required Distance: 90 ft                     │
  │                                                  │
  │  Actual Distance: 50 ft                          │
  │  50 < 90 → FAIL ✗                               │
  └─────────────────────────────────────────────────┘

  Step 2: Apply Bridge — "Apply Film" (×0.8)
  ┌─────────────────────────────────────────────────┐
  │  Required Distance  90 ft                       │
  │  × Film Modifier    0.8                         │
  │  ─────────────────────────                      │
  │  = New Required: 72 ft                          │
  │                                                  │
  │  Actual Distance: 50 ft                          │
  │  50 < 72 → still FAIL ✗                         │
  │                                                  │
  │  Bridge count: 1                                 │
  └─────────────────────────────────────────────────┘

  Step 3: Stack Bridge — "Prune Trees" (×0.5)
  ┌─────────────────────────────────────────────────┐
  │  Required Distance  72 ft (after film)          │
  │  × Prune Modifier   0.5                         │
  │  ─────────────────────────                      │
  │  = New Required: 36 ft                          │
  │                                                  │
  │  Actual Distance: 50 ft                          │
  │  50 < 36? NO → PASS ✓                           │
  │                                                  │
  │  Bridge count: 2                                 │
  │  (cumulative: 90 × 0.8 × 0.5 = 36)             │
  └─────────────────────────────────────────────────┘
```
