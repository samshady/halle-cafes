/**
 * store.js
 * Local-first user preference, visit tracker, rating, and notes store.
 * Persists in LocalStorage with backup export/import features.
 */

const STORAGE_KEY = 'halle_cafes_userdata_v1';

// Initial pre-seed data based on Sam's desktop list checkmarks and habitual spots
const INITIAL_PRESEED = {
  '7-gramm': {
    visited: true,
    rating: 5,
    notes: 'Our regular default spot right next to the uni! Benchmark specialty third-wave coffee.',
    visitedAt: '2026-10-01',
    favorite: true
  },
  'she-coffee': {
    visited: true,
    rating: 4,
    notes: 'Checked off! Cozy aesthetic spot in the Kleine Ulrichstraße.',
    visitedAt: '2026-09-20',
    favorite: false
  }
};

class CafeStore {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Pre-seed initial visited spots
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PRESEED));
        return { ...INITIAL_PRESEED };
      }
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Could not read user data from localStorage:', e);
      return { ...INITIAL_PRESEED };
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  get(cafeId) {
    return this.data[cafeId] || {
      visited: false,
      rating: 0,
      notes: '',
      visitedAt: null,
      favorite: false
    };
  }

  set(cafeId, updates) {
    const existing = this.get(cafeId);
    this.data[cafeId] = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this._save();
    return this.data[cafeId];
  }

  toggleVisited(cafeId) {
    const current = this.get(cafeId);
    const nextVisited = !current.visited;
    return this.set(cafeId, {
      visited: nextVisited,
      visitedAt: nextVisited ? (current.visitedAt || new Date().toISOString().split('T')[0]) : null
    });
  }

  toggleFavorite(cafeId) {
    const current = this.get(cafeId);
    return this.set(cafeId, { favorite: !current.favorite });
  }

  setRating(cafeId, rating) {
    return this.set(cafeId, { rating: Number(rating) });
  }

  setNotes(cafeId, notes) {
    return this.set(cafeId, { notes: String(notes) });
  }

  getAll() {
    return this.data;
  }

  getVisitedCount() {
    return Object.values(this.data).filter(d => d.visited).length;
  }

  exportBackup() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cafes: this.data
    };
    return JSON.stringify(payload, null, 2);
  }

  importBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed.cafes === 'object') {
        this.data = { ...this.data, ...parsed.cafes };
        this._save();
        return { success: true, count: Object.keys(parsed.cafes).length };
      }
      return { success: false, error: 'Invalid backup file format' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  resetToDefault() {
    this.data = { ...INITIAL_PRESEED };
    this._save();
  }
}

export const store = new CafeStore();
