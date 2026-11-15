DROP TABLE "trailer_games" CASCADE;--> statement-breakpoint
ALTER TABLE "metacritic_lists" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'mc' NOT NULL;