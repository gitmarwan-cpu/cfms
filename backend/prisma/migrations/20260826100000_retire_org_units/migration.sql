-- Permanent retirement of the legacy `org_units` architecture.
--
-- With this corrective migration the final CFMS architecture has exactly one
-- organizational hierarchy:
--     organizations.parent_id
-- with the canonical references:
--     users.primary_organization_node_id
--     user_roles.organization_node_id
--     complaints.assigned_to_organization_id
--
-- Data pre-migration (verified by a read-only audit of both `cfms_db` and
-- `cfms_test`):
--   * complaints.assigned_to_org_unit_id  non-null count = 0
--   * users.org_unit_id                   non-null count = 0
--   * user_roles.org_unit_id              non-null count = 0
-- so no legacy business reference needs value-level remapping
-- (unmapped records = 0).
--
-- `org_units` contains master-data hierarchy nodes only. Their semantic
-- hierarchy is preserved by recreating equivalent `organizations` nodes under
-- the tenant root (correct parent and root_organization_id resolved
-- explicitly - never assumed from numeric ID equality). If `org_units` is
-- already empty (e.g. the isolated `cfms_test` database) no node is created.
--
-- `_legacy_org_unit_map` is empty and has no remaining active purpose, so it
-- is removed as obsolete.

-- ── 1. Preserve the legacy org-unit hierarchy as organizations nodes ──────────
DO $cfms$
DECLARE
  r          record;
  v_root_org integer;
  v_parent   integer;
  v_new_org  integer;
  v_slug     text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM org_units) THEN
    RETURN;
  END IF;

  SELECT id INTO v_root_org
  FROM organizations
  WHERE parent_id IS NULL
  ORDER BY id
  LIMIT 1;

  IF v_root_org IS NULL THEN
    RAISE EXCEPTION 'Cannot retire org_units: no tenant root organizations node found';
  END IF;

  CREATE TEMP TABLE cfms_tmp_org_map (
    legacy_id  integer PRIMARY KEY,
    new_org_id integer NOT NULL
  ) ON COMMIT DROP;

  FOR r IN
    SELECT id, parent_id, org_unit_type_id, code, name, is_active, create_date, write_date
    FROM org_units
    ORDER BY id
  LOOP
    IF r.parent_id IS NULL THEN
      v_parent := v_root_org;
    ELSE
      SELECT new_org_id INTO v_parent FROM cfms_tmp_org_map WHERE legacy_id = r.parent_id;
      IF v_parent IS NULL THEN
        RAISE EXCEPTION 'Cannot retire org_units: org_unit % has an unmapped parent %', r.id, r.parent_id;
      END IF;
    END IF;

    v_slug := 'org-node-' || r.id::text;
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) LOOP
      v_slug := v_slug || '-x';
    END LOOP;

    INSERT INTO organizations (
      parent_id,
      root_organization_id,
      org_unit_type_id,
      code,
      slug,
      legal_name,
      is_active,
      create_date,
      write_date
    ) VALUES (
      v_parent,
      v_root_org,
      r.org_unit_type_id,
      r.code,
      v_slug,
      r.name,
      r.is_active,
      COALESCE(r.create_date, now()),
      COALESCE(r.write_date, now())
    )
    RETURNING id INTO v_new_org;

    INSERT INTO cfms_tmp_org_map (legacy_id, new_org_id) VALUES (r.id, v_new_org);
  END LOOP;
END
$cfms$;

-- ── 2. Drop obsolete foreign keys referencing org_units ────────────────────────
ALTER TABLE "complaints" DROP CONSTRAINT IF EXISTS "complaints_assigned_to_org_unit_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_org_unit_id_fkey";
ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_org_unit_id_fkey";
ALTER TABLE "org_units" DROP CONSTRAINT IF EXISTS "org_units_parent_id_fkey";

-- ── 3. Drop the legacy columns ─────────────────────────────────────────────────
ALTER TABLE "complaints" DROP COLUMN IF EXISTS "assigned_to_org_unit_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "org_unit_id";
ALTER TABLE "user_roles" DROP COLUMN IF EXISTS "org_unit_id";

-- ── 4. Physically remove the obsolete org_units table (and its parent_id) ──────
DROP TABLE IF EXISTS "org_units";

-- ── 5. Remove the empty transition map (no remaining active purpose) ───────────
DROP TABLE IF EXISTS "_legacy_org_unit_map";