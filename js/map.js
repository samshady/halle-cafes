/**
 * map.js
 * Interactive Leaflet Map integration for Halle Cafes.
 * Uses CartoDB dark-themed vector-styled tiles to match Catppuccin Mocha palette.
 */

export class CafeMap {
  constructor(containerId, onSelectCafe) {
    this.containerId = containerId;
    this.onSelectCafe = onSelectCafe;
    this.map = null;
    this.markers = new Map();
    this.userMarker = null;
    this.userCoords = null;
    this.selectedId = null;
  }

  init(center = [51.4855, 11.9680], zoom = 14) {
    if (typeof L === 'undefined') {
      console.error('Leaflet is not loaded');
      return;
    }

    this.map = L.map(this.containerId, {
      zoomControl: false,
      attributionControl: false
    }).setView(center, zoom);

    // Free OpenStreetMap tiles (100% keyless, community hosted)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
  }

  createPinIcon(cafe, isVisited, isSelected) {
    let bg = isVisited ? '#a6e3a1' : (isSelected ? '#cba6f7' : '#fab387');
    let glyph = isVisited ? '✓' : '☕';
    let size = isSelected ? 36 : 28;

    const html = `
      <div class="custom-marker ${isSelected ? 'is-selected' : ''} ${isVisited ? 'is-visited' : ''}" style="
        width: ${size}px;
        height: ${size}px;
        background: ${bg};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        border: 2px solid #1e1e2e;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      ">
        <span style="
          transform: rotate(45deg);
          color: #11111b;
          font-weight: 800;
          font-size: ${isSelected ? 16 : 13}px;
          user-select: none;
        ">${glyph}</span>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'cafe-marker-wrap',
      iconSize: [size, size],
      iconAnchor: [size / 2, size]
    });
  }

  renderMarkers(cafes, store) {
    if (!this.map) return;

    // Remove obsolete markers
    const currentIds = new Set(cafes.map(c => c.id));
    for (const [id, marker] of this.markers.entries()) {
      if (!currentIds.has(id)) {
        this.map.removeLayer(marker);
        this.markers.delete(id);
      }
    }

    // Add or update markers
    for (const cafe of cafes) {
      const userData = store.get(cafe.id);
      const isVisited = userData.visited;
      const isSelected = cafe.id === this.selectedId;
      const icon = this.createPinIcon(cafe, isVisited, isSelected);

      if (this.markers.has(cafe.id)) {
        const marker = this.markers.get(cafe.id);
        marker.setIcon(icon);
      } else {
        const marker = L.marker([cafe.lat, cafe.lon], { icon }).addTo(this.map);
        marker.on('click', () => {
          this.selectCafe(cafe.id);
          if (this.onSelectCafe) {
            this.onSelectCafe(cafe);
          }
        });
        this.markers.set(cafe.id, marker);
      }
    }
  }

  selectCafe(cafeId, panTo = true) {
    this.selectedId = cafeId;
    const marker = this.markers.get(cafeId);
    if (marker && panTo) {
      this.map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
    }
  }

  setUserLocation(coords) {
    this.userCoords = coords;
    if (!this.map) return;

    const latlng = [coords.latitude, coords.longitude];

    if (this.userMarker) {
      this.userMarker.setLatLng(latlng);
    } else {
      const pulseHtml = `
        <div class="user-pulse-marker">
          <div class="pulse-ring"></div>
          <div class="pulse-dot"></div>
        </div>
      `;
      const icon = L.divIcon({
        html: pulseHtml,
        className: 'user-marker-wrap',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      this.userMarker = L.marker(latlng, { icon }).addTo(this.map);
    }

    this.map.setView(latlng, 15);
  }

  invalidateSize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }
}

/**
 * Calculates straight line distance in meters between two lat/lon points
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Human friendly walking distance string (e.g. "450 m • 6 min walk")
 */
export function formatWalkDistance(meters) {
  if (meters == null) return null;
  const mins = Math.max(1, Math.round(meters / 80)); // ~80m per min walking pace
  if (meters < 1000) {
    return `${meters} m • ${mins} min walk`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km • ${mins} min walk`;
}
