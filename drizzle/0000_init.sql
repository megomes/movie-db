CREATE TYPE "public"."item_kind" AS ENUM('movie', 'series', 'game', 'book');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('matched', 'needs_review', 'unmatched');--> statement-breakpoint
CREATE TABLE "interests" (
	"item_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interests_item_id_user_id_pk" PRIMARY KEY("item_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "item_kind" NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"year" integer,
	"cover_url" text,
	"backdrop_url" text,
	"overview" text,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"creators" text[] DEFAULT '{}' NOT NULL,
	"minutes" integer,
	"runtime_minutes" integer,
	"seasons" integer,
	"episodes" integer,
	"pages" integer,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"my_platforms" text[] DEFAULT '{}' NOT NULL,
	"game_pass" boolean DEFAULT false NOT NULL,
	"steam_price" jsonb,
	"category" text,
	"tmdb_id" integer,
	"imdb_id" text,
	"igdb_id" integer,
	"steam_app_id" text,
	"google_books_id" text,
	"hardcover_slug" text,
	"isbn" text,
	"ratings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" real,
	"availability" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"notes" text,
	"priority" integer,
	"match_status" "match_status" DEFAULT 'matched' NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_query" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_path" text,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enriched_at" timestamp with time zone,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"provider_ids" integer[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_kind_idx" ON "items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "items_match_idx" ON "items" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "items_done_idx" ON "items" USING btree ("done_at");