import feedparser
import facebook
import os
import requests
import json
import google.generativeai as genai
import random
from bs4 import BeautifulSoup
import time

# --- CONFIGURATION ---
RSS_FEEDS = [
    "https://www.skysports.com/rss/12040",
    "https://www.espn.com/espn/rss/soccer/news",
    "http://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://www.90min.com/posts.rss"
]

# 1. THE "VIP LIST" - If the title has these, POST IT. No questions asked.
ALWAYS_POST_TEAMS = [
    "man utd", "manchester united", "liverpool", "arsenal", "chelsea", "man city", 
    "tottenham", "spurs", "newcastle", "aston villa",
    "real madrid", "barcelona", "bayern", "juventus", "psg", "inter milan", "ac milan",
    "messi", "ronaldo", "mbappe", "haaland", "bellingham", "kane", "salah",
    "england", "brazil", "france", "argentina", "germany", "spain",
    "champions league", "europa league", "world cup", "euro 2024", "euro 2028"
]

# 2. THE BLACKLIST - Skip these immediately.
BLACKLIST_KEYWORDS = [
    "podcast", "how to watch", "live stream", "betting", "odds", "quiz", 
    "fantasy", "prediction", "women's super league", "u21", "u18", 
    "league one", "league two", "championship"
]

HISTORY_FILE = "history.json"

def setup_env():
    fb_token = os.environ.get("FB_PAGE_ACCESS_TOKEN")
    page_id = os.environ.get("FB_PAGE_ID")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    if not all([fb_token, page_id, gemini_key]):
        raise Exception("Missing Environment Variables.")
    
    genai.configure(api_key=gemini_key)
    return fb_token, page_id

def is_top_tier(title):
    """
    Hybrid Filter: 
    1. Check Keywords (Fast)
    2. Ask AI (Smart fallback)
    """
    title_lower = title.lower()

    # CHECK 1: Is it a VIP team?
    for vip in ALWAYS_POST_TEAMS:
        if vip in title_lower:
            print(f"-> MATCHED VIP KEYWORD: {vip}")
            return True

    # CHECK 2: Ask AI if we aren't sure
    print("-> No keyword match. Asking AI...")
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = (
            f"Is this football headline about a major top-tier team/player "
            f"(Premier League, La Liga, UCL, or International)? "
            f"Headline: '{title}'. "
            f"Reply 'YES' if it is major news. Reply 'NO' if it is lower league, irrelevant, or minor news."
        )
        response = model.generate_content(prompt)
        answer = response.text.strip().upper()
        print(f"-> AI Answered: {answer}")
        
        return "YES" in answer
    except Exception as e:
        print(f"-> AI Check Failed: {e}")
        return False

def get_ai_rewrite(title, description):
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = (
            f"Act as a football news page. Headline: '{title}'. Summary: '{description}'. "
            f"Write a 1-sentence engaging caption for Facebook. "
            f"Use emojis. Add 3 hashtags. "
            f"Do not mention the source."
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except:
        return f"⚽ {title}\n\n#Football"

def get_hd_image(article_url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(article_url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            return og_image["content"]
    except:
        pass
    return None

def extract_backup_image(entry):
    if 'media_content' in entry: return entry.media_content[0]['url']
    if 'media_thumbnail' in entry: return entry.media_thumbnail[0]['url']
    if 'enclosures' in entry:
        for enc in entry.enclosures:
            if 'image' in enc.type: return enc.href
    return None

def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r') as f:
            return json.load(f)
    return []

def save_history(history):
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history[-100:], f)

def main():
    print("--- Starting Hybrid Football Bot ---")
    fb_token, page_id = setup_env()
    graph = facebook.GraphAPI(fb_token)
    history = load_history()
    
    random.shuffle(RSS_FEEDS)
    posted = False

    for url in RSS_FEEDS:
        if posted: break
        print(f"\nChecking Feed: {url}...")
        
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                link = entry.link
                title = entry.title
                
                # Check duplication
                if link in history: continue
                
                # Check blacklist
                if any(bad in title.lower() for bad in BLACKLIST_KEYWORDS): 
                    continue

                print(f"Analyzing: {title}")

                # RUN THE FILTER
                if not is_top_tier(title):
                    print("-> Skipped (Not Top Tier)")
                    continue
                
                print("-> PROCESSING POST...")

                # Get Image
                img_url = get_hd_image(link)
                if not img_url:
                    img_url = extract_backup_image(entry)
                
                if not img_url: 
                    print("-> No image found. Skipping.")
                    continue

                # Generate Text
                description = entry.get('summary', title)
                ai_caption = get_ai_rewrite(title, description)
                print(f"-> Generated Caption: {ai_caption}")

                # Post
                headers = {'User-Agent': 'Mozilla/5.0'} 
                img_data = requests.get(img_url, headers=headers).content
                graph.put_photo(image=img_data, message=ai_caption)
                
                print("SUCCESSFULLY POSTED!")
                history.append(link)
                save_history(history)
                posted = True
                break 
                
        except Exception as e:
            print(f"Feed Error: {e}")

if __name__ == "__main__":
    main()
