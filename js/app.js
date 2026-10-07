/**
 * app.js
 * Main application orchestrator for Halle Cafe Guide & Tracker.
 */

import { CAFES_DATA } from './data.js';
import { store } from './store.js';
import { getCafeOpenStatus, formatWeeklySchedule } from './hours.js';
import { CafeMap, calculateDistance, formatWalkDistance } from './map.js';
import { CafeRandomizer } from './randomizer.js';

class HalleCafeApp {
  constructor() {
    this.cafes = [...CAFES_DATA];
    this.filteredCafes = [...this.cafes];
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.sortMode = 'recommended';
    this.selectedCafe = null;
    this.userCoords = null;
    this.store = store;

    // Elements
    this.listEl = document.getElementById('cafe-cards-list');
    this.countEl = document.getElementById('cafe-count');
    this.searchInput = document.getElementById('search-input');
    this.sortSelect = document.getElementById('sort-select');
    this.filterChips = document.querySelectorAll('.filter-chip');
    this.locateBtn = document.getElementById('locate-btn');
    this.pickBtn = document.getElementById('pick-btn');
    this.detailModal = document.getElementById('detail-modal');
    this.backupModal = document.getElementById('backup-modal');
    this.backupBtn = document.getElementById('backup-btn');

    // Floating Map Preview Elements
    this.mapPreviewCard = document.getElementById('map-preview-card');
    this.mapPreviewClose = document.getElementById('map-preview-close');
    this.previewTitle = document.getElementById('preview-title');
    this.previewBadgeStatus = document.getElementById('preview-badge-status');
    this.previewMeta = document.getElementById('preview-meta');
    this.previewNotes = document.getElementById('preview-notes');
    this.previewOpenModalBtn = document.getElementById('preview-open-modal-btn');
    this.previewDirectionsBtn = document.getElementById('preview-directions-btn');

    // Modules
    this.map = new CafeMap('map-container', (cafe) => {
      this.showMapPreview(cafe);
    });
    this.randomizer = new CafeRandomizer(
      (cafe) => this.openDetail(cafe),
      (msg) => this.showToast(msg)
    );

    this.init();
  }

  showToast(message, duration = 3000) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  init() {
    // Initialize map
    this.map.init();

    // Check if user previously visited cafes in store
    this.updateDistances();
    this.applyFilters();
    this.bindEvents();
    this.renderStats();

    // Responsive bottom sheet / tab toggle for mobile
    this.bindMobileTabs();

    // Map style selector toggle
    this.bindMapStyleToggle();
  }

  bindMapStyleToggle() {
    const fiordBtn = document.getElementById('map-style-fiord');
    const libertyBtn = document.getElementById('map-style-liberty');
    if (!fiordBtn || !libertyBtn) return;

    const savedStyle = localStorage.getItem('halle_map_style') || 'fiord';
    if (savedStyle === 'liberty') {
      libertyBtn.classList.add('active');
      fiordBtn.classList.remove('active');
      this.map.setMapStyle('liberty');
    }

    fiordBtn.addEventListener('click', () => {
      fiordBtn.classList.add('active');
      libertyBtn.classList.remove('active');
      this.map.setMapStyle('fiord');
      localStorage.setItem('halle_map_style', 'fiord');
    });

    libertyBtn.addEventListener('click', () => {
      libertyBtn.classList.add('active');
      fiordBtn.classList.remove('active');
      this.map.setMapStyle('liberty');
      localStorage.setItem('halle_map_style', 'liberty');
    });
  }

