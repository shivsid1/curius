#!/usr/bin/env node
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  console.log("=== CURIUS TAGGING STATUS ===\n");

  // Get tagged count
  const { count: taggedCount } = await supabase
    .from("bookmark_tags_v2")
    .select("*", { count: "exact", head: true });

  console.log("Tagged bookmarks:", taggedCount);

  // Get sample of tagged IDs for filtering (limited but useful for domain analysis)
  const { data: taggedIds } = await supabase
    .from("bookmark_tags_v2")
    .select("bookmark_id")
    .order("bookmark_id", { ascending: false })
    .limit(50000);

  const taggedSet = new Set(taggedIds?.map(t => t.bookmark_id) || []);

  // Get total
  const { count: total } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true });

  console.log("Total bookmarks:", total);
  console.log("Untagged:", total - taggedSet.size);

  // Get recent untagged
  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select("id, link, title, domain")
    .order("id", { ascending: false })
    .limit(3000);

  if (error) {
    console.log("Error fetching bookmarks:", error.message);
    return;
  }

  const untagged = (bookmarks || []).filter(b => taggedSet.has(b.id) === false);
  console.log("\nUntagged in recent 3000:", untagged.length);

  // Group by domain
  const domains = {};
  untagged.forEach(b => {
    const d = (b.domain || "unknown").replace("www.", "");
    domains[d] = (domains[d] || 0) + 1;
  });

  const sorted = Object.entries(domains).sort((a,b) => b[1] - a[1]).slice(0, 20);
  console.log("\nTop domains needing tagging:");
  sorted.forEach(([d, c]) => console.log("  ", c.toString().padStart(4), d));

  // Sample URLs
  console.log("\nSample untagged:");
  untagged.slice(0, 8).forEach(b => {
    console.log("  -", b.domain, "|", (b.title || "").substring(0, 50));
  });
}

check().catch(console.error);
