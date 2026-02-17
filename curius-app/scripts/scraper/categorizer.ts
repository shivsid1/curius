import { formatTaxonomyForPrompt, getAllCategories } from './taxonomy';
import { Logger } from './logger';
import { CONFIG } from './config';
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
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      Logger.warn('OPENAI_API_KEY not set - categorization disabled');
    }
    // Slower rate limit for OpenAI
    this.rateLimiter = new RateLimiter(1); // 1 req/sec
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  async classifyBatch(links: LinkToClassify[]): Promise<Map<number, CategoryResult>> {
    if (!this.isEnabled()) {
      return new Map();
    }

    const results = new Map<number, CategoryResult>();

    const prompt = this.buildBatchPrompt(links);

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
            throw new Error(`OpenAI API error: ${res.status}`);
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

  private buildBatchPrompt(links: LinkToClassify[]): string {
    const taxonomy = formatTaxonomyForPrompt();

    const linksText = links
      .map((l, i) => `${i + 1}. [ID:${l.id}] "${l.title || 'No title'}" (${l.domain})`)
      .join('\n');

    return `Classify each link into ONE category and ONE subcategory from the taxonomy below.

TAXONOMY:
${taxonomy}

LINKS:
${linksText}

Return ONLY valid JSON array with this exact format:
[
  {"id": 123, "category": "AI/ML", "subcategory": "LLMs & Language Models"},
  {"id": 456, "category": "Tech", "subcategory": "Web Development"}
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
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        Logger.warn('No JSON array found in response');
        return results;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      for (const item of parsed) {
        if (!item.id || !item.category || !item.subcategory) continue;

        // Validate category exists
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