  bindEvents() {
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.applyFilters();
    });

    // Clear search
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchQuery = '';
        this.applyFilters();
      });
    }

    // Sort select
    this.sortSelect.addEventListener('change', (e) => {
      this.sortMode = e.target.value;
      this.applyFilters();
    });

    // Filter chips
    this.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.dataset.filter;
        this.applyFilters();
      });
    });

    // Locate me button
    this.locateBtn.addEventListener('click', () => this.requestLocation());

    // Pick for me button
    this.pickBtn.addEventListener('click', () => {
      this.randomizer.spin(this.filteredCafes);
    });

    // Backup & Restore
    if (this.backupBtn) {
      this.backupBtn.addEventListener('click', () => this.openBackupModal());
    }
    const backupClose = document.getElementById('backup-close-btn');
    if (backupClose) {
      backupClose.addEventListener('click', () => this.closeBackupModal());
    }

    // Export backup
    const exportBtn = document.getElementById('export-json-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportUserData());
    }

    // Import backup
    const importInput = document.getElementById('import-json-file');
    if (importInput) {
      importInput.addEventListener('change', (e) => this.importUserData(e));
    }

    // Detail modal close
    const detailClose = document.getElementById('detail-close-btn');
    if (detailClose) {
      detailClose.addEventListener('click', () => this.closeDetail());
    }

    // Backdrop dismissal for modal overlays (ignores delayed synthetic ghost clicks within 350ms of modal open)
    if (this.detailModal) {
      this.detailModal.addEventListener('click', (e) => {
        if (Date.now() - (this.lastModalOpenTime || 0) < 350) return;
        if (e.target === this.detailModal) this.closeDetail();
      });
    }
    if (this.backupModal) {
      this.backupModal.addEventListener('click', (e) => {
        if (Date.now() - (this.lastBackupOpenTime || 0) < 350) return;
        if (e.target === this.backupModal) this.closeBackupModal();
      });
    }

    // Escape key closes open modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDetail();
        this.closeBackupModal();
        this.hideMapPreview();
        this.randomizer.close();
      }
    });

    // Map preview drawer buttons
    if (this.mapPreviewClose) {
      this.mapPreviewClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideMapPreview();
      });
    }
    if (this.previewOpenModalBtn) {
      this.previewOpenModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = this.previewCafe || this.selectedCafe;
        if (target) {
          this.openDetail(target);
        }
      });
    }

    const previewContent = document.querySelector('.preview-content');
    if (previewContent) {
      previewContent.addEventListener('click', (e) => {
        if (e.target.closest('#preview-directions-btn') || e.target.closest('#map-preview-close') || e.target.closest('#preview-open-modal-btn')) {
          return;
        }
        const target = this.previewCafe || this.selectedCafe;
        if (target) {
          this.openDetail(target);
        }
      });
    }
  }

  bindMobileTabs() {
    const listTabBtn = document.getElementById('tab-list-btn');
    const mapTabBtn = document.getElementById('tab-map-btn');
    const listView = document.getElementById('list-view-container');
    const mapView = document.getElementById('map-view-container');

    if (!listTabBtn || !mapTabBtn) return;

    listTabBtn.addEventListener('click', () => {
      listTabBtn.classList.add('active');
      mapTabBtn.classList.remove('active');
      listView.classList.remove('hidden-mobile');
      mapView.classList.add('hidden-mobile');
    });

    mapTabBtn.addEventListener('click', () => {
      mapTabBtn.classList.add('active');
      listTabBtn.classList.remove('active');
      mapView.classList.remove('hidden-mobile');
      listView.classList.add('hidden-mobile');
      // Ensure Leaflet recalculates dimensions immediately and after reflow
      this.map.invalidateSize();
      setTimeout(() => this.map.invalidateSize(), 60);
      setTimeout(() => this.map.invalidateSize(), 220);
      requestAnimationFrame(() => this.map.invalidateSize());
    });
  }

  requestLocation() {
    if (!navigator.geolocation) {
      this.showToast('Geolocation is not supported by your browser');
      return;
    }
    this.locateBtn.classList.add('animate-pulse');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locateBtn.classList.remove('animate-pulse');
        this.userCoords = pos.coords;
        this.map.setUserLocation(pos.coords);
        this.updateDistances();
        this.sortMode = 'distance';
        this.sortSelect.value = 'distance';
        this.applyFilters();
        this.showToast('Updated order by closest walking distance');
      },
      (err) => {
        this.locateBtn.classList.remove('animate-pulse');
        this.showToast('Could not retrieve your location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  updateDistances() {
    if (!this.userCoords) return;
    for (const cafe of this.cafes) {
      cafe.distanceMeters = calculateDistance(
        this.userCoords.latitude,
        this.userCoords.longitude,
        cafe.lat,
        cafe.lon
      );
    }
  }

  applyFilters() {
    let list = this.cafes.filter(cafe => {
      const userData = store.get(cafe.id);

      // Search query
      if (this.searchQuery) {
        const text = `${cafe.name} ${cafe.address} ${cafe.neighborhood} ${(cafe.tags || []).join(' ')} ${cafe.notes || ''}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }

      // Filter chips
      if (this.activeFilter === 'open') {
        const status = getCafeOpenStatus(cafe.opening_hours);
        return status.isOpen;
      }
      if (this.activeFilter === 'unvisited') {
        return !userData.visited;
      }
      if (this.activeFilter === 'visited') {
        return userData.visited;
      }
      if (this.activeFilter === 'specialty') {
        return (cafe.tags || []).includes('specialty_coffee');
      }
      if (this.activeFilter === 'near_uni') {
        return (cafe.tags || []).includes('near_uni');
      }
      if (this.activeFilter === 'outdoor') {
        return (cafe.tags || []).includes('outdoor');
      }
      if (this.activeFilter === 'favorite') {
        return userData.favorite;
      }

      return true;
    });

    // Sorting
    if (this.sortMode === 'distance') {
      list.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
    } else if (this.sortMode === 'google_rating') {
      list.sort((a, b) => {
        const rA = a.google_rating ?? 0;
        const rB = b.google_rating ?? 0;
        if (rB !== rA) return rB - rA;
        return (b.google_review_count ?? 0) - (a.google_review_count ?? 0);
      });
    } else if (this.sortMode === 'rating') {
      list.sort((a, b) => {
        const rA = store.get(a.id).rating || 0;
        const rB = store.get(b.id).rating || 0;
        return rB - rA;
      });
    } else if (this.sortMode === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    } else {
      // 'recommended': unvisited and high-priority cafes first
      list.sort((a, b) => {
        const uA = store.get(a.id);
        const uB = store.get(b.id);
        // Favorites first
        if (uA.favorite && !uB.favorite) return -1;
        if (!uA.favorite && uB.favorite) return 1;
        // Then near uni
        const uniA = (a.tags || []).includes('near_uni') ? 1 : 0;
        const uniB = (b.tags || []).includes('near_uni') ? 1 : 0;
        if (uniA !== uniB) return uniB - uniA;
        return a.name.localeCompare(b.name, 'de');
      });
    }

    this.filteredCafes = list;
    this.renderCards();
    this.map.renderMarkers(list, store);
    this.renderStats();
  }

  renderCards() {
    this.countEl.textContent = `${this.filteredCafes.length} places`;

    if (this.filteredCafes.length === 0) {
      this.listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">☕</div>
          <h3>No cafes found</h3>
          <p>Try clearing your search query or selecting a different filter.</p>
        </div>
      `;
      return;
    }

    this.listEl.innerHTML = this.filteredCafes.map(cafe => this.renderCardHtml(cafe)).join('');

    // Attach card event listeners
    this.filteredCafes.forEach(cafe => {
      const card = document.getElementById(`cafe-card-${cafe.id}`);
      if (!card) return;

      // Card click -> Open details
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-btn-action') || e.target.closest('.fav-toggle') || e.target.closest('.visited-toggle')) {
          return; // Don't open detail if clicking quick buttons
        }
        this.openDetail(cafe);
      });

      // Quick Favorite Toggle
      const favBtn = card.querySelector('.fav-toggle');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          store.toggleFavorite(cafe.id);
          this.applyFilters();
        });
      }

      // Quick Visited Toggle
      const visitedBtn = card.querySelector('.visited-toggle');
      if (visitedBtn) {
        visitedBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          store.toggleVisited(cafe.id);
          this.applyFilters();
        });
      }

      // Quick Directions
      const dirBtn = card.querySelector('.quick-dir-btn');
      if (dirBtn) {
        dirBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const url = `https://www.google.com/maps/dir/?api=1&destination=${cafe.lat},${cafe.lon}&travelmode=walking`;
          window.open(url, '_blank', 'noopener,noreferrer');
        });
      }
    });
  }

  renderCardHtml(cafe) {
    const userData = store.get(cafe.id);
    const status = getCafeOpenStatus(cafe.opening_hours);
    const distText = cafe.distanceMeters ? formatWalkDistance(cafe.distanceMeters) : null;
    const isSpecialty = (cafe.tags || []).includes('specialty_coffee');
    const isNearUni = (cafe.tags || []).includes('near_uni');

    const googleBadge = cafe.google_rating ? `
      <a href="${cafe.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name + ' Halle')}`}"
         target="_blank"
         rel="noopener noreferrer"
         class="google-rating-pill"
         title="Google Maps: ${cafe.google_rating} ★ (${cafe.google_review_count || 0} reviews)"
         onclick="event.stopPropagation();">
        <span class="rating-star-icon">★</span>
        <span class="rating-val">${cafe.google_rating.toFixed(1)}</span>
        <span class="rating-count">(${cafe.google_review_count || 0})</span>
      </a>
    ` : '';

    return `
      <div id="cafe-card-${cafe.id}" class="cafe-card ${userData.visited ? 'is-visited' : ''}">
        <div class="card-header">
          <div class="card-title-group">
            <h3 class="card-name">${cafe.name}</h3>
            <div class="card-meta">
              <span class="status-badge ${status.statusClass}">${status.badgeText}</span>
              ${googleBadge}
              ${distText ? `<span class="dist-badge">🚶 ${distText}</span>` : ''}
              <span class="card-neighborhood">${cafe.neighborhood}</span>
            </div>
          </div>
          <button class="fav-toggle ${userData.favorite ? 'is-fav' : ''}" title="Toggle Favorite">
            ${userData.favorite ? '★' : '☆'}
          </button>
        </div>

        <p class="card-address">📍 ${cafe.address || 'Halle (Saale)'}</p>

        ${cafe.notes ? `<p class="card-notes">${cafe.notes}</p>` : ''}

        <div class="card-tags">
          ${isSpecialty ? `<span class="tag-pill tag-specialty">★ Specialty Coffee</span>` : ''}
          ${isNearUni ? `<span class="tag-pill tag-uni">🎓 Near Uni</span>` : ''}
          ${(cafe.tags || []).filter(t => t !== 'specialty_coffee' && t !== 'near_uni').slice(0, 3).map(t => `<span class="tag-pill">#${t.replace('_', ' ')}</span>`).join('')}
        </div>

        <div class="card-actions">
          <button class="card-btn-action visited-toggle ${userData.visited ? 'btn-visited' : ''}">
            ${userData.visited ? '✓ Visited' : '+ Mark Visited'}
          </button>
          <button class="card-btn-action quick-dir-btn" title="Walking Directions">
            ↗ Directions
          </button>
          ${userData.rating > 0 ? `<span class="user-star-rating">${'★'.repeat(userData.rating)}${'☆'.repeat(5 - userData.rating)}</span>` : ''}
        </div>
      </div>
    `;
  }

  openDetail(cafe) {
    this.selectedCafe = cafe;
    this.lastModalOpenTime = Date.now();
    this.map.selectCafe(cafe.id);

    // Highlight matching card in list and scroll into view smoothly
    const card = document.getElementById(`cafe-card-${cafe.id}`);
    if (card) {
      document.querySelectorAll('.cafe-card').forEach(c => c.classList.remove('is-active-selected'));
      card.classList.add('is-active-selected');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const userData = store.get(cafe.id);
    const status = getCafeOpenStatus(cafe.opening_hours);
    const weeklySchedule = formatWeeklySchedule(cafe.opening_hours);

    // Populate modal elements
    document.getElementById('detail-name').textContent = cafe.name;
    document.getElementById('detail-address').textContent = cafe.address || cafe.neighborhood;
    document.getElementById('detail-status').innerHTML = `
      <span class="status-badge ${status.statusClass}">${status.badgeText}</span>
    `;

    // Google Maps rating badge in modal
    const googleDetailEl = document.getElementById('detail-google-badge');
    if (googleDetailEl) {
      if (cafe.google_rating) {
        googleDetailEl.innerHTML = `
          <a href="${cafe.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name + ' Halle')}`}"
             target="_blank"
             rel="noopener noreferrer"
             class="google-rating-pill"
             title="Open on Google Maps"
             style="text-decoration:none;">
            <span style="color:#f9e2af;">★</span>
            <span>${cafe.google_rating.toFixed(1)} on Google Maps</span>
            <span style="opacity:0.75; font-size:12px;">(${cafe.google_review_count || 0} reviews)</span>
          </a>
        `;
        googleDetailEl.classList.remove('hidden');
      } else {
        googleDetailEl.innerHTML = '';
        googleDetailEl.classList.add('hidden');
      }
    }

    // External links
    const gmapsWalkUrl = `https://www.google.com/maps/dir/?api=1&destination=${cafe.lat},${cafe.lon}&travelmode=walking`;
    const appleMapsUrl = `https://maps.apple.com/?daddr=${cafe.lat},${cafe.lon}&dirflg=w`;

    const gmapsBtn = document.getElementById('detail-gmaps-link');
    const appleBtn = document.getElementById('detail-apple-link');
    if (gmapsBtn) gmapsBtn.href = gmapsWalkUrl;
    if (appleBtn) appleBtn.href = appleMapsUrl;

    const webLink = document.getElementById('detail-website-link');
    if (webLink) {
      if (cafe.website) {
        webLink.href = cafe.website;
        webLink.classList.remove('hidden');
      } else {
        webLink.classList.add('hidden');
      }
    }

    // Weekly schedule list
    const scheduleEl = document.getElementById('detail-schedule-list');
    scheduleEl.innerHTML = weeklySchedule.map(line => `<li>${line}</li>`).join('');

    // User review & rating controls
    const visitedCheckbox = document.getElementById('detail-visited-check');
    visitedCheckbox.checked = userData.visited;

    const ratingContainer = document.getElementById('detail-rating-stars');
    this.renderRatingStars(ratingContainer, userData.rating);

    const notesTextarea = document.getElementById('detail-notes-input');
    notesTextarea.value = userData.notes || '';

    // Save handler
    const saveBtn = document.getElementById('detail-save-btn');
    saveBtn.onclick = () => {
      store.set(cafe.id, {
        visited: visitedCheckbox.checked,
        notes: notesTextarea.value.trim()
      });
      this.applyFilters();
      this.closeDetail();
    };

    visitedCheckbox.onchange = () => {
      store.set(cafe.id, { visited: visitedCheckbox.checked });
      this.applyFilters();
    };

    this.detailModal.classList.remove('hidden');
    this.detailModal.classList.add('flex');
  }

  renderRatingStars(container, currentRating) {
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('button');
      star.type = 'button';
      star.className = `star-btn ${i <= currentRating ? 'is-active' : ''}`;
      star.innerHTML = i <= currentRating ? '★' : '☆';
      star.addEventListener('click', () => {
        if (this.selectedCafe) {
          const newRating = (i === currentRating) ? 0 : i;
          store.setRating(this.selectedCafe.id, newRating);
          this.renderRatingStars(container, newRating);
          this.applyFilters();
        }
      });
      container.appendChild(star);
    }
  }

  closeDetail() {
    this.detailModal.classList.add('hidden');
    this.detailModal.classList.remove('flex');
    this.selectedCafe = null;
  }

  showMapPreview(cafe) {
    if (!this.mapPreviewCard) return;

    this.selectedCafe = cafe;
    this.previewCafe = cafe;
    const status = getCafeOpenStatus(cafe.opening_hours);
    const walkText = formatWalkDistance(cafe.distanceMeters);

    if (this.previewTitle) this.previewTitle.textContent = cafe.name;
    if (this.previewBadgeStatus) {
      this.previewBadgeStatus.textContent = status.badgeText;
      this.previewBadgeStatus.className = `preview-status-pill ${status.statusClass}`;
    }
    if (this.previewMeta) {
      const parts = [cafe.neighborhood];
      if (cafe.google_rating) {
        parts.push(`★ ${cafe.google_rating.toFixed(1)} (${cafe.google_review_count || 0})`);
      }
      if (walkText) {
        parts.push(walkText);
      }
      this.previewMeta.textContent = parts.join(' • ');
    }
    if (this.previewNotes) {
      this.previewNotes.textContent = cafe.notes || (cafe.tags || []).map(t => `#${t.replace('_', ' ')}`).slice(0, 3).join(' ') || '';
    }
    if (this.previewDirectionsBtn) {
      this.previewDirectionsBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${cafe.lat},${cafe.lon}&travelmode=walking`;
    }

    this.mapPreviewCard.classList.remove('hidden');
  }

  hideMapPreview() {
    if (this.mapPreviewCard) {
      this.mapPreviewCard.classList.add('hidden');
    }
    this.previewCafe = null;
  }

  renderStats() {
    const visitedCount = store.getVisitedCount();
    const statsEl = document.getElementById('visited-stats-count');
    if (statsEl) {
      statsEl.textContent = `${visitedCount} / ${this.cafes.length} explored`;
    }
  }

  openBackupModal() {
    this.lastBackupOpenTime = Date.now();
    this.backupModal.classList.remove('hidden');
    this.backupModal.classList.add('flex');
  }

  closeBackupModal() {
    this.backupModal.classList.add('hidden');
    this.backupModal.classList.remove('flex');
  }

  exportUserData() {
    const jsonStr = store.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `halle-cafes-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importUserData(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const res = store.importBackup(content);
      if (res.success) {
        this.showToast(`Successfully imported ${res.count} cafe records!`);
        this.applyFilters();
        this.closeBackupModal();
      } else {
        this.showToast('Failed to import backup: ' + res.error);
      }
    };
    reader.readAsText(file);
  }
}

// Bootstrap on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new HalleCafeApp();
  });
} else {
  window.app = new HalleCafeApp();
}

