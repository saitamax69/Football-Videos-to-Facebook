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
  // Target posts per day (will vary randomly between min and max)
  MIN_POSTS_PER_DAY: 10,
  MAX_POSTS_PER_DAY: 14,
  
  // Minimum hours between posts (prevents spam)
  MIN_HOURS_BETWEEN_POSTS: 1,
  
  // Peak hours (more likely to post) - 24h format UTC
  PEAK_HOURS: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  
  // Quiet hours (less likely to post) - 24h format UTC
  QUIET_HOURS: [0, 1, 2, 3, 4, 5, 6, 7],
  
  // Chance to post during each check (adjusted by time of day)
  BASE_POST_CHANCE: 0.25  // 25% base chance every 30 min
};

// ============================================
// MASTER INSTRUCTION FOR AI
// ============================================
const MASTER_INSTRUCTION = `You are a senior social media editor for the Facebook page "Global Score News." You write concise, clean, professional posts about football (soccer): live updates, results, analysis, previews, and predictions. You must ONLY use facts present in the provided match_data. Do not invent details.

Constraints and style:

First line = strong hook with 1–2 relevant emojis.
Total length: 45–110 words (tight, scannable).
Include team names, score/time, key scorers or moments if provided, and 1–2 sharp insights (form, H2H, xG, odds-like context) strictly derived from match_data.
Use 3–6 tasteful emojis (no spam, no childish vibe).
End with a clear CTA to the Telegram channel for free tips: "Free tips + real-time alerts: Join our Telegram 👉 https://t.me/+xAQ3DCVJa8A2ZmY8"
Include 5–10 relevant hashtags. Always include #GlobalScoreNews and competition tags if provided.
For predictions/free tips: add a short disclaimer: "No guarantees. Bet responsibly (18+)."
Never claim certainty. Avoid clickbait. Keep it professional.
Language: English (default).
Tone: confident, neutral, energetic—not hype.
If a field in match_data is missing, omit it gracefully.

Output format (JSON only, no markdown, no extra text):
{
  "post_type": "<one of the content types>",
  "title": "<optional, short>",
  "post_text": "<final facebook text ready to post>",
  "hashtags": ["#GlobalScoreNews", "...", "..."],
  "safety_notes": "<any caveats you applied>"
}`;

// ============================================
// HELPER FUNCTIONS
// ============================================

