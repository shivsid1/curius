#!/usr/bin/env node
/**
 * Two-Pass Tagging Script for Brev GPU
 *
 * Pass 1: Simple fetch for regular sites
 * Pass 2: Puppeteer for JS-rendered sites
 * Fallback: Title-only for unfetchable
 *
 * Usage:
 *   node scripts/tag-two-pass.js              # Run both passes
 *   node scripts/tag-two-pass.js --pass1      # Only simple fetch pass
 *   node scripts/tag-two-pass.js --pass2      # Only Puppeteer pass
 *   node scripts/tag-two-pass.js --status     # Show progress
 *   node scripts/tag-two-pass.js --reset      # Reset progress
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { classifyURL, shouldSkip, needsPuppeteer } = require('./domain-rules');

// Config
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:72b';
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 5;
const FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT) || 8000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TAXONOMY = {
  'AI/ML': ['LLMs & Language Models', 'Computer Vision', 'AI Research', 'AI Tools & APIs', 'AI Agents', 'AI Ethics & Safety', 'AI Hardware'],
  'Tech': ['Web Development', 'Mobile Development', 'DevOps & Infrastructure', 'Databases', 'Security', 'Programming Languages', 'Open Source'],
  'Startups': ['Fundraising & VC', 'Growth & Marketing', 'Product Management', 'Hiring & Culture', 'Strategy', 'Founder Stories'],
  'Science': ['Biology & Biotech', 'Physics', 'Chemistry', 'Space & Astronomy', 'Climate & Environment', 'Neuroscience', 'Mathematics'],
  'Finance': ['Investing', 'Markets & Trading', 'Personal Finance', 'Economics', 'Crypto & Web3'],
  'Design': ['UI/UX Design', 'Visual Design', 'Design Systems', 'Typography', 'Branding'],
  'Writing': ['Essays & Opinion', 'Technical Writing', 'Fiction', 'Journalism', 'Newsletters'],
  'Health': ['Longevity', 'Fitness', 'Mental Health', 'Nutrition', 'Medicine'],
  'Philosophy': ['Ethics', 'Epistemology', 'Rationality', 'Politics', 'History of Ideas', 'Psychology'],
  'Education': ['Online Courses', 'Learning Methods', 'Research', 'Tutorials', 'Books & Reading'],
  'Media': ['Podcasts', 'Videos', 'News', 'Music', 'Games'],
  'Tools': ['Productivity', 'Developer Tools', 'Design Tools', 'Automation', 'Communication'],
  'Culture': ['Art', 'History', 'Society', 'Travel', 'Food', 'Sports', 'Literature'],
  'Career': ['Job Hunting', 'Skill Development', 'Networking', 'Remote Work', 'Leadership'],
};

const ALL_CATEGORIES = Object.keys(TAXONOMY);

function formatTaxonomyForPrompt() {
  return Object.entries(TAXONOMY)
    .map(([main, subs]) => `${main}: ${subs.join(', ')}`)
    .join('\n');
}

// Progress tracking
const PROGRESS_DIR = path.join(__dirname, '../data/progress');
const PROGRESS_FILE = path.join(PROGRESS_DIR, 'two-pass-progress.json');
const PUPPETEER_QUEUE_FILE = path.join(PROGRESS_DIR, 'puppeteer-queue.jsonl');
const FAILED_FILE = path.join(PROGRESS_DIR, 'two-pass-failed.jsonl');

let progress = {
  pass1: { processed: 0, success: 0, failed: 0, skipped: 0, queued: 0, lastId: 0 },
  pass2: { processed: 0, success: 0, failed: 0, lastId: 0 },
  startTime: null
};

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log('Resumed from checkpoint');
    }
  } catch (e) {
    console.log('Starting fresh');
  }
  if (!progress.startTime) progress.startTime = Date.now();
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
}

function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function queueForPuppeteer(bookmark) {
  fs.appendFileSync(PUPPETEER_QUEUE_FILE, JSON.stringify(bookmark) + '\n');
  progress.pass1.queued++;
}

function logFailed(bookmark, reason) {
  fs.appendFileSync(FAILED_FILE, JSON.stringify({ ...bookmark, reason, ts: Date.now() }) + '\n');
}

// Timeout wrapper
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

// Simple fetch content
async function fetchContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, header, footer, aside, iframe, noscript, .ad, .sidebar, .comments').remove();

    // Extract content
    let content = $('article').text()
      || $('main').text()
      || $('.post-content, .entry-content, .content, .article-body').text()
      || $('body').text();

    content = content.replace(/\s+/g, ' ').trim();

    // Check if we got meaningful content
    if (content.length < 100) {
      return null; // Likely JS-rendered
    }

    return content.substring(0, 4000);
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// LLM categorization
async function categorize(bookmark, content) {
  const hasContent = content && content.length > 100;

  const prompt = `Classify this into ONE category and ONE subcategory.

TAXONOMY:
${formatTaxonomyForPrompt()}

ARTICLE:
Title: ${bookmark.title || 'Untitled'}
Domain: ${bookmark.domain}
${hasContent ? `Content: ${content}` : '(No content - use title/domain only)'}

Return ONLY JSON: {"category": "Name", "subcategory": "Name"}`;

  const response = await withTimeout(
    fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 80 }
      })
    }),
    30000
  );

  const data = await response.json();
  const text = data.response || '';
  const match = text.match(/\{[\s\S]*?\}/);

  if (!match) return null;

  const parsed = JSON.parse(match[0]);

  // Validate category
  if (!ALL_CATEGORIES.includes(parsed.category)) {
    const found = ALL_CATEGORIES.find(c => c.toLowerCase() === parsed.category.toLowerCase());
    if (found) parsed.category = found;
    else return null;
  }

  return parsed;
}

// Save tag to database
async function saveTag(bookmarkId, category, subcategory) {
  const { error } = await supabase.from('bookmark_tags_v2').upsert({
    bookmark_id: bookmarkId,
    topic: category,
    subtopic: subcategory
  }, { onConflict: 'bookmark_id' });

  return !error;
}

// Get untagged bookmarks
async function getUntaggedBookmarks(afterId, limit) {
  const { data: taggedIds } = await supabase
    .from('bookmark_tags_v2')
    .select('bookmark_id');

  const taggedSet = new Set(taggedIds?.map(t => t.bookmark_id) || []);

  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('id, link, title, domain')
    .gt('id', afterId)
    .order('id', { ascending: true })
    .limit(limit * 2);

  return (bookmarks || []).filter(b => !taggedSet.has(b.id)).slice(0, limit);
}

// Process single bookmark in Pass 1
async function processPass1(bookmark) {
  const url = bookmark.link;
  const classification = classifyURL(url);

  // Skip known-bad domains
  if (classification === 'skip') {
    progress.pass1.skipped++;
    // Tag with title-only immediately
    try {
      const result = await categorize(bookmark, null);
      if (result && await saveTag(bookmark.id, result.category, result.subcategory)) {
        console.log(`[SKIP->OK] ${bookmark.id}: ${result.category} (title-only)`);
        progress.pass1.success++;
      } else {
        progress.pass1.failed++;
      }
    } catch (e) {
      progress.pass1.failed++;
    }
    return;
  }

  // Queue JS sites for Pass 2
  if (classification === 'puppeteer') {
    queueForPuppeteer(bookmark);
    console.log(`[QUEUE] ${bookmark.id}: ${bookmark.domain} -> Puppeteer`);
    return;
  }

  // Try simple fetch
  try {
    const content = await fetchContent(url);

    if (!content) {
      // No content = likely JS-rendered, queue for Puppeteer
      queueForPuppeteer(bookmark);
      console.log(`[QUEUE] ${bookmark.id}: No content -> Puppeteer`);
      return;
    }

    const result = await categorize(bookmark, content);

    if (result && await saveTag(bookmark.id, result.category, result.subcategory)) {
      console.log(`[OK] ${bookmark.id}: ${result.category} > ${result.subcategory}`);
      progress.pass1.success++;
    } else {
      // Categorization failed, try title-only
      const fallback = await categorize(bookmark, null);
      if (fallback && await saveTag(bookmark.id, fallback.category, fallback.subcategory)) {
        console.log(`[OK-TITLE] ${bookmark.id}: ${fallback.category}`);
        progress.pass1.success++;
      } else {
        progress.pass1.failed++;
        logFailed(bookmark, 'categorization failed');
      }
    }
  } catch (e) {
    // Fetch failed - check if should retry with Puppeteer or use title-only
    if (e.message.includes('429') || e.message.includes('403')) {
      // Rate limited or blocked - use title-only
      try {
        const result = await categorize(bookmark, null);
        if (result && await saveTag(bookmark.id, result.category, result.subcategory)) {
          console.log(`[BLOCKED->OK] ${bookmark.id}: ${result.category} (title-only)`);
          progress.pass1.success++;
        } else {
          progress.pass1.failed++;
        }
      } catch {
        progress.pass1.failed++;
      }
    } else {
      // Other error - queue for Puppeteer retry
      queueForPuppeteer(bookmark);
      console.log(`[QUEUE] ${bookmark.id}: ${e.message} -> Puppeteer`);
    }
  }
}

// Run Pass 1
async function runPass1() {
  console.log('\n========== PASS 1: SIMPLE FETCH ==========\n');
  console.log(`Model: ${MODEL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Timeout: ${FETCH_TIMEOUT}ms\n`);

  // Get total count
  const { data: maxIdData } = await supabase
    .from('bookmarks')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);
  const maxId = maxIdData?.[0]?.id || 0;

  const { data: taggedCount } = await supabase
    .from('bookmark_tags_v2')
    .select('bookmark_id');
  const remaining = maxId - (taggedCount?.length || 0);

  console.log(`Remaining to process: ~${remaining}\n`);

  while (true) {
    const batch = await getUntaggedBookmarks(progress.pass1.lastId, CONCURRENCY * 2);

    if (batch.length === 0) {
      console.log('\nPass 1 complete!');
      break;
    }

    // Process with concurrency
    const chunks = [];
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      chunks.push(batch.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (bookmark) => {
        try {
          await processPass1(bookmark);
        } catch (e) {
          console.log(`[ERR] ${bookmark.id}: ${e.message}`);
          progress.pass1.failed++;
        }
        progress.pass1.lastId = Math.max(progress.pass1.lastId, bookmark.id);
        progress.pass1.processed++;
      }));
    }

    saveProgress();

    // Stats
    const elapsed = (Date.now() - progress.startTime) / 1000 / 60;
    const rate = progress.pass1.processed / elapsed;
    console.log(`\n--- Pass1: ${progress.pass1.processed} done | ${rate.toFixed(0)}/min | OK:${progress.pass1.success} QUEUE:${progress.pass1.queued} SKIP:${progress.pass1.skipped} ERR:${progress.pass1.failed} ---\n`);
  }
}

// Run Pass 2 (Puppeteer) - placeholder, needs separate script
async function runPass2() {
  console.log('\n========== PASS 2: PUPPETEER ==========\n');
  console.log('Loading Puppeteer queue...');

  if (!fs.existsSync(PUPPETEER_QUEUE_FILE)) {
    console.log('No Puppeteer queue found. Run Pass 1 first.');
    return;
  }

  const lines = fs.readFileSync(PUPPETEER_QUEUE_FILE, 'utf8').trim().split('\n');
  console.log(`${lines.length} bookmarks queued for Puppeteer\n`);

  // TODO: Implement Puppeteer processing
  console.log('Puppeteer processing not yet implemented.');
  console.log('Run: node scripts/tag-puppeteer.js');
}

// Main
async function main() {
  loadProgress();

  // Test Ollama connection
  try {
    const test = await fetch(`${OLLAMA_URL}/api/tags`);
    const models = await test.json();
    console.log('Ollama connected. Models:', models.models?.map(m => m.name).slice(0, 3).join(', '));
  } catch (e) {
    console.error('Cannot connect to Ollama at', OLLAMA_URL);
    console.error('Start with: ollama serve');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    console.log('\n=== PROGRESS ===');
    console.log('Pass 1:', progress.pass1);
    console.log('Pass 2:', progress.pass2);
    if (fs.existsSync(PUPPETEER_QUEUE_FILE)) {
      const lines = fs.readFileSync(PUPPETEER_QUEUE_FILE, 'utf8').trim().split('\n');
      console.log('Puppeteer queue:', lines.length);
    }
    process.exit(0);
  }

  if (args.includes('--reset')) {
    progress = {
      pass1: { processed: 0, success: 0, failed: 0, skipped: 0, queued: 0, lastId: 0 },
      pass2: { processed: 0, success: 0, failed: 0, lastId: 0 },
      startTime: null
    };
    saveProgress();
    if (fs.existsSync(PUPPETEER_QUEUE_FILE)) fs.unlinkSync(PUPPETEER_QUEUE_FILE);
    if (fs.existsSync(FAILED_FILE)) fs.unlinkSync(FAILED_FILE);
    console.log('Progress reset');
    process.exit(0);
  }

  if (args.includes('--pass1')) {
    await runPass1();
  } else if (args.includes('--pass2')) {
    await runPass2();
  } else {
    await runPass1();
    await runPass2();
  }

  saveProgress();
  console.log('\n=== COMPLETE ===');
  console.log('Pass 1:', progress.pass1);
  console.log('Pass 2:', progress.pass2);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  saveProgress();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[CRASH]', err);
  saveProgress();
  process.exit(1);
});

main().catch(err => {
  console.error('Fatal:', err);
  saveProgress();
  process.exit(1);
});
