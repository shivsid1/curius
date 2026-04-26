# Curius Atlas

A map of what curious people on the internet are actually reading.

→ **Live:** [curius-app.vercel.app](https://curius-app.vercel.app)

## Why I built this

The internet is dying — or at least, the parts of it worth reading are getting harder to find.

Algorithms collapse everything toward the mean. Whatever optimizes for clicks gets surfaced; whatever doesn't, disappears. AI-generated slop now floods every feed, indistinguishable at a glance from the genuine article. The signal-to-noise ratio gets worse every year, and the result is a flatter, more homogeneous internet — the same takes, the same headlines, the same recycled threads.

What's missing is **variance**. The weird essay nobody clicked but two people refuse to forget. The obscure paper that quietly changed a field. The personal blog with thirty readers that's better than anything on the front page. This is the long tail of the internet — the part where genuine taste lives, and the part algorithms are structurally incapable of surfacing.

But quietly, thousands of curious people are still finding remarkable things and saving them to [Curius](https://curius.app). They are, in effect, a distributed editorial layer for the long tail. **Curius Atlas indexes their saves.** ~183k bookmarks from 6,000+ curators, classified across 6 topics and 31 subtopics, surfaced through patterns of human convergence rather than algorithmic optimization.

Not a feed. An atlas.

The bet is simple: the internet isn't dead, the algorithms are just bad at finding what's still alive. The fix isn't another model — it's listening to the people who already know where to look.

## How it works

Two TypeScript cron jobs on Railway. One syncs new saves from the Curius public API; the other classifies new bookmarks with an LLM. Everything writes to Supabase Postgres. The Next.js frontend reads that data and renders six views:

- **Launch** — get fired into a random corner of the internet
- **Explore** — browse by topic, with convergence (multiple curators saving the same thing) as the quality signal
- **Trending** — what curators are converging on right now
- **Roots** — the sources (domains) the community draws from most
- **Atlas** — long-tail visualization of the taste graph
- **Search** — text search across the corpus

## Stack

- **Frontend:** Next.js 15, Tailwind, shadcn/ui, d3 for visualizations
- **Data:** Supabase (Postgres)
- **Scrapers:** TypeScript cron jobs on Railway
- **Hosting:** Vercel

## Local dev

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. You'll need a `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing at your own Supabase instance.

## Credits

Built by [Shiv](https://github.com/shivsid1). Data sourced from [Curius](https://curius.app).
