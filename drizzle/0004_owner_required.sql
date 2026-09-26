ALTER TABLE "items" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "added_by";