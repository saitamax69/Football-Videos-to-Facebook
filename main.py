import feedparser
import facebook
import os
import requests
import json
import google.generativeai as genai
import time
import random
import html  # <--- THIS FIXES THE WEIRD NUMBERS
from bs4 import BeautifulSoup

# --- CONFIGURATION ---

# 1. YOUR TELEGRAM LINK
TELEGRAM_LINK = "https://t.me/+9uDCOJXm_R1hMzM0"

# 2. CLEAN SOURCES (No ESPN, No BBC)
RSS_FEEDS = [
    "https://www.skysports.com/rss/12040",           # Sky Sports
    "https://talksport.com/football/feed/",          # TalkSport
    "https://www.90min.com/posts.rss",               # 90min
    "https://metro.co.uk/sport/football/feed/",      # Metro
    "https://www.express.co.uk/posts/rss/78/football" # Express
]

# 3. VIP LIST (News regarding these post faster)
ALWAYS_POST_TEAMS = [
    "man utd", "manchester united", "liverpool", "arsenal", "chelsea", "man city", 
    "tottenham", "newcastle", "real madrid", "barcelona", "bayern", "juventus", 
    "mbappe", "haaland", "bellingham", "salah", "yamal", "vinicius",
    "transfers", "here we go", "official", "confirmed", "agreement"
]

# 4. BLACKLIST
BLACKLIST_KEYWORDS = [
    "podcast", "how to watch", "live stream", "betting", "odds", "quiz", "fantasy", 
    "women", "women's", "wsl", "lionesses", "ladies", "netball", "cricket", "rugby"
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

def clean_text(text):
    """ Fixes &#8216; and other ugly HTML junk """
    if not text: return ""
    # Decodes HTML entities (e.g., &amp; -> &, &#8216; -> ')
    cleaned = html.unescape(text)
    return cleaned.strip()

def collect_and_sort_news():
    all_articles = []
    print("--- Gathering News & Cleaning Text ---")

    for url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                published_time = entry.get('published_parsed', entry.get('updated_parsed'))
                timestamp = time.mktime(published_time) if published_time else 0 

                # CLEAN THE TITLE IMMEDIATELY HERE
                raw_title = entry.title
                clean_title = clean_text(raw_title)
                clean_summary = clean_text(entry.get('summary', ''))

                article = {
                    "title": clean_title,
                    "link": entry.link,
                    "summary": clean_summary,
                    "timestamp": timestamp,
                    "raw_entry": entry
                }
                all_articles.append(article)
        except:
            print(f"Skipping feed: {url}")

    return sorted(all_articles, key=lambda x: x['timestamp'], reverse=True)

def is_top_tier(title):
    title_lower = title.lower()
    
    for vip in ALWAYS_POST_TEAMS:
        if vip in title_lower:
            print(f"-> VIP NEWS: {vip}")
            return True
            
    if any(bad in title_lower for bad in BLACKLIST_KEYWORDS):
        return False

    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = (
            f"Is this headline interesting for a massive global football page? "
            f"Headline: '{title}'. "
            f"Reply 'YES' if it is Major League News, Transfers, or Big Drama. "
            f"Reply 'NO' if it is boring, lower league, or irrelevant."
        )
        response = model.generate_content(prompt)
        return "YES" in response.text.strip().upper()
    except:
        return False

def get_premium_media_rewrite(title, description):
    """ 
    New 'Global Media House' Persona. 
    Professional, Clean, Hype.
    """
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = (
            f"You are the Chief Editor of 'Global Score Updates', a premium football media page. "
            f"News: '{title}'. Context: '{description}'. "
            f"Write a high-quality Facebook post. "
            f"Rules:"
            f"1. Headline: Use All-Caps for the main hook with a siren emoji. "
            f"2. Body: Write 2 professional but exciting sentences explaining the news. "
            f"3. Question: Ask a debate question to force comments. "
            f"4. Call to Action: '🔥 JOIN THE VIP CHANNEL: {TELEGRAM_LINK}' "
            f"5. No HTML codes. No source names. English Only."
        )
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Double check cleanup just in case AI hallucinates
        return clean_text(text)
        
    except Exception as e:
        print(f"AI Error: {e}")
        # BETTER FALLBACK (Clean text, no weird numbers)
        return f"🚨 BREAKING NEWS: {title}\n\n👇 What are your thoughts?\n\n🔥 GET FREE TIPS HERE: {TELEGRAM_LINK}\n#Football"

def get_hd_image(article_url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(article_url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        og_image = soup.find("meta", property="og:image")
        
        if og_image and og_image.get("content"):
            img_url = og_image["content"]
            if "placeholder" in img_url or "default" in img_url:
                return None
            return img_url
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
    
    articles = collect_and_sort_news()
    
    posted = False

    for article in articles:
        if posted: break
        
        title = article['title']
        link = article['link']
        
        if link in history: continue

        print(f"\nChecking: {title}")
        
        if not is_top_tier(title):
            print("-> Skipped (Not Top Tier)")
            continue

        print("-> SELECTED! Generating Content...")

        img_url = get_hd_image(link)
        if not img_url:
            img_url = extract_backup_image(article['raw_entry'])
        
        if not img_url:
            print("-> No image found. Skipping.")
            continue

        # Generate Text
        ai_caption = get_premium_media_rewrite(title, article['summary'])
        print("-> Text Ready. Posting...")

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
