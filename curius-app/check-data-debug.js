require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Checking Curius database...\n');

  // Try to list tables by querying each one
  const tables = ['users', 'bookmarks', 'user_bookmarks', 'bookmark_tags_v2'];

  for (const table of tables) {
    const result = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(table + ':');
    console.log('  count:', result.count);
    console.log('  error:', result.error ? result.error.message : 'none');
    console.log('');
  }

  // Try a simple query
  console.log('Fetching sample data from users...');
  const { data, error } = await supabase.from('users').select('*').limit(3);
  if (error) {
    console.log('Error:', error.message);
    console.log('Code:', error.code);
    console.log('Details:', error.details);
  } else {
    console.log('Sample users:', JSON.stringify(data, null, 2));
  }

  // Try bookmarks
  console.log('\nFetching sample data from bookmarks...');
  const { data: bData, error: bError } = await supabase.from('bookmarks').select('*').limit(3);
  if (bError) {
    console.log('Error:', bError.message);
  } else {
    console.log('Sample bookmarks:', JSON.stringify(bData, null, 2));
  }
}

checkData().catch(console.error);
