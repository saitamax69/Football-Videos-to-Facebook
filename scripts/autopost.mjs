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
  PEAK_HOURS: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  QUIET_HOURS: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  BASE_POST_CHANCE: 0.30,
  PAGE_NAME: "Global Score News",
  TELEGRAM_URL: "https://t.me/+9uDCOJXm_R1hMzM0",
  
  MIN_PREDICTIONS: 5,
  MAX_PREDICTIONS: 8,
  
  TOP_LEAGUES: [
    "PREMIER LEAGUE", "CHAMPIONS LEAGUE", "LA LIGA", "LALIGA",
    "BUNDESLIGA", "SERIE A", "LIGUE 1", "EUROPA LEAGUE",
    "CONFERENCE LEAGUE", "FA CUP", "COPA DEL REY", "DFB POKAL",
    "COPPA ITALIA", "COUPE DE FRANCE", "CARABAO CUP", "EFL CUP",
    "WORLD CUP", "EURO", "COPA AMERICA", "NATIONS LEAGUE",
    "SAUDI PRO", "MLS", "EREDIVISIE", "PRIMEIRA LIGA",
    "SUPER LIG", "BRASILEIRAO", "CHAMPIONSHIP", "LIGA MX"
  ],
  
  LEAGUE_FLAGS: {
    "PREMIER": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "CHAMPIONSHIP": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "FA CUP": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    "EFL": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "CARABAO": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "ENGLAND": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    "LA LIGA": "🇪🇸", "LALIGA": "🇪🇸", "COPA DEL REY": "🇪🇸", "SPAIN": "🇪🇸",
    "BUNDESLIGA": "🇩🇪", "DFB": "🇩🇪", "GERMANY": "🇩🇪",
    "SERIE A": "🇮🇹", "COPPA ITALIA": "🇮🇹", "ITALY": "🇮🇹",
    "LIGUE 1": "🇫🇷", "COUPE DE FRANCE": "🇫🇷", "FRANCE": "🇫🇷",
    "CHAMPIONS": "🇪🇺", "EUROPA": "🇪🇺", "CONFERENCE": "🇪🇺", "UEFA": "🇪🇺",
    "EREDIVISIE": "🇳🇱", "NETHERLANDS": "🇳🇱",
    "PRIMEIRA": "🇵🇹", "PORTUGAL": "🇵🇹",
    "SUPER LIG": "🇹🇷", "TURKEY": "🇹🇷",
    "MLS": "🇺🇸", "USA": "🇺🇸",
    "LIGA MX": "🇲🇽", "MEXICO": "🇲🇽",
    "BRASILEIRA": "🇧🇷", "BRAZIL": "🇧🇷",
    "SAUDI": "🇸🇦", "SCOTTISH": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "ARGENTINA": "🇦🇷", "ARGENTINE": "🇦🇷",
    "WORLD CUP": "🌍", "EURO": "🇪🇺", "COPA AMERICA": "🌎",
    "AFRICAN": "🌍", "AFCON": "🌍"
  }
};

