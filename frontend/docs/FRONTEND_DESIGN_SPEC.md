# SmartCFMS Frontend Design Specification

**Version:** 1.1
**Status:** Approved Target-State Guidance for Incremental Frontend Evolution
**Primary Use:** Phase 3+ Frontend Development
**Date:** 2026-08-26

---

## 0. Document Authority and Reconciliation

This document defines the **target frontend architecture, UX standards, interaction principles, and engineering direction** for SmartCFMS.

It is **not a description of the current implementation**.

The current repository implementation remains the source of truth for what already exists. Backend architecture, API contracts, tenant isolation, authentication, authorization, RBAC, and database contracts remain authoritative for security and business behavior.

### Authority hierarchy

When a conflict exists, use the following order:

1. **Backend security and business contracts**
2. **Approved system architecture and RBAC specifications**
3. **Existing working implementation and API contracts**
4. **This frontend design specification**
5. Developer preference or implementation convenience

This specification must therefore be implemented **incrementally**, not as a reason to rewrite functioning architecture.

---

# 1. Critical Phase 3 Rule

## 1.1 No wholesale frontend rewrite

Phase 3 must **not** become a general frontend migration or architectural rewrite.

Do not automatically:

* move the entire project from `src/{api,components,context,pages}` to `app/features/shared`
* migrate all state management to TanStack Query
* migrate all forms to React Hook Form
* replace all validation with Zod
* introduce a new UI framework
* replace existing working components
* rewrite existing pages solely to match the proposed folder structure
* introduce dark mode solely because it appears in this document
* introduce a new authorization model
* introduce a new organization model
* recreate retired `org_units`
* introduce group-based complaint assignment

Any architectural migration must first be justified by a concrete problem and explicitly approved.

### Principle

> **Prefer incremental alignment over wholesale migration.**

New code should follow the standards in this document where practical. Existing code should be changed when there is a demonstrated functional, security, accessibility, maintainability, or UX gap.

---

# 2. Current Frontend Baseline

The current frontend must be verified directly from the repository before implementation.

The known baseline includes:

* React + Vite
* TypeScript
* React Router
* Axios-based API layer
* Tailwind CSS / existing CSS architecture
* Arabic RTL experience
* Public complaint submission and tracking
* Authenticated administrative experience
* Admin organization management
* Complaint detail and assignment functionality
* RBAC-aware administrative UI
* Canonical organization hierarchy based on the unified `organizations` model

The exact current state must always be verified from source code rather than assumed from this document.

---

# 3. Core Architectural Principles

SmartCFMS frontend development must follow:

* incremental evolution
* domain separation
* accessibility
* Arabic-first UX
* responsive design
* security by server-side enforcement
* predictable API contracts
* reusable components
* progressive enhancement
* maintainability
* low-bandwidth awareness
* clear user feedback
* minimal unnecessary dependencies

The frontend should simplify interaction without duplicating backend business rules.

---

# 4. Security and Authorization

## 4.1 Backend is authoritative

Frontend authorization is a **UX concern**, not a security boundary.

The frontend may:

* hide unavailable actions
* disable controls
* prevent unnecessary requests
* display appropriate unauthorized states

The frontend must never be trusted for:

* tenant isolation
* authorization
* role enforcement
* permission enforcement
* organization access control
* assignment authorization
* sensitive data protection

All authoritative authorization remains server-side.

---

# 5. RBAC Model

SmartCFMS uses the approved RBAC architecture. The frontend must consume the permissions and authorization context exposed by the backend and must not introduce an alternative permission model.

## 5.1 Direct Role Authorization

The canonical active authorization path is:

```text
User
  ↓
User Role
  ↓
Role
  ↓
Role Permission
  ↓
Permission
```

Where organizational scoping is supported, role assignments must preserve the canonical backend scope, including:

* organization
* organization node
* permission scope

The frontend must treat backend authorization as authoritative.

## 5.2 Legacy Groups

Groups are being retired from active authorization.

