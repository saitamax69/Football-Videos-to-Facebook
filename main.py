import feedparser
import facebook
import os
import requests
import json
import google.generativeai as genai
import time
from datetime import datetime
from bs4 import BeautifulSoup

# --- 1. DATA SOURCES (No BBC) ---
RSS_FEEDS = [
    "https://www.skysports.com/rss/12040",           # Sky Sports (Reliable)
    "https://www.espn.com/espn/rss/soccer/news",     # ESPN (Global)
    "https://www.90min.com/posts.rss",               # 90min (Viral/Fun)
    "https://talksport.com/football/feed/",          # TalkSport (Great for debates)
    "https://www.caughtoffside.com/feed/"            # CaughtOffside (Rumors/Transfers)
]

# --- 2. FILTERS ---

# VIP LIST (Post these immediately)
ALWAYS_POST_TEAMS = [
    "man utd", "manchester united", "liverpool", "arsenal", "chelsea", "man city", 
    "tottenham", "spurs", "newcastle", "aston villa",
    "real madrid", "barcelona", "bayern", "juventus", "psg", "inter milan",
    "messi", "ronaldo", "mbappe", "haaland", "bellingham", "kane", "salah", "yamal",
    "breaking", "official", "confirmed", "agreement", "here we go"
]

# IGNORE LIST (Women's Football + Junk)
BLACKLIST_KEYWORDS = [
    # Junk
    "podcast", "how to watch", "live stream", "betting", "odds", "quiz", "fantasy", "prediction",
    # Women's Football specific blocks
    "women", "women's", "wsl", "lionesses", "kerr", "earps", "bronze", "wiegman", "hayes", 
    "hamano", "mead", "williamson", "russo", "ladies", "she", "her" 
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

def collect_and_sort_news():
    """ Gather news from all feeds and sort by Newest First """
    all_articles = []
    print("--- Gathering News from Sky, ESPN, TalkSport, 90min ---")

    for url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                # Time sorting logic
                published_time = entry.get('published_parsed', entry.get('updated_parsed'))
                timestamp = time.mktime(published_time) if published_time else 0 

                article = {
                    "title": entry.title,
                    "link": entry.link,
                    "summary": entry.get('summary', ''),
                    "timestamp": timestamp,
                    "raw_entry": entry
                }
                all_articles.append(article)
        except Exception as e:
            print(f"Error fetching {url}: {e}")

    # Sort: Newest is Index 0
    return sorted(all_articles, key=lambda x: x['timestamp'], reverse=True)

def is_top_tier(title):
    title_lower = title.lower()

    # 1. Check VIP Keywords
    for vip in ALWAYS_POST_TEAMS:
        if vip in title_lower:
            print(f"-> HOT TOPIC: {vip}")
            return True

    # 2. Ask AI (Strict Filter)
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = (
            f"Is this headline about a major Men's Football team (Top 5 Leagues/International)? "
            f"Headline: '{title}'. "
            f"Reply 'YES' ONLY if it is major men's football news. "
            f"Reply 'NO' if it is Women's football, lower leagues, or irrelevant."
        )
        response = model.generate_content(prompt)
        return "YES" in response.text.strip().upper()
    except:
        return False

def get_ai_rewrite(title, description):
    """ 
    The Engagement Engine: 
    Generates Title + Body + Question 
    """
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = (
            f"Act as a controversial football social media admin. "
            f"News: '{title}'. Context: '{description}'. "
            f"Write a Facebook post with this EXACT structure:\n"
            f"1. A short, All-Caps Hype Headline with emojis.\n"
            f"2. Two sentences explaining the news clearly.\n"
            f"3. A question asking fans for their opinion to make them comment.\n"
            f"Do not include links or 'read more'. Do not mention source names."
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except:
        # Backup if AI fails
        return f"🚨 {title}\n\nWhat are your thoughts on this? 👇\n#Football"

def get_hd_image(article_url):
    """ Scrape the High-Quality OG:Image """
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
    fb_token, page_id = setup_env()
    graph = facebook.GraphAPI(fb_token)
    history = load_history()
    
    # 1. Get ALL news sorted by newest
    articles = collect_and_sort_news()
    
    posted = False

    for article in articles:
        if posted: break
        
        title = article['title']
        link = article['link']
        
        # SKIP if seen or blacklisted
        if link in history: continue
        
        # Check blacklist (Includes Women's football keywords)
        if any(bad in title.lower() for bad in BLACKLIST_KEYWORDS): 
            continue

        print(f"\nEvaluating: {title}")
        
        # CHECK IF TOP TIER
        if not is_top_tier(title):
            print("-> Skipped (Not Top Tier / Women's / Low Priority)")
            continue

        print("-> SELECTED! Fetching content...")

        # GET IMAGE
        img_url = get_hd_image(link)
        if not img_url:
            img_url = extract_backup_image(article['raw_entry'])
        
        if not img_url:
            print("-> No image found. Skipping.")
            continue

        # GENERATE ENGAGEMENT POST
        ai_caption = get_ai_rewrite(title, article['summary'])
        print(f"-> AI Output:\n{ai_caption}")

        # POST TO FB
        try:
            headers = {'User-Agent': 'Mozilla/5.0'} 
            img_data = requests.get(img_url, headers=headers).content
            graph.put_photo(image=img_data, message=ai_caption)
            
            print(f"SUCCESS! Posted.")
            history.append(link)
            save_history(history)
            posted = True
            
        except Exception as e:
            print(f"FB Upload Error: {e}")

if __name__ == "__main__":
    main()