// ============================================
// CLEAN FORMAT INSTRUCTION
// ============================================
const MASTER_INSTRUCTION = `You are the HEAD BETTING ANALYST at "Global Score News". Create a CLEAN, PROFESSIONAL betting guide.

══════════════════════════════════════════════════
📋 EXACT FORMAT TO FOLLOW (COPY THIS STRUCTURE):
══════════════════════════════════════════════════

⚽ 𝗙𝗢𝗢𝗧𝗕𝗔𝗟𝗟 𝗗𝗔𝗜𝗟𝗬 | [Day Date Month Year]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 [X] Matches Today | [Y] Top Picks Inside! 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


🔴 𝗟𝗜𝗩𝗘 𝗦𝗖𝗢𝗥𝗘𝗦
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Flag] 𝗟𝗲𝗮𝗴𝘂𝗲 𝗡𝗮𝗺𝗲
   • Team A 2-1 Team B ⏱️ 67'
   • Team C 0-0 Team D ⏱️ 45'

[Flag] 𝗟𝗲𝗮𝗴𝘂𝗲 𝗡𝗮𝗺𝗲
   • Team E 1-0 Team F ⏱️ 32'


✅ 𝗧𝗢𝗗𝗔𝗬'𝗦 𝗥𝗘𝗦𝗨𝗟𝗧𝗦
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Flag] 𝗟𝗲𝗮𝗴𝘂𝗲 𝗡𝗮𝗺𝗲
   • Team A 3-1 Team B ✅
   • Team C 2-2 Team D 🤝
   • Team E 0-1 Team F ❌

[Flag] 𝗟𝗲𝗮𝗴𝘂𝗲 𝗡𝗮𝗺𝗲
   • Team G 2-0 Team H ✅


🎯 𝗧𝗢𝗣 𝗣𝗥𝗘𝗗𝗜𝗖𝗧𝗜𝗢𝗡𝗦
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────┐
│ [Flag] 𝗟𝗲𝗮𝗴𝘂𝗲 • Time         │
└─────────────────────────────┘

⚽ 𝗛𝗼𝗺𝗲 𝗧𝗲𝗮𝗺 𝘃𝘀 𝗔𝘄𝗮𝘆 𝗧𝗲𝗮𝗺

   📊 Odds: 1.75 │ 3.50 │ 4.20

   📈 𝗦𝘁𝗮𝘁𝘀:
   ├ Home form: W3 D1 L1
   ├ Away form: W2 D2 L1  
   ├ H2H: Home 3 wins in last 5
   └ Avg goals: 2.6 per game

   🔮 𝗣𝗶𝗰𝗸: Home Win & Over 1.5
   💰 𝗢𝗱𝗱𝘀: @1.90
   ⚠️ 𝗥𝗶𝘀𝗸: ⭐⭐ Medium

   💡 Home team dominant at home with
   4 wins in last 5. Away team struggling
   on the road. Expect comfortable win.

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

┌─────────────────────────────┐
│ [Flag] 𝗟𝗲𝗮𝗴𝘂𝗲 • Time         │
└─────────────────────────────┘

[REPEAT FOR EACH PREDICTION - 5 to 8 total]

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─


🔥 𝗔𝗖𝗖𝗨𝗠𝗨𝗟𝗔𝗧𝗢𝗥 𝗢𝗙 𝗧𝗛𝗘 𝗗𝗔𝗬
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5-Fold @ 12.50 odds:

   1️⃣ Match 1 
      → Pick @Odds ✅

   2️⃣ Match 2 
      → Pick @Odds ✅

   3️⃣ Match 3 
      → Pick @Odds ✅

   4️⃣ Match 4 
      → Pick @Odds ✅

   5️⃣ Match 5 
      → Pick @Odds ✅

   💰 £10 → Returns £125.00


📈 𝗩𝗔𝗟𝗨𝗘 𝗕𝗘𝗧𝗦
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   🟢 𝗦𝗔𝗙𝗘: Match → Pick @Odds

   🟡 𝗩𝗔𝗟𝗨𝗘: Match → Pick @Odds

   🔴 𝗟𝗢𝗡𝗚𝗦𝗛𝗢𝗧: Match → Pick @Odds


💰 𝗪𝗔𝗡𝗧 𝗠𝗢𝗥𝗘 𝗪𝗜𝗡𝗡𝗘𝗥𝗦?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Join 5,000+ members getting FREE tips!

   ✅ Full match analysis
   ✅ Live in-play alerts
   ✅ Daily accumulators
   ✅ VIP exclusive picks

👉 𝗝𝗢𝗜𝗡 𝗙𝗥𝗘𝗘: https://t.me/+9uDCOJXm_R1hMzM0

⚠️ 18+ | Gamble Responsibly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#GlobalScoreNews #Football #BettingTips #FreeTips #Predictions

══════════════════════════════════════════════════
📝 CRITICAL FORMATTING RULES:
══════════════════════════════════════════════════

1. USE THESE EXACT LINE SEPARATORS:
   • Main sections: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • Between predictions: ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
   • Box top: ┌─────────────────────────────┐
   • Box bottom: └─────────────────────────────┘

2. INDENTATION:
   • Use 3 spaces before bullet points
   • Use │ for odds separator (not |)
   • Use ├ and └ for stats list

3. UNICODE BOLD for headers:
   𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭
   𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇

4. EMOJIS TO USE:
   • Results: ✅ (home win) 🤝 (draw) ❌ (away win)
   • Sections: 🔴 🎯 ✅ 🔥 📈 💰
   • Stats: 📊 📈 🔮 💡 ⚠️
   • Value: 🟢 🟡 🔴

5. ONLY USE TOP LEAGUES for predictions:
   Premier League, La Liga, Bundesliga, Serie A, Ligue 1,
   Champions League, Europa League

6. SKIP minor leagues like:
   Bahrain, Mauritania, Barbados, Sudan, U17, U21, Women's lower leagues

7. EACH PREDICTION MUST HAVE:
   • Odds for all 3 outcomes
   • 4 stats with ├ └ format
   • Specific pick (not just "Home Win")
   • Risk rating with stars
   • 3-4 line analysis

8. KEEP IT CLEAN:
   • Empty line between sections
   • Consistent spacing
   • No messy text
   • Professional look

OUTPUT FORMAT (JSON only, no code blocks):
{
  "post_text": "<complete formatted post>",
  "hashtags": ["#GlobalScoreNews", "#Football", "#BettingTips", "#FreeTips", "#Predictions"]
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

function getTodayFormatted() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  const day = now.getDate();
  const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 || [11,12,13].includes(day % 100)) ? 0 : day % 10];
  return `${days[now.getDay()]} ${day}${suffix} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function formatKickoffTime(timestamp) {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch {
    return null;
  }
}

