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
import type { CuriusLink } from './types';

/**
 * Cron-optimized sync entry point.
 * Designed for Railway cron (ephemeral filesystem, no persistent progress file).
 *
 * Strategy:
 * 1. Fetch all usernames from DB
 * 2. For each user, fetch only page 0 (most recent 30 bookmarks) from Curius API
 * 3. Upsert bookmarks + relationships (duplicates ignored)
 * 4. Discover new users from savedBy field
 * 5. Process discovered users the same way
 * 6. Classify all untagged bookmarks via GPT-4o-mini
 *
 * Runtime: ~60-90 min for 5k users (1 API call each at 2 req/sec)
 */

const MAX_RUNTIME_MS = 50 * 60 * 1000; // 50 minutes safety cap
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
    Logger.warn('Phase 1 skipped: OPENAI_API_KEY not set');
  }

  // Phase 2: Sync bookmarks for all known users, most active first
  const usernames = await supabaseSync.getUsernamesByActivity();
  Logger.info(`Phase 2: Syncing ${usernames.length} users (sorted by activity, page 0 only)`);

  let syncedUsers = 0;
  let newBookmarks = 0;
  let newRelationships = 0;
  const discoveredUsers = new Set<string>();
  const knownUsernames = new Set(usernames);

  for (const username of usernames) {
    if (!timeLeft()) {
      Logger.warn(`Time limit reached after ${syncedUsers} users. Stopping sync phase.`);
      break;
    }

    try {
      const result = await syncUserRecent(username, apiClient, supabaseSync, discoveredUsers, knownUsernames);
      newBookmarks += result.bookmarks;
      newRelationships += result.relationships;
      syncedUsers++;

      if (syncedUsers % 50 === 0) {
        Logger.info(`Progress: ${syncedUsers}/${usernames.length} users | +${newBookmarks} bookmarks | +${newRelationships} relationships | ${discoveredUsers.size} new users found`);
      }
    } catch (error) {
      Logger.error(`Failed to sync ${username}`, error as Error);
    }

    await sleep(500);
  }

  Logger.info(`Phase 2 complete: ${syncedUsers} users synced, +${newBookmarks} bookmarks, +${newRelationships} relationships`);

  // Final stats
  const stats = await supabaseSync.getStats();
  Logger.info('=== Cron Sync Complete ===');
  Logger.info(`Total DB: ${stats.users} users, ${stats.bookmarks} bookmarks, ${stats.userBookmarks} relationships, ${stats.tags} tags`);
  Logger.info(`This run: +${newBookmarks} bookmarks, +${newRelationships} relationships, ${discoveredUsers.size} new users discovered`);
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
  discoveredUsers: Set<string>,
  knownUsernames: Set<string>,
): Promise<{ bookmarks: number; relationships: number }> {
  let userId = await supabaseSync.getUserId(username);
  if (!userId) return { bookmarks: 0, relationships: 0 };

  const curiusUser = await apiClient.getUserByUsername(username);
  if (!curiusUser) return { bookmarks: 0, relationships: 0 };

  // Only fetch page 0 (most recent 30 bookmarks)
  const { links } = await apiClient.getUserLinks(curiusUser.uid, username, 0);

  let bookmarks = 0;
  let relationships = 0;
  const batch: Array<{ userId: number; bookmarkId: number; savedAt: string }> = [];

  for (const link of links) {
    // Discover new users from savedBy
    if (link.savedBy) {
      for (const saver of link.savedBy) {
        if (saver.username && !knownUsernames.has(saver.username)) {
          discoveredUsers.add(saver.username);
        }
      }
    }

    const bookmarkId = await supabaseSync.getOrCreateBookmark(link);
    if (!bookmarkId) continue;

    batch.push({
      userId,
      bookmarkId,
      savedAt: link.createdDate || new Date().toISOString(),
    });
    bookmarks++;
  }

  if (batch.length > 0) {
    const result = await supabaseSync.batchUpsertUserBookmarks(batch);
    relationships = result.created;
  }

  return { bookmarks, relationships };
}

/**
 * Full sync for newly discovered users -- all pages.
 */
async function syncUserFull(
  username: string,
  apiClient: CuriusApiClient,
  supabaseSync: SupabaseSync,
): Promise<{ bookmarks: number; relationships: number }> {
  let userId = await supabaseSync.getUserId(username);
  if (!userId) {
    userId = await supabaseSync.createUser(username);
  }
  if (!userId) return { bookmarks: 0, relationships: 0 };

  const curiusUser = await apiClient.getUserByUsername(username);
  if (!curiusUser) return { bookmarks: 0, relationships: 0 };

  let bookmarks = 0;
  let relationships = 0;
  const batch: Array<{ userId: number; bookmarkId: number; savedAt: string }> = [];

  for await (const links of apiClient.getAllUserLinks(curiusUser.uid, username)) {
    for (const link of links) {
      const bookmarkId = await supabaseSync.getOrCreateBookmark(link);
      if (!bookmarkId) continue;

      batch.push({
        userId,
        bookmarkId,
        savedAt: link.createdDate || new Date().toISOString(),
      });
      bookmarks++;

      if (batch.length >= 100) {
        const result = await supabaseSync.batchUpsertUserBookmarks(batch);
        relationships += result.created;
        batch.length = 0;
      }
    }
  }

  if (batch.length > 0) {
    const result = await supabaseSync.batchUpsertUserBookmarks(batch);
    relationships += result.created;
  }

  return { bookmarks, relationships };
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
