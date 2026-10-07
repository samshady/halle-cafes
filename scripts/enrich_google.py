#!/usr/bin/env python3
"""
enrich_google.py
Optional enhancement script.
If GOOGLE_PLACES_API_KEY is present in the environment, queries Google Places API (New)
for verified Google ratings, review counts, price levels, and photo references.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

def enrich_cafe(cafe, key):
    url = "https://places.googleapis.com/v1/places:searchText"
    query = f"{cafe['name']} {cafe.get('address', '')} Halle (Saale)"
    body = json.dumps({
        "textQuery": query,
        "locationBias": {
            "circle": {
                "center": {"latitude": cafe["lat"], "longitude": cafe["lon"]},
                "radius": 400.0
            }
        }
    }).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.googleMapsUri,places.websiteUri"
    }

    req = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            places = data.get("places", [])
            if places:
                p = places[0]
                cafe["google_place_id"] = p.get("id")
                cafe["google_rating"] = p.get("rating")
                cafe["google_review_count"] = p.get("userRatingCount")
                cafe["google_price_level"] = p.get("priceLevel")
                if p.get("googleMapsUri"):
                    cafe["google_maps_url"] = p.get("googleMapsUri")
                if not cafe.get("website") and p.get("websiteUri"):
                    cafe["website"] = p.get("websiteUri")
                print(f"✓ {cafe['name']}: {p.get('rating')}★ ({p.get('userRatingCount')} reviews)")
            else:
                print(f"- {cafe['name']}: No Google place match found")
        time.sleep(0.1)
    except Exception as e:
        print(f"Error enriching {cafe['name']}: {e}", file=sys.stderr)

def main():
    if not PLACES_API_KEY:
        print("Note: GOOGLE_PLACES_API_KEY environment variable is not set.")
        print("To enrich with Google ratings & reviews, run:")
        print("  export GOOGLE_PLACES_API_KEY='your_api_key_here'")
        print("  python3 scripts/enrich_google.py")
        sys.exit(0)

    cafes_path = "data/cafes.json"
    if not os.path.exists(cafes_path):
        print("data/cafes.json not found. Run scripts/build_dataset.py first.")
        sys.exit(1)

    with open(cafes_path, "r", encoding="utf-8") as f:
        cafes = json.load(f)

    print(f"Enriching {len(cafes)} cafes with Google Places API...")
    for c in cafes:
        enrich_cafe(c, PLACES_API_KEY)

    with open(cafes_path, "w", encoding="utf-8") as f:
        json.dump(cafes, f, indent=2, ensure_ascii=False)

    # Also update js/data.js
    with open("js/data.js", "w", encoding="utf-8") as f:
        f.write(f"// Generated Halle Cafes with Google Places enrichment\nexport const CAFES_DATA = {json.dumps(cafes, indent=2, ensure_ascii=False)};\n")

    print("Google Places enrichment complete!")

if __name__ == "__main__":
    main()
