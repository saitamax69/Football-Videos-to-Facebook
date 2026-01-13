# src/api/rapidapi_client.py
"""
RapidAPI Client for Free Football Videos API
"""

import aiohttp
import asyncio
from typing import Optional

from src.utils.logger import get_logger

logger = get_logger(__name__)


class RapidAPIError(Exception):
    """Custom exception for RapidAPI errors."""
    pass


class RapidAPIClient:
    """Client for fetching football videos from RapidAPI."""
    
    BASE_URL = "https://free-football-soccer-videos.p.rapidapi.com"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": "free-football-soccer-videos.p.rapidapi.com"
        }
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self._session = aiohttp.ClientSession(
                headers=self.headers,
                timeout=timeout
            )
        return self._session
    
    async def close(self):
        """Close the aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
    
    async def fetch_goal_videos(self, max_retries: int = 3) -> list:
        """Fetch latest goal videos from the API."""
        session = await self._get_session()
        
        for attempt in range(max_retries):
            try:
                async with session.get(f"{self.BASE_URL}/") as response:
                    logger.info(f"API Response Status: {response.status}")
                    
                    if response.status == 200:
                        videos = await response.json()
                        
                        if isinstance(videos, dict):
                            videos = videos.get('videos', videos.get('data', []))
                        
                        if not isinstance(videos, list):
                            logger.warning(f"Unexpected response format: {type(videos)}")
                            await self.close()
                            return []
                        
                        logger.info(f"API returned {len(videos)} videos total")
                        await self.close()
                        return videos[:20]
                    
                    elif response.status == 429:
                        retry_after = int(response.headers.get('Retry-After', 60))
                        logger.warning(f"Rate limited. Waiting {retry_after}s...")
                        await asyncio.sleep(retry_after)
                        continue
                    
                    elif response.status == 401:
                        await self.close()
                        raise RapidAPIError("Invalid API key")
                    
                    elif response.status == 403:
                        await self.close()
                        raise RapidAPIError("API access forbidden")
                    
                    else:
                        error_text = await response.text()
                        logger.warning(f"API error {response.status}: {error_text[:200]}")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(2 ** attempt)
                        
            except aiohttp.ClientError as e:
                logger.error(f"Network error: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                else:
                    await self.close()
                    raise RapidAPIError(f"Network error: {e}")
        
        await self.close()
        return []

    async def health_check(self) -> bool:
        """Check if the API is accessible."""
        try:
            session = await self._get_session()
            async with session.get(f"{self.BASE_URL}/") as response:
                result = response.status == 200
                await self.close()
                return result
        except Exception:
            await self.close()
            return False
