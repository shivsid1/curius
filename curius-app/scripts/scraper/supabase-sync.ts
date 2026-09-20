import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from './config';
import { Logger } from './logger';
import type { CuriusLink } from './types';

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

export class SupabaseSync {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
    }

    this.client = createClient(url, key);
  }

  async getAllUsernames(): Promise<string[]> {
    const usernames: string[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await this.client
        .from('users')
        .select('username')
        .order('id')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        Logger.error('Failed to fetch usernames', error as Error);
        break;
      }

      if (!data || data.length === 0) break;

      usernames.push(...data.map((u) => u.username));
      page++;

      if (data.length < pageSize) break;
    }

    return usernames;
  }

  async getUsersByActivity(): Promise<Array<{ username: string; lastOnline: string | null }>> {
    const users: Array<{ username: string; lastOnline: string | null }> = [];
    let page = 0;
    const pageSize = 1000;

    // Try last_online first, fall back to bookmark_count if column doesn't exist
    const hasLastOnline = await this.hasColumn('users', 'last_online');
    const sortColumn = hasLastOnline ? 'last_online' : 'bookmark_count';
    const selectColumns = hasLastOnline ? 'username, last_online' : 'username';
    Logger.info(`Sorting users by: ${sortColumn}`);

    while (true) {
      const { data, error } = await this.client
        .from('users')
        .select(selectColumns)
        .order(sortColumn, { ascending: false, nullsFirst: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        Logger.error('Failed to fetch users by activity', error as Error);
        break;
      }

      if (!data || data.length === 0) break;

      for (const row of data as unknown as Array<{ username: string; last_online?: string | null }>) {
        users.push({ username: row.username, lastOnline: row.last_online ?? null });
      }
      page++;

      if (data.length < pageSize) break;
    }

    return users;
  }

  private async hasColumn(table: string, column: string): Promise<boolean> {
    const { error } = await this.client
      .from(table)
      .select(column)
      .limit(1);
    return !error;
  }

  async bulkUpdateLastOnline(updates: Array<{ username: string; lastOnline: string }>): Promise<void> {
    // Check if column exists first
    if (!(await this.hasColumn('users', 'last_online'))) {
      Logger.warn('last_online column does not exist, skipping updates');
      return;
    }
    // Update in batches of 50
    for (let i = 0; i < updates.length; i += 50) {
      const batch = updates.slice(i, i + 50);
      await Promise.all(
        batch.map((u) =>
          this.client
            .from('users')
            .update({ last_online: u.lastOnline })
            .eq('username', u.username)
        )
      );
    }
  }

  async getUserId(username: string): Promise<number | null> {
    const { data, error } = await this.client
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (error || !data) return null;
    return data.id;
  }

  async createUser(username: string, firstName?: string, lastName?: string, curiusId?: number): Promise<number | null> {
    const record: Record<string, unknown> = {
      username,
      first_name: firstName || null,
      last_name: lastName || null,
      bookmark_count: 0,
    };
    if (curiusId) record.id = curiusId;

    const { data, error } = await this.client
      .from('users')
      .upsert(record, { onConflict: 'username' })
      .select('id')
      .single();

    if (error) {
      Logger.error(`Failed to create user ${username}`, error as Error);
      return null;
    }

    return data?.id || null;
  }

  async getOrCreateBookmark(link: CuriusLink): Promise<number | null> {
    const domain = extractDomain(link.link);

    // Try to find existing bookmark
    const { data: existing } = await this.client
      .from('bookmarks')
      .select('id')
      .eq('link', link.link)
      .single();

    if (existing) {
      return existing.id;
    }

    // Create new bookmark
    const { data, error } = await this.client
      .from('bookmarks')
      .insert({
        link: link.link,
        title: link.title || null,
        domain: domain,
        saves_count: 1,
      })
      .select('id')
      .single();

    if (error) {
      // Handle unique constraint violation (race condition)
      if (error.code === '23505') {
        const { data: retry } = await this.client
          .from('bookmarks')
          .select('id')
          .eq('link', link.link)
          .single();
        return retry?.id || null;
      }
      Logger.error(`Failed to create bookmark: ${link.link}`, error as Error);
      return null;
    }

    return data?.id || null;
  }

  /**
   * Resolve existing bookmark ids for a set of links.
   * One query per chunk instead of one per link.
   */
  async batchGetBookmarkIds(links: string[]): Promise<Map<string, number>> {
    const found = new Map<string, number>();
    if (links.length === 0) return found;

    const chunkSize = 200;
    for (let i = 0; i < links.length; i += chunkSize) {
      const chunk = links.slice(i, i + chunkSize);
      const { data, error } = await this.client
        .from('bookmarks')
        .select('id, link')
        .in('link', chunk);

      if (error) {
        Logger.error('Batch bookmark lookup failed', error as Error);
        continue;
      }

      for (const row of data ?? []) {
        found.set(row.link, row.id);
      }
    }

    return found;
  }

  /**
   * Insert bookmarks that do not exist yet. Relies on the unique index on
   * bookmarks.link.
   *
   * ignoreDuplicates is deliberate: an upsert that updates on conflict would
   * reset saves_count to 1 on every row we re-encounter. Rows that already
   * exist are skipped here and resolved by the caller's follow-up lookup.
   */
  async batchInsertBookmarks(links: CuriusLink[]): Promise<Map<string, number>> {
    const inserted = new Map<string, number>();
    if (links.length === 0) return inserted;

    const rows = links.map((link) => ({
      link: link.link,
      title: link.title || null,
      domain: extractDomain(link.link),
      saves_count: 1,
    }));

    for (let i = 0; i < rows.length; i += CONFIG.SUPABASE_BATCH_SIZE) {
      const chunk = rows.slice(i, i + CONFIG.SUPABASE_BATCH_SIZE);
      const { data, error } = await this.client
        .from('bookmarks')
        .upsert(chunk, { onConflict: 'link', ignoreDuplicates: true })
        .select('id, link');

      if (error) {
        Logger.error('Batch bookmark insert failed', error as Error);
        continue;
      }

      for (const row of data ?? []) {
        inserted.set(row.link, row.id);
      }
    }

    return inserted;
  }

  async createUserBookmark(
    userId: number,
    bookmarkId: number,
    savedAt: string
  ): Promise<boolean> {
    const { error } = await this.client
      .from('user_bookmarks')
      .upsert(
        {
          user_id: userId,
          bookmark_id: bookmarkId,
          saved_at: savedAt,
        },
        { onConflict: 'user_id,bookmark_id', ignoreDuplicates: true }
      );

    if (error && error.code !== '23505') {
      Logger.error(`Failed to create user_bookmark`, error as Error);
      return false;
    }

    return true;
  }

  async batchUpsertUserBookmarks(
    records: Array<{ userId: number; bookmarkId: number; savedAt: string }>
  ): Promise<{ created: number; skipped: number }> {
    if (records.length === 0) return { created: 0, skipped: 0 };

    const data = records.map((r) => ({
      user_id: r.userId,
      bookmark_id: r.bookmarkId,
      saved_at: r.savedAt,
    }));

    const { error, count } = await this.client
      .from('user_bookmarks')
      .upsert(data, { onConflict: 'user_id,bookmark_id', ignoreDuplicates: true, count: 'exact' });

    if (error) {
      Logger.error('Batch upsert failed', error as Error);
      return { created: 0, skipped: records.length };
    }

    return { created: count || records.length, skipped: 0 };
  }

  async updateUserBookmarkCount(userId: number, count: number): Promise<void> {
    await this.client
      .from('users')
      .update({ bookmark_count: count })
      .eq('id', userId);
  }

  async getStats(): Promise<{
    users: number;
    bookmarks: number;
    userBookmarks: number;
    tags: number;
  }> {
    const [users, bookmarks, userBookmarks, tags] = await Promise.all([
      this.client.from('users').select('*', { count: 'exact', head: true }),
      this.client.from('bookmarks').select('*', { count: 'exact', head: true }),
      this.client.from('user_bookmarks').select('*', { count: 'exact', head: true }),
      this.client.from('bookmark_tags_v2').select('*', { count: 'exact', head: true }),
    ]);

    return {
      users: users.count || 0,
      bookmarks: bookmarks.count || 0,
      userBookmarks: userBookmarks.count || 0,
      tags: tags.count || 0,
    };
  }

  async saveBookmarkCategory(
    bookmarkId: number,
    category: string,
    subcategory: string
  ): Promise<boolean> {
    const { error } = await this.client
      .from('bookmark_tags_v2')
      .upsert(
        {
          bookmark_id: bookmarkId,
          topic: category,
          subtopic: subcategory,
        },
        { onConflict: 'bookmark_id' }
      );

    if (error) {
      Logger.error(`Failed to save category for bookmark ${bookmarkId}`, error as Error);
      return false;
    }
    return true;
  }

  async batchSaveCategories(
    records: Array<{ bookmarkId: number; category: string; subcategory: string }>
  ): Promise<number> {
    if (records.length === 0) return 0;

    const data = records.map((r) => ({
      bookmark_id: r.bookmarkId,
      topic: r.category,
      subtopic: r.subcategory,
    }));

    const { error, count } = await this.client
      .from('bookmark_tags_v2')
      .upsert(data, { onConflict: 'bookmark_id', count: 'exact' });

    if (error) {
      Logger.error('Batch category save failed', error as Error);
      return 0;
    }

    return count || records.length;
  }

  async getUntaggedBookmarks(limit: number = 100): Promise<Array<{
    id: number;
    link: string;
    title: string | null;
    domain: string;
  }>> {
    // Use a left join approach: fetch recent bookmarks, then check which lack tags
    // Get a batch of bookmark IDs that might be untagged (most recent first)
    const batchSize = limit * 5; // Fetch more than needed since some will be tagged
    const { data: candidates, error: candError } = await this.client
      .from('bookmarks')
      .select('id, link, title, domain')
      .order('id', { ascending: false })
      .limit(batchSize);

    if (candError || !candidates || candidates.length === 0) {
      if (candError) Logger.error('Failed to get bookmark candidates', candError as Error);
      return [];
    }

    // Check which of these have tags
    const ids = candidates.map((b) => b.id);
    const { data: tagged } = await this.client
      .from('bookmark_tags_v2')
      .select('bookmark_id')
      .in('bookmark_id', ids);

    const taggedIds = new Set((tagged || []).map((t) => t.bookmark_id));

    // Return those without tags
    const untagged = candidates.filter((b) => !taggedIds.has(b.id));
    return untagged.slice(0, limit);
  }

  async getRecentBookmarks(since: string, limit: number = 1000): Promise<Array<{
    id: number;
    link: string;
    title: string | null;
    domain: string;
    created_at: string;
  }>> {
    const { data, error } = await this.client
      .from('bookmarks')
      .select('id, link, title, domain, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      Logger.error('Failed to get recent bookmarks', error as Error);
      return [];
    }

    return data || [];
  }
}
