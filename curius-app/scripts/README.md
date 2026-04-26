# Scripts

## Production

- `scraper/cron.ts` — canonical Railway cron entry point. Runs the scheduled Curius sync.
  Invoked via `npm run cron:sync`.

## One-off pipeline scripts

The other top-level `tag-*.js`, `categorize-*.js`, `scrape.js`, and helper scripts in this
directory are one-off pipeline tools used during initial data ingestion and tagging.
They are not used in production. Keep them around for reruns; do not wire them into cron.
