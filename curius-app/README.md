<div align="center">
  <img src="public/illustrations/compass.png" alt="Curius Atlas" width="120" />
  <h1>Curius Atlas</h1>
  <p><i>A map of what curious people on the internet are actually reading.</i></p>
  <p>
    <a href="https://curius-app.vercel.app">→ curius-app.vercel.app</a>
  </p>
</div>

## How it works

Two TypeScript cron jobs on Railway sync new saves from the [Curius](https://curius.app) public API and classify each one with an LLM into 6 topics × 31 subtopics. Everything writes to Supabase Postgres. The Next.js frontend reads that and renders:

- **Launch** — get fired into a random corner of the internet
- **Explore** — browse by topic, ranked by *convergence* (multiple curators saving the same thing as the quality signal)
- **Trending** — what people are saving right now
- **Roots** — which domains the community draws from most
- **Atlas** — d3 visualization of the long tail
- **Search** — text search across the corpus

Currently indexes ~183k bookmarks from ~6k curators.

## Stack

Next.js 15 · Tailwind · shadcn/ui · d3 · Supabase Postgres · Railway crons · Vercel

## Notable parts

If you want to skim the interesting bits:

- [`scripts/scraper/cron.ts`](scripts/scraper/cron.ts) — daily Railway pipeline (Curius API → dedupe → Supabase upsert → LLM classify, all in one file)
- [`scripts/scraper/categorizer.ts`](scripts/scraper/categorizer.ts) — LLM classification with the taxonomy
- [`components/viz/`](components/viz) — three d3 visualizations (`TasteMap`, `LongTail`, `Zeitgeist`) built directly against the corpus data
- [`app/api/stats/convergence`](app/api/stats/convergence) — the convergence ranking query that powers Trending

## Local dev

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Requires a `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing at your own Supabase project.

## Why this exists

Algorithms collapse the internet toward the mean — clicks win, variance loses, and AI slop fills the gap. But thousands of curious people are still saving genuinely good things to Curius every day. They are, in effect, a distributed editorial layer for the long tail.

This is a UI on top of their taste — not a feed, an atlas. The bet is that the internet isn't dead; the algorithms are just bad at finding what's still alive.

## Credits

Built by [Shiv](https://github.com/shivsid1). Data sourced from [Curius](https://curius.app).
