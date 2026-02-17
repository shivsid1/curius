require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  console.log('Checking Curius database stats...\n');

  // Count users
  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  // Count bookmarks
  const { count: bookmarkCount } = await supabase
    .from('bookmarks')
    .select('*', { count: 'exact', head: true });

  // Count user_bookmarks
  const { count: userBookmarkCount } = await supabase
    .from('user_bookmarks')
    .select('*', { count: 'exact', head: true });

  // Count tags
  const { count: tagCount } = await supabase
    .from('bookmark_tags_v2')
    .select('*', { count: 'exact', head: true });

  // Sample users
  const { data: sampleUsers } = await supabase
    .from('users')
    .select('username, display_name, bookmark_count')
    .order('bookmark_count', { ascending: false })
    .limit(5);

  // Sample bookmarks
  const { data: sampleBookmarks } = await supabase
    .from('bookmarks')
    .select('title, domain, save_count')
    .order('save_count', { ascending: false })
    .limit(5);

  // Tag distribution
  const { data: tagDist } = await supabase
    .from('bookmark_tags_v2')
    .select('topic')
    .limit(10000);

  const topicCounts = {};
  if (tagDist) {
    tagDist.forEach(t => {
      topicCounts[t.topic] = (topicCounts[t.topic] || 0) + 1;
    });
  }

  console.log('=== DATABASE STATS ===');
  console.log('Users:          ' + (userCount ? userCount.toLocaleString() : 'N/A'));
  console.log('Bookmarks:      ' + (bookmarkCount ? bookmarkCount.toLocaleString() : 'N/A'));
  console.log('User-Bookmarks: ' + (userBookmarkCount ? userBookmarkCount.toLocaleString() : 'N/A'));
  console.log('Tags:           ' + (tagCount ? tagCount.toLocaleString() : 'N/A'));

  console.log('\n=== TOP USERS BY BOOKMARKS ===');
  if (sampleUsers) {
    sampleUsers.forEach(u => {
      console.log('  ' + u.username + ': ' + u.bookmark_count + ' bookmarks');
    });
  }

  console.log('\n=== MOST SAVED BOOKMARKS ===');
  if (sampleBookmarks) {
    sampleBookmarks.forEach(b => {
      const title = b.title ? b.title.substring(0, 50) : 'No title';
      console.log('  [' + b.save_count + 'x] ' + title + ' (' + b.domain + ')');
    });
  }

  console.log('\n=== TAG DISTRIBUTION (sample) ===');
  Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, count]) => {
      console.log('  ' + topic + ': ' + count);
    });
}

checkData().catch(console.error);
