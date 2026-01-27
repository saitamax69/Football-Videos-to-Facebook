import requests
import facebook
import os
import json
import google.generativeai as genai
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
from datetime import datetime

# --- CONFIGURATION ---

# 1. API & KEYS
# Your specific RapidAPI Key
RAPIDAPI_KEY = "0c389caf77msh12d8cc6006d5a4bp110476jsnf905c1f437a1"
RAPIDAPI_HOST = "free-api-live-football-data.p.rapidapi.com"

# Keys from GitHub Secrets
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
FB_TOKEN = os.environ.get("FB_PAGE_ACCESS_TOKEN")
# Your Telegram Channel Link
TELEGRAM_INVITE = "https://t.me/+9uDCOJXm_R1hMzM0"
# Telegram Bot Token (Get from @BotFather)
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") 
# Your Channel Username (e.g., @GlobalScoreUpdates)
TELEGRAM_CHANNEL_ID = "@GlobalScoreUpdates" 

# 2. AFFILIATE LINKS
LINK_1XBET = "https://ma-1xbet.com/?bf=695d66e22c1b5_7531017325"
LINK_LINEBET = "https://linebet.com/?bf=695d695c66d7a_13053616523"
LINK_STAKE = "https://stake.com/?c=GlobalScoreUpdates"

def get_matches():
    """ 
    SMART FETCH: Uses 1 API Request to get matches. 
    """
    # Note: Depending on the specific API documentation, the endpoint might be /fixtures/matches or similar.
    # We will try a standard matches endpoint for today.
    url = f"https://{RAPIDAPI_HOST}/football-get-matches-by-date"
    today = datetime.now().strftime("%Y%m%d") # Format YYYYMMDD usually for this API
    
    querystring = {"date": today}
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST
    }

    try:
        print(f"--- Calling API for Date: {today} ---")
        response = requests.get(url, headers=headers, params=querystring)
        data = response.json()
        
        # Structure varies by API, assuming standard 'matches' list
        if 'matches' in data:
            return data['matches']
        elif 'response' in data:
            return data['response']
        else:
            print("API Response weird:", data)
            return []
    except Exception as e:
        print(f"API Failed: {e}")
        return []

def select_best_match(matches):
    """ Selects a match from big leagues only """
    # Keywords to find big leagues in the data
    big_leagues = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Champions League", "Ligue 1"]
    
    for match in matches:
        # Check if match status is Not Started (NS) or similar
        # API structure varies, usually match['status']
        league_name = match.get('league', {}).get('name', '') or match.get('leagueName', '')
        
        if any(top in league_name for top in big_leagues):
            return match
            
    # If no big match, just take the first one available
    if matches:
        return matches[0]
    return None

def get_ai_prediction(home, away, league):
    """ 
    AI generates the Analysis AND the Odds 
    (Saving us from making an extra API call for odds)
    """
    genai.configure(api_key=GEMINI_KEY)
    model = genai.GenerativeModel('gemini-pro')
    
    prompt = (
        f"Act as a professional betting tipper for 'Global Score Updates'. "
        f"Match: {home} vs {away} in {league}. "
        f"Create a betting post with this EXACT structure:\n"
        f"1. Headline: 💎 PREMIUM VIP FIX 💎\n"
        f"2. Analysis: 1 sentence why the team will win.\n"
        f"3. 🧠 PREDICTION: (Pick a market like Over 2.5 Goals or Home Win).\n"
        f"4. 📊 ODDS: (Estimate the decimal odds, e.g., 1.85).\n"
        f"5. 🔥 STAKE: High (10/10).\n"
        f"Use emojis. Do not add links."
    )
    
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except:
        return f"💎 PREMIUM FIX: {home} vs {away}\n🧠 PREDICTION: Home Win\n📊 ODDS: 1.80\n🔥 STAKE: High"

def post_to_telegram(home, away, analysis):
    try:
        bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN)
        
        # Message
        msg = (
            f"⚽ **{home} vs {away}**\n\n"
            f"{analysis}\n\n"
            f"👇 **REGISTER & BET NOW** 👇"
        )
        
        # Affiliate Buttons
        markup = InlineKeyboardMarkup()
        btn1 = InlineKeyboardButton("💎 1XBET (Bonus)", url=LINK_1XBET)
        btn2 = InlineKeyboardButton("🟢 LINEBET (High Odds)", url=LINK_LINEBET)
        btn3 = InlineKeyboardButton("🎰 STAKE (Crypto)", url=LINK_STAKE)
        markup.add(btn1)
        markup.add(btn2)
        markup.add(btn3)
        
        # Send text message (Image takes too much data/logic for this basic API)
        bot.send_message(TELEGRAM_CHANNEL_ID, msg, parse_mode="Markdown", reply_markup=markup)
        print("-> Telegram Post Success!")
        
    except Exception as e:
        print(f"Telegram Error: {e}")

def post_to_facebook(home, away):
    try:
        graph = facebook.GraphAPI(FB_TOKEN)
        
        # Teaser Message
        msg = (
            f"✅ PREDICTION READY: {home} vs {away}\n\n"
            f"We have just posted a 100% Winning Tip for this match!\n"
            f"Odds: 1.80+ 💰\n\n"
            f"👇 GET THE TIP HERE FREE 👇\n"
            f"{TELEGRAM_INVITE}\n"
            f"{TELEGRAM_INVITE}\n\n"
            f"#Betting #Football #GlobalScoreUpdates"
        )
        
        # Post text only (Link preview will show Telegram)
        graph.put_object("me", "feed", message=msg, link=TELEGRAM_INVITE)
        print("-> Facebook Post Success!")
        
    except Exception as e:
        print(f"FB Error: {e}")

def main():
    print("--- Starting Affiliate Bot ---")
    
    matches = get_matches()
    
    if not matches:
        print("No matches found (or API limit reached).")
        return

    match = select_best_match(matches)
    if not match:
        print("No suitable matches found.")
        return

    # Extract Data (Adjust based on exact API response structure)
    # Most APIs use 'homeTeam' and 'awayTeam' keys
    try:
        home = match.get('homeTeam', {}).get('name') or match.get('home', {}).get('name') or "Home Team"
        away = match.get('awayTeam', {}).get('name') or match.get('away', {}).get('name') or "Away Team"
        league = match.get('league', {}).get('name') or "League"
    except:
        home = "Home"
        away = "Away"
        league = "Football"

    print(f"Target: {home} vs {away}")

    # Generate Content
    analysis = get_ai_prediction(home, away, league)
    
    # Post
    post_to_telegram(home, away, analysis)
    post_to_facebook(home, away)

if __name__ == "__main__":
    main()
