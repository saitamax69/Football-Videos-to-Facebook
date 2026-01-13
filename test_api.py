import requests

API_KEY = "ae21deba18msh01b246623956cf8p1eabc6jsn0de85d06197c"

url = "https://free-football-soccer-videos.p.rapidapi.com/"
headers = {
    "X-RapidAPI-Key": API_KEY,
    "X-RapidAPI-Host": "free-football-soccer-videos.p.rapidapi.com"
}

print("Fetching videos from RapidAPI...")
response = requests.get(url, headers=headers)

print(f"Status Code: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"Type of response: {type(data)}")
    
    if isinstance(data, list):
        print(f"Number of videos: {len(data)}")
        if data:
            print(f"\nFirst video:")
            for key, value in data[0].items():
                print(f"  {key}: {str(value)[:100]}")
    elif isinstance(data, dict):
        print(f"Keys in response: {data.keys()}")
else:
    print(f"Error: {response.text[:500]}")