function assertEnv() {
  const required = ["SPORTDB_API_KEY", "GROQ_API_KEY", "FB_PAGE_ID", "FB_PAGE_ACCESS_TOKEN"];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing: ${key}`);
    }
  }
  console.log("✅ Environment variables OK");
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================
// POSTED HISTORY MANAGEMENT
// ============================================

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPostedHistory() {
  ensureDataDir();
  
  if (!existsSync(POSTED_FILE)) {
    return { posts: [], dailyCount: {}, lastPost: null };
  }
  
  try {
    const data = readFileSync(POSTED_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { posts: [], dailyCount: {}, lastPost: null };
  }
}

function savePostedHistory(history) {
  ensureDataDir();
  
  // Keep only last 100 posts to prevent file from growing too large
  if (history.posts.length > 100) {
    history.posts = history.posts.slice(-100);
  }
  
  // Clean old daily counts (keep only last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
  
  for (const date in history.dailyCount) {
    if (date < cutoffDate) {
      delete history.dailyCount[date];
    }
  }
  
  writeFileSync(POSTED_FILE, JSON.stringify(history, null, 2));
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getTodayPostCount(history) {
  const today = getTodayDate();
  return history.dailyCount[today] || 0;
}

function getHoursSinceLastPost(history) {
  if (!history.lastPost) return 999;
  
  const lastPostTime = new Date(history.lastPost);
  const now = new Date();
  const diffMs = now - lastPostTime;
  return diffMs / (1000 * 60 * 60);
}

function wasMatchPosted(history, matchKey) {
  return history.posts.some(p => p.matchKey === matchKey);
}

function recordPost(history, matchKey, matchInfo) {
  const today = getTodayDate();
  const now = new Date().toISOString();
  
  history.posts.push({
    matchKey,
    matchInfo,
    postedAt: now
  });
  
  history.dailyCount[today] = (history.dailyCount[today] || 0) + 1;
  history.lastPost = now;
  
  savePostedHistory(history);
}

// ============================================
// RANDOM POSTING DECISION
// ============================================

function shouldPostNow(history) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const today = getTodayDate();
  const todayCount = getTodayPostCount(history);
  const hoursSinceLastPost = getHoursSinceLastPost(history);
  
  // Determine today's target (random between min and max)
  // Use date as seed for consistent daily target
  const dateSeed = parseInt(today.replace(/-/g, ''));
  const dailyTarget = CONFIG.MIN_POSTS_PER_DAY + (dateSeed % (CONFIG.MAX_POSTS_PER_DAY - CONFIG.MIN_POSTS_PER_DAY + 1));
  
  console.log(`\n📊 Posting Decision:`);
  console.log(`   Current hour (UTC): ${currentHour}`);
  console.log(`   Posts today: ${todayCount}/${dailyTarget}`);
  console.log(`   Hours since last post: ${hoursSinceLastPost.toFixed(1)}`);
  
  // Already hit daily limit
  if (todayCount >= dailyTarget) {
    console.log(`   ❌ Daily limit reached`);
    return false;
  }
  
  // Too soon since last post
  if (hoursSinceLastPost < CONFIG.MIN_HOURS_BETWEEN_POSTS) {
    console.log(`   ❌ Too soon since last post`);
    return false;
  }
  
  // Calculate post chance based on time of day
  let postChance = CONFIG.BASE_POST_CHANCE;
  
  if (CONFIG.QUIET_HOURS.includes(currentHour)) {
    postChance *= 0.3;  // 30% of normal chance during quiet hours
    console.log(`   🌙 Quiet hour - reduced chance`);
  } else if (CONFIG.PEAK_HOURS.includes(currentHour)) {
    postChance *= 1.5;  // 150% of normal chance during peak hours
    console.log(`   🔥 Peak hour - increased chance`);
  }
  
  // If falling behind on daily target, increase chance
  const expectedPostsByNow = (currentHour / 24) * dailyTarget;
  if (todayCount < expectedPostsByNow - 2) {
    postChance *= 1.5;
    console.log(`   ⚡ Behind schedule - increased chance`);
  }
  
  // Random decision
  const random = Math.random();
  const willPost = random < postChance;
  
  console.log(`   🎲 Chance: ${(postChance * 100).toFixed(1)}% | Roll: ${(random * 100).toFixed(1)}%`);
  console.log(`   ${willPost ? '✅ WILL POST' : '⏭️ SKIP THIS TIME'}`);
  
  return willPost;
}

// ============================================
// SPORTDB API
// ============================================

async function fetchLiveMatches() {
  const res = await fetch("https://api.sportdb.dev/api/flashscore/football/live", {
    headers: { "X-API-Key": SPORTDB_API_KEY }
  });
  
  if (!res.ok) return [];
  
  const data = await res.json();
  return Array.isArray(data) ? data : (data.matches || data.events || data.data || []);
}

async function fetchTodayMatches() {
  const res = await fetch("https://api.sportdb.dev/api/flashscore/football/today", {
    headers: { "X-API-Key": SPORTDB_API_KEY }
  });
  
  if (!res.ok) throw new Error(`SportDB error: ${res.status}`);
  
  const data = await res.json();
  return Array.isArray(data) ? data : (data.matches || data.events || data.data || []);
}

async function fetchAllMatches() {
  console.log("\n📡 Fetching matches from SportDB...");
  
  let matches = await fetchLiveMatches();
  if (matches.length > 0) {
    console.log(`   Found ${matches.length} live matches`);
    return matches;
  }
  
  matches = await fetchTodayMatches();
  console.log(`   Found ${matches.length} matches today`);
  return matches;
}

// ============================================
// MATCH SELECTION
// ============================================

function createMatchKey(m) {
  const home = m.homeName || m.homeFirstName || "";
  const away = m.awayName || m.awayFirstName || "";
  const status = (m.eventStage || m.status || "").toUpperCase();
  const score = `${m.homeScore || 0}-${m.awayScore || 0}`;
  return `${home}_${away}_${status}_${score}`;
}

function pickBestMatch(matches, history) {
  if (!matches?.length) return null;
  
  const hasValidTeams = (m) => (m.homeName || m.homeFirstName) && (m.awayName || m.awayFirstName);
  const validMatches = matches.filter(hasValidTeams);
  
  console.log(`\n🔍 Finding best match...`);
  console.log(`   Valid matches: ${validMatches.length}`);
  
  if (!validMatches.length) return null;
  
  const getStatus = (m) => (m.eventStage || m.status || "").toUpperCase();
  
  // Filter out already posted matches
  const notPosted = validMatches.filter(m => !wasMatchPosted(history, createMatchKey(m)));
  console.log(`   Not yet posted: ${notPosted.length}`);
  
  if (!notPosted.length) {
    console.log(`   ⚠️ All matches already posted, picking random from all`);
    // If all posted, pick a random one anyway (score might have changed)
    const randomIndex = getRandomInt(0, validMatches.length - 1);
    return validMatches[randomIndex];
  }
  
  // Priority: LIVE > HT > FT > Upcoming
  const live = notPosted.filter(m => {
    const s = getStatus(m);
    return s.includes("HALF") || s === "LIVE" || s === "1H" || s === "2H";
  });
  
  if (live.length) {
    const pick = live[getRandomInt(0, live.length - 1)];
    console.log(`   🔴 Selected random LIVE match`);
    return pick;
  }
  
  const ht = notPosted.filter(m => {
    const s = getStatus(m);
    return s.includes("HT") || s.includes("HALFTIME");
  });
  
  if (ht.length) {
    const pick = ht[getRandomInt(0, ht.length - 1)];
    console.log(`   ⏸️ Selected random HT match`);
    return pick;
  }
  
  const ft = notPosted.filter(m => {
    const s = getStatus(m);
    return s === "FINISHED" || s === "FT" || s === "ENDED";
  });
  
  if (ft.length) {
    const pick = ft[getRandomInt(0, ft.length - 1)];
    console.log(`   ✅ Selected random FT match`);
    return pick;
  }
  
  // Pick random from remaining
  const pick = notPosted[getRandomInt(0, notPosted.length - 1)];
  console.log(`   📌 Selected random match`);
  return pick;
}

function transformToMatchData(raw) {
  const normalizeStatus = (stage) => {
    const s = (stage || "").toUpperCase();
    if (s.includes("HALF") || s === "LIVE" || s === "1H" || s === "2H") return "LIVE";
    if (s === "FINISHED" || s === "ENDED" || s === "FT") return "FT";
    if (s.includes("HT") || s === "HALFTIME") return "HT";
    return "NS";
  };
  
  return {
    competition: raw.leagueName || raw.tournamentName || "",
    home_team: raw.homeName || raw.homeFirstName || "Unknown",
    away_team: raw.awayName || raw.awayFirstName || "Unknown",
    status: normalizeStatus(raw.eventStage || raw.status),
    minute: raw.gameTime !== "-1" ? raw.gameTime : null,
    score: {
      home: parseInt(raw.homeScore) || parseInt(raw.homeFullTimeScore) || 0,
      away: parseInt(raw.awayScore) || parseInt(raw.awayFullTimeScore) || 0
    }
  };
}

function determineContentType(status) {
  const types = { "LIVE": "live_update", "HT": "half_time", "FT": "full_time" };
  return types[status] || "preview";
}

// ============================================
// GROQ API
// ============================================

async function generateWithGroq(contentType, matchData) {
  console.log("\n🤖 Generating post with Groq...");
  
  const input = {
    page_name: "Global Score News",
    telegram_cta_url: "https://t.me/+xAQ3DCVJa8A2ZmY8",
    content_type: contentType,
    language: "en",
    match_data: matchData
  };

  const prompt = `${MASTER_INSTRUCTION}

Generate a ${contentType} post for this match:

${JSON.stringify(input, null, 2)}

IMPORTANT: Return ONLY valid JSON, no markdown, no extra text.`;

  const models = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
  ];
  
  let lastError = null;
  
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
          model: model,
          messages: [
            {
              role: "system",
              content: "You are a professional social media editor. Always respond with valid JSON only."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });
      
      if (res.status === 429) {
        console.log(`   ⚠️ Rate limited, trying next...`);
        await delay(2000);
        continue;
      }
      
      if (!res.ok) {
        console.log(`   ❌ Failed: ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      
      if (!text) continue;
      
      // Parse JSON
      let cleaned = text.trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
      else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();
      
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
      }
      
      console.log(`   ✅ Success!`);
      return JSON.parse(cleaned);
      
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  
  throw lastError || new Error("All models failed");
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
    const errText = await res.text();
    throw new Error(`Facebook error ${res.status}: ${errText}`);
  }
  
  return res.json();
}

