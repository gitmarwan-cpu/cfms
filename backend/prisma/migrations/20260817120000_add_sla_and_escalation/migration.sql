-- Organization-scoped SLA rules, complaint SLA tracking fields, and escalation history.
CREATE TABLE "sla_rules" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "complaint_type" "enum_complaints_type",
    "category_item_id" INTEGER,
    "is_sensitive" BOOLEAN,
    "first_response_hours" INTEGER NOT NULL,
    "resolution_hours" INTEGER NOT NULL,
    "escalation_interval_hours" INTEGER NOT NULL,
    "max_escalation_level" INTEGER NOT NULL DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sla_rules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sla_rules"
ADD CONSTRAINT "sla_rules_hours_check"
CHECK (
    "first_response_hours" > 0
    AND "resolution_hours" > 0
    AND "escalation_interval_hours" > 0
    AND "max_escalation_level" >= 1
    AND "max_escalation_level" <= 10
    AND "resolution_hours" >= "first_response_hours"
);

CREATE INDEX "sla_rules_organization_id" ON "sla_rules"("organization_id");
CREATE INDEX "sla_rules_organization_active" ON "sla_rules"("organization_id", "is_active");

CREATE UNIQUE INDEX "sla_rules_match_key_active_unique"
ON "sla_rules" (
    "organization_id",
    COALESCE("complaint_type", 'complaint'::"enum_complaints_type"),
    COALESCE("category_item_id", 0),
    (CASE WHEN "is_sensitive" IS TRUE THEN 1 WHEN "is_sensitive" IS FALSE THEN 0 ELSE -1 END)
)
WHERE "is_active" = true;

ALTER TABLE "sla_rules"
ADD CONSTRAINT "sla_rules_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_rules"
ADD CONSTRAINT "sla_rules_category_item_id_fkey"
FOREIGN KEY ("category_item_id") REFERENCES "reference_list_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "complaints"
ADD COLUMN "sla_rule_id" INTEGER,
ADD COLUMN "sla_due_at" TIMESTAMPTZ(6),
ADD COLUMN "sla_first_response_due_at" TIMESTAMPTZ(6),
ADD COLUMN "sla_first_responded_at" TIMESTAMPTZ(6),
ADD COLUMN "sla_status" VARCHAR(30) NOT NULL DEFAULT 'none',
ADD COLUMN "escalation_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_escalated_at" TIMESTAMPTZ(6);

ALTER TABLE "complaints"
ADD CONSTRAINT "complaints_sla_status_check"
CHECK ("sla_status" IN ('none', 'on_track', 'overdue', 'met'));

ALTER TABLE "complaints"
ADD CONSTRAINT "complaints_escalation_level_check"
CHECK ("escalation_level" >= 0);

CREATE INDEX "complaints_sla_rule_id" ON "complaints"("sla_rule_id");
CREATE INDEX "complaints_organization_sla_due_at" ON "complaints"("organization_id", "sla_due_at");
CREATE INDEX "complaints_organization_sla_status" ON "complaints"("organization_id", "sla_status");

ALTER TABLE "complaints"
ADD CONSTRAINT "complaints_sla_rule_id_fkey"
FOREIGN KEY ("sla_rule_id") REFERENCES "sla_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "complaint_escalation_events" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "complaint_id" INTEGER NOT NULL,
    "sla_rule_id" INTEGER,
    "from_level" INTEGER NOT NULL,
    "to_level" INTEGER NOT NULL,
    "reason" VARCHAR(60) NOT NULL,
    "note" TEXT,
    "triggered_by_user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "complaint_escalation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "complaint_escalation_events_complaint_id" ON "complaint_escalation_events"("complaint_id");
CREATE INDEX "complaint_escalation_events_organization_created_at" ON "complaint_escalation_events"("organization_id", "created_at");

ALTER TABLE "complaint_escalation_events"
ADD CONSTRAINT "complaint_escalation_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "complaint_escalation_events"
ADD CONSTRAINT "complaint_escalation_events_complaint_id_fkey"
FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "complaint_escalation_events"
ADD CONSTRAINT "complaint_escalation_events_sla_rule_id_fkey"
FOREIGN KEY ("sla_rule_id") REFERENCES "sla_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "complaint_escalation_events"
ADD CONSTRAINT "complaint_escalation_events_triggered_by_user_id_fkey"
FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
