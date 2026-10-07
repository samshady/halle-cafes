import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node test environment
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
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new MockLocalStorage();

const { store } = await import('../js/store.js');

test('store initializes with 7-gramm and she-coffee preseeded', () => {
  const gramm = store.get('7-gramm');
  assert.equal(gramm.visited, true);
  assert.equal(gramm.rating, 5);
  assert.equal(gramm.favorite, true);

  const she = store.get('she-coffee');
  assert.equal(she.visited, true);
  assert.equal(she.rating, 4);

  const unknown = store.get('non-existent-cafe');
  assert.equal(unknown.visited, false);
  assert.equal(unknown.rating, 0);
  assert.equal(unknown.notes, '');
});

test('store toggles visited status and updates timestamp', () => {
  const cafeId = 'cafe-noir';
  assert.equal(store.get(cafeId).visited, false);

  const updated = store.toggleVisited(cafeId);
  assert.equal(updated.visited, true);
  assert.ok(updated.visitedAt);

  const toggledBack = store.toggleVisited(cafeId);
  assert.equal(toggledBack.visited, false);
  assert.equal(toggledBack.visitedAt, null);
});

test('store sets rating and notes correctly', () => {
  const cafeId = 'koffij';
  store.setRating(cafeId, 5);
  assert.equal(store.get(cafeId).rating, 5);

  store.setNotes(cafeId, 'Tried the cinnamon bun and oat flat white.');
  assert.equal(store.get(cafeId).notes, 'Tried the cinnamon bun and oat flat white.');
});

test('store toggles favorite status', () => {
  const cafeId = 'miss-august';
  assert.equal(store.get(cafeId).favorite, false);

  store.toggleFavorite(cafeId);
  assert.equal(store.get(cafeId).favorite, true);

  store.toggleFavorite(cafeId);
  assert.equal(store.get(cafeId).favorite, false);
});

test('store exports and imports JSON backups cleanly', () => {
  const exportStr = store.exportBackup();
  const parsed = JSON.parse(exportStr);
  assert.equal(parsed.version, 1);
  assert.ok(parsed.cafes);
  assert.ok(parsed.cafes['7-gramm']);

  // Test import into clean state
  const mockBackup = JSON.stringify({
    version: 1,
    cafes: {
      'custom-cafe': {
        visited: true,
        rating: 4,
        notes: 'Restored from cloud backup',
        favorite: true
      }
    }
  });

  const res = store.importBackup(mockBackup);
  assert.equal(res.success, true);
  assert.equal(store.get('custom-cafe').notes, 'Restored from cloud backup');

  // Test invalid import handling
  const badRes = store.importBackup('{ corrupted json ...');
  assert.equal(badRes.success, false);
});