The target authorization model is direct user-role authorization. Groups must not be used as an active source of effective permissions.

During the transition period, legacy Group data may remain in the database for compatibility, migration, historical audit, and controlled read-only inspection.

The frontend must therefore:

* not create new Group memberships
* not modify Group memberships
* not assign Roles to Groups
* not use Groups to determine effective authorization
* not present Groups as an active authorization mechanism
* present legacy Group information as read-only where it remains necessary during transition

Group tables, historical migrations, and audit records must not be removed merely as part of frontend work. Their retirement requires a separately approved backend/database migration plan.

## 5.3 Complaint Assignment

Groups are never complaint assignees.

The canonical complaint assignment model is:

```text
Complaint → User
Complaint → Organization Node
```

The frontend must not introduce:

```text
Complaint → Group
```

unless the backend architecture explicitly introduces and authorizes such a contract in the future.

## 5.4 Authorization Boundary

Frontend RBAC behavior is a UX layer only.

The frontend may:

* hide unavailable actions
* disable controls
* display read-only states
* prevent unnecessary requests
* display appropriate unauthorized states

The frontend must never be relied upon for:

* tenant isolation
* authorization
* role enforcement
* permission enforcement
* organization access control
* assignment authorization
* sensitive data protection

All authoritative authorization remains server-side.


---

# 6. Tenant Isolation

Tenant isolation must never depend on frontend behavior.

The frontend may provide organization context for:

* navigation
* display
* API routing
* branding
* UX filtering

but the backend must remain responsible for validating access to tenant-scoped resources.

Never assume that changing an organization identifier in the browser grants access to another tenant.

---

# 7. Organization Architecture

The organization model must follow the approved backend architecture.

## 7.1 Canonical model

Use the unified `organizations` model and its hierarchy.

The hierarchy is represented through:

```text
organizations.parent_id
```

Do not reintroduce:

* `org_units`
* `org_unit_id`
* parallel organization hierarchy models

unless explicitly approved by the architecture owners.

## 7.2 Organization node terminology

Frontend terminology should distinguish clearly between:

* Organization / Tenant
* Organization Node
* Organization Unit Type
* Role
* Legacy Group (read-only compatibility data)

Do not use legacy terminology merely because it exists in older code.

---

# 8. Geographic Structure

The canonical geographic hierarchy is:

```text
Country
  ↓
Governorate
  ↓
District
```

Where geographic fields are supported by an organization node, the UI should use dependent selectors.

Expected behavior:

* changing Country clears Governorate and District
* changing Governorate clears District
* District requires Governorate
* Governorate requires Country

The backend remains authoritative and must validate geographic relationships.

The frontend must not implement geographic inheritance unless an explicit backend/business policy exists.

---

# 9. Frontend Architecture

The long-term target architecture is layered:

1. Application shell and providers
2. Route-level features
3. Shared UI/design system
4. API/data services
5. Shared hooks/utilities/types
6. Configuration and design tokens

However, the existing repository structure must not be migrated wholesale merely to match this proposal.

Architecture should evolve when there is a demonstrated need.

---

# 10. Recommended Future Structure

A feature-oriented structure remains the preferred long-term direction:

```text
src/
  app/
  features/
  shared/
  config/
  locales/
  assets/
```

This is **target architecture**, not a mandatory Phase 3 migration.

Existing stable modules may remain where they are until a justified refactor is required.

---

# 11. State Management

State must be classified correctly.

### Local UI state

Use component state for:

* dialogs
* dropdown state
* temporary form values
* local UI interactions

### Feature state

Use hooks or feature-level state for:

* multi-step workflows
* temporary workflow state
* complex feature interactions

### Server state

Server data should eventually benefit from a dedicated server-state strategy such as TanStack Query where complexity justifies it.

However:

> **Phase 3 must not perform a broad TanStack Query migration without demonstrated need.**

Introduce it incrementally where it provides clear benefits such as:

* caching
* request deduplication
* invalidation
* synchronization
* pagination
* mutation lifecycle handling

---

