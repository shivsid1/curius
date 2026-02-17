#!/usr/bin/env node
/**
 * Content-based bookmark categorization using Jina Reader + Claude API
 *
 * This script:
 * 1. Fetches untagged bookmarks from Supabase
 * 2. Uses Jina Reader (free) to extract article content
 * 3. Sends content to Claude for accurate categorization
 * 4. Saves results to bookmark_tags_v2
 * 5. Notifies via email/notification when credits run out
 */

require('dotenv').config({ path: '.env.local' });

// Prevent TLS crashes from killing the process
process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTED]', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[REJECTION]', err.message || err);
});

const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// =============================================================================
// TAXONOMY
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

const ALL_CATEGORIES = Object.keys(TAXONOMY);
const ALL_SUBCATEGORIES = {};
for (const [cat, subs] of Object.entries(TAXONOMY)) {
  for (const sub of subs) {
    ALL_SUBCATEGORIES[sub.toLowerCase()] = { category: cat, subcategory: sub };
  }
}

function formatTaxonomyForPrompt() {
  return Object.entries(TAXONOMY)
    .map(([main, subs]) => `${main}: ${subs.join(', ')}`)
    .join('\n');
}

// =============================================================================
// CONFIG
// =============================================================================
const USE_LOCAL = process.argv.includes('--local') || process.argv.includes('-l');

const CONFIG = {
  FETCH_TIMEOUT_MS: 10000,
  API_TIMEOUT_MS: USE_LOCAL ? 120000 : 30000, // Local models need more time
  PARALLEL_WORKERS: USE_LOCAL ? 1 : 100, // single worker to prevent crashes
  DELAY_BETWEEN_BATCHES_MS: USE_LOCAL ? 200 : 100,
  PROGRESS_FILE: path.join(__dirname, '../data/progress/content-categorize-progress.json'),
  NOTIFICATION_EMAIL: process.env.NOTIFICATION_EMAIL || null,
  MAX_CONTENT_CHARS: USE_LOCAL ? 50000 : 100000, // Smaller for local to speed up
  MODEL: USE_LOCAL ? 'llama3.2' : 'gpt-4o-mini',
  API_URL: USE_LOCAL ? 'http://localhost:11434/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions',
};

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
function log(level, msg) {
  const time = new Date().toISOString().substring(11, 19);
  console.log(`[${time}] [${level}] ${msg}`);
}

// =============================================================================
// PROGRESS TRACKING
// =============================================================================
let progress = {
  processed: 0,
  successful: 0,
  failed: 0,
  fetchErrors: 0,
  apiErrors: 0,
  startTime: null,
  lastBookmarkId: null,
  creditsExhausted: false,
  // Detailed failure breakdown
  failureTypes: {
    paywalled: 0,      // HTTP 401, 403
    notFound: 0,       // HTTP 404
    serverError: 0,    // HTTP 5xx
    timeout: 0,        // Request timeout
    jsOnly: 0,         // No readable content (JS-rendered)
    deadLink: 0,       // Connection refused, DNS failure
    other: 0,
  },
};

// Track failed bookmarks for later review
const FAILURES_FILE = path.join(__dirname, '../data/progress/failed-bookmarks.jsonl');

function logFailure(bookmarkId, url, reason, errorType) {
  try {
    const entry = JSON.stringify({ id: bookmarkId, url, reason, type: errorType, ts: Date.now() }) + '\n';
    fs.appendFileSync(FAILURES_FILE, entry);
  } catch (e) {}
}

function loadProgress() {
  try {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf8'));
      progress = { ...progress, ...data };
      log('INFO', `Resumed from progress: ${progress.processed} processed, last ID: ${progress.lastBookmarkId}`);
    }
  } catch (e) {
    log('WARN', 'Could not load progress file, starting fresh');
  }
}

