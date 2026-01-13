import requests
import re

url = "https://www.scorebat.com/embed/v/6962d10715602/?utm_source=api&utm_medium=video&utm_campaign=dflt"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

print(f"Fetching: {url}\n")
response = requests.get(url, headers=headers)

print(f"Status: {response.status_code}")
print(f"Content length: {len(response.text)}")
print("\n" + "="*60)
print("LOOKING FOR VIDEO SOURCES...")
print("="*60)

html = response.text

# Find all iframes
iframes = re.findall(r'<iframe[^>]+src=["\']?([^"\'>\s]+)["\']?', html)
print(f"\nIframes found: {len(iframes)}")
for i, iframe in enumerate(iframes):
    print(f"  {i+1}. {iframe}")

# Find all video/source tags
videos = re.findall(r'<(?:video|source)[^>]+src=["\']?([^"\'>\s]+)["\']?', html)
print(f"\nVideo/Source tags: {len(videos)}")
for v in videos:
    print(f"  - {v}")

# Find any URLs that look like video platforms
platforms = re.findall(r'(https?://(?:www\.)?(dailymotion|ok\.ru|youtube|streamable|streamja|streamff)[^\s"\'<>]+)', html)
print(f"\nKnown platforms: {len(platforms)}")
for p in platforms:
    print(f"  - {p[0]}")

# Find any .mp4 or .m3u8 URLs
media = re.findall(r'(https?://[^\s"\'<>]+\.(?:mp4|m3u8|webm))', html)
print(f"\nDirect media files: {len(media)}")
for m in media:
    print(f"  - {m}")

# Print first 2000 chars of HTML for manual inspection
print("\n" + "="*60)
print("HTML PREVIEW (first 2000 chars):")
print("="*60)
print(html[:2000])
