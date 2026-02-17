#!/usr/bin/env node
/**
 * GPU-accelerated tagging using local LLM on Brev.dev
 * Fetches article content for better categorization
 *
 * Setup on Brev:
 *   1. Create GPU instance (A100 or L40S recommended)
 *   2. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh
 *   3. Pull model: ollama pull llama3.1:70b (or mixtral:8x22b)
 *   4. Clone repo and run: node scripts/tag-brev-gpu.js
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Config
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.1:70b';
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 3;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;

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

const PROGRESS_FILE = path.join(__dirname, '../data/progress/tag-brev-progress.json');

let progress = { processed: 0, successful: 0, failed: 0, lastProcessedId: 0, startTime: null };

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`Resumed: ${progress.processed} done, last ID: ${progress.lastProcessedId}`);
    }
  } catch (e) {
    console.log('Starting fresh');
  }
  if (!progress.startTime) progress.startTime = Date.now();
}

function saveProgress() {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Timeout wrapper
function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

// Fetch article content
async function fetchContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $('script, style, nav, header, footer, aside, iframe, noscript, .ad, .advertisement, .sidebar').remove();

    // Try to get main content
    let content = $('article').text()
      || $('main').text()
      || $('.post-content').text()
      || $('.entry-content').text()
      || $('.content').text()
      || $('body').text();

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim();

    // Return first 4000 chars for context (more than before)
    return content.length > 100 ? content.substring(0, 4000) : null;
  } catch (e) {
    return null;
  }
}

// Categorize with local LLM
async function categorizeWithLLM(bookmark, content) {
  const prompt = `You are a content categorizer. Analyze this article and classify it into exactly ONE category and ONE subcategory from the taxonomy below.

TAXONOMY:
${formatTaxonomyForPrompt()}

ARTICLE INFO:
Title: ${bookmark.title || 'Untitled'}
Domain: ${bookmark.domain}
URL: ${bookmark.link}

ARTICLE CONTENT:
${content || '[No content available - categorize based on title and domain]'}

Based on the content, choose the most appropriate category and subcategory. Return ONLY valid JSON:
{"category": "CategoryName", "subcategory": "SubcategoryName"}`;

  try {
    const response = await withTimeout(
      fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 100,
          }
        })
      }),
      30000 // 30s timeout for GPU inference
    );

    const data = await response.json();
    const text = data.response || '';

    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (!ALL_CATEGORIES.includes(parsed.category)) {
      // Try to fuzzy match
      const found = ALL_CATEGORIES.find(c =>
        c.toLowerCase() === parsed.category.toLowerCase()
      );
      if (found) parsed.category = found;
      else return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

// Process a single bookmark
async function processBookmark(bookmark) {
  const content = await fetchContent(bookmark.link);
  const result = await categorizeWithLLM(bookmark, content);

  if (result) {
    const { error } = await supabase.from('bookmark_tags_v2').upsert({
      bookmark_id: bookmark.id,
      topic: result.category,
      subtopic: result.subcategory
    }, { onConflict: 'bookmark_id' });

    if (!error) {
      return { success: true, result };
    }
  }
  return { success: false };
}

// Get untagged bookmarks
async function getUntaggedBookmarks(afterId, limit) {
  const { data: taggedIds } = await supabase
    .from('bookmark_tags_v2')
    .select('bookmark_id');

  const taggedSet = new Set(taggedIds.map(t => t.bookmark_id));

  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('id, link, title, domain')
    .gt('id', afterId)
    .order('id', { ascending: true })
    .limit(limit * 2);

  return (bookmarks || []).filter(b => !taggedSet.has(b.id)).slice(0, limit);
}

// Process batch with concurrency
async function processBatch(bookmarks) {
  const results = [];

  for (let i = 0; i < bookmarks.length; i += CONCURRENCY) {
    const chunk = bookmarks.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (bookmark) => {
        try {
          const result = await processBookmark(bookmark);
          if (result.success) {
            progress.successful++;
            console.log(`[OK] ${bookmark.id}: ${result.result.category} > ${result.result.subcategory}`);
          } else {
            progress.failed++;
            console.log(`[SKIP] ${bookmark.id}: Could not categorize`);
          }
          progress.lastProcessedId = bookmark.id;
          progress.processed++;
          return result;
        } catch (err) {
          progress.failed++;
          progress.lastProcessedId = bookmark.id;
          progress.processed++;
          console.log(`[ERR] ${bookmark.id}: ${err.message}`);
          return { success: false };
        }
      })
    );
    results.push(...chunkResults);
  }

  return results;
}

async function run() {
  loadProgress();

  console.log('=== BREV GPU TAGGING ===\n');
  console.log(`Model: ${MODEL}`);
  console.log(`Ollama URL: ${OLLAMA_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  // Test Ollama connection
  try {
    const test = await fetch(`${OLLAMA_URL}/api/tags`);
    const models = await test.json();
    console.log('Available models:', models.models?.map(m => m.name).join(', ') || 'none');
  } catch (e) {
    console.error('Cannot connect to Ollama. Make sure it is running.');
    console.error('Start with: ollama serve');
    process.exit(1);
  }

  // Get total estimate
  const { data: v2Count } = await supabase
    .from('bookmark_tags_v2')
    .select('bookmark_id');
  const { data: maxIdData } = await supabase
    .from('bookmarks')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  const totalTagged = v2Count?.length || 0;
  const maxId = maxIdData?.[0]?.id || 0;
  const estimated = maxId - totalTagged;

  console.log(`\nTotal bookmarks: ${maxId}`);
  console.log(`Already tagged: ${totalTagged}`);
  console.log(`Remaining: ~${estimated}\n`);

  while (true) {
    const batch = await getUntaggedBookmarks(progress.lastProcessedId, BATCH_SIZE);

    if (batch.length === 0) {
      console.log('\nNo more untagged bookmarks!');
      break;
    }

    await processBatch(batch);
    saveProgress();

    // Stats
    const elapsed = (Date.now() - progress.startTime) / 1000;
    const rate = progress.processed / elapsed;
    const remaining = estimated - progress.processed;
    const eta = remaining / rate;

    const pct = ((progress.processed / estimated) * 100).toFixed(1);
    console.log(`\n--- ${pct}% | ${progress.processed}/${estimated} | ${rate.toFixed(1)}/s | ETA: ${(eta/60).toFixed(0)}min ---\n`);
  }

  saveProgress();
  console.log('\n=== COMPLETE ===');
  console.log(`Processed: ${progress.processed}`);
  console.log(`Successful: ${progress.successful}`);
  console.log(`Failed: ${progress.failed}`);
}

// CLI
if (process.argv.includes('--status')) {
  loadProgress();
  console.log(progress);
  process.exit(0);
}

if (process.argv.includes('--reset')) {
  progress = { processed: 0, successful: 0, failed: 0, lastProcessedId: 0, startTime: null };
  saveProgress();
  console.log('Progress reset');
  process.exit(0);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  saveProgress();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[CRASH]', err.message);
  saveProgress();
});

run().catch(err => {
  console.error('Fatal:', err);
  saveProgress();
});
