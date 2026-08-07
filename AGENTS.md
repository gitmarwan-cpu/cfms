# AGENTS.md

## Mission

Work efficiently, safely, and precisely.

The primary goal is to complete the requested task correctly while preserving context and token budget.

Treat token/context usage as a limited engineering resource:

* Spend tokens on understanding the task, relevant code, implementation, testing, and verification.
* Do not spend tokens on unrelated documentation, repeated analysis, redundant explanations, or completed work.
* Prefer targeted inspection over broad repository-wide reading.
* Prefer reusing existing implementation and decisions over re-deriving them.
* Complete the largest meaningful portion of the requested task within the available context.
* Do not sacrifice security, correctness, testing, or architectural integrity merely to save tokens.
* ZERO-REGURGITATION POLICY: Never rewrite entire files or unchanged code blocks in responses. Return only the specific modified code or exact functions. Use `// ... rest of code` for omitted sections when appropriate.

## Tech Stack Context

* Backend: Node.js, Express, TypeScript, Sequelize, PostgreSQL.
* Frontend: React, TypeScript, Tailwind CSS.
* Core: Multi-Tenant Enterprise Platform Foundation.
* First Module: CFMS (Complaints & Suggestions Module).

## Task-First Execution

Before making changes:

1. Read this `AGENTS.md`.
2. Identify the exact scope of the requested task.
3. Inspect only the files and documentation relevant to that scope.
4. Determine whether the requested functionality already exists before implementing it.
5. Continue from the current repository state.
6. Do not repeat completed work.
7. Do not reread unrelated documentation or completed implementation unless necessary.
8. Do not perform broad repository exploration when targeted inspection is sufficient.
9. Run targeted tests relevant to the changed functionality.
10. Verify the final implementation against the task requirements and applicable architecture/security rules.

When the task is a continuation of previous work:

* Resume from the current repository state.
* Identify the last completed task.
* Start from the next unfinished task.
* Do not restart the phase or re-derive decisions that are already established.
* Preserve existing changes.

## Documentation Strategy

Documentation is authoritative for architectural rules and project decisions when relevant to the requested task.

The current repository implementation is authoritative for what is actually implemented.

If relevant documentation conflicts with the implementation:

* Do not silently assume which one is correct.
* Stop and report the conflict when it affects the requested task, security, data integrity, or architectural correctness.
* Resolve the conflict using the repository state and project requirements before proceeding.

Do not investigate unrelated documentation/code discrepancies merely because they exist.

### Read selectively

* `docs/ARCHITECTURE.md`

  * Read when the task affects architecture, multi-tenancy, shared services, RBAC, or platform structure.

* `docs/RBAC.md`

  * Read when the task affects roles, permissions, authorization, or access control.

* `docs/TENANT_ISOLATION.md`

  * Read when the task affects organization-scoped data, authorization, middleware, services, or tenant boundaries.

* `docs/DATABASE_CONVENTIONS.md`

  * Read when the task affects migrations, seeders, models, database structure, or data integrity.

* `docs/API_CONVENTIONS.md`

  * Read when the task affects API endpoints, controllers, validation, responses, or error handling.

* `docs/REFERENCE_DATA.md`

  * Read when the task affects reference-data architecture.

* `docs/ROADMAP.md`

  * Read only when the task requires understanding planned phases or future scope.

* `docs/PROJECT_STATUS.md`

  * Read only when the task requires project-wide implementation status.
  * It is a status snapshot, not mandatory reading for every task.

* `modules/`

  * Read only the specification for the business module being modified.
  * Do not read every module specification unless the task explicitly spans multiple modules.

### Documentation efficiency rules

* Do NOT read all files under `/docs` before every task.
* Do NOT read all files under `/modules` before every task.
* Do NOT follow every documentation link automatically.
* Do NOT reread documentation that has already been established as irrelevant to the current task.
* Do NOT reproduce or summarize entire documentation files when only a small section is relevant.
* Use targeted sections and targeted files whenever possible.
* If the task is small and well-defined, keep documentation inspection proportionate to the task.
* Do not expand a task merely to reconcile unrelated documentation issues.

## README

`README.md` is a project overview and navigation document.

* It is not mandatory pre-task reading.
* Do not follow all links in `README.md` automatically.
* Read it only when project-level orientation is actually needed.
* Prefer `AGENTS.md` for execution rules.

## Architecture Rules

* Follow the established CFMS architecture.
* Do not introduce architectural patterns without justification.
* Do not duplicate core business logic across services or controllers.
* Keep controllers thin.
* Keep business rules in the appropriate service/domain layer.
* Shared business rules must have a single authoritative implementation.
* Do not change database architecture without updating the relevant documentation.
* Do not weaken architectural boundaries simply to make a test pass.
* Preserve established module boundaries and shared-platform responsibilities.

## Multi-Tenancy and Security

Tenant isolation is mandatory.

* Never trust organization context supplied by the frontend.
* Every organization-scoped operation must validate the effective organization context.
* Never allow permissions from one organization to authorize access to another organization.
* Authorization must respect the applicable organization context.
* Never allow cross-tenant access paths.
* Never rely on the frontend for tenant isolation.
* When modifying authorization or tenant-scoped functionality, inspect the relevant RBAC and tenant-isolation rules before implementation.

If a security vulnerability affects the requested task or its execution path:

1. Stop before activating or relying on the vulnerable code.
2. Fix the vulnerability.
3. Add or update appropriate tests.
4. Continue the original task only after the security boundary is safe.

If an unrelated security issue is discovered:

* Do not silently ignore it.
* Record/report it separately.
* Do not expand the current task unless the issue must be addressed for safe execution.

## Database Rules

Follow `docs/DATABASE_CONVENTIONS.md` when database-related work is involved.

* Migrations define database structure.
* Seeders define initial/reference data.
* Do not rely on migrations to update rows that are created later by seeders.
* Seeders must be idempotent.
* Do not modify already-applied migrations unless explicitly required and safe.
* Prefer a new migration for subsequent schema changes.
* Verify migration and seeding order when relevant.
* For significant database changes, verify a fresh database initialization when appropriate.

## Git Safety and Conventions

### Git Safety Rule

Always work on the active development branch (for example, `main` or the assigned feature branch).

Never leave commits on a detached HEAD.

Before creating a commit, verify the current branch using:

```bash
git branch --show-current
```

If HEAD is detached, stop and switch to the correct branch before committing.

### Git Tagging Convention

Milestone-based tags only (see `docs/GIT_CONVENTIONS.md`).

Never assume a tag number or sequence exists. Verify with:

```bash
git tag --list "cfms-*"
```

Never create or push a tag for incomplete work. Tag only when the described capability is actually complete and verified.

## Forbidden AI Actions

* FORBIDDEN: Updating `package.json` or changing dependency versions without explicit developer approval.
* FORBIDDEN: Hardcoding business logic for specific sectors (such as UN or NGO workflows) inside the platform Core.
* FORBIDDEN: Expanding a task into unrelated refactoring without explicit justification.
* FORBIDDEN: Reimplementing functionality that already exists without first verifying the current implementation.
