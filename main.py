#!/usr/bin/env python3
import os
import sys
import logging
import requests
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

# --- CONFIGURATION ---
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
        
        # ✅ THIS IS THE FIX: The correct endpoint name
        url = f"{self.base}/football-get-all-matches-by-date"
        
        logger.info(f"Fetching matches for {today}...")
        try:
            resp = requests.get(url, headers=self.headers, params={"date": today})
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"API Error: {e}")
            sys.exit(1)

    def get_stats(self, eid):
        url = f"{self.base}/football-event-statistics"
        resp = requests.get(url, headers=self.headers, params={"eventid": eid})
        resp.raise_for_status()
        return resp.json()

def find_finished_match(data):
    # Depending on API plan, data might be a list or a dict
    matches = []
    
    # Extract matches list from response
    if isinstance(data, dict):
        if 'response' in data and 'matches' in data['response']:
            matches = data['response']['matches']
        elif 'matches' in data:
            matches = data['matches']
    elif isinstance(data, list):
        matches = data

    finished = []
    for m in matches:
        # Check if match is finished
        status = str(m.get('status', '')).lower()
        if not status and 'fixture' in m:
            status = str(m['fixture'].get('status', {}).get('long', '')).lower()
            
        # Look for finished indicators
        if any(x in status for x in ['ft', 'finished', 'ended', 'full']):
            finished.append(m)
            
    return finished[0] if finished else None

def create_card(home, away, h_score, a_score, stats):
    img = Image.new('RGB', (1080, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    
    try:
        f_lg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
        f_md = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
        f_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
    except:
        f_lg = f_md = f_sm = ImageFont.load_default()

    draw.text((540, 100), "MATCH RESULT", font=f_md, fill=(34, 197, 94), anchor="mm")
    draw.text((540, 160), datetime.now().strftime("%d %b %Y"), font=f_sm, fill=(148, 163, 184), anchor="mm")

    # Score Box
    draw.rounded_rectangle([(100, 250), (980, 500)], radius=20, fill=(30, 41, 59))
    draw.text((540, 320), f"{h_score} - {a_score}", font=f_lg, fill=(34, 197, 94), anchor="mm")
    draw.text((540, 400), "FULL TIME", font=f_sm, fill=(148, 163, 184), anchor="mm")
    draw.text((250, 375), home[:15], font=f_md, fill="white", anchor="mm")
    draw.text((830, 375), away[:15], font=f_md, fill="white", anchor="mm")

    img.save("stats_card.jpg")
    print("📸 Image generated successfully")

def main():
    if not RAPIDAPI_KEY:
        print("❌ Error: RAPIDAPI_KEY is missing.")
        sys.exit(1)

    api = FootballAPI()
    
    # 1. Get Matches
    data = api.get_matches()
    match = find_finished_match(data)
    
    if not match:
        print("⚠️ No finished matches found today.")
        sys.exit(0)

    # 2. Extract Data
    # Handle different API Structures
    eid = match.get('id', match.get('fixture', {}).get('id'))
    
    if 'home' in match and 'name' in match['home']:
        home = match['home']['name']
        away = match['away']['name']
        h_score = match['score']['fullTime']['home']
        a_score = match['score']['fullTime']['away']
    else:
        home = match['homeTeam']['name']
        away = match['awayTeam']['name']
        h_score = match.get('homeScore', 0)
        a_score = match.get('awayScore', 0)

    print(f"👉 Processing: {home} vs {away}")

    # 3. Create Image (Skipping stats detail for stability, using Score)
    create_card(home, away, h_score, a_score, {})

    # 4. Post to Facebook
    caption = f"✅ Match Result: {home} vs {away}\n"
    caption += f"⚽ Final Score: {h_score} - {a_score}\n\n"
    caption += "🔥 We predicted this outcome on our VIP channel!\n"
    caption += f"👉 Join here: {TELEGRAM_LINK}\n\n"
    caption += "#Football #SoccerStats #BettingTips"

    url = f"https://graph.facebook.com/v18.0/{FB_PAGE_ID}/photos"
    
    try:
        with open("stats_card.jpg", "rb") as f:
            resp = requests.post(url, 
                data={"caption": caption, "access_token": FB_TOKEN}, 
                files={"source": f}
            )
            resp.raise_for_status()
            print("✅ SUCCESSFULLY POSTED TO FACEBOOK!")
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
