import fs from 'fs';
import path from 'path';
import { CONFIG } from './config';
import { Logger } from './logger';
import type { ScrapeProgress, UserProgress } from './types';

export class ProgressTracker {
  private progress: ScrapeProgress;
  private saveCounter: number = 0;

  constructor() {
    this.progress = this.createEmptyProgress();
  }

  private createEmptyProgress(): ScrapeProgress {
    return {
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      totalUsers: 0,
      completedUsers: 0,
      failedUsers: 0,
      totalBookmarksScraped: 0,
      totalRelationshipsCreated: 0,
      discoveredUsers: [],
      users: {},
    };
  }

  async load(): Promise<boolean> {
    try {
      // Ensure directory exists
      fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });

      if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
        const data = fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf-8');
        this.progress = JSON.parse(data);
        Logger.info(`Loaded progress: ${this.progress.completedUsers}/${this.progress.totalUsers} users completed`);
        return true;
      }
    } catch (error) {
      Logger.error('Failed to load progress file', error as Error);
    }
    return false;
  }

  async save(): Promise<void> {
    try {
      this.progress.lastUpdatedAt = new Date().toISOString();
      fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
      fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(this.progress, null, 2));
    } catch (error) {
      Logger.error('Failed to save progress', error as Error);
    }
  }

  hasProgress(): boolean {
    return Object.keys(this.progress.users).length > 0;
  }

  initializeUsers(usernames: string[]): void {
    this.progress.totalUsers = usernames.length;
    for (const username of usernames) {
      if (!this.progress.users[username]) {
        this.progress.users[username] = {
          username,
          curiusUid: null,
          status: 'pending',
          lastPage: 0,
          totalBookmarks: 0,
        };
      }
    }
  }

  addDiscoveredUser(username: string): boolean {
    if (this.progress.users[username]) {
      return false; // Already known
    }

    this.progress.discoveredUsers.push(username);
    this.progress.users[username] = {
      username,
      curiusUid: null,
      status: 'pending',
      lastPage: 0,
      totalBookmarks: 0,
    };
    this.progress.totalUsers++;
    return true;
  }

  getNextPendingUser(): string | null {
    for (const [username, userProgress] of Object.entries(this.progress.users)) {
      if (userProgress.status === 'pending' || userProgress.status === 'in_progress') {
        return username;
      }
    }
    return null;
  }

  getUserProgress(username: string): UserProgress | null {
    return this.progress.users[username] || null;
  }

  updateUserStatus(username: string, updates: Partial<UserProgress>): void {
    if (!this.progress.users[username]) {
      this.progress.users[username] = {
        username,
        curiusUid: null,
        status: 'pending',
        lastPage: 0,
        totalBookmarks: 0,
      };
    }
    Object.assign(this.progress.users[username], updates);
  }

  markUserInProgress(username: string, curiusUid: string): void {
    this.updateUserStatus(username, {
      status: 'in_progress',
      curiusUid,
      startedAt: new Date().toISOString(),
    });
  }

  markUserCompleted(username: string, bookmarkCount: number, relationshipsCreated: number): void {
    this.updateUserStatus(username, {
      status: 'completed',
      totalBookmarks: bookmarkCount,
      completedAt: new Date().toISOString(),
    });
    this.progress.completedUsers++;
    this.progress.totalBookmarksScraped += bookmarkCount;
    this.progress.totalRelationshipsCreated += relationshipsCreated;

    this.saveCounter++;
    if (this.saveCounter >= CONFIG.PROGRESS_SAVE_INTERVAL) {
      this.save();
      this.saveCounter = 0;
    }
  }

  markUserFailed(username: string, error: string): void {
    this.updateUserStatus(username, {
      status: 'failed',
      error,
    });
    this.progress.failedUsers++;
  }

  getSummary(): {
    completed: number;
    failed: number;
    pending: number;
    total: number;
    bookmarks: number;
    relationships: number;
    discovered: number;
  } {
    const pending = Object.values(this.progress.users).filter(
      (u) => u.status === 'pending' || u.status === 'in_progress'
    ).length;

    return {
      completed: this.progress.completedUsers,
      failed: this.progress.failedUsers,
      pending,
      total: this.progress.totalUsers,
      bookmarks: this.progress.totalBookmarksScraped,
      relationships: this.progress.totalRelationshipsCreated,
      discovered: this.progress.discoveredUsers.length,
    };
  }

  printStatus(): void {
    const summary = this.getSummary();
    console.log('\n=== Scrape Progress ===');
    console.log(`Started: ${this.progress.startedAt}`);
    console.log(`Last Update: ${this.progress.lastUpdatedAt}`);
    console.log(`Users: ${summary.completed}/${summary.total} completed, ${summary.failed} failed, ${summary.pending} pending`);
    console.log(`Bookmarks scraped: ${summary.bookmarks.toLocaleString()}`);
    console.log(`Relationships created: ${summary.relationships.toLocaleString()}`);
    console.log(`New users discovered: ${summary.discovered}`);
    console.log('=======================\n');
  }
}
