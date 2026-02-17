#!/usr/bin/env node
/**
 * Pass 2: Puppeteer-based tagging for JS-rendered sites
 * Processes bookmarks queued by tag-two-pass.js
 *
 * Usage:
 *   node scripts/tag-puppeteer.js           # Process queue
 *   node scripts/tag-puppeteer.js --status  # Show queue status
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Config
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:72b';
const CONCURRENCY = parseInt(process.env.PUPPETEER_CONCURRENCY) || 2; // Lower for Puppeteer
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT) || 15000;

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

// Progress
const PROGRESS_DIR = path.join(__dirname, '../data/progress');
const QUEUE_FILE = path.join(PROGRESS_DIR, 'puppeteer-queue.jsonl');
const DONE_FILE = path.join(PROGRESS_DIR, 'puppeteer-done.txt');
const FAILED_FILE = path.join(PROGRESS_DIR, 'puppeteer-failed.jsonl');

let progress = { processed: 0, success: 0, failed: 0, startTime: Date.now() };
let doneIds = new Set();

function loadDoneIds() {
  try {
    if (fs.existsSync(DONE_FILE)) {
      const lines = fs.readFileSync(DONE_FILE, 'utf8').trim().split('\n');
      doneIds = new Set(lines.map(l => parseInt(l)).filter(n => !isNaN(n)));
      console.log(`Loaded ${doneIds.size} already-processed IDs`);
    }
  } catch (e) {}
}

function markDone(id) {
  doneIds.add(id);
  fs.appendFileSync(DONE_FILE, id + '\n');
}

function logFailed(bookmark, reason) {
  fs.appendFileSync(FAILED_FILE, JSON.stringify({ ...bookmark, reason, ts: Date.now() }) + '\n');
}

// Load queue
function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    return [];
  }
  const lines = fs.readFileSync(QUEUE_FILE, 'utf8').trim().split('\n');
  return lines
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(b => b && !doneIds.has(b.id));
}

// Timeout wrapper
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

// Fetch with Puppeteer
async function fetchWithPuppeteer(browser, url) {
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      // Block heavy resources
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT
    });

    // Wait a bit for JS to render
    await page.waitForTimeout(2000);

    // Extract text content
    const content = await page.evaluate(() => {
      // Remove noise elements
      const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', '.ad', '.sidebar', '.comments'];
      removeSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });

      // Try to get main content
      const article = document.querySelector('article');
      const main = document.querySelector('main');
      const content = document.querySelector('.content, .post-content, .entry-content');

      const el = article || main || content || document.body;
      return el ? el.innerText : '';
    });

    await page.close();

    const cleaned = content.replace(/\s+/g, ' ').trim();
    return cleaned.length > 100 ? cleaned.substring(0, 4000) : null;

  } catch (e) {
    await page.close();
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

  if (!ALL_CATEGORIES.includes(parsed.category)) {
    const found = ALL_CATEGORIES.find(c => c.toLowerCase() === parsed.category.toLowerCase());
    if (found) parsed.category = found;
    else return null;
  }

  return parsed;
}

// Save tag
async function saveTag(bookmarkId, category, subcategory) {
  const { error } = await supabase.from('bookmark_tags_v2').upsert({
    bookmark_id: bookmarkId,
    topic: category,
    subtopic: subcategory
  }, { onConflict: 'bookmark_id' });
  return !error;
}

// Process single bookmark
async function processBookmark(browser, bookmark) {
  try {
    const content = await fetchWithPuppeteer(browser, bookmark.link);
    const result = await categorize(bookmark, content);

    if (result && await saveTag(bookmark.id, result.category, result.subcategory)) {
      console.log(`[OK] ${bookmark.id}: ${result.category} > ${result.subcategory}`);
      progress.success++;
      markDone(bookmark.id);
      return true;
    } else {
      // Try title-only fallback
      const fallback = await categorize(bookmark, null);
      if (fallback && await saveTag(bookmark.id, fallback.category, fallback.subcategory)) {
        console.log(`[OK-TITLE] ${bookmark.id}: ${fallback.category}`);
        progress.success++;
        markDone(bookmark.id);
        return true;
      }
    }
  } catch (e) {
    console.log(`[ERR] ${bookmark.id}: ${e.message}`);
    // Try title-only fallback
    try {
      const fallback = await categorize(bookmark, null);
      if (fallback && await saveTag(bookmark.id, fallback.category, fallback.subcategory)) {
        console.log(`[FALLBACK] ${bookmark.id}: ${fallback.category}`);
        progress.success++;
        markDone(bookmark.id);
        return true;
      }
    } catch {}
  }

  progress.failed++;
  logFailed(bookmark, 'all attempts failed');
  markDone(bookmark.id); // Mark done to not retry
  return false;
}

// Main
async function main() {
  loadDoneIds();

  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    const queue = loadQueue();
    console.log('=== PUPPETEER QUEUE STATUS ===');
    console.log('Total in queue:', fs.existsSync(QUEUE_FILE) ? fs.readFileSync(QUEUE_FILE, 'utf8').trim().split('\n').length : 0);
    console.log('Already processed:', doneIds.size);
    console.log('Remaining:', queue.length);
    process.exit(0);
  }

  const queue = loadQueue();

  if (queue.length === 0) {
    console.log('No bookmarks in Puppeteer queue.');
    process.exit(0);
  }

  console.log('\n========== PASS 2: PUPPETEER ==========\n');
  console.log(`Queue size: ${queue.length}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Page timeout: ${PAGE_TIMEOUT}ms\n`);

  // Test Ollama
  try {
    await fetch(`${OLLAMA_URL}/api/tags`);
  } catch (e) {
    console.error('Cannot connect to Ollama');
    process.exit(1);
  }

  // Launch browser
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    // Process in batches
    for (let i = 0; i < queue.length; i += CONCURRENCY) {
      const batch = queue.slice(i, i + CONCURRENCY);

      await Promise.all(batch.map(bookmark => processBookmark(browser, bookmark)));

      progress.processed += batch.length;

      const elapsed = (Date.now() - progress.startTime) / 1000 / 60;
      const rate = progress.processed / elapsed;
      const remaining = queue.length - progress.processed;
      const eta = remaining / rate;

      console.log(`\n--- ${progress.processed}/${queue.length} | ${rate.toFixed(1)}/min | ETA: ${eta.toFixed(0)}min | OK:${progress.success} ERR:${progress.failed} ---\n`);
    }
  } finally {
    await browser.close();
  }

  console.log('\n=== PUPPETEER PASS COMPLETE ===');
  console.log(`Processed: ${progress.processed}`);
  console.log(`Success: ${progress.success}`);
  console.log(`Failed: ${progress.failed}`);
}

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  process.exit(0);
});

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
