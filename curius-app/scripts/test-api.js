require('dotenv').config({ path: '.env.local' });

async function testApi() {
  console.log('Testing Curius API...\n');

  // Test user fetch
  const username = 'yueh-han-huang';
  console.log(`Fetching user: ${username}`);

  const userRes = await fetch(`https://curius.app/api/users/${username}`, {
    headers: {
      'Referer': `https://curius.app/${username}`,
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const userData = await userRes.json();
  const userId = userData.user.id;
  console.log(`User ID: ${userId}`);
  console.log(`Name: ${userData.user.firstName} ${userData.user.lastName}`);

  // Test links fetch
  console.log(`\nFetching links for user ${userId}...`);

  const linksRes = await fetch(`https://curius.app/api/users/${userId}/links?page=0`, {
    headers: {
      'Referer': `https://curius.app/${username}`,
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const linksData = await linksRes.json();
  console.log(`Found ${linksData.userSaved.length} links on page 0`);

  // Show first 3 links
  console.log('\nFirst 3 links:');
  linksData.userSaved.slice(0, 3).forEach((link, i) => {
    console.log(`${i + 1}. ${link.title?.substring(0, 60) || 'No title'}`);
    console.log(`   ${link.link}`);
  });

  console.log('\n[OK] API test passed!');
}

testApi().catch(console.error);
