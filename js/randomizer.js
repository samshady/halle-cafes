/**
 * randomizer.js
 * "Pick For Me" randomizer modal with tactile shuffle animations.
 * Breaks decision fatigue when deciding where to go in Halle.
 */

import { getCafeOpenStatus } from './hours.js';
import { formatWalkDistance } from './map.js';

export class CafeRandomizer {
  constructor(onSelectCafe, onNotify = null) {
    this.onSelectCafe = onSelectCafe;
    this.onNotify = onNotify;
    this.modalEl = document.getElementById('randomizer-modal');
    this.nameEl = document.getElementById('randomizer-winner-name');
    this.metaEl = document.getElementById('randomizer-winner-meta');
    this.tagsEl = document.getElementById('randomizer-winner-tags');
    this.notesEl = document.getElementById('randomizer-winner-notes');
    this.actionsEl = document.getElementById('randomizer-actions');
    this.reelEl = document.getElementById('randomizer-reel');
    this.isSpinning = false;
    this.currentWinner = null;
    this._bindEvents();
  }

  _bindEvents() {
    const closeBtn = document.getElementById('randomizer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (Date.now() - (this.lastOpenTime || 0) < 350) return;
        if (e.target === this.modalEl) this.close();
      });
    }

    const spinAgainBtn = document.getElementById('randomizer-spin-again');
    if (spinAgainBtn) {
      spinAgainBtn.addEventListener('click', () => {
        if (!this.isSpinning && this.lastPool) {
          this.spin(this.lastPool);
        }
      });
    }

    const viewDetailsBtn = document.getElementById('randomizer-view-details');
    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener('click', () => {
        if (this.currentWinner && this.onSelectCafe) {
          this.close();
          this.onSelectCafe(this.currentWinner);
        }
      });
    }

    const walkBtn = document.getElementById('randomizer-walk-directions');
    if (walkBtn) {
      walkBtn.addEventListener('click', () => {
        if (this.currentWinner) {
          const url = `https://www.google.com/maps/dir/?api=1&destination=${this.currentWinner.lat},${this.currentWinner.lon}&travelmode=walking`;
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    }
  }

  open() {
    this.lastOpenTime = Date.now();
    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
      this.modalEl.classList.add('flex');
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
      this.modalEl.classList.remove('flex');
    }
    this.isSpinning = false;
  }

  spin(pool) {
    if (!pool || pool.length === 0) {
      if (this.onNotify) {
        this.onNotify('No cafes match the current filters to pick from!');
      } else {
        alert('No cafes match the current filters to pick from!');
      }
      return;
    }
    this.lastPool = pool;
    this.isSpinning = true;
    this.open();

    // Show reel, hide result card during spin
    this.reelEl.classList.remove('hidden');
    this.actionsEl.classList.add('opacity-0', 'pointer-events-none');
    this.notesEl.classList.add('hidden');

    let steps = 22;
    let speed = 40;
    let stepCount = 0;

    const doStep = () => {
      const randomCandidate = pool[Math.floor(Math.random() * pool.length)];
      this.reelEl.textContent = `☕ ${randomCandidate.name}`;

      stepCount++;
      if (stepCount < steps) {
        speed = Math.floor(speed * 1.09); // gradual deceleration
        setTimeout(doStep, speed);
      } else {
        // Winner finalized
        const winner = pool[Math.floor(Math.random() * pool.length)];
        this.currentWinner = winner;
        this._showWinner(winner);
      }
    };

    doStep();
  }

  _showWinner(cafe) {
    this.isSpinning = false;
    this.reelEl.classList.add('hidden');

    const status = getCafeOpenStatus(cafe.opening_hours);
    const distText = cafe.distanceMeters ? formatWalkDistance(cafe.distanceMeters) : null;

    const googleBadge = cafe.google_rating ? `
      <span class="google-rating-pill" title="Google Maps Rating">
        <span style="color:#f9e2af;">★</span>
        <span>${cafe.google_rating.toFixed(1)}</span>
        <span style="opacity:0.75; font-size:11px;">(${cafe.google_review_count || 0})</span>
      </span>
    ` : '';

    this.nameEl.textContent = cafe.name;
    this.metaEl.innerHTML = `
      <span class="status-badge ${status.statusClass}">${status.badgeText}</span>
      ${googleBadge}
      <span class="text-sm opacity-80">${cafe.address || cafe.neighborhood}</span>
      ${distText ? `<span class="dist-badge">🚶 ${distText}</span>` : ''}
    `;

    if (cafe.notes) {
      this.notesEl.textContent = `"${cafe.notes}"`;
      this.notesEl.classList.remove('hidden');
    }

    this.tagsEl.innerHTML = (cafe.tags || [])
      .slice(0, 4)
      .map(t => `<span class="tag-pill">#${t.replace('_', ' ')}</span>`)
      .join(' ');

    this.actionsEl.classList.remove('opacity-0', 'pointer-events-none');

    // Trigger celebratory confetti if library is loaded
    if (typeof window.confetti === 'function') {
      try {
        window.confetti({
          particleCount: 75,
          spread: 65,
          origin: { y: 0.58 },
          colors: ['#cba6f7', '#fab387', '#a6e3a1', '#89b4fa', '#f9e2af']
        });
      } catch (e) {
        // Ignore confetti error if any
      }
    }
  }
}

