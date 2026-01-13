import os
import sys
import asyncio
from datetime import datetime, timezone

from src.api.rapidapi_client import RapidAPIClient
from src.api.facebook_client import FacebookClient
from src.storage.video_tracker import VideoTracker
from src.utils.logger import setup_logger, get_logger
from src.utils.hashtags import generate_hashtags

setup_logger()
logger = get_logger(__name__)

class FootballVideoBot:
    def __init__(self):
        self.rapidapi_key = os.environ.get('RAPIDAPI_KEY')
        self.fb_page_id = os.environ.get('FACEBOOK_PAGE_ID')
        self.fb_access_token = os.environ.get('FACEBOOK_ACCESS_TOKEN')
        self.dry_run = os.environ.get('DRY_RUN', 'false').lower() == 'true'
        self.max_videos = int(os.environ.get('MAX_VIDEOS', '3'))
        
        self.rapidapi = RapidAPIClient(self.rapidapi_key)
        self.facebook = FacebookClient(self.fb_page_id, self.fb_access_token)
        self.tracker = VideoTracker()
        
        self.stats = {'fetched': 0, 'posted': 0, 'skipped': 0, 'errors': 0}
    
    async def run(self):
        logger.info("=" * 60)
        logger.info("Football Video Bot (Reliable Edition)")
        
        try:
            logger.info("Fetching videos from RapidAPI...")
            videos = await self.rapidapi.fetch_goal_videos()
            logger.info(f"Found {len(videos)} videos")
            
            new_videos = self._filter_new_videos(videos)
            logger.info(f"{len(new_videos)} new videos to process")
            
            videos_to_post = new_videos[:self.max_videos]
            
            for video in videos_to_post:
                await self._process_video(video)
                if not self.dry_run:
                    await asyncio.sleep(5)
            
            self.tracker.save()
            logger.info(f"Run Complete. Posted: {self.stats['posted']}")
            
        finally:
            await self.rapidapi.close()
            await self.facebook.close()
    
    def _filter_new_videos(self, videos: list) -> list:
        new_videos = []
        for video in videos:
            vid_id = video.get('title') + video.get('date', '')
            if not self.tracker.is_posted(vid_id):
                new_videos.append(video)
        return new_videos
    
    async def _process_video(self, video: dict):
        title = video.get('title', 'Football Highlights')
        watch_url = video.get('url')
        thumbnail_url = video.get('thumbnail')
        
        if not watch_url:
            return

        logger.info(f"Processing: {title}...")

        # Create Caption
        caption = f"⚽ {title}\n\n🏆 {video.get('competition', {}).get('name', '')}\n\n"
        caption += f"📺 WATCH HERE: {watch_url}\n\n"
        
        hashtags = generate_hashtags(video)
        if hashtags:
            caption += ' '.join(hashtags)

        vid_id = title + video.get('date', '')

        if self.dry_run:
            logger.info(f"[DRY RUN] Would post: {title}")
            self.stats['posted'] += 1
            self.tracker.mark_posted(vid_id)
            return

        # 1. TRY POSTING PHOTO WITH LINK (Looks like a video preview)
        success = False
        if thumbnail_url:
            logger.info(f"Posting Thumbnail: {thumbnail_url}")
            result = await self.facebook.post_photo(thumbnail_url, caption)
            if result['success']:
                success = True
                logger.info(f"✅ Posted Photo successfully! ID: {result['post_id']}")

        # 2. FALLBACK: POST LINK
        if not success:
            logger.info("Posting Link (Fallback)...")
            result = await self.facebook.post_video(watch_url, caption)
            if result['success']:
                success = True
                logger.info(f"✅ Posted Link successfully! ID: {result['post_id']}")
            else:
                logger.error(f"❌ Failed to post: {result.get('error')}")

        if success:
            self.stats['posted'] += 1
            self.tracker.mark_posted(vid_id)

async def main():
    bot = FootballVideoBot()
    await bot.run()

if __name__ == '__main__':
    asyncio.run(main())
