# Database Conventions

## Overview

CFMS uses PostgreSQL as the authoritative database.

Prisma is the authoritative ORM for active runtime code.

Existing Sequelize migrations, seeders, and historical configuration may remain where required for migration compatibility, but new application runtime code should use Prisma.

Database conventions must prioritize:

* Data integrity
* Consistency
* Safe migrations
* Idempotent seeders
* Referential integrity
* Transactional operations
* Test isolation
* Backward compatibility

---

## Naming Conventions

Database objects use `snake_case`.

Examples:

```text
organization_id
parent_id
created_at
updated_at
user_organizations
role_permissions
```

Application-level TypeScript follows standard `camelCase` conventions.

Examples:

```text
organizationId
parentId
createdAt
updatedAt
```

Prisma mappings should preserve the existing database naming convention where required.

---

## Primary Keys

Primary keys should use the existing project convention and remain consistent across related tables.

New tables must:

* Define a primary key.
* Use a stable identifier.
* Define appropriate foreign keys.
* Avoid unnecessary composite keys unless the relationship requires them.

Existing primary-key types must not be changed casually because they may be referenced by existing tables, APIs, migrations, or application code.

---

## Foreign Keys

Relationships should be enforced through database foreign keys wherever appropriate.

Foreign keys should:

* Reference valid primary or unique keys.
* Use compatible data types.
* Define appropriate delete/update behavior.
* Prevent orphaned records.

Destructive cascade behavior should only be used when it is explicitly appropriate for the business relationship.

---

## Timestamps

Tables containing persistent business data should normally include:

```text
created_at
updated_at
```

Timestamp values should be stored using PostgreSQL timestamp types appropriate for the application.

Application code should not rely on client-provided timestamps for security, auditing, or authorization decisions.

---

## Organizations and Hierarchy

CFMS uses a single hierarchical `organizations` table for organizational structure.

Organizational nodes such as:

* Organization
* Country Office
* Branch
* Sector
* Department
* Office
* Team

are represented as records in `organizations`.

The organizational type is defined through:

```text
org_unit_type_id
```

Hierarchy is represented through:

```text
parent_id
parent_path
```

Root organizations use:

```text
parent_id = NULL
```

The database and application must prevent:

* Self-referencing parents
* Cyclic hierarchies
* Invalid parent references
* Broken organizational paths

Changes to parent relationships must keep `parent_path` consistent with the hierarchy.

Existing `org_units` structures must be inspected before any consolidation, migration, or removal.

---

## Users and Organizations

A user's default organizational context is stored through:

```text
users.organization_id
```

Additional organizational memberships are represented through:

```text
user_organizations
```

Organizational membership is separate from authorization.

Roles and permissions must not be duplicated simply because a user belongs to multiple organizations.

---

## Roles and Permissions

The RBAC model uses:

```text
roles
permissions
role_permissions
user_roles
```

Permissions form the platform permission catalog.

Roles provide reusable collections of permissions.

Organizational context is determined through user membership and applicable role assignments.

Database changes must not introduce organization-specific copies of permissions unless there is a clear architectural requirement.

---

## Required Columns on Existing Data

When adding a new required column to a table that may already contain production data:

1. Add the column as nullable.
2. Backfill existing records.
3. Validate the backfill.
4. Add the required constraint.
5. Update application code to treat the field as required.

For example:

```text
Add nullable column
        ↓
Backfill existing data
        ↓
Validate
        ↓
Set NOT NULL
```

A migration must never assume that an existing table is empty unless that assumption has been verified.

---

## Migrations

Migrations must be:

* Safe
* Deterministic
* Reviewable
* Idempotent where appropriate
* Compatible with existing data

Existing applied migrations must not be modified to correct later inconsistencies.

A new migration must be created for a schema change.

Do not use destructive migration operations to hide data or schema inconsistencies.

### Historical Sequelize Migrations

Existing Sequelize migrations are part of the project's historical migration chain.

