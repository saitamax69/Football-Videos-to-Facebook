# src/api/facebook_client.py
"""
Facebook Graph API Client for posting videos to a Facebook Page.
API Documentation: https://developers.facebook.com/docs/graph-api/
"""

import aiohttp
import asyncio
from typing import Optional
from urllib.parse import urlencode

from src.utils.logger import get_logger


logger = get_logger(__name__)


class FacebookAPIError(Exception):
    """Custom exception for Facebook API errors."""
    def __init__(self, message: str, error_code: int = None, error_subcode: int = None):
        self.message = message
        self.error_code = error_code
        self.error_subcode = error_subcode
        super().__init__(self.message)


class FacebookClient:
    """Client for posting to Facebook Pages via Graph API."""
    
    BASE_URL = "https://graph.facebook.com/v18.0"
    
    def __init__(self, page_id: str, access_token: str):
        self.page_id = page_id
        self.access_token = access_token
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=60)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session
    
    async def close(self):
        """Close the aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def post_video(
        self,
        video_url: str,
        caption: str,
        video_data: dict = None,
        max_retries: int = 3
    ) -> dict:
        """
        Post a video to the Facebook Page.
        
        For external videos/links, we post as a link with preview.
        
        Args:
            video_url: URL to the video
            caption: Post caption/message
            video_data: Additional video metadata
            max_retries: Number of retry attempts
            
        Returns:
            Dict with 'success' boolean and 'post_id' or 'error'
        """
        session = await self._get_session()
        
        for attempt in range(max_retries):
            try:
                # Post as a link (videos from external sources)
                result = await self._post_link(session, video_url, caption)
                return result
                
            except FacebookAPIError as e:
                logger.error(f"Facebook API error: {e.message}")
                
                # Handle specific error codes
                if e.error_code == 190:  # Invalid access token
                    return {
                        'success': False,
                        'error': 'Invalid or expired access token'
                    }
                
                if e.error_code == 368:  # Temporarily blocked
                    return {
                        'success': False,
                        'error': 'Page temporarily blocked from posting'
                    }
                
                if e.error_code in [1, 2]:  # Temporary issues
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        logger.info(f"Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                
                return {
                    'success': False,
                    'error': e.message,
                    'error_code': e.error_code
                }
            
            except aiohttp.ClientError as e:
                logger.error(f"Network error posting to Facebook: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    return {
                        'success': False,
                        'error': f'Network error: {e}'
                    }
            
            except Exception as e:
                logger.exception(f"Unexpected error posting to Facebook: {e}")
                return {
                    'success': False,
                    'error': str(e)
                }
        
        return {
            'success': False,
            'error': 'Max retries exceeded'
        }
    
    async def _post_link(
        self,
        session: aiohttp.ClientSession,
        link_url: str,
        message: str
    ) -> dict:
        """Post a link to the page feed."""
        url = f"{self.BASE_URL}/{self.page_id}/feed"
        
        data = {
            'message': message,
            'link': link_url,
            'access_token': self.access_token
        }
        
        async with session.post(url, data=data) as response:
            result = await response.json()
            
            if 'error' in result:
                error = result['error']
                raise FacebookAPIError(
                    message=error.get('message', 'Unknown error'),
                    error_code=error.get('code'),
                    error_subcode=error.get('error_subcode')
                )
            
            if 'id' in result:
                return {
                    'success': True,
                    'post_id': result['id']
                }
            
            return {
                'success': False,
                'error': 'Unexpected response format'
            }
    
    async def post_video_direct(
        self,
        video_url: str,
        title: str,
        description: str
    ) -> dict:
        """
        Post a video directly (requires video to be accessible).
        
        Note: This requires the video URL to be directly downloadable.
        """
        session = await self._get_session()
        url = f"{self.BASE_URL}/{self.page_id}/videos"
        
        data = {
            'file_url': video_url,
            'title': title,
            'description': description,
            'access_token': self.access_token
        }
        
        try:
            async with session.post(url, data=data) as response:
                result = await response.json()
                
                if 'error' in result:
                    error = result['error']
                    raise FacebookAPIError(
                        message=error.get('message', 'Unknown error'),
                        error_code=error.get('code')
                    )
                
                if 'id' in result:
                    return {
                        'success': True,
                        'video_id': result['id']
                    }
                
                return {
                    'success': False,
                    'error': 'Unexpected response'
                }
                
        except FacebookAPIError:
            raise
        except Exception as e:
            logger.exception(f"Error in direct video post: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def verify_token(self) -> dict:
        """Verify the access token is valid and has required permissions."""
        session = await self._get_session()
        url = f"{self.BASE_URL}/me"
        
        params = {
            'access_token': self.access_token,
            'fields': 'id,name,access_token'
        }
        
        try:
            async with session.get(f"{url}?{urlencode(params)}") as response:
                result = await response.json()
                
                if 'error' in result:
                    return {
                        'valid': False,
                        'error': result['error'].get('message')
                    }
                
                return {
                    'valid': True,
                    'page_id': result.get('id'),
                    'page_name': result.get('name')
                }
                
        except Exception as e:
            return {
                'valid': False,
                'error': str(e)
            }
    
    async def get_page_info(self) -> dict:
        """Get information about the Facebook Page."""
        session = await self._get_session()
        url = f"{self.BASE_URL}/{self.page_id}"
        
        params = {
            'access_token': self.access_token,
            'fields': 'id,name,fan_count,link'
        }
        
        try:
            async with session.get(f"{url}?{urlencode(params)}") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error fetching page info: {e}")
            return {'error': str(e)}
