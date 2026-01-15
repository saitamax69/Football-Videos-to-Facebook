#!/usr/bin/env python3
import os
import sys
import logging
import requests
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

# --- CONFIG ---
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

RAPIDAPI_HOST = "free-football-api-data.p.rapidapi.com"
TELEGRAM_LINK = "https://t.me/+xAQ3DCVJa8A2ZmY8"

RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY")
FB_TOKEN = os.environ.get("FACEBOOK_PAGE_ACCESS_TOKEN")
FB_PAGE_ID = os.environ.get("FACEBOOK_PAGE_ID")

class FootballAPI:
    def __init__(self):
        self.headers = {
            "x-rapidapi-host": RAPIDAPI_HOST,
            "x-rapidapi-key": RAPIDAPI_KEY
        }
        self.base = f"https://{RAPIDAPI_HOST}"

    def get_matches(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        logger.info(f"📅 Target Date: {today}")

        # LIST OF ENDPOINTS TO TRY (If one fails, try next)
        endpoints = [
            "football-matches-by-date",
            "football-get-all-matches-by-date",
            "football-fixtures-by-date",
            "football-current-matches"
        ]

        for ep in endpoints:
            url = f"{self.base}/{ep}"
            logger.info(f"🔄 Trying endpoint: {ep}...")
            try:
                resp = requests.get(url, headers=self.headers, params={"date": today})
                
                if resp.status_code == 200:
                    logger.info(f"✅ Success with: {ep}")
                    return resp.json()
                elif resp.status_code == 404:
                    logger.warning(f"❌ 404 Not Found on {ep}, trying next...")
                    continue
                else:
                    logger.error(f"⚠️ API Error {resp.status_code}: {resp.text}")
                    continue
            except Exception as e:
                logger.error(f"Connection failed: {e}")
        
        logger.error("❌ All endpoints failed.")
        return None

    def get_stats(self, eid):
        # Try generic stats endpoint
        url = f"{self.base}/football-event-statistics"
        try:
            resp = requests.get(url, headers=self.headers, params={"eventid": eid})
            if resp.status_code == 200: return resp.json()
        except:
            pass
        return {}

def find_finished_match(data):
    if not data: return None
    
    matches = []
    # Normalize Data Structure
    if isinstance(data, dict):
        if 'response' in data:
            matches = data['response']
            if isinstance(matches, dict) and 'matches' in matches:
                matches = matches['matches']
        elif 'matches' in data:
            matches = data['matches']
    elif isinstance(data, list):
        matches = data

    # Flatten if needed (some APIs return leagues list)
    flat_matches = []
    if matches and isinstance(matches, list):
        # Check if first item is a match or a league
        first = matches[0] if len(matches) > 0 else {}
        if 'events' in first or 'matches' in first:
            # It's a list of leagues
            for league in matches:
                flat_matches.extend(league.get('events', league.get('matches', [])))
        else:
            flat_matches = matches

    for m in flat_matches:
        status = str(m.get('status', '')).lower()
        if not status and 'fixture' in m:
            status = str(m['fixture'].get('status', {}).get('long', '')).lower()
            
        if any(x in status for x in ['ft', 'finished', 'ended', 'full']):
            return m
    return None

def create_card(home, away, h_score, a_score):
    img = Image.new('RGB', (1080, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    try:
        f_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 90)
        f_md = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 50)
        f_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 35)
    except:
        f_lg = f_md = f_sm = ImageFont.load_default()

    draw.text((540, 100), "MATCH RESULT", font=f_md, fill=(34, 197, 94), anchor="mm")
    draw.text((540, 170), datetime.now().strftime("%d %b %Y"), font=f_sm, fill=(148, 163, 184), anchor="mm")

    draw.rounded_rectangle([(100, 300), (980, 600)], radius=30, fill=(30, 41, 59))
    draw.text((540, 380), "FULL TIME", font=f_sm, fill=(148, 163, 184), anchor="mm")
    draw.text((540, 480), f"{h_score} - {a_score}", font=f_lg, fill=(34, 197, 94), anchor="mm")
    
    draw.text((250, 550), home[:15], font=f_md, fill="white", anchor="mm")
    draw.text((830, 550), away[:15], font=f_md, fill="white", anchor="mm")
    
    img.save("stats_card.jpg")
    print("📸 Image created.")

def main():
    if not RAPIDAPI_KEY:
        print("❌ Missing Secrets")
        sys.exit(1)

    api = FootballAPI()
    data = api.get_matches()
    
    match = find_finished_match(data)
    if not match:
        print("⚠️ No finished matches found today.")
        sys.exit(0)

    # Extract info safely
    eid = match.get('id', match.get('fixture', {}).get('id'))
    
    # Try different structures for names/scores
    try:
        if 'home' in match:
            home = match['home']['name']
            away = match['away']['name']
            h_score = match['score']['fullTime']['home']
            a_score = match['score']['fullTime']['away']
        elif 'homeTeam' in match:
            home = match['homeTeam']['name']
            away = match['awayTeam']['name']
            h_score = match.get('homeScore', match.get('goals', {}).get('home', 0))
            a_score = match.get('awayScore', match.get('goals', {}).get('away', 0))
        else:
            raise ValueError("Unknown Data Structure")
    except:
        # Fallback
        home = "Home Team"
        away = "Away Team"
        h_score = 0
        a_score = 0

    print(f"👉 Found: {home} vs {away}")
    create_card(home, away, h_score, a_score)

    caption = f"✅ Match Result: {home} vs {away}\n"
    caption += f"⚽ Final Score: {h_score} - {a_score}\n\n"
    caption += "🔥 We predicted this winner on our VIP channel!\n"
    caption += f"👉 Join here: {TELEGRAM_LINK}\n\n"
    caption += "#Football #Soccer #BettingTips"

    url = f"https://graph.facebook.com/v18.0/{FB_PAGE_ID}/photos"
    with open("stats_card.jpg", "rb") as f:
        requests.post(url, data={"caption": caption, "access_token": FB_TOKEN}, files={"source": f})
    print("✅ Posted to Facebook")

if __name__ == "__main__":
    main()
