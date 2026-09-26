import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  real,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const kindEnum = pgEnum("item_kind", ["movie", "series", "game", "book"]);
export const matchStatusEnum = pgEnum("match_status", ["matched", "needs_review", "unmatched"]);

export type Kind = (typeof kindEnum.enumValues)[number];

export type Provider = { id: number; name: string; logo: string | null };

export type Availability = {
  link?: string | null;
  flatrate?: Provider[];
  free?: Provider[];
  ads?: Provider[];
  rent?: Provider[];
  buy?: Provider[];
};

export type Ratings = {
  imdb?: number | null;
  imdbVotes?: number | null;
  rottenTomatoes?: number | null;
  metacritic?: number | null;
  tmdb?: number | null;
  igdb?: number | null;
  igdbCount?: number | null;
  igdbCritic?: number | null;
  igdbCriticCount?: number | null;
  hardcover?: number | null;
  hardcoverCount?: number | null;
};

export type SteamPrice = {
  appId: string;
  final: number | null;
  initial: number | null;
  discountPercent: number;
  formatted: string | null;
  isFree: boolean;
};

export type CastMember = { name: string; role: string | null; photo: string | null };

export type Candidate = {
  externalId: string;
  title: string;
  year: number | null;
  cover: string | null;
  subtitle: string | null;
};

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: kindEnum("kind").notNull(),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    year: integer("year"),
    coverUrl: text("cover_url"),
    backdropUrl: text("backdrop_url"),
    overview: text("overview"),
    genres: text("genres").array().notNull().default([]),
    creators: text("creators").array().notNull().default([]),
    cast: jsonb("cast").$type<CastMember[]>().notNull().default([]),

    // Tempo pra consumir, normalizado em minutos (filme: duração; série: total estimado; jogo: tempo pra zerar; livro: páginas * 1.5)
    minutes: integer("minutes"),
    runtimeMinutes: integer("runtime_minutes"),
    seasons: integer("seasons"),
    episodes: integer("episodes"),
    pages: integer("pages"),

    // Jogos
    platforms: text("platforms").array().notNull().default([]),
    myPlatforms: text("my_platforms").array().notNull().default([]),
    gamePass: boolean("game_pass").notNull().default(false),
    steamPrice: jsonb("steam_price").$type<SteamPrice | null>(),

    // Livros
    category: text("category"),

    // IDs externos
    tmdbId: integer("tmdb_id"),
    imdbId: text("imdb_id"),
    igdbId: integer("igdb_id"),
    steamAppId: text("steam_app_id"),
    googleBooksId: text("google_books_id"),
    hardcoverSlug: text("hardcover_slug"),
    isbn: text("isbn"),

    ratings: jsonb("ratings").$type<Ratings>().notNull().default({}),
    // Nota normalizada 0-10 para ordenação
    score: real("score"),
    availability: jsonb("availability").$type<Availability>().notNull().default({}),

    summary: text("summary"),
    notes: text("notes"),
    priority: integer("priority"),

    matchStatus: matchStatusEnum("match_status").notNull().default("matched"),
    candidates: jsonb("candidates").$type<Candidate[]>().notNull().default([]),
    searchQuery: text("search_query"),

    source: text("source").notNull().default("manual"),
    sourcePath: text("source_path"),
    addedBy: text("added_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    enrichedAt: timestamp("enriched_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    index("items_kind_idx").on(t.kind),
    index("items_match_idx").on(t.matchStatus),
    index("items_done_idx").on(t.doneAt),
  ],
);

export const interests = pgTable(
  "interests",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.userId] })],
);

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  image: text("image"),
  providerIds: integer("provider_ids").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  userId: text("user_id").notNull(),
  keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
