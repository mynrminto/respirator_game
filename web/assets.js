/* 生成画像のアセット。web/assets/manifest.json（tools/assets.py が作る）にある画像だけを使い、
 * 無いものはコードで描いた絵（art.js / characters.js）にそのまま落ちる。
 * つまり、画像が 1 枚届くごとにその部分だけが差し替わる。
 *
 *   VentAssets.ready.then(function () { ... })
 *   VentAssets.url('doctor_normal')   -> 'assets/doctor_normal.png'（成人版は 'assets-adult/…'）か null
 *   VentAssets.nine('ui_button')      -> {left,right,top,bottom} か null
 */
(function () {
  'use strict';
  var manifest = null;
  var base = 'assets/';
  /* 成人版は assets-adult/ を先に見る。キャラクター・背景・患者はそこに無ければ使わず（小児の絵を出さない）、
   * コード描画に落ちる。ボタンやアイコンなど版に関係ない部品だけ、小児版の assets/ を使い回す。 */
  var ADULT = window.VENT_EDITION === 'adult';
  var adultBase = 'assets-adult/';
  var adult = null;
  function shared(name) { return /^(ui_|icon_|fx_|hud_|logo$)/.test(name) && name !== 'icon_cases'; }   // icon_cases はくまの絵

  function accept(m) {
    manifest = (m && typeof m === 'object') ? m : {};
    try { document.documentElement.classList.toggle('assets', Object.keys(manifest).length > 0); } catch (e) { /* 無視 */ }
    return manifest;
  }
  function load(dir, embedded) {
    if (embedded) return Promise.resolve(embedded);
    if (!window.fetch || location.protocol === 'file:') return Promise.resolve({});
    return fetch(dir + 'manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (m) { return m; }, function () { return {}; });
  }

  /* build.js が 1 ファイル版に埋め込んだもの（VENT_MANIFEST / VENT_MANIFEST_ADULT）があればそれを使う */
  var ready = load(base, window.VENT_MANIFEST).then(function (m) {
    if (!ADULT) return accept(m);
    return load(adultBase, window.VENT_MANIFEST_ADULT).then(function (a) {
      adult = (a && typeof a === 'object') ? a : {};
      var merged = {};
      for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k) && shared(k)) merged[k] = m[k];
      for (var k2 in adult) if (Object.prototype.hasOwnProperty.call(adult, k2)) merged[k2] = adult[k2];
      return accept(merged);
    });
  });

  function has(name) { return !!(manifest && manifest[name]); }
  function dirOf(name) { return adult && adult[name] ? adultBase : base; }
  function url(name) { return has(name) ? dirOf(name) + name + '.png' : null; }
  function size(name) { return has(name) ? { w: manifest[name].w, h: manifest[name].h } : null; }
  function nine(name) {
    if (!has(name) || manifest[name].left == null) return null;
    var m = manifest[name];
    return { left: m.left, right: m.right, top: m.top, bottom: m.bottom };
  }

  window.VentAssets = { ready: ready, has: has, url: url, size: size, nine: nine };
})();
