import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Sincroniza tags de livro a partir da categoria — usado pela importação. Jogos não têm tag: PC/Switch vêm do IGDB.
export async function syncLegacyTags(ownerId: string) {
  await db.execute(sql`
    INSERT INTO tags (owner_id, kind, name, position)
    SELECT owner_id, kind, v, 99 FROM (
      SELECT owner_id, kind, category AS v FROM items WHERE owner_id = ${ownerId} AND kind = book AND category IS NOT NULL
    ) s ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    UPDATE items i SET tag_ids = ARRAY(SELECT t.id FROM tags t WHERE t.owner_id = i.owner_id AND t.kind = i.kind
      AND t.name = i.category ORDER BY t.position)
    WHERE i.owner_id = ${ownerId} AND i.kind = book AND cardinality(i.tag_ids) = 0`);
}
