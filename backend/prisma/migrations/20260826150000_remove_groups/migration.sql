-- Permanent removal of the Groups subsystem.
--
-- Phase 3 froze all group writes (groupLifecycle → ApiError 410), so no
-- environment can accumulate memberships. Effective authorization has been
-- exclusively direct: user_roles → roles → role_permissions → permissions
-- (verified: rbacService effective paths never read groups).
--
-- Data pre-migration (read-only audit of both `cfms_db` and `cfms_test`):
--   * user_groups  row count = 0 (no memberships to preserve)
--   * groups       row count = 1 (seeded system group, zero members)
--   * group_roles  row count = 1 (link of that system group to one role)
-- The remaining rows are decommission payload, not business data, so physical
-- removal is data-safe. The guard below aborts transactionally if any
-- unexpected membership exists at deploy time.

-- ── 1. Safety gate: abort if any user is still a group member ──────────────────
DO $cfms$
BEGIN
  IF EXISTS (SELECT 1 FROM "user_groups") THEN
    RAISE EXCEPTION 'Cannot remove Groups: user_groups contains memberships; manual decommission required';
  END IF;
END
$cfms$;

-- ── 2. Drop the Groups tables (children before parents) ────────────────────────
DROP TABLE IF EXISTS "group_roles";
DROP TABLE IF EXISTS "user_groups";
DROP TABLE IF EXISTS "groups";

-- ── 3. Purge the Groups permissions from the catalog ───────────────────────────
-- role_permissions rows referencing these codes are removed automatically by
-- their ON DELETE CASCADE foreign key.
DELETE FROM "permissions" WHERE "code" IN ('groups.view', 'groups.manage');
