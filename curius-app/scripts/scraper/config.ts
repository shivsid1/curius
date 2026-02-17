import path from 'path';

export const CONFIG = {
  // API Configuration
  CURIUS_BASE_URL: 'https://curius.app/api',

  // Rate Limiting
  REQUESTS_PER_SECOND: 2,
  DELAY_BETWEEN_PAGES_MS: 500,
  DELAY_BETWEEN_USERS_MS: 1000,

  // Retry Configuration
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 2000,
  RETRY_BACKOFF_MULTIPLIER: 2,

  // Batch Sizes
  SUPABASE_BATCH_SIZE: 100,
  PROGRESS_SAVE_INTERVAL: 10,

  // File Paths
  DATA_DIR: path.join(process.cwd(), 'data', 'progress'),
  PROGRESS_FILE: path.join(process.cwd(), 'data', 'progress', 'scrape-progress.json'),
  ERROR_LOG_FILE: path.join(process.cwd(), 'data', 'progress', 'error-log.json'),

  // Timeouts
  REQUEST_TIMEOUT_MS: 30000,
};
