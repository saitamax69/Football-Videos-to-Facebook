# src/storage/video_tracker.py
"""
Video Tracker - Manages the list of already-posted videos to avoid duplicates.
"""

import json
import os
from datetime import datetime
from typing import Optional

from src.utils.logger import get_logger


logger = get_logger(__name__)


class VideoTracker:
    """Tracks posted videos to prevent duplicates."""
    
    DEFAULT_PATH = 'data/posted_videos.json'
    MAX_HISTORY = 1000  # Maximum number of videos to track
    
    def __init__(self, filepath: str = None):
        self.filepath = filepath or self.DEFAULT_PATH
        self.posted_videos = {}
        self._load()
    
    def _load(self):
        """Load posted videos from JSON file."""
        try:
            if os.path.exists(self.filepath):
                with open(self.filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.posted_videos = data.get('videos', {})
                    logger.info(f"Loaded {len(self.posted_videos)} posted videos from tracker")
            else:
                logger.info("No existing tracker file, starting fresh")
                self.posted_videos = {}
                self._ensure_directory()
                self.save()
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing tracker file: {e}")
            self.posted_videos = {}
        except Exception as e:
            logger.error(f"Error loading tracker: {e}")
            self.posted_videos = {}
    
    def _ensure_directory(self):
        """Ensure the data directory exists."""
        directory = os.path.dirname(self.filepath)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
    
    def save(self):
        """Save posted videos to JSON file."""
        try:
            self._ensure_directory()
            self._cleanup_old_entries()
            
            data = {
                'last_updated': datetime.utcnow().isoformat(),
                'total_count': len(self.posted_videos),
                'videos': self.posted_videos
            }
            
            with open(self.filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            logger.debug(f"Saved {len(self.posted_videos)} videos to tracker")
            
        except Exception as e:
            logger.error(f"Error saving tracker: {e}")
            raise
    
    def _cleanup_old_entries(self):
        """Remove old entries if we exceed MAX_HISTORY."""
        if len(self.posted_videos) <= self.MAX_HISTORY:
            return
        
        # Sort by posted_at date and keep most recent
        sorted_videos = sorted(
            self.posted_videos.items(),
            key=lambda x: x[1].get('posted_at', ''),
            reverse=True
        )
        
        self.posted_videos = dict(sorted_videos[:self.MAX_HISTORY])
        logger.info(f"Cleaned up tracker, kept {len(self.posted_videos)} most recent entries")
    
    def is_posted(self, video_id: str) -> bool:
        """Check if a video has already been posted."""
        if not video_id:
            return False
        return str(video_id) in self.posted_videos
    
    def mark_posted(self, video_id: str, metadata: dict = None):
        """Mark a video as posted."""
        if not video_id:
            return
        
        self.posted_videos[str(video_id)] = {
            'posted_at': datetime.utcnow().isoformat(),
            **(metadata or {})
        }
        logger.debug(f"Marked video {video_id} as posted")
    
    def get_posted_video(self, video_id: str) -> Optional[dict]:
        """Get metadata for a posted video."""
        return self.posted_videos.get(str(video_id))
    
    def get_stats(self) -> dict:
        """Get tracker statistics."""
        return {
            'total_posted': len(self.posted_videos),
            'filepath': self.filepath
        }
    
    def clear(self):
        """Clear all posted videos (use with caution)."""
        self.posted_videos = {}
        self.save()
        logger.warning("Cleared all posted videos from tracker")


class VideoTrackerMemory(VideoTracker):
    """In-memory version for testing (no file I/O)."""
    
    def __init__(self):
        self.filepath = ':memory:'
        self.posted_videos = {}
    
    def _load(self):
        pass
    
    def save(self):
        pass
