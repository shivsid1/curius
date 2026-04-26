import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Database types
export interface User {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  profile_url: string | null;
  last_online: string | null;
  bookmark_count: number;
  created_at: string;
}

export interface Bookmark {
  id: number;
  link: string;
  url?: string; // alias for link
  title: string | null;
  title_en?: string | null;
  domain: string;
  saves_count: number;
  created_at: string;
}

export interface UserBookmark {
  user_id: number;
  bookmark_id: number;
  saved_at: string;
  page_number: number | null;
  discovered_from: string | null;
}

export interface BookmarkConvergence {
  id: number;
  link: string;
  url?: string;
  title: string | null;
  domain: string;
  saves_count: number;
  convergence_score: number;
  saved_by_users: string[];
  created_at?: string;
}

export interface BookmarkWithUsers extends Bookmark {
  saved_by_users?: string[];
  users?: User[];
}

export interface UserWithBookmarks extends User {
  bookmarks?: BookmarkWithUsers[];
}

export interface BookmarkTag {
  id?: number;
  bookmark_id: number;
  topic: string;
  subtopic: string | null;
  sub_subtopic?: string | null;
  confidence?: number;
  method?: string;
  created_at?: string;
}

export interface BookmarkWithTags extends Bookmark {
  bookmark_tags_v2?: BookmarkTag[];
  saved_by_users?: string[];
}

export interface TopicStats {
  topic: string;
  description?: string;
  color?: string;
  count: number;
  subtopics: Array<{
    subtopic: string;
    count: number;
  }>;
}

export interface SourceStats {
  domain: string;
  bookmark_count: number;
  total_saves: number;
  top_topics: Array<{ topic: string; count: number }>;
}

export interface CuratorProfile extends User {
  top_topics: Array<{ topic: string; count: number }>;
}
