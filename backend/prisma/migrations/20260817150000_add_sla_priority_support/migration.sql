-- Add priority_item_id to sla_rules and complaints
ALTER TABLE "sla_rules" ADD COLUMN "priority_item_id" INTEGER;
ALTER TABLE "complaints" ADD COLUMN "priority_item_id" INTEGER;

-- Drop previous active unique match key index
DROP INDEX IF EXISTS "sla_rules_match_key_active_unique";

-- Re-create unique active index incorporating priority_item_id
CREATE UNIQUE INDEX "sla_rules_match_key_active_unique"
ON "sla_rules" (
    "organization_id",
    COALESCE("complaint_type", 'complaint'::"enum_complaints_type"),
    COALESCE("category_item_id", 0),
    (CASE WHEN "is_sensitive" IS TRUE THEN 1 WHEN "is_sensitive" IS FALSE THEN 0 ELSE -1 END),
    COALESCE("priority_item_id", 0)
)
WHERE "is_active" = true;

-- Indexes for priority_item_id
CREATE INDEX "sla_rules_priority_item_id" ON "sla_rules"("priority_item_id");
CREATE INDEX "complaints_priority_item_id" ON "complaints"("priority_item_id");

-- Foreign key constraints
ALTER TABLE "sla_rules"
ADD CONSTRAINT "sla_rules_priority_item_id_fkey"
FOREIGN KEY ("priority_item_id") REFERENCES "reference_list_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "complaints"
ADD CONSTRAINT "complaints_priority_item_id_fkey"
FOREIGN KEY ("priority_item_id") REFERENCES "reference_list_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
