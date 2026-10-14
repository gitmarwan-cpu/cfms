-- GAP-06: durable in-app notification delivery for SLA escalation events.

ALTER TABLE "notifications"
  ADD COLUMN "idempotency_key" VARCHAR(255);

CREATE UNIQUE INDEX "notifications_idempotency_key_key"
  ON "notifications"("idempotency_key");

CREATE TABLE "notification_outbox" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "complaint_id" INTEGER NOT NULL,
    "recipient_user_id" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "notification_type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL,
    "locked_until" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_outbox_idempotency_key_key"
  ON "notification_outbox"("idempotency_key");
CREATE INDEX "notification_outbox_claim"
  ON "notification_outbox"("status", "next_attempt_at", "locked_until");
CREATE INDEX "notification_outbox_complaint"
  ON "notification_outbox"("organization_id", "complaint_id");

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "notification_outbox_complaint_id_fkey"
  FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "notification_outbox_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
