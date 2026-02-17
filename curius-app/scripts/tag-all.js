#!/usr/bin/env node
/**
 * =============================================================================
 * CURIUS FULL TAGGER - Brev GPU Edition
 * =============================================================================
 *
 * Processes ALL bookmarks with content-based categorization:
 * 1. Fetches bookmarks from Supabase
 * 2. Scrapes content via Firecrawl API
 * 3. Categorizes with local Ollama LLM
 * 4. Writes tags back to Supabase
 *
 * Progress is tracked in Supabase - fully resumable.
 *
 * Usage:
 *   node tag-all.js              # Run full tagger
 *   node tag-all.js --status     # Show progress
 *   node tag-all.js --reset      # Clear all tags and restart
 *
 * =============================================================================
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,

  // Firecrawl
  FIRECRAWL_KEY: process.env.FIRECRAWL_KEY,
  FIRECRAWL_URL: 'https://api.firecrawl.dev/v1/scrape',
  FIRECRAWL_DELAY_MS: parseInt(process.env.FIRECRAWL_DELAY_MS) || 200,

  // Ollama
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen2.5:32b',

  // Processing
  CONCURRENCY: parseInt(process.env.CONCURRENCY) || 8,
  BATCH_SIZE: 100,
  MAX_CONTENT_LENGTH: 3000,

  // Timeouts
  FIRECRAWL_TIMEOUT_MS: 30000,
  OLLAMA_TIMEOUT_MS: 60000,
};

// =============================================================================
// TAXONOMY - Simplified, clear categories
// =============================================================================

const TAXONOMY = {
  'Technology': [
    'Software Engineering',
    'AI & Machine Learning',
    'DevOps & Infrastructure',
    'Security',
    'Hardware',
    'Developer Tools',
  ],
  'Science': [
    'Biology & Biotech',
    'Physics & Math',
    'Medicine & Health',
    'Climate & Environment',
    'Research Papers',
  ],
  'Business': [
    'Startups & Founders',
    'Investing & Finance',
    'Economics',
    'Marketing & Growth',
    'Management & Leadership',
  ],
  'Culture': [
    'Philosophy & Ideas',
    'History',
    'Politics & Society',
    'Art & Design',
    'Books & Literature',
  ],
  'Personal': [
    'Productivity',
    'Career & Skills',
    'Health & Fitness',
    'Learning & Education',
    'Life Advice',
  ],
  'Media': [
    'News & Current Events',
    'Entertainment',
    'Podcasts & Videos',
    'Gaming',
    'Sports',
  ],
};

const CATEGORIES = Object.keys(TAXONOMY);

function formatTaxonomyForPrompt() {
  return Object.entries(TAXONOMY)
    .map(([cat, subs]) => `${cat}: ${subs.join(', ')}`)
    .join('\n');
}

// =============================================================================
// PROMPT - With reasoning and examples
// =============================================================================

function buildPrompt(bookmark, content) {
  return `You are a precise content classifier. Analyze the article and classify it into exactly ONE category and ONE subcategory.

CATEGORIES:
${formatTaxonomyForPrompt()}

EXAMPLES:
- "How GPT-4 transformers work" -> Technology > AI & Machine Learning
- "YC startup raises Series A" -> Business > Startups & Founders
- "The fall of the Roman Empire" -> Culture > History
- "10 habits of successful people" -> Personal > Life Advice
- "New CRISPR breakthrough" -> Science > Biology & Biotech
- "Bitcoin hits all-time high" -> Business > Investing & Finance
- "Review of latest iPhone" -> Technology > Hardware
- "How to negotiate salary" -> Personal > Career & Skills

ARTICLE TO CLASSIFY:
Title: ${bookmark.title || 'Untitled'}
Domain: ${bookmark.domain || 'unknown'}
URL: ${bookmark.link}

Content:
${content || '[No content - classify based on title/domain]'}

INSTRUCTIONS:
1. First, identify the PRIMARY topic of this article in one sentence
2. Then select the single best category and subcategory
3. If unsure between categories, pick the more specific one

Respond with ONLY this JSON (no other text):
{"topic_summary": "one sentence about what this article is about", "category": "CategoryName", "subcategory": "SubcategoryName"}`;
}

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// =============================================================================
// LOGGING
// =============================================================================

const stats = {
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  firecrawlErrors: 0,
  ollamaErrors: 0,
  startTime: Date.now(),
};

function log(level, msg) {
  const time = new Date().toISOString().substring(11, 19);
  const elapsed = ((Date.now() - stats.startTime) / 1000 / 60).toFixed(1);
  const rate = stats.processed > 0 ? (stats.processed / (elapsed || 1)).toFixed(1) : '0';
  console.log(`[${time}] [${elapsed}m] [${stats.processed}/${stats.total}] [${rate}/min] [${level}] ${msg}`);
}

function logProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000 / 60;
  const rate = stats.processed / (elapsed || 1);
  const remaining = stats.total - stats.processed;
  const eta = remaining / (rate || 1);

  console.log('\n--- PROGRESS ---');
  console.log(`Processed: ${stats.processed}/${stats.total} (${((stats.processed/stats.total)*100).toFixed(1)}%)`);
  console.log(`Success: ${stats.success} | Failed: ${stats.failed} | Skipped: ${stats.skipped}`);
  console.log(`Firecrawl errors: ${stats.firecrawlErrors} | Ollama errors: ${stats.ollamaErrors}`);
  console.log(`Rate: ${rate.toFixed(1)}/min | ETA: ${eta.toFixed(0)} min (${(eta/60).toFixed(1)} hrs)`);
  console.log('----------------\n');
}

// =============================================================================
// FIRECRAWL - Scrape content
// =============================================================================

async function scrapeWithFirecrawl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.FIRECRAWL_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.FIRECRAWL_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.FIRECRAWL_KEY}`,
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 20000,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Firecrawl ${response.status}: ${errText.substring(0, 100)}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Firecrawl returned success=false');
    }

    const markdown = data.data?.markdown || '';

    // Truncate to max length
    return markdown.substring(0, CONFIG.MAX_CONTENT_LENGTH);

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Firecrawl timeout');
    }
    throw err;
  }
}

// =============================================================================
// OLLAMA - Categorize with LLM
// =============================================================================

async function categorizeWithOllama(bookmark, content) {
  const prompt = buildPrompt(bookmark, content);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${CONFIG.OLLAMA_URL}/api/generate`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 200,
        },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Ollama ${response.status}`);
    }

    const data = await response.json();
    const text = data.response || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in Ollama response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate category
    if (!CATEGORIES.includes(parsed.category)) {
      // Try case-insensitive match
      const found = CATEGORIES.find(c => c.toLowerCase() === parsed.category?.toLowerCase());
      if (found) {
        parsed.category = found;
      } else {
        throw new Error(`Invalid category: ${parsed.category}`);
      }
    }

    // Validate subcategory exists in taxonomy
    const validSubs = TAXONOMY[parsed.category] || [];
    if (!validSubs.some(s => s.toLowerCase() === parsed.subcategory?.toLowerCase())) {
      // Use first subcategory as fallback
      parsed.subcategory = validSubs[0] || parsed.subcategory;
    }

    return {
      category: parsed.category,
      subcategory: parsed.subcategory,
      summary: parsed.topic_summary || null,
    };

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Ollama timeout');
    }
    throw err;
  }
}

// =============================================================================
// PROCESS SINGLE BOOKMARK
// =============================================================================

async function processBookmark(bookmark) {
  let content = null;
  let result = null;
  let source = 'content';

  // Step 1: Try to scrape content with Firecrawl
  try {
    content = await scrapeWithFirecrawl(bookmark.link);

    // Add small delay to avoid rate limits
    await new Promise(r => setTimeout(r, CONFIG.FIRECRAWL_DELAY_MS));

  } catch (err) {
    stats.firecrawlErrors++;
    log('WARN', `Firecrawl failed for ${bookmark.domain}: ${err.message}`);
    source = 'title-only';
  }

  // Step 2: Categorize with Ollama
  try {
    result = await categorizeWithOllama(bookmark, content);
  } catch (err) {
    stats.ollamaErrors++;
    log('ERROR', `Ollama failed for ${bookmark.id}: ${err.message}`);
    return { success: false, error: err.message };
  }

  // Step 3: Save to Supabase
  try {
    const { error } = await supabase
      .from('bookmark_tags_v2')
      .upsert({
        bookmark_id: bookmark.id,
        topic: result.category,
        subtopic: result.subcategory,
      }, { onConflict: 'bookmark_id' });

    if (error) {
      throw error;
    }

    return { success: true, result, source };

  } catch (err) {
    log('ERROR', `Supabase save failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// =============================================================================
// BATCH PROCESSOR
// =============================================================================

async function processBatch(bookmarks) {
  const results = [];

  // Process with limited concurrency
  const chunks = [];
  for (let i = 0; i < bookmarks.length; i += CONFIG.CONCURRENCY) {
    chunks.push(bookmarks.slice(i, i + CONFIG.CONCURRENCY));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (bookmark) => {
        const result = await processBookmark(bookmark);
        stats.processed++;

        if (result.success) {
          stats.success++;
          log('OK', `${bookmark.domain} -> ${result.result.category} > ${result.result.subcategory} [${result.source}]`);
        } else {
          stats.failed++;
        }

        return result;
      })
    );

    results.push(...chunkResults);
  }

  return results;
}

// =============================================================================
// MAIN RUNNER
// =============================================================================

async function getTaggedIds() {
  // Get all bookmark IDs that already have tags
  const taggedIds = new Set();
  let offset = 0;
  const limit = 10000;

  while (true) {
    const { data, error } = await supabase
      .from('bookmark_tags_v2')
      .select('bookmark_id')
      .range(offset, offset + limit - 1);

    if (error) {
      log('ERROR', `Failed to fetch tagged IDs: ${error.message}`);
      break;
    }

    if (!data || data.length === 0) break;

    data.forEach(row => taggedIds.add(row.bookmark_id));
    offset += limit;

    if (data.length < limit) break;
  }

  return taggedIds;
}

async function getAllBookmarks() {
  const bookmarks = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('id, link, title, domain')
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      log('ERROR', `Failed to fetch bookmarks: ${error.message}`);
      break;
    }

    if (!data || data.length === 0) break;

    bookmarks.push(...data);
    offset += limit;
    log('INFO', `Fetched ${bookmarks.length} bookmarks...`);

    if (data.length < limit) break;
  }

  return bookmarks;
}

async function showStatus() {
  const { count: totalBookmarks } = await supabase
    .from('bookmarks')
    .select('*', { count: 'exact', head: true });

  const { count: taggedCount } = await supabase
    .from('bookmark_tags_v2')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== CURIUS TAGGER STATUS ===');
  console.log(`Total bookmarks: ${totalBookmarks}`);
  console.log(`Tagged: ${taggedCount}`);
  console.log(`Remaining: ${totalBookmarks - taggedCount}`);
  console.log(`Progress: ${((taggedCount / totalBookmarks) * 100).toFixed(1)}%`);
  console.log('============================\n');
}

async function main() {
  // Handle CLI args
  if (process.argv.includes('--status')) {
    await showStatus();
    process.exit(0);
  }

  if (process.argv.includes('--reset')) {
    console.log('Resetting all tags...');
    const { error } = await supabase.from('bookmark_tags_v2').delete().neq('bookmark_id', 0);
    if (error) {
      console.error('Reset failed:', error.message);
    } else {
      console.log('All tags deleted.');
    }
    process.exit(0);
  }

  console.log('\n==============================================');
  console.log('   CURIUS FULL TAGGER - Starting');
  console.log('==============================================\n');

  console.log('Configuration:');
  console.log(`  Model: ${CONFIG.OLLAMA_MODEL}`);
  console.log(`  Concurrency: ${CONFIG.CONCURRENCY}`);
  console.log(`  Firecrawl delay: ${CONFIG.FIRECRAWL_DELAY_MS}ms`);
  console.log('');

  // Step 1: Get already tagged IDs
  log('INFO', 'Fetching already-tagged bookmark IDs...');
  const taggedIds = await getTaggedIds();
  log('INFO', `Found ${taggedIds.size} already tagged`);

  // Step 2: Get all bookmarks
  log('INFO', 'Fetching all bookmarks...');
  const allBookmarks = await getAllBookmarks();
  log('INFO', `Found ${allBookmarks.length} total bookmarks`);

  // Step 3: Filter to untagged only
  const untagged = allBookmarks.filter(b => !taggedIds.has(b.id));
  stats.total = untagged.length;
  stats.skipped = taggedIds.size;

  log('INFO', `${untagged.length} bookmarks need tagging`);

  if (untagged.length === 0) {
    console.log('\nAll bookmarks are already tagged!');
    process.exit(0);
  }

  // Step 4: Process in batches
  const batches = [];
  for (let i = 0; i < untagged.length; i += CONFIG.BATCH_SIZE) {
    batches.push(untagged.slice(i, i + CONFIG.BATCH_SIZE));
  }

  log('INFO', `Processing ${batches.length} batches of ${CONFIG.BATCH_SIZE}...`);
  console.log('');

  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i]);

    // Log progress every 10 batches
    if ((i + 1) % 10 === 0) {
      logProgress();
    }
  }

  // Final summary
  console.log('\n==============================================');
  console.log('   COMPLETE');
  console.log('==============================================');
  logProgress();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nInterrupted. Progress is saved in Supabase.');
  logProgress();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('\n[FATAL]', err);
  logProgress();
});

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
