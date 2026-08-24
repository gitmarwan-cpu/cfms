-- Step 1: Add nullable district_id column on organizations.
ALTER TABLE "organizations" ADD COLUMN "district_id" INTEGER;

-- Step 2: Add foreign key constraint to districts(id).
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 3: Add index on district_id.
CREATE INDEX "organizations_district_id" ON "organizations"("district_id");
