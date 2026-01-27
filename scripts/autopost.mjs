import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================
// FILE PATHS
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const POSTED_FILE = join(DATA_DIR, 'posted.json');

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const SPORTDB_API_KEY = process.env.SPORTDB_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FORCE_POST = process.env.FORCE_POST === 'true';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  MIN_POSTS_PER_DAY: 10,
  MAX_POSTS_PER_DAY: 14,
  MIN_HOURS_BETWEEN_POSTS: 1,
  PEAK_HOURS: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  QUIET_HOURS: [0, 1, 2, 3, 4, 5, 6, 7],
  BASE_POST_CHANCE: 0.25,
  PAGE_NAME: "Global Score News",
  TELEGRAM_URL: "https://t.me/+9uDCOJXm_R1hMzM0",
  
  // Top leagues to prioritize
  TOP_LEAGUES: [
    "PREMIER LEAGUE",
    "LA LIGA", 
    "BUNDESLIGA",
    "SERIE A",
    "LIGUE 1",
    "CHAMPIONS LEAGUE",
    "EUROPA LEAGUE",
    "WORLD CUP",
    "EURO",
    "COPA AMERICA",
    "AFRICAN CUP",
    "MLS",
    "EREDIVISIE",
    "PRIMEIRA LIGA",
    "SUPER LIG"
  ],
  
  // Number of matches to include in multi-match posts
  MIN_MATCHES_FOR_RECAP: 3,
  MAX_MATCHES_FOR_RECAP: 8
};

// ============================================
// MASTER INSTRUCTION - MULTI MATCH ANALYSIS
// ============================================
const MASTER_INSTRUCTION_MULTI = `You are an elite social media editor for "Global Score News" - a top football page. Create VIRAL, engaging posts covering multiple match results.

YOUR GOAL: Hook readers and drive them to join Telegram.

STYLE RULES:
1. FIRST LINE: Explosive hook with emojis (🔥⚽💥🚨)
2. GROUP matches by league
3. For each match: Result + ONE sharp insight (who starred, key moment, what it means)
4. Use symbols: ✅ (win) 🤝 (draw) ❌ (loss) 💥 (big upset) 🔥 (high score)
5. Keep insights SHORT but PUNCHY (max 10 words each)
6. Add separator line before CTA
7. End with STRONG Telegram CTA - make them WANT to join

FORMAT:
🔥 [HOOK - make it irresisthat] ⚽

📊 [LEAGUE NAME]
Team A X-X Team B [emoji]
↳ [Short punchy insight]

Team C X-X Team D [emoji]
↳ [Short punchy insight]

📊 [NEXT LEAGUE]
...

━━━━━━━━━━━━━━━━━━━━━

💰 Want FREE betting tips & predictions?
👉 Join our Telegram: https://t.me/+9uDCOJXm_R1hMzM0
🎯 Daily tips • Live alerts • Expert analysis

[hashtags]

IMPORTANT:
- Be energetic but professional
- Insights must be based ONLY on the data provided
- If you don't have specific info, focus on the scoreline drama
- Make EVERY line valuable
- Total length: 150-300 words

Output JSON:
{
  "post_text": "<complete facebook post>",
  "hashtags": ["#GlobalScoreNews", ...]
}`;

// ============================================
// SINGLE MATCH INSTRUCTION
// ============================================
const MASTER_INSTRUCTION_SINGLE = `You are an elite social media editor for "Global Score News." Create an engaging post about this match.

RULES:
1. Hook first line with 1-2 emojis
2. Cover the key story (winner, standout player, what's at stake)
3. 60-100 words
4. End with Telegram CTA: "Free tips + alerts 👉 https://t.me/+9uDCOJXm_R1hMzM0"
5. Add hashtags

Output JSON:
{
  "post_text": "<facebook post>",
  "hashtags": ["#GlobalScoreNews", ...]
}`;

// ============================================
// HELPERS
// ============================================

