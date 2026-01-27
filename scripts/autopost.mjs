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
  
  TOP_LEAGUES: [
    "PREMIER LEAGUE",
    "LA LIGA",
    "LALIGA",
    "BUNDESLIGA",
    "SERIE A",
    "LIGUE 1",
    "CHAMPIONS LEAGUE",
    "UEFA CHAMPIONS",
    "EUROPA LEAGUE",
    "UEFA EUROPA",
    "CONFERENCE LEAGUE",
    "WORLD CUP",
    "EURO 2024",
    "EURO 2028",
    "COPA AMERICA",
    "AFRICAN CUP",
    "AFCON",
    "MLS",
    "EREDIVISIE",
    "PRIMEIRA LIGA",
    "SUPER LIG",
    "SAUDI PRO LEAGUE",
    "BRASILEIRAO",
    "ARGENTINE PRIMERA"
  ],
  
  MIN_MATCHES_FOR_RECAP: 3,
  MAX_MATCHES_FOR_RECAP: 6
};

// ============================================
// MASTER INSTRUCTION - MULTI MATCH (DETAILED)
// ============================================
const MASTER_INSTRUCTION_MULTI = `You are the HEAD EDITOR of "Global Score News" - the most engaging football page on Facebook. Create VIRAL posts that make people NEED to join our Telegram.

YOUR MISSION: Write a comprehensive, exciting matchday recap that hooks readers and drives Telegram signups.

STRICT FORMAT TO FOLLOW:

1. HEADLINE (Line 1):
   - Start with attention-grabbing emoji (🚨🔥⚽💥)
   - Make it dramatic but accurate
   - Example: "🚨 MATCHDAY MADNESS! 12 Goals, 2 Upsets & Drama Everywhere! ⚽🔥"

2. INTRO (Line 2-3):
   - One punchy line setting the scene
   - Example: "What a night of football! Here's everything you need to know 👇"

3. FOR EACH MATCH INCLUDE:
   ⚽ [Home Team] [Score] [Away Team] [Result Emoji]
   🕐 [Time] | Odds: [Home] | [Draw] | [Away]
   ↳ [DETAILED ANALYSIS - 30-50 words per match]:
      • Who was the star player and why
      • Key moment that decided the game
      • What this means for the table/season
      • Any controversy or drama
      • Stats if impressive (possession, shots, etc.)

4. RESULT EMOJIS:
   ✅ = Home win
   ❌ = Home loss
   🤝 = Draw
   💥 = Upset/shock result
   🔥 = High-scoring game (4+ goals)

5. AFTER ALL MATCHES - "WHAT WE LEARNED" SECTION:
   🎯 WHAT WE LEARNED TODAY:
   • [Key takeaway 1]
   • [Key takeaway 2]
   • [Key takeaway 3]
   • [Key takeaway 4]

6. TELEGRAM CTA (MUST BE EXACTLY):
   ━━━━━━━━━━━━━━━━━━━━━

   💰 Want to WIN with us?

   We post FREE betting tips daily with high accuracy!
   👉 Join our Telegram: https://t.me/+9uDCOJXm_R1hMzM0

   ✅ Free daily tips
   ✅ Live match alerts
   ✅ Expert predictions
   ✅ Exclusive odds analysis

   Don't miss another winner! 🏆

7. HASHTAGS:
   Include 10-15 relevant hashtags
   Always include: #GlobalScoreNews #Football
   Add league tags and team tags

ANALYSIS STYLE:
- Be PASSIONATE but professional
- Use strong action words (demolished, stunned, dominated, crushed)
- Include player names when possible
- Reference the odds to add betting context
- Make predictions about what happens next
- Use emojis strategically (not too many)
- Write like a top sports journalist

WORD COUNT: 250-400 words total (excluding hashtags)

OUTPUT FORMAT (JSON only, no markdown):
{
  "post_text": "<complete facebook post with all sections>",
  "hashtags": ["#GlobalScoreNews", "#Football", ...]
}`;

