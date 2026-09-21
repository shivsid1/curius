import Anthropic from '@anthropic-ai/sdk';
import { formatTaxonomyForPrompt, getAllCategories, getAllSubcategories, isValidPair } from './taxonomy';
import { Logger } from './logger';
import { RateLimiter } from './rate-limiter';

// Overridable so the model can be changed without a deploy.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

// The taxonomy is enforced by the response schema rather than by prompt text,
// so the model cannot return a category that doesn't exist.
const CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    classifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          category: { type: 'string', enum: getAllCategories() },
          subcategory: { type: 'string', enum: getAllSubcategories() },
        },
        required: ['id', 'category', 'subcategory'],
        additionalProperties: false,
      },
    },
  },
  required: ['classifications'],
  additionalProperties: false,
} as const;

interface CategoryResult {
  category: string;
  subcategory: string;
  confidence: number;
}

interface LinkToClassify {
  id: number;
  url: string;
  title: string | null;
  domain: string;
}

export class Categorizer {
  private rateLimiter: RateLimiter;
  private apiKey: string;
  private client: Anthropic | null = null;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      Logger.warn('ANTHROPIC_API_KEY not set - categorization disabled');
    } else {
      // The SDK reads ANTHROPIC_API_KEY itself and retries 429/5xx twice.
      this.client = new Anthropic();
      Logger.info(`Categorizer using ${MODEL}`);
    }
    this.rateLimiter = new RateLimiter(2);
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Fetch article content from a URL. Returns first ~2000 chars of text.
   * Falls back gracefully if the page can't be fetched.
   */
  private async fetchContent(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });

      if (!res.ok) return null;

      const html = await res.text();

      // Strip HTML tags, scripts, styles to get plain text
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Return first 2000 chars -- enough for classification, keeps token usage low
      return text.substring(0, 2000) || null;
    } catch {
      return null;
    }
  }

  /**
   * Classify a batch of links by fetching their content and using GPT-4o-mini.
   * Fetches content in parallel, then sends one classification request.
   */
  async classifyBatch(links: LinkToClassify[]): Promise<Map<number, CategoryResult>> {
    if (!this.isEnabled()) {
      return new Map();
    }

    const results = new Map<number, CategoryResult>();

    // Fetch content for all links in parallel (with concurrency limit)
    const linksWithContent = await Promise.all(
      links.map(async (link) => {
        const content = await this.fetchContent(link.url);
        return { ...link, content };
      })
    );

    const prompt = this.buildBatchPrompt(linksWithContent);

    try {
      const response = await this.rateLimiter.execute(() =>
        this.client!.messages.create({
          model: MODEL,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
          output_config: {
            // Classification is mechanical; low effort keeps token spend down.
            effort: 'low',
            format: { type: 'json_schema', schema: CLASSIFICATION_SCHEMA },
          },
        })
      );

      if (response.stop_reason === 'refusal') {
        Logger.warn('Classification refused by safety classifier - skipping batch');
        return results;
      }
      if (response.stop_reason === 'max_tokens') {
        Logger.warn('Classification hit max_tokens - batch may be truncated');
      }

      const u = response.usage;
      Logger.info(`Classified ${links.length} links | ${u.input_tokens} in / ${u.output_tokens} out tokens`);

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      for (const [id, result] of this.parseResponse(text)) {
        results.set(id, result);
      }
    } catch (error) {
      Logger.error('Batch classification failed', error as Error);
    }

    return results;
  }

  async classifySingle(link: LinkToClassify): Promise<CategoryResult | null> {
    const results = await this.classifyBatch([link]);
    return results.get(link.id) || null;
  }

  private buildBatchPrompt(links: Array<LinkToClassify & { content: string | null }>): string {
    const taxonomy = formatTaxonomyForPrompt();

    const linksText = links
      .map((l, i) => {
        const contentSnippet = l.content
          ? `\n   Content: ${l.content.substring(0, 500)}`
          : '';
        return `${i + 1}. [ID:${l.id}] "${l.title || 'No title'}" (${l.domain})${contentSnippet}`;
      })
      .join('\n\n');

    return `Classify each link into ONE category and ONE subcategory from the taxonomy below.
Use the article content (when provided) to make a more accurate classification.

TAXONOMY:
${taxonomy}

LINKS:
${linksText}

RULES:
- Choose the SINGLE BEST matching category and subcategory for each link
- The subcategory must belong to the category you pick
- Return one entry per link, echoing its ID
- If unsure, pick the closest match - never leave blank`;
  }

  /**
   * The response schema already guarantees valid JSON and that both category
   * and subcategory come from the taxonomy. What it can't express is that a
   * subcategory must belong to its category, so that pairing is checked here.
   */
  private parseResponse(content: string): Map<number, CategoryResult> {
    const results = new Map<number, CategoryResult>();
    if (!content.trim()) return results;

    try {
      const parsed = JSON.parse(content) as {
        classifications?: Array<{ id: number; category: string; subcategory: string }>;
      };

      for (const item of parsed.classifications ?? []) {
        if (!isValidPair(item.category, item.subcategory)) {
          Logger.warn(`Mismatched pair: ${item.category} / ${item.subcategory} (id ${item.id})`);
          continue;
        }

        results.set(item.id, {
          category: item.category,
          subcategory: item.subcategory,
          confidence: 1.0,
        });
      }
    } catch (error) {
      Logger.error('Failed to parse classification response', error as Error);
    }

    return results;
  }
}
