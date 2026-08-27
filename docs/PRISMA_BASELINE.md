# Prisma Migration Baseline Notes

## Current State

The application runtime and Jest test infrastructure now use Prisma for the converted identity, RBAC, organization, location, reference-data, complaint, tenant, and middleware paths. Sequelize remains only in the legacy migration/seeder tooling; it is not selected by the application controllers, services, or tests.

The existing `cfms_db` is the current CFMS database and already contains application data. The test database is the separate `cfms_test` database. No old-production-to-new-production data copy is required for this phase: existing data was already in the target database, so no separate data migration was performed.

The baseline SQL created 24 active application tables; after the permanent removal of Groups (`20260826150000_remove_groups`), there are 21 active application tables. They are the Sequelize-managed snake_case tables, including `users`, `complaints`, `organizations`, `roles`, `reference_lists`, and related bridge tables.

## Stale Prisma Artifacts

The Prisma schema retains definitions for older PascalCase Prisma artifacts for compatibility with historical repository state. A read-only inspection of the current `cfms_db` found that these quoted PascalCase tables and `SequelizeMeta` are not currently present there:

- Tables: `User`, `Complaint`, `AuditLog`
- Enums: `Role`, `ComplaintStatus`, `ComplaintPriority`
- Metadata tables: `_prisma_migrations`, `SequelizeMeta`

These objects are not referenced by the current Sequelize models, migrations, seeders, services, controllers, middleware, or tests. They remain excluded from Prisma Client with `@@ignore` in `backend/prisma/schema.prisma`; the ignored definitions must not be treated as evidence that the objects exist in every environment.

Do not delete, reset, rename, or modify these stale objects during the current migration stage. Cleanup must be a later explicit database migration step after a verified Prisma baseline and backup.

## Expression Indexes Prisma Cannot Represent

PostgreSQL currently enforces four important expression indexes that use `COALESCE(...)` for tenant-scoped uniqueness with nullable scope fields:

```sql
CREATE UNIQUE INDEX reference_lists_key_scope_unique
ON reference_lists ("key", COALESCE(organization_id, 0));

CREATE UNIQUE INDEX roles_code_scope_unique
ON roles (code, COALESCE(organization_id, 0));

CREATE UNIQUE INDEX user_roles_scope_unique
ON user_roles (user_id, role_id, organization_id, COALESCE(org_unit_id, 0));

CREATE UNIQUE INDEX workflow_definitions_code_scope_unique
ON workflow_definitions (code, COALESCE(organization_id, 0));
```

The `user_roles` expression above is retained verbatim as historical baseline
SQL. The current logical scope field in the Prisma model and active services is
`organization_node_id`; it must not be confused with a current `org_unit_id`
contract.

Prisma introspection warns that these expression indexes are not fully supported by Prisma schema syntax. They must be preserved with raw SQL in any future Prisma Migrate baseline or follow-up migration. Do not replace them with normal Prisma `@@unique` definitions unless the tenant semantics are proven equivalent, because PostgreSQL unique constraints treat `NULL` differently.

## `_prisma_migrations` Mismatch

The live database contains one Prisma migration history row:

- `20260716002023_init`

The repository keeps `20260716002023_init` immutable in concept and keeps the nullable `complainants.relationship_item_id` change in the separate, ordered migration `20260812000000_add_complainant_relationship_item_id`. Both migrations apply cleanly to the approved disposable database `cfms_seed_validation`. The live `cfms_db` history still requires an explicit reconciliation decision because its recorded baseline checksum differs from the current repository file and it has no row for the follow-up migration.

The repository now contains the matching `backend/prisma/migrations/20260716002023_init` directory. The migration file was audited but was not applied to `cfms_db` during this migration work. The live history and repository still require an explicit, separately approved baseline/reconciliation decision before any Prisma migration command is run against the existing database.

Do not run `prisma migrate dev`, `prisma migrate deploy`, `prisma migrate reset`, or `prisma db push` against this database until a deliberate baseline strategy is chosen. A future baseline should account for:

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
