/**
 * randomizer.js
 * "Pick For Me" randomizer modal with tactile shuffle animations.
 * Breaks decision fatigue when deciding where to go in Halle.
 */

import { getCafeOpenStatus } from './hours.js';
import { formatWalkDistance } from './map.js';

export class CafeRandomizer {
  constructor(onSelectCafe) {
    this.onSelectCafe = onSelectCafe;
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
      alert('No cafes match the current filters to pick from!');
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

    this.nameEl.textContent = cafe.name;
    this.metaEl.innerHTML = `
      <span class="status-badge ${status.statusClass}">${status.badgeText}</span>
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
  }
}
