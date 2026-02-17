import 'dotenv/config';
import { CuriusApiClient } from './api-client';
import { SupabaseSync } from './supabase-sync';
import { ProgressTracker } from './progress-tracker';
import { Categorizer } from './categorizer';
import { Logger } from './logger';
import { CONFIG } from './config';
import { sleep } from './rate-limiter';
import type { CuriusLink } from './types';

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const showStatus = args.includes('--status');
const resetProgress = args.includes('--reset');
const syncMode = args.includes('--sync'); // Incremental sync only
const categorizeMode = args.includes('--categorize'); // Only categorize untagged
const testUser = args.find(a => a.startsWith('--user='))?.split('=')[1];

async function main() {
  Logger.info('Curius Scraper starting...');
  Logger.info(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}${syncMode ? ' (incremental sync)' : ''}${categorizeMode ? ' (categorize only)' : ''}`);

  const apiClient = new CuriusApiClient();
  const supabaseSync = new SupabaseSync();
  const progressTracker = new ProgressTracker();
  const categorizer = new Categorizer();

  // Handle --status
  if (showStatus) {
    await progressTracker.load();
    progressTracker.printStatus();
    const dbStats = await supabaseSync.getStats();
    console.log('=== Database Stats ===');
    console.log(`Users: ${dbStats.users.toLocaleString()}`);
    console.log(`Bookmarks: ${dbStats.bookmarks.toLocaleString()}`);
    console.log(`User-Bookmarks: ${dbStats.userBookmarks.toLocaleString()}`);
    console.log(`Tags: ${dbStats.tags.toLocaleString()}`);
    return;
  }

  // Handle --categorize (only tag untagged bookmarks)
  if (categorizeMode) {
    await runCategorizeMode(supabaseSync, categorizer, isDryRun);
    return;
  }

  // Handle --reset
  if (resetProgress) {
    const fs = await import('fs');
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      fs.unlinkSync(CONFIG.PROGRESS_FILE);
      Logger.info('Progress reset successfully');
    }
    return;
  }

  // Load or initialize progress
  const hasExistingProgress = await progressTracker.load();

  if (!hasExistingProgress) {
    Logger.info('No existing progress found. Loading users from database...');
    const usernames = await supabaseSync.getAllUsernames();
    Logger.info(`Found ${usernames.length} users to process`);
    progressTracker.initializeUsers(usernames);
    await progressTracker.save();
  }

  // If testing single user
  if (testUser) {
    Logger.info(`Testing with single user: ${testUser}`);
    await processUser(testUser, apiClient, supabaseSync, progressTracker, isDryRun);
    await progressTracker.save();
    progressTracker.printStatus();
    return;
  }

  // Graceful shutdown handler
  let isShuttingDown = false;
  process.on('SIGINT', async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    Logger.newLine();
    Logger.info('Received SIGINT. Saving progress and exiting...');
    await progressTracker.save();
    progressTracker.printStatus();
    process.exit(0);
  });

  // Main processing loop
  let processedCount = 0;
  const summary = progressTracker.getSummary();

  Logger.info(`Starting scrape: ${summary.pending} users pending, ${summary.completed} already completed`);

  while (true) {
    if (isShuttingDown) break;

    const username = progressTracker.getNextPendingUser();
    if (!username) {
      Logger.info('No more users to process');
      break;
    }

    try {
      await processUser(username, apiClient, supabaseSync, progressTracker, isDryRun);
      processedCount++;

      const currentSummary = progressTracker.getSummary();
      Logger.progressLine(
        currentSummary.completed,
        currentSummary.total,
        `${username} done | Relationships: ${currentSummary.relationships.toLocaleString()}`
      );
    } catch (error) {
      progressTracker.markUserFailed(username, (error as Error).message);
      Logger.error(`Failed to process ${username}`, error as Error);
    }

    // Delay between users
    await sleep(CONFIG.DELAY_BETWEEN_USERS_MS);
  }

  // Final save and summary
  await progressTracker.save();
  progressTracker.printStatus();

  const dbStats = await supabaseSync.getStats();
  Logger.info('Final database stats:');
  Logger.info(`  Users: ${dbStats.users.toLocaleString()}`);
  Logger.info(`  Bookmarks: ${dbStats.bookmarks.toLocaleString()}`);
  Logger.info(`  User-Bookmarks: ${dbStats.userBookmarks.toLocaleString()}`);
}

async function processUser(
  username: string,
  apiClient: CuriusApiClient,
  supabaseSync: SupabaseSync,
  progressTracker: ProgressTracker,
  isDryRun: boolean
): Promise<void> {
  // Get user's Supabase ID (or create if discovered)
  let userId = await supabaseSync.getUserId(username);

  if (!userId) {
    // This is a newly discovered user
    Logger.info(`Creating new user: ${username}`);
    if (!isDryRun) {
      userId = await supabaseSync.createUser(username);
    } else {
      userId = -1; // Placeholder for dry run
    }
  }

  if (!userId) {
    throw new Error(`Could not get/create user ID for ${username}`);
  }

  // Get user's Curius UID from API
  const curiusUser = await apiClient.getUserByUsername(username);
  if (!curiusUser) {
    throw new Error(`User not found on Curius: ${username}`);
  }

  progressTracker.markUserInProgress(username, curiusUser.uid);

  // Iterate through all pages of bookmarks
  let totalBookmarks = 0;
  let relationshipsCreated = 0;
  const batch: Array<{ userId: number; bookmarkId: number; savedAt: string }> = [];

  for await (const links of apiClient.getAllUserLinks(curiusUser.uid, username)) {
    for (const link of links) {
      // Check for new users in savedBy
      if (link.savedBy) {
        for (const saver of link.savedBy) {
          if (saver.username && progressTracker.addDiscoveredUser(saver.username)) {
            Logger.info(`Discovered new user: ${saver.username}`);
          }
        }
      }

      if (isDryRun) {
        totalBookmarks++;
        continue;
      }

      // Get or create bookmark
      const bookmarkId = await supabaseSync.getOrCreateBookmark(link);
      if (!bookmarkId) continue;

      // Add to batch
      batch.push({
        userId,
        bookmarkId,
        savedAt: link.createdDate || new Date().toISOString(),
      });

      totalBookmarks++;

      // Flush batch if full
      if (batch.length >= CONFIG.SUPABASE_BATCH_SIZE) {
        const result = await supabaseSync.batchUpsertUserBookmarks(batch);
        relationshipsCreated += result.created;
        batch.length = 0;
      }
    }
  }

  // Flush remaining batch
  if (batch.length > 0 && !isDryRun) {
    const result = await supabaseSync.batchUpsertUserBookmarks(batch);
    relationshipsCreated += result.created;
  }

  // Update user's bookmark count
  if (!isDryRun && totalBookmarks > 0) {
    await supabaseSync.updateUserBookmarkCount(userId, totalBookmarks);
  }

  progressTracker.markUserCompleted(username, totalBookmarks, relationshipsCreated);
}

// Categorize-only mode: tag untagged bookmarks
async function runCategorizeMode(
  supabaseSync: SupabaseSync,
  categorizer: Categorizer,
  isDryRun: boolean
): Promise<void> {
  if (!categorizer.isEnabled()) {
    Logger.error('OPENAI_API_KEY not set - cannot categorize');
    return;
  }

  Logger.info('Running in categorize-only mode...');

  let totalCategorized = 0;
  const batchSize = 10;

  while (true) {
    // Get untagged bookmarks
    const untagged = await supabaseSync.getUntaggedBookmarks(batchSize);

    if (untagged.length === 0) {
      Logger.info('No more untagged bookmarks');
      break;
    }

    Logger.info(`Processing ${untagged.length} untagged bookmarks...`);

    // Classify batch
    const linksToClassify = untagged.map((b) => ({
      id: b.id,
      url: b.link,
      title: b.title,
      domain: b.domain,
    }));

    const results = await categorizer.classifyBatch(linksToClassify);

    if (!isDryRun) {
      const records = Array.from(results.entries()).map(([id, result]) => ({
        bookmarkId: id,
        category: result.category,
        subcategory: result.subcategory,
      }));

      const saved = await supabaseSync.batchSaveCategories(records);
      totalCategorized += saved;
      Logger.info(`Categorized ${saved} bookmarks (total: ${totalCategorized})`);
    } else {
      for (const [id, result] of results) {
        const bookmark = untagged.find((b) => b.id === id);
        Logger.info(`[DRY] ${bookmark?.title?.substring(0, 40)} -> ${result.category}/${result.subcategory}`);
      }
      totalCategorized += results.size;
    }

    // Rate limit
    await sleep(1000);
  }

  Logger.info(`Categorization complete. Total: ${totalCategorized}`);
}

// Run
main()
  .catch((error) => {
    Logger.error('Fatal error', error);
    process.exit(1);
  })
  .then(() => {
    Logger.info('Scraper finished');
    process.exit(0);
  });