function saveProgress() {
  try {
    fs.mkdirSync(path.dirname(CONFIG.PROGRESS_FILE), { recursive: true });
    fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (e) {
    log('WARN', 'Could not save progress');
  }
}

// =============================================================================
// NOTIFICATION
// =============================================================================
function sendMacNotification(title, message) {
  const script = `display notification "${message}" with title "${title}"`;
  exec(`osascript -e '${script}'`);
}

async function sendEmailNotification(subject, body) {
  if (!CONFIG.NOTIFICATION_EMAIL) {
    log('WARN', 'No NOTIFICATION_EMAIL set in .env.local');
    return;
  }

  // Try using local mail command first (works on macOS)
  exec(`echo "${body}" | mail -s "${subject}" ${CONFIG.NOTIFICATION_EMAIL}`, (err) => {
    if (err) {
      log('WARN', `Could not send email: ${err.message}`);
    } else {
      log('INFO', `Email sent to ${CONFIG.NOTIFICATION_EMAIL}`);
    }
  });
}

async function notifyCreditsExhausted() {
  const msg = `Curius categorization stopped - Claude API credits exhausted.

Processed: ${progress.processed}
Successful: ${progress.successful}
Failed: ${progress.failed}

Add more credits and run: npm run categorize:content`;

  sendMacNotification('Curius: Credits Exhausted', 'Add more Claude API credits');
  await sendEmailNotification('Curius Categorization - Credits Exhausted', msg);
  log('ERROR', 'CREDITS EXHAUSTED - notification sent');
}

async function notifyComplete() {
  const elapsed = ((Date.now() - progress.startTime) / 1000 / 60).toFixed(1);
  const msg = `Curius content categorization complete!

Processed: ${progress.processed}
Successful: ${progress.successful}
Failed: ${progress.failed}
Time: ${elapsed} minutes`;

  sendMacNotification('Curius: Categorization Complete', `${progress.successful} articles categorized`);
  await sendEmailNotification('Curius Categorization - Complete', msg);
}

// =============================================================================
// LOCAL ARTICLE EXTRACTION (cheerio - fast, no rate limits)
// =============================================================================
async function fetchArticleContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const status = res.status;
      if (status === 401 || status === 403) {
        return { error: `HTTP ${status}`, errorType: 'paywalled' };
      } else if (status === 404) {
        return { error: `HTTP ${status}`, errorType: 'notFound' };
      } else if (status >= 500) {
        return { error: `HTTP ${status}`, errorType: 'serverError' };
      }
      return { error: `HTTP ${status}`, errorType: 'other' };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove script, style, nav, header, footer, aside elements
    $('script, style, nav, header, footer, aside, iframe, noscript, svg, form').remove();

    // Try to get article content from common selectors
    let content = '';
    const selectors = ['article', 'main', '.post-content', '.entry-content', '.content', '#content', '.article-body'];

    for (const sel of selectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 200) {
        content = el.text();
        break;
      }
    }

    // Fallback to body
    if (!content || content.length < 200) {
      content = $('body').text();
    }

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim();

    if (content.length < 100) {
      return { error: 'No readable content (JS-only or empty page)', errorType: 'jsOnly' };
    }

    // Truncate if needed
    if (content.length > CONFIG.MAX_CONTENT_CHARS) {
      content = content.substring(0, CONFIG.MAX_CONTENT_CHARS) + ' [truncated]';
    }

    return { content };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { error: 'Timeout', errorType: 'timeout' };
    }
    // Connection errors (ECONNREFUSED, ENOTFOUND, etc.)
    const msg = err.message.toLowerCase();
    if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('getaddrinfo')) {
      return { error: err.message, errorType: 'deadLink' };
    }
    return { error: err.message, errorType: 'other' };
  }
}

