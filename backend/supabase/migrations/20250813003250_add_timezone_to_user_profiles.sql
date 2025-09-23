ALTER TABLE "public"."user_profiles" 
ADD COLUMN "timezone" text DEFAULT 'America/New_York';

UPDATE "public"."user_profiles" 
SET "timezone" = 'America/New_York' 
WHERE "timezone" IS NULL;
