#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

// Register ts-node for TypeScript support
require('ts-node').register({
  project: './scripts/tsconfig.json',
  transpileOnly: true,
});

// Run the scraper
require('./scraper/index.ts');
