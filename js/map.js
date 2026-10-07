/**
 * map.js
 * High-performance, Hardware-Accelerated Vector Map integration for Halle Cafes.
 * Powered by MapLibre GL JS + OpenFreeMap Dark Style (100% Keyless, Zero Cost, WebGL 60fps).
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
    this.isLoaded = false;
    this.currentCafes = [];
    this.currentStore = null;
  }

  init(center = [11.9680, 51.4855], zoom = 14.2) {
    if (typeof maplibregl === 'undefined') {
      console.error('MapLibre GL JS is not loaded');
      return;
    }

    // Initialize MapLibre GL with OpenFreeMap Fiord style (rich dark slate with clear roads & water)
    this.map = new maplibregl.Map({
      container: this.containerId,
      style: 'https://tiles.openfreemap.org/styles/fiord',
      center: center, // [lng, lat] in MapLibre
      zoom: zoom,
      pitch: 0, // Clean 2D top-down cartographic view
      bearing: 0,
      antialias: true,
      attributionControl: true
    });

    // Navigation Controls (Zoom +/- and Compass Pitch Reset)
    this.map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
      }),
      'bottom-right'
    );

    const setupBuildingsLayer = () => {
      try {
        if (!this.map || !this.map.getSource('openmaptiles') || this.map.getLayer('3d-buildings-extrude')) return;
        const layers = this.map.getStyle().layers || [];
        const labelLayer = layers.find(l => l.type === 'symbol' && l.layout && l.layout['text-field']);
        const labelLayerId = labelLayer ? labelLayer.id : undefined;

        this.map.addLayer({
          id: '3d-buildings-extrude',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#1e1e2e',
            'fill-extrusion-height': ['get', 'render_height'],
            'fill-extrusion-base': ['get', 'render_min_height'],
            'fill-extrusion-opacity': 0.6
          }
        }, labelLayerId);
      } catch (err) {
        // Safe fallback if vector source doesn't support 3D extrusions
      }
    };

    this.map.on('load', () => {
      this.isLoaded = true;
      setupBuildingsLayer();

      // Re-render pending markers if dataset was passed before map finish load
      if (this.currentCafes.length > 0 && this.currentStore) {
        this.renderMarkers(this.currentCafes, this.currentStore);
      }
    });

    this.map.on('style.load', () => {
      setupBuildingsLayer();
    });
  }

  setMapStyle(styleName) {
    if (!this.map) return;
    const styleUrl = styleName === 'liberty'
      ? 'https://tiles.openfreemap.org/styles/liberty'
      : 'https://tiles.openfreemap.org/styles/fiord';
    this.map.setStyle(styleUrl);
  }

  createPinElement(cafe, isVisited, isSelected) {
    const el = document.createElement('div');
    el.className = `cafe-marker-wrap maplibregl-marker ${isSelected ? 'is-selected' : ''} ${isVisited ? 'is-visited' : ''}`;
    el.setAttribute('data-id', cafe.id);
    el.setAttribute('aria-label', `${cafe.name} (${cafe.neighborhood})`);
    el.style.cursor = 'pointer';

    const bg = isVisited ? 'var(--green, #a6e3a1)' : (isSelected ? 'var(--accent, #cba6f7)' : 'var(--peach, #fab387)');
    const glyphColor = '#11111b';
    const glyph = isVisited ? '✓' : '☕';

    el.innerHTML = `
      <div class="marker-pulse-halo ${isSelected ? 'active' : ''}"></div>
      <div class="custom-marker-badge" style="background: ${bg};">
        <span class="marker-glyph" style="color: ${glyphColor};">${glyph}</span>
      </div>
    `;

    return el;
  }

  renderMarkers(cafes, store) {
    this.currentCafes = cafes;
    this.currentStore = store;
    if (!this.map) return;

    const currentIds = new Set(cafes.map(c => c.id));

    // Remove obsolete markers
    for (const [id, marker] of this.markers.entries()) {
      if (!currentIds.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    // Add or update markers
    for (const cafe of cafes) {
      const userData = store.get(cafe.id);
      const isVisited = userData.visited;
      const isSelected = cafe.id === this.selectedId;

      if (this.markers.has(cafe.id)) {
        const marker = this.markers.get(cafe.id);
        const el = marker.getElement();
        if (el) {
          el.className = `cafe-marker-wrap maplibregl-marker ${isSelected ? 'is-selected' : ''} ${isVisited ? 'is-visited' : ''}`;
          const badge = el.querySelector('.custom-marker-badge');
          const halo = el.querySelector('.marker-pulse-halo');
          if (badge) {
            badge.style.background = isVisited ? 'var(--green, #a6e3a1)' : (isSelected ? 'var(--accent, #cba6f7)' : 'var(--peach, #fab387)');
            const glyph = badge.querySelector('.marker-glyph');
            if (glyph) glyph.textContent = isVisited ? '✓' : '☕';
          }
          if (halo) {
            halo.className = `marker-pulse-halo ${isSelected ? 'active' : ''}`;
          }
        }
      } else {
        const el = this.createPinElement(cafe, isVisited, isSelected);

        const handleSelect = (e) => {
          if (e) e.stopPropagation();
          this.selectCafe(cafe.id);
          if (this.onSelectCafe) {
            this.onSelectCafe(cafe);
          }
        };

        el.addEventListener('click', handleSelect);

        // MapLibre Marker instance
        const marker = new maplibregl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat([cafe.lon, cafe.lat])
          .addTo(this.map);

        this.markers.set(cafe.id, marker);
      }
    }
  }

  selectCafe(cafeId, panTo = true) {
    this.selectedId = cafeId;

    // Update active visual state across all markers
    for (const [id, marker] of this.markers.entries()) {
      const el = marker.getElement();
      if (!el) continue;
      const isSelected = id === cafeId;
      const halo = el.querySelector('.marker-pulse-halo');
      if (isSelected) {
        el.classList.add('is-selected');
        if (halo) halo.classList.add('active');
        el.style.zIndex = '999';
      } else {
        el.classList.remove('is-selected');
        if (halo) halo.classList.remove('active');
        el.style.zIndex = '';
      }
    }

    const targetMarker = this.markers.get(cafeId);
    if (targetMarker && panTo && this.map) {
      const lngLat = targetMarker.getLngLat();
      this.map.easeTo({
        center: [lngLat.lng, lngLat.lat],
        zoom: Math.max(this.map.getZoom(), 15.5),
        duration: 800
      });
    }
  }

  setUserLocation(coords) {
    this.userCoords = coords;
    if (!this.map) return;

    const lngLat = [coords.longitude, coords.latitude];

    if (this.userMarker) {
      this.userMarker.setLngLat(lngLat);
    } else {
      const el = document.createElement('div');
      el.className = 'user-marker-wrap maplibregl-marker';
      el.innerHTML = `
        <div class="user-pulse-marker">
          <div class="pulse-ring"></div>
          <div class="pulse-dot"></div>
        </div>
      `;
      this.userMarker = new maplibregl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat(lngLat)
        .addTo(this.map);
    }

    this.map.flyTo({
      center: lngLat,
      zoom: 15.5,
      duration: 1200
    });
  }

  invalidateSize() {
    if (this.map) {
      this.map.resize();
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
