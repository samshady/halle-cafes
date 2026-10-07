#!/usr/bin/env python3
"""
build_dataset.py
Generates the canonical dataset of cafes in Halle (Saale) by unifying:
1. The user's curated desktop list (/home/sam/Desktop/cafes in halle.txt)
2. OpenStreetMap Overpass query elements (osm_halle_raw.json)
3. Verified local coordinates, addresses, and tags
Outputs both js/data.js (for the web app) and data/cafes.json.
"""

import json
import os
import re

CURATED_EXTRA = [
    {
        "id": "7-gramm",
        "name": "7 Gramm",
        "lat": 51.48544,
        "lon": 11.96991,
        "address": "Barfüßerstraße 11",
        "postcode": "06108",
        "neighborhood": "Altstadt / Uni",
        "opening_hours": "Mo-Fr 08:00-18:00; Sa 09:00-18:00; Su 10:00-17:00",
        "website": "https://7gramm.com",
        "phone": "+49 345 2082260",
        "tags": ["specialty_coffee", "espresso", "near_uni", "cakes", "visited"],
        "initial_visited": True,
        "price_level": "€€",
        "notes": "Sam's regular default hangout right next to the uni campus! Famous for single-origin specialty filter & flat whites, but this app helps you explore the rest of Halle."
    },
    {
        "id": "she-coffee",
        "name": "She Coffee",
        "lat": 51.4842,
        "lon": 11.9680,
        "address": "Kleine Ulrichstraße 24",
        "postcode": "06108",
        "neighborhood": "Altstadt",
        "opening_hours": "Mo-Su 09:00-18:00",
        "website": "",
        "phone": "",
        "tags": ["specialty_coffee", "cakes", "cozy", "visited"],
        "initial_visited": True,
        "price_level": "€€",
        "notes": "Cozy aesthetic coffee spot in the lively Kleine Ulli. Already visited and checked off!"
    },
    {
        "id": "picknick-waffles",
        "name": "Picknick Waffles & More",
        "lat": 51.48716,
        "lon": 11.96867,
        "address": "Universitätsring 6a",
        "postcode": "06108",
        "neighborhood": "Altstadt / Uni",
        "opening_hours": "Mo-Su 11:00-19:00",
        "website": "https://picknick-waffles.de",
        "phone": "+49 345 6825488",
        "tags": ["waffles", "sweets", "near_uni", "outdoor"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Signature bubble waffles, sweet toppings, and shakes right on the Universitätsring."
    },
    {
        "id": "cafe-noir",
        "name": "Café Noir",
        "lat": 51.48518,
        "lon": 11.96650,
        "address": "Kleine Ulrichstraße 30",
        "postcode": "06108",
        "neighborhood": "Altstadt",
        "opening_hours": "Tu-Sa 09:00-22:00; Su 09:00-18:00",
        "website": "https://www.cafenoir-halle.de",
        "phone": "+49 345 2029780",
        "tags": ["french", "bistro", "wine", "outdoor", "breakfast"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "French flair on the Kleine Ulrichstraße. Croissants, tarte flambée, and evening bistro atmosphere."
    },
    {
        "id": "miss-august",
        "name": "Miss August",
        "lat": 51.48710,
        "lon": 11.97136,
        "address": "August-Bebel-Straße 49",
        "postcode": "06108",
        "neighborhood": "Paulusviertel / Bebel",
        "opening_hours": "Tu-Fr 09:00-18:00; Sa-Su 10:00-18:00",
        "website": "https://miss-august.de",
        "phone": "",
        "tags": ["brunch", "vegan", "cakes", "cozy", "outdoor"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Charming cafe with plant-filled interior, homemade quiches, vegan cakes, and lovely sidewalk seating."
    },
    {
        "id": "kaffeeroesterei-roy",
        "name": "Kaffeerösterei Roy",
        "lat": 51.48344,
        "lon": 11.97492,
        "address": "Hansering 21",
        "postcode": "06108",
        "neighborhood": "Nördliche Innenstadt",
        "opening_hours": "Mo-Fr 09:00-18:00; Sa 09:00-14:00",
        "website": "https://roesterei-roy.de",
        "phone": "+49 345 2023577",
        "tags": ["specialty_coffee", "roastery", "beans", "espresso"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Traditional artisanal coffee roastery in Halle with in-house roasted single-origin beans."
    },
    {
        "id": "koffij",
        "name": "Koffij",
        "lat": 51.47915,
        "lon": 11.97886,
        "address": "Leipziger Straße 70",
        "postcode": "06108",
        "neighborhood": "Charlottenviertel",
        "opening_hours": "Mo-Sa 09:00-18:00",
        "website": "https://koffij.de",
        "phone": "+49 345 2138980",
        "tags": ["specialty_coffee", "dutch", "breakfast", "cozy"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Dutch-inspired specialty coffee shop with stroopwafels, breakfast bowls, and great roast quality."
    },
    {
        "id": "cafe-ludwig",
        "name": "Café Ludwig",
        "lat": 51.50120,
        "lon": 11.96197,
        "address": "Eichendorffstraße 20",
        "postcode": "06114",
        "neighborhood": "Giebichenstein",
        "opening_hours": "We-Su 14:00-18:00",
        "website": "https://cafeludwig-halle.de",
        "phone": "+49 345 5220300",
        "tags": ["garden", "heritage", "cakes", "scenic"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Hidden gem in Giebichenstein with a dreamy villa garden and handmade traditional German cakes."
    },
    {
        "id": "roter-horizont",
        "name": "Roter Horizont",
        "lat": 51.48557,
        "lon": 11.96654,
        "address": "Bölbergasse 1",
        "postcode": "06108",
        "neighborhood": "Altstadt",
        "opening_hours": "Tu-Sa 10:00-18:30",
        "website": "https://roter-horizont.de",
        "phone": "+49 345 2026857",
        "tags": ["tea", "coffee", "calm", "cultural"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Refined tea and coffee salon with rare teas, porcelain, and quiet conversational ambiance."
    },
    {
        "id": "colonne-morris",
        "name": "Colonne Morris",
        "lat": 51.49332,
        "lon": 11.97452,
        "address": "Mozartstraße 10 (Paulusviertel)",
        "postcode": "06114",
        "neighborhood": "Paulusviertel",
        "opening_hours": "Tu-Su 09:30-18:00",
        "website": "",
        "phone": "",
        "tags": ["neighborhood", "paulusviertel", "espresso", "outdoor"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Iconic meeting point in the heart of the Paulusviertel near the church square."
    },
    {
        "id": "cafe-riveufer",
        "name": "Café am Riveufer",
        "lat": 51.50268,
        "lon": 11.95059,
        "address": "Riveufer 8",
        "postcode": "06114",
        "neighborhood": "Giebichenstein / Saale",
        "opening_hours": "We-Su 11:30-19:00",
        "website": "https://cafe-am-riveufer.de",
        "phone": "+49 345 5238210",
        "tags": ["river_view", "saale", "outdoor", "cakes", "sun"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Panoramic view right onto the Saale river. Perfect stop during an afternoon river walk."
    },
    {
        "id": "cup-der-guten-hoffnung",
        "name": "Cup der Guten Hoffnung",
        "lat": 51.4850,
        "lon": 11.9667,
        "address": "Kleine Ulrichstraße 34",
        "postcode": "06108",
        "neighborhood": "Altstadt",
        "opening_hours": "Tu-Su 10:00-18:00",
        "website": "",
        "phone": "",
        "tags": ["cozy", "fairtrade", "bio", "vegan"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Organic fair-trade specialty coffees, healthy sweet treats, and welcoming atmosphere."
    },
    {
        "id": "wolkenkuckucksheim",
        "name": "Café Wolkenkuckucksheim",
        "lat": 51.4858,
        "lon": 11.9663,
        "address": "Kleine Ulrichstraße 18",
        "postcode": "06108",
        "neighborhood": "Altstadt",
        "opening_hours": "Mo-Su 10:00-22:00",
        "website": "",
        "phone": "",
        "tags": ["quirky", "students", "breakfast", "outdoor"],
        "initial_visited": False,
        "price_level": "€",
        "notes": "Vintage-decorated favorite for university students, breakfast platters, and relaxed talks."
    },
    {
        "id": "cafe-koenig",
        "name": "Café König",
        "lat": 51.4831,
        "lon": 11.9702,
        "address": "Alter Markt 1",
        "postcode": "06108",
        "neighborhood": "Altstadt",
        "opening_hours": "Mo-Su 08:30-18:00",
        "website": "https://cafekoenig-halle.de",
        "phone": "+49 345 2021111",
        "tags": ["traditional", "confectionery", "cakes", "historic"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Classic grand Viennese-style coffee house on Alter Markt with magnificent display case cakes."
    },
    {
        "id": "moritzkunstcafe",
        "name": "MoritzKunstCafé",
        "lat": 51.4866,
        "lon": 11.9634,
        "address": "Friedemann-Bach-Platz 5 (Moritzburg)",
        "postcode": "06108",
        "neighborhood": "Altstadt / Moritzburg",
        "opening_hours": "Tu-Su 10:00-18:00",
        "website": "https://moritzkunstcafe.de",
        "phone": "+49 345 2082690",
        "tags": ["art", "castle", "historic", "outdoor", "cultural"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Inside the Moritzburg art museum courtyard. Historic stone arches, espresso, and quiet elegance."
    },
    {
        "id": "spielhaus-ev",
        "name": "Spielhaus e.V. Café & Brettspiele",
        "lat": 51.4895,
        "lon": 11.9705,
        "address": "Ludwig-Stur-Straße 11",
        "postcode": "06108",
        "neighborhood": "Nördliche Innenstadt",
        "opening_hours": "We-Su 15:00-23:00",
        "website": "https://spielhaus-halle.de",
        "phone": "",
        "tags": ["boardgames", "games", "drinks", "evening", "community"],
        "initial_visited": False,
        "price_level": "€",
        "notes": "Over 500 board games in stock! Perfect for an evening with friends when coffee turns to games."
    },
    {
        "id": "freiraum-cafe",
        "name": "Freiraum. Café im Innenhof",
        "lat": 51.4851,
        "lon": 11.9678,
        "address": "Barfüßerstraße 20",
        "postcode": "06108",
        "neighborhood": "Altstadt",
        "opening_hours": "Tu-Sa 10:00-18:00",
        "website": "",
        "phone": "",
        "tags": ["courtyard", "hidden_gem", "quiet", "outdoor"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Peaceful courtyard sanctuary away from pedestrian noise. Very pleasant place to read or chat."
    },
    {
        "id": "hafenmeister-docks",
        "name": "Hafenmeister & Docks",
        "lat": 51.48491,
        "lon": 11.96107,
        "address": "An der Saline 21",
        "postcode": "06110",
        "neighborhood": "Saline / Saale",
        "opening_hours": "Th-Su 12:00-20:00",
        "website": "https://hafenmeister-halle.de",
        "phone": "+49 345 6858900",
        "tags": ["waterfront", "sun", "drinks", "beer_garden", "summer"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Industrial harbor vibes with deckchairs along the river canal. Spectacular sunset spot."
    },
    {
        "id": "kaffeehaus-wittekind",
        "name": "Kaffeehaus Wittekind",
        "lat": 51.5034,
        "lon": 11.9568,
        "address": "Wittekindstraße 22",
        "postcode": "06114",
        "neighborhood": "Giebichenstein",
        "opening_hours": "Tu-Su 11:30-18:00",
        "website": "https://kaffeehaus-wittekind.de",
        "phone": "+49 345 5220330",
        "tags": ["historic", "traditional", "cakes", "spa_park"],
        "initial_visited": False,
        "price_level": "€€",
        "notes": "Historic spa-town coffee house near Giebichenstein castle and Solbad Wittekind."
    }
]

def slugify(text):
    text = text.lower().strip()
    text = text.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def main():
    with open('osm_halle_raw.json', 'r') as f:
        osm_raw = json.load(f)

    # Read user desktop list to know who was visited or listed
    desktop_file = '/home/sam/Desktop/cafes in halle.txt'
    user_visited_names = set()
    user_listed_names = []
    if os.path.exists(desktop_file):
        with open(desktop_file, 'r') as f:
            for l in f:
                l = l.strip()
                if not l:
                    continue
                if ' - ✅' in l:
                    clean = l.replace(' - ✅', '').strip()
                    user_visited_names.add(clean.lower())
                    user_listed_names.append(clean)
                else:
                    user_listed_names.append(l)

    cafes = []
    seen_ids = set()
    seen_names = set()

    # 1. First add our curated high-detail entries
    for c in CURATED_EXTRA:
        cafes.append(c)
        seen_ids.add(c["id"])
        seen_names.add(slugify(c["name"]))

    # 2. Add raw OSM cafes that are not already present
    for el in osm_raw.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        
        slug = slugify(name)
        if slug in seen_names or any(slug in s or s in slug for s in seen_names):
            continue

        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if not lat or not lon:
            continue

        street = tags.get("addr:street", "")
        nr = tags.get("addr:housenumber", "")
        address = f"{street} {nr}".strip() if street else tags.get("addr:place", "Halle (Saale)")

        hours = tags.get("opening_hours", "")
        website = tags.get("website") or tags.get("contact:website", "")
        phone = tags.get("phone") or tags.get("contact:phone", "")
        cuisine = tags.get("cuisine", "")
        
        cafe_tags = ["coffee"]
        if "outdoor_seating" in tags and tags["outdoor_seating"] == "yes":
            cafe_tags.append("outdoor")
        if "wheelchair" in tags and tags["wheelchair"] in ["yes", "designated"]:
            cafe_tags.append("accessible")
        if "internet_access" in tags and tags["internet_access"] in ["wlan", "yes"]:
            cafe_tags.append("wifi")
        if "diet:vegan" in tags and tags["diet:vegan"] in ["yes", "only"]:
            cafe_tags.append("vegan")
        if "cake" in cuisine or "pastry" in cuisine or "bakery" in tags.get("amenity", ""):
            cafe_tags.append("cakes")

        postcode = tags.get("addr:postcode", "06108")
        neighborhood = "Halle Zentrum" if postcode == "06108" else ("Giebichenstein" if postcode == "06114" else "Halle")

        is_visited = False
        if any(v in name.lower() for v in user_visited_names):
            is_visited = True

        c_obj = {
            "id": f"osm-{el.get('id')}",
            "name": name,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "address": address,
            "postcode": postcode,
            "neighborhood": neighborhood,
            "opening_hours": hours,
            "website": website,
            "phone": phone,
            "tags": cafe_tags,
            "initial_visited": is_visited,
            "price_level": "€€",
            "notes": f"Local Halle cafe recorded on OpenStreetMap ({tags.get('description', '') or cuisine or 'coffee, tea & snacks'})."
        }
        cafes.append(c_obj)
        seen_names.add(slug)

    print(f"Total unified cafes: {len(cafes)}")

    # Write data/cafes.json
    os.makedirs("data", exist_ok=True)
    with open("data/cafes.json", "w", encoding="utf-8") as f:
        json.dump(cafes, f, indent=2, ensure_ascii=False)

    # Write js/data.js (ES Module for the client)
    js_content = f"// Generated Halle (Saale) Cafes Dataset ({len(cafes)} locations)\n"
    js_content += f"export const CAFES_DATA = {json.dumps(cafes, indent=2, ensure_ascii=False)};\n"
    with open("js/data.js", "w", encoding="utf-8") as f:
        f.write(js_content)

    print("Wrote data/cafes.json and js/data.js successfully!")

if __name__ == "__main__":
    main()
