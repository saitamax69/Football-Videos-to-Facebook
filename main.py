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

# SWITCHING TO THE BEST API
RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com"
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
        self.base = f"https://{RAPIDAPI_HOST}/v3"

    def get_finished_matches(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        url = f"{self.base}/fixtures"
        params = {
            "date": today,
            "status": "FT" # Only get Finished matches
        }
        
        logger.info(f"📅 Fetching matches for: {today}")
        try:
            resp = requests.get(url, headers=self.headers, params=params)
            if resp.status_code == 403:
                logger.error("❌ API Error 403: You are not subscribed to 'API-Football' on RapidAPI.")
                logger.error("👉 Go here and subscribe (Free): https://rapidapi.com/api-sports/api/api-football")
                sys.exit(1)
            resp.raise_for_status()
            return resp.json().get('response', [])
        except Exception as e:
            logger.error(f"API Failed: {e}")
            sys.exit(1)

    def get_stats(self, fixture_id):
        url = f"{self.base}/fixtures/statistics"
        try:
            resp = requests.get(url, headers=self.headers, params={"fixture": fixture_id})
            return resp.json().get('response', [])
        except:
            return []

def create_card(home, away, h_score, a_score, stats_data):
    # Canvas
    img = Image.new('RGB', (1080, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    
    # Fonts
    try:
        f_xl = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 90)
        f_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
        f_md = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
        f_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
    except:
        f_xl = f_lg = f_md = f_sm = ImageFont.load_default()

    # Header
    draw.text((540, 80), "MATCH RESULT", font=f_md, fill=(34, 197, 94), anchor="mm")
    
    # Score Card Background
    draw.rounded_rectangle([(80, 200), (1000, 500)], radius=30, fill=(30, 41, 59))
    
    # Teams
    draw.text((250, 350), home[:12], font=f_lg, fill="white", anchor="mm")
    draw.text((830, 350), away[:12], font=f_lg, fill="white", anchor="mm")
    
    # Score
    draw.text((540, 350), f"{h_score} - {a_score}", font=f_xl, fill=(34, 197, 94), anchor="mm")
    draw.text((540, 450), "FULL TIME", font=f_sm, fill=(148, 163, 184), anchor="mm")

    # Stats Section
    y = 600
    if stats_data:
        # Check if we have data for both teams
        if len(stats_data) >= 2:
            team1_stats = stats_data[0].get('statistics', [])
            team2_stats = stats_data[1].get('statistics', [])
            
            # Key stats to look for
            target_stats = ["Ball Possession", "Total Shots", "Shots on Goal", "Corner Kicks"]
            
            for stat_name in target_stats:
                # Find val for home
                val1 = next((item['value'] for item in team1_stats if item['type'] == stat_name), "-")
                # Find val for away
                val2 = next((item['value'] for item in team2_stats if item['type'] == stat_name), "-")
                
                # Draw
                if val1 is None: val1 = 0
                if val2 is None: val2 = 0
                
                draw.text((540, y), stat_name.upper(), font=f_sm, fill=(148, 163, 184), anchor="mm")
                draw.text((150, y), str(val1), font=f_md, fill="white", anchor="lm")
                draw.text((930, y), str(val2), font=f_md, fill="white", anchor="rm")
                y += 100

    img.save("stats_card.jpg")
    print("📸 Stats Card Generated.")

def main():
    if not RAPIDAPI_KEY:
        print("❌ Secrets missing.")
        sys.exit(1)

    api = FootballAPI()
    
    # 1. Get Matches
    matches = api.get_finished_matches()
    
    if not matches:
        print("⚠️ No finished matches found today.")
        sys.exit(0)

    # 2. Select Best Match (Prioritize major leagues if possible, otherwise first)
    match = matches[0]
    
    # 3. Extract Info
    fid = match['fixture']['id']
    home = match['teams']['home']['name']
    away = match['teams']['away']['name']
    h_score = match['goals']['home']
    a_score = match['goals']['away']
    
    print(f"👉 Selected: {home} vs {away} ({h_score}-{a_score})")

    # 4. Get Stats
    stats = api.get_stats(fid)
    create_card(home, away, h_score, a_score, stats)

    # 5. Post
    caption = f"✅ Match Result: {home} vs {away}\n"
    caption += f"⚽ Score: {h_score} - {a_score}\n\n"
    caption += "🔥 Join our VIP channel for accurate predictions!\n"
    caption += f"👉 {TELEGRAM_LINK}\n\n"
    caption += "#Football #Soccer #BettingTips #MatchStats"

    url = f"https://graph.facebook.com/v18.0/{FB_PAGE_ID}/photos"
    try:
        with open("stats_card.jpg", "rb") as f:
            requests.post(url, data={"caption": caption, "access_token": FB_TOKEN}, files={"source": f})
        print("✅ SUCCESS: Posted to Facebook!")
    except Exception as e:
        print(f"❌ Post Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