// ============================================
// MASTER INSTRUCTION - SINGLE MATCH (DETAILED)
// ============================================
const MASTER_INSTRUCTION_SINGLE = `You are the HEAD EDITOR of "Global Score News." Create an in-depth, engaging post about this single match.

FORMAT:

1. HEADLINE with emojis (🚨⚽🔥)

2. MATCH INFO:
   ⚽ [Home] [Score] [Away]
   🕐 [Time] | Odds: [Home] | [Draw] | [Away]

3. DETAILED ANALYSIS (80-120 words):
   - What happened in the game
   - Who was the star player
   - Key moments and turning points
   - Tactical observations
   - What this result means
   - Any records broken or milestones

4. QUICK STATS (if available):
   📈 Possession, shots, corners, etc.

5. WHAT'S NEXT:
   - Upcoming fixtures for these teams
   - Table implications

6. TELEGRAM CTA:
   ━━━━━━━━━━━━━━━━━━━━━

   💰 Get FREE betting tips daily!
   👉 Join: https://t.me/+9uDCOJXm_R1hMzM0
   
   ✅ Expert predictions
   ✅ Live alerts
   ✅ High accuracy picks

7. HASHTAGS (8-12)

STYLE: Passionate, analytical, professional
WORD COUNT: 150-200 words

OUTPUT JSON only:
{
  "post_text": "<complete post>",
  "hashtags": ["#GlobalScoreNews", ...]
}`;

