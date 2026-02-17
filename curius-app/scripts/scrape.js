#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// =============================================================================
// TAXONOMY - 14 Main Categories with Subcategories
// =============================================================================
const TAXONOMY = {
  'AI/ML': ['LLMs & Language Models', 'Computer Vision', 'AI Research', 'AI Tools & APIs', 'AI Agents', 'AI Ethics & Safety', 'AI Hardware'],
  'Tech': ['Web Development', 'Mobile Development', 'DevOps & Infrastructure', 'Databases', 'Security', 'Programming Languages', 'Open Source'],
  'Startups': ['Fundraising & VC', 'Growth & Marketing', 'Product Management', 'Hiring & Culture', 'Strategy', 'Founder Stories'],
  'Science': ['Biology & Biotech', 'Physics', 'Chemistry', 'Space & Astronomy', 'Climate & Environment', 'Neuroscience'],
  'Finance': ['Investing', 'Markets & Trading', 'Personal Finance', 'Economics', 'Crypto & Web3'],
  'Design': ['UI/UX Design', 'Visual Design', 'Design Systems', 'Typography', 'Branding'],
  'Writing': ['Essays & Opinion', 'Technical Writing', 'Fiction', 'Journalism', 'Newsletters'],
  'Health': ['Longevity', 'Fitness', 'Mental Health', 'Nutrition', 'Medicine'],
  'Philosophy': ['Ethics', 'Epistemology', 'Rationality', 'Politics', 'History of Ideas'],
  'Education': ['Online Courses', 'Learning Methods', 'Research', 'Tutorials', 'Books & Reading'],
  'Media': ['Podcasts', 'Videos', 'News', 'Music', 'Games'],
  'Tools': ['Productivity', 'Developer Tools', 'Design Tools', 'Automation', 'Communication'],
  'Culture': ['Art', 'History', 'Society', 'Travel', 'Food'],
  'Career': ['Job Hunting', 'Skill Development', 'Networking', 'Remote Work', 'Leadership'],
};

function formatTaxonomyForPrompt() {
  return Object.entries(TAXONOMY)
    .map(([main, subs]) => `${main}: ${subs.join(', ')}`)
    .join('\n');
}

// =============================================================================
// CONFIG
// =============================================================================
const CONFIG = {
  CURIUS_BASE_URL: 'https://curius.app/api',
  DELAY_BETWEEN_PAGES_MS: 500,
  DELAY_BETWEEN_USERS_MS: 1000,
  BATCH_SIZE: 100,
  CATEGORIZE_BATCH_SIZE: 20,
  CATEGORIZE_PARALLEL: 10, // Number of parallel API calls
  PROGRESS_FILE: path.join(__dirname, '../data/progress/scrape-progress.json'),
};

// =============================================================================
// PARSE ARGS
// =============================================================================
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const showStatus = args.includes('--status');
const syncMode = args.includes('--sync');
const categorizeMode = args.includes('--categorize');
const testUser = args.find(a => a.startsWith('--user='))?.split('=')[1];
const resumeMode = args.includes('--resume');

// =============================================================================
// SUPABASE CLIENT
// =============================================================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// =============================================================================
// LOGGER
// =============================================================================
function log(level, msg, data) {
  const time = new Date().toISOString().substring(11, 19);
  const line = `[${time}] [${level}] ${msg}`;
  if (data) {
    console.log(line, JSON.stringify(data));
  } else {
    console.log(line);
  }
}

// =============================================================================
// UTILITIES
// =============================================================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        log('WARN', `Rate limited, waiting ${2 ** i}s...`);
        await sleep(2000 * (2 ** i));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * (i + 1));
    }
  }
}

// =============================================================================
// PROGRESS TRACKER
// =============================================================================
function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {
    log('WARN', 'Could not load progress file');
  }
  return { completed: [], failed: [], lastSync: null };
}

