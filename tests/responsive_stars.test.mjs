import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

test('Rating stars do not overflow on cards or in detail modal on narrow mobile screens (360px)', async (t) => {
  const port = 8188;
  const cdpPort = 9488;

  // 1. Start HTTP server
  const server = spawn('python3', ['-m', 'http.server', String(port)], {
    cwd: '/home/sam/Development/personal/halle-cafes',
    stdio: 'ignore'
  });
  await new Promise(r => setTimeout(r, 600));

  // 2. Start Headless Chrome
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${cdpPort}`,
    '--window-size=360,740',
    `http://localhost:${port}/`
  ], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));

  try {
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const targets = await listRes.json();
    const page = targets.find(tg => tg.type === 'page');
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
    await cdp('DOM.enable');

    // Emulate small Android 360x740
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: 360,
      height: 740,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 500));

    // 1. Verify Card Stars & Actions Containment
    await t.test('Card rating stars do not overflow the cafe card boundary', async () => {
      const cardData = await evaluate(`
        (() => {
          const card = document.querySelector('.cafe-card');
          const actions = card.querySelector('.card-actions');
          const stars = actions.querySelector('.user-star-rating');
          const cardRect = card.getBoundingClientRect();
          const actionsRect = actions.getBoundingClientRect();
          const starsRect = stars ? stars.getBoundingClientRect() : null;

          return {
            cardWidth: Math.round(cardRect.width),
            cardRight: Math.round(cardRect.right),
            actionsWidth: Math.round(actionsRect.width),
            actionsScrollWidth: actions.scrollWidth,
            actionsClientWidth: actions.clientWidth,
            starsRight: starsRect ? Math.round(starsRect.right) : null,
            overflowPx: starsRect ? Math.max(0, Math.round(starsRect.right - cardRect.right)) : 0
          };
        })()
      `);

      assert.ok(cardData, 'Card data retrieved');
      assert.ok(cardData.starsRight !== null, 'Card has user-star-rating rendered');
      assert.ok(
        cardData.starsRight <= cardData.cardRight,
        `Rating stars right (${cardData.starsRight}px) must be <= card right (${cardData.cardRight}px), but overflowed by ${cardData.overflowPx}px`
      );
      assert.ok(
        cardData.actionsScrollWidth <= cardData.actionsClientWidth + 1,
        `Card actions scrollWidth (${cardData.actionsScrollWidth}px) should not exceed clientWidth (${cardData.actionsClientWidth}px)`
      );

      // Save screenshot
      const shot = await cdp('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('/tmp/verified_card_stars_360.png', Buffer.from(shot.data, 'base64'));
    });

    // 2. Verify Modal Stars Containment
    await t.test('Detail modal star picker does not overflow the modal card boundary', async () => {
      // Open detail modal for first cafe (7 Gramm)
      await evaluate(`window.app.openDetail(window.app.cafes[0])`);
      await new Promise(r => setTimeout(r, 500));

      const modalData = await evaluate(`
        (() => {
          const modal = document.getElementById('detail-modal');
          const card = modal.querySelector('.modal-card');
          const row = modal.querySelector('.tracker-rating-row');
          const stars = modal.querySelectorAll('.star-btn');
          const lastStar = stars[stars.length - 1];

          const cardRect = card.getBoundingClientRect();
          const rowRect = row.getBoundingClientRect();
          const lastStarRect = lastStar ? lastStar.getBoundingClientRect() : null;

          return {
            cardWidth: Math.round(cardRect.width),
            cardRight: Math.round(cardRect.right),
            rowWidth: Math.round(rowRect.width),
            rowScrollWidth: row.scrollWidth,
            rowClientWidth: row.clientWidth,
            lastStarRight: lastStarRect ? Math.round(lastStarRect.right) : null,
            overflowPx: lastStarRect ? Math.max(0, Math.round(lastStarRect.right - cardRect.right)) : 0
          };
        })()
      `);

      assert.ok(modalData, 'Modal data retrieved');
      assert.ok(modalData.lastStarRight !== null, 'Last star button rendered');
      assert.ok(
        modalData.lastStarRight <= modalData.cardRight,
        `Last star button right (${modalData.lastStarRight}px) must be <= modal card right (${modalData.cardRight}px), but overflowed by ${modalData.overflowPx}px`
      );
      assert.ok(
        modalData.rowScrollWidth <= modalData.rowClientWidth + 1,
        `Tracker rating row scrollWidth (${modalData.rowScrollWidth}px) should not exceed clientWidth (${modalData.rowClientWidth}px)`
      );

      // Save screenshot
      const shot = await cdp('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('/tmp/verified_modal_stars_360.png', Buffer.from(shot.data, 'base64'));
    });

    ws.close();
  } finally {
    chrome.kill();
    server.kill();
  }
});
