CREATE TABLE "metacritic_lists" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"group" text NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
