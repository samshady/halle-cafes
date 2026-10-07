import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('index.html contains all DOM element IDs required by JS modules', () => {
  const htmlPath = path.resolve('index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  const requiredIds = [
    'cafe-cards-list',
    'cafe-count',
    'search-input',
    'sort-select',
    'search-clear-btn',
    'locate-btn',
    'pick-btn',
    'detail-modal',
    'detail-close-btn',
    'detail-name',
    'detail-address',
    'detail-status',
    'detail-gmaps-link',
    'detail-apple-link',
    'detail-website-link',
    'detail-schedule-list',
    'detail-google-badge',
    'detail-visited-check',
    'detail-rating-stars',
    'detail-notes-input',
    'detail-save-btn',
    'backup-modal',
    'backup-btn',
    'backup-close-btn',
    'export-json-btn',
    'import-json-file',
    'app-toast',
    'tab-list-btn',
    'tab-map-btn',
    'list-view-container',
    'map-view-container',
    'map-container',
    'randomizer-modal',
    'randomizer-close-btn',
    'randomizer-winner-name',
    'randomizer-winner-meta',
    'randomizer-winner-tags',
    'randomizer-winner-notes',
    'randomizer-actions',
    'randomizer-reel',
    'randomizer-spin-again',
    'randomizer-view-details',
    'randomizer-walk-directions',
    'visited-stats-count'
  ];

  for (const id of requiredIds) {
    const hasId = htmlContent.includes(`id="${id}"`);
    assert.ok(hasId, `index.html is missing required element with id="${id}"`);
  }
});

test('manifest.webmanifest is valid JSON with required PWA fields', () => {
  const manifestPath = path.resolve('manifest.webmanifest');
  const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  assert.ok(manifestContent.name);
  assert.ok(manifestContent.short_name);
  assert.ok(manifestContent.start_url);
  assert.equal(manifestContent.display, 'standalone');
  assert.ok(manifestContent.theme_color);
  assert.ok(Array.isArray(manifestContent.icons));
  assert.ok(manifestContent.icons.length > 0);
});

test('sw.js lists existing core assets in CACHE_NAME', () => {
  const swPath = path.resolve('sw.js');
  const swContent = fs.readFileSync(swPath, 'utf-8');

  assert.ok(swContent.includes('halle-cafes-'));
  assert.ok(swContent.includes('./index.html'));
  assert.ok(swContent.includes('./css/style.css'));
  assert.ok(swContent.includes('./js/app.js'));
  assert.ok(swContent.includes('./js/data.js'));
});