They must not be removed or rewritten solely because runtime code has migrated to Prisma.

New runtime database access should use Prisma.

---

## Seeders

Seeders must be explicitly idempotent.

`sequelize-cli` does not reliably track executed seeders across environments, so a seeder may be executed more than once.

Every new seeder must therefore protect itself against duplicate execution.

Example:

```js
const [[{ count }]] = await queryInterface.sequelize.query(
  `SELECT COUNT(*)::int
   FROM <table>
   WHERE <precise condition identifying this seeder's data>;`
);

if (count > 0) return;
```

Seeder checks should identify the exact data owned by that seeder rather than relying only on a general table count.

When a seed depends on reference data, the required reference data must be created or verified by the same seeding operation where practical.

Seeders must not silently overwrite existing production data.

---

## Reference Data

Reference data should be stable, identifiable, and reusable.

Examples include:

* Organizational unit types
* Countries
* Governorates
* Districts
* Complaint categories
* Status values
* Permission definitions

Reference data should have appropriate unique constraints to prevent accidental duplication.

Application code should not depend on hard-coded database IDs when a stable code or unique business identifier is available.

---

## Indexes and Constraints

Indexes should support actual query patterns.

Common candidates include:

* Foreign-key columns
* Frequently filtered columns
* Unique business identifiers
* Organizational hierarchy queries
* Audit and reporting queries

Do not add indexes speculatively.

Constraints should be used to enforce data integrity where the rule belongs at the database level.

Examples:

* `UNIQUE`
* `NOT NULL`
* `FOREIGN KEY`
* Appropriate `CHECK` constraints

Application validation complements database constraints; it does not replace them.

---

## Transactions

Operations that must succeed or fail together should use database transactions.

Transactions should be used for operations such as:

* Creating related records atomically
* Assigning roles and permissions
* Moving organizational nodes
* Multi-step complaint state changes
* Critical administrative operations

Transactions should remain as short as practical.

---

## Test Database

The application and Jest integration tests use PostgreSQL.

Jest must receive:

```text
CFMS_TEST_DATABASE_URL
```

The test harness must reject:

* Missing test database URLs
* Non-PostgreSQL URLs
* Development database URLs
* Production database URLs

The test database must be explicitly isolated.

The current test database is:

```text
cfms_test
```

The test harness must verify the actual database identity before performing any test reset or destructive test operation.

Tests must never derive their database URL from:

```text
DATABASE_URL
DB_NAME=cfms_db
```

The development or production database must never be used for automated test resets.

---

## Schema and Migration Validation

Disposable databases may be used to validate:

* Prisma migrations
* Schema creation
* Seed behavior
* Migration ordering
* Referential integrity

The current disposable validation database is:

```text
cfms_seed_validation
```

The development/production database:

```text
cfms_db
```

must not be used for disposable migration or seed validation.

Validation should verify the actual resulting PostgreSQL schema rather than relying only on migration success messages.

---

## Database Safety

The following operations are prohibited unless explicitly authorized:

```text
prisma migrate reset
prisma db push
prisma migrate dev
```

Production data must never be used as a disposable test or validation environment.

Applied Prisma migrations and their checksums must not be modified to hide inconsistencies.

Schema corrections must be implemented through appropriate new migrations.

---

## Data Integrity Principles

Database design must prioritize:

* Referential integrity
* Explicit constraints
* Consistent naming
* Stable identifiers
* Safe migrations
* Idempotent seeders
* Transactional updates
* Test isolation
* Backward compatibility

Application code should not rely solely on frontend validation or application-level assumptions to protect database integrity.

---

## Database Principle

> **PostgreSQL is the source of truth.**
> **Prisma is the authoritative runtime ORM.**
> **Constraints protect data integrity.**
> **Migrations evolve the schema safely.**
> **Seeders are explicitly idempotent.**
> **Tests use isolated PostgreSQL databases.**
> **Production data is never a test environment.**