function buildMessage(response) {
  const postText = response.post_text || "";
  const hashtags = response.hashtags || [];
  
  if (postText.includes("#GlobalScoreNews")) return postText;
  return `${postText}\n\n${hashtags.join(" ")}`.trim();
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🚀 Global Score News Autopost");
  console.log("=".repeat(50));
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  
  assertEnv();
  
  // Load history
  const history = loadPostedHistory();
  
  // Check if we should post now (random decision)
  if (!FORCE_POST && !shouldPostNow(history)) {
    console.log("\n👋 Skipping this run. Will check again next time.");
    return;
  }
  
  if (FORCE_POST) {
    console.log("\n⚡ FORCE POST enabled - skipping random check");
  }
  
  // Fetch matches
  const matches = await fetchAllMatches();
  if (!matches?.length) {
    console.log("\n⚠️ No matches found. Exiting.");
    return;
  }
  
  // Pick best match
  const rawMatch = pickBestMatch(matches, history);
  if (!rawMatch) {
    console.log("\n⚠️ No suitable match. Exiting.");
    return;
  }
  
  const matchData = transformToMatchData(rawMatch);
  const matchKey = createMatchKey(rawMatch);
  
  console.log(`\n📋 Selected Match:`);
  console.log(`   ${matchData.home_team} vs ${matchData.away_team}`);
  console.log(`   Status: ${matchData.status} | Score: ${matchData.score.home}-${matchData.score.away}`);
  console.log(`   Competition: ${matchData.competition}`);
  
  if (matchData.home_team === "Unknown") {
    console.log("\n⚠️ Invalid match data. Exiting.");
    return;
  }
  
  const contentType = determineContentType(matchData.status);
  console.log(`   Content type: ${contentType}`);
  
  // Generate post
  const response = await generateWithGroq(contentType, matchData);
  const message = buildMessage(response);
  
  console.log("\n" + "=".repeat(50));
  console.log("📝 POST PREVIEW:");
  console.log("=".repeat(50));
  console.log(message);
  console.log("=".repeat(50));
  
  // Post to Facebook
  const fbResult = await postToFacebook(message);
  console.log(`\n✅ Posted successfully!`);
  console.log(`   Post ID: ${fbResult.id}`);
  
  // Record the post
  recordPost(history, matchKey, {
    home: matchData.home_team,
    away: matchData.away_team,
    score: `${matchData.score.home}-${matchData.score.away}`,
    status: matchData.status
  });
  
  console.log(`\n📊 Today's posts: ${getTodayPostCount(history)}`);
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});
