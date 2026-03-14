# Mitigation Rules Engine (POC)

A web-based rules engine for wildfire-focused property insurance. It evaluates property observations against versioned underwriting rules, identifies vulnerabilities, and suggests categorized mitigations — enabling underwriters to make consistent, explainable, and auditable decisions.

## What it does

1. **Processes property observations** — accepts structured data about a property (roof type, vent screens, vegetation distances, etc.)
2. **Identifies vulnerabilities** — evaluates observations against underwriting rules and returns what fails
3. **Suggests mitigations** — for each vulnerability, recommends full mitigations (eliminate the issue) or bridge mitigations (partial fix, tracked and limited)

## Users

| Role | Responsibility |
|------|----------------|
| **Underwriter** | Evaluates properties, selects mitigations, communicates decisions to policyholders |
| **Applied Science** | Authors and tests underwriting rules, publishes versioned releases |
| **Admin** | Configures system settings (bridge mitigation limits), manages users |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Tailwind + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma |
| Validation | Zod (shared schemas across client and server) |
| Auth | JWT + bcrypt (3 roles) |

## Project Structure

```
/client          React frontend
/server          Express backend + rules engine
/shared          Shared TypeScript types + Zod schemas + seed data
/docs            Design documents (HLD, architecture, requirements)
/mocks           HTML UI mockups
```

## Getting Started

```bash
npm install                  # Install all workspaces
cd shared && npx vitest run  # Run schema tests (24 tests)
```

## Design Documents

- [HLD Final](docs/HLD-final.md) — Authoritative high-level design (problem, tenets, requirements, architecture, trade-offs)
- [Iteration Plan](docs/iteration-plan.md) — 8-iteration implementation plan with FR/NFR coverage matrix
- [Architecture Recommendations](docs/architecture-recommendations.md) — Extensibility patterns and testing strategy

## Status

- [x] Iteration 1: Shared types, Zod schemas, seed data (24/24 tests passing)
- [ ] Iteration 2: Engine core (evaluators, registry, bridge stacker)
- [ ] Iteration 3: Data layer (Prisma schema, migrations, seed)
- [ ] Iteration 4: API layer (endpoints, auth, middleware)
- [ ] Iteration 5: Frontend — evaluation flow
- [ ] Iteration 6: Frontend — rule management + releases
- [ ] Iteration 7: Admin, rule reference, history, audit
- [ ] Iteration 8: E2E testing + polish
