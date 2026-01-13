import os
import yt_dlp
from src.utils.logger import get_logger

logger = get_logger(__name__)

def download_video(url: str, output_filename: str = "temp_video.mp4") -> str:
    """
    Attempts to download a video from a direct URL using yt-dlp.
    """
    if os.path.exists(output_filename):
        os.remove(output_filename)

    ydl_opts = {
        'format': 'best[ext=mp4]/best', 
        'outtmpl': output_filename,
        'quiet': True,
        'no_warnings': True,
    }

    logger.info(f"⬇️ Attempting download from: {url}")
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        if os.path.exists(output_filename):
            return output_filename
        return None
            
    except Exception:
        return None
