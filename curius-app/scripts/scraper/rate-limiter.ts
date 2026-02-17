import { CONFIG } from './config';

export class RateLimiter {
  private lastRequestTime: number = 0;
  private minInterval: number;

  constructor(requestsPerSecond: number = CONFIG.REQUESTS_PER_SECOND) {
    this.minInterval = 1000 / requestsPerSecond;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const waitTime = Math.max(0, this.minInterval - elapsed);

    if (waitTime > 0) {
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = CONFIG.MAX_RETRIES,
    initialDelay = CONFIG.INITIAL_RETRY_DELAY_MS,
    backoffMultiplier = CONFIG.RETRY_BACKOFF_MULTIPLIER,
    onRetry,
  } = options;

  let lastError: Error = new Error('Unknown error');
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        // Check for rate limit response
        if (isRateLimitError(lastError)) {
          const retryAfter = extractRetryAfter(lastError);
          delay = retryAfter || delay * backoffMultiplier;
        }

        await sleep(delay);
        delay *= backoffMultiplier;
      }
    }
  }

  throw lastError;
}

function isRateLimitError(error: Error): boolean {
  return error.message.includes('429') || error.message.toLowerCase().includes('rate limit');
}

function extractRetryAfter(error: Error): number | null {
  const match = error.message.match(/retry.?after[:\s]+(\d+)/i);
  return match ? parseInt(match[1], 10) * 1000 : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { sleep };
