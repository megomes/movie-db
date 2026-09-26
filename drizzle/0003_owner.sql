ALTER TABLE "interests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "interests" CASCADE;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "owner_id" text;--> statement-breakpoint
CREATE INDEX "items_owner_idx" ON "items" USING btree ("owner_id");--> statement-breakpoint
-- Backlog importado do Obsidian pertence ao Matheus
UPDATE "items" SET "owner_id" = 'fe9c1881-2bc6-4474-9bf4-dab5925f655f' WHERE "owner_id" IS NULL;