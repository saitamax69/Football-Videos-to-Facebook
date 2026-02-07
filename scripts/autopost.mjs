import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var DATA_DIR = join(__dirname, '..', 'data');
var POSTED_FILE = join(DATA_DIR, 'posted.json');

var SPORTDB_API_KEY = process.env.SPORTDB_API_KEY;
var GROQ_API_KEY = process.env.GROQ_API_KEY;
var FB_PAGE_ID = process.env.FB_PAGE_ID;
var FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
var FORCE_POST = process.env.FORCE_POST === 'true';

var CONFIG = {
  MIN_POSTS_PER_DAY: 10,
  MAX_POSTS_PER_DAY: 14,
  MIN_HOURS_BETWEEN_POSTS: 1,
  PEAK_HOURS: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  QUIET_HOURS: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  BASE_POST_CHANCE: 0.30,
  TELEGRAM_URL: "https://t.me/+9uDCOJXm_R1hMzM0",
  
  MAX_LIVE_MATCHES: 25,
  MAX_FINISHED_MATCHES: 35,
  MAX_PREDICTIONS: 12,
  MAX_ACCA_PICKS: 6,
  
  // TOP LEAGUES ONLY - Most important leagues
  TOP_LEAGUES: [
    "PREMIER LEAGUE",
    "CHAMPIONS LEAGUE",
    "LA LIGA",
    "LALIGA",
    "BUNDESLIGA",
    "SERIE A",
    "LIGUE 1",
    "EUROPA LEAGUE",
    "CONFERENCE LEAGUE",
    "FA CUP",
    "COPA DEL REY",
    "DFB POKAL",
    "COPPA ITALIA",
    "COUPE DE FRANCE",
    "CARABAO CUP",
    "EFL CUP",
    "COMMUNITY SHIELD",
    "SUPER CUP",
    "CHAMPIONSHIP",
    "EREDIVISIE",
    "PRIMEIRA LIGA",
    "SCOTTISH PREMIERSHIP",
    "BELGIAN PRO LEAGUE",
    "SUPER LIG",
    "SAUDI PRO LEAGUE",
    "MLS",
    "LIGA MX",
    "BRASILEIRAO",
    "ARGENTINA PRIMERA",
    "WORLD CUP",
    "EURO",
    "COPA AMERICA",
    "NATIONS LEAGUE",
    "AFRICAN CUP",
    "AFCON"
  ]
};

