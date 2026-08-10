-- Baseline migration representing the current intended application schema.
--
-- Created from verified read-only inspection of the live `cfms_db` PostgreSQL
-- database and `backend/prisma/schema.prisma`.
--
-- This baseline:
--   * Creates the 23 active application tables (Sequelize-managed snake_case schema).
--   * Creates the 3 active enums.
--   * Preserves the 5 COALESCE expression indexes as raw SQL (Prisma cannot represent them).
--   * Does NOT create stale Prisma artifacts (AuditLog, Complaint, User tables and
--     Role / ComplaintStatus / ComplaintPriority enums) - they remain @@ignore'd.
--   * Does NOT create tracking tables (_prisma_migrations, SequelizeMeta).

-- Enums
CREATE TYPE "enum_complaints_status" AS ENUM ('new', 'in_review', 'resolved', 'closed', 'rejected');
CREATE TYPE "enum_complaints_type" AS ENUM ('complaint', 'proposal');
CREATE TYPE "enum_organizations_anonymous_complaints_policy" AS ENUM ('allowed', 'not_allowed', 'optional');

-- countries
CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "iso2" VARCHAR(2) NOT NULL,
    "iso3" VARCHAR(3),
    "name_ar" VARCHAR(150) NOT NULL,
    "name_en" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- governorates
