#!/usr/bin/env node
/**
 * Re-tag title-only bookmarks with content-based analysis
 */

require('dotenv').config({ path: '.env.local' });

process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTED]', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[REJECTION]', err.message || err);
});

const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

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

function formatTaxonomyForPrompt() {
  return Object.entries(TAXONOMY)
    .map(([main, subs]) => `${main}: ${subs.join(', ')}`)
    .join('\n');
}

const PROGRESS_FILE = path.join(__dirname, '../data/progress/retag-progress.json');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let progress = { processed: 0, successful: 0, failed: 0, lastId: 0 };

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`Resumed: ${progress.processed} done, last ID: ${progress.lastId}`);
    }
  } catch (e) {}
}

function saveProgress() {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function fetchContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, header, footer, aside, iframe, noscript').remove();
    let content = $('article').text() || $('main').text() || $('body').text();
    content = content.replace(/\s+/g, ' ').trim();
    return content.length > 100 ? content.substring(0, 2000) : null;
  } catch (e) { return null; }
}

async function categorize(bookmark, content) {
  const prompt = `You are a content categorizer. Classify this article into ONE category and ONE subcategory.

TAXONOMY:
${formatTaxonomyForPrompt()}

ARTICLE: ${bookmark.title || 'Untitled'}
CONTENT: ${content}

Return ONLY JSON: {"category": "Name", "subcategory": "Name", "confidence": "high/medium/low"}`;

  try {
    const res = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', max_tokens: 100, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!ALL_CATEGORIES.includes(parsed.category)) return null;
    return parsed;
  } catch (e) { return null; }
}

async function run() {
  loadProgress();
  console.log('Re-tagging title-only bookmarks with content...');
  
  while (true) {
    // Get batch of old tags (before Dec 29)
    const { data: tags } = await supabase
      .from('bookmark_tags_v2')
      .select('bookmark_id')
      .lt('created_at', '2025-12-29')
      .gt('bookmark_id', progress.lastId)
      .order('bookmark_id')
      .limit(10);
    
    if (!tags || tags.length === 0) {
      console.log('Done!');
      break;
    }
    
    for (const tag of tags) {
      const { data: bookmark } = await supabase
        .from('bookmarks')
        .select('id, link, title')
        .eq('id', tag.bookmark_id)
        .single();
      
      if (!bookmark) {
        progress.lastId = tag.bookmark_id;
        continue;
      }
      
      const content = await fetchContent(bookmark.link);
      if (!content) {
        progress.failed++;
        progress.lastId = tag.bookmark_id;
        progress.processed++;
        continue;
      }
      
      const result = await categorize(bookmark, content);
      if (result) {
        await supabase.from('bookmark_tags_v2').upsert({
          bookmark_id: bookmark.id,
          topic: result.category,
          subtopic: result.subcategory
        }, { onConflict: 'bookmark_id' });
        progress.successful++;
        const conf = result.confidence === 'high' ? '+' : result.confidence === 'medium' ? '~' : '?';
        console.log(`[${conf}] ${bookmark.id} ${result.category} > ${result.subcategory}`);
      } else {
        progress.failed++;
      }
      
      progress.lastId = tag.bookmark_id;
      progress.processed++;
      
      if (progress.processed % 10 === 0) {
        saveProgress();
        const pct = ((progress.processed / 149369) * 100).toFixed(1);
        console.log(`--- ${pct}% | ${progress.processed}/149369 | OK:${progress.successful} ERR:${progress.failed} ---`);
      }
    }
  }
  saveProgress();
}

if (process.argv.includes('--status')) {
  loadProgress();
  console.log(progress);
  process.exit(0);
}

run();
