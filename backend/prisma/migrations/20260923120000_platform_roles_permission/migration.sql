-- Add the platform-scoped role management permission without changing existing
-- tenant permissions or platform-user permissions.
INSERT INTO "permissions"
  ("code", "module", "description_ar", "create_date", "write_date")
SELECT 'platform.roles.manage', 'platform', 'إدارة أدوار المنصة', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "code" = 'platform.roles.manage'
);

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."code" = 'platform.roles.manage' AND p."module" = 'platform'
WHERE r."code" = 'platform_admin'
  AND r."scope" = 'platform'
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
