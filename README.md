# Global Score News Autopost

Automated Facebook posting for football match updates with random timing.

## Features

- ✅ Random posting times (10-14 posts/day)
- ✅ Avoids duplicate posts
- ✅ Peak hour awareness
- ✅ Anti-shadow-ban protection
- ✅ Uses free Groq AI

## Setup

1. Add GitHub Secrets:
   - `SPORTDB_API_KEY`
   - `GROQ_API_KEY`
   - `FB_PAGE_ID`
   - `FB_PAGE_ACCESS_TOKEN`

2. The workflow runs every 30 minutes but posts randomly

## Manual Post

Go to Actions → Run workflow → Set force_post to true
