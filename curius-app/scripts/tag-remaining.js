#!/usr/bin/env node
/**
 * Tag remaining bookmarks that don't have entries in bookmark_tags_v2
 * Uses Claude API for categorization (cloud-friendly)
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CLAUDE_KEY = process.env.CLAUDE_KEY;

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

const PROGRESS_FILE = path.join(__dirname, '../data/progress/tag-remaining-progress.json');

let progress = { processed: 0, successful: 0, failed: 0, lastProcessedId: 0 };

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`Resumed: ${progress.processed} done, last ID: ${progress.lastProcessedId}`);
    }
  } catch (e) {
    console.log('Starting fresh');
  }
}

function saveProgress() {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Timeout wrapper for async operations
function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}

async function categorizeWithClaude(bookmark) {
  const prompt = `Classify this link into exactly ONE category and ONE subcategory from the taxonomy below.

TAXONOMY:
${formatTaxonomyForPrompt()}

LINK INFO:
Title: ${bookmark.title || 'Untitled'}
Domain: ${bookmark.domain}
URL: ${bookmark.link}

Return ONLY valid JSON with this exact format:
{"category": "CategoryName", "subcategory": "SubcategoryName"}

Choose the most specific matching category. If unsure, use "Culture" as default.`;

  const response = await withTimeout(
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    }),
    15000
  );

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (!ALL_CATEGORIES.includes(parsed.category)) {
      console.log(`  Invalid category: ${parsed.category}`);
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

async function getUntaggedBookmarks(afterId, limit = 50) {
  // Get IDs already in v2
  const { data: taggedIds } = await supabase
    .from('bookmark_tags_v2')
    .select('bookmark_id');

  const taggedSet = new Set(taggedIds.map(t => t.bookmark_id));

  // Get bookmarks after lastProcessedId
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('id, link, title, domain')
    .gt('id', afterId)
    .order('id', { ascending: true })
    .limit(limit * 2); // Get more to filter

  if (error) {
    console.log('Error fetching bookmarks:', error.message);
    return [];
  }

  // Filter to only untagged
  return bookmarks.filter(b => !taggedSet.has(b.id)).slice(0, limit);
}

async function run() {
  loadProgress();
  console.log('=== TAGGING REMAINING BOOKMARKS ===\n');
  console.log(`Using Claude API (Haiku) for categorization\n`);

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

  console.log(`Estimated remaining: ~${estimated} bookmarks\n`);

  let consecutiveErrors = 0;

  while (true) {
    const batch = await getUntaggedBookmarks(progress.lastProcessedId, 20);

    if (batch.length === 0) {
      console.log('\nNo more untagged bookmarks found!');
      break;
    }

    for (const bookmark of batch) {
      try {
        const result = await categorizeWithClaude(bookmark);

        if (result) {
          const { error } = await supabase.from('bookmark_tags_v2').upsert({
            bookmark_id: bookmark.id,
            topic: result.category,
            subtopic: result.subcategory
          }, { onConflict: 'bookmark_id' });

          if (!error) {
            progress.successful++;
            console.log(`[OK] ${bookmark.id}: ${result.category} > ${result.subcategory}`);
            consecutiveErrors = 0;
          } else {
            progress.failed++;
            console.log(`[DB ERR] ${bookmark.id}: ${error.message}`);
          }
        } else {
          progress.failed++;
          console.log(`[SKIP] ${bookmark.id}: Could not categorize`);
        }
      } catch (err) {
        progress.failed++;
        console.log(`[ERR] ${bookmark.id}: ${err.message}`);
        consecutiveErrors++;

        // If too many consecutive errors, pause
        if (consecutiveErrors >= 5) {
          console.log('\nToo many consecutive errors, pausing 30s...');
          await new Promise(r => setTimeout(r, 30000));
          consecutiveErrors = 0;
        }
      }

      progress.lastProcessedId = bookmark.id;
      progress.processed++;

      // Rate limit: ~20 requests per minute for Haiku
      await new Promise(r => setTimeout(r, 3000));
    }

    saveProgress();

    const pct = ((progress.processed / estimated) * 100).toFixed(1);
    console.log(`\n--- ${pct}% | ${progress.processed}/${estimated} | OK:${progress.successful} ERR:${progress.failed} ---\n`);
  }

  saveProgress();
  console.log('\n=== TAGGING COMPLETE ===');
  console.log(`Processed: ${progress.processed}`);
  console.log(`Successful: ${progress.successful}`);
  console.log(`Failed: ${progress.failed}`);
}

// CLI options
if (process.argv.includes('--status')) {
  loadProgress();
  console.log(progress);
  process.exit(0);
}

if (process.argv.includes('--reset')) {
  progress = { processed: 0, successful: 0, failed: 0, lastProcessedId: 0 };
  saveProgress();
  console.log('Progress reset');
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  saveProgress();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[CRASH]', err.message);
  saveProgress();
});

run().catch(err => {
  console.error('Fatal error:', err);
  saveProgress();
});
