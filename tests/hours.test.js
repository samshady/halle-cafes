import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOpeningHours, getCafeOpenStatus, formatWeeklySchedule } from '../js/hours.js';
import { CAFES_DATA } from '../js/data.js';

test('parseOpeningHours handles standard weekday syntax', () => {
  const schedule = parseOpeningHours('Mo-Fr 08:00-18:00; Sa 09:00-14:00');
  assert.ok(schedule);
  assert.equal(schedule.Mo.length, 1);
  assert.equal(schedule.Mo[0].start, 8 * 60);
  assert.equal(schedule.Mo[0].end, 18 * 60);
  assert.equal(schedule.Sa.length, 1);
  assert.equal(schedule.Sa[0].start, 9 * 60);
  assert.equal(schedule.Sa[0].end, 14 * 60);
  assert.equal(schedule.Su.length, 0); // Sunday closed
});

test('getCafeOpenStatus returns structured status object', () => {
  const status = getCafeOpenStatus('Mo-Su 00:00-24:00');
  assert.ok(status);
  assert.equal(status.isOpen, true);
  assert.equal(status.statusClass, 'open');

  const emptyStatus = getCafeOpenStatus('');
  assert.equal(emptyStatus.isOpen, false);
  assert.equal(emptyStatus.statusClass, 'unknown');
});

test('formatWeeklySchedule produces 7 days', () => {
  const lines = formatWeeklySchedule('Mo-Fr 09:00-18:00');
  assert.equal(lines.length, 7);
  assert.ok(lines[0].includes('Montag: 09:00-18:00'));
  assert.ok(lines[6].includes('Sonntag: Geschlossen'));
});

test('dataset contains required fields and valid coordinates for Halle', () => {
  assert.ok(CAFES_DATA.length >= 80, `Expected at least 80 cafes, got ${CAFES_DATA.length}`);
  
  // Halle coordinates are roughly lat 51.4 to 51.6, lon 11.9 to 12.1
  for (const cafe of CAFES_DATA) {
    assert.ok(cafe.id, 'Cafe missing id');
    assert.ok(cafe.name, 'Cafe missing name');
    assert.ok(cafe.lat >= 51.4 && cafe.lat <= 51.6, `Invalid lat for ${cafe.name}: ${cafe.lat}`);
    assert.ok(cafe.lon >= 11.8 && cafe.lon <= 12.1, `Invalid lon for ${cafe.name}: ${cafe.lon}`);
  }
});