function saveProgress(progress) {
  const dir = path.dirname(CONFIG.PROGRESS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// =============================================================================
// CURIUS API
// =============================================================================
async function getCuriusUser(username) {
  const res = await fetchWithRetry(`${CONFIG.CURIUS_BASE_URL}/users/${username}`, {
    headers: {
      'Referer': `https://curius.app/${username}`,
      'User-Agent': 'Mozilla/5.0'
    }
  });

  if (!res || !res.ok) return null;
  const data = await res.json();
  return data.user;
}

async function getCuriusLinks(userId, username, page = 0) {
  const res = await fetchWithRetry(`${CONFIG.CURIUS_BASE_URL}/users/${userId}/links?page=${page}`, {
    headers: {
      'Referer': `https://curius.app/${username}`,
      'User-Agent': 'Mozilla/5.0'
    }
  });

  if (!res || !res.ok) return { links: [], hasMore: false };
  const data = await res.json();
  const links = data.userSaved || [];
  return { links, hasMore: links.length >= 30 };
}

async function* getAllUserLinks(userId, username) {
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await getCuriusLinks(userId, username, page);
    if (result.links.length > 0) {
      yield result.links;
    }
    hasMore = result.hasMore && result.links.length > 0;
    page++;
    if (hasMore) await sleep(CONFIG.DELAY_BETWEEN_PAGES_MS);
  }
}

// =============================================================================
// DATABASE OPERATIONS - BATCH OPTIMIZED
// =============================================================================

// Batch lookup bookmarks by URLs - much faster than individual lookups
async function batchGetBookmarksByUrls(urls) {
  if (urls.length === 0) return new Map();

  const result = new Map();
  // Supabase has a limit on IN clause, so chunk the requests
  const chunkSize = 500;

  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const { data } = await supabase
      .from('bookmarks')
      .select('id, link')
      .in('link', chunk);

    if (data) {
      for (const row of data) {
        result.set(row.link, row.id);
      }
    }
  }

  return result;
}

// Batch insert new bookmarks
async function batchInsertBookmarks(links) {
  if (links.length === 0) return new Map();

  const toInsert = links.map(link => {
    let domain = '';
    try {
      domain = new URL(link.link).hostname.replace('www.', '');
    } catch {}
    return {
      link: link.link,
      title: link.title || null,
      domain,
      saves_count: 1,
    };
  });

  const { data, error } = await supabase
    .from('bookmarks')
    .upsert(toInsert, { onConflict: 'link', ignoreDuplicates: false })
    .select('id, link');

  const result = new Map();
  if (data) {
    for (const row of data) {
      result.set(row.link, row.id);
    }
  }

  return result;
}

// Get or create bookmark (kept for backward compatibility but deprecated)
async function getOrCreateBookmark(link) {
  let domain = '';
  try {
    domain = new URL(link.link).hostname.replace('www.', '');
  } catch {}

  const { data: existing } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('link', link.link)
    .single();

  if (existing) return { id: existing.id, isNew: false };

  const { data, error } = await supabase
    .from('bookmarks')
    .insert({
      link: link.link,
      title: link.title || null,
      domain,
      saves_count: 1,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('link', link.link)
        .single();
      return { id: retry?.id, isNew: false };
    }
    return { id: null, isNew: false };
  }
  return { id: data?.id, isNew: true };
}

async function getUntaggedBookmarks(limit = 100) {
  // Get bookmarks that don't have tags yet using offset pagination
  // We fetch more bookmarks and filter out tagged ones
  const batchSize = 500;
  const untagged = [];
  let offset = 0;

  while (untagged.length < limit) {
    const { data: bookmarks } = await supabase
      .from('bookmarks')
      .select('id, link, title, domain')
      .range(offset, offset + batchSize - 1)
      .order('id');

    if (!bookmarks || bookmarks.length === 0) break;

    const ids = bookmarks.map(b => b.id);
    const { data: taggedIds } = await supabase
      .from('bookmark_tags_v2')
      .select('bookmark_id')
      .in('bookmark_id', ids);

    const taggedSet = new Set((taggedIds || []).map(t => t.bookmark_id));
    const batch = bookmarks.filter(b => !taggedSet.has(b.id));
    untagged.push(...batch);

    offset += batchSize;

    // Safety limit to avoid infinite loop
    if (offset > 200000) break;
  }

  return untagged.slice(0, limit);
}

