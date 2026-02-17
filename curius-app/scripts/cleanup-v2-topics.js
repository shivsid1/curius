#!/usr/bin/env node
/**
 * Cleanup script to consolidate outlier topics in bookmark_tags_v2
 * Maps non-standard topics to the official 14-category taxonomy
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Official 14-category taxonomy
const VALID_CATEGORIES = [
  'AI/ML', 'Tech', 'Startups', 'Science', 'Finance', 'Design',
  'Writing', 'Health', 'Philosophy', 'Education', 'Media', 'Tools', 'Culture', 'Career'
];

// Mapping of outlier topics to valid categories
const TOPIC_MAPPING = {
  // Startups variants
  'Startups/Business': 'Startups',
  'Business': 'Startups',

  // Finance variants
  'Crypto/Web3': 'Finance',
  'Digital Finance': 'Finance',
  'Economics': 'Finance',
  'Personal Finance': 'Finance',

  // Science variants
  'Math': 'Science',
  'Mathematics': 'Science',
  'Research': 'Science',
  'Engineering': 'Science',
  'Computer Science': 'Science',
  'Data Science': 'Science',
  'Data': 'Science',
  'Signal Processing': 'Science',
  'Climate': 'Science',
  'Energy': 'Science',

  // Culture variants
  'Art': 'Culture',
  'History': 'Culture',
  'Music': 'Culture',
  'Travel': 'Culture',
  'Food': 'Culture',
  'Cooking': 'Culture',
  'Fashion': 'Culture',
  'Sports': 'Culture',
  'Literature': 'Culture',
  'Games': 'Culture',
  'Gaming': 'Culture',
  'Game Design': 'Culture',
  'Crafts': 'Culture',
  'Jewelry': 'Culture',

  // Philosophy variants
  'Psychology': 'Philosophy',
  'Sociology': 'Philosophy',
  'Social Science': 'Philosophy',
  'Social Issues': 'Philosophy',
  'Politics': 'Philosophy',
  'Linguistics': 'Philosophy',
  'Language': 'Philosophy',
  'Parenting': 'Philosophy',
  'Relationships': 'Philosophy',
  'Demography': 'Philosophy',
  'Urban Studies': 'Philosophy',
  'Law': 'Philosophy',
  'Game Theory': 'Philosophy',

  // Career variants
  'Career/Work': 'Career',
  'Marketing': 'Career',

  // Tech variants
  'Security': 'Tech',
  'Cybersecurity': 'Tech',

  // Media variants
  'Social Media': 'Media',
  'Communication': 'Media',

  // Additional mappings
  'Policy': 'Philosophy',
  'Travel': 'Culture',

  // Catch-all
  'Other': 'Culture', // Default fallback
};

async function cleanup() {
  console.log('=== CLEANING UP V2 OUTLIER TOPICS ===\n');

  // Get current distribution
  const { data: all } = await supabase
    .from('bookmark_tags_v2')
    .select('bookmark_id, topic');

  const outliers = all.filter(t => !VALID_CATEGORIES.includes(t.topic));
  console.log(`Found ${outliers.length} entries with outlier topics\n`);

  // Group by topic
  const byTopic = {};
  outliers.forEach(t => {
    byTopic[t.topic] = byTopic[t.topic] || [];
    byTopic[t.topic].push(t.bookmark_id);
  });

  // Process each outlier topic
  for (const [topic, bookmarkIds] of Object.entries(byTopic)) {
    const newTopic = TOPIC_MAPPING[topic];

    if (!newTopic) {
      console.log(`[SKIP] "${topic}" (${bookmarkIds.length}) - no mapping defined`);
      continue;
    }

    console.log(`[FIX] "${topic}" -> "${newTopic}" (${bookmarkIds.length} entries)`);

    // Update in batches
    const batchSize = 100;
    for (let i = 0; i < bookmarkIds.length; i += batchSize) {
      const batch = bookmarkIds.slice(i, i + batchSize);
      const { error } = await supabase
        .from('bookmark_tags_v2')
        .update({ topic: newTopic })
        .in('bookmark_id', batch);

      if (error) {
        console.log(`  Error updating batch: ${error.message}`);
      }
    }
  }

  console.log('\n=== CLEANUP COMPLETE ===');

  // Verify final distribution
  const { data: final } = await supabase
    .from('bookmark_tags_v2')
    .select('topic');

  const finalDist = {};
  final.forEach(t => {
    finalDist[t.topic] = (finalDist[t.topic] || 0) + 1;
  });

  console.log('\nFinal topic distribution:');
  Object.entries(finalDist)
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, count]) => {
      const valid = VALID_CATEGORIES.includes(topic) ? '' : ' [OUTLIER]';
      console.log(`  ${topic}: ${count}${valid}`);
    });
}

if (process.argv.includes('--dry-run')) {
  console.log('DRY RUN - showing what would be changed:\n');
  supabase
    .from('bookmark_tags_v2')
    .select('topic')
    .then(({ data }) => {
      const outliers = data.filter(t => !VALID_CATEGORIES.includes(t.topic));
      const byTopic = {};
      outliers.forEach(t => {
        byTopic[t.topic] = (byTopic[t.topic] || 0) + 1;
      });
      Object.entries(byTopic)
        .sort((a, b) => b[1] - a[1])
        .forEach(([topic, count]) => {
          const mapped = TOPIC_MAPPING[topic] || '[NO MAPPING]';
          console.log(`"${topic}" (${count}) -> ${mapped}`);
        });
    });
} else {
  cleanup().catch(console.error);
}