// ============================================
// MASTER INSTRUCTION - LIVE MATCHES
// ============================================
const MASTER_INSTRUCTION_LIVE = `You are the HEAD EDITOR of "Global Score News." Create an urgent, exciting LIVE update post.

FORMAT:

1. URGENT HEADLINE:
   🔴 LIVE NOW! [Exciting hook about what's happening]

2. CURRENT SCORES (all live matches):
   ⚽ [Home] [Score] [Away] ⏱️ [Minute]'
   ↳ [What's happening - 15-20 words]

3. KEY ACTION:
   - Goals scored
   - Red cards
   - Penalties
   - Injury drama

4. ODDS UPDATE (if available):
   📊 Live odds shifting!

5. CTA:
   ━━━━━━━━━━━━━━━━━━━━━

   🔔 Get LIVE alerts on Telegram!
   👉 https://t.me/+9uDCOJXm_R1hMzM0
   
   Never miss a goal! ⚽

6. HASHTAGS

STYLE: Urgent, exciting, real-time feel
WORD COUNT: 100-150 words

OUTPUT JSON only:
{
  "post_text": "<complete post>",
  "hashtags": ["#GlobalScoreNews", "#LIVE", ...]
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

function formatTime(timestamp) {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return null;
  }
}

function formatOdds(odds) {
  if (!odds) return null;
  
  const home = odds.home || odds["1"] || odds.homeWin || null;
  const draw = odds.draw || odds["X"] || odds.drawOdds || null;
  const away = odds.away || odds["2"] || odds.awayWin || null;
  
  if (!home && !draw && !away) return null;
  
  return {
    home: home ? parseFloat(home).toFixed(2) : "-",
    draw: draw ? parseFloat(draw).toFixed(2) : "-",
    away: away ? parseFloat(away).toFixed(2) : "-"
  };
}

// ============================================
// HISTORY MANAGEMENT
// ============================================

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadHistory() {
  ensureDataDir();
  if (!existsSync(POSTED_FILE)) {
    return { posts: [], dailyCount: {}, lastPost: null, lastRecap: null, lastLive: null };
  }
  try {
    return JSON.parse(readFileSync(POSTED_FILE, 'utf-8'));
  } catch {
    return { posts: [], dailyCount: {}, lastPost: null, lastRecap: null, lastLive: null };
  }
}

function saveHistory(history) {
  ensureDataDir();
  if (history.posts.length > 300) history.posts = history.posts.slice(-300);
  
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

function getHoursSinceLastLive(history) {
  if (!history.lastLive) return 999;
  return (new Date() - new Date(history.lastLive)) / (1000 * 60 * 60);
}

function createMatchKey(m) {
  const home = m.homeName || m.homeFirstName || m.home_team || "";
  const away = m.awayName || m.awayFirstName || m.away_team || "";
  const date = getTodayDate();
  return `${date}_${home}_${away}`;
}

function wasPosted(history, key) {
  const recentPosts = history.posts.slice(-50);
  return recentPosts.some(p => p.matchKey === key);
}

function recordPost(history, matches, postType) {
  const today = getTodayDate();
  const now = new Date().toISOString();
  
  for (const m of matches) {
    history.posts.push({
      matchKey: createMatchKey(m),
      matchInfo: `${m.home_team || m.homeName} vs ${m.away_team || m.awayName}`,
      postedAt: now,
      postType
    });
  }
  
  history.dailyCount[today] = (history.dailyCount[today] || 0) + 1;
  history.lastPost = now;
  
  if (postType === 'recap') history.lastRecap = now;
  if (postType === 'live') history.lastLive = now;
  
  saveHistory(history);
}

// ============================================
// SHOULD POST NOW (Random timing)
// ============================================

function shouldPostNow(history) {
  const hour = new Date().getUTCHours();
  const count = getTodayCount(history);
  const hoursSince = getHoursSinceLastPost(history);
  
  const seed = parseInt(getTodayDate().replace(/-/g, ''));
  const target = CONFIG.MIN_POSTS_PER_DAY + (seed % (CONFIG.MAX_POSTS_PER_DAY - CONFIG.MIN_POSTS_PER_DAY + 1));
  
  console.log(`\n📊 Post Check:`);
  console.log(`   Posts today: ${count}/${target}`);
  console.log(`   Hours since last: ${hoursSince.toFixed(1)}h`);
  console.log(`   Current hour (UTC): ${hour}`);
  
  if (count >= target) {
    console.log("   ❌ Daily limit reached");
    return false;
  }
  
  if (hoursSince < CONFIG.MIN_HOURS_BETWEEN_POSTS) {
    console.log("   ❌ Too soon since last post");
    return false;
  }
  
  let chance = CONFIG.BASE_POST_CHANCE;
  
  if (CONFIG.QUIET_HOURS.includes(hour)) {
    chance *= 0.3;
    console.log("   🌙 Quiet hour - reduced chance");
  } else if (CONFIG.PEAK_HOURS.includes(hour)) {
    chance *= 1.5;
    console.log("   🔥 Peak hour - increased chance");
  }
  
  // If behind schedule, increase chance
  const expectedByNow = (hour / 24) * target;
  if (count < expectedByNow - 2) {
    chance *= 1.5;
    console.log("   ⚡ Behind schedule - boosted chance");
  }
  
  const roll = Math.random();
  const willPost = roll < chance;
  
  console.log(`   🎲 Chance: ${(chance * 100).toFixed(0)}% | Roll: ${(roll * 100).toFixed(0)}%`);
  console.log(`   ${willPost ? '✅ WILL POST' : '⏭️ SKIPPING'}`);
  
  return willPost;
}

// ============================================
// SPORTDB API
// ============================================

async function fetchMatches() {
  console.log("\n📡 Fetching matches from SportDB...");
  
  let allMatches = [];
  
  // Fetch live matches
  try {
    const res = await fetch("https://api.sportdb.dev/api/flashscore/football/live", {
      headers: { "X-API-Key": SPORTDB_API_KEY }
    });
    
    if (res.ok) {
      const data = await res.json();
      const matches = Array.isArray(data) ? data : (data.matches || data.events || data.data || []);
      allMatches = [...matches];
      console.log(`   📺 ${matches.length} live matches`);
    }
  } catch (e) {
    console.log(`   ⚠️ Live fetch error: ${e.message}`);
  }
  
  // Fetch today's matches
  try {
    const res = await fetch("https://api.sportdb.dev/api/flashscore/football/today", {
      headers: { "X-API-Key": SPORTDB_API_KEY }
    });
    
    if (res.ok) {
      const data = await res.json();
      const matches = Array.isArray(data) ? data : (data.matches || data.events || data.data || []);
      
      // Add non-duplicate matches
      for (const m of matches) {
        const key = `${m.homeName || m.homeFirstName}_${m.awayName || m.awayFirstName}`;
        const exists = allMatches.some(existing =>
          `${existing.homeName || existing.homeFirstName}_${existing.awayName || existing.awayFirstName}` === key
        );
        if (!exists) allMatches.push(m);
      }
      
      console.log(`   📅 ${allMatches.length} total matches`);
    }
  } catch (e) {
    console.log(`   ⚠️ Today fetch error: ${e.message}`);
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
  if (status.includes("1ST") || status.includes("2ND") || status === "LIVE" || status === "1H" || status === "2H") return "LIVE";
  if (["FINISHED", "ENDED", "FT", "AET", "AFTER ET", "AFTER PEN", "FULL TIME"].includes(status)) return "FT";
  if (status.includes("HT") || status === "HALFTIME" || status === "HALF TIME") return "HT";
  if (status.includes("POSTPONED") || status.includes("CANCELLED")) return "CANCELLED";
  return "NS";
}

function transformMatch(raw) {
  const status = getMatchStatus(raw);
  
  // Extract kick-off time
  let kickoffTime = null;
  if (raw.startTime || raw.dateTime || raw.kickoff) {
    kickoffTime = formatTime(raw.startTime || raw.dateTime || raw.kickoff);
  }
  
  // Extract odds
  const odds = formatOdds(raw.odds || raw.preMatchOdds || null);
  
  // Extract minute for live games
  let minute = null;
  if (raw.gameTime && raw.gameTime !== "-1") {
    minute = raw.gameTime;
  } else if (raw.minute) {
    minute = raw.minute;
  }
  
  return {
    competition: raw.leagueName || raw.tournamentName || raw.league || "",
    home_team: raw.homeName || raw.homeFirstName || raw.home || "Unknown",
    away_team: raw.awayName || raw.awayFirstName || raw.away || "Unknown",
    status: status,
    minute: minute,
    kickoff_time: kickoffTime,
    score: {
      home: parseInt(raw.homeScore) || parseInt(raw.homeFullTimeScore) || 0,
      away: parseInt(raw.awayScore) || parseInt(raw.awayFullTimeScore) || 0
    },
    odds: odds,
    raw: raw
  };
}

function categorizeMatches(matches, history) {
  const valid = matches.filter(m =>
    (m.homeName || m.homeFirstName) &&
    (m.awayName || m.awayFirstName)
  );
  
  const transformed = valid.map(transformMatch);
  
  // Categorize by status and league
  const result = {
    liveTop: [],
    liveOther: [],
    finishedTop: [],
    finishedOther: [],
    upcomingTop: [],
    all: transformed
  };
  
  for (const m of transformed) {
    const isTop = isTopLeague(m.competition);
    const wasAlreadyPosted = wasPosted(history, createMatchKey(m));
    
    if (m.status === "LIVE" || m.status === "HT") {
      if (isTop) result.liveTop.push(m);
      else result.liveOther.push(m);
    } else if (m.status === "FT") {
      if (!wasAlreadyPosted) {
        if (isTop) result.finishedTop.push(m);
        else result.finishedOther.push(m);
      }
    } else if (m.status === "NS") {
      if (isTop) result.upcomingTop.push(m);
    }
  }
  
  // Sort by league importance
  const sortByLeague = (a, b) => {
    const aIdx = CONFIG.TOP_LEAGUES.findIndex(l => a.competition.toUpperCase().includes(l));
    const bIdx = CONFIG.TOP_LEAGUES.findIndex(l => b.competition.toUpperCase().includes(l));
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  };
  
  result.liveTop.sort(sortByLeague);
  result.finishedTop.sort(sortByLeague);
  result.upcomingTop.sort(sortByLeague);
  
  return result;
}

function groupByLeague(matches) {
  const groups = {};
  for (const m of matches) {
    const league = m.competition || "Other Leagues";
    if (!groups[league]) groups[league] = [];
    groups[league].push(m);
  }
  return groups;
}

// ============================================
// POST TYPE DECISION
// ============================================

function decidePostType(categorized, history) {
  const hoursSinceRecap = getHoursSinceLastRecap(history);
  const hoursSinceLive = getHoursSinceLastLive(history);
  
  const liveCount = categorized.liveTop.length;
  const finishedCount = categorized.finishedTop.length;
  
  console.log(`\n🎯 Post Type Decision:`);
  console.log(`   Live top matches: ${liveCount}`);
  console.log(`   Finished top matches: ${finishedCount}`);
  console.log(`   Hours since recap: ${hoursSinceRecap.toFixed(1)}`);
  console.log(`   Hours since live: ${hoursSinceLive.toFixed(1)}`);
  
  // Priority 1: Live matches update (if 3+ live top games and been a while)
  if (liveCount >= 3 && hoursSinceLive >= 1) {
    console.log("   → LIVE UPDATE");
    return { type: "live", matches: categorized.liveTop.slice(0, 6) };
  }
  
  // Priority 2: Recap of finished matches (if enough games and been 3+ hours)
  if (finishedCount >= CONFIG.MIN_MATCHES_FOR_RECAP && hoursSinceRecap >= 3) {
    console.log("   → MULTI-MATCH RECAP");
    return { type: "recap", matches: categorized.finishedTop.slice(0, CONFIG.MAX_MATCHES_FOR_RECAP) };
  }
  
  // Priority 3: Single finished match
  if (finishedCount >= 1) {
    const match = categorized.finishedTop[getRandomInt(0, Math.min(2, finishedCount - 1))];
    console.log("   → SINGLE MATCH");
    return { type: "single", matches: [match] };
  }
  
  // Priority 4: Live single match
  if (liveCount >= 1) {
    console.log("   → SINGLE LIVE");
    return { type: "live_single", matches: [categorized.liveTop[0]] };
  }
  
  // Priority 5: Include non-top league finished matches
  if (categorized.finishedOther.length >= 1) {
    const match = categorized.finishedOther[0];
    console.log("   → OTHER LEAGUE MATCH");
    return { type: "single", matches: [match] };
  }
  
  console.log("   → NO CONTENT");
  return null;
}

// ============================================
// GROQ API
// ============================================

async function generatePost(postType, matches) {
  console.log(`\n🤖 Generating ${postType} post...`);
  
  let instruction;
  let matchData = "";
  
  // Build match data string
  const grouped = groupByLeague(matches);
  
  for (const [league, games] of Object.entries(grouped)) {
    matchData += `\n📊 ${league.toUpperCase()}\n`;
    
    for (const g of games) {
      // Result emoji
      let emoji = "🤝";
      if (g.score.home > g.score.away) emoji = "✅";
      else if (g.score.home < g.score.away) emoji = "❌";
      if (g.score.home + g.score.away >= 4) emoji = "🔥";
      if (g.score.home + g.score.away >= 6) emoji = "💥";
      
      matchData += `\n⚽ ${g.home_team} ${g.score.home}-${g.score.away} ${g.away_team} ${emoji}\n`;
      
      if (g.kickoff_time) {
        matchData += `🕐 Time: ${g.kickoff_time}\n`;
      }
      
      if (g.odds) {
        matchData += `📊 Odds: ${g.odds.home} | ${g.odds.draw} | ${g.odds.away}\n`;
      }
      
      if (g.minute && (g.status === "LIVE" || g.status === "HT")) {
        matchData += `⏱️ Minute: ${g.minute}'\n`;
      }
      
      matchData += `Status: ${g.status}\n`;
    }
  }
  
  // Choose instruction based on post type
  switch (postType) {
    case "live":
      instruction = MASTER_INSTRUCTION_LIVE;
      break;
    case "recap":
      instruction = MASTER_INSTRUCTION_MULTI;
      break;
    case "single":
    case "live_single":
    default:
      instruction = MASTER_INSTRUCTION_SINGLE;
  }
  
  const prompt = `${instruction}

━━━━━━━━━━━━━━━━━━━━━
MATCH DATA:
━━━━━━━━━━━━━━━━━━━━━
${matchData}
━━━━━━━━━━━━━━━━━━━━━

Generate the post now. Return ONLY valid JSON, no markdown code blocks.`;

  return await callGroq(prompt);
}

