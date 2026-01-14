import os
import sys
import logging
import requests
import yt_dlp

# Logging Setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger()

# Configuration
FB_PAGE_ACCESS_TOKEN = os.getenv("FB_PAGE_ACCESS_TOKEN")
FB_PAGE_ID = os.getenv("FB_PAGE_ID")

# Default to Sky Sports, but allow override via GitHub Vars
DEFAULT_CHANNEL = "https://www.youtube.com/@SkySportsFootball/videos"
YOUTUBE_CHANNEL_URL = os.getenv("YT_CHANNEL_URL", DEFAULT_CHANNEL)

def get_latest_video_from_channel():
    """
    Uses yt-dlp to find the latest video from a specific channel.
    """
    logger.info(f"📡 Fetching latest video from: {YOUTUBE_CHANNEL_URL}")
    
    ydl_opts = {
        'quiet': True,
        'extract_flat': True, # Only get metadata, don't download yet
        'playlistend': 1,     # Get only the 1 latest video
    }
    
    # Add cookies if file exists (Bypasses "Sign in to confirm you're not a bot")
    if os.path.exists("cookies.txt"):
        logger.info("🍪 Using cookies.txt for authentication")
        ydl_opts['cookiefile'] = "cookies.txt"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(YOUTUBE_CHANNEL_URL, download=False)
            
            if 'entries' in info and len(info['entries']) > 0:
                video = info['entries'][0]
                title = video.get('title', 'Football Highlight')
                
                # Robust URL extraction
                url = video.get('url')
                video_id = video.get('id')
                
                if not url and video_id:
                    url = f"https://www.youtube.com/watch?v={video_id}"
                elif url and not url.startswith('http'):
                    url = f"https://www.youtube.com/watch?v={url}"
                
                logger.info(f"✅ Found Video: {title}")
                logger.info(f"🔗 Link: {url}")
                return {"title": title, "link": url}
            
            logger.warning("No videos found on channel.")
            return None
    except Exception as e:
        logger.error(f"❌ Channel Fetch Error: {e}")
        return None

def download_video(url):
    filename = "temp_video.mp4"
    if os.path.exists(filename): os.remove(filename)
    
    logger.info(f"⬇️ Downloading: {url}")

    ydl_opts = {
        'outtmpl': filename,
        # Get best MP4 video under 150MB
        'format': 'best[ext=mp4][filesize<150M]/best[ext=mp4]/best',
        'quiet': True,
        'no_warnings': True,
    }
    
    if os.path.exists("cookies.txt"):
        ydl_opts['cookiefile'] = "cookies.txt"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        if os.path.exists(filename):
            size = os.path.getsize(filename) / (1024 * 1024)
            logger.info(f"✅ Downloaded! Size: {size:.2f} MB")
            return filename
        logger.error("❌ Download finished but file not found.")
        return None
    except Exception as e:
        logger.error(f"❌ Download Error: {e}")
        return None

def post_to_facebook(video_path, title):
    url = f"https://graph.facebook.com/v19.0/{FB_PAGE_ID}/videos"
    caption = f"⚽ {title} \n\n#football #soccer #highlights #goals"
    
    if not FB_PAGE_ACCESS_TOKEN:
        logger.error("❌ Missing FB_PAGE_ACCESS_TOKEN")
        return

    files = {'source': open(video_path, 'rb')}
    payload = {'access_token': FB_PAGE_ACCESS_TOKEN, 'description': caption}
    
    try:
        logger.info("📤 Uploading to Facebook (this may take a minute)...")
        r = requests.post(url, data=payload, files=files, timeout=300)
        
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
    logger.info("🚀 STARTING YOUTUBE CHANNEL BOT")
    
    match = get_latest_video_from_channel()
    
    if not match:
        return

    video_path = download_video(match['link'])
    
    if video_path:
        post_to_facebook(video_path, match['title'])
    else:
        logger.error("Download failed (possibly Geoblocked, too large, or login required).")

if __name__ == "__main__":
    main()