async function saveCategories(records) {
  if (records.length === 0) return 0;

  const data = records.map(r => ({
    bookmark_id: r.bookmarkId,
    topic: r.category,
    subtopic: r.subcategory,
  }));

  const { error, count } = await supabase
    .from('bookmark_tags_v2')
    .upsert(data, { onConflict: 'bookmark_id', count: 'exact' });

  if (error) {
    // If batch fails, try one by one (handles FK errors gracefully)
    let saved = 0;
    for (const record of data) {
      const { error: singleError } = await supabase
        .from('bookmark_tags_v2')
        .upsert(record, { onConflict: 'bookmark_id' });
      if (!singleError) saved++;
    }
    return saved;
  }

  return count || records.length;
}

// =============================================================================
// CLAUDE CATEGORIZATION
// =============================================================================
let apiKeyWarned = false;

async function classifyBookmarksBatch(bookmarks) {
  const apiKey = process.env.CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (!apiKeyWarned) {
      log('WARN', 'CLAUDE_KEY not set - skipping categorization');
      apiKeyWarned = true;
    }
    return new Map();
  }

  const linksText = bookmarks
    .map((b, i) => `${i + 1}. [ID:${b.id}] "${b.title || 'No title'}" (${b.domain})`)
    .join('\n');

  const prompt = `Classify each link into ONE category and ONE subcategory from the taxonomy below.

TAXONOMY:
${formatTaxonomyForPrompt()}

LINKS:
${linksText}

Return ONLY valid JSON array with this exact format:
[
  {"id": 123, "category": "AI/ML", "subcategory": "LLMs & Language Models"},
  {"id": 456, "category": "Tech", "subcategory": "Web Development"}
]

RULES:
- Choose the SINGLE BEST matching category and subcategory
- Use EXACT category/subcategory names from the taxonomy
- If unsure, pick the closest match - never leave blank
- Return valid JSON only, no other text`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      log('ERROR', `Claude API error: ${res.status} - ${errText}`);
      return new Map();
    }

    const response = await res.json();
    const content = response.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log('WARN', 'No JSON array found in OpenAI response');
      return new Map();
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const results = new Map();
    const validCategories = Object.keys(TAXONOMY);

    for (const item of parsed) {
      if (!item.id || !item.category || !item.subcategory) continue;
      if (!validCategories.includes(item.category)) {
        log('WARN', `Invalid category: ${item.category}`);
        continue;
      }
      results.set(item.id, {
        category: item.category,
        subcategory: item.subcategory,
      });
    }

    return results;
  } catch (error) {
    log('ERROR', `Classification failed: ${error.message}`);
    return new Map();
  }
}

