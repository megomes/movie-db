CREATE TABLE "trailer_games" (
	"igdb_id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"views" bigint NOT NULL,
	"video_count" integer NOT NULL,
	"videos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"platforms" integer[] DEFAULT '{}' NOT NULL,
	"release_date" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