# 12. API Layer

The API layer must remain centralized and predictable.

Requirements:

* shared Axios client
* centralized authentication handling
* consistent error normalization
* typed API contracts where available
* feature/domain-specific service modules
* consistent response handling
* safe unauthorized-session handling

Do not duplicate API calls across unrelated components.

Do not bypass the established API layer without a documented reason.

---

# 13. Authentication

Protected administrative experiences must:

* require authentication
* respect session expiration
* redirect safely after logout
* avoid exposing credentials or tokens unnecessarily
* provide clear authentication failure states

Route guards improve UX but do not replace backend authorization.

---

# 14. Routing

Routing should support separation between:

### Public

* complaint submission
* complaint tracking
* help/information
* privacy-related content

### Authenticated

* dashboard
* complaints
* complaint detail
* reporting
* administrative features

### Error

* unauthorized
* not found
* server error

Use route-level lazy loading where it provides a measurable performance benefit.

Do not restructure routing merely for architectural symmetry.

---

# 15. Design System

The interface should feel:

* trustworthy
* modern
* calm
* structured
* professional
* suitable for humanitarian/public-service operations

Primary principle:

> **Clarity over decoration.**

Prioritize:

* readability
* hierarchy
* consistency
* discoverability
* predictable interaction
* accessibility

---

# 16. Design Tokens

Use CSS variables/design tokens for:

* colors
* spacing
* typography
* radii
* shadows
* motion
* semantic states

Components should avoid unnecessary hardcoded visual values.

Token layers should conceptually follow:

```text
Base Tokens
    ↓
Brand Tokens
    ↓
Semantic Tokens
    ↓
Component Tokens
```

---

# 17. Organization Branding

Branding may be organization-aware.

Potential branding properties include:

* organization name
* acronym
* logo
* primary color
* secondary color
* support contact
* footer/legal text

Branding must not compromise consistency, accessibility, or contrast.

Organization-provided colors must be validated before being used for text or interactive states.

---

# 18. Theme

A light theme remains the baseline.

Dark mode is a **future capability**, not a mandatory Phase 3 requirement.

Do not introduce dark mode unless:

* product requirements justify it
* design tokens can support it cleanly
* accessibility is preserved
* the implementation does not destabilize the existing UI

---

# 19. Responsive Design

The interface must support:

* desktop
* tablet
* mobile

Use mobile-first principles.

Expected behavior:

* forms stack naturally
* navigation adapts to small screens
* tables become horizontally scrollable or card-based where appropriate
* important actions remain accessible
* dialogs remain usable on small screens
* no unnecessary horizontal overflow

Test representative viewport sizes rather than assuming responsiveness from CSS alone.

---

# 20. Accessibility

Target standard:

**WCAG 2.2 AA**

Requirements include:

* semantic HTML
* keyboard accessibility
* visible focus states
* adequate contrast
* logical heading hierarchy
* accessible labels
* accessible error messages
* meaningful ARIA usage
* screen-reader compatibility
* accessible dialogs and menus

Accessibility must be validated behaviorally, not only by TypeScript/build success.

---

# 21. Forms

Forms should:

* group related fields
* clearly identify required fields
* preserve values after validation errors
* provide field-level errors
* provide useful loading states
* prevent accidental duplicate submissions
* focus the first invalid field when practical

Complex forms should use progressive disclosure where appropriate.

---

# 22. Validation

Validation has three layers:

```text
Frontend immediate feedback
        ↓
API/schema validation
        ↓
Backend authoritative validation
```

Client-side validation must never be treated as a security mechanism.

Zod and React Hook Form are recommended technologies for future complex forms, but they are **not mandatory migration targets for all existing forms**.

Use them when they materially improve:

* consistency
* validation quality
* form complexity
* maintainability

---

# 23. Error Handling

Errors should be classified into:

* validation
* authentication
* authorization
* not found
* conflict
* network
* server/unexpected

User-facing errors should:

* be understandable
* identify the problem
* provide recovery where possible
* avoid exposing internal implementation details

