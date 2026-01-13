import aiohttp
import asyncio
import os
from typing import Optional

from src.utils.logger import get_logger

logger = get_logger(__name__)

class FacebookClient:
    """Client for posting to Facebook Pages via Graph API."""
    
    BASE_URL = "https://graph.facebook.com/v18.0"
    
    def __init__(self, page_id: str, access_token: str):
        self.page_id = page_id
        self.access_token = access_token
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
    
    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def post_local_video(self, file_path: str, description: str) -> dict:
        """Upload a local video file to Facebook."""
        session = await self._get_session()
        url = f"{self.BASE_URL}/{self.page_id}/videos"
        
        # We need to construct a FormData object for file upload
        data = aiohttp.FormData()
        data.add_field('access_token', self.access_token)
        data.add_field('description', description)
        
        # Open file and add to data
        try:
            with open(file_path, 'rb') as f:
                data.add_field('source', f, filename='video.mp4', content_type='video/mp4')
                
                # Extended timeout for video uploads (3 minutes)
                async with session.post(url, data=data, timeout=180) as response:
                    result = await response.json()
                    
                    if 'id' in result:
                        return {'success': True, 'post_id': result['id']}
                    else:
                        return {'success': False, 'error': result.get('error', {}).get('message')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    async def post_link(self, link_url: str, message: str) -> dict:
        """Fallback: Post a link if download fails."""
        session = await self._get_session()
        url = f"{self.BASE_URL}/{self.page_id}/feed"
        params = {
            'link': link_url,
            'message': message,
            'access_token': self.access_token
        }
        try:
            async with session.post(url, params=params) as response:
                result = await response.json()
                if 'id' in result:
                    return {'success': True, 'post_id': result['id']}
                return {'success': False, 'error': result.get('error')}
        except Exception as e:
            return {'success': False, 'error': str(e)}