CREATE TABLE "governorates" (
    "id" SERIAL NOT NULL,
    "name_en" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "country_id" INTEGER NOT NULL,
    CONSTRAINT "governorates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "governorates_name_en_key" ON "governorates"("name_en");
CREATE INDEX "governorates_country_id" ON "governorates"("country_id");
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- districts
CREATE TABLE "districts" (
    "id" SERIAL NOT NULL,
    "name_en" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "governorate_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "districts_gov_name_en_unique" ON "districts"("governorate_id", "name_en");
CREATE INDEX "districts_governorate_id" ON "districts"("governorate_id");
ALTER TABLE "districts" ADD CONSTRAINT "districts_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- organizations
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "short_name" VARCHAR(80),
    "logo_url" VARCHAR(500),
    "favicon_url" VARCHAR(500),
    "description" TEXT,
    "vision" TEXT,
    "mission" TEXT,
    "phone" VARCHAR(30),
    "email" VARCHAR(150),
    "website" VARCHAR(255),
    "country" VARCHAR(100) NOT NULL DEFAULT 'Yemen',
    "governorate_id" INTEGER,
    "city" VARCHAR(150),
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "default_language" VARCHAR(10) NOT NULL DEFAULT 'ar',
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Aden',
    "date_format" VARCHAR(30) NOT NULL DEFAULT 'DD/MM/YYYY',
    "primary_color" VARCHAR(20) NOT NULL DEFAULT '#0e5f66',
    "secondary_color" VARCHAR(20) NOT NULL DEFAULT '#0a464b',
    "accent_color" VARCHAR(20) NOT NULL DEFAULT '#c77b3f',
    "anonymous_complaints_policy" "enum_organizations_anonymous_complaints_policy" NOT NULL DEFAULT 'allowed',
    "notification_settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug" ON "organizations"("slug");
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- complainants
CREATE TABLE "complainants" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "full_name" VARCHAR(150),
    "phone" VARCHAR(30),
    "email" VARCHAR(150),
    "gender_item_id" INTEGER,
    "age_group_item_id" INTEGER,
    "beneficiary_external_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "complainants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "complainants_organization_id" ON "complainants"("organization_id");
CREATE INDEX "complainants_organization_id_phone" ON "complainants"("organization_id", "phone");
ALTER TABLE "complainants" ADD CONSTRAINT "complainants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- reference_lists
CREATE TABLE "reference_lists" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "name_en" VARCHAR(150),
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "organization_id" INTEGER,
    CONSTRAINT "reference_lists_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reference_lists_organization_id" ON "reference_lists"("organization_id");
ALTER TABLE "reference_lists" ADD CONSTRAINT "reference_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
-- Expression index (raw SQL - Prisma cannot represent COALESCE uniqueness)
CREATE UNIQUE INDEX "reference_lists_key_scope_unique" ON "reference_lists"("key", COALESCE("organization_id", 0));

-- reference_list_items
CREATE TABLE "reference_list_items" (
    "id" SERIAL NOT NULL,
    "reference_list_id" INTEGER NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "label_ar" VARCHAR(150) NOT NULL,
    "label_en" VARCHAR(150),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "reference_list_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reference_list_items_list_code_unique" ON "reference_list_items"("reference_list_id", "code");
CREATE INDEX "reference_list_items_reference_list_id_is_active" ON "reference_list_items"("reference_list_id", "is_active");
ALTER TABLE "reference_list_items" ADD CONSTRAINT "reference_list_items_reference_list_id_fkey" FOREIGN KEY ("reference_list_id") REFERENCES "reference_lists"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- org_unit_types
CREATE TABLE "org_unit_types" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "hierarchy_level" INTEGER NOT NULL DEFAULT 1,
    "allowed_parent_type_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "org_unit_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "org_unit_types_org_code_unique" ON "org_unit_types"("organization_id", "code");
ALTER TABLE "org_unit_types" ADD CONSTRAINT "org_unit_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "org_unit_types" ADD CONSTRAINT "org_unit_types_allowed_parent_type_id_fkey" FOREIGN KEY ("allowed_parent_type_id") REFERENCES "org_unit_types"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- org_units (manager_user_id FK added after users to resolve circular dependency)
CREATE TABLE "org_units" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "org_unit_type_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(60),
    "manager_user_id" INTEGER,
    "phone" VARCHAR(30),
    "email" VARCHAR(150),
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "org_units_org_unit_type_id" ON "org_units"("org_unit_type_id");
CREATE INDEX "org_units_organization_id" ON "org_units"("organization_id");
CREATE INDEX "org_units_parent_id" ON "org_units"("parent_id");
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_org_unit_type_id_fkey" FOREIGN KEY ("org_unit_type_id") REFERENCES "org_unit_types"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "org_units"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- users
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "org_unit_id" INTEGER,
    "default_organization_id" INTEGER,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_default_organization_id" ON "users"("default_organization_id");
ALTER TABLE "users" ADD CONSTRAINT "users_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_default_organization_id_fkey" FOREIGN KEY ("default_organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- org_units.manager_user_id FK (circular dependency resolved)
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- roles
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "organization_id" INTEGER,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "roles_organization_id" ON "roles"("organization_id");
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
-- Expression index (raw SQL - Prisma cannot represent COALESCE uniqueness)
CREATE UNIQUE INDEX "roles_code_scope_unique" ON "roles"("code", COALESCE("organization_id", 0));

-- permissions
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "module" VARCHAR(60) NOT NULL,
    "description_ar" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "permissions_module" ON "permissions"("module");

-- role_permissions
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "role_permissions_unique" ON "role_permissions"("role_id", "permission_id");
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- user_roles
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "org_unit_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "organization_id" INTEGER NOT NULL,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_roles_organization_id" ON "user_roles"("organization_id");
CREATE INDEX "user_roles_user_id" ON "user_roles"("user_id");
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
-- Expression index (raw SQL - Prisma cannot represent COALESCE uniqueness)
CREATE UNIQUE INDEX "user_roles_scope_unique" ON "user_roles"("user_id", "role_id", "organization_id", COALESCE("org_unit_id", 0));

-- user_organizations
CREATE TABLE "user_organizations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_organizations_unique" ON "user_organizations"("user_id", "organization_id");
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- groups
CREATE TABLE "groups" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "organization_id" INTEGER,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "groups_organization_id" ON "groups"("organization_id");
ALTER TABLE "groups" ADD CONSTRAINT "groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
-- Expression index (raw SQL - Prisma cannot represent COALESCE uniqueness)
CREATE UNIQUE INDEX "groups_code_scope_unique" ON "groups"("code", COALESCE("organization_id", 0));

-- group_roles
CREATE TABLE "group_roles" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "group_roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "group_roles_unique" ON "group_roles"("group_id", "role_id");
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- user_groups
CREATE TABLE "user_groups" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_groups_unique" ON "user_groups"("user_id", "group_id", "organization_id");
CREATE INDEX "user_groups_user_id" ON "user_groups"("user_id");
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- workflow_definitions
CREATE TABLE "workflow_definitions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "organization_id" INTEGER,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "entity_type" VARCHAR(60) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workflow_definitions_entity_type" ON "workflow_definitions"("entity_type");
CREATE INDEX "workflow_definitions_organization_id" ON "workflow_definitions"("organization_id");
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
-- Expression index (raw SQL - Prisma cannot represent COALESCE uniqueness)
CREATE UNIQUE INDEX "workflow_definitions_code_scope_unique" ON "workflow_definitions"("code", COALESCE("organization_id", 0));

-- workflow_states
CREATE TABLE "workflow_states" (
    "id" SERIAL NOT NULL,
    "workflow_definition_id" INTEGER NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_states_definition_code_unique" ON "workflow_states"("workflow_definition_id", "code");
CREATE INDEX "workflow_states_workflow_definition_id" ON "workflow_states"("workflow_definition_id");
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- workflow_transitions
CREATE TABLE "workflow_transitions" (
    "id" SERIAL NOT NULL,
    "workflow_definition_id" INTEGER NOT NULL,
    "from_state_id" INTEGER,
    "to_state_id" INTEGER NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "requires_permission" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_transitions_definition_code_unique" ON "workflow_transitions"("workflow_definition_id", "code");
CREATE INDEX "workflow_transitions_workflow_definition_id" ON "workflow_transitions"("workflow_definition_id");
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "workflow_states"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "workflow_states"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- complaints
CREATE TABLE "complaints" (
    "id" SERIAL NOT NULL,
    "reference_code" VARCHAR(20) NOT NULL,
    "type" "enum_complaints_type" NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "governorate_id" INTEGER NOT NULL,
    "district_id" INTEGER NOT NULL,
    "village" VARCHAR(150),
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "desired_resolution" TEXT,
    "status" "enum_complaints_status" NOT NULL DEFAULT 'new',
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "assigned_to_user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "category_item_id" INTEGER NOT NULL,
    "channel_item_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "complainant_id" INTEGER,
    "tracking_pin_hash" VARCHAR(255),
    "created_by_user_id" INTEGER,
    "project_reference_code" VARCHAR(150),
    "is_related_to_staff" BOOLEAN NOT NULL DEFAULT false,
    "related_staff_name" VARCHAR(150),
    "related_staff_position" VARCHAR(150),
    "staff_incident_details" TEXT,
    "workflow_state_id" INTEGER,
    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "complaints_reference_code_key" ON "complaints"("reference_code");
CREATE INDEX "complaints_category_item_id" ON "complaints"("category_item_id");
CREATE INDEX "complaints_channel_item_id" ON "complaints"("channel_item_id");
CREATE INDEX "complaints_complainant_id" ON "complaints"("complainant_id");
CREATE INDEX "complaints_district_id" ON "complaints"("district_id");
CREATE INDEX "complaints_governorate_id" ON "complaints"("governorate_id");
CREATE INDEX "complaints_is_sensitive" ON "complaints"("is_sensitive");
CREATE INDEX "complaints_organization_id" ON "complaints"("organization_id");
CREATE INDEX "complaints_organization_id_created_at" ON "complaints"("organization_id", "created_at");
CREATE INDEX "complaints_status" ON "complaints"("status");
CREATE INDEX "complaints_workflow_state_id" ON "complaints"("workflow_state_id");
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_category_item_id_fkey" FOREIGN KEY ("category_item_id") REFERENCES "reference_list_items"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_channel_item_id_fkey" FOREIGN KEY ("channel_item_id") REFERENCES "reference_list_items"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_complainant_id_fkey" FOREIGN KEY ("complainant_id") REFERENCES "complainants"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_workflow_state_id_fkey" FOREIGN KEY ("workflow_state_id") REFERENCES "workflow_states"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- complaint_attachments
CREATE TABLE "complaint_attachments" (
    "id" SERIAL NOT NULL,
    "complaint_id" INTEGER NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "stored_file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "complaint_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "complaint_attachments_complaint_id" ON "complaint_attachments"("complaint_id");
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- complaint_status_history
CREATE TABLE "complaint_status_history" (
    "id" SERIAL NOT NULL,
    "complaint_id" INTEGER NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "changed_by_user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "complaint_status_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "complaint_status_history_complaint_id" ON "complaint_status_history"("complaint_id");
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;