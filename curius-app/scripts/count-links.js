async function countLinks() {
  const userId = 1296;
  const username = 'anson-yu';
  let total = 0;
  let page = 0;

  while (true) {
    const res = await fetch(`https://curius.app/api/users/${userId}/links?page=${page}`, {
      headers: { 'Referer': `https://curius.app/${username}` }
    });
    const data = await res.json();
    const count = data.userSaved?.length || 0;
    console.log(`Page ${page}: ${count} links`);
    total += count;
    if (count === 0) break;
    page++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nTotal: ${total} links for ${username}`);
}

countLinks().catch(console.error);
