CREATE TABLE "youtube_likes" (
	"video_id" text PRIMARY KEY NOT NULL,
	"views" bigint NOT NULL,
	"likes" integer,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
