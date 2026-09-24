/* VentSim — BGM。昼の曲と夜の曲の 2 曲を、音のファイルを持たずにその場で合成する。
 *
 *   day   … 昼。ハ長調・88 BPM。エレピの和音（王道進行 Fmaj7→G→Em7→Am7）、やわらかいベース、
 *            うしろで小さなシェイカー。後半 8 小節でマリンバの旋律が入る。明るく、でも忙しくない。
 *   night … 夜。イ短調・66 BPM。ゆっくり立ち上がるパッド、低いベース、オルゴールの高い音がぽつぽつ。
 *            後半 8 小節でオルゴールの旋律。静かなナースステーションの夜。
 * どちらも 16 小節で継ぎ目なくループする（音の尾と残響は先頭へ回り込ませてある）。
 *
 * 流す場所と時刻（app.js が決め、VentBGM.want(track) で伝える）
 *   タイトル … 昼
 *   物語の幕 … 幕ごとの時刻（story.js の time）。午後 8 時の扉なら夜、夜明けなら昼。
 *   レッスン … 章の時刻（story.js の CHAPTER_TIME）。第1章＝初日の夜、第5章＝当直の夜、ほかは昼。
 *   症例で練習 … 端末の時計。6 時〜17 時台は昼、それ以外は夜。
 * 切り替えは 2.5 秒のクロスフェード。
 *
 * 聞き分けを損なわないために
 *   - 音量はアラームやパルス音よりずっと小さい（GAIN）。アラームが鳴っているあいだはさらに下げる（DUCK）。
 *   - 旋律はアラーム（ド・ラ・ファ＝349〜523 Hz）の音域を避け、昼は 1 オクターブ上、夜は 2 オクターブ上で鳴らす。
 *   - パルス音と同じ短い純音は使わない（エレピ・マリンバ・オルゴールは倍音と残響を持つ）。
 * 音全体（VentSound）を切ると BGM も止まる。BGM だけを切ることもできる（メニュー、ventsim.bgm.v1）。
 *
 * 合成はデータ（SONGS・INST）と render() だけで決まり、node でも同じ波形が作れる。
 * iPhone 版は web/tools/bgm-swift.js がこの楽譜と音色を App/BGMScore.swift に書き出し、
 * App/BGMPlayer.swift が同じ手順で合成する（web/test.js の 27 番が一致を確かめる）。
 */
