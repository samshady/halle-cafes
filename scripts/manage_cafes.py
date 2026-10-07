#!/usr/bin/env python3
"""
manage_cafes.py
Clean, robust CLI tool to list, add, update, remove, and validate cafes in Halle (Saale).
Maintains data/cafes.json and automatically synchronizes js/data.js.
"""

import argparse
import json
import os
import re
import sys
import urllib.parse

DATA_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "cafes.json")
JS_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "js", "data.js")

# Halle (Saale) coordinate boundaries
LAT_MIN, LAT_MAX = 51.40, 51.60
LON_MIN, LON_MAX = 11.80, 12.10

def slugify(text: str) -> str:
    s = text.lower()
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s

def load_cafes():
    real_path = os.path.normpath(DATA_JSON_PATH)
    if not os.path.exists(real_path):
        print(f"Error: {real_path} not found.", file=sys.stderr)
        sys.exit(1)
    with open(real_path, "r", encoding="utf-8") as f:
        return json.load(f)

def validate_dataset(cafes):
    ids = set()
    for idx, c in enumerate(cafes):
        cid = c.get("id")
        name = c.get("name")
        lat = c.get("lat")
        lon = c.get("lon")

        if not cid:
            raise ValueError(f"Cafe #{idx + 1} missing 'id': {c}")
        if cid in ids:
            raise ValueError(f"Duplicate cafe id '{cid}'")
        ids.add(cid)

        if not name:
            raise ValueError(f"Cafe '{cid}' missing 'name'")
        if lat is None or not (LAT_MIN <= lat <= LAT_MAX):
            raise ValueError(f"Cafe '{name}' ({cid}) invalid latitude: {lat} (expected {LAT_MIN}-{LAT_MAX})")
        if lon is None or not (LON_MIN <= lon <= LON_MAX):
            raise ValueError(f"Cafe '{name}' ({cid}) invalid longitude: {lon} (expected {LON_MIN}-{LON_MAX})")

def save_cafes(cafes):
    validate_dataset(cafes)

    json_path = os.path.normpath(DATA_JSON_PATH)
    js_path = os.path.normpath(JS_DATA_PATH)

    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(cafes, f, indent=2, ensure_ascii=False)

    header = f"// Generated Halle (Saale) Cafes Dataset ({len(cafes)} locations)\n"
    content = f"{header}export const CAFES_DATA = {json.dumps(cafes, indent=2, ensure_ascii=False)};\n"
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"✓ Successfully synchronized {len(cafes)} cafes across:")
    print(f"  • {json_path}")
    print(f"  • {js_path}")

def cmd_list(args):
    cafes = load_cafes()
    query = (args.query or "").lower()
    tag = (args.tag or "").lower()

    filtered = cafes
    if query:
        filtered = [c for c in filtered if query in c["name"].lower() or query in c.get("address", "").lower() or query in c.get("id", "").lower()]
    if tag:
        filtered = [c for c in filtered if tag in [t.lower() for t in c.get("tags", [])]]

    print(f"\n{'#':<4} {'ID':<24} {'NAME':<32} {'NEIGHBORHOOD':<20} {'RATING':<9} {'TAGS'}")
    print("-" * 115)
    for i, c in enumerate(filtered, 1):
        rating_str = f"{c.get('google_rating', '-')} ★" if c.get('google_rating') else "-"
        tags_str = ", ".join(c.get("tags", [])[:3])
        print(f"{i:<4} {c['id']:<24} {c['name'][:30]:<32} {c.get('neighborhood', '')[:18]:<20} {rating_str:<9} {tags_str}")
    print(f"\nTotal: {len(filtered)} / {len(cafes)} cafes\n")

def cmd_add(args):
    cafes = load_cafes()

    name = args.name or input("Cafe Name: ").strip()
    if not name:
        print("Name is required.", file=sys.stderr)
        return

    cid = args.id or slugify(name)
    if any(c["id"] == cid for c in cafes):
        print(f"Error: Cafe with ID '{cid}' already exists.", file=sys.stderr)
        return

    lat = args.lat if args.lat is not None else float(input("Latitude (e.g. 51.485): ").strip())
    lon = args.lon if args.lon is not None else float(input("Longitude (e.g. 11.970): ").strip())
    address = args.address or input("Address (Street & Nr): ").strip()
    neighborhood = args.neighborhood or input("Neighborhood (e.g. Altstadt, Paulusviertel): ").strip() or "Halle Zentrum"
    hours = args.hours or input("Opening Hours (e.g. Mo-Fr 08:00-18:00): ").strip()
    notes = args.notes or input("Notes / Description: ").strip()
    tags_in = args.tags or input("Tags (comma-separated, e.g. coffee, cakes, outdoor): ").strip()
    tags = [t.strip().replace(" ", "_") for t in tags_in.split(",") if t.strip()] if tags_in else ["coffee"]

    q = urllib.parse.quote(f"{name} {address} Halle (Saale)")
    gmaps_url = f"https://www.google.com/maps/search/?api=1&query={q}"

    cafe_obj = {
        "id": cid,
        "name": name,
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "address": address,
        "postcode": "06108",
        "neighborhood": neighborhood,
        "opening_hours": hours,
        "website": args.website or "",
        "phone": args.phone or "",
        "google_rating": args.google_rating or 4.5,
        "google_review_count": args.google_reviews or 50,
        "google_price_level": "€€",
        "tags": tags,
        "initial_visited": False,
        "price_level": "€€",
        "notes": notes,
        "google_maps_url": gmaps_url
    }

    cafes.append(cafe_obj)
    save_cafes(cafes)
    print(f"✓ Added new cafe '{name}' (#{len(cafes)}) with ID '{cid}'")

