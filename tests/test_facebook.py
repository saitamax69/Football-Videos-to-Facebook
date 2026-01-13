# tests/test_facebook.py
"""Tests for Facebook client."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.api.facebook_client import FacebookClient, FacebookAPIError


@pytest.fixture
def fb_client():
    return FacebookClient("page_id_123", "access_token_abc")


class TestFacebookClient:
    
    def test_init(self, fb_client):
        assert fb_client.page_id == "page_id_123"
        assert fb_client.access_token == "access_token_abc"
    
    @pytest.mark.asyncio
    async def test_post_video_success(self, fb_client):
        with patch.object(fb_client, '_get_session') as mock_session:
            mock_response = AsyncMock()
            mock_response.json = AsyncMock(return_value={"id": "post_12345"})
            
            mock_session.return_value.post = MagicMock(
                return_value=AsyncMock(__aenter__=AsyncMock(return_value=mock_response))
            )
            
            result = await fb_client.post_video(
                video_url="https://example.com/video.mp4",
                caption="Test caption"
            )
            
            assert result['success'] is True
            assert result['post_id'] == "post_12345"
    
    @pytest.mark.asyncio
    async def test_post_video_error(self, fb_client):
        with patch.object(fb_client, '_get_session') as mock_session:
            mock_response = AsyncMock()
            mock_response.json = AsyncMock(return_value={
                "error": {
                    "message": "Invalid token",
                    "code": 190
                }
            })
            
            mock_session.return_value.post = MagicMock(
                return_value=AsyncMock(__aenter__=AsyncMock(return_value=mock_response))
            )
            
            result = await fb_client.post_video(
                video_url="https://example.com/video.mp4",
                caption="Test caption"
            )
            
            assert result['success'] is False
