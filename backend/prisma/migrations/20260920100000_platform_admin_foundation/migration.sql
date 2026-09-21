-- Phase 1: separate platform authority from tenant-scoped RBAC and establish
-- the organization lifecycle state required for server-side tenant gating.

-- Fail closed before any schema/data change if an existing role already uses
-- the reserved platform role code. The migration must not rename, overwrite,
-- or silently reinterpret an existing tenant role.
DO $cfms$
BEGIN
  IF EXISTS (SELECT 1 FROM "roles" WHERE "code" = 'platform_admin') THEN
    RAISE EXCEPTION 'Cannot create reserved platform role code platform_admin: existing role found; resolve explicitly before migrating';
  END IF;
END
$cfms$;

CREATE TYPE "enum_role_scope" AS ENUM ('tenant', 'platform');
CREATE TYPE "enum_organizations_lifecycle_status" AS ENUM (
  'provisioning',
  'active',
  'suspended',
  'deactivated',
  'archived'
);

ALTER TABLE "roles"
  ADD COLUMN "scope" "enum_role_scope" NOT NULL DEFAULT 'tenant';

ALTER TABLE "organizations"
  ADD COLUMN "lifecycle_status" "enum_organizations_lifecycle_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "status_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "status_changed_by_user_id" INTEGER,
  ADD COLUMN "status_reason" VARCHAR(255);

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_status_changed_by_user_id_fkey"
  FOREIGN KEY ("status_changed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "organizations_lifecycle_status_deleted_at"
  ON "organizations"("lifecycle_status", "deleted_at");

CREATE TABLE "user_platform_roles" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "role_id" INTEGER NOT NULL,
  "create_date" TIMESTAMPTZ(6) NOT NULL,
  "write_date" TIMESTAMPTZ(6) NOT NULL,
  "create_uid" INTEGER,
  "write_uid" INTEGER,
  CONSTRAINT "user_platform_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_platform_roles_unique"
  ON "user_platform_roles"("user_id", "role_id");
CREATE INDEX "user_platform_roles_user_id"
  ON "user_platform_roles"("user_id");
CREATE INDEX "user_platform_roles_role_id"
  ON "user_platform_roles"("role_id");

ALTER TABLE "user_platform_roles"
  ADD CONSTRAINT "user_platform_roles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "user_platform_roles_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "user_platform_roles_create_uid_fkey"
  FOREIGN KEY ("create_uid") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "user_platform_roles_write_uid_fkey"
  FOREIGN KEY ("write_uid") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The former tenant-scoped organization.create permission cannot remain
-- available to tenant roles. Organization creation will be exposed through
-- the platform boundary in the provisioning phase.
DELETE FROM "permissions" WHERE "code" = 'organization.create';

INSERT INTO "permissions"
  ("code", "module", "description_ar", "create_date", "write_date")
SELECT v."code", 'platform', v."description_ar", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('platform.tenant.create', 'إنشاء المستأجرين وإعدادهم'),
  ('platform.tenant.lifecycle', 'إدارة دورة حياة المستأجرين'),
  ('platform.users.manage', 'إدارة مستخدمي المنصة'),
  ('platform.memberships.manage', 'إدارة عضويات المستأجرين')
) AS v("code", "description_ar")
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" p WHERE p."code" = v."code"
);

INSERT INTO "roles"
  ("code", "name_ar", "name_en", "description", "is_system", "is_active", "scope", "create_date", "write_date")
SELECT 'platform_admin', 'مدير المنصة', 'Platform Admin',
       'Platform-scoped administration only', true, true, 'platform', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "roles" r WHERE r."code" = 'platform_admin' AND r."scope" = 'platform'
);

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."module" = 'platform'
WHERE r."code" = 'platform_admin' AND r."scope" = 'platform'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
