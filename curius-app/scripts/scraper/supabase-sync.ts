import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from './config';
import { Logger } from './logger';
import type { CuriusLink, DbUser, DbBookmark } from './types';

export class SupabaseSync {
  private client: SupabaseClient;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

  async getUserId(username: string): Promise<number | null> {
    const { data, error } = await this.client
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (error || !data) return null;
    return data.id;
  }

  async createUser(username: string, firstName?: string, lastName?: string): Promise<number | null> {
    const { data, error } = await this.client
      .from('users')
      .upsert(
        {
          username,
          first_name: firstName || null,
          last_name: lastName || null,
          bookmark_count: 0,
        },
        { onConflict: 'username' }
      )
      .select('id')
      .single();

    if (error) {
      Logger.error(`Failed to create user ${username}`, error as Error);
      return null;
    }

    return data?.id || null;
  }

  async getOrCreateBookmark(link: CuriusLink): Promise<number | null> {
    // Extract domain from URL
    let domain = '';
    try {
      domain = new URL(link.link).hostname.replace('www.', '');
    } catch {
      domain = '';
    }

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
    // Get bookmarks that don't have tags yet
    const { data, error } = await this.client
      .from('bookmarks')
      .select('id, link, title, domain')
      .not('id', 'in',
        this.client.from('bookmark_tags_v2').select('bookmark_id')
      )
      .limit(limit);

    if (error) {
      Logger.error('Failed to get untagged bookmarks', error as Error);
      return [];
    }

    return data || [];
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
