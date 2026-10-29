/* ベッドサイドモニタ（心電図とパルスオキシメータの脈波）。呼吸器の画面と同じく左から右へ掃引する。
 * 波形は計算モデルの心拍・SpO₂・心拍出量から作る見た目だけのもので、実際の心電図の解析はしていない。
 *   var m = VentMonitor.create(canvas);
 *   m.tick(実時間の秒, { hr, spo2, perf, arrested, frozen });   // perf は心拍出量 ÷ 普段の値
 *   m.resize();
 */
(function (root) {
  'use strict';

  var SWEEP_SEC = 6;       // 端から端まで掃引する秒数（幅によらず同じ拍数が見える）
  var GAP = 14;            // 掃引の先で消える幅（px）
  var PLETH_DELAY = 0.22;  // QRS から指先に脈が届くまで（秒）

  function gauss(x, mu, w) { var z = (x - mu) / w; return Math.exp(-0.5 * z * z); }

  /* 1 拍ぶんの心電図。s は拍の始まり（P 波の手前）からの秒、rr は拍の間隔。 */
  function ecgBeat(s, rr) {
    var qt = 0.36 * Math.sqrt(Math.min(1.5, rr));
    return 0.12 * gauss(s, 0.06, 0.022)
      - 0.10 * gauss(s, 0.145, 0.008) + 1.0 * gauss(s, 0.16, 0.009) - 0.28 * gauss(s, 0.178, 0.009)
      + 0.28 * gauss(s, 0.16 + qt - 0.06, 0.045);
  }
  /* 1 拍ぶんの脈波。s は QRS からの秒。立ち上がり → ゆっくり下がり、途中に重複切痕。 */
  function plethBeat(s, rr) {
    s -= PLETH_DELAY;
    if (s < 0) return 0;
    var up = 0.11 * Math.min(1, Math.sqrt(rr));
    if (s < up) { var k = Math.sin(Math.PI / 2 * s / up); return k * k; }
    var d = s - up, tau = 0.26 * Math.min(1.4, rr);
    return Math.exp(-d / tau) * (1 - 0.18 * gauss(d, 0.16 * Math.min(1, rr), 0.03))
      + 0.12 * gauss(d, 0.22 * Math.min(1, rr), 0.05);
  }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1, x = 0, acc = 0;
    var beats = [];          // 拍の始まりの時刻（最新が後ろ）
    var t = 0, phase = 0, last = { ecg: null, pl: null };
    var col = { bg: '#04070A', grid: '#0E1A24', ecg: '#3CFF8F', pl: '#2EE6FF', dim: '#5B6B7A' };

    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      var v = function (n, fb) { var s = cs.getPropertyValue(n).trim(); return s || fb; };
      col.bg = v('--scope-bg', col.bg); col.grid = v('--scope-grid', col.grid);
    }

    function resize() {
      dpr = root.devicePixelRatio || 1;
      var r = canvas.getBoundingClientRect();
      W = Math.max(60, Math.round(r.width)); H = Math.max(40, Math.round(r.height));
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColors();
      ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
      x = 0; last.ecg = last.pl = null;
    }

    function value(kind, rr) {
      var sum = 0;
      for (var i = beats.length - 1; i >= 0 && i >= beats.length - 3; i--) {
        var s = t - beats[i];
        sum += kind === 'ecg' ? ecgBeat(s, rr) : plethBeat(s - 0.16, rr);
      }
      return sum;
    }

    function tick(dt, st) {
      if (!W) resize();
      if (st.frozen) return;
      var hr = st.arrested ? 0 : Math.max(0, st.hr || 0);
      var rr = hr > 1 ? 60 / hr : 3;
      acc += dt * W / SWEEP_SEC;
      var n = Math.floor(acc); acc -= n;
      if (n <= 0) return;
      var step = dt / Math.max(1, n + acc);
      var laneH = H / 2;
      /* 脈波の振れ幅：血流が落ちる・SpO₂ が極端に低いと小さくなり、止まれば平らになる。 */
      var amp = hr > 1 ? Math.max(0.08, Math.min(1, st.perf == null ? 1 : st.perf)) : 0;
      if (st.spo2 < 40) amp *= Math.max(0.2, st.spo2 / 40);
      for (var i = 0; i < n; i++) {
        t += step;
        if (hr > 1) {
          phase += step * hr / 60;
          if (phase >= 1) { phase -= 1; beats.push(t); if (beats.length > 6) beats.shift(); }
        }
        var ecg = hr > 1 ? value('ecg', rr) : 0;
        var pl = value('pl', rr) * amp;
        if (!(hr > 1)) ecg += 0.02 * Math.sin(t * 9);       // 平坦な線にもわずかな揺れ
        var ye = laneH * 0.62 - ecg * laneH * 0.48;
        var yp = laneH + laneH * 0.86 - Math.max(0, pl) * laneH * 0.66;
        /* 掃引の先を消す */
        ctx.fillStyle = col.bg;
        ctx.fillRect(x, 0, GAP, H);
        if (x + GAP > W) ctx.fillRect(0, 0, x + GAP - W, H);
        ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        if (last.ecg != null && x > 0) {
          ctx.strokeStyle = col.ecg; ctx.beginPath(); ctx.moveTo(x - 1, last.ecg); ctx.lineTo(x, ye); ctx.stroke();
          ctx.strokeStyle = col.pl; ctx.beginPath(); ctx.moveTo(x - 1, last.pl); ctx.lineTo(x, yp); ctx.stroke();
        }
        last.ecg = ye; last.pl = yp;
        x += 1;
        if (x >= W) { x = 0; last.ecg = last.pl = null; }
      }
      /* 段の見出し */
      ctx.font = '600 10px "Barlow Semi Condensed", sans-serif';
      ctx.textAlign = 'left';
      if (x > 60 || x < 4) {
        ctx.fillStyle = col.ecg; ctx.fillText('II', 6, 12);
        ctx.fillStyle = col.pl; ctx.fillText('Pleth', 6, laneH + 12);
      }
    }

    return { tick: tick, resize: resize };
  }

  root.VentMonitor = { create: create };
})(typeof window !== 'undefined' ? window : this);
