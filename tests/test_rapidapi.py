# tests/test_rapidapi.py
"""Tests for RapidAPI client."""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from src.api.rapidapi_client import RapidAPIClient, RapidAPIError


@pytest.fixture
def api_client():
    return RapidAPIClient("test_api_key")


@pytest.fixture
def sample_videos():
    return [
        {
            "id": "video1",
            "title": "Manchester United vs Liverpool - All Goals",
            "date": "2024-01-15",
            "competition": {"name": "Premier League"},
            "videos": [{"url": "https://example.com/video1.mp4"}]
        },
        {
            "id": "video2",
            "title": "Barcelona vs Real Madrid - Highlights",
            "date": "2024-01-14",
            "competition": {"name": "La Liga"},
            "videos": [{"url": "https://example.com/video2.mp4"}]
        }
    ]


class TestRapidAPIClient:
    
    def test_init(self, api_client):
        assert api_client.api_key == "test_api_key"
        assert "X-RapidAPI-Key" in api_client.headers
    
    @pytest.mark.asyncio
    async def test_fetch_goal_videos_success(self, api_client, sample_videos):
        with patch.object(api_client, '_get_session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value=sample_videos)
            
            mock_session.return_value.get = MagicMock(
                return_value=AsyncMock(__aenter__=AsyncMock(return_value=mock_response))
            )
            
            videos = await api_client.fetch_goal_videos()
            assert len(videos) > 0
    
    def test_filter_goal_videos(self, api_client, sample_videos):
        filtered = api_client._filter_goal_videos(sample_videos)
        assert len(filtered) == 2  # Both contain goal-related keywords
    
    def test_filter_goal_videos_empty(self, api_client):
        filtered = api_client._filter_goal_videos([])
        assert filtered == []
    
    @pytest.mark.asyncio
    async def test_health_check(self, api_client):
        with patch.object(api_client, '_get_session') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            
            mock_session.return_value.get = MagicMock(
                return_value=AsyncMock(__aenter__=AsyncMock(return_value=mock_response))
            )
            
            result = await api_client.health_check()
            assert result is True