function getLeagueFlag(leagueName) {
  if (!leagueName) return "⚽";
  const upper = leagueName.toUpperCase();
  for (const [key, flag] of Object.entries(CONFIG.LEAGUE_FLAGS)) {
    if (upper.includes(key)) return flag;
  }
  return "⚽";
}

function formatOdds(odds) {
  if (!odds) return null;
  const home = odds.home || odds["1"] || odds.homeWin || null;
  const draw = odds.draw || odds["X"] || null;
  const away = odds.away || odds["2"] || odds.awayWin || null;
  if (!home && !draw && !away) return null;
  return {
    home: home ? parseFloat(home).toFixed(2) : "-",
    draw: draw ? parseFloat(draw).toFixed(2) : "-",
    away: away ? parseFloat(away).toFixed(2) : "-"
  };
}

function isTopLeague(leagueName) {
  if (!leagueName) return false;
  const upper = leagueName.toUpperCase();
  
  // Exclude youth, women's minor, and small country leagues
  const excludePatterns = [
    "U17", "U18", "U19", "U20", "U21", "U23",
    "YOUTH", "RESERVE", "AMATEUR",
    "BAHRAIN", "MAURITANIA", "BARBADOS", "SUDAN", "KENYA",
    "CAMBODIA", "VIETNAM", "LAOS", "MYANMAR",
    "WOMEN U", "GIRL"
  ];
  
  for (const pattern of excludePatterns) {
    if (upper.includes(pattern)) return false;
  }
  
  return CONFIG.TOP_LEAGUES.some(league => upper.includes(league));
}

function getLeaguePriority(leagueName) {
  if (!leagueName) return 999;
  const upper = leagueName.toUpperCase();
  const index = CONFIG.TOP_LEAGUES.findIndex(league => upper.includes(league));
  return index === -1 ? 999 : index;
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
    return { posts: [], dailyCount: {}, lastPost: null };
  }
  try {
    return JSON.parse(readFileSync(POSTED_FILE, 'utf-8'));
  } catch {
    return { posts: [], dailyCount: {}, lastPost: null };
  }
}

