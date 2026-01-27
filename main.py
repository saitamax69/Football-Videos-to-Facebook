import requests
import facebook
import os
import google.generativeai as genai
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
from datetime import datetime

# --- CONFIGURATION ---
# 1. API KEYS
RAPIDAPI_KEY = "0c389caf77msh12d8cc6006d5a4bp110476jsnf905c1f437a1"
RAPIDAPI_HOST = "free-api-live-football-data.p.rapidapi.com"

# Keys from GitHub Secrets
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
FB_TOKEN = os.environ.get("FB_PAGE_ACCESS_TOKEN")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") 
TELEGRAM_CHANNEL_ID = "@GlobalScoreUpdates"
TELEGRAM_INVITE = "https://t.me/+9uDCOJXm_R1hMzM0"

# 2. AFFILIATE LINKS
LINK_1XBET = "https://ma-1xbet.com/?bf=695d66e22c1b5_7531017325"
LINK_LINEBET = "https://linebet.com/?bf=695d695c66d7a_13053616523"
LINK_STAKE = "https://stake.com/?c=GlobalScoreUpdates"

def get_matches():
    """ 
    Fetches matches and PROTECTS against API errors.
    """
    url = f"https://{RAPIDAPI_HOST}/football-get-matches-by-date"
    today = datetime.now().strftime("%Y%m%d")
    
    querystring = {"date": today}
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST
    }

    try:
        print(f"--- API Call: {url} (Date: {today}) ---")
        response = requests.get(url, headers=headers, params=querystring)
        data = response.json()
        
        # DEBUG: Print the first 100 chars of response to see what's happening
        print(f"API Response: {str(data)[:200]}...")

        # 1. Check for specific 'response' list
        if 'response' in data:
            matches = data['response']
            # CRITICAL FIX: Check if 'matches' is actually a List, not a String (Error)
            if isinstance(matches, list):
                return matches
            else:
                print(f"⚠️ API Error Message: {matches}")
                return []
        
        # 2. Check for 'matches' list
        elif 'matches' in data:
            matches = data['matches']
            if isinstance(matches, list):
                return matches
            else:
                print(f"⚠️ API Error Message: {matches}")
                return []
                
        else:
            print("⚠️ Unknown API Structure")
            return []

    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        return []

def select_best_match(matches):
    """ Selects a match but safely checks data types """
    if not matches: return None

    big_leagues = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Champions League", "Ligue 1"]
    
    for match in matches:
        # SAFETY CHECK: Ensure match is a dictionary
        if not isinstance(match, dict):
            continue

        # Try to find league name in various common keys
        league_name = ""
        if 'league' in match and isinstance(match['league'], dict):
            league_name = match['league'].get('name', '')
        elif 'leagueName' in match:
            league_name = match['leagueName']
        
        if any(top in league_name for top in big_leagues):
            return match
            
    # Default to first valid dictionary match
    for match in matches:
        if isinstance(match, dict):
            return match
    return None

def get_ai_prediction(home, away, league):
    """ Generates Analysis using Gemini """
    if not GEMINI_KEY:
        return f"💎 FIX: {home} vs {away}\n🔥 WIN\n💰 High Stake"

    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel('gemini-pro')
    
    prompt = (
        f"Act as a professional betting expert. "
        f"Match: {home} vs {away} in {league}. "
        f"Write a Telegram betting post EXACTLY like this:\n"
        f"💎 **PREMIUM VIP FIX** 💎\n"
        f"⚔️ {home} vs {away}\n"
        f"🏆 {league}\n\n"
        f"🧠 **ANALYSIS:** (One short sentence why home/away wins)\n"
        f"🎯 **PREDICTION:** (Pick a market: Home Win / Over 2.5 Goals)\n"
        f"📊 **ODDS:** (Estimate odds, e.g., 1.85)\n"
        f"🔥 **STAKE:** 10/10 (Max Bet)\n\n"
        f"❌ No links. No generic text."
    )
    
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"AI Error: {e}")
        return f"💎 FIX: {home} vs {away}\n🎯 PREDICTION: Home Win\n📊 ODDS: 1.80"

def post_to_telegram(home, away, analysis):
    if not TELEGRAM_BOT_TOKEN:
        print("❌ No Telegram Token Found")
        return

    try:
        bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN)
        
        msg = (
            f"{analysis}\n\n"
            f"👇 **BET NOW & GET BONUS** 👇"
        )
        
        markup = InlineKeyboardMarkup()
        btn1 = InlineKeyboardButton("💎 1XBET", url=LINK_1XBET)
        btn2 = InlineKeyboardButton("🟢 LINEBET", url=LINK_LINEBET)
        btn3 = InlineKeyboardButton("🎰 STAKE", url=LINK_STAKE)
        markup.add(btn1, btn2)
        markup.add(btn3)
        
        bot.send_message(TELEGRAM_CHANNEL_ID, msg, parse_mode="Markdown", reply_markup=markup)
        print("✅ Telegram Post Success!")
        
    except Exception as e:
        print(f"❌ Telegram Error: {e}")

def post_to_facebook(home, away):
    if not FB_TOKEN: return

    try:
        graph = facebook.GraphAPI(FB_TOKEN)
        
        msg = (
            f"🔥 {home} vs {away} PREDICTION READY! 🔥\n\n"
            f"We just dropped a MAX STAKE (10/10) Fix for this match. 💎\n"
            f"The Analysis & Odds are posted in our VIP Channel.\n\n"
            f"👇 GET THE WINNING TIP HERE 👇\n"
            f"{TELEGRAM_INVITE}\n\n"
            f"#BettingTips #Football #{home} #{away}"
        )
        
        # Post Link Preview
        graph.put_object("me", "feed", message=msg, link=TELEGRAM_INVITE)
        print("✅ Facebook Post Success!")
        
    except Exception as e:
        print(f"❌ FB Error: {e}")

def main():
    print("--- Starting Affiliate Bot ---")
    
    matches = get_matches()
    if not matches:
        print("❌ No matches found or API Limit Reached.")
        return

    match = select_best_match(matches)
    if not match:
        print("❌ No valid matches in list.")
        return

    # Safe Data Extraction
    try:
        home = match.get('homeTeam', {}).get('name') or match.get('home', {}).get('name') or "Home"
        away = match.get('awayTeam', {}).get('name') or match.get('away', {}).get('name') or "Away"
        league = match.get('league', {}).get('name') or "Football"
    except:
        home, away, league = "Home Team", "Away Team", "League"

    print(f"🎯 Selected: {home} vs {away}")

    # Generate & Post
    analysis = get_ai_prediction(home, away, league)
    post_to_telegram(home, away, analysis)
    post_to_facebook(home, away)

if __name__ == "__main__":
    main()