function assertEnv() {
  const required = ["SPORTDB_API_KEY", "GROQ_API_KEY", "FB_PAGE_ID", "FB_PAGE_ACCESS_TOKEN"];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing: ${key}`);
  }
  console.log("✅ Environment OK");
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================
// HISTORY MANAGEMENT
// ============================================

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadHistory() {
  ensureDataDir();
  if (!existsSync(POSTED_FILE)) return { posts: [], dailyCount: {}, lastPost: null, lastRecap: null };
  try {
    return JSON.parse(readFileSync(POSTED_FILE, 'utf-8'));
  } catch {
    return { posts: [], dailyCount: {}, lastPost: null, lastRecap: null };
  }
}

function saveHistory(history) {
  ensureDataDir();
  if (history.posts.length > 200) history.posts = history.posts.slice(-200);
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffDate = cutoff.toISOString().split('T')[0];
  for (const date in history.dailyCount) {
    if (date < cutoffDate) delete history.dailyCount[date];
  }
  
  writeFileSync(POSTED_FILE, JSON.stringify(history, null, 2));
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getTodayCount(history) {
  return history.dailyCount[getTodayDate()] || 0;
}

function getHoursSinceLastPost(history) {
  if (!history.lastPost) return 999;
  return (new Date() - new Date(history.lastPost)) / (1000 * 60 * 60);
}

function getHoursSinceLastRecap(history) {
  if (!history.lastRecap) return 999;
  return (new Date() - new Date(history.lastRecap)) / (1000 * 60 * 60);
}

function createMatchKey(m) {
  const home = m.homeName || m.homeFirstName || "";
  const away = m.awayName || m.awayFirstName || "";
  const date = getTodayDate();
  return `${date}_${home}_${away}`;
}

function wasPosted(history, key) {
  return history.posts.some(p => p.matchKey === key);
}

function recordPost(history, matches, postType) {
  const today = getTodayDate();
  const now = new Date().toISOString();
  
  // Record each match
  for (const m of matches) {
    history.posts.push({
      matchKey: createMatchKey(m),
      matchInfo: `${m.home_team} vs ${m.away_team}`,
      postedAt: now,
      postType
    });
  }
  
  history.dailyCount[today] = (history.dailyCount[today] || 0) + 1;
  history.lastPost = now;
  
  if (postType === 'recap') {
    history.lastRecap = now;
  }
  
  saveHistory(history);
}

// ============================================
// SHOULD POST NOW
// ============================================

function shouldPostNow(history) {
  const hour = new Date().getUTCHours();
  const count = getTodayCount(history);
  const hoursSince = getHoursSinceLastPost(history);
  
  const seed = parseInt(getTodayDate().replace(/-/g, ''));
  const target = CONFIG.MIN_POSTS_PER_DAY + (seed % (CONFIG.MAX_POSTS_PER_DAY - CONFIG.MIN_POSTS_PER_DAY + 1));
  
  console.log(`\n📊 Check: ${count}/${target} posts | ${hoursSince.toFixed(1)}h since last`);
  
  if (count >= target) { console.log("   ❌ Daily limit"); return false; }
  if (hoursSince < CONFIG.MIN_HOURS_BETWEEN_POSTS) { console.log("   ❌ Too soon"); return false; }
  
  let chance = CONFIG.BASE_POST_CHANCE;
  if (CONFIG.QUIET_HOURS.includes(hour)) chance *= 0.3;
  else if (CONFIG.PEAK_HOURS.includes(hour)) chance *= 1.5;
  
  const roll = Math.random();
  const willPost = roll < chance;
  console.log(`   🎲 ${(chance * 100).toFixed(0)}% chance | ${willPost ? '✅ POST' : '⏭️ SKIP'}`);
  
  return willPost;
}

// ============================================
// SPORTDB API
// ============================================

async function fetchMatches() {
  console.log("\n📡 Fetching matches...");
  
  // Try live matches
  let res = await fetch("https://api.sportdb.dev/api/flashscore/football/live", {
    headers: { "X-API-Key": SPORTDB_API_KEY }
  });
  
  let allMatches = [];
  
  if (res.ok) {
    const data = await res.json();
    const matches = Array.isArray(data) ? data : (data.matches || data.events || data.data || []);
    allMatches = [...matches];
    console.log(`   ${matches.length} live matches`);
  }
  
  // Also get today's matches for finished games
  res = await fetch("https://api.sportdb.dev/api/flashscore/football/today", {
    headers: { "X-API-Key": SPORTDB_API_KEY }
  });
  
  if (res.ok) {
    const data = await res.json();
    const matches = Array.isArray(data) ? data : (data.matches || data.events || data.data || []);
    
    // Add finished matches not already in live
    for (const m of matches) {
      const key = `${m.homeName || m.homeFirstName}_${m.awayName || m.awayFirstName}`;
      const exists = allMatches.some(existing => 
        `${existing.homeName || existing.homeFirstName}_${existing.awayName || existing.awayFirstName}` === key
      );
      if (!exists) {
        allMatches.push(m);
      }
    }
    console.log(`   ${allMatches.length} total matches`);
  }
  
  return allMatches;
}

// ============================================
// MATCH PROCESSING
// ============================================

function isTopLeague(leagueName) {
  if (!leagueName) return false;
  const upper = leagueName.toUpperCase();
  return CONFIG.TOP_LEAGUES.some(league => upper.includes(league));
}

function getMatchStatus(m) {
  const status = (m.eventStage || m.status || "").toUpperCase();
  if (status.includes("HALF") || status === "LIVE" || status === "1H" || status === "2H") return "LIVE";
  if (["FINISHED", "ENDED", "FT", "AET", "AFTER ET", "AFTER PEN"].includes(status)) return "FT";
  if (status.includes("HT") || status === "HALFTIME") return "HT";
  return "NS";
}

function transformMatch(raw) {
  return {
    competition: raw.leagueName || raw.tournamentName || "",
    home_team: raw.homeName || raw.homeFirstName || "Unknown",
    away_team: raw.awayName || raw.awayFirstName || "Unknown",
    status: getMatchStatus(raw),
    minute: raw.gameTime !== "-1" ? raw.gameTime : null,
    score: {
      home: parseInt(raw.homeScore) || parseInt(raw.homeFullTimeScore) || 0,
      away: parseInt(raw.awayScore) || parseInt(raw.awayFullTimeScore) || 0
    },
    odds: raw.odds || null,
    raw: raw
  };
}

function getTopMatches(matches, history) {
  // Filter valid matches
  const valid = matches.filter(m => 
    (m.homeName || m.homeFirstName) && 
    (m.awayName || m.awayFirstName)
  );
  
  // Transform all
  const transformed = valid.map(transformMatch);
  
  // Get finished matches from top leagues (not yet posted)
  const topFinished = transformed.filter(m => 
    m.status === "FT" && 
    isTopLeague(m.competition) &&
    !wasPosted(history, createMatchKey(m.raw))
  );
  
  // Get live matches from top leagues
  const topLive = transformed.filter(m => 
    (m.status === "LIVE" || m.status === "HT") && 
    isTopLeague(m.competition)
  );
  
  // Get high-scoring finished matches (exciting games)
  const highScoring = transformed.filter(m => 
    m.status === "FT" && 
    (m.score.home + m.score.away) >= 4 &&
    !wasPosted(history, createMatchKey(m.raw))
  );
  
  // Combine and dedupe
  const combined = [...topFinished, ...topLive, ...highScoring];
  const unique = [];
  const seen = new Set();
  
  for (const m of combined) {
    const key = `${m.home_team}_${m.away_team}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }
  
  // Sort by league importance
  unique.sort((a, b) => {
    const aIndex = CONFIG.TOP_LEAGUES.findIndex(l => a.competition.toUpperCase().includes(l));
    const bIndex = CONFIG.TOP_LEAGUES.findIndex(l => b.competition.toUpperCase().includes(l));
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
  
  return unique;
}

function groupMatchesByLeague(matches) {
  const groups = {};
  
  for (const m of matches) {
    const league = m.competition || "Other";
    if (!groups[league]) groups[league] = [];
    groups[league].push(m);
  }
  
  return groups;
}

// ============================================
// GROQ API
// ============================================

async function generateMultiMatchPost(matches) {
  console.log("\n🤖 Generating multi-match post...");
  
  const grouped = groupMatchesByLeague(matches);
  
  // Build match data for prompt
  let matchData = "";
  for (const [league, games] of Object.entries(grouped)) {
    matchData += `\n${league}:\n`;
    for (const g of games) {
      const resultEmoji = g.score.home > g.score.away ? "✅" : 
                          g.score.home < g.score.away ? "❌" : "🤝";
      matchData += `- ${g.home_team} ${g.score.home}-${g.score.away} ${g.away_team} ${resultEmoji}\n`;
      matchData += `  Status: ${g.status}`;
      if (g.minute) matchData += ` (${g.minute}')`;
      matchData += "\n";
    }
  }
  
  const prompt = `${MASTER_INSTRUCTION_MULTI}

MATCHES TO COVER:
${matchData}

Create an engaging recap post. Return JSON only.`;

  return await callGroq(prompt);
}

async function generateSingleMatchPost(match) {
  console.log("\n🤖 Generating single match post...");
  
  const prompt = `${MASTER_INSTRUCTION_SINGLE}

MATCH:
${match.home_team} ${match.score.home}-${match.score.away} ${match.away_team}
Competition: ${match.competition}
Status: ${match.status}${match.minute ? ` (${match.minute}')` : ''}
${match.odds ? `Odds: ${match.odds.home || '-'} | ${match.odds.draw || '-'} | ${match.odds.away || '-'}` : ''}

Create an engaging post. Return JSON only.`;

  return await callGroq(prompt);
}

async function callGroq(prompt) {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
  
  for (const model of models) {
    try {
      console.log(`   Trying: ${model}`);
      
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a viral social media expert. Respond with valid JSON only. No markdown code blocks." },
            { role: "user", content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 1500
        })
      });
      
      if (res.status === 429) {
        console.log("   ⚠️ Rate limited, waiting...");
        await delay(5000);
        continue;
      }
      
      if (!res.ok) continue;
      
      const data = await res.json();
      let text = data?.choices?.[0]?.message?.content || "";
      
      // Clean JSON
      text = text.trim();
      if (text.startsWith("```")) text = text.replace(/```json?|```/g, "").trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
      
      console.log("   ✅ Generated");
      return JSON.parse(text);
      
    } catch (e) {
      console.log(`   ❌ ${e.message}`);
      continue;
    }
  }
  
  throw new Error("All models failed");
}

