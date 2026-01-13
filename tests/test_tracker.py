# tests/test_tracker.py
"""Tests for video tracker."""

import pytest
import os
import tempfile

from src.storage.video_tracker import VideoTracker, VideoTrackerMemory


class TestVideoTrackerMemory:
    
    def test_is_posted_empty(self):
        tracker = VideoTrackerMemory()
        assert tracker.is_posted("video123") is False
    
    def test_mark_posted(self):
        tracker = VideoTrackerMemory()
        tracker.mark_posted("video123", {"title": "Test"})
        assert tracker.is_posted("video123") is True
    
    def test_get_posted_video(self):
        tracker = VideoTrackerMemory()
        tracker.mark_posted("video123", {"title": "Test Video"})
        video = tracker.get_posted_video("video123")
        assert video is not None
        assert video['title'] == "Test Video"
    
    def test_clear(self):
        tracker = VideoTrackerMemory()
        tracker.mark_posted("video1")
        tracker.mark_posted("video2")
        tracker.clear()
        assert tracker.is_posted("video1") is False


class TestVideoTrackerFile:
    
    def test_save_and_load(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            filepath = f.name
        
        try:
            # Create and save
            tracker1 = VideoTracker(filepath)
            tracker1.mark_posted("video1", {"title": "Test"})
            tracker1.save()
            
            # Load in new instance
            tracker2 = VideoTracker(filepath)
            assert tracker2.is_posted("video1") is True
            
        finally:
            if os.path.exists(filepath):
                os.unlink(filepath)
    
    def test_get_stats(self):
        tracker = VideoTrackerMemory()
        tracker.mark_posted("video1")
        tracker.mark_posted("video2")
        
        stats = tracker.get_stats()
        assert stats['total_posted'] == 2