// =============================================================================
// PROCESS USER (BATCH OPTIMIZED)
// =============================================================================
async function processUser(username, options = {}) {
  const { categorize = false } = options;

  log('INFO', `Processing user: ${username}`);

  // Get DB user ID
  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (!dbUser) {
    log('WARN', `User not in DB: ${username}`);
    return { bookmarks: 0, relationships: 0, newBookmarks: [] };
  }

  // Get Curius user
  const curiusUser = await getCuriusUser(username);
  if (!curiusUser) {
    log('WARN', `User not on Curius: ${username}`);
    return { bookmarks: 0, relationships: 0, newBookmarks: [] };
  }

  log('INFO', `  Curius ID: ${curiusUser.id}, Name: ${curiusUser.firstName} ${curiusUser.lastName}`);

  // PHASE 1: Fetch all links from Curius
  const allLinks = [];
  for await (const links of getAllUserLinks(curiusUser.id, username)) {
    allLinks.push(...links);
  }
  log('INFO', `  Fetched ${allLinks.length} links from Curius`);

  if (allLinks.length === 0) {
    return { bookmarks: 0, relationships: 0, newBookmarks: [] };
  }

  if (isDryRun) {
    log('INFO', `  [DRY RUN] Would process ${allLinks.length} links`);
    return { bookmarks: allLinks.length, relationships: 0, newBookmarks: [] };
  }

  // PHASE 2: Batch check which bookmarks already exist
  const urls = allLinks.map(l => l.link);
  const existingBookmarks = await batchGetBookmarksByUrls(urls);
  log('INFO', `  Found ${existingBookmarks.size} existing bookmarks in DB`);

  // PHASE 3: Batch insert new bookmarks
  const newLinks = allLinks.filter(l => !existingBookmarks.has(l.link));
  let newBookmarkIds = new Map();
  if (newLinks.length > 0) {
    log('INFO', `  Inserting ${newLinks.length} new bookmarks...`);
    newBookmarkIds = await batchInsertBookmarks(newLinks);
  }

  // Merge all bookmark IDs
  const allBookmarkIds = new Map([...existingBookmarks, ...newBookmarkIds]);

  // PHASE 4: Batch insert user-bookmark relationships
  const userBookmarks = [];
  const newBookmarks = [];

  for (const link of allLinks) {
    const bookmarkId = allBookmarkIds.get(link.link);
    if (!bookmarkId) continue;

    userBookmarks.push({
      user_id: dbUser.id,
      bookmark_id: bookmarkId,
      saved_at: link.createdDate || new Date().toISOString(),
    });

    // Track new bookmarks for categorization
    if (newBookmarkIds.has(link.link)) {
      try {
        newBookmarks.push({
          id: bookmarkId,
          link: link.link,
          title: link.title,
          domain: new URL(link.link).hostname.replace('www.', ''),
        });
      } catch {}
    }
  }

  // Batch upsert user-bookmark relationships
  let relationshipsCreated = 0;
  const batchSize = 500;
  for (let i = 0; i < userBookmarks.length; i += batchSize) {
    const batch = userBookmarks.slice(i, i + batchSize);
    const { count } = await supabase
      .from('user_bookmarks')
      .upsert(batch, { onConflict: 'user_id,bookmark_id', ignoreDuplicates: true, count: 'exact' });
    relationshipsCreated += count || batch.length;
  }

  // Categorize new bookmarks if enabled and API key is set
  if (categorize && newBookmarks.length > 0 && (process.env.CLAUDE_KEY || process.env.ANTHROPIC_API_KEY)) {
    log('INFO', `  Categorizing ${newBookmarks.length} new bookmarks...`);
    for (let i = 0; i < newBookmarks.length; i += CONFIG.CATEGORIZE_BATCH_SIZE) {
      const batchToClassify = newBookmarks.slice(i, i + CONFIG.CATEGORIZE_BATCH_SIZE);
      const classifications = await classifyBookmarksBatch(batchToClassify);

      const records = [];
      for (const [id, result] of classifications) {
        records.push({
          bookmarkId: id,
          category: result.category,
          subcategory: result.subcategory,
        });
      }

      if (records.length > 0) {
        await saveCategories(records);
        log('INFO', `    Categorized ${records.length} bookmarks`);
      }

      await sleep(1000); // Rate limit OpenAI
    }
  }

  log('INFO', `  Done: ${allLinks.length} bookmarks, ${relationshipsCreated} relationships, ${newBookmarks.length} new`);
  return { bookmarks: allLinks.length, relationships: relationshipsCreated, newBookmarks };
}

