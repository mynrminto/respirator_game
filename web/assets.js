/* 生成画像のアセット。web/assets/manifest.json（tools/assets.py が作る）にある画像だけを使い、
 * 無いものはコードで描いた絵（art.js / characters.js）にそのまま落ちる。
 * つまり、画像が 1 枚届くごとにその部分だけが差し替わる。
 *
 *   VentAssets.ready.then(function () { ... })
 *   VentAssets.url('doctor_normal')   -> 'assets/doctor_normal.png' か null
 *   VentAssets.nine('ui_button')      -> {left,right,top,bottom} か null
 */
(function () {
  'use strict';
  var manifest = null;
  var base = 'assets/';

  function accept(m) {
    manifest = (m && typeof m === 'object') ? m : {};
    try { document.documentElement.classList.toggle('assets', Object.keys(manifest).length > 0); } catch (e) { /* 無視 */ }
    return manifest;
  }

  var ready;
  if (window.VENT_MANIFEST) {
    /* build.js が 1 ファイル版に埋め込んだもの */
    ready = Promise.resolve(accept(window.VENT_MANIFEST));
  } else if (window.fetch && location.protocol !== 'file:') {
    ready = fetch(base + 'manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(accept, function () { return accept({}); });
  } else {
    ready = Promise.resolve(accept({}));
  }

  function has(name) { return !!(manifest && manifest[name]); }
  function url(name) { return has(name) ? base + name + '.png' : null; }
  function size(name) { return has(name) ? { w: manifest[name].w, h: manifest[name].h } : null; }
  function nine(name) {
    if (!has(name) || manifest[name].left == null) return null;
    var m = manifest[name];
    return { left: m.left, right: m.right, top: m.top, bottom: m.bottom };
  }

  window.VentAssets = { ready: ready, has: has, url: url, size: size, nine: nine };
})();
