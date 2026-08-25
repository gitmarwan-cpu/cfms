-- Standardize Database Audit Metadata across applicable business tables:
-- create_date TIMESTAMPTZ NOT NULL
-- write_date TIMESTAMPTZ NOT NULL
-- create_uid INTEGER NULL (FK -> users(id) ON DELETE SET NULL)
-- write_uid INTEGER NULL (FK -> users(id) ON DELETE SET NULL)

-- 1. complainants
ALTER TABLE "complainants" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "complainants" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "complainants" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "complainants" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "complainants" ADD CONSTRAINT "complainants_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "complainants" ADD CONSTRAINT "complainants_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. complaint_attachments
ALTER TABLE "complaint_attachments" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "complaint_attachments" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "complaint_attachments" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "complaint_attachments" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. complaints
ALTER TABLE "complaints" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "complaints" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "complaints" RENAME COLUMN "created_by_user_id" TO "create_uid";
ALTER TABLE "complaints" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER INDEX "complaints_organization_id_created_at" RENAME TO "complaints_organization_id_create_date";

-- 4. countries
ALTER TABLE "countries" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "countries" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "countries" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "countries" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "countries" ADD CONSTRAINT "countries_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "countries" ADD CONSTRAINT "countries_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. districts
ALTER TABLE "districts" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "districts" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "districts" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "districts" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "districts" ADD CONSTRAINT "districts_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "districts" ADD CONSTRAINT "districts_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. governorates
ALTER TABLE "governorates" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "governorates" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "governorates" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "governorates" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "governorates" ADD CONSTRAINT "governorates_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. groups
ALTER TABLE "groups" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "groups" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "groups" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "groups" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "groups" ADD CONSTRAINT "groups_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 8. org_unit_types
ALTER TABLE "org_unit_types" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "org_unit_types" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "org_unit_types" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "org_unit_types" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "org_unit_types" ADD CONSTRAINT "org_unit_types_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "org_unit_types" ADD CONSTRAINT "org_unit_types_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. org_units
ALTER TABLE "org_units" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "org_units" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "org_units" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "org_units" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 10. organizations
ALTER TABLE "organizations" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "organizations" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "organizations" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "organizations" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 11. permissions
ALTER TABLE "permissions" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "permissions" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "permissions" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "permissions" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 12. reference_list_items
ALTER TABLE "reference_list_items" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "reference_list_items" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "reference_list_items" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "reference_list_items" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "reference_list_items" ADD CONSTRAINT "reference_list_items_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reference_list_items" ADD CONSTRAINT "reference_list_items_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 13. reference_lists
ALTER TABLE "reference_lists" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "reference_lists" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "reference_lists" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "reference_lists" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "reference_lists" ADD CONSTRAINT "reference_lists_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reference_lists" ADD CONSTRAINT "reference_lists_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 14. roles
ALTER TABLE "roles" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "roles" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "roles" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "roles" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "roles" ADD CONSTRAINT "roles_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 15. sla_rules
ALTER TABLE "sla_rules" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "sla_rules" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "sla_rules" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "sla_rules" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "sla_rules" ADD CONSTRAINT "sla_rules_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sla_rules" ADD CONSTRAINT "sla_rules_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 16. user_groups
ALTER TABLE "user_groups" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "user_groups" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "user_groups" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "user_groups" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 17. user_organizations
ALTER TABLE "user_organizations" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "user_organizations" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "user_organizations" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "user_organizations" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 18. user_roles
ALTER TABLE "user_roles" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "user_roles" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "user_roles" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "user_roles" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 19. users
ALTER TABLE "users" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "users" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "users" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "users" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "users" ADD CONSTRAINT "users_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 20. workflow_definitions
ALTER TABLE "workflow_definitions" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "workflow_definitions" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "workflow_definitions" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "workflow_definitions" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 21. workflow_states
ALTER TABLE "workflow_states" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "workflow_states" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "workflow_states" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "workflow_states" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 22. workflow_transitions
ALTER TABLE "workflow_transitions" RENAME COLUMN "created_at" TO "create_date";
ALTER TABLE "workflow_transitions" RENAME COLUMN "updated_at" TO "write_date";
ALTER TABLE "workflow_transitions" ADD COLUMN "create_uid" INTEGER;
ALTER TABLE "workflow_transitions" ADD COLUMN "write_uid" INTEGER;
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_create_uid_fkey" FOREIGN KEY ("create_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_write_uid_fkey" FOREIGN KEY ("write_uid") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
