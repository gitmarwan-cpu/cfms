Before making any changes:

1. Read all documentation inside `/docs`.
2. Read module specifications inside `/modules`.
3. Follow Architecture Rules strictly.
4. Never violate RBAC.
5. Never change database architecture without updating documentation.
6. Ask for clarification if documentation conflicts.

---

## Entry points (added during the documentation review pass)

`/docs` and `/modules` did not exist in this repository until this pass — they
have now been created to make the rules above actually followable. Start here:

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — platform architecture,
  multi-tenant model, RBAC, reference data (read this first).
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — living roadmap with accurate
  current status per item (✅/🔶/⏳), not just a wishlist.
- [`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md) — flat snapshot of
  what actually exists right now (routes, models, tests).
- [`modules/`](./modules/) — one spec per business module (complaints,
  organizations, users-permissions, reference-data).

Documentation conflicts found and resolved during this pass are noted inline
in the relevant files (e.g. `frontend/docs/FRONTEND_DESIGN_SPEC.md` was a
forward-looking draft that contradicted the actual implementation — it now
carries an explicit reconciliation note rather than being deleted).


Git Safety Rule

Always work on the active development branch (e.g., main or the assigned feature branch).
Never leave commits on a detached HEAD.
Before creating a commit, verify the current branch using git branch --show-current.
If HEAD is detached, stop and switch to the correct branch before committing.
