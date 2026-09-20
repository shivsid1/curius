process.env.SUPABASE_URL = 'http://stub';
process.env.SUPABASE_SERVICE_KEY = 'stub';
import { SupabaseSync } from './supabase-sync';
import type { CuriusLink } from './types';

let selectCalls = 0, upsertCalls = 0;
const existing = new Map<string, number>();     // link -> id
let nextId = 1000;
const rowsWritten: Array<Record<string, unknown>> = [];

function stub(raceLinks: Set<string> = new Set()) {
  return {
    from() {
      return {
        select() {
          return {
            in(_col: string, vals: string[]) {
              selectCalls++;
              if (vals.length > 200) throw new Error(`chunk too big: ${vals.length}`);
              const data = vals.filter((v) => existing.has(v)).map((v) => ({ id: existing.get(v), link: v }));
              return Promise.resolve({ data, error: null });
            },
          };
        },
        upsert(rows: Array<{ link: string }>, opts: { onConflict: string; ignoreDuplicates: boolean }) {
          upsertCalls++;
          if (!opts.ignoreDuplicates) throw new Error('would clobber saves_count on conflict');
          return {
            select() {
              const data: Array<{ id: number; link: string }> = [];
              for (const r of rows) {
                if (existing.has(r.link)) continue;            // ON CONFLICT DO NOTHING
                if (raceLinks.has(r.link)) { existing.set(r.link, ++nextId); continue; } // written by someone else
                const id = ++nextId;
                existing.set(r.link, id);
                rowsWritten.push(r);
                data.push({ id, link: r.link });
              }
              return Promise.resolve({ data, error: null });
            },
          };
        },
      };
    },
  };
}

// `client` is private; the test swaps it for a stub without reaching for `any`.
function injectClient(sync: SupabaseSync, client: unknown): void {
  (sync as unknown as { client: unknown }).client = client;
}

function link(n: number): CuriusLink {
  return { id: String(n), link: `https://ex.com/${n}`, title: `t${n}`, createdDate: '2026-09-20T00:00:00Z' };
}

async function main() {
  const sync = new SupabaseSync();

  // --- 1. chunking: 450 links must split into 3 queries of <=200 ---
  injectClient(sync, stub());
  for (let i = 0; i < 50; i++) existing.set(`https://ex.com/${i}`, i + 1);
  selectCalls = 0;
  const found = await sync.batchGetBookmarkIds(Array.from({ length: 450 }, (_, i) => `https://ex.com/${i}`));
  console.log('1. chunked lookup ->', selectCalls, 'queries,', found.size, 'found (expect 3, 50)');
  if (selectCalls !== 3 || found.size !== 50) throw new Error('FAIL chunking');

  // --- 2. insert skips existing rows, never updates them ---
  upsertCalls = 0; rowsWritten.length = 0;
  const batch = [...Array(10)].map((_, i) => link(i));          // all 10 already exist
  const ins = await sync.batchInsertBookmarks(batch);
  console.log('2. re-inserting existing ->', ins.size, 'written,', rowsWritten.length, 'rows touched,', upsertCalls, 'upserts (expect 0, 0, 1)');
  if (ins.size !== 0 || rowsWritten.length !== 0 || upsertCalls !== 1) throw new Error('FAIL would clobber existing');

  // --- 3. new links get ids back ---
  const fresh = [...Array(5)].map((_, i) => link(900 + i));
  const ins2 = await sync.batchInsertBookmarks(fresh);
  console.log('3. inserting new ->', ins2.size, 'ids returned (expect 5)');
  if (ins2.size !== 5) throw new Error('FAIL new insert');

  // --- 4. race: row created by a concurrent writer is recovered by re-lookup ---
  const raced = link(800);
  injectClient(sync, stub(new Set([raced.link])));
  const insRace = await sync.batchInsertBookmarks([raced]);
  console.log('4. raced insert returned', insRace.size, 'ids (expect 0, caller must re-lookup)');
  const recovered = await sync.batchGetBookmarkIds([raced.link]);
  console.log('   re-lookup recovered', recovered.size, '(expect 1)');
  if (insRace.size !== 0 || recovered.size !== 1) throw new Error('FAIL race recovery');

  console.log('\nall assertions passed');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
