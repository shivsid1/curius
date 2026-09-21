import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first, then .env as fallback
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { CuriusApiClient } from './api-client';
import { SupabaseSync } from './supabase-sync';
import { Categorizer } from './categorizer';
import { Logger } from './logger';
import { sleep } from './rate-limiter';

/**
 * Cron-optimized sync entry point.
 * Designed for Railway cron (ephemeral filesystem, no persistent progress file).
 *
 * Strategy:
 * 1. Discover new users from the Curius directory and refresh last_online
 * 2. Classify untagged bookmarks via GPT-4o-mini
 * 3. Sync page 0 (most recent 30 bookmarks) for users active in the last 48h
 *
 * Phase 2 walks users ordered by last_online descending and stops at the
 * activity cutoff. Previously it walked all ~6k users from the top and was
 * cut off by MAX_RUNTIME_MS around 10% in, so the less active tail was never
 * reached on any run.
 */

const MAX_RUNTIME_MS = 50 * 60 * 1000; // 50 minutes safety cap
const RECENT_WINDOW_HOURS = 48;
const RECENT_WINDOW_MS = RECENT_WINDOW_HOURS * 60 * 60 * 1000;
const startTime = Date.now();

function timeLeft(): boolean {
  return (Date.now() - startTime) < MAX_RUNTIME_MS;
}

