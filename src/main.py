# src/main.py
"""
Football Video Bot - Main Entry Point
Fetches football videos and posts them to Facebook
"""

import os
import sys
import asyncio
from datetime import datetime

from src.api.rapidapi_client import RapidAPIClient
from src.api.facebook_client import FacebookClient
from src.storage.video_tracker import VideoTracker
from src.utils.logger import setup_logger, get_logger
from src.utils.hashtags import generate_hashtags


# Setup logging
setup_logger()
logger = get_logger(__name__)


class FootballVideoBot:
    """Main bot class that orchestrates video fetching and posting."""
    
    def __init__(self):
        self.rapidapi_key = os.environ.get('RAPIDAPI_KEY')
        self.fb_page_id = os.environ.get('FACEBOOK_PAGE_ID')
        self.fb_access_token = os.environ.get('FACEBOOK_ACCESS_TOKEN')
        self.dry_run = os.environ.get('DRY_RUN', 'false').lower() == 'true'
        self.max_videos = int(os.environ.get('MAX_VIDEOS', '3'))
        
        self._validate_config()
        
        self.rapidapi = RapidAPIClient(self.rapidapi_key)
        self.facebook = FacebookClient(self.fb_page_id, self.fb_access_token)
        self.tracker = VideoTracker()
        
        # Run statistics
        self.stats = {
            'fetched': 0,
            'posted': 0,
            'skipped': 0,
            'errors': 0
        }
    
    def _validate_config(self):
        """Validate all required configuration is present."""
        missing = []
        if not self.rapidapi_key:
            missing.append('RAPIDAPI_KEY')
        if not self.fb_page_id:
            missing.append('FACEBOOK_PAGE_ID')
        if not self.fb_access_token:
            missing.append('FACEBOOK_ACCESS_TOKEN')
        
        if missing:
            logger.error(f"Missing required environment variables: {', '.join(missing)}")
            raise EnvironmentError(f"Missing: {', '.join(missing)}")
        
        logger.info("✅ Configuration validated successfully")
        if self.dry_run:
            logger.info("🔶 DRY RUN MODE - No posts will be made to Facebook")
    
    async def run(self):
        """Main execution flow."""
        logger.info("=" * 60)
        logger.info("🏈 Football Video Bot Starting")
        logger.info(f"⏰ Time: {datetime.utcnow().isoformat()}Z")
        logger.info("=" * 60)
        
        try:
            # Step 1: Fetch videos from RapidAPI
            logger.info("\n📥 Fetching videos from RapidAPI...")
            videos = await self.rapidapi.fetch_goal_videos()
            self.stats['fetched'] = len(videos)
            logger.info(f"   Found {len(videos)} videos")
            
            if not videos:
                logger.warning("No videos returned from API")
                return
            
            # Step 2: Filter out already posted videos
            new_videos = self._filter_new_videos(videos)
            logger.info(f"   {len(new_videos)} new videos to process")
            
            if not new_videos:
                logger.info("✅ No new videos to post")
                return
            
            # Step 3: Post new videos (limited by max_videos)
            videos_to_post = new_videos[:self.max_videos]
            logger.info(f"\n📤 Posting {len(videos_to_post)} videos to Facebook...")
            
            for video in videos_to_post:
                await self._process_video(video)
                # Rate limiting - wait between posts
                if not self.dry_run:
                    await asyncio.sleep(5)
            
            # Step 4: Save tracker
            self.tracker.save()
            
            # Step 5: Generate report
            self._generate_report()
            
            logger.info("\n" + "=" * 60)
            logger.info("✅ Football Video Bot Completed Successfully")
            logger.info(f"   Posted: {self.stats['posted']}, Skipped: {self.stats['skipped']}, Errors: {self.stats['errors']}")
            logger.info("=" * 60)
            
        except Exception as e:
            logger.exception(f"❌ Fatal error in bot execution: {e}")
            self.stats['errors'] += 1
            self._generate_report()
            raise
    
    def _filter_new_videos(self, videos: list) -> list:
        """Filter out videos that have already been posted."""
        new_videos = []
        for video in videos:
            video_id = video.get('id') or video.get('url')
            if self.tracker.is_posted(video_id):
                self.stats['skipped'] += 1
                logger.debug(f"   Skipping already posted: {video.get('title', video_id)[:50]}")
            else:
                new_videos.append(video)
        return new_videos
    
    async def _process_video(self, video: dict):
        """Process and post a single video."""
        video_id = video.get('id') or video.get('url')
        title = video.get('title', 'Football Goal')
        
        try:
            logger.info(f"\n   📹 Processing: {title[:60]}...")
            
            # Generate caption with hashtags
            caption = self._create_caption(video)
            
            # Get video URL
            video_url = self._extract_video_url(video)
            
            if not video_url:
                logger.warning(f"   ⚠️ No video URL found for: {title}")
                self.stats['errors'] += 1
                return
            
            # Post to Facebook
            if self.dry_run:
                logger.info(f"   🔶 [DRY RUN] Would post: {title[:50]}")
                logger.debug(f"   Caption: {caption[:100]}...")
                logger.debug(f"   URL: {video_url}")
            else:
                result = await self.facebook.post_video(
                    video_url=video_url,
                    caption=caption,
                    video_data=video
                )
                
                if result.get('success'):
                    logger.info(f"   ✅ Posted successfully! Post ID: {result.get('post_id')}")
                    self.stats['posted'] += 1
                else:
                    logger.error(f"   ❌ Failed to post: {result.get('error')}")
                    self.stats['errors'] += 1
                    return
            
            # Mark as posted
            self.tracker.mark_posted(video_id, {
                'title': title,
                'url': video_url,
                'posted_at': datetime.utcnow().isoformat()
            })
            
            if self.dry_run:
                self.stats['posted'] += 1
                
        except Exception as e:
            logger.exception(f"   ❌ Error processing video {video_id}: {e}")
            self.stats['errors'] += 1
    
    def _create_caption(self, video: dict) -> str:
        """Create Facebook post caption with hashtags."""
        title = video.get('title', 'Football Goal')
        competition = video.get('competition', {}).get('name', '')
        
        # Clean title
        caption_parts = [f"⚽ {title}"]
        
        # Add match info if available
        if video.get('matchviewUrl'):
            caption_parts.append(f"\n🔗 Full Match: {video.get('matchviewUrl')}")
        
        # Add video URL
        videos = video.get('videos', [])
        if videos:
            embed = videos[0].get('embed', '')
            if embed:
                caption_parts.append(f"\n📺 Watch: {videos[0].get('url', '')}")
        
        # Generate and add hashtags
        hashtags = generate_hashtags(video)
        if hashtags:
            caption_parts.append(f"\n\n{' '.join(hashtags)}")
        
        return '\n'.join(caption_parts)
    
    def _extract_video_url(self, video: dict) -> str:
        """Extract the best video URL from video data."""
        # Try embedded videos first
        videos = video.get('videos', [])
        for v in videos:
            if v.get('url'):
                return v['url']
        
        # Fallback to matchview URL
        if video.get('matchviewUrl'):
            return video['matchviewUrl']
        
        # Last resort - use embed
        for v in videos:
            if v.get('embed'):
                # Extract URL from embed if possible
                embed = v['embed']
                if 'src="' in embed:
                    start = embed.find('src="') + 5
                    end = embed.find('"', start)
                    return embed[start:end]
        
        return None
    
    def _generate_report(self):
        """Generate JSON report for GitHub Actions summary."""
        import json
        report_path = 'data/run_report.json'
        
        try:
            with open(report_path, 'w') as f:
                json.dump(self.stats, f, indent=2)
            logger.debug(f"Report saved to {report_path}")
        except Exception as e:
            logger.warning(f"Could not save report: {e}")


async def main():
    """Entry point."""
    bot = FootballVideoBot()
    await bot.run()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n🛑 Bot stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"Bot failed with error: {e}")
        sys.exit(1)
