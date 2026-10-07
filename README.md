# ☕ Halle Cafés • Guide & Tracker

A mobile-first, local-first Progressive Web App (PWA) to discover cafes in Halle (Saale), check live opening hours, break decision fatigue, and log personal ratings and visits. Designed to be hosted on **GitHub Pages** with zero backend infrastructure.

Themed in **Catppuccin Mocha** dark mode with warm coffee accents, inspired by Sam's personal projects and workstation styling.

---

## ✨ Features

- **95 Halle Cafes Mapped**: Pre-populated with coordinates, street addresses, opening hours, and vibe tags derived from Sam's curated list and OpenStreetMap.
- **🎲 "Pick For Me" Decision Solver**: Random roulette spinner that shuffles through currently open and filtered cafes to break the habit of always going to the same spot (like *Ziegelkram* next to uni).
- **🕒 Timezone-Aware Live Hours**: Evaluates OSM opening hour strings against `Europe/Berlin` time to show real-time badges (🟢 Open Now, 🟡 Closing Soon, 🔴 Closed) plus full weekly schedules.
- **📍 GPS Distance & Walking Time**: Tap *Near Me* to calculate exact walking distance (e.g. `450 m • 6 min walk`) using the Haversine formula.
- **✍️ Personal Visit & Rating Tracker**:
  - Mark places as *Visited* or *Want to Go*.
  - 1-5 Star interactive personal rating.
  - Notes for drinks ordered, table availability, or vibe.
  - LocalStorage persistence + **1-Click JSON Backup Export & Restore**.
- **🗺️ Native Navigation Links**: Direct deep links to start walking navigation in **Google Maps** or **Apple Maps**.
- **📱 Mobile-First PWA**: Responsive split/tab layout, bottom navigation, touch targets (>44px), offline caching via Service Worker, and installable on iOS / Android home screens.

---

## 🚀 Quick Start (Local Preview)

No npm install required! Run a local web server:

```bash
# Using Python:
python3 -m http.server 8080

# Or using Node:
npx serve -l 8080 .
```

Open [http://localhost:8080](http://localhost:8080) in your browser (or on your phone over the local network / Tailscale).

---

## 🧪 Running Tests

The test suite validates opening hours parsing, interval calculations, and dataset integrity:

```bash
npm test
```

---

## 🔄 Data Pipeline & Enrichment

1. **OpenStreetMap Base (`scripts/build_dataset.py`)**:
   - Queries OpenStreetMap / Overpass for Halle (Saale) cafes.
   - Merges curated venues, corrects typos, and outputs `js/data.js` and `data/cafes.json`.
   ```bash
   npm run build:data
   ```

2. **Google Places API Enrichment (`scripts/enrich_google.py`)** *(Optional)*:
   - If you have a Google Cloud API Key with Places API (New) enabled, run:
   ```bash
   export GOOGLE_PLACES_API_KEY="AIzaSy..."
   npm run enrich:google
   ```
   - Fetches official Google ratings, total review counts, and price levels.

---

## 🌐 Deploying to GitHub Pages

1. Initialize git and commit:
   ```bash
   cd ~/Development/personal/halle-cafes
   git init
   git add .
   git commit -m "feat: initial Halle Cafés web app"
   ```
2. Create repository on GitHub (e.g. `samshady/halle-cafes`) and push:
   ```bash
   git remote add origin git@github-samshady:samshady/halle-cafes.git
   git branch -M main
   git push -u origin main
   ```
3. In GitHub repo **Settings -> Pages**:
   - Under **Build and deployment -> Source**, select **GitHub Actions**.
   - The included workflow in `.github/workflows/deploy.yml` will automatically test and publish the site to `https://<user>.github.io/halle-cafes/`.