Use:

* inline field errors
* banners
* toasts
* empty states
* dedicated error pages

according to context.

---

# 24. Loading and Async UX

Every asynchronous operation must communicate state.

Use appropriate patterns:

* button loading state
* skeleton
* inline spinner
* progress indicator
* disabled duplicate actions

Avoid unnecessary layout shifts.

---

# 25. Complaint Management UX

Complaint workflows must reflect backend contracts.

The frontend must not invent workflow states, transitions, assignments, or permissions.

Complaint assignment currently supports:

```text
User
Organization Node
```

The UI must not present unsupported assignment targets.

Complaint detail should make clear:

* current status
* assignee
* assigned organization node
* priority
* SLA state where available
* workflow history
* audit information where authorized
* relevant complainant/case information according to access permissions

Sensitive information must only be displayed when authorized.

---

# 26. Administrative UX

Administrative pages should provide:

* clear page titles
* consistent actions
* predictable CRUD behavior
* confirmation for destructive actions
* loading states
* empty states
* validation feedback
* permission-aware actions
* appropriate read-only behavior where the user lacks management permission

The frontend should not merely hide buttons; backend enforcement remains mandatory.

---

# 27. CRUD Lifecycle Standards

For administrative entities, prefer a consistent lifecycle:

```text
View
Create
Edit
Deactivate / Archive
Reactivate where supported
Delete only where explicitly permitted
```

Do not assume that every entity should support hard deletion.

Deletion semantics must follow the backend contract.

For roles, groups, reference data, organizations, and other configuration entities, determine lifecycle behavior from the actual backend/business rules before changing it.

---

# 28. Audit UX

Audit records are sensitive administrative information.

The frontend should only expose audit data according to the canonical authorization contract.

Do not invent a new permission such as:

```text
audit.view
```

unless it is formally introduced into the RBAC architecture.

Until then, use the existing backend authorization contract.

Audit presentation should prioritize:

* actor
* action
* target
* timestamp
* relevant context
* readable change information

Avoid exposing secrets, tokens, credentials, or unnecessary sensitive payloads.

---

# 29. Notifications

Notification behavior must follow an explicit backend/business policy.

Do not invent default notification recipients for:

* complaint creation
* organization assignment
* escalation
* workflow transitions

If a notification contract is not defined, identify the gap instead of guessing.

---

# 30. SLA UX

The UI should expose SLA information only to the extent supported by the backend.

Where supported, consider:

* SLA status
* due date
* elapsed time
* remaining time
* breach state
* priority
* category
* sensitivity

Do not invent SLA calculations in the frontend when the backend is authoritative.

---

# 31. Internationalization

Long-term target:

* Arabic
* English

The system should support:

* RTL Arabic
* LTR English
* localized dates
* localized numbers
* localized messages
* logical CSS properties
* direction-aware navigation and components

However, internationalization must be introduced incrementally.

Do not perform a broad hardcoded-string migration merely because the target architecture specifies translation files.

---

# 32. Arabic RTL

Arabic remains the primary UX language for the current operational context.

Requirements:

* correct RTL layout
* natural Arabic wording
* appropriate typography
* correct icon positioning
* logical spacing
* readable form labels
* appropriate table alignment

Do not mirror icons blindly; directional icons must retain semantic meaning.

---

# 33. Performance

Priorities:

1. fast initial load
2. responsive interaction
3. efficient API usage
4. minimal unnecessary dependencies
5. stable layout

Use:

* lazy loading
* code splitting
* pagination
* caching where justified
* optimized assets

Do not introduce premature optimization.

---

# 34. Component Standards

Shared components should be:

* reusable
* composable
* accessible
* predictable
* theme-aware where appropriate

Preferred primitives include:

* Button
* Input
* Select
* Textarea
* Checkbox
* Radio
* Modal
* Drawer
* Tabs
* Alert
* Badge
* Card
* EmptyState
* Skeleton
* DataTable
* Pagination
* Breadcrumb
* SectionHeader