(function (root) {
  'use strict';

  var KEY = 'ventsim.bgm.v1';
  var RATE = 24000;          // BGM は 24 kHz で作る（メモリを抑える。中身は 8 kHz より下）
  var GAIN = 0.15;           // 仕上がりのピークを 0.8 にそろえたうえで掛ける（ピーク 0.12）。パルス音 0.16・アラーム 0.26〜0.34 より小さい
  var DUCK = 0.35;           // アラームが鳴っているあいだの倍率
  var FADE = 2.5;            // 曲の切り替え（秒）

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---- 音色 ----
   * kind: fm（エレピ）/ mallet（マリンバ・オルゴール）/ bass / pad / noise
   * a = 立ち上がり、tau = 減衰の時定数、rel = 音の終わりからの消え方（すべて秒）、pan は -1（左）〜 1（右） */
  var INST = {
    ep:     { kind: 'fm', a: 0.006, tau: 1.3, rel: 0.35, gain: 0.16, pan: -0.18, index: 1.5, indexTau: 0.4, indexBase: 0.2 },
    mallet: { kind: 'mallet', a: 0.003, tau: 0.55, rel: 0.2, gain: 0.20, pan: 0.28, partial: 4, partialGain: 0.3, partialTau: 0.06 },
    box:    { kind: 'mallet', a: 0.002, tau: 1.4, rel: 0.4, gain: 0.13, pan: 0.3, partial: 3, partialGain: 0.25, partialTau: 0.25 },
    bass:   { kind: 'bass', a: 0.02, tau: 1.8, rel: 0.12, gain: 0.30, pan: 0 },
    pad:    { kind: 'pad', a: 1.4, tau: 0, rel: 1.6, gain: 0.06, pan: 0, detune: 7 },
    shaker: { kind: 'noise', a: 0.002, tau: 0.035, rel: 0.02, gain: 0.05, pan: 0.4 }
  };

  /* ---- 楽譜 ----
   * 和音は小節ごと [ベースの音, [和音の音…]]（MIDI 番号）。旋律は [拍, 音, 長さ（拍）]、拍は曲の頭から数える。 */
  var DAY_CHORDS = [
    [41, [57, 60, 64, 67]],   // Fmaj7(9)
    [43, [59, 62, 64, 67]],   // G6
    [40, [55, 59, 62, 64]],   // Em7
    [45, [57, 60, 64, 67]],   // Am7
    [50, [57, 60, 62, 65]],   // Dm7
    [43, [59, 62, 65, 67]],   // G7
    [48, [55, 59, 60, 64]],   // Cmaj7
    [45, [55, 57, 60, 64]]    // Am7
  ];
  var DAY_MELODY = [   // 後半 8 小節（33 拍目から）。C ペンタトニック。アラームの最高音（ド = C5）には降りない
    [0, 81, 1.5], [1.5, 79, 0.5], [2, 76, 1], [3, 76, 1],
    [4, 74, 1.5], [5.5, 76, 0.5], [6, 79, 2],
    [8, 79, 1], [9, 76, 1], [10, 74, 1], [11, 76, 1],
    [12, 76, 3], [15.5, 79, 0.5],
    [16, 81, 1], [17, 84, 1], [18, 81, 0.5], [18.5, 79, 0.5], [19, 81, 1],
    [20, 79, 2], [22, 74, 1], [23, 76, 1],
    [24, 76, 1.5], [25.5, 74, 0.5], [26, 76, 1], [27, 74, 1],
    [28, 76, 3]
  ];

  var NIGHT_CHORDS = [
    [45, [57, 60, 64, 71]],   // Am9
    [45, [57, 60, 64, 71]],
    [41, [53, 57, 64, 71]],   // Fmaj7(#11)
    [41, [53, 57, 64, 69]],
    [38, [53, 57, 60, 64]],   // Dm9
    [38, [53, 57, 60, 64]],
    [40, [52, 57, 59, 64]],   // Esus4
    [40, [52, 56, 59, 64]]    // E
  ];
  var NIGHT_SPARSE = [ // 前半：ぽつぽつと 1 音ずつ（オルゴール、2 オクターブ上）
    [1, 88, 2], [9, 84, 2], [17, 86, 2], [26, 83, 2]
  ];
  var NIGHT_MELODY = [ // 後半 8 小節（33 拍目から）
    [0, 88, 1], [1, 84, 1], [2, 83, 2],
    [4, 81, 3], [7.5, 79, 0.5],
    [8, 81, 1], [9, 84, 1], [10, 88, 1.5], [11.5, 86, 0.5],
    [12, 84, 4],
    [16, 86, 1], [17, 84, 1], [18, 81, 2],
    [20, 84, 1], [21, 81, 1], [22, 77, 2],
    [24, 83, 2], [26, 81, 1], [27, 83, 1],
    [28, 80, 3]
  ];

  var SONGS = {
    day: { bpm: 88, bars: 16, beats: 4, reverb: { feedback: 0.76, damp: 0.35, wet: 0.22 } },
    night: { bpm: 66, bars: 16, beats: 4, reverb: { feedback: 0.84, damp: 0.45, wet: 0.34 } }
  };

  /* 楽譜を音の並びにする。返すのは [{ i: 音色, t: 秒, d: 秒, f: Hz, v: 強さ }]（t の順）。 */
  function score(name) {
    var s = SONGS[name];
    if (!s) return [];
    var b = 60 / s.bpm, out = [];
    function add(inst, beat, midi, len, vel) {
      out.push({ i: inst, t: +(beat * b).toFixed(6), d: +(len * b).toFixed(6), f: +mtof(midi).toFixed(4), v: vel });
    }
    var bar, k, ch, beat0;
    if (name === 'day') {
      for (bar = 0; bar < s.bars; bar++) {
        ch = DAY_CHORDS[bar % 8]; beat0 = bar * 4;
        // エレピ：1 拍目と 2 拍目の裏（シンコペーション）。7 小節目の裏は休む
        for (k = 0; k < 4; k++) add('ep', beat0, ch[1][k], 1.5, 0.8);
        if (bar % 8 !== 7) for (k = 0; k < 4; k++) add('ep', beat0 + 2.5, ch[1][k], 1.5, 0.5);
        // ベース：1 拍目に根音、3 拍目の裏に 5 度上
        add('bass', beat0, ch[0], 2.2, 0.9);
        add('bass', beat0 + 2.5, ch[0] + 7, 1.2, 0.6);
        // シェイカー：8 分音符、裏を強く
        for (k = 0; k < 8; k++) add('shaker', beat0 + k * 0.5, 96, 0.25, k % 2 ? 1 : 0.45);
        // 前半はマリンバで和音をなぞる（2 オクターブ上に 1 小節 3 音）
        if (bar < 8) {
          add('mallet', beat0 + 1, ch[1][3] + 12, 0.5, 0.45);
          add('mallet', beat0 + 1.5, ch[1][2] + 12, 0.5, 0.35);
          add('mallet', beat0 + 3.5, ch[1][1] + 12, 0.5, 0.35);
        }
      }
      DAY_MELODY.forEach(function (n) { add('mallet', 32 + n[0], n[1], n[2], 0.9); });
    } else {
      for (bar = 0; bar < s.bars; bar++) {
        ch = NIGHT_CHORDS[bar % 8]; beat0 = bar * 4;
        // パッドは和音が変わる小節から、同じ和音のあいだ伸ばす
        if (bar === 0 || !same(NIGHT_CHORDS[(bar + 7) % 8], ch)) {
          var len = 4;
          while (bar + len / 4 < s.bars && same(NIGHT_CHORDS[(bar + len / 4) % 8], ch)) len += 4;
          for (k = 0; k < 4; k++) add('pad', beat0, ch[1][k], len, 0.8);
        }
        // 低いベースを小節の頭に長く
        add('bass', beat0, ch[0], 3.6, 0.7);
        // エレピで和音を 4 分音符でゆっくりなぞる（小さく）
        [0, 2, 1, 3].forEach(function (idx, q) { add('ep', beat0 + q, ch[1][idx], 1.2, 0.32); });
      }
      NIGHT_SPARSE.forEach(function (n) { add('box', n[0], n[1], n[2], 0.8); });
      NIGHT_MELODY.forEach(function (n) { add('box', 32 + n[0], n[1], n[2], 0.9); });
    }
    out.sort(function (a, b2) { return a.t - b2.t; });
    return out;
  }

  function same(a, b) { return a[0] === b[0] && a[1].join() === b[1].join(); }

  function length(name) { var s = SONGS[name]; return s ? s.bars * s.beats * 60 / s.bpm : 0; }

  /* ---- 合成 ----
   * 波形は表引きで作る（Math.sin を毎サンプル呼ばない）。表の中身は iPhone 版と同じ式。 */
  var TABLE = 4096;
  var SINE = new Float32Array(TABLE + 1), SOFTSAW = new Float32Array(TABLE + 1);
  (function () {
    var i, h, x, peak = 0;
    for (i = 0; i <= TABLE; i++) {
      x = i / TABLE;
      SINE[i] = Math.sin(2 * Math.PI * x);
      var s = 0;
      for (h = 1; h <= 8; h++) s += Math.sin(2 * Math.PI * h * x) / Math.pow(h, 1.3);
      SOFTSAW[i] = s;
      if (Math.abs(s) > peak) peak = Math.abs(s);
    }
    for (i = 0; i <= TABLE; i++) SOFTSAW[i] /= peak;
  })();
  /* 表を引く。ph は 0〜1 の位相（周期の何割か）。 */
  function look(tab, ph) { return tab[((ph - Math.floor(ph)) * TABLE) | 0]; }

  /* 決まった種の雑音（毎回同じ波形になる）。 */
  function noiseGen(seed) {
    var x = seed >>> 0 || 1;
    return function () { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2147483648 - 1; };
  }

  /* 1 音を L・R に足し込む。ループの長さを超えた分は頭へ回り込む。
   * 音量の形：a 秒で直線に立ち上がり、そこから時定数 tau で減衰（tau = 0 なら平ら）、
   * 長さ d を過ぎたら rel 秒で直線に消える。減衰は毎サンプル同じ倍率を掛けて作る（exp を毎回呼ばない）。 */
  function voiceInto(L, R, n, rate) {
    var p = INST[n.i], N = L.length;
    var start = Math.round(n.t * rate), aN = Math.max(1, Math.round(p.a * rate));
    var dN = Math.round(n.d * rate), relN = Math.max(1, Math.round(p.rel * rate)), count = dN + relN;
    var kb = p.tau > 0 ? Math.exp(-1 / (p.tau * rate)) : 1;
    var amp = p.gain * n.v, gl = Math.sqrt((1 - p.pan) / 2) * amp, gr = Math.sqrt((1 + p.pan) / 2) * amp;
    var inc = n.f / rate, ph = 0, ph2 = 0, ph3 = 0, body = 1, i, j, e, s, sl, sr;
    var up = 1, dn = 1, kx = 1, x = 1, prev = 0, rnd = null;
    if (p.kind === 'pad') { up = Math.pow(2, p.detune / 1200); dn = 1 / up; gl = gr = amp; }
    if (p.kind === 'fm') { kx = Math.exp(-1 / (p.indexTau * rate)); x = p.index; }
    if (p.kind === 'mallet') { kx = Math.exp(-1 / (p.partialTau * rate)); x = p.partialGain; }
    if (p.kind === 'noise') rnd = noiseGen(start + 1);
    // 音色ごとに別のループにする（ループの中で分岐しないほうが速い）
    function envAt(i) {
      var v = i < aN ? i / aN : body;
      if (i >= aN) body *= kb;
      return i >= dN ? v * (1 - (i - dN) / relN) : v;
    }
    var TWO_PI = 2 * Math.PI, ib = p.indexBase, pg = p.partial, sw = 1;
    for (i = 0; i < count; i++) {
      e = envAt(i);
      j = start + i; if (j >= N) j -= N * Math.floor(j / N);
      switch (p.kind) {
        case 'fm':
          s = look(SINE, ph + (x + ib) * SINE[(ph * TABLE) | 0] / TWO_PI);
          x *= kx; ph += inc; if (ph >= 1) ph -= 1;
          break;
        case 'mallet':
          s = SINE[(ph * TABLE) | 0] + x * SINE[(ph2 * TABLE) | 0];
          x *= kx; ph += inc; if (ph >= 1) ph -= 1;
          ph2 += inc * pg; if (ph2 >= 1) ph2 -= Math.floor(ph2);
          break;
        case 'bass':
          s = SINE[(ph * TABLE) | 0] + 0.35 * SINE[(ph2 * TABLE) | 0] + 0.12 * SINE[(ph3 * TABLE) | 0];
          ph += inc; if (ph >= 1) ph -= 1;
          ph2 += 2 * inc; if (ph2 >= 1) ph2 -= 1;
          ph3 += 3 * inc; if (ph3 >= 1) ph3 -= 1;
          break;
        case 'pad':
          // 2 本を少しずらして左右に広げる
          sl = SOFTSAW[(ph * TABLE) | 0]; sr = SOFTSAW[(ph2 * TABLE) | 0];
          ph += inc * up; if (ph >= 1) ph -= 1;
          ph2 += inc * dn; if (ph2 >= 1) ph2 -= 1;
          L[j] += (sl * 0.8 + sr * 0.2) * e * gl; R[j] += (sr * 0.8 + sl * 0.2) * e * gr;
          continue;
        default:
          sw = rnd(); s = sw - prev; prev = sw;   // 差分で低い成分を落とす
      }
      L[j] += s * e * gl; R[j] += s * e * gr;
    }
  }

  /* 簡単な残響（くし形 4 本＋全域通過 2 本）。ループの継ぎ目が切れないよう、2 周回して 2 周目を使う。 */
  var COMBS = [0.0297, 0.0371, 0.0411, 0.0437], ALLPASS = [0.005, 0.0017], SPREAD = 0.0011;
  function Reverb(rate, rv, spread) {
    var k;
    this.cb = []; this.cp = [0, 0, 0, 0]; this.lp = [0, 0, 0, 0]; this.ab = []; this.ap = [0, 0];
    for (k = 0; k < 4; k++) this.cb.push(new Float32Array(Math.round((COMBS[k] + spread) * rate)));
    for (k = 0; k < 2; k++) this.ab.push(new Float32Array(Math.round(ALLPASS[k] * rate)));
    this.fb = rv.feedback; this.damp = rv.damp;
  }
  /* x[from..to) を通す。out があれば書き込む（1 周目は空回しで残響を満たすだけ）。 */
  Reverb.prototype.run = function (x, out, from, to) {
    var cb = this.cb, cp = this.cp, lp = this.lp, ab = this.ab, ap = this.ap, fb = this.fb, damp = this.damp;
    for (var i = from; i < to; i++) {
      var inp = x[i] * 0.25, y = 0, o, buf, k;
      for (k = 0; k < 4; k++) {
        buf = cb[k]; o = buf[cp[k]];
        lp[k] = o * (1 - damp) + lp[k] * damp;
        buf[cp[k]] = inp + lp[k] * fb;
        if (++cp[k] >= buf.length) cp[k] = 0;
        y += o;
      }
      for (k = 0; k < 2; k++) {
        buf = ab[k]; o = buf[ap[k]];
        buf[ap[k]] = y + o * 0.5;
        if (++ap[k] >= buf.length) ap[k] = 0;
        y = o - y * 0.5;
      }
      if (out) out[i] = y;
    }
  };

  /* 1 曲分の波形を少しずつ作る。step(ms) をくり返し呼び、true が返ったら result に { L, R, rate }（ピーク 0.8）。
   * ブラウザでは 1 回 20 ms ほどずつ進めて、画面を止めない。 */
  function Renderer(name, rate) {
    this.rate = rate = rate || RATE;
    this.song = SONGS[name];
    this.notes = score(name);
    this.N = Math.round(length(name) * rate);
    this.L = new Float32Array(this.N); this.R = new Float32Array(this.N);
    this.wl = new Float32Array(this.N); this.wr = new Float32Array(this.N);
    this.rl = new Reverb(rate, this.song.reverb, 0);
    this.rr = new Reverb(rate, this.song.reverb, SPREAD);
    this.stage = 0; this.k = 0; this.i = 0; this.result = null;
  }
  var CHUNK = 12000;
  Renderer.prototype.step = function (budgetMs) {
    var clock = root.performance && root.performance.now ? function () { return root.performance.now(); } : Date.now;
    var t0 = clock(), N = this.N;
    while (!this.result && (budgetMs == null || clock() - t0 < budgetMs)) {
      if (this.stage === 0) {
        if (this.k < this.notes.length) voiceInto(this.L, this.R, this.notes[this.k++], this.rate);
        else this.stage = 1;
      } else if (this.stage <= 2) {
        // 2 周回す。1 周目で残響を満たし、2 周目の出力を使う（ループの頭に前の周の尾が乗る）
        var to = Math.min(N, this.i + CHUNK), keep = this.stage === 2;
        this.rl.run(this.L, keep ? this.wl : null, this.i, to);
        this.rr.run(this.R, keep ? this.wr : null, this.i, to);
        this.i = to;
        if (to >= N) { this.stage++; this.i = 0; }
      } else {
        var L = this.L, R = this.R, wl = this.wl, wr = this.wr, wet = this.song.reverb.wet, peak = 1e-9, i;
        for (i = 0; i < N; i++) {
          L[i] = L[i] * (1 - wet) + wl[i] * wet * 3;
          R[i] = R[i] * (1 - wet) + wr[i] * wet * 3;
          var m = Math.max(Math.abs(L[i]), Math.abs(R[i]));
          if (m > peak) peak = m;
        }
        var g = 0.8 / peak;
        for (i = 0; i < N; i++) { L[i] *= g; R[i] *= g; }
        this.result = { L: L, R: R, rate: this.rate };
        this.wl = this.wr = null;
      }
    }
    return !!this.result;
  };

  /* 1 曲分の波形を一度に作る（node のテスト用）。 */
  function render(name, rate) {
    if (!SONGS[name]) return null;
    var r = new Renderer(name, rate);
    r.step(null);
    return r.result;
  }

  /* ---- どの曲を流すか ---- */
  function clockTrack(date) {
    var h = (date || new Date()).getHours();
    return h >= 6 && h < 18 ? 'day' : 'night';
  }

  /* ---- 再生（ブラウザだけ） ---- */
  var on = true;
  try { on = root.localStorage ? root.localStorage.getItem(KEY) !== 'off' : true; } catch (e) { on = true; }

  var wanted = null, playing = null, ducked = false, hidden = false;
  var cache = {}, bus = null, nodes = {};   // nodes[track] = { src, gain }

  function soundOn() { return !root.VentSound || root.VentSound.enabled(); }
  function level() { return GAIN * (ducked ? DUCK : 1); }

  function context() {
    var S = root.VentSound;
    var io = S && S.audio ? S.audio() : null;
    if (!io) return null;
    if (!bus) { bus = io.ctx.createGain(); bus.gain.value = level(); bus.connect(io.master); }
    return io.ctx;
  }

  /* 曲を少しずつ作る。できたら AudioBuffer にして cache に入れ、apply し直す。 */
  var jobs = {};
  function prepare(ctx, track) {
    if (cache[track] || jobs[track]) return;
    var job = jobs[track] = new Renderer(track, RATE);
    (function tick() {
      if (!job.step(18)) { setTimeout(tick, 16); return; }
      var w = job.result, b = ctx.createBuffer(2, w.L.length, w.rate);
      b.getChannelData(0).set(w.L); b.getChannelData(1).set(w.R);
      cache[track] = b;
      delete jobs[track];
      apply();
    })();
  }

  function fadeOut(track, ctx) {
    var n = nodes[track];
    if (!n) return;
    delete nodes[track];
    var t = ctx.currentTime;
    n.gain.gain.cancelScheduledValues(t);
    n.gain.gain.setValueAtTime(n.gain.gain.value, t);
    n.gain.gain.linearRampToValueAtTime(0, t + FADE);
    try { n.src.stop(t + FADE + 0.05); } catch (e) { /* 止まっている */ }
  }

  function apply() {
    var target = on && soundOn() && !hidden ? wanted : null;
    if (target === playing) return;
    var ctx = context();
    if (!ctx) return;
    if (ctx.state !== 'running') return;       // 最初に触るまでは鳴らせない。触ったら次の apply で始まる
    if (target && !cache[target]) { prepare(ctx, target); return; }   // できあがったら apply し直す
    if (playing) fadeOut(playing, ctx);
    playing = target;
    if (!target) return;
    var src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
    src.buffer = cache[target]; src.loop = true;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + FADE);
    src.connect(g); g.connect(bus);
    src.start(t);
    nodes[target] = { src: src, gain: g };
  }

  /** 流したい曲を伝える（'day' / 'night' / null）。毎フレーム呼んでよい。 */
  function want(track) {
    wanted = SONGS[track] ? track : null;
    apply();
  }

  /** アラームが鳴っているあいだは下げる。 */
  function duck(v) {
    v = !!v;
    if (v === ducked) return;
    ducked = v;
    if (bus) {
      var t = bus.context.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(level(), t + (v ? 0.3 : 1.5));
    }
  }

  function setEnabled(v) {
    on = !!v;
    try { if (root.localStorage) root.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* 記録できなくても動く */ }
    apply();
  }

  if (root.document && root.addEventListener) {
    root.document.addEventListener('visibilitychange', function () { hidden = !!root.document.hidden; apply(); });
    // 最初に触ったとき（音が解禁されたあと）に始める
    root.addEventListener('pointerup', function () { setTimeout(apply, 0); }, { capture: true, passive: true });
  }

  var api = {
    want: want, duck: duck, enabled: function () { return on; }, setEnabled: setEnabled,
    playing: function () { return playing; }, wanted: function () { return wanted; },
    refresh: apply, clockTrack: clockTrack,
    score: score, render: render, Renderer: Renderer, length: length, mtof: mtof,
    SONGS: SONGS, INST: INST, RATE: RATE, GAIN: GAIN, DUCK: DUCK, FADE: FADE
  };
  root.VentBGM = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
