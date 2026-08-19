CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER,
    "actor_user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_organization_created_at" ON "audit_logs"("organization_id", "created_at");
CREATE INDEX "audit_logs_entity_created_at" ON "audit_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "audit_logs_actor_created_at" ON "audit_logs"("actor_user_id", "created_at");

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
