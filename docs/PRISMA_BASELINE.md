# Prisma Migration Baseline Notes

## Current State

The current application still uses Sequelize as the active ORM. Prisma has been introduced only as a baseline schema/client layer for the existing PostgreSQL database. Do not remove Sequelize or migrate services until the baseline risks below are resolved and verified.

The active application tables are the Sequelize-managed snake_case tables, including `users`, `complaints`, `organizations`, `roles`, `groups`, `reference_lists`, and related bridge tables.

## Stale Prisma Artifacts

The live PostgreSQL database also contains older PascalCase Prisma artifacts:

- Tables: `User`, `Complaint`, `AuditLog`
- Enums: `Role`, `ComplaintStatus`, `ComplaintPriority`
- Metadata table: `_prisma_migrations`

These objects are not referenced by the current Sequelize models, migrations, seeders, services, controllers, middleware, or tests. They are therefore excluded from Prisma Client with `@@ignore` in `backend/prisma/schema.prisma`.

Do not delete, reset, rename, or modify these stale objects during the current migration stage. Cleanup must be a later explicit database migration step after a verified Prisma baseline and backup.

## Expression Indexes Prisma Cannot Represent

PostgreSQL currently enforces five important expression indexes that use `COALESCE(...)` for tenant-scoped uniqueness with nullable scope fields:

```sql
CREATE UNIQUE INDEX groups_code_scope_unique
ON groups (code, COALESCE(organization_id, 0));

CREATE UNIQUE INDEX reference_lists_key_scope_unique
ON reference_lists ("key", COALESCE(organization_id, 0));

CREATE UNIQUE INDEX roles_code_scope_unique
ON roles (code, COALESCE(organization_id, 0));

CREATE UNIQUE INDEX user_roles_scope_unique
ON user_roles (user_id, role_id, organization_id, COALESCE(org_unit_id, 0));

CREATE UNIQUE INDEX workflow_definitions_code_scope_unique
ON workflow_definitions (code, COALESCE(organization_id, 0));
```

Prisma introspection warns that these expression indexes are not fully supported by Prisma schema syntax. They must be preserved with raw SQL in any future Prisma Migrate baseline or follow-up migration. Do not replace them with normal Prisma `@@unique` definitions unless the tenant semantics are proven equivalent, because PostgreSQL unique constraints treat `NULL` differently.

## `_prisma_migrations` Mismatch

The live database contains one Prisma migration history row:

- `20260716002023_init`

The repository does not contain a matching `backend/prisma/migrations/20260716002023_init` directory. This means the live Prisma migration history and the repository migration files are out of sync.

Do not run `prisma migrate`, `prisma migrate reset`, or `prisma db push` against this database until a deliberate baseline strategy is chosen. A future baseline should account for:

- the existing Sequelize-created schema,
- the stale PascalCase Prisma artifacts,
- the unsupported expression indexes,
- the duplicate foreign key constraints currently present in PostgreSQL,
- and the existing `_prisma_migrations` row.

## Required Precautions Before Prisma Migrate

Before introducing Prisma Migrate:

1. Take a verified PostgreSQL backup.
2. Decide whether the existing `_prisma_migrations` row will be retained, reconciled, or handled in a controlled cleanup migration.
3. Create a baseline migration that represents the current intended application schema without dropping live Sequelize tables.
4. Preserve the five expression indexes with raw SQL.
5. Keep stale Prisma artifacts ignored until a separate cleanup migration is explicitly planned and reviewed.
6. Verify drift using read-only inspection before applying any migration command.
