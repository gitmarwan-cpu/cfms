-- Add the nullable relationship reference omitted from the initial Prisma baseline.
ALTER TABLE "complainants"
ADD COLUMN IF NOT EXISTS "relationship_item_id" INTEGER;