async function callGroq(prompt) {
  const models = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768"
  ];
  
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
            {
              role: "system",
              content: "You are an elite sports journalist and social media expert. Create engaging, viral content. Always respond with valid JSON only - no markdown, no code blocks, no extra text."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.85,
          max_tokens: 2000
        })
      });
      
      if (res.status === 429) {
        console.log("   ⚠️ Rate limited, waiting 5s...");
        await delay(5000);
        continue;
      }
      
      if (!res.ok) {
        console.log(`   ❌ API error: ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      let text = data?.choices?.[0]?.message?.content || "";
      
      if (!text) {
        console.log("   ⚠️ Empty response");
        continue;
      }
      
      // Clean JSON
      text = text.trim();
      
      // Remove markdown code blocks
      if (text.startsWith("```json")) {
        text = text.slice(7);
      } else if (text.startsWith("```")) {
        text = text.slice(3);
      }
      if (text.endsWith("```")) {
        text = text.slice(0, -3);
      }
      text = text.trim();
      
      // Find JSON object
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        text = text.slice(start, end + 1);
      }
      
      const parsed = JSON.parse(text);
      console.log("   ✅ Generated successfully");
      return parsed;
      
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
      continue;
    }
  }
  
  throw new Error("All Groq models failed");
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
    throw new Error(`Facebook API error ${res.status}: ${err}`);
  }
  
  const data = await res.json();
  console.log("   ✅ Posted successfully");
  return data;
}

