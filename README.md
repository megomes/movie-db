# Backlog

PWA para 2–3 pessoas guardarem filmes, séries, jogos e livros que querem ver, com onde encontrar cada um no Brasil. Depois de visto, sai da lista.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind 4
- Neon Postgres + Drizzle, login com Google via Neon Auth (lista de e-mails em `ALLOWED_EMAILS`)
- Vercel (cron diário em `vercel.json`)

## Fontes de dados

| Tipo | Dados | Nota | Onde |
|---|---|---|---|
| Filmes/séries | TMDB | OMDb (IMDb, RT, Metacritic) | TMDB watch/providers `BR` (JustWatch) |
| Jogos | IGDB | IGDB | Steam (preço BRL), Game Pass cloud |
| Livros | Google Books | Hardcover | links Amazon/Kindle/Skoob |

## Scripts

```bash
npm run dev
npm run db:generate && npm run db:migrate   # após mudar lib/db/schema.ts
npm run import:obsidian                     # importa o backlog do Obsidian (idempotente)
npm run import:obsidian -- --recheck        # refaz a correspondência dos itens em revisão
npx tsx --env-file=.env.local scripts/rescore.ts
```

Variáveis de ambiente: veja os comentários em `.env.local` (não versionado).
