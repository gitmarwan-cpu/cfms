-- Phase 1 — Unified organization hierarchy schema preparation.
-- Additive only: no data migration, org_units untouched, legacy columns retained.

-- org_unit_types: prepare root_organization_id (organization_id retained)
ALTER TABLE "org_unit_types" ADD COLUMN "root_organization_id" INTEGER;

CREATE INDEX "org_unit_types_root_organization_id" ON "org_unit_types"("root_organization_id");

ALTER TABLE "org_unit_types"
ADD CONSTRAINT "org_unit_types_root_organization_id_fkey"
FOREIGN KEY ("root_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- organizations: canonical hierarchy preparation columns
ALTER TABLE "organizations" ADD COLUMN "parent_id" INTEGER;
ALTER TABLE "organizations" ADD COLUMN "org_unit_type_id" INTEGER;
ALTER TABLE "organizations" ADD COLUMN "root_organization_id" INTEGER;
ALTER TABLE "organizations" ADD COLUMN "code" VARCHAR(60);
ALTER TABLE "organizations" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "organizations"
ADD CONSTRAINT "organizations_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organizations"
ADD CONSTRAINT "organizations_root_organization_id_fkey"
FOREIGN KEY ("root_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organizations"
ADD CONSTRAINT "organizations_org_unit_type_id_fkey"
FOREIGN KEY ("org_unit_type_id") REFERENCES "org_unit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "organizations_parent_id" ON "organizations"("parent_id");
CREATE INDEX "organizations_root_organization_id" ON "organizations"("root_organization_id");
CREATE INDEX "organizations_org_unit_type_id" ON "organizations"("org_unit_type_id");
CREATE INDEX "organizations_root_organization_id_parent_id" ON "organizations"("root_organization_id", "parent_id");
CREATE INDEX "organizations_root_organization_id_is_active_deleted_at" ON "organizations"("root_organization_id", "is_active", "deleted_at");

-- Root-only slug uniqueness (replaces global unique index)
DROP INDEX IF EXISTS "organizations_slug";
CREATE UNIQUE INDEX "organizations_slug_root_unique" ON "organizations"("slug") WHERE "parent_id" IS NULL;

-- users: primary organization node (replaces org_unit_id in later phase)
ALTER TABLE "users" ADD COLUMN "primary_organization_node_id" INTEGER;

CREATE INDEX "users_primary_organization_node_id" ON "users"("primary_organization_node_id");

ALTER TABLE "users"
ADD CONSTRAINT "users_primary_organization_node_id_fkey"
FOREIGN KEY ("primary_organization_node_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- user_roles: organization node scope (replaces org_unit_id in later phase)
ALTER TABLE "user_roles" ADD COLUMN "organization_node_id" INTEGER;

CREATE INDEX "user_roles_organization_node_id" ON "user_roles"("organization_node_id");

ALTER TABLE "user_roles"
ADD CONSTRAINT "user_roles_organization_node_id_fkey"
FOREIGN KEY ("organization_node_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- complaints: organization node assignment (replaces assigned_to_org_unit_id in later phase)
ALTER TABLE "complaints" ADD COLUMN "assigned_to_organization_id" INTEGER;

CREATE INDEX "complaints_assigned_to_organization_id" ON "complaints"("assigned_to_organization_id");

ALTER TABLE "complaints"
ADD CONSTRAINT "complaints_assigned_to_organization_id_fkey"
FOREIGN KEY ("assigned_to_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legacy org_unit → organization mapping table (empty until Phase 3+)
CREATE TABLE "_legacy_org_unit_map" (
    "legacy_org_unit_id" INTEGER NOT NULL,
    "new_organization_id" INTEGER NOT NULL,
    "root_organization_id" INTEGER NOT NULL,
    "migrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_legacy_org_unit_map_pkey" PRIMARY KEY ("legacy_org_unit_id")
);

CREATE UNIQUE INDEX "_legacy_org_unit_map_new_organization_id_key" ON "_legacy_org_unit_map"("new_organization_id");