async function main() {
  Logger.info('=== Curius Cron Sync Starting ===');

  const apiClient = new CuriusApiClient();
  const supabaseSync = new SupabaseSync();
  const categorizer = new Categorizer();

  // Phase 0: Discover new users from Curius /api/users/all
  Logger.info('Phase 0: Discovering new users from Curius...');
  let newUsersAdded = 0;
  try {
    const res = await fetch('https://curius.app/api/users/all', {
      headers: { 'Accept': 'application/json', 'Referer': 'https://curius.app/' },
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = await res.json();
      const curiusUsers: Array<{ id: number; firstName: string; lastName: string; userLink: string; lastOnline: string }> = data.users || [];
      Logger.info(`Curius has ${curiusUsers.length} total users`);

      // Get our known usernames
      const knownUsernames = new Set(await supabaseSync.getAllUsernames());
      Logger.info(`We have ${knownUsernames.size} users in DB`);

      // Find users we don't have
      const newUsers = curiusUsers.filter((u) => !knownUsernames.has(u.userLink));
      Logger.info(`Found ${newUsers.length} new users to add`);

      for (const u of newUsers) {
        const created = await supabaseSync.createUser(u.userLink, u.firstName, u.lastName, u.id);
        if (created) newUsersAdded++;
      }
      // Update last_online for all users from Curius data
      Logger.info('Updating last_online timestamps...');
      const onlineUpdates = curiusUsers
        .filter((u) => u.lastOnline)
        .map((u) => ({ username: u.userLink, lastOnline: u.lastOnline }));
      await supabaseSync.bulkUpdateLastOnline(onlineUpdates);

      Logger.info(`Phase 0 complete: ${newUsersAdded} new users added, ${onlineUpdates.length} last_online updated`);
    }
  } catch (error) {
    Logger.error('Phase 0 failed (non-fatal)', error as Error);
  }

  // Phase 1: Classify untagged bookmarks FIRST (so previous run's new bookmarks get tagged)
  let totalCategorized = 0;
  if (categorizer.isEnabled()) {
    Logger.info('Phase 1: Classifying untagged bookmarks');
    const batchSize = 10;
    const classifyBudgetMs = 10 * 60 * 1000; // 10 minutes max for classification
    const classifyStart = Date.now();

    while (timeLeft() && (Date.now() - classifyStart) < classifyBudgetMs) {
      const untagged = await supabaseSync.getUntaggedBookmarks(batchSize);
      if (untagged.length === 0) {
        Logger.info('No more untagged bookmarks');
        break;
      }

      const linksToClassify = untagged.map((b) => ({
        id: b.id,
        url: b.link,
        title: b.title,
        domain: b.domain,
      }));

      const results = await categorizer.classifyBatch(linksToClassify);

      const records = Array.from(results.entries()).map(([id, result]) => ({
        bookmarkId: id,
        category: result.category,
        subcategory: result.subcategory,
      }));

      const saved = await supabaseSync.batchSaveCategories(records);
      totalCategorized += saved;

      if (totalCategorized % 50 === 0 && totalCategorized > 0) {
        Logger.info(`Classified ${totalCategorized} bookmarks so far...`);
      }

      await sleep(1000);
    }

    Logger.info(`Phase 1 complete: ${totalCategorized} bookmarks classified`);
  } else {
    Logger.warn('Phase 1 skipped: ANTHROPIC_API_KEY not set');
  }

  // Phase 2: Sync bookmarks for users active inside the recency window.
  // getUsersByActivity orders by last_online descending with nulls last, so
  // the first user outside the window means every user after it is too.
  const users = await supabaseSync.getUsersByActivity();
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  Logger.info(`Phase 2: ${users.length} users known, syncing those active in the last ${RECENT_WINDOW_HOURS}h (page 0 only)`);

  let syncedUsers = 0;
  let newBookmarks = 0;
  let newRelationships = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];

    if (!timeLeft()) {
      Logger.warn(`Time limit reached after ${syncedUsers} users. Stopping sync phase.`);
      break;
    }

    if (!user.lastOnline || Date.parse(user.lastOnline) < cutoff) {
      Logger.info(`Reached the ${RECENT_WINDOW_HOURS}h activity cutoff after ${i} users. Skipping ${users.length - i} inactive.`);
      break;
    }

    try {
      const result = await syncUserRecent(user.username, apiClient, supabaseSync);
      newBookmarks += result.bookmarks;
      newRelationships += result.relationships;
      syncedUsers++;

      if (syncedUsers % 50 === 0) {
        Logger.info(`Progress: ${syncedUsers} active users | +${newBookmarks} bookmarks | +${newRelationships} relationships`);
      }
    } catch (error) {
      Logger.error(`Failed to sync ${user.username}`, error as Error);
    }

    await sleep(500);
  }

  Logger.info(`Phase 2 complete: ${syncedUsers} users synced, +${newBookmarks} bookmarks, +${newRelationships} relationships`);

  // Final stats
  const stats = await supabaseSync.getStats();
  Logger.info('=== Cron Sync Complete ===');
  Logger.info(`Total DB: ${stats.users} users, ${stats.bookmarks} bookmarks, ${stats.userBookmarks} relationships, ${stats.tags} tags`);
  Logger.info(`This run: +${newBookmarks} bookmarks, +${newRelationships} relationships`);
  Logger.info(`Runtime: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);
}

/**
 * Sync a user's most recent bookmarks (page 0 only).
 * Fast path for existing users -- only catches new saves.
 */
async function syncUserRecent(
  username: string,
  apiClient: CuriusApiClient,
  supabaseSync: SupabaseSync,
): Promise<{ bookmarks: number; relationships: number }> {
  const userId = await supabaseSync.getUserId(username);
  if (!userId) return { bookmarks: 0, relationships: 0 };

  const curiusUser = await apiClient.getUserByUsername(username);
  if (!curiusUser) return { bookmarks: 0, relationships: 0 };

  // Only fetch page 0 (most recent 30 bookmarks)
  const { links } = await apiClient.getUserLinks(curiusUser.uid, username, 0);
  if (links.length === 0) return { bookmarks: 0, relationships: 0 };

  // Resolve all 30 links in two or three queries. This used to be a
  // select-then-insert per link, i.e. up to 60 sequential round trips per user.
  const bookmarkIds = await supabaseSync.batchGetBookmarkIds(links.map((l) => l.link));

  const missing = links.filter((l) => !bookmarkIds.has(l.link));
  if (missing.length > 0) {
    for (const [link, id] of await supabaseSync.batchInsertBookmarks(missing)) {
      bookmarkIds.set(link, id);
    }

    // Insert skips rows that already exist, so anything still unresolved lost
    // a race with a concurrent writer. Look those up directly.
    const unresolved = missing.filter((l) => !bookmarkIds.has(l.link)).map((l) => l.link);
    if (unresolved.length > 0) {
      for (const [link, id] of await supabaseSync.batchGetBookmarkIds(unresolved)) {
        bookmarkIds.set(link, id);
      }
    }
  }

  const batch: Array<{ userId: number; bookmarkId: number; savedAt: string }> = [];
  for (const link of links) {
    const bookmarkId = bookmarkIds.get(link.link);
    if (!bookmarkId) continue;

    batch.push({
      userId,
      bookmarkId,
      savedAt: link.createdDate || new Date().toISOString(),
    });
  }

  if (batch.length === 0) return { bookmarks: 0, relationships: 0 };

  const result = await supabaseSync.batchUpsertUserBookmarks(batch);
  return { bookmarks: batch.length, relationships: result.created };
}

// Run
main()
  .catch((error) => {
    Logger.error('Fatal error', error);
    process.exit(1);
  })
  .then(() => {
    Logger.info('Cron job finished');
    process.exit(0);
  });
