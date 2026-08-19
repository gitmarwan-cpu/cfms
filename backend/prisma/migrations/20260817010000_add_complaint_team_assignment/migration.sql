-- Optional team/org-unit ownership for complaints (individual assignment preserved).
ALTER TABLE "complaints"
ADD COLUMN "assigned_to_org_unit_id" INTEGER;

CREATE INDEX "complaints_assigned_to_org_unit_id" ON "complaints"("assigned_to_org_unit_id");

ALTER TABLE "complaints"
ADD CONSTRAINT "complaints_assigned_to_org_unit_id_fkey"
FOREIGN KEY ("assigned_to_org_unit_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