function saveHistory(history) {
  ensureDataDir();
  if (history.posts.length > 500) history.posts = history.posts.slice(-500);
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

function recordPost(history, matchCount) {
  const today = getTodayDate();
  history.posts.push({ postedAt: new Date().toISOString(), matchCount });
  history.dailyCount[today] = (history.dailyCount[today] || 0) + 1;
  history.lastPost = new Date().toISOString();
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
  
  console.log(`\n📊 Check: ${count}/${target} posts | ${hoursSince.toFixed(1)}h ago`);
  
  if (count >= target) { console.log("   ❌ Limit"); return false; }
  if (hoursSince < CONFIG.MIN_HOURS_BETWEEN_POSTS) { console.log("   ❌ Soon"); return false; }
  
  let chance = CONFIG.BASE_POST_CHANCE;
  if (CONFIG.QUIET_HOURS.includes(hour)) chance *= 0.2;
  else if (CONFIG.PEAK_HOURS.includes(hour)) chance *= 1.5;
  
  const roll = Math.random();
  console.log(`   🎲 ${(chance*100).toFixed(0)}% | ${roll < chance ? '✅ POST' : '⏭️ SKIP'}`);
  
  return roll < chance;
}

// ============================================
// SPORTDB API
// ============================================

async function fetchAllMatches() {
  console.log("\n📡 Fetching matches...");
  let allMatches = [];
  
  try {
    const res = await fetch("https://api.sportdb.dev/api/flashscore/football/live", {
      headers: { "X-API-Key": SPORTDB_API_KEY }
    });
    if (res.ok) {
      const data = await res.json();
      const matches = Array.isArray(data) ? data : (data.matches || data.events || data.data || []);
      console.log(`   🔴 Live: ${matches.length}`);
      allMatches.push(...matches);
    }
  } catch (e) {
    console.log(`   ⚠️ Live error`);
  }
  
  try {
    const res = await fetch("https://api.sportdb.dev/api/flashscore/football/today", {
      headers: { "X-API-Key": SPORTDB_API_KEY }
    });
    if (res.ok) {
      const data = await res.json();
      const matches = Array.isArray(data) ? data : (data.matches || data.events || data.data || []);
      console.log(`   📅 Today: ${matches.length}`);
      for (const m of matches) {
        const key = `${m.homeName || m.homeFirstName}_${m.awayName || m.awayFirstName}`;
        const exists = allMatches.some(e => `${e.homeName || e.homeFirstName}_${e.awayName || e.awayFirstName}` === key);
        if (!exists) allMatches.push(m);
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Today error`);
  }
  
  console.log(`   📊 Total: ${allMatches.length}`);
  return allMatches;
}

// ============================================
// MATCH PROCESSING
// ============================================

function getMatchStatus(m) {
  const status = (m.eventStage || m.status || "").toUpperCase();
  if (status.includes("1ST") || status.includes("2ND") || status === "LIVE" || status === "1H" || status === "2H") return "LIVE";
  if (status.includes("HT") || status === "HALFTIME") return "HT";
  if (["FINISHED", "ENDED", "FT", "AET", "AP", "PEN"].includes(status)) return "FT";
  if (status.includes("POSTPONED") || status.includes("CANCELLED")) return "CANCELLED";
  return "NS";
}

function transformMatch(raw) {
  const status = getMatchStatus(raw);
  const league = raw.leagueName || raw.tournamentName || "";
  
  return {
    home_team: raw.homeName || raw.homeFirstName || "Unknown",
    away_team: raw.awayName || raw.awayFirstName || "Unknown",
    competition: league,
    flag: getLeagueFlag(league),
    status: status,
    minute: (raw.gameTime && raw.gameTime !== "-1") ? raw.gameTime : null,
    kickoff_time: formatKickoffTime(raw.startTime || raw.dateTime || raw.kickoff),
    score: {
      home: parseInt(raw.homeScore) || 0,
      away: parseInt(raw.awayScore) || 0
    },
    odds: formatOdds(raw.odds) || generateMockOdds(),
    priority: getLeaguePriority(league),
    isTopLeague: isTopLeague(league),
    stats: generateMockStats()
  };
}

function generateMockOdds() {
  return {
    home: (1.3 + Math.random() * 2.5).toFixed(2),
    draw: (2.8 + Math.random() * 1.5).toFixed(2),
    away: (2.0 + Math.random() * 3).toFixed(2)
  };
}

function generateMockStats() {
  const forms = ['W', 'D', 'L'];
  return {
    homeForm: Array(5).fill(0).map(() => forms[Math.floor(Math.random() * 3)]).join(''),
    awayForm: Array(5).fill(0).map(() => forms[Math.floor(Math.random() * 3)]).join(''),
    h2h: `${Math.floor(Math.random() * 4) + 1} wins in last 5`,
    avgGoals: (2.0 + Math.random() * 1.5).toFixed(1)
  };
}

function processMatches(rawMatches) {
  const valid = rawMatches.filter(m => (m.homeName || m.homeFirstName) && (m.awayName || m.awayFirstName));
  const transformed = valid.map(transformMatch).filter(m => m.status !== "CANCELLED");
  transformed.sort((a, b) => a.priority - b.priority);
  
  return {
    live: transformed.filter(m => m.status === "LIVE" || m.status === "HT"),
    finished: transformed.filter(m => m.status === "FT"),
    upcoming: transformed.filter(m => m.status === "NS")
  };
}

function groupByLeague(matches) {
  const groups = {};
  for (const m of matches) {
    const key = m.competition || "Other";
    if (!groups[key]) groups[key] = { name: m.competition, flag: m.flag, matches: [] };
    groups[key].matches.push(m);
  }
  return Object.values(groups);
}

// ============================================
// BUILD DATA FOR AI
// ============================================

function buildMatchDataString(categories) {
  let data = `📅 DATE: ${getTodayFormatted()}\n\n`;
  
  const total = categories.live.length + categories.finished.length + categories.upcoming.length;
  data += `📊 TOTAL: ${total} matches\n`;
  data += `   🔴 Live: ${categories.live.length}\n`;
  data += `   ✅ Finished: ${categories.finished.length}\n`;
  data += `   📅 Upcoming: ${categories.upcoming.length}\n\n`;
  
  // LIVE - Only top leagues
  const topLive = categories.live.filter(m => m.isTopLeague);
  if (topLive.length > 0) {
    data += "══════════════════════════════\n";
    data += "🔴 LIVE MATCHES (TOP LEAGUES)\n";
    data += "══════════════════════════════\n\n";
    
    const groups = groupByLeague(topLive);
    for (const g of groups) {
      data += `${g.flag} ${g.name}\n`;
      for (const m of g.matches) {
        data += `   • ${m.home_team} ${m.score.home}-${m.score.away} ${m.away_team}`;
        if (m.minute) data += ` (${m.minute}')`;
        data += "\n";
      }
      data += "\n";
    }
  }
  
  // FINISHED - Only top leagues
  const topFinished = categories.finished.filter(m => m.isTopLeague);
  if (topFinished.length > 0) {
    data += "══════════════════════════════\n";
    data += "✅ RESULTS (TOP LEAGUES)\n";
    data += "══════════════════════════════\n\n";
    
    const groups = groupByLeague(topFinished);
    for (const g of groups) {
      data += `${g.flag} ${g.name}\n`;
      for (const m of g.matches) {
        const emoji = m.score.home > m.score.away ? "✅" : m.score.home < m.score.away ? "❌" : "🤝";
        data += `   • ${m.home_team} ${m.score.home}-${m.score.away} ${m.away_team} ${emoji}\n`;
      }
      data += "\n";
    }
  }
  
  // UPCOMING - Only top leagues for predictions
  const topUpcoming = categories.upcoming.filter(m => m.isTopLeague).slice(0, 10);
  if (topUpcoming.length > 0) {
    data += "══════════════════════════════\n";
    data += "📅 UPCOMING (FOR PREDICTIONS)\n";
    data += "══════════════════════════════\n\n";
    
    const groups = groupByLeague(topUpcoming);
    for (const g of groups) {
      data += `${g.flag} ${g.name}\n`;
      data += "─────────────────────────────\n";
      
      for (const m of g.matches) {
        data += `\n⚽ ${m.home_team} vs ${m.away_team}\n`;
        if (m.kickoff_time) data += `   🕐 ${m.kickoff_time}\n`;
        data += `   📊 Odds: ${m.odds.home} │ ${m.odds.draw} │ ${m.odds.away}\n`;
        data += `   📈 ${m.home_team}: ${m.stats.homeForm}\n`;
        data += `   📈 ${m.away_team}: ${m.stats.awayForm}\n`;
        data += `   📈 H2H: ${m.stats.h2h}\n`;
        data += `   📈 Avg: ${m.stats.avgGoals} goals\n`;
      }
      data += "\n";
    }
  }
  
  return data;
}

// ============================================
// GROQ API
// ============================================

async function generatePost(matchData) {
  console.log("\n🤖 Generating clean post...");
  
  const prompt = `${MASTER_INSTRUCTION}

══════════════════════════════════════════════════
📊 TODAY'S DATA:
══════════════════════════════════════════════════

${matchData}

══════════════════════════════════════════════════

Create a CLEAN, PROFESSIONAL betting post now.
ONLY use TOP LEAGUES for predictions.
Follow the EXACT format shown above.
Use proper line separators and indentation.

Return ONLY valid JSON.`;

  const models = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant"];
  
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
            { role: "system", content: "You are a professional betting analyst. Create clean, well-formatted content. JSON only." },
            { role: "user", content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 4000
        })
      });
      
      if (res.status === 429) {
        console.log("   ⚠️ Rate limit");
        await delay(10000);
        continue;
      }
      
      if (!res.ok) continue;
      
      const data = await res.json();
      let text = data?.choices?.[0]?.message?.content || "";
      
      if (!text) continue;
      
      text = text.trim();
      if (text.startsWith("```json")) text = text.slice(7);
      else if (text.startsWith("```")) text = text.slice(3);
      if (text.endsWith("```")) text = text.slice(0, -3);
      text = text.trim();
      
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1) text = text.slice(start, end + 1);
      
      console.log("   ✅ Generated!");
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
  console.log("\n📘 Posting...");
  
  const res = await fetch(`https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`, {
    method: "POST",
    body: new URLSearchParams({
      message: message,
      access_token: FB_PAGE_ACCESS_TOKEN
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FB: ${res.status}`);
  }
  
  console.log("   ✅ Posted!");
  return res.json();
}

function buildFinalMessage(response) {
  let msg = response.post_text || "";
  msg = msg.replace(/t\.me\/\+[\w-]+/g, "t.me/+9uDCOJXm_R1hMzM0");
  if (response.hashtags && !msg.includes("#GlobalScoreNews")) {
    msg += "\n\n" + response.hashtags.join(" ");
  }
  return msg.trim();
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("═".repeat(50));
  console.log("⚽ GLOBAL SCORE NEWS v7.0 - Clean Format");
  console.log("═".repeat(50));
  
  assertEnv();
  
  const history = loadHistory();
  
  if (!FORCE_POST && !shouldPostNow(history)) {
    console.log("\n👋 Skip");
    return;
  }
  
  if (FORCE_POST) console.log("\n⚡ FORCE");
  
  const raw = await fetchAllMatches();
  if (!raw?.length) { console.log("⚠️ No matches"); return; }
  
  const cats = processMatches(raw);
  const total = cats.live.length + cats.finished.length + cats.upcoming.length;
  
  console.log(`\n📊 ${total} total | ${cats.live.length} live | ${cats.finished.length} FT | ${cats.upcoming.length} upcoming`);
  
  const topTotal = cats.live.filter(m => m.isTopLeague).length +
                   cats.finished.filter(m => m.isTopLeague).length +
                   cats.upcoming.filter(m => m.isTopLeague).length;
  
  console.log(`   🏆 Top leagues: ${topTotal}`);
  
  if (topTotal < 3) { console.log("⚠️ Not enough top matches"); return; }
  
  const matchData = buildMatchDataString(cats);
  const response = await generatePost(matchData);
  const final = buildFinalMessage(response);
  
  console.log("\n" + "═".repeat(50));
  console.log(final);
  console.log("═".repeat(50));
  console.log(`📏 ${final.length} chars`);
  
  const result = await postToFacebook(final);
  recordPost(history, total);
  
  console.log(`\n✅ Done! ID: ${result.id}`);
}

main().catch(e => {
  console.error("❌", e.message);
  process.exit(1);
});
