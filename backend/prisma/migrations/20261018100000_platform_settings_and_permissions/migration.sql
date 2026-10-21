-- Phase: Platform Settings and Permissions
-- Description: Adds platform_settings table and platform.settings.manage permission.

-- 1. Pre-flight schema & role compatibility assertion
DO $cfms_preflight$
BEGIN
  -- A. Assert required authoritative platform_admin system role exists
  IF NOT EXISTS (
    SELECT 1 FROM "roles" WHERE "code" = 'platform_admin' AND "scope" = 'platform'
  ) THEN
    RAISE EXCEPTION 'Authoritative system role platform_admin (scope=platform) is missing. Cannot grant platform.settings.manage.';
  END IF;

  -- B. Assert no conflicting permission with code platform.settings.manage under an incompatible module
  IF EXISTS (
    SELECT 1 FROM "permissions" WHERE "code" = 'platform.settings.manage' AND "module" <> 'platform'
  ) THEN
    RAISE EXCEPTION 'Permission platform.settings.manage already exists with an incompatible module definition (must be module=platform).';
  END IF;
END
$cfms_preflight$;

-- 2. Create platform_settings table
CREATE TABLE "platform_settings" (
    "id" SERIAL NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "settings" JSONB NOT NULL,
    "encrypted_secrets" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- 3. Create unique index on category
CREATE UNIQUE INDEX "platform_settings_category_key"
  ON "platform_settings"("category");

-- 4. Create platform.settings.manage permission idempotently
INSERT INTO "permissions"
  ("code", "module", "description_ar", "create_date", "write_date")
SELECT 'platform.settings.manage', 'platform', 'إدارة إعدادات المنصة', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "code" = 'platform.settings.manage'
);

-- 5. Grant permission to platform_admin role idempotently
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."code" = 'platform.settings.manage' AND p."module" = 'platform'
WHERE r."code" = 'platform_admin'
  AND r."scope" = 'platform'
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
