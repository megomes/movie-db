DROP INDEX "switch_games_owner_title";--> statement-breakpoint
ALTER TABLE "switch_games" ADD COLUMN "platform" text DEFAULT 'switch' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "switch_games_owner_platform_title" ON "switch_games" USING btree ("owner_id","platform","title");