// ============================================
// BUILD FINAL MESSAGE
// ============================================

function buildMessage(response) {
  let message = response.post_text || "";
  
  // Add hashtags if not already included
  if (response.hashtags && response.hashtags.length > 0) {
    const hashtagsInPost = message.includes("#GlobalScoreNews");
    if (!hashtagsInPost) {
      message += "\n\n" + response.hashtags.join(" ");
    }
  }
  
  // Ensure Telegram link is correct
  if (!message.includes("t.me/+9uDCOJXm_R1hMzM0")) {
    message = message.replace(/t\.me\/\+\w+/g, "t.me/+9uDCOJXm_R1hMzM0");
  }
  
  return message.trim();
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("═".repeat(50));
  console.log("🚀 GLOBAL SCORE NEWS v4.0");
  console.log("═".repeat(50));
  console.log(`⏰ ${new Date().toISOString()}`);
  
  assertEnv();
  
  const history = loadHistory();
  
  // Check if we should post
  if (!FORCE_POST && !shouldPostNow(history)) {
    console.log("\n👋 Skipping this run. See you next time!");
    return;
  }
  
  if (FORCE_POST) {
    console.log("\n⚡ FORCE POST MODE ACTIVATED");
  }
  
  // Fetch matches
  const allMatches = await fetchMatches();
  
  if (!allMatches || allMatches.length === 0) {
    console.log("\n⚠️ No matches available. Exiting.");
    return;
  }
  
  // Categorize matches
  const categorized = categorizeMatches(allMatches, history);
  
  console.log(`\n📊 Match Summary:`);
  console.log(`   🔴 Live (top leagues): ${categorized.liveTop.length}`);
  console.log(`   ✅ Finished (top leagues): ${categorized.finishedTop.length}`);
  console.log(`   📅 Upcoming (top leagues): ${categorized.upcomingTop.length}`);
  
  // Decide what to post
  const decision = decidePostType(categorized, history);
  
  if (!decision) {
    console.log("\n⚠️ No suitable content to post. Exiting.");
    return;
  }
  
  // Log selected matches
  console.log(`\n📋 Selected ${decision.matches.length} match(es):`);
  for (const m of decision.matches) {
    console.log(`   • ${m.home_team} ${m.score.home}-${m.score.away} ${m.away_team}`);
    console.log(`     ${m.competition} | ${m.status}`);
    if (m.odds) console.log(`     Odds: ${m.odds.home} | ${m.odds.draw} | ${m.odds.away}`);
  }
  
  // Generate post
  const response = await generatePost(decision.type, decision.matches);
  
  // Build final message
  const message = buildMessage(response);
  
  // Preview
  console.log("\n" + "═".repeat(50));
  console.log("📝 POST PREVIEW:");
  console.log("═".repeat(50));
  console.log(message);
  console.log("═".repeat(50));
  console.log(`📏 Length: ${message.length} characters`);
  
  // Post to Facebook
  const result = await postToFacebook(message);
  
  // Record post
  recordPost(history, decision.matches, decision.type);
  
  console.log(`\n✅ SUCCESS!`);
  console.log(`   Post ID: ${result.id}`);
  console.log(`   Type: ${decision.type}`);
  console.log(`   Matches: ${decision.matches.length}`);
  console.log(`   Today's total: ${getTodayCount(history)} posts`);
}

// Run
main().catch((e) => {
  console.error("\n❌ FATAL ERROR:", e.message);
  process.exit(1);
});