def cmd_remove(args):
    cafes = load_cafes()
    cid = args.id
    target = next((c for c in cafes if c["id"] == cid), None)
    if not target:
        print(f"Error: Cafe with ID '{cid}' not found.", file=sys.stderr)
        return

    if not args.yes:
        confirm = input(f"Are you sure you want to remove '{target['name']}' ({cid})? [y/N]: ")
        if confirm.lower() != 'y':
            print("Aborted.")
            return

    cafes = [c for c in cafes if c["id"] != cid]
    save_cafes(cafes)
    print(f"✓ Removed '{target['name']}' ({cid}). New count: {len(cafes)}")

def cmd_update(args):
    cafes = load_cafes()
    cid = args.id
    target = next((c for c in cafes if c["id"] == cid), None)
    if not target:
        print(f"Error: Cafe with ID '{cid}' not found.", file=sys.stderr)
        return

    if args.name: target["name"] = args.name
    if args.address: target["address"] = args.address
    if args.neighborhood: target["neighborhood"] = args.neighborhood
    if args.hours: target["opening_hours"] = args.hours
    if args.notes: target["notes"] = args.notes
    if args.tags: target["tags"] = [t.strip().replace(" ", "_") for t in args.tags.split(",") if t.strip()]
    if args.website is not None: target["website"] = args.website
    if args.phone is not None: target["phone"] = args.phone
    if args.google_rating is not None: target["google_rating"] = args.google_rating
    if args.google_reviews is not None: target["google_review_count"] = args.google_reviews
    if args.lat is not None: target["lat"] = round(args.lat, 5)
    if args.lon is not None: target["lon"] = round(args.lon, 5)

    save_cafes(cafes)
    print(f"✓ Updated '{target['name']}' ({cid}).")

def cmd_validate(args):
    cafes = load_cafes()
    try:
        validate_dataset(cafes)
        print(f"✓ Validation passed! All {len(cafes)} cafes have valid IDs, coordinates, and schemas.")
    except Exception as e:
        print(f"✗ Validation failed: {e}", file=sys.stderr)
        sys.exit(1)

def cmd_sync(args):
    cafes = load_cafes()
    save_cafes(cafes)
    print("✓ Dataset synchronization complete.")

def main():
    parser = argparse.ArgumentParser(description="Halle Cafes Dataset Management Tool")
    sub = parser.add_subparsers(dest="subcommand", required=True)

    # list
    p_list = sub.add_parser("list", help="List cafes with IDs, names, neighborhoods, ratings")
    p_list.add_argument("--query", "-q", help="Search by name, address, or ID")
    p_list.add_argument("--tag", "-t", help="Filter by tag")

    # add
    p_add = sub.add_parser("add", help="Add a new cafe to the dataset")
    p_add.add_argument("--name", "-n")
    p_add.add_argument("--id")
    p_add.add_argument("--lat", type=float)
    p_add.add_argument("--lon", type=float)
    p_add.add_argument("--address", "-a")
    p_add.add_argument("--neighborhood")
    p_add.add_argument("--hours")
    p_add.add_argument("--tags")
    p_add.add_argument("--notes")
    p_add.add_argument("--website")
    p_add.add_argument("--phone")
    p_add.add_argument("--google-rating", type=float)
    p_add.add_argument("--google-reviews", type=int)

    # remove
    p_rm = sub.add_parser("remove", help="Remove a cafe from the dataset by ID")
    p_rm.add_argument("id", help="Cafe slug ID (e.g. 7-gramm)")
    p_rm.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")

    # update
    p_up = sub.add_parser("update", help="Update fields of an existing cafe by ID")
    p_up.add_argument("id", help="Cafe slug ID")
    p_up.add_argument("--name")
    p_up.add_argument("--address")
    p_up.add_argument("--neighborhood")
    p_up.add_argument("--hours")
    p_up.add_argument("--notes")
    p_up.add_argument("--tags")
    p_up.add_argument("--website")
    p_up.add_argument("--phone")
    p_up.add_argument("--google-rating", type=float)
    p_up.add_argument("--google-reviews", type=int)
    p_up.add_argument("--lat", type=float)
    p_up.add_argument("--lon", type=float)

    # validate & sync
    sub.add_parser("validate", help="Validate coordinates and schema across entire dataset")
    sub.add_parser("sync", help="Synchronize data/cafes.json to js/data.js")

    args = parser.parse_args()
    dispatch = {
        "list": cmd_list,
        "add": cmd_add,
        "remove": cmd_remove,
        "update": cmd_update,
        "validate": cmd_validate,
        "sync": cmd_sync,
    }
    dispatch[args.subcommand](args)

if __name__ == "__main__":
    main()