// =============================================================================
// LLM CATEGORIZATION (OpenAI or local Ollama)
// =============================================================================
async function categorizeWithLLM(bookmark, content, retries = 3) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OAI_KEY;
  if (!USE_LOCAL && !apiKey) {
    throw new Error('OPENAI_API_KEY or OAI_KEY not set in .env.local');
  }

  const prompt = `You are a content categorizer. Classify the article below into exactly ONE category and ONE subcategory.

TAXONOMY:
${formatTaxonomyForPrompt()}

ARTICLE:
Title: ${bookmark.title || 'Untitled'}
URL: ${bookmark.link}

CONTENT (first 2000 chars):
${content.substring(0, 2000)}

INSTRUCTIONS:
1. Read the content carefully - focus on WHAT the article is actually ABOUT
2. Pick the category that matches the article's PRIMARY SUBJECT MATTER
3. Common mistakes to AVOID:
   - Bitcoin/crypto articles -> Finance > Crypto & Web3 (NOT Tech > Security)
   - News about politics/events -> Media > News or Philosophy > Politics (NOT Tech)
   - Personal essays/life advice -> Writing > Essays & Opinion or Philosophy
   - Business/company news -> Startups or Finance (NOT Tech unless about technology itself)
   - Food/restaurant reviews -> Culture > Food (NOT Media > News)
4. Only use Tech categories if the article is actually about technology, programming, or software
5. Only use AI/ML if the article is specifically about artificial intelligence or machine learning
6. Rate your confidence: high (clearly fits one category), medium (could fit 2 categories), low (unclear/doesn't fit well)

OUTPUT: Return ONLY this JSON, nothing else:
{"category": "CategoryName", "subcategory": "SubcategoryName", "confidence": "high"}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (!USE_LOCAL) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: CONFIG.MODEL,
          max_tokens: 100,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();

        // Check for credit exhaustion
        if (errText.includes('quota') || errText.includes('billing') || errText.includes('insufficient')) {
          progress.creditsExhausted = true;
          throw new Error('CREDITS_EXHAUSTED');
        }

        // Rate limited - retry with backoff
        if (res.status === 429) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw new Error(`API ${res.status}: ${errText.substring(0, 100)}`);
      }

      const response = await res.json();
      const text = response.choices?.[0]?.message?.content || '';

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate category
      if (!ALL_CATEGORIES.includes(parsed.category)) {
        throw new Error(`Invalid category: ${parsed.category}`);
      }

      // Validate subcategory belongs to category
      const validSubs = TAXONOMY[parsed.category];
      if (!validSubs.includes(parsed.subcategory)) {
        // Try to find closest match
        const lowerSub = parsed.subcategory.toLowerCase();
        const match = validSubs.find(s => s.toLowerCase() === lowerSub);
        if (match) {
          parsed.subcategory = match;
        } else {
          // Default to first subcategory
          parsed.subcategory = validSubs[0];
        }
      }

      return parsed;
    } catch (err) {
      clearTimeout(timeout);
      if (err.message === 'CREDITS_EXHAUSTED') throw err;
      if (attempt === retries - 1) throw err;
      // Otherwise continue to next retry
    }
  }
  throw new Error('Max retries exceeded');
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================
// Cache of untagged IDs to avoid repeated full scans
let untaggedIdsCache = null;
let untaggedIdIndex = 0;

async function loadUntaggedIds() {
  if (untaggedIdsCache) return;

  log('INFO', 'Building list of untagged bookmark IDs (one-time scan)...');

  // Get all bookmark IDs
  let allBookmarkIds = [];
  let page = 0;
  const pageSize = 10000;

  while (true) {
    const { data } = await supabase
      .from('bookmarks')
      .select('id')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    allBookmarkIds = allBookmarkIds.concat(data.map(b => b.id));
    page++;
    if (data.length < pageSize) break;
  }

  // Get all tagged IDs
  let allTaggedIds = new Set();
  page = 0;

  while (true) {
    const { data } = await supabase
      .from('bookmark_tags_v2')
      .select('bookmark_id')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (!data || data.length === 0) break;
    data.forEach(t => allTaggedIds.add(t.bookmark_id));
    page++;
    if (data.length < pageSize) break;
  }

  // Find untagged
  untaggedIdsCache = allBookmarkIds.filter(id => !allTaggedIds.has(id));
  log('INFO', `Found ${untaggedIdsCache.length} untagged bookmarks`);

  // Resume from progress if available
  if (progress.lastBookmarkId) {
    const resumeIdx = untaggedIdsCache.findIndex(id => id > progress.lastBookmarkId);
    if (resumeIdx > 0) {
      untaggedIdIndex = resumeIdx;
      log('INFO', `Resuming from index ${resumeIdx} (after ID ${progress.lastBookmarkId})`);
    }
  }
}

async function getUntaggedBookmarks(limit = 50) {
  await loadUntaggedIds();

  if (untaggedIdIndex >= untaggedIdsCache.length) {
    return [];
  }

  const ids = untaggedIdsCache.slice(untaggedIdIndex, untaggedIdIndex + limit);
  untaggedIdIndex += ids.length;

  // Fetch full bookmark data for these IDs
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('id, link, title, domain')
    .in('id', ids);

  if (error) throw error;

  // Sort by ID to maintain order
  return bookmarks.sort((a, b) => a.id - b.id);
}

async function saveCategory(bookmarkId, category, subcategory) {
  const { error } = await supabase
    .from('bookmark_tags_v2')
    .upsert({
      bookmark_id: bookmarkId,
      topic: category,
      subtopic: subcategory,
    }, { onConflict: 'bookmark_id' });

  if (error) throw error;
}

// Track low-confidence items for later review
const LOW_CONFIDENCE_FILE = path.join(__dirname, '../data/progress/low-confidence.jsonl');

function logLowConfidence(bookmarkId, url, title, category, subcategory, confidence) {
  if (confidence !== 'high') {
    try {
      const entry = JSON.stringify({
        id: bookmarkId, url, title,
        category, subcategory, confidence,
        ts: Date.now()
      }) + '\n';
      fs.appendFileSync(LOW_CONFIDENCE_FILE, entry);
    } catch (e) {}
  }
}

// =============================================================================
// MAIN PROCESSING LOOP
// =============================================================================
async function processBookmark(bookmark) {
  // 1. Fetch article content
  const { content, error: fetchError, errorType } = await fetchArticleContent(bookmark.link);

  if (fetchError) {
    progress.fetchErrors++;
    // Track failure type
    if (errorType && progress.failureTypes[errorType] !== undefined) {
      progress.failureTypes[errorType]++;
    } else {
      progress.failureTypes.other++;
    }
    // Log to failures file for later review
    logFailure(bookmark.id, bookmark.link, fetchError, errorType || 'other');
    log('WARN', `[${errorType || 'error'}] ${bookmark.id}: ${fetchError}`);
    return { success: false, reason: 'fetch_error', errorType };
  }

  // 2. Categorize with LLM
  try {
    const result = await categorizeWithLLM(bookmark, content);
    const confidence = result.confidence || 'high';

    // 3. Save to database
    await saveCategory(bookmark.id, result.category, result.subcategory);

    // 4. Log low-confidence for later review
    logLowConfidence(bookmark.id, bookmark.link, bookmark.title, result.category, result.subcategory, confidence);

    // Track confidence stats
    progress.confidenceStats = progress.confidenceStats || { high: 0, medium: 0, low: 0 };
    progress.confidenceStats[confidence] = (progress.confidenceStats[confidence] || 0) + 1;

    const confIcon = confidence === 'high' ? '+' : confidence === 'medium' ? '~' : '?';
    log('INFO', `[${confIcon}] [${bookmark.id}] ${result.category} > ${result.subcategory} | ${bookmark.title?.substring(0, 40) || bookmark.domain}`);

    return { success: true, ...result };
  } catch (err) {
    if (err.message === 'CREDITS_EXHAUSTED') {
      throw err; // Propagate to stop loop
    }
    progress.apiErrors++;
    log('WARN', `API error for ${bookmark.id}: ${err.message}`);
    return { success: false, reason: 'api_error' };
  }
}

async function processBookmarkWithRetry(bookmark) {
  try {
    const result = await processBookmark(bookmark);
    return { bookmark, result };
  } catch (err) {
    if (err.message === 'CREDITS_EXHAUSTED') {
      throw err; // Propagate to stop all workers
    }
    return { bookmark, result: { success: false, reason: err.message } };
  }
}

async function run() {
  log('INFO', 'Content-based categorization starting...');
  const mode = USE_LOCAL ? 'LOCAL (Ollama)' : 'CLOUD (OpenAI)';
  log('INFO', `Mode: ${mode} | Model: ${CONFIG.MODEL} | Workers: ${CONFIG.PARALLEL_WORKERS}`);

  loadProgress();

  if (!progress.startTime) {
    progress.startTime = Date.now();
  }

  let totalErrors = 0;

  while (true) {
    // Get next batch of untagged bookmarks
    const bookmarks = await getUntaggedBookmarks(CONFIG.PARALLEL_WORKERS * 5);

    if (bookmarks.length === 0) {
      log('INFO', 'No more untagged bookmarks!');
      await notifyComplete();
      break;
    }

    // Process in parallel chunks
    for (let i = 0; i < bookmarks.length; i += CONFIG.PARALLEL_WORKERS) {
      const chunk = bookmarks.slice(i, i + CONFIG.PARALLEL_WORKERS);
      const startTime = Date.now();

      log('INFO', `Processing ${chunk.length} articles in parallel...`);

      try {
        // Process all in parallel
        const results = await Promise.all(
          chunk.map(bookmark => processBookmarkWithRetry(bookmark))
        );

        // Update progress
        for (const { bookmark, result } of results) {
          progress.processed++;
          progress.lastBookmarkId = Math.max(progress.lastBookmarkId || 0, bookmark.id);

          if (result.success) {
            progress.successful++;
          } else {
            progress.failed++;
            totalErrors++;
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const successCount = results.filter(r => r.result.success).length;
        const rate = (progress.successful / ((Date.now() - progress.startTime) / 1000 / 60)).toFixed(1);

        log('INFO', `Batch: ${successCount}/${chunk.length} in ${elapsed}s | Total: ${progress.successful} (~${rate}/min)`);

        saveProgress();

        // Small delay between batches
        await new Promise(r => setTimeout(r, CONFIG.DELAY_BETWEEN_BATCHES_MS));

      } catch (err) {
        if (err.message === 'CREDITS_EXHAUSTED' || progress.creditsExhausted) {
          saveProgress();
          await notifyCreditsExhausted();
          process.exit(1);
        }
        log('ERROR', `Batch error: ${err.message}`);
        totalErrors += chunk.length;
      }

      // Check for too many errors
      if (totalErrors > 100 && totalErrors > progress.successful * 0.5) {
        log('ERROR', 'Too many errors (>50% failure rate) - stopping');
        saveProgress();
        process.exit(1);
      }
    }
  }

  saveProgress();
  log('INFO', `Complete! Processed: ${progress.processed}, Successful: ${progress.successful}, Failed: ${progress.failed}`);
}

// =============================================================================
// CLI
// =============================================================================
const args = process.argv.slice(2);

if (args.includes('--status')) {
  loadProgress();
  console.log('\n=== Content Categorization Progress ===');
  console.log(`Processed: ${progress.processed}`);
  console.log(`Successful: ${progress.successful}`);
  console.log(`Failed: ${progress.failed}`);
  console.log(`Fetch Errors: ${progress.fetchErrors}`);
  console.log(`API Errors: ${progress.apiErrors}`);
  console.log(`Last Bookmark ID: ${progress.lastBookmarkId}`);
  console.log(`Credits Exhausted: ${progress.creditsExhausted}`);
  process.exit(0);
}

if (args.includes('--reset')) {
  try {
    fs.unlinkSync(CONFIG.PROGRESS_FILE);
    console.log('Progress reset.');
  } catch (e) {}
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('INFO', 'Shutting down gracefully...');
  saveProgress();
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveProgress();
  process.exit(0);
});

run().catch(err => {
  log('ERROR', err.message);
  saveProgress();
  process.exit(1);
});
