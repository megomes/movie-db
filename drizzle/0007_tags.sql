CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" "item_kind" NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "tag_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_owner_kind_name" ON "tags" USING btree ("owner_id","kind","name");--> statement-breakpoint
-- Categorias de livro (Obsidian) viram tags
INSERT INTO "tags" ("owner_id", "kind", "name", "position")
SELECT "owner_id", 'book', "category", (row_number() OVER (PARTITION BY "owner_id" ORDER BY count(*) DESC))::int
FROM "items" WHERE "kind" = 'book' AND "category" IS NOT NULL GROUP BY "owner_id", "category";--> statement-breakpoint
-- Consoles dos jogos viram tags
INSERT INTO "tags" ("owner_id", "kind", "name", "position")
SELECT i."owner_id", 'game', p, (row_number() OVER (PARTITION BY i."owner_id" ORDER BY count(*) DESC))::int
FROM "items" i, unnest(i."my_platforms") AS p WHERE i."kind" = 'game' GROUP BY i."owner_id", p;--> statement-breakpoint
UPDATE "items" i SET "tag_ids" = ARRAY(
  SELECT t."id" FROM "tags" t
  WHERE t."owner_id" = i."owner_id" AND t."kind" = i."kind" AND (t."name" = i."category" OR t."name" = ANY(i."my_platforms"))
  ORDER BY t."position"
) WHERE i."kind" IN ('book', 'game');
