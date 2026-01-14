import os
import sys
import logging
import asyncio
import requests
import time
import yt_dlp
from datetime import datetime

# Logging Setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger()

# Configuration
FOOTBALL_API_KEY = os.getenv("FOOTBALL_API_KEY")
FB_PAGE_ACCESS_TOKEN = os.getenv("FB_PAGE_ACCESS_TOKEN")
FB_PAGE_ID = os.getenv("FB_PAGE_ID")

def download_tiktok_via_search(query):
    """
    Uses yt-dlp to search TikTok and download the first result directly.
    Prefix: 'ttsearch1:' means 'search TikTok and take the top 1 result'
    """
    filename = "temp_video.mp4"
    if os.path.exists(filename): os.remove(filename)
    
    search_query = f"ttsearch1:{query}"
    logger.info(f"🔍 Searching & Downloading via yt-dlp: {search_query}")

    ydl_opts = {
        'outtmpl': filename,
        'format': 'mp4', # Force MP4
        'quiet': True,
        'no_warnings': True,
        # mimic a real browser to avoid blocks
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([search_query])
            
        if os.path.exists(filename):
            logger.info("✅ Video downloaded successfully!")
            return filename
        else:
            logger.warning("❌ Download finished but file not found.")
            return None
    except Exception as e:
        logger.error(f"❌ yt-dlp Error: {e}")
        return None

def post_to_facebook(video_path, title):
    url = f"https://graph.facebook.com/v19.0/{FB_PAGE_ID}/videos"
    caption = f"🔥 {title} ⚽️ \n#football #soccer #goals #highlights"
    
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        logger.error("Missing Facebook Credentials!")
        return

    files = {'source': open(video_path, 'rb')}
    payload = {'access_token': FB_PAGE_ACCESS_TOKEN, 'description': caption}
    
    try:
        logger.info("📤 Uploading to Facebook...")
        r = requests.post(url, data=payload, files=files)
        if r.status_code == 200:
            logger.info(f"✅ Success! Posted to Facebook. ID: {r.json().get('id')}")
        else:
            logger.error(f"❌ FB Failed: {r.text}")
    except Exception as e:
        logger.error(f"FB Error: {e}")
    finally:
        files['source'].close()
        if os.path.exists(video_path):
            os.remove(video_path)

def main():
    # --- MANUAL TEST MODE ---
    # We are bypassing the football API for now to prove it works.
    target_match = "Real Madrid Goal"
    
    logger.info("🚀 STARTING ROBUST TEST RUN")
    
    # 1. Search & Download
    video_path = download_tiktok_via_search(target_match)
    
    # 2. Post
    if video_path:
        post_to_facebook(video_path, "Real Madrid Goal (Auto-Posted)")
    else:
        logger.error("Could not find video.")

if __name__ == "__main__":
    main()