// =============================================================================
// CATEGORIZE MODE - Tag untagged bookmarks (PARALLEL)
// =============================================================================
async function runCategorizeMode() {
  if (!process.env.CLAUDE_KEY && !process.env.ANTHROPIC_API_KEY) {
    log('ERROR', 'CLAUDE_KEY not set - cannot categorize');
    return;
  }

  const parallelCount = CONFIG.CATEGORIZE_PARALLEL;
  const batchSize = CONFIG.CATEGORIZE_BATCH_SIZE;
  const totalPerRound = parallelCount * batchSize;

  log('INFO', `Running parallel categorization: ${parallelCount} workers x ${batchSize} items = ${totalPerRound}/round`);

  let totalCategorized = 0;
  let round = 0;

  while (true) {
    round++;
    // Fetch enough bookmarks for all parallel workers
    const untagged = await getUntaggedBookmarks(totalPerRound);

    if (untagged.length === 0) {
      log('INFO', 'No more untagged bookmarks');
      break;
    }

    log('INFO', `Round ${round}: Processing ${untagged.length} bookmarks in parallel...`);

    if (isDryRun) {
      totalCategorized += untagged.length;
      log('INFO', `[DRY] Would categorize ${untagged.length} (total: ${totalCategorized})`);
      continue;
    }

    // Split into batches for parallel processing
    const batches = [];
    for (let i = 0; i < untagged.length; i += batchSize) {
      batches.push(untagged.slice(i, i + batchSize));
    }

    // Process batches in parallel
    const startTime = Date.now();
    const results = await Promise.all(
      batches.map(batch => classifyBookmarksBatch(batch))
    );

    // Collect all classifications
    const allRecords = [];
    for (const classifications of results) {
      for (const [id, result] of classifications) {
        allRecords.push({
          bookmarkId: id,
          category: result.category,
          subcategory: result.subcategory,
        });
      }
    }

    // Save all at once
    if (allRecords.length > 0) {
      const saved = await saveCategories(allRecords);
      totalCategorized += saved;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (saved / parseFloat(elapsed) * 60).toFixed(0);
      log('INFO', `Categorized ${saved} in ${elapsed}s (~${rate}/min) | Total: ${totalCategorized}`);
    }

    // Small delay between rounds to avoid rate limits
    await sleep(500);
  }

  log('INFO', `Categorization complete. Total: ${totalCategorized}`);
}

