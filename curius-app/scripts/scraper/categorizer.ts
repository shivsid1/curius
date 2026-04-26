import { formatTaxonomyForPrompt, getAllCategories } from './taxonomy';
import { Logger } from './logger';
import { RateLimiter, withRetry } from './rate-limiter';

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

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '';
    if (!this.apiKey) {
      Logger.warn('OPENAI_API_KEY not set - categorization disabled');
    }
    this.rateLimiter = new RateLimiter(1); // 1 req/sec for OpenAI
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
        withRetry(async () => {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.2,
              max_tokens: 1000,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`OpenAI API error: ${res.status} - ${body}`);
          }

          return res.json();
        })
      );

      const content = response.choices?.[0]?.message?.content || '';
      const parsed = this.parseResponse(content, links);

      for (const [id, result] of parsed) {
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

Return ONLY valid JSON array with this exact format:
[
  {"id": 123, "category": "Technology", "subcategory": "AI & Machine Learning"},
  {"id": 456, "category": "Business", "subcategory": "Startups & Founders"}
]

RULES:
- Choose the SINGLE BEST matching category and subcategory
- Use EXACT category/subcategory names from the taxonomy
- If unsure, pick the closest match - never leave blank
- Return valid JSON only, no other text`;
  }

  private parseResponse(content: string, links: LinkToClassify[]): Map<number, CategoryResult> {
    const results = new Map<number, CategoryResult>();
    const validCategories = getAllCategories();

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        Logger.warn('No JSON array found in response');
        return results;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      for (const item of parsed) {
        if (!item.id || !item.category || !item.subcategory) continue;

        if (!validCategories.includes(item.category)) {
          Logger.warn(`Invalid category: ${item.category}`);
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
