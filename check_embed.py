import requests

API_KEY = "ae21deba18msh01b246623956cf8p1eabc6jsn0de85d06197c"

url = "https://free-football-soccer-videos.p.rapidapi.com/"
headers = {
    "X-RapidAPI-Key": API_KEY,
    "X-RapidAPI-Host": "free-football-soccer-videos.p.rapidapi.com"
}

response = requests.get(url, headers=headers)
data = response.json()

if data:
    video = data[0]
    print("=" * 60)
    print(f"Title: {video.get('title')}")
    print("=" * 60)
    print(f"\nMain URL: {video.get('url')}")
    print(f"\nThumbnail: {video.get('thumbnail')}")
    print(f"\nMain Embed:\n{video.get('embed', 'N/A')[:500]}")
    
    videos_list = video.get('videos', [])
    print(f"\n\nNumber of video entries: {len(videos_list)}")
    
    for i, v in enumerate(videos_list[:3]):
        print(f"\n--- Video {i+1} ---")
        print(f"Title: {v.get('title')}")
        print(f"Embed: {v.get('embed', 'N/A')[:300]}")
