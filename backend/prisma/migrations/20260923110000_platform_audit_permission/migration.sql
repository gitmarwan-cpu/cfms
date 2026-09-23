-- Add the platform-scoped audit visibility permission without changing the
-- existing tenant audit permission or platform-user permissions.
INSERT INTO "permissions"
  ("code", "module", "description_ar", "create_date", "write_date")
SELECT 'platform.audit.view', 'platform', 'عرض سجل تدقيق المنصة', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "code" = 'platform.audit.view'
);

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "roles" r
JOIN "permissions" p ON p."code" = 'platform.audit.view' AND p."module" = 'platform'
WHERE r."code" = 'platform_admin'
  AND r."scope" = 'platform'
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );
