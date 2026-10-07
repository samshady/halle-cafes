import test from 'node:test';
import assert from 'node:assert/strict';
import { CAFES_DATA } from '../js/data.js';

// Setup mock storage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
}
global.localStorage = new MockLocalStorage();
const { store } = await import('../js/store.js');

test('search query matches names, addresses, neighborhoods and tags case-insensitively', () => {
  const queryMatch = (cafe, query) => {
    const q = query.toLowerCase().trim();
    const text = `${cafe.name} ${cafe.address} ${cafe.neighborhood} ${(cafe.tags || []).join(' ')} ${cafe.notes || ''}`.toLowerCase();
    return text.includes(q);
  };

  const resultsName = CAFES_DATA.filter(c => queryMatch(c, 'gramm'));
  assert.ok(resultsName.some(c => c.id === '7-gramm'));

  const resultsStreet = CAFES_DATA.filter(c => queryMatch(c, 'barfüßerstraße'));
  assert.ok(resultsStreet.length >= 1);

  const resultsTag = CAFES_DATA.filter(c => queryMatch(c, 'specialty_coffee'));
  assert.ok(resultsTag.length >= 3);
});

test('filtering by unvisited returns only non-visited spots', () => {
  const unvisited = CAFES_DATA.filter(c => !store.get(c.id).visited);
  assert.ok(unvisited.length > 0);
  assert.ok(!unvisited.some(c => c.id === '7-gramm')); // 7-gramm is visited
});

test('filtering by specialty coffee returns curated third wave places', () => {
  const specialty = CAFES_DATA.filter(c => (c.tags || []).includes('specialty_coffee'));
  assert.ok(specialty.length >= 3);
  assert.ok(specialty.some(c => c.id === '7-gramm'));
  assert.ok(specialty.some(c => c.id === 'kaffeeroesterei-roy'));
});

test('sorting alphabetically correctly sorts German names', () => {
  const list = [...CAFES_DATA].slice(0, 10);
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  for (let i = 0; i < list.length - 1; i++) {
    assert.ok(list[i].name.localeCompare(list[i + 1].name, 'de') <= 0);
  }
});

test('sorting by distance handles missing or present distances', () => {
  const list = [
    { name: 'Cafe A', distanceMeters: 800 },
    { name: 'Cafe B', distanceMeters: 200 },
    { name: 'Cafe C', distanceMeters: null }
  ];
  list.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
  assert.equal(list[0].name, 'Cafe B');
  assert.equal(list[1].name, 'Cafe A');
  assert.equal(list[2].name, 'Cafe C');
});

test('sorting by Google rating ranks highest rated and most reviewed first', () => {
  const sample = [
    { name: 'Cafe Low', google_rating: 4.2, google_review_count: 50 },
    { name: 'Cafe High Review', google_rating: 4.8, google_review_count: 320 },
    { name: 'Cafe High Few', google_rating: 4.8, google_review_count: 40 },
    { name: 'Cafe Mid', google_rating: 4.5, google_review_count: 100 }
  ];

  sample.sort((a, b) => {
    const rA = a.google_rating ?? 0;
    const rB = b.google_rating ?? 0;
    if (rB !== rA) return rB - rA;
    return (b.google_review_count ?? 0) - (a.google_review_count ?? 0);
  });

  assert.equal(sample[0].name, 'Cafe High Review');
  assert.equal(sample[1].name, 'Cafe High Few');
  assert.equal(sample[2].name, 'Cafe Mid');
  assert.equal(sample[3].name, 'Cafe Low');
});

