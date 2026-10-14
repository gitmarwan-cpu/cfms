-- GAP-01: Escalation responsibility snapshots
-- Adds nullable point-in-time assignment snapshot columns to complaint_escalation_events.
-- These fields capture the complaint's assigned user and organization at the exact moment
-- of escalation. They are written once and never mutated by later reassignment.

ALTER TABLE "complaint_escalation_events"
  ADD COLUMN "assigned_to_user_id" INTEGER,
  ADD COLUMN "assigned_to_organization_id" INTEGER;

ALTER TABLE "complaint_escalation_events"
  ADD CONSTRAINT "complaint_escalation_events_assigned_to_user_id_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "complaint_escalation_events"
  ADD CONSTRAINT "complaint_escalation_events_assigned_to_organization_id_fkey"
    FOREIGN KEY ("assigned_to_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
