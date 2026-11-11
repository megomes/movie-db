CREATE TABLE "switch_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"size_mb" integer NOT NULL,
	"igdb_id" integer,
	"cover_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "switch_games_owner_title" ON "switch_games" USING btree ("owner_id","title");