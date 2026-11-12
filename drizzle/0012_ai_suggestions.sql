CREATE TABLE "ai_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"igdb_id" integer NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"cover_url" text,
	"screenshots" text[] DEFAULT '{}' NOT NULL,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"rating" integer,
	"sources" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_suggestions_owner_igdb" ON "ai_suggestions" USING btree ("owner_id","igdb_id");