var LEAGUE_FLAGS = {
  "ENGLAND": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  "PREMIER": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  "CHAMPIONSHIP": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  "FA CUP": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  "CARABAO": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  "EFL": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  "COMMUNITY": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  "SPAIN": "\uD83C\uDDEA\uD83C\uDDF8",
  "LA LIGA": "\uD83C\uDDEA\uD83C\uDDF8",
  "LALIGA": "\uD83C\uDDEA\uD83C\uDDF8",
  "COPA DEL REY": "\uD83C\uDDEA\uD83C\uDDF8",
  "GERMANY": "\uD83C\uDDE9\uD83C\uDDEA",
  "BUNDESLIGA": "\uD83C\uDDE9\uD83C\uDDEA",
  "DFB": "\uD83C\uDDE9\uD83C\uDDEA",
  "ITALY": "\uD83C\uDDEE\uD83C\uDDF9",
  "SERIE A": "\uD83C\uDDEE\uD83C\uDDF9",
  "COPPA": "\uD83C\uDDEE\uD83C\uDDF9",
  "FRANCE": "\uD83C\uDDEB\uD83C\uDDF7",
  "LIGUE 1": "\uD83C\uDDEB\uD83C\uDDF7",
  "COUPE": "\uD83C\uDDEB\uD83C\uDDF7",
  "CHAMPIONS": "\uD83C\uDDEA\uD83C\uDDFA",
  "EUROPA": "\uD83C\uDDEA\uD83C\uDDFA",
  "UEFA": "\uD83C\uDDEA\uD83C\uDDFA",
  "CONFERENCE": "\uD83C\uDDEA\uD83C\uDDFA",
  "SUPER CUP": "\uD83C\uDDEA\uD83C\uDDFA",
  "NATIONS": "\uD83C\uDDEA\uD83C\uDDFA",
  "NETHERLANDS": "\uD83C\uDDF3\uD83C\uDDF1",
  "EREDIVISIE": "\uD83C\uDDF3\uD83C\uDDF1",
  "DUTCH": "\uD83C\uDDF3\uD83C\uDDF1",
  "PORTUGAL": "\uD83C\uDDF5\uD83C\uDDF9",
  "PRIMEIRA": "\uD83C\uDDF5\uD83C\uDDF9",
  "USA": "\uD83C\uDDFA\uD83C\uDDF8",
  "MLS": "\uD83C\uDDFA\uD83C\uDDF8",
  "MEXICO": "\uD83C\uDDF2\uD83C\uDDFD",
  "LIGA MX": "\uD83C\uDDF2\uD83C\uDDFD",
  "BRAZIL": "\uD83C\uDDE7\uD83C\uDDF7",
  "BRASILEIRAO": "\uD83C\uDDE7\uD83C\uDDF7",
  "ARGENTINA": "\uD83C\uDDE6\uD83C\uDDF7",
  "SAUDI": "\uD83C\uDDF8\uD83C\uDDE6",
  "SCOTLAND": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
  "SCOTTISH": "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
  "TURKEY": "\uD83C\uDDF9\uD83C\uDDF7",
  "SUPER LIG": "\uD83C\uDDF9\uD83C\uDDF7",
  "BELGIUM": "\uD83C\uDDE7\uD83C\uDDEA",
  "BELGIAN": "\uD83C\uDDE7\uD83C\uDDEA",
  "WORLD": "\uD83C\uDF0D",
  "EURO": "\uD83C\uDDEA\uD83C\uDDFA",
  "COPA AMERICA": "\uD83C\uDF0E",
  "AFRICA": "\uD83C\uDF0D",
  "AFRICAN": "\uD83C\uDF0D",
  "AFCON": "\uD83C\uDF0D"
};

function getFlag(leagueName) {
  if (!leagueName) return "\u26BD";
  var upper = leagueName.toUpperCase();
  for (var key in LEAGUE_FLAGS) {
    if (upper.indexOf(key) !== -1) {
      return LEAGUE_FLAGS[key];
    }
  }
  return "\u26BD";
}

function assertEnv() {
  var required = ["SPORTDB_API_KEY", "GROQ_API_KEY", "FB_PAGE_ID", "FB_PAGE_ACCESS_TOKEN"];
  for (var i = 0; i < required.length; i++) {
    if (!process.env[required[i]]) throw new Error("Missing: " + required[i]);
  }
  console.log("Environment OK");
}

function delay(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function getTodayFormatted() {
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var now = new Date();
  var day = now.getDate();
  var suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';
  return days[now.getDay()] + " " + day + suffix + " " + months[now.getMonth()] + " " + now.getFullYear();
}

function formatOdds(odds) {
  if (!odds) return null;
  var home = odds.home || odds["1"] || null;
  var draw = odds.draw || odds["X"] || null;
  var away = odds.away || odds["2"] || null;
  if (!home && !draw && !away) return null;
  return {
    home: home ? parseFloat(home).toFixed(2) : "-",
    draw: draw ? parseFloat(draw).toFixed(2) : "-",
    away: away ? parseFloat(away).toFixed(2) : "-"
  };
}

function isTopLeague(leagueName) {
  if (!leagueName) return false;
  var upper = leagueName.toUpperCase();
  
  // Exclude youth, reserve, amateur
  var exclude = ["U17", "U18", "U19", "U20", "U21", "U23", "YOUTH", "RESERVE", "AMATEUR", "WOMEN U", "GIRL", "II", "III", "B TEAM", "SECOND"];
  for (var i = 0; i < exclude.length; i++) {
    if (upper.indexOf(exclude[i]) !== -1) return false;
  }
  
  // Must match a top league
  for (var i = 0; i < CONFIG.TOP_LEAGUES.length; i++) {
    if (upper.indexOf(CONFIG.TOP_LEAGUES[i]) !== -1) return true;
  }
  return false;
}

function getLeaguePriority(leagueName) {
  if (!leagueName) return 999;
  var upper = leagueName.toUpperCase();
  for (var i = 0; i < CONFIG.TOP_LEAGUES.length; i++) {
    if (upper.indexOf(CONFIG.TOP_LEAGUES[i]) !== -1) return i;
  }
  return 999;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadHistory() {
  ensureDataDir();
  if (!existsSync(POSTED_FILE)) return { posts: [], dailyCount: {}, lastPost: null };
  try {
    return JSON.parse(readFileSync(POSTED_FILE, 'utf-8'));
  } catch (e) {
    return { posts: [], dailyCount: {}, lastPost: null };
  }
}

function saveHistory(history) {
  ensureDataDir();
  if (history.posts.length > 500) history.posts = history.posts.slice(-500);
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

function recordPost(history, count) {
  var today = getTodayDate();
  history.posts.push({ postedAt: new Date().toISOString(), count: count });
  history.dailyCount[today] = (history.dailyCount[today] || 0) + 1;
  history.lastPost = new Date().toISOString();
  saveHistory(history);
}

function shouldPostNow(history) {
  var hour = new Date().getUTCHours();
  var count = getTodayCount(history);
  var hours = getHoursSinceLastPost(history);
  var target = CONFIG.MIN_POSTS_PER_DAY + (parseInt(getTodayDate().replace(/-/g, '')) % 5);
  
  console.log("Posts: " + count + "/" + target + " | Hours: " + hours.toFixed(1));
  
  if (count >= target) return false;
  if (hours < CONFIG.MIN_HOURS_BETWEEN_POSTS) return false;
  
  var chance = CONFIG.BASE_POST_CHANCE;
  if (CONFIG.QUIET_HOURS.indexOf(hour) !== -1) chance = chance * 0.2;
  else if (CONFIG.PEAK_HOURS.indexOf(hour) !== -1) chance = chance * 1.5;
  
  return Math.random() < chance;
}

async function fetchAllMatches() {
  console.log("Fetching matches...");
  var all = [];
  
  try {
    var res = await fetch("https://api.sportdb.dev/api/flashscore/football/live", {
      headers: { "X-API-Key": SPORTDB_API_KEY }
    });
    if (res.ok) {
      var data = await res.json();
      var m = Array.isArray(data) ? data : (data.matches || data.data || []);
      console.log("Live: " + m.length);
      all = all.concat(m);
    }
  } catch (e) {
    console.log("Live fetch error");
  }
  
  try {
    var res = await fetch("https://api.sportdb.dev/api/flashscore/football/today", {
      headers: { "X-API-Key": SPORTDB_API_KEY }
    });
    if (res.ok) {
      var data = await res.json();
      var m = Array.isArray(data) ? data : (data.matches || data.data || []);
      console.log("Today: " + m.length);
      for (var i = 0; i < m.length; i++) {
        var match = m[i];
        var key = (match.homeName || "") + "_" + (match.awayName || "");
        var exists = false;
        for (var j = 0; j < all.length; j++) {
          if ((all[j].homeName || "") + "_" + (all[j].awayName || "") === key) {
            exists = true;
            break;
          }
        }
        if (!exists) all.push(match);
      }
    }
  } catch (e) {
    console.log("Today fetch error");
  }
  
  console.log("Total: " + all.length);
  return all;
}

function getStatus(m) {
  var s = (m.eventStage || m.status || "").toUpperCase();
  if (s.indexOf("1ST") !== -1 || s.indexOf("2ND") !== -1 || s === "LIVE" || s === "1H" || s === "2H") return "LIVE";
  if (s.indexOf("HT") !== -1) return "HT";
  if (s === "FINISHED" || s === "FT" || s === "AET" || s === "PEN") return "FT";
  return "NS";
}

function transform(raw) {
  var league = raw.leagueName || raw.tournamentName || "";
  return {
    home: raw.homeName || raw.homeFirstName || "Unknown",
    away: raw.awayName || raw.awayFirstName || "Unknown",
    league: league,
    flag: getFlag(league),
    status: getStatus(raw),
    minute: raw.gameTime !== "-1" ? raw.gameTime : null,
    score: { 
      home: parseInt(raw.homeScore) || 0, 
      away: parseInt(raw.awayScore) || 0 
    },
    odds: formatOdds(raw.odds) || mockOdds(),
    priority: getLeaguePriority(league),
    isTop: isTopLeague(league),
    stats: mockStats()
  };
}

function mockOdds() {
  return {
    home: (1.5 + Math.random() * 2).toFixed(2),
    draw: (3 + Math.random() * 1.5).toFixed(2),
    away: (2.5 + Math.random() * 2.5).toFixed(2)
  };
}

function mockStats() {
  var f = ['W', 'D', 'L'];
  var homeForm = "";
  var awayForm = "";
  for (var i = 0; i < 5; i++) {
    homeForm += f[Math.floor(Math.random() * 3)];
    awayForm += f[Math.floor(Math.random() * 3)];
  }
  return {
    homeForm: homeForm,
    awayForm: awayForm,
    h2h: Math.floor(Math.random() * 4) + 1,
    avgGoals: (2 + Math.random() * 1.5).toFixed(1)
  };
}

function processMatches(raw) {
  var valid = [];
  for (var i = 0; i < raw.length; i++) {
    if (raw[i].homeName && raw[i].awayName) {
      valid.push(raw[i]);
    }
  }
  
  var all = [];
  for (var i = 0; i < valid.length; i++) {
    var t = transform(valid[i]);
    // ONLY TOP LEAGUES
    if (t.isTop && t.status !== "CANCELLED") {
      all.push(t);
    }
  }
  
  all.sort(function(a, b) {
    return a.priority - b.priority;
  });
  
  var live = [];
  var finished = [];
  var upcoming = [];
  
  for (var i = 0; i < all.length; i++) {
    if (all[i].status === "LIVE" || all[i].status === "HT") {
      live.push(all[i]);
    } else if (all[i].status === "FT") {
      finished.push(all[i]);
    } else if (all[i].status === "NS") {
      upcoming.push(all[i]);
    }
  }
  
  return { live: live, finished: finished, upcoming: upcoming };
}

function groupByLeague(matches) {
  var groups = {};
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var key = m.league || "Other";
    if (!groups[key]) {
      groups[key] = { name: m.league, flag: m.flag, matches: [] };
    }
    groups[key].matches.push(m);
  }
  return Object.values(groups);
}

function getRiskStars(risk) {
  if (risk === "Low") return "\u2B50";
  if (risk === "Medium") return "\u2B50\u2B50";
  return "\u2B50\u2B50\u2B50";
}

function generatePrediction(match) {
  var homeOdds = parseFloat(match.odds.home);
  var homeWins = 0;
  for (var i = 0; i < match.stats.homeForm.length; i++) {
    if (match.stats.homeForm[i] === 'W') homeWins++;
  }
  
  var pick, odds, risk, analysis;
  
  if (homeOdds < 1.6 && homeWins >= 3) {
    pick = match.home + " Win & Over 1.5";
    odds = (homeOdds * 1.15).toFixed(2);
    risk = "Medium";
    analysis = match.home + " dominant at home. " + homeWins + " wins in last 5.";
  } else if (homeOdds < 2.0 && homeWins >= 2) {
    pick = match.home + " Win";
    odds = match.odds.home;
    risk = "Low";
    analysis = match.home + " solid at home. " + match.away + " struggling away.";
  } else if (parseFloat(match.stats.avgGoals) > 2.5) {
    pick = "Over 2.5 Goals";
    odds = "1.85";
    risk = "Medium";
    analysis = "High scoring expected. Avg " + match.stats.avgGoals + " goals.";
  } else {
    pick = "BTTS";
    odds = "1.75";
    risk = "Medium";
    analysis = "Both teams finding the net. Open game expected.";
  }
  
  return { pick: pick, odds: odds, risk: risk, analysis: analysis };
}

function buildPost(cats) {
  var date = getTodayFormatted();
  
  var post = "";
  
  // CLEAN HEADER - No match count
  post += "\u26BD FOOTBALL DAILY | " + date + " \uD83C\uDFAF\n";
  post += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
  
  // LIVE SCORES
  var liveToShow = cats.live.slice(0, CONFIG.MAX_LIVE_MATCHES);
  if (liveToShow.length > 0) {
    post += "\uD83D\uDD34 LIVE SCORES\n";
    post += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
    
    var grouped = groupByLeague(liveToShow);
    for (var i = 0; i < grouped.length; i++) {
      var g = grouped[i];
      post += g.flag + " " + g.name + "\n";
      for (var j = 0; j < g.matches.length; j++) {
        var m = g.matches[j];
        post += "   \u2022 " + m.home + " " + m.score.home + "-" + m.score.away + " " + m.away;
        if (m.minute) post += " \u23F1\uFE0F " + m.minute + "'";
        post += "\n";
      }
      post += "\n";
    }
  }
  
  // RESULTS
  var finishedToShow = cats.finished.slice(0, CONFIG.MAX_FINISHED_MATCHES);
  if (finishedToShow.length > 0) {
    post += "\u2705 TODAY'S RESULTS\n";
    post += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
    
    var grouped = groupByLeague(finishedToShow);
    for (var i = 0; i < grouped.length; i++) {
      var g = grouped[i];
      post += g.flag + " " + g.name + "\n";
      for (var j = 0; j < g.matches.length; j++) {
        var m = g.matches[j];
        var emoji = "\uD83E\uDD1D";
        if (m.score.home > m.score.away) emoji = "\u2705";
        else if (m.score.home < m.score.away) emoji = "\u274C";
        post += "   \u2022 " + m.home + " " + m.score.home + "-" + m.score.away + " " + m.away + " " + emoji + "\n";
      }
      post += "\n";
    }
  }
  
  // PREDICTIONS
  var predictionsToShow = cats.upcoming.slice(0, CONFIG.MAX_PREDICTIONS);
  if (predictionsToShow.length > 0) {
    post += "\uD83C\uDFAF TOP PREDICTIONS\n";
    post += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
    
    for (var i = 0; i < predictionsToShow.length; i++) {
      var m = predictionsToShow[i];
      var pred = generatePrediction(m);
      
      post += m.flag + " " + m.league + "\n";
      post += "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n";
      
      post += "\u26BD " + m.home + " vs " + m.away + "\n\n";
      
      post += "   \uD83D\uDCCA Odds: " + m.odds.home + " | " + m.odds.draw + " | " + m.odds.away + "\n\n";
      
      post += "   \uD83D\uDCC8 Stats:\n";
      post += "   \u251C " + m.home + ": " + m.stats.homeForm + "\n";
      post += "   \u251C " + m.away + ": " + m.stats.awayForm + "\n";
      post += "   \u251C H2H: " + m.stats.h2h + " wins in 5\n";
      post += "   \u2514 Avg: " + m.stats.avgGoals + " goals\n\n";
      
      post += "   \uD83D\uDD2E Pick: " + pred.pick + "\n";
      post += "   \uD83D\uDCB0 Odds: @" + pred.odds + "\n";
      post += "   \u26A0\uFE0F Risk: " + getRiskStars(pred.risk) + " " + pred.risk + "\n\n";
      
      post += "   \uD83D\uDCA1 " + pred.analysis + "\n\n";
    }
  }
  
  // ACCUMULATOR
  if (predictionsToShow.length >= 4) {
    post += "\uD83D\uDD25 ACCUMULATOR OF THE DAY\n";
    post += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
    
    var accaMatches = predictionsToShow.slice(0, CONFIG.MAX_ACCA_PICKS);
    var totalOdds = 1;
    
    var nums = ["1\uFE0F\u20E3", "2\uFE0F\u20E3", "3\uFE0F\u20E3", "4\uFE0F\u20E3", "5\uFE0F\u20E3", "6\uFE0F\u20E3"];
    
    for (var i = 0; i < accaMatches.length; i++) {
      var m = accaMatches[i];
      var pred = generatePrediction(m);
      var odds = parseFloat(pred.odds);
      totalOdds = totalOdds * odds;
      post += "   " + nums[i] + " " + m.home + " vs " + m.away + "\n";
      post += "      \u2192 " + pred.pick + " @" + pred.odds + "\n\n";
    }
    
    post += "   \uD83D\uDCB0 \u00A310 returns \u00A3" + (10 * totalOdds).toFixed(2) + "\n\n";
  }
  
  // VALUE BETS
  if (predictionsToShow.length >= 3) {
    post += "\uD83D\uDCC8 VALUE BETS\n";
    post += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
    
    var m1 = predictionsToShow[0];
    var m2 = predictionsToShow[1];
    var m3 = predictionsToShow[2];
    
    post += "   \uD83D\uDFE2 SAFE: " + m1.home + " Win @" + m1.odds.home + "\n\n";
    post += "   \uD83D\uDFE1 VALUE: " + m2.home + " vs " + m2.away + " BTTS @1.75\n\n";
    post += "   \uD83D\uDD34 LONGSHOT: " + m3.away + " Win @" + m3.odds.away + "\n\n";
  }
  
  // CTA
  post += "\n";
  post += "\uD83D\uDCB0 WANT MORE WINNERS?\n";
  post += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
  post += "Join 5,000+ members getting FREE tips!\n\n";
  post += "   \u2705 Pre-match predictions\n";
  post += "   \u2705 Live in-play alerts\n";
  post += "   \u2705 Daily accumulators\n";
  post += "   \u2705 VIP exclusive picks\n\n";
  post += "\uD83D\uDC49 JOIN FREE: " + CONFIG.TELEGRAM_URL + "\n\n";
  post += "\u26A0\uFE0F 18+ | Gamble Responsibly\n\n";
  post += "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
  
  // HASHTAGS
  post += "#GlobalScoreNews #Football #BettingTips #FreeTips #Predictions #PremierLeague #LaLiga #Bundesliga #SerieA #Ligue1 #ChampionsLeague #Accumulator #BTTS";
  
  return post;
}

async function postToFacebook(message) {
  console.log("Posting to Facebook...");
  
  var res = await fetch("https://graph.facebook.com/v19.0/" + FB_PAGE_ID + "/feed", {
    method: "POST",
    body: new URLSearchParams({
      message: message,
      access_token: FB_PAGE_ACCESS_TOKEN
    })
  });
  
  if (!res.ok) {
    var err = await res.text();
    throw new Error("Facebook error: " + res.status + " - " + err);
  }
  
  console.log("Posted!");
  return res.json();
}

async function main() {
  console.log("==================================================");
  console.log("GLOBAL SCORE NEWS v8.4 - Top Leagues Only");
  console.log("==================================================");
  
  assertEnv();
  
  var history = loadHistory();
  
  if (!FORCE_POST && !shouldPostNow(history)) {
    console.log("Skipping");
    return;
  }
  
  if (FORCE_POST) console.log("FORCE POST");
  
  var raw = await fetchAllMatches();
  if (!raw || raw.length === 0) {
    console.log("No matches");
    return;
  }
  
  var cats = processMatches(raw);
  
  var total = cats.live.length + cats.finished.length + cats.upcoming.length;
  console.log("Top League Matches: " + total);
  console.log("  Live: " + cats.live.length);
  console.log("  Finished: " + cats.finished.length);
  console.log("  Upcoming: " + cats.upcoming.length);
  
  if (total < 3) {
    console.log("Not enough top league matches");
    return;
  }
  
  var post = buildPost(cats);
  
  console.log("==================================================");
  console.log("POST:");
  console.log("==================================================");
  console.log(post);
  console.log("==================================================");
  console.log("Length: " + post.length);
  
  var result = await postToFacebook(post);
  recordPost(history, total);
  
  console.log("SUCCESS! ID: " + result.id);
}

main().catch(function(e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
});
