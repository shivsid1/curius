// Curius API response types
export interface CuriusUser {
  uid: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profileUrl?: string;
  lastOnline?: string;
}

export interface CuriusLink {
  id: string;
  link: string;
  title?: string;
  domain?: string;
  createdDate: string;
  savedBy?: Array<{ username: string; firstName?: string; lastName?: string }>;
}

export interface CuriusLinksResponse {
  userSaved: CuriusLink[];
  hasMore?: boolean;
}

// Progress tracking types
export interface UserProgress {
  username: string;
  curiusUid: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  lastPage: number;
  totalBookmarks: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ScrapeProgress {
  startedAt: string;
  lastUpdatedAt: string;
  totalUsers: number;
  completedUsers: number;
  failedUsers: number;
  totalBookmarksScraped: number;
  totalRelationshipsCreated: number;
  discoveredUsers: string[];
  users: Record<string, UserProgress>;
}

// Database types
export interface DbUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  bookmark_count: number;
}

export interface DbBookmark {
  id: number;
  link: string;
  title?: string;
  domain?: string;
  saves_count: number;
}

export interface DbUserBookmark {
  user_id: number;
  bookmark_id: number;
  saved_at: string;
}
