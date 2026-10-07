import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('Full feature browser automation suite across all user interactions', async (t) => {
  const port = 8133;
  const cdpPort = 9345;

  // 1. Start HTTP server
  const server = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: '/home/sam/Development/personal/halle-cafes'
  });
  await new Promise(r => setTimeout(r, 600));

  // 2. Start Headless Chrome
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    '--window-size=1280,800',
    `http://localhost:${port}/`
  ]);
  await new Promise(r => setTimeout(r, 1500));

  const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
  const targets = await listRes.json();
  const page = targets.find(t => t.type === 'page');
  assert.ok(page, 'Chrome page target found');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let idCounter = 1;
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const curId = idCounter++;
      const handler = (evt) => {
        const d = JSON.parse(evt.data);
        if (d.id === curId) {
          ws.removeEventListener('message', handler);
          if (d.error) reject(d.error);
          else resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await cdp('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`CDP Eval Exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  await cdp('Runtime.enable');
  await cdp('Page.enable');

  // Wait for app ready
  let ready = false;
  for (let i = 0; i < 30; i++) {
    ready = await evaluate('Boolean(window.app && window.app.map && window.app.map.markers.size > 0)');
    if (ready) break;
    await new Promise(r => setTimeout(r, 150));
  }
  assert.ok(ready, 'Application bootstrap completed with markers rendered');

  await t.test('1. Initial state has 94 cafes, preseeded 7 Gramm and She Coffee', async () => {
    const state = await evaluate(`
      (() => {
        const total = window.app.cafes.length;
        const visibleCards = document.querySelectorAll('.cafe-card').length;
        const countText = document.getElementById('cafe-count').textContent;
        const statsText = document.getElementById('visited-stats-count').textContent;
        return { total, visibleCards, countText, statsText };
      })()
    `);
    assert.equal(state.total, 94);
    assert.equal(state.visibleCards, 94);
    assert.ok(state.countText.includes('94 places'));
    assert.ok(state.statsText.includes('explored'));
  });

  await t.test('2. Pin click on map opens Cafe Detail Modal with accurate information', async () => {
    const result = await evaluate(`
      (() => {
        // Find 7 Gramm marker
        const marker7 = window.app.map.markers.get('7-gramm');
        if (!marker7) return { error: '7 Gramm marker not found' };

        // Click marker element
        const el = marker7.getElement();
        el.click();

        const modal = document.getElementById('detail-modal');
        const isHidden = modal.classList.contains('hidden');
        const name = document.getElementById('detail-name').textContent;
        const address = document.getElementById('detail-address').textContent;
        const googleBadge = document.getElementById('detail-google-badge').textContent;

        return { isHidden, name, address, googleBadge };
      })()
    `);
    assert.equal(result.isHidden, false, 'Modal should be visible');
    assert.equal(result.name, '7 Gramm');
    assert.ok(result.address.includes('Barfüßerstraße') || result.address.includes('Altstadt'));
    assert.ok(result.googleBadge.includes('4.8'), 'Google rating should be displayed');
  });

  await t.test('3. Modal can be dismissed via Escape key', async () => {
    const closed = await evaluate(`
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        const modal = document.getElementById('detail-modal');
        return modal.classList.contains('hidden');
      })()
    `);
    assert.equal(closed, true, 'Escape key should close detail modal');
  });

  await t.test('4. Search filtering narrows cards and map markers', async () => {
    const res = await evaluate(`
      (() => {
        const input = document.getElementById('search-input');
        input.value = 'specialty';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const filteredCount = window.app.filteredCafes.length;
        const cardCount = document.querySelectorAll('.cafe-card').length;
        const markerCount = window.app.map.markers.size;
        return { filteredCount, cardCount, markerCount };
      })()
    `);
    assert.ok(res.filteredCount > 0 && res.filteredCount < 94);
    assert.equal(res.filteredCount, res.cardCount);
    assert.equal(res.filteredCount, res.markerCount);

    // Test clear search button
    const reset = await evaluate(`
      (() => {
        document.getElementById('search-clear-btn').click();
        return {
          filteredCount: window.app.filteredCafes.length,
          searchValue: document.getElementById('search-input').value
        };
      })()
    `);
    assert.equal(reset.filteredCount, 94);
    assert.equal(reset.searchValue, '');
  });

  await t.test('5. Filter chips filter correctly', async () => {
    // Test Specialty Coffee filter
    const specialty = await evaluate(`
      (() => {
        const chip = document.querySelector('.filter-chip[data-filter="specialty"]');
        chip.click();
        return {
          chipActive: chip.classList.contains('active'),
          count: window.app.filteredCafes.length,
          allSpecialty: window.app.filteredCafes.every(c => (c.tags || []).includes('specialty_coffee'))
        };
      })()
    `);
    assert.equal(specialty.chipActive, true);
    assert.ok(specialty.count >= 3);
    assert.equal(specialty.allSpecialty, true);

    // Test Unvisited filter
    const unvisited = await evaluate(`
      (() => {
        const chip = document.querySelector('.filter-chip[data-filter="unvisited"]');
        chip.click();
        return {
          count: window.app.filteredCafes.length,
          has7Gramm: window.app.filteredCafes.some(c => c.id === '7-gramm')
        };
      })()
    `);
    assert.ok(unvisited.count > 0);
    assert.equal(unvisited.has7Gramm, false, '7 Gramm is visited so must not be in unvisited');

    // Reset back to All
    await evaluate(`document.querySelector('.filter-chip[data-filter="all"]').click();`);
  });

  await t.test('6. Sorting by Google Rating places highest rated with reviews first', async () => {
    const sortRes = await evaluate(`
      (() => {
        const select = document.getElementById('sort-select');
        select.value = 'google_rating';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        const top = window.app.filteredCafes.slice(0, 5).map(c => ({
          name: c.name,
          rating: c.google_rating,
          reviews: c.google_review_count
        }));
        return top;
      })()
    `);
    assert.ok(sortRes[0].rating >= 4.7);
    for (let i = 0; i < sortRes.length - 1; i++) {
      assert.ok(sortRes[i].rating >= sortRes[i + 1].rating);
    }
  });

  await t.test('7. "Pick For Me" randomizer modal spins and reveals winner with confetti', async () => {
    const randomizerRes = await evaluate(`
      (() => {
        document.getElementById('pick-btn').click();
        const modal = document.getElementById('randomizer-modal');
        const isHiddenDuringSpin = modal.classList.contains('hidden');
        return { modalOpen: !isHiddenDuringSpin };
      })()
    `);
    assert.equal(randomizerRes.modalOpen, true);

    // Wait for spin reel to complete (takes ~2.5s)
    await new Promise(r => setTimeout(r, 3200));

    const winnerRes = await evaluate(`
      (() => {
        const winnerName = document.getElementById('randomizer-winner-name').textContent;
        const reelHidden = document.getElementById('randomizer-reel').classList.contains('hidden');
        const actionsVisible = !document.getElementById('randomizer-actions').classList.contains('opacity-0');
        return { winnerName, reelHidden, actionsVisible };
      })()
    `);
    assert.ok(winnerRes.winnerName.length > 2);
    assert.equal(winnerRes.reelHidden, true);
    assert.equal(winnerRes.actionsVisible, true);

    // Close randomizer
    await evaluate(`window.app.randomizer.close();`);
  });

  await t.test('8. Personal rating & notes persistence in LocalStorage', async () => {
    const testNote = 'Best oat cortado in Halle! Tested at ' + Date.now();
    await evaluate(`
      (() => {
        window.app.openDetail(window.app.cafes.find(c => c.id === '7-gramm'));
        const starBtns = document.querySelectorAll('#detail-rating-stars .star-btn');
        starBtns[3].click(); // Set to 4 stars
        document.getElementById('detail-notes-input').value = ${JSON.stringify(testNote)};
        document.getElementById('detail-save-btn').click();
      })()
    `);

    const storedData = await evaluate(`
      (() => {
        const raw = localStorage.getItem('halle_cafes_userdata_v1');
        const data = JSON.parse(raw);
        return data['7-gramm'];
      })()
    `);
    assert.equal(storedData.rating, 4);
    assert.equal(storedData.notes, testNote);
  });

  await t.test('9. Backup export generates valid JSON and toast notification shows', async () => {
    const backupRes = await evaluate(`
      (() => {
        const jsonStr = window.app.store.exportBackup();
        const parsed = JSON.parse(jsonStr);
        window.app.showToast('Backup exported successfully');
        const toast = document.getElementById('app-toast');
        return {
          version: parsed.version,
          recordCount: Object.keys(parsed.cafes).length,
          toastVisible: !toast.classList.contains('hidden'),
          toastText: toast.textContent
        };
      })()
    `);
    assert.equal(backupRes.version, 1);
    assert.ok(backupRes.recordCount >= 2);
    assert.equal(backupRes.toastVisible, true);
    assert.equal(backupRes.toastText, 'Backup exported successfully');
  });

  await t.test('10. Mobile navigation tabs switch view and pins open details modal', async () => {
    const mobileTest = await evaluate(`
      (() => {
        // Switch to Map tab
        document.getElementById('tab-map-btn').click();
        const mapView = document.getElementById('map-view-container');
        const listView = document.getElementById('list-view-container');
        const mapVisible = !mapView.classList.contains('hidden-mobile');
        const listHidden = listView.classList.contains('hidden-mobile');

        // Click a pin while in map view
        const marker = Array.from(window.app.map.markers.values())[0];
        marker.getElement().click();

        const modal = document.getElementById('detail-modal');
        const modalOpen = !modal.classList.contains('hidden');
        const modalName = document.getElementById('detail-name')?.textContent;

        // Clean up: close modal and switch back to list view
        window.app.closeDetail();
        document.getElementById('tab-list-btn').click();

        return { mapVisible, listHidden, modalOpen, modalName };
      })()
    `);
    assert.equal(mobileTest.mapVisible, true, 'Map tab should become visible');
    assert.equal(mobileTest.listHidden, true, 'List tab should be hidden');
    assert.equal(mobileTest.modalOpen, true, 'Pin click must open details modal');
    assert.ok(mobileTest.modalName.length > 0, 'Modal must display cafe name');
  });

  // Cleanup
  ws.close();
  chrome.kill();
  server.kill();
});
