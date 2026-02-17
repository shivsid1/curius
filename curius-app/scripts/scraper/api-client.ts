import { CONFIG } from './config';
import { RateLimiter, withRetry, sleep } from './rate-limiter';
import { Logger } from './logger';
import type { CuriusUser, CuriusLink, CuriusLinksResponse } from './types';

export class CuriusApiClient {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  async getUserByUsername(username: string): Promise<CuriusUser | null> {
    const url = `${CONFIG.CURIUS_BASE_URL}/users/${username}`;

    try {
      const response = await this.rateLimiter.execute(() =>
        withRetry(
          async () => {
            const res = await fetch(url, {
              headers: this.getHeaders(username),
              signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
            });

            if (res.status === 404) {
              return null;
            }

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            return res.json();
          },
          {
            onRetry: (attempt, error) => {
              Logger.warn(`Retry ${attempt} for user ${username}: ${error.message}`);
            },
          }
        )
      );

      if (!response) return null;

      // API returns user data nested in 'user' object
      const user = response.user || response;
      return {
        uid: String(user.id),
        username: user.userLink || username,
        firstName: user.firstName,
        lastName: user.lastName,
        profileUrl: user.website,
        lastOnline: user.lastOnline,
      };
    } catch (error) {
      Logger.error(`Failed to fetch user ${username}`, error as Error);
      return null;
    }
  }

  async getUserLinks(
    uid: string,
    username: string,
    page: number = 0
  ): Promise<{ links: CuriusLink[]; hasMore: boolean }> {
    const url = `${CONFIG.CURIUS_BASE_URL}/users/${uid}/links?page=${page}`;

    try {
      const response = await this.rateLimiter.execute(() =>
        withRetry(
          async () => {
            const res = await fetch(url, {
              headers: this.getHeaders(username),
              signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
            });

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            return res.json() as Promise<CuriusLinksResponse>;
          },
          {
            onRetry: (attempt, error) => {
              Logger.warn(`Retry ${attempt} for links page ${page}: ${error.message}`);
            },
          }
        )
      );

      const links = response.userSaved || [];
      // Curius returns 30 links per page
      const hasMore = links.length >= 30;

      return { links, hasMore };
    } catch (error) {
      Logger.error(`Failed to fetch links for ${username} page ${page}`, error as Error);
      return { links: [], hasMore: false };
    }
  }

  async *getAllUserLinks(
    uid: string,
    username: string,
    startPage: number = 0
  ): AsyncGenerator<CuriusLink[]> {
    let page = startPage;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getUserLinks(uid, username, page);

      if (result.links.length > 0) {
        yield result.links;
      }

      hasMore = result.hasMore && result.links.length > 0;
      page++;

      if (hasMore) {
        await sleep(CONFIG.DELAY_BETWEEN_PAGES_MS);
      }
    }
  }

  private getHeaders(username: string): Record<string, string> {
    return {
      'Accept': 'application/json',
      'Referer': `https://curius.app/${username}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
  }
}