Only create a shared component when reuse or consistency justifies it.

---

# 35. Code Quality

Use:

* TypeScript
* clear domain naming
* focused components
* small reusable functions
* typed API contracts
* minimal duplication

Avoid:

* monolithic components
* hidden business rules in UI
* duplicated API logic
* unnecessary abstractions
* premature generic components
* inline styling when a token/class/component is more appropriate

---

# 36. Testing

Phase 3 must include appropriate levels of testing.

### Unit tests

For:

* utilities
* validation
* isolated logic

### Integration/API tests

For:

* authentication
* RBAC
* tenant isolation
* CRUD contracts
* complaint assignment
* organization hierarchy

### Frontend tests

For critical user journeys:

* login
* navigation
* complaint review
* assignment
* administrative CRUD
* validation
* unauthorized behavior

### Browser/UI tests

Where feasible, validate actual behavior in a running browser environment.

Build and typecheck success alone does not prove UX correctness.

---

# 37. Phase 3 Execution Protocol

Before modifying code, the implementation agent must:

### Step 1 — Verify baseline

Check:

* current branch
* HEAD
* working tree
* current diff
* existing tests
* frontend typecheck
* build status

Do not discard existing uncommitted work.

### Step 2 — Read authoritative references

Review relevant:

* architecture documentation
* RBAC specification
* API contracts
* roadmap
* frontend specification
* existing implementation

### Step 3 — Perform forensic gap analysis

Compare the actual implementation against this specification.

Classify each finding as:

```text
Critical
Required
Recommended
Optional
Future
```

Do not implement every theoretical difference.

### Step 4 — Identify contradictions

Before changing code, explicitly identify:

* backend/frontend contract mismatches
* security issues
* RBAC inconsistencies
* tenant isolation risks
* UX inconsistencies
* accessibility gaps
* unsupported assumptions

### Step 5 — Implement incrementally

Fix the highest-value verified gaps first.

Avoid unrelated refactoring.

### Step 6 — Verify

Run appropriate:

```text
typecheck
build
tests
diff --check
```

and browser-level validation where applicable.

### Step 7 — Review the diff

Confirm:

* no unrelated changes
* no architectural regression
* no security regression
* no unsupported API assumptions
* no accidental legacy model reintroduction

---

# 38. Explicit Phase 3 Non-Goals

Unless separately approved, Phase 3 must **not**:

* rewrite the entire frontend folder structure
* migrate every component to a new form library
* migrate every API request to TanStack Query
* introduce a second state-management system without need
* recreate `org_units`
* add `org_unit_id`
* introduce group complaint assignment
* create a parallel RBAC model
* weaken backend authorization
* move tenant isolation into the frontend
* modify production database structure
* modify Prisma schema merely for frontend convenience
* introduce unsupported notification semantics
* invent SLA business rules
* invent audit permissions
* add dark mode solely for compliance with this target document
* convert every existing Arabic string to i18n resources solely because the target architecture proposes it
* perform broad refactoring without a demonstrated requirement

---

# 39. Definition of Done for Phase 3

Phase 3 is successful when:

* existing functionality remains intact
* backend contracts remain authoritative
* RBAC remains enforced server-side
* tenant isolation remains server-side
* complaint assignment uses supported targets only
* organization hierarchy remains canonical
* administrative UX becomes more consistent
* responsive behavior is verified
* accessibility gaps are reduced
* critical workflows have appropriate tests
* no unsupported architecture is introduced
* no unnecessary large-scale migration is performed
* build and typecheck pass
* relevant automated tests pass
* working tree changes are reviewable and scoped

---

# 40. Final Engineering Principle

The objective is **not to make the repository look like this document**.

The objective is to make the actual SmartCFMS product progressively conform to the useful standards defined here while preserving:

* security
* correctness
* backward compatibility
* existing approved architecture
* maintainability
* operational usability

> **Evidence before refactoring.
> Contracts before convenience.
> Security before UX shortcuts.
> Incremental improvement before wholesale migration.**
