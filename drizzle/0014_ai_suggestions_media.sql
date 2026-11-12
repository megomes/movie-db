ALTER TABLE "ai_suggestions" ALTER COLUMN "igdb_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD COLUMN "kind" "item_kind" DEFAULT 'game' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD COLUMN "reasons" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_suggestions_owner_tmdb" ON "ai_suggestions" USING btree ("owner_id","kind","tmdb_id");