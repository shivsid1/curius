#!/bin/bash
# Curius Sync Cron Job
# Add to crontab with: crontab -e
# Run every 6 hours: 0 */6 * * * /path/to/cron-sync.sh

cd "$(dirname "$0")/.."
LOG_FILE="data/progress/sync-$(date +%Y%m%d).log"

echo "=== Sync started at $(date) ===" >> "$LOG_FILE"
npm run scrape:sync >> "$LOG_FILE" 2>&1
echo "=== Sync completed at $(date) ===" >> "$LOG_FILE"