// ============================================
// FACEBOOK API
// ============================================

async function postToFacebook(message) {
  console.log("\n📘 Posting to Facebook...");
  
  const res = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`, {
    method: "POST",
    body: new URLSearchParams({
      message: message,
      access_token: FB_PAGE_ACCESS_TOKEN
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Facebook: ${res.status} - ${err}`);
  }
  
  console.log("   ✅ Posted");
  return res.json();
}

// ============================================
// DECIDE POST TYPE
// ============================================

function decidePostType(topMatches, history) {
  const hoursSinceRecap = getHoursSinceLastRecap(history);
  const hasEnoughForRecap = topMatches.length >= CONFIG.MIN_MATCHES_FOR_RECAP;
  
  console.log(`\n🎯 Post type decision:`);
  console.log(`   Top matches available: ${topMatches.length}`);
  console.log(`   Hours since last recap: ${hoursSinceRecap.toFixed(1)}`);
  
  // Do a recap every 3-4 hours if we have enough matches
  if (hasEnoughForRecap && hoursSinceRecap >= 3) {
    console.log("   → MULTI-MATCH RECAP");
    return "recap";
  }
  
  // Otherwise single match post
  if (topMatches.length > 0) {
    console.log("   → SINGLE MATCH");
    return "single";
  }
  
  console.log("   → NO SUITABLE CONTENT");
  return null;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🚀 Global Score News v3.0");
  console.log("=".repeat(50));
  console.log(`⏰ ${new Date().toISOString()}`);
  
  assertEnv();
  
  const history = loadHistory();
  
  // Check if we should post
  if (!FORCE_POST && !shouldPostNow(history)) {
    console.log("\n👋 Skipping this run.");
    return;
  }
  
  if (FORCE_POST) console.log("\n⚡ FORCE POST MODE");
  
  // Fetch all matches
  const allMatches = await fetchMatches();
  if (!allMatches?.length) {
    console.log("\n⚠️ No matches available.");
    return;
  }
  
  // Get top matches
  const topMatches = getTopMatches(allMatches, history);
  console.log(`\n🏆 Found ${topMatches.length} top matches`);
  
  if (topMatches.length === 0) {
    console.log("⚠️ No top matches to post about.");
    return;
  }
  
  // Decide post type
  const postType = decidePostType(topMatches, history);
  
  if (!postType) {
    console.log("⚠️ No suitable content.");
    return;
  }
  
  let response;
  let matchesToRecord = [];
  
  if (postType === "recap") {
    // Multi-match recap
    const matchesForRecap = topMatches.slice(0, CONFIG.MAX_MATCHES_FOR_RECAP);
    matchesToRecord = matchesForRecap;
    
    console.log(`\n📋 Creating recap with ${matchesForRecap.length} matches:`);
    for (const m of matchesForRecap) {
      console.log(`   • ${m.home_team} ${m.score.home}-${m.score.away} ${m.away_team} (${m.competition})`);
    }
    
    response = await generateMultiMatchPost(matchesForRecap);
    
  } else {
    // Single match
    const match = topMatches[getRandomInt(0, Math.min(2, topMatches.length - 1))];
    matchesToRecord = [match];
    
    console.log(`\n📋 Single match: ${match.home_team} ${match.score.home}-${match.score.away} ${match.away_team}`);
    
    response = await generateSingleMatchPost(match);
  }
  
  // Build final message
  const message = response.post_text + 
    (response.hashtags?.length ? "\n\n" + response.hashtags.join(" ") : "\n\n#GlobalScoreNews #Football");
  
  // Preview
  console.log("\n" + "=".repeat(50));
  console.log("📝 POST PREVIEW:");
  console.log("=".repeat(50));
  console.log(message);
  console.log("=".repeat(50));
  
  // Post to Facebook
  const result = await postToFacebook(message);
  console.log(`\n✅ Posted! ID: ${result.id}`);
  
  // Record
  recordPost(history, matchesToRecord.map(m => m.raw || m), postType);
  console.log(`📊 Today's posts: ${getTodayCount(history)}`);
}

main().catch((e) => {
  console.error("\n❌ Error:", e.message);
  process.exit(1);
});
