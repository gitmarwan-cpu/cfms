-- Add nullable country_id FK on organizations → countries.
-- ON DELETE RESTRICT / ON UPDATE CASCADE.
-- Keep organizations.country unchanged for backward compatibility.

-- Step 1: Add the column (nullable).

ALTER TABLE "organizations"
ADD COLUMN "country_id" INTEGER;

-- Step 2: Add the foreign key constraint.

ALTER TABLE "organizations"
ADD CONSTRAINT "organizations_country_id_fkey"
FOREIGN KEY ("country_id")
REFERENCES "countries"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Step 3: Add index on country_id.

CREATE INDEX "organizations_country_id"
ON "organizations"("country_id");

-- Step 4: Backfill existing organization data.
-- Validate Yemen mapping before updating.
-- Do not fail when no organization exists (e.g. empty test database).

DO $$
BEGIN

  -- Validate deterministic country mapping.
  IF NOT EXISTS (
    SELECT 1
    FROM countries
    WHERE id = 1
      AND name_en = 'Yemen'
  ) THEN
    RAISE EXCEPTION
      'Backfill aborted: countries.id=1 is not Yemen';
  END IF;

  -- Backfill existing organizations only.
  -- If no matching organization exists, nothing is updated.
  UPDATE organizations
  SET country_id = 1
  WHERE country = 'Yemen';

END;
$$;