/**
 * Domain classification rules for smart fetching
 * Based on analysis of 5,211 failed bookmarks
 */

// Domains that need Puppeteer (JS-rendered)
const PUPPETEER_REQUIRED = new Set([
  // Social media
  'x.com',
  'twitter.com',
  'www.instagram.com',
  'instagram.com',
  'www.facebook.com',
  'facebook.com',
  'www.linkedin.com',
  'linkedin.com',
  'www.tiktok.com',
  'tiktok.com',

  // Apps/SPAs
  'chatgpt.com',
  'chat.openai.com',
  'docs.google.com',
  'drive.google.com',
  'sheets.google.com',
  'notion.so',
  'www.notion.so',
  'airtable.com',
  'figma.com',
  'www.figma.com',
  'miro.com',
  'canva.com',

  // Job sites (heavy JS)
  'jobs.lever.co',
  'boards.greenhouse.io',
  'jobs.ashbyhq.com',
  'www.linkedin.com',
  'angel.co',
  'wellfound.com',
  'dayforcehcm.com',
  'workday.com',
  'myworkdayjobs.com',

  // Vercel-protected (JS challenge)
  'www.alignmentforum.org',
  'alignmentforum.org',
  'lesswrong.com',
  'www.lesswrong.com',

  // E-commerce SPAs
  'shopee.vn',
  'shopee.com',
  'lazada.com',
  'aliexpress.com',
  'www.aliexpress.us',
]);

// Domains to skip entirely (unfetchable)
const SKIP_DOMAINS = new Set([
  // Archive sites (aggressive rate limiting)
  'archive.is',
  'archive.ph',
  'archive.md',
  'archive.today',
  'web.archive.org', // Often slow/broken

  // Paywalled news
  'www.nytimes.com',
  'nytimes.com',
  'www.wsj.com',
  'wsj.com',
  'www.ft.com',
  'ft.com',
  'www.economist.com',
  'economist.com',
  'www.bloomberg.com',
  'bloomberg.com',
  'www.washingtonpost.com',
  'washingtonpost.com',
  'www.theatlantic.com',
  'theatlantic.com',
  'www.newyorker.com',
  'newyorker.com',

  // Medium (soft paywall, often blocks)
  'medium.com',
  'towardsdatascience.com',
  'levelup.gitconnected.com',
  'betterprogramming.pub',

  // Piracy/blocked domains
  'z-lib.io',
  'z-lib.org',
  'libgen.is',
  'libgen.rs',
  'sci-hub.se',

  // Self-referential
  'curius.app',

  // Paywalled research
  'www.proquest.com',
  'proquest.com',
  'jstor.org',
  'www.jstor.org',

  // Google properties (need auth)
  'www.google.com',
  'google.com',
  'mail.google.com',
  'calendar.google.com',
]);

// Domains that are PDFs (need special handling)
const PDF_DOMAINS = new Set([
  'arxiv.org',
  'www.arxiv.org',
  'papers.ssrn.com',
  'openreview.net',
]);

// Check if URL needs Puppeteer
function needsPuppeteer(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return PUPPETEER_REQUIRED.has(domain) ||
           PUPPETEER_REQUIRED.has('www.' + domain) ||
           PUPPETEER_REQUIRED.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Check if URL should be skipped
function shouldSkip(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return SKIP_DOMAINS.has(domain) ||
           SKIP_DOMAINS.has('www.' + domain) ||
           SKIP_DOMAINS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Check if URL is a PDF
function isPDF(url) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return url.toLowerCase().endsWith('.pdf') ||
           PDF_DOMAINS.has(domain) ||
           PDF_DOMAINS.has('www.' + domain);
  } catch {
    return false;
  }
}

// Classify a URL
function classifyURL(url) {
  if (shouldSkip(url)) return 'skip';
  if (needsPuppeteer(url)) return 'puppeteer';
  if (isPDF(url)) return 'pdf';
  return 'fetch';
}

module.exports = {
  PUPPETEER_REQUIRED,
  SKIP_DOMAINS,
  PDF_DOMAINS,
  needsPuppeteer,
  shouldSkip,
  isPDF,
  classifyURL,
};