// =============================================================================
// SYNC MODE - Incremental sync for new bookmarks
// =============================================================================
async function runSyncMode() {
  log('INFO', 'Running in sync mode - checking for new bookmarks...');

  const progress = loadProgress();
  const lastSync = progress.lastSync ? new Date(progress.lastSync) : new Date(0);

  log('INFO', `Last sync: ${lastSync.toISOString()}`);

  // Get all users and check for new bookmarks
  const { data: users } = await supabase
    .from('users')
    .select('username')
    .order('id');

  if (!users || users.length === 0) {
    log('ERROR', 'No users found');
    return;
  }

  log('INFO', `Syncing ${users.length} users...`);

  let totalNewBookmarks = 0;
  let totalNewRelationships = 0;

  for (let i = 0; i < users.length; i++) {
    const { username } = users[i];
    try {
      const result = await processUser(username, { categorize: true });
      totalNewBookmarks += result.newBookmarks.length;
      totalNewRelationships += result.relationships;

      if (result.newBookmarks.length > 0) {
        log('INFO', `  ${username}: ${result.newBookmarks.length} new bookmarks`);
      }
    } catch (err) {
      log('ERROR', `Failed: ${username} - ${err.message}`);
    }

    await sleep(CONFIG.DELAY_BETWEEN_USERS_MS);

    // Save progress every 50 users
    if ((i + 1) % 50 === 0) {
      progress.lastSync = new Date().toISOString();
      saveProgress(progress);
      const pct = ((i + 1) / users.length * 100).toFixed(1);
      log('PROG', `${i + 1}/${users.length} (${pct}%) - New: ${totalNewBookmarks} bookmarks`);
    }
  }

  progress.lastSync = new Date().toISOString();
  saveProgress(progress);

  log('INFO', 'Sync complete!');
  log('INFO', `New bookmarks: ${totalNewBookmarks}, New relationships: ${totalNewRelationships}`);
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  log('INFO', 'Curius Scraper starting...');
  log('INFO', `Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}${syncMode ? ' (sync)' : ''}${categorizeMode ? ' (categorize)' : ''}`);

  // Status check
  if (showStatus) {
    const [users, bookmarks, userBookmarks, tags] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('bookmarks').select('*', { count: 'exact', head: true }),
      supabase.from('user_bookmarks').select('*', { count: 'exact', head: true }),
      supabase.from('bookmark_tags_v2').select('*', { count: 'exact', head: true }),
    ]);

    console.log('\n=== Database Stats ===');
    console.log(`Users:          ${(users.count || 0).toLocaleString()}`);
    console.log(`Bookmarks:      ${(bookmarks.count || 0).toLocaleString()}`);
    console.log(`User-Bookmarks: ${(userBookmarks.count || 0).toLocaleString()}`);
    console.log(`Tags:           ${(tags.count || 0).toLocaleString()}`);
    console.log('======================\n');

    // Show untagged count
    const untagged = await getUntaggedBookmarks(1);
    if (untagged.length > 0) {
      const { count: totalUntagged } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true });
      console.log(`Untagged:       ~${((totalUntagged || 0) - (tags.count || 0)).toLocaleString()}`);
    }

    // Show progress if exists
    const progress = loadProgress();
    if (progress.completed.length > 0) {
      console.log(`\n=== Scrape Progress ===`);
      console.log(`Completed:      ${progress.completed.length}`);
      console.log(`Failed:         ${progress.failed.length}`);
      console.log(`Last sync:      ${progress.lastSync || 'Never'}`);
      console.log('========================\n');
    }
    return;
  }

  // Categorize-only mode
  if (categorizeMode) {
    await runCategorizeMode();
    return;
  }

  // Sync mode
  if (syncMode) {
    await runSyncMode();
    return;
  }

  // Single user test
  if (testUser) {
    const result = await processUser(testUser, { categorize: true });
    log('INFO', `Result: ${result.bookmarks} bookmarks, ${result.relationships} relationships, ${result.newBookmarks.length} new`);
    return;
  }

  // Full scrape with resumability
  const progress = loadProgress();
  const completedSet = new Set(progress.completed);

  log('INFO', 'Loading users from database...');
  const { data: users } = await supabase
    .from('users')
    .select('username')
    .order('id');

  if (!users || users.length === 0) {
    log('ERROR', 'No users found');
    return;
  }

  const usersToProcess = resumeMode
    ? users.filter(u => !completedSet.has(u.username))
    : users;

  log('INFO', `Found ${users.length} total users, ${usersToProcess.length} to process`);

  // Graceful shutdown handler
  let isShuttingDown = false;
  process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n');
    log('INFO', 'Received SIGINT. Saving progress and exiting...');
    saveProgress(progress);
    process.exit(0);
  });

  let totalBookmarks = 0;
  let totalRelationships = 0;
  let totalNewBookmarks = 0;

  for (let i = 0; i < usersToProcess.length; i++) {
    if (isShuttingDown) break;

    const { username } = usersToProcess[i];
    try {
      const result = await processUser(username, { categorize: true });
      totalBookmarks += result.bookmarks;
      totalRelationships += result.relationships;
      totalNewBookmarks += result.newBookmarks.length;

      progress.completed.push(username);
    } catch (err) {
      log('ERROR', `Failed: ${username} - ${err.message}`);
      progress.failed.push({ username, error: err.message, time: new Date().toISOString() });
    }

    // Save progress periodically
    if ((i + 1) % 10 === 0) {
      saveProgress(progress);
      const pct = ((i + 1) / usersToProcess.length * 100).toFixed(1);
      log('PROG', `${i + 1}/${usersToProcess.length} (${pct}%) - Total: ${totalBookmarks} bookmarks, ${totalNewBookmarks} new`);
    }

    await sleep(CONFIG.DELAY_BETWEEN_USERS_MS);
  }

  progress.lastSync = new Date().toISOString();
  saveProgress(progress);

  log('INFO', 'Scrape complete!');
  log('INFO', `Total: ${totalBookmarks} bookmarks, ${totalRelationships} relationships, ${totalNewBookmarks} new`);
}

main().catch(err => {
  log('ERROR', `Fatal: ${err.message}`);
  process.exit(1);
});
