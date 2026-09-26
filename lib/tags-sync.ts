import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Sincroniza tags a partir dos campos antigos (categoria do livro / consoles do jogo) — usado pela importação
export async function syncLegacyTags(ownerId: string) {
  await db.execute(sql`
    INSERT INTO tags (owner_id, kind, name, position)
    SELECT owner_id, kind, v, 99 FROM (
      SELECT owner_id, kind, category AS v FROM items WHERE owner_id = ${ownerId} AND kind = book AND category IS NOT NULL
      UNION SELECT owner_id, kind, unnest(my_platforms) FROM items WHERE owner_id = ${ownerId} AND kind = game
    ) s ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    UPDATE items i SET tag_ids = ARRAY(SELECT t.id FROM tags t WHERE t.owner_id = i.owner_id AND t.kind = i.kind
      AND (t.name = i.category OR t.name = ANY(i.my_platforms)) ORDER BY t.position)
    WHERE i.owner_id = ${ownerId} AND i.kind IN (book,game) AND cardinality(i.tag_ids) = 0`);
}
