/* ブラウザでの通し確認。node web/build.js を先に走らせてから
 *   node --prefix / web/smoke.js        （playwright が入っている場所から）
 * スクリーンショットは /tmp/claude-0/ に出る。
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const FILE = 'file://' + path.join(__dirname, 'preview.html');
const SHOT = process.env.SHOT_DIR || '/tmp/claude-0';
const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

(async () => {
  const b = await chromium.launch({ executablePath: EXEC, args: ['--allow-file-access-from-files'] });
  const errs = [];
  for (const vp of [{ w: 1180, h: 760, n: 'wide' }, { w: 390, h: 844, n: 'phone' }]) {
    const p = await b.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    p.on('pageerror', e => errs.push(vp.n + ': ' + e.message));
    // Google Fonts はサンドボックスの proxy で証明書検証に失敗することがある。アプリの問題ではない。
    p.on('console', m => {
      if (m.type() !== 'error') return;
      if (/ERR_CERT|net::ERR_/.test(m.text())) return;
      errs.push(vp.n + ' console: ' + m.text());
    });
    await p.goto(FILE);
    await p.waitForTimeout(1800);            // タイトルの絵とテクスチャができるのを待つ
    // タイトル画面 → コースを選ぶ → 免責に同意
    console.log(vp.n, 'タイトルは WebGL:', await p.evaluate(() =>
      document.getElementById('title').classList.contains('gl')));
    await p.screenshot({ path: `${SHOT}/${vp.n}-0-title.png` });
    // ゲーム画面のボタンは canvas の中にあるので、位置を教えてもらって実際に押す。
    const hit = await p.evaluate(() => window.VentTitle && window.VentTitle.rect('course'));
    if (hit) await p.mouse.click(hit.cx, hit.cy);
    else await p.getByRole('button', { name: /コースを選ぶ/ }).click();
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${SHOT}/${vp.n}-1-disclaimer.png` });
    await p.getByRole('button', { name: '同意して始める' }).click();
    await p.waitForTimeout(400);
    console.log(vp.n, 'タイトルが消えた:', await p.locator('#title').isHidden());
    await p.screenshot({ path: `${SHOT}/${vp.n}-2-course.png` });

    // 1-2「PIP と Pplat」を開く。解説 → 操作 → 課題の進行を確かめる。
    await p.getByRole('button', { name: /PIP と Pplat/ }).click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${SHOT}/${vp.n}-3-brief.png` });
    await p.getByRole('button', { name: '操作に進む' }).click();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${SHOT}/${vp.n}-4-lesson.png` });

    const step = async () => (await p.locator('#cChap').innerText()).trim();
    // 解説が出ているあいだは「次へ」を押して先に進める
    const clearFeedback = async (ms) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        const n = p.locator('#cChoices button', { hasText: '次へ' });
        if (await n.count()) { await n.first().click(); await p.waitForTimeout(150); }
        else await p.waitForTimeout(150);
      }
    };
    console.log(vp.n, '課題1:', await step());

    // 課題1: 吸気ポーズ → 課題2: 測定待ち（どちらも解説を挟む）
    await p.locator('#kInsp').click();
    await p.waitForTimeout(300);
    let say = await p.locator('#cSay').innerText();
    console.log(vp.n, '吸気ポーズ後の解説:', say.slice(0, 32));
    await p.screenshot({ path: `${SHOT}/${vp.n}-5-measured.png` });
    await clearFeedback(6000);
    console.log(vp.n, 'Pplat 測定後:', await step());

    // 課題3: クイズ。誤答 → 正解。
    await p.screenshot({ path: `${SHOT}/${vp.n}-6-quiz.png` });
    const choices = p.locator('#cChoices button');
    console.log(vp.n, 'クイズの選択肢数:', await choices.count());
    await choices.nth(0).click();            // 正解は 2 番目なので誤答になる
    await p.waitForTimeout(300);
    const hint = await p.locator('#cHint').innerText();
    console.log(vp.n, '誤答のフィードバック:', hint.trim().slice(0, 24) || '(なし)');
    await p.screenshot({ path: `${SHOT}/${vp.n}-7-wrong.png` });
    await p.locator('#cChoices button').nth(1).click();
    await p.waitForTimeout(300);
    say = await p.locator('#cSay').innerText();
    console.log(vp.n, '正解の解説:', say.slice(0, 28));
    await p.screenshot({ path: `${SHOT}/${vp.n}-8-answered.png` });
    await clearFeedback(800);
    console.log(vp.n, 'クイズ通過後:', await step());
    // 帯の操作ボタンが画面内に収まっているか
    const fit = await p.evaluate(() => {
      const r = document.getElementById('cQuit').getBoundingClientRect();
      return { right: Math.round(r.right), w: window.innerWidth };
    });
    console.log(vp.n, '終了ボタンの右端', fit.right, '/ 画面幅', fit.w,
      fit.right <= fit.w ? 'OK' : 'はみ出し');

    // 帯をたたんでも機器が壊れないこと
    await p.locator('#cToggle').click();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${SHOT}/${vp.n}-9-collapsed.png` });
    await p.locator('#cToggle').click();
    await p.waitForTimeout(300);

    // ページがスクロールしないこと
    const sc = await p.evaluate(() => ({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight
    }));
    console.log(vp.n, 'scroll', JSON.stringify(sc),
      sc.sw <= sc.cw && sc.sh <= sc.ch ? 'OK' : 'はみ出し');

    // 学習を終了してフリー操作に戻る
    await p.locator('#cQuit').click();
    await p.waitForTimeout(300);
    console.log(vp.n, '終了後に帯が消えた:', await p.locator('#coach').isHidden());

    /* ---------- フリー操作（従来どおり動くこと） ---------- */
    await p.locator('#kMenu').click();
    await p.waitForTimeout(250);
    await p.getByRole('button', { name: /症例を選ぶ/ }).click();
    await p.waitForTimeout(250);
    await p.locator('.case').nth(1).click();          // ARDS
    await p.waitForTimeout(350);
    await p.getByRole('button', { name: '推奨初期設定で開始' }).click();
    await p.waitForTimeout(5000);
    await p.screenshot({ path: `${SHOT}/${vp.n}-10-free.png` });
    await p.locator('.pkey').first().click();
    await p.locator('#knob').press('ArrowUp');
    await p.locator('#btnOk').click();
    await p.waitForTimeout(300);
    console.log(vp.n, 'Vt キー:', (await p.locator('.pkey').first().innerText()).replace(/\n/g, ' '));
    await p.getByRole('button', { name: 'ループ' }).click();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${SHOT}/${vp.n}-11-loops.png` });
    await p.getByRole('button', { name: '波形', exact: true }).click();
    await p.locator('#kSpd').click(); await p.locator('#kSpd').click();
    await p.locator('#kAbg').click();
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `${SHOT}/${vp.n}-12-abg.png` });
    console.log(vp.n, '血液ガスの画面:', await p.locator('.mbox h3').count());
    await p.close();
  }
  await b.close();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : '\nページエラーなし');
  process.exit(errs.length ? 1 : 0);
})();
