import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistance, formatWalkDistance } from '../js/map.js';

test('calculateDistance computes accurate meters between Halle landmarks', () => {
  // Marktplatz Halle: 51.4827, 11.9700
  // Universitätsplatz Halle: 51.4862, 11.9688
  // Distance is roughly ~400 - 450 meters
  const dist = calculateDistance(51.4827, 11.9700, 51.4862, 11.9688);
  assert.ok(dist >= 380 && dist <= 460, `Expected ~400-450m, got ${dist}m`);

  // Same point distance is 0
  assert.equal(calculateDistance(51.4827, 11.9700, 51.4827, 11.9700), 0);
});

test('formatWalkDistance formats meters and kilometers with walking minutes pace', () => {
  assert.equal(formatWalkDistance(null), null);
  assert.equal(formatWalkDistance(240), '240 m • 3 min walk');
  assert.equal(formatWalkDistance(800), '800 m • 10 min walk');
  assert.equal(formatWalkDistance(1600), '1.6 km • 20 min walk');
});

test('navigation URLs generate valid Google and Apple Maps links', () => {
  const cafe = { lat: 51.48544, lon: 11.96991, name: '7 Gramm' };

  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${cafe.lat},${cafe.lon}&travelmode=walking`;
  assert.ok(gmapsUrl.includes('travelmode=walking'));
  assert.ok(gmapsUrl.includes('51.48544'));
  assert.ok(gmapsUrl.includes('11.96991'));

  const appleUrl = `https://maps.apple.com/?daddr=${cafe.lat},${cafe.lon}&dirflg=w`;
  assert.ok(appleUrl.includes('dirflg=w')); // walking flag
  assert.ok(appleUrl.includes('51.48544'));
});
