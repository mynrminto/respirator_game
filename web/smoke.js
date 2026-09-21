const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  for (const vp of [{w:1180,h:760,n:'wide'},{w:390,h:844,n:'phone'}]) {
    const p = await b.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    p.on('pageerror', e => errs.push(vp.n+': '+e.message));
    p.on('console', m => { if (m.type()==='error') errs.push(vp.n+' console: '+m.text()); });
    await p.goto('file:///home/claude/ventsim/preview.html');
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-0-disclaimer.png` });
    await p.getByRole('button', { name: '同意して始める' }).click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-1-cases.png` });
    await p.locator('.case').nth(1).click();   // ARDS
    await p.waitForTimeout(400);
    await p.getByRole('button', { name: '推奨初期設定で開始' }).click();
    await p.waitForTimeout(6000);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-2-running.png` });
    // 設定キーを選んでダイヤル操作
    await p.locator('.pkey').first().click();
    await p.waitForTimeout(200);
    await p.locator('#knob').press('ArrowUp');
    await p.locator('#knob').press('ArrowUp');
    await p.waitForTimeout(200);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-3-pending.png` });
    await p.locator('#btnOk').click();
    await p.waitForTimeout(400);
    const vt = await p.locator('.pkey').first().innerText();
    console.log(vp.n, 'Vt key after commit:', vt.replace(/\n/g,' '));
    // 吸気ポーズ
    await p.locator('#kInsp').click();
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-4-hold.png` });
    // ループ / トレンド
    await p.getByRole('button', { name: 'ループ' }).click();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-5-loops.png` });
    await p.getByRole('button', { name: 'トレンド' }).click();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-6-trend.png` });
    await p.getByRole('button', { name: '波形', exact: true }).click();
    // モード切替
    await p.getByRole('button', { name: 'PC-AC' }).click();
    await p.waitForTimeout(4000);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-7-pcac.png` });
    // ページがスクロールしないこと
    const sc = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
    console.log(vp.n, 'scroll', JSON.stringify(sc));
    // 血液ガス（早送り）
    await p.locator('#kSpd').click();await p.locator('#kSpd').click();
    await p.locator('#kAbg').click();
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `/tmp/claude-0/${vp.n}-8-abg.png` });
    const abgOpen = await p.locator('.mbox h3').count();
    console.log(vp.n, 'ABG dialog count:', abgOpen);
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'ERRORS:\n'+errs.join('\n') : 'no page errors');
})();
