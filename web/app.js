/* VentSim — 実機筐体 UI。engine.js / scenarios.js はそのまま利用する。
 * 画面は縦スクロールしない。波形は左から右へ連続スイープし、計測値は常時更新される。 */
(function () {
  'use strict';

  var E = window.VentEngine, SC = window.VentScenarios, LS = window.VentLessons, CH = window.VentChars;
  var AR = window.VentArt, AS = window.VentAssets, LU = window.VentLung3D;
  var $ = function (id) { return document.getElementById(id); };
  var el = function (t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

  /* ===================== テーマ =====================
   * 見た目は CSS のカスタムプロパティだけで決まる。キャンバス（波形・ループ・
   * トレンド・ダイヤル）も同じ値を読むので、テーマを変えると一斉に変わる。 */
  var THEME_KEY = 'ventsim.theme.v1';
  var PAL = {};

  function readPal() {
    var cs = getComputedStyle(document.documentElement);
    function v(name, fb) { var s = cs.getPropertyValue(name).trim(); return s || fb; }
    PAL = {
      bg: v('--scope-bg', '#04070A'),
      grid: v('--scope-grid', '#0E1A24'),
      grid2: v('--scope-grid2', '#101C26'),
      zero: v('--scope-zero', '#1B2A36'),
      peep: v('--scope-peep', '#2E4A2E'),
      axis: v('--scope-axis', '#4A5765'),
      label: v('--scope-label', '#9FB0C2'),
      faint: v('--scope-faint', '#39485A'),
      cursor: v('--scope-cursor', '200,230,255'),
      glow: parseFloat(v('--scope-glow', '0')) || 0,
      paw: v('--paw', '#F5B429'), paw2: v('--paw-dim', '#B98514'),
      flow: v('--flow', '#2FD8A8'), vol: v('--vol', '#8FA8FF'), spo2: v('--spo2', '#59D8EA'),
      good: v('--good', '#3ECB80'), warn: v('--warn', '#FFB03A'), crit: v('--crit', '#FF4B57'),
      accent: v('--accent', '#2FD8A8'),
      knobTrack: v('--knob-track', '#1B2530'), knobTick: v('--knob-tick', '#2A3542'),
      knobPtr: v('--knob-ptr', '#C8D6E4')
    };
    LANES[0].css = PAL.paw; LANES[1].css = PAL.flow; LANES[2].css = PAL.vol;
  }

  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'pop'; }

  function applyTheme(name, redraw) {
    document.documentElement.setAttribute('data-theme', name === 'device' ? 'device' : 'pop');
    var b = $('btnTheme');
    if (b) b.textContent = name === 'device' ? '実機' : 'ポップ';
    try { window.localStorage.setItem(THEME_KEY, currentTheme()); } catch (err) { /* 記録できなくても動く */ }
    readPal();
    if (redraw) { fitAll(); paintDial(); paintStage(); if (LUNG.view) LUNG.view.themeChanged(); }
  }

  function initTheme() {
    var saved = null;
    try { saved = window.localStorage.getItem(THEME_KEY); } catch (err) { saved = null; }
    applyTheme(saved === 'device' ? 'device' : 'pop', false);
    $('btnTheme').onclick = function () {
      applyTheme(currentTheme() === 'pop' ? 'device' : 'pop', true);
    };
  }

  /* ===================== 達成の演出 ===================== */
  var CONFETTI = ['#FF5E8A', '#FFB020', '#12C48B', '#5B7CFA', '#FF8A3D', '#8B6BFF'];

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) { return false; }
  }

  function confetti(n) {
    if (reducedMotion()) return;
    var host = $('fx');
    if (!host) return;
    var w = window.innerWidth, cx = w / 2, cy = window.innerHeight * 0.34;
    for (var i = 0; i < n; i++) {
      var p = el('i');
      var ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      var dist = 90 + Math.random() * 190;
      p.style.left = Math.round(cx + (Math.random() - 0.5) * 120) + 'px';
      p.style.top = Math.round(cy) + 'px';
      p.style.background = CONFETTI[i % CONFETTI.length];
      p.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      p.style.setProperty('--dy', Math.round(Math.abs(Math.sin(ang)) * dist + 180) + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 900 - 450) + 'deg');
      p.style.animationDelay = (Math.random() * 0.18).toFixed(2) + 's';
      host.appendChild(p);
    }
    setTimeout(function () { host.innerHTML = ''; }, 2000);
  }

  function toast(msg) {
    var t = el('div', 'toast');
    var face = el('span', 'tface');
    face.innerHTML = '<img alt="" src="' + AR.face('happy', currentTheme() === 'device') + '">';
    t.appendChild(face);
    t.appendChild(el('span', '', msg));
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2000);
  }

  function celebrate(msg) {
    confetti(28);
    toast(msg);
    var c = $('coach');
    if (c) {
      c.classList.remove('cheer');
      void c.offsetWidth;
      c.classList.add('cheer');
    }
  }

  /* ===================== 状態 ===================== */
  var S = {
    eng: null, scen: null,
    screen: 'wave',          // wave | loops | trend
    speed: 1,                // 1 / 10 / 60
    frozen: false,
    sel: null,               // 選択中の設定キー id
    pend: null,              // 確定待ちの値
    silenceUntil: -1,
    abgPending: null,
    abgs: [],
    trend: [],
    sbt: null,
    sbtSaved: null,
    extubated: null,
    lastPhase: 'exp',
    loopCur: null, loopLast: null,
    banner: null,
    lesson: null             // 学習コース実行中の状態。null ならフリー操作。
  };

  var SWEEP_SEC = 8, SAMPLE_DT = 0.02;
  var NSAMP = Math.round(SWEEP_SEC / SAMPLE_DT);

  /* ===================== 波形バッファ ===================== */
  function Ring(n) { this.n = n; this.a = new Float32Array(n); this.valid = new Uint8Array(n); this.i = 0; }
  Ring.prototype.push = function (v) { this.a[this.i] = v; this.valid[this.i] = 1; this.i = (this.i + 1) % this.n; };
  Ring.prototype.clear = function () { this.valid.fill(0); this.i = 0; };

  var W = { paw: new Ring(NSAMP), flow: new Ring(NSAMP), vol: new Ring(NSAMP) };
  var sampAcc = 0;

  /* ===================== 画面定義 ===================== */
  var LANES = [
    { key: 'paw', label: 'Paw', unit: 'cmH₂O', css: '#F5B429' },
    { key: 'flow', label: 'Flow', unit: 'L/min', css: '#2FD8A8' },
    { key: 'vol', label: 'Volume', unit: 'mL', css: '#8FA8FF' }
  ];

  var MODES = [
    { id: 'VC-AC', label: 'VC-AC' },
    { id: 'PC-AC', label: 'PC-AC' },
    { id: 'SIMV-VC', label: 'SIMV' },
    { id: 'PSV', label: 'PSV' },
    { id: 'CPAP', label: 'CPAP' }
  ];

  var P = {
    vt:    { k: 'Vt',     u: 'mL',    min: 200, max: 800, step: 10,   get: function (s) { return s.vt; },   set: function (s, v) { s.vt = v; } },
    rr:    { k: 'RR',     u: '/min',  min: 5,   max: 40,  step: 1,    get: function (s) { return s.rr; },   set: function (s, v) { s.rr = v; } },
    peep:  { k: 'PEEP',   u: 'cmH₂O', min: 0,   max: 24,  step: 1,    get: function (s) { return s.peep; }, set: function (s, v) { s.peep = v; } },
    fio2:  { k: 'FiO₂',   u: '%',     min: 21,  max: 100, step: 1,    get: function (s) { return Math.round(s.fio2 * 100); }, set: function (s, v) { s.fio2 = v / 100; } },
    pinsp: { k: 'P insp', u: 'cmH₂O', min: 5,   max: 40,  step: 1,    get: function (s) { return s.pinsp; }, set: function (s, v) { s.pinsp = v; } },
    ti:    { k: 'Ti',     u: 's',     min: 0.4, max: 2.5, step: 0.1, dec: 1, get: function (s) { return s.ti; }, set: function (s, v) { s.ti = v; } },
    flow:  { k: '吸気流量', u: 'L/min', min: 20, max: 90, step: 5,    get: function (s) { return s.flow; }, set: function (s, v) { s.flow = v; } },
    ps:    { k: 'PS',     u: 'cmH₂O', min: 0,   max: 25,  step: 1,    get: function (s) { return s.ps; },   set: function (s, v) { s.ps = v; } },
    pause: { k: '吸気ポーズ', u: 's',  min: 0,   max: 0.8, step: 0.1, dec: 1, get: function (s) { return s.pause; }, set: function (s, v) { s.pause = v; } },
    trig:  { k: 'トリガ',  u: 'L/min', min: 0.5, max: 8,  step: 0.5, dec: 1, get: function (s) { return s.trigFlow; }, set: function (s, v) { s.trigFlow = v; } },
    esens: { k: '呼気感度', u: '%',    min: 10,  max: 60,  step: 5,   get: function (s) { return Math.round(s.eSens * 100); }, set: function (s, v) { s.eSens = v / 100; } },
    rise:  { k: '立上り',  u: 's',     min: 0.05, max: 0.4, step: 0.05, dec: 2, get: function (s) { return s.rise; }, set: function (s, v) { s.rise = v; } },
    sed:   { k: '鎮静',    u: '',      min: 0,   max: 100, step: 5, sim: true,
             get: function () { return Math.round(S.eng.sedation * 100); },
             set: function (s, v) { S.eng.sedation = v / 100; } }
  };

  /* つまみの可動域は体重で 2 桁変わる（早産児の Vt は 5 mL、学童は 250 mL）。
   * 症例を読み込むたびに engine.limits で P の数値だけ差し替える。 */
  function applyLimits(e) {
    var L = e.limits;
    function put(id, l) {
      if (!l || !P[id]) return;
      P[id].min = l.min; P[id].max = l.max; P[id].step = l.step;
      if (l.dec != null) P[id].dec = l.dec;
    }
    put('vt', L.vt); put('rr', L.rr); put('ti', L.ti); put('flow', L.flow);
    put('pause', L.pause); put('trig', L.trig); put('pinsp', L.pinsp); put('ps', L.ps);
  }

  var KEYS_BY_MODE = {
    'VC-AC':   ['vt', 'rr', 'peep', 'fio2', 'flow', 'pause', 'trig', 'sed'],
    'PC-AC':   ['pinsp', 'rr', 'peep', 'fio2', 'ti', 'rise', 'trig', 'sed'],
    'SIMV-VC': ['vt', 'rr', 'peep', 'fio2', 'flow', 'ps', 'trig', 'sed'],
    'PSV':     ['ps', 'peep', 'fio2', 'trig', 'esens', 'rise', 'sed'],
    'CPAP':    ['peep', 'fio2', 'trig', 'sed']
  };

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;';
    });
  }
  function r0(v) { return v == null || !isFinite(v) ? '––' : String(Math.round(v)); }
  function r1(v) { return v == null || !isFinite(v) ? '––' : v.toFixed(1); }

  var VALS = [
    { k: 'PIP', u: 'cmH₂O', get: function (e) { return r0(e.m.pip); }, lim: function (e) { return '≤' + e.s.alarms.pMax; }, tone: function (e) { return e.m.pip > e.s.alarms.pMax ? 'hi' : (e.m.pip > e.s.alarms.pMax - 5 ? 'mid' : ''); } },
    { k: 'Pplat', u: 'cmH₂O', get: function (e) { return e.m.pplat == null ? '––' : r0(e.m.pplat); }, lim: function (e) { return '≤' + e.nm.platMax; }, tone: function (e) { return e.m.pplat > e.nm.platMax ? 'hi' : ''; } },
    { k: 'PEEP tot', u: 'cmH₂O', get: function (e) { return r1(e.m.peepTot); } },
    { k: 'ΔP', u: 'cmH₂O', get: function (e) { return e.m.dp == null ? '––' : r0(e.m.dp); }, lim: function (e) { return '≤' + e.nm.dpMax; }, tone: function (e) { return e.m.dp > e.nm.dpMax ? 'hi' : ''; } },
    { k: 'Vte', u: 'mL', get: function (e) { return e.p.pbw < 6 ? r1(e.m.vte) : r0(e.m.vte); }, lim: function (e) { return r1(e.m.vte / e.p.pbw) + ' mL/kg'; }, tone: function (e) { return e.m.vte / e.p.pbw > e.nm.vtPerKg[1] + 1.5 ? 'hi' : ''; } },
    { k: 'MV', u: 'L/min', get: function (e) { return e.p.pbw < 10 ? e.m.mv.toFixed(2) : r1(e.m.mv); }, lim: function (e) { return r0(e.m.mv * 1000 / e.p.pbw) + ' mL/kg/分'; } },
    { k: 'RR tot', u: '/min', get: function (e) { return r0(e.m.rrTotal); }, lim: function (e) { return '自発 ' + r0(e.m.rrSpont); }, tone: function (e) { return e.m.rrTotal > e.s.alarms.rrHigh ? 'hi' : ''; } },
    { k: 'I:E', u: '', get: function (e) { return e.m.ie; } },
    { k: 'Cstat', u: 'mL/cmH₂O', get: function (e) { return e.m.cstat == null ? '––' : r0(e.m.cstat); } },
    { k: 'Raw', u: 'cmH₂O/L/s', get: function (e) { return e.m.raw == null ? '––' : r0(e.m.raw); } },
    { k: 'auto-PEEP', u: 'cmH₂O', get: function (e) { return r1(e.m.autoPeep); }, tone: function (e) { return e.m.autoPeep > 5 ? 'hi' : (e.m.autoPeep > 2 ? 'mid' : ''); } },
    /* 小児では f/VT を体重あたりで見る。成人の RSBI（<105）は体重が軽いほど大きく出て使えない。 */
    { k: 'f/VT', u: '/分/(mL/kg)', get: function (e) { return e.m.rsbiKg == null ? '––' : r1(e.m.rsbiKg); }, lim: function () { return '<8'; }, tone: function (e) { return e.m.rsbiKg > 8 ? 'mid' : ''; } },
    { k: 'SpO₂', u: '%', get: function (e) { return r0(e.spo2); }, lim: function (e) { return e.nm.spo2[0] + '–' + e.nm.spo2[1] + '%'; }, tone: function (e) { return e.spo2 < e.nm.spo2[0] ? 'hi' : (e.spo2 > e.nm.spo2[1] + 2 ? 'mid' : 'ok'); } },
    { k: 'etCO₂', u: 'mmHg', get: function (e) { return r0(e.etco2); } },
    { k: 'HR', u: '/min', get: function (e) { return r0(e.hr); }, lim: function (e) { return e.nm.hr[0] + '–' + e.nm.hr[1]; }, tone: function (e) { return e.hr > e.nm.hr[1] * 1.15 ? 'mid' : ''; } },
    { k: 'ABP mean', u: 'mmHg', get: function (e) { return r0(e.map); }, lim: function (e) { return '≥' + e.nm.mapMin; }, tone: function (e) { return e.map < e.nm.mapMin ? 'hi' : (e.map < e.nm.mapMin + 5 ? 'mid' : ''); } }
  ];

  /* ===================== 舞台（機器のまわり） =====================
   * 横に広い画面では、機器の左に患者、右にみどり先生を立たせる。
   * 患者の顔色は SpO₂ で変わり、先生の表情と一言は学習帯と同じものを映す。
   * 生成画像（assets/）があればそれを、無ければ art.js の絵を使う。 */
  var RAIL = { tone: null, mood: null, say: null, caseId: null, dark: null };

  function applyAssets() {
    var root = document.documentElement.style;
    function setImg(v, name) {
      var u = AS.url(name);
      if (!u) return;
      root.setProperty(v, 'url("' + u + '")');
      var n = AS.nine(name);
      if (n) root.setProperty(v.replace('--img', '--nine'), n.top + ' ' + n.right + ' ' + n.bottom + ' ' + n.left);
    }
    setImg('--img-btn', 'ui_button');
    setImg('--img-btn-go', 'ui_button_primary');
    setImg('--img-panel', 'ui_panel');
    /* ダイアログの枠は上のリボン帯が高いので、辺ごとに枠幅を変える（左右 40px 基準）。 */
    var pn = AS.nine('ui_panel');
    if (pn && pn.left) {
      var k = 40 / pn.left;
      root.setProperty('--panelw', Math.round(pn.top * k) + 'px ' + Math.round(pn.right * k) + 'px '
        + Math.round(pn.bottom * k) + 'px ' + Math.round(pn.left * k) + 'px');
      root.setProperty('--mhead-shift', (-Math.round(pn.top * k * 0.5)) + 'px');
    }
    paintStage();
  }

  function paintStage() {
    var st = $('stage');
    if (!st) return;
    var dark = currentTheme() === 'device';
    var u = AS.url('bg_play') || AS.url(dark ? 'bg_title_night' : 'bg_title_day') || AR.room(dark);
    st.style.backgroundImage = 'url("' + u + '")';
    paintRails(true);
  }

  function patientTone(e) {
    return e.spo2 < e.nm.spo2[0] ? 'bad' : (e.spo2 < e.nm.spo2[0] + 3 ? 'mid' : 'ok');
  }

  /* 症例の重さ（顔色の下限）。症例に tone があればそれ、無ければ id の表。 */
  function patientBaseTone(sc) {
    return sc.tone || PATIENT_TONE[sc.id] || 'ok';
  }

  /* 年齢層。症例に patient.kind があればそれ、無ければ年齢から決める。
   *   生後 1 か月未満 → neonate、2 歳未満 → infant、それ以上 → child */
  function patientKind(sc) {
    var pt = sc.patient || {};
    if (pt.kind) return pt.kind;
    var m = pt.ageMonths != null ? pt.ageMonths
          : (pt.ageDays != null ? pt.ageDays / 30
          : (pt.age != null ? pt.age * 12 : 24));
    return m < 1 ? 'neonate' : (m < 24 ? 'infant' : 'child');
  }

  /* 患者の絵。生成画像があればそれ、無ければコード描画。優先順:
   *   patient_<症例ID>[_mid|_bad] → patient_<年齢層>[...] → patient_bed[...] → コード描画 */
  function patientArt(sc, tone, dark) {
    var kind = patientKind(sc), suf = tone === 'ok' ? '' : '_' + tone;
    return AS.url('patient_' + sc.id + suf) || AS.url('patient_' + kind + suf)
      || AS.url('patient_bed' + suf) || AR.patient(tone, dark, kind);
  }

  function paintRails(force) {
    if (!$('railL') || !S.eng) return;
    var dark = currentTheme() === 'device';
    if (RAIL.dark !== dark) { RAIL.dark = dark; force = true; }

    /* 患者。症例そのものの重さより良い顔色にはしない。 */
    var rank = { ok: 0, mid: 1, bad: 2 };
    var tone = patientTone(S.eng), base = patientBaseTone(S.scen);
    if (rank[base] > rank[tone]) tone = base;
    if (force || tone !== RAIL.tone || S.scen.id !== RAIL.caseId) {
      RAIL.tone = tone;
      $('portPatient').innerHTML = '<img alt="" src="' + patientArt(S.scen, tone, dark) + '">';
    }
    if (force || S.scen.id !== RAIL.caseId) { RAIL.caseId = S.scen.id; $('railCase').textContent = S.scen.title; }

    /* 先生。学習帯と同じ表情・同じ一言。 */
    var L = S.lesson;
    var mood = (L && L.mood) || 'normal';
    if (force || mood !== RAIL.mood) {
      RAIL.mood = mood;
      var du = AS.url('doctor_' + mood) || AS.url('doctor_normal') || AR.doctor(dark, false);
      $('portDoc').innerHTML = '<img alt="" src="' + du + '">';
    }
    var say = L ? ($('cSay').textContent || '') : (S.scen.oneLine || '自由に操作できます。');
    if (say.length > 96) say = say.slice(0, 94) + '…';
    if (force || say !== RAIL.say) { RAIL.say = say; $('railSay').textContent = say; }
  }

  /* ===================== 起動 ===================== */
  function boot() {
    initTheme();
    buildVals();
    loadScenario(SC.SCENARIOS[0], false);
    buildTabs(); bindHard(); bindKnob(); bindCoach();
    buildTitle();
    window.addEventListener('resize', fitAll);
    requestAnimationFrame(frame);
    AS.ready.then(applyAssets);
    showTitle();
  }

  /* ===================== タイトル画面 =====================
   * ゲームらしく、キャラクターと進み具合を出してから始める。
   * 免責は初回の「はじめる」で一度だけ出し、以後はメニューから読める。 */
  var AGREE_KEY = 'ventsim.agreed.v1';

  function agreed() {
    try { return window.localStorage.getItem(AGREE_KEY) === '1'; } catch (err) { return false; }
  }
  function setAgreed() {
    try { window.localStorage.setItem(AGREE_KEY, '1'); } catch (err) { /* 記録できなくても進める */ }
  }

  function firstUndoneLesson() {
    var done = doneSet(), list = LS.allLessons();
    for (var i = 0; i < list.length; i++) {
      if (done.indexOf(list[i].lesson.id) < 0) return list[i];
    }
    return null;
  }

  function buildTitle() {
    $('tLogo').innerHTML = CH.logo();
    $('tDoctor').innerHTML = CH.doctor('happy');
    $('tMascot').innerHTML = CH.mascot('happy');
    $('tTheme').onclick = function () {
      applyTheme(currentTheme() === 'pop' ? 'device' : 'pop', true);
    };
  }

  /* 免責に同意してから中身へ進む。初回だけダイアログを挟む。 */
  function enter(run) {
    if (agreed()) { hideTitle(); run(); return; }
    openDisclaimer(true, function () { setAgreed(); hideTitle(); run(); });
  }

  /* タイトルの中身。ゲーム画面（title.js）にも DOM の控えにも同じものを渡す。 */
  function titleData() {
    var n = LS.allLessons().length;
    var d = doneSet().filter(function (id) { return LS.lessonById(id); }).length;
    var next = firstUndoneLesson();
    var items = [];
    if (d > 0 && next) {
      items.push({ id: 'go', glyph: '▶', title: 'つづきから', primary: true,
                   sub: next.chapter.title + '　' + next.lesson.title });
    } else {
      items.push({ id: 'go', glyph: '▶', title: 'はじめる', primary: true, sub: '学習コースを 1 から' });
    }
    items.push({ id: 'course', glyph: '☰', title: 'コースを選ぶ', sub: '6 章 ' + n + ' レッスンから選ぶ' });
    items.push({ id: 'cases', glyph: '✚', title: '症例で練習', sub: SC.SCENARIOS.length + ' 症例を自由に操作する' });
    items.push({ id: 'about', glyph: '?', title: 'この教材について', sub: '免責事項とモデルの説明' });
    return {
      done: d, total: n, items: items, next: next,
      line: d === 0 ? 'はじめまして。小児科の みどり先生です。\nいっしょに こどもたちの呼吸を守りましょう。'
          : (d >= n ? '全レッスン修了、おみごとです。\n症例で腕を試してみましょう。'
                    : 'おかえりなさい。ここまで ' + d + ' / ' + n + ' レッスン。\nつづきからどうぞ。')
    };
  }

  function titleSelect(id, data) {
    if (id === 'go') {
      enter(function () { startLesson((data.next ? data.next.lesson : LS.allLessons()[0].lesson).id); });
    } else if (id === 'course') {
      enter(function () { openCourse(); });
    } else if (id === 'cases') {
      enter(function () { openCases(); });
    } else {
      openDisclaimer(false);
    }
  }

  function showTitle() {
    var data = titleData();
    $('title').hidden = false;
    /* WebGL が使えるならゲーム画面。だめなら下の DOM がそのまま出る。 */
    if (window.VentTitle && window.VentTitle.available()) {
      $('title').classList.add('gl');
      window.VentTitle.resume();
      window.VentTitle.show({
        mount: $('tCanvas'),
        dark: currentTheme() === 'device',
        themeLabel: currentTheme() === 'pop' ? 'ポップ' : '実機',
        done: data.done, total: data.total, line: data.line, items: data.items,
        onSelect: function (id) { titleSelect(id, data); },
        onTheme: function () {
          applyTheme(currentTheme() === 'pop' ? 'device' : 'pop', true);
          if (!$('title').hidden) showTitle();
        }
      }).then(function (ok) {
        if (!ok) { $('title').classList.remove('gl'); showTitleDom(data); }
      });
      return;
    }
    showTitleDom(data);
  }

  /* WebGL が無い環境向けの控え。中身はゲーム画面と同じ。 */
  function showTitleDom(data) {
    var box = $('tMenu');
    box.innerHTML = '';
    data.items.forEach(function (item) {
      var b = el('button', 'tbtn' + (item.primary ? ' go' : ''));
      b.appendChild(el('span', 'em', item.glyph));
      var t = el('div');
      t.appendChild(el('b', '', item.title));
      if (item.sub) t.appendChild(el('i', '', item.sub));
      b.appendChild(t);
      b.onclick = function () { titleSelect(item.id, data); };
      box.appendChild(b);
    });
    var pct = Math.round(data.done / data.total * 100);
    $('tProgBar').style.width = pct + '%';
    $('tPct').textContent = pct + '%';
    $('tSay').innerHTML = data.line.replace(/\n/g, '<br>');
    $('tDoctor').innerHTML = CH.doctor(data.done >= data.total ? 'happy' : 'normal');
  }

  function hideTitle() {
    if (window.VentTitle) window.VentTitle.hide();
    $('title').hidden = true;
    $('title').classList.remove('gl');
    fitAll();
  }

  function loadScenario(sc, showSetup, keepLesson) {
    if (!keepLesson) endLesson(false);
    S.scen = sc;
    var st = E.defaultSettings(), sg = sc.suggested;
    for (var k in sg) if (Object.prototype.hasOwnProperty.call(sg, k)) st[k] = sg[k];
    var nm0 = E.normsFor(sc.patient);
    st.alarms = E.alarmsFor(E.predictedBodyWeight(sc.patient), nm0, st.vt, st.rr);
    S.eng = new E.Engine(sc.patient, st);
    applyLimits(S.eng);
    S.abgs = []; S.abgPending = null; S.trend = []; S.sbt = null; S.sbtSaved = null; S.extubated = null;
    S.sel = null; S.pend = null; S.silenceUntil = -1; S.frozen = false; S.speed = 1;
    S.loopCur = []; S.loopLast = null; S.banner = null; trendAcc = 4;
    W.paw.clear(); W.flow.clear(); W.vol.clear();
    $('ptName').textContent = sc.patient.name + '・' + sc.title;
    $('kFrz').classList.remove('on'); $('frz').hidden = true;
    $('kSpd').textContent = '× 1'; $('kSpd').classList.remove('on'); $('ff').hidden = true;
    $('kAbg').textContent = '血液ガス'; $('kAbg').classList.remove('on');
    buildKeys(); syncTabs(); fitAll();
    if (showSetup) openSetup();
  }

  /* ===================== タブ ===================== */
  function buildTabs() {
    var t = $('tabs'); t.innerHTML = '';
    MODES.forEach(function (m) {
      var b = el('button', '', m.label);
      b.dataset.mode = m.id;
      b.onclick = function () { setMode(m.id); };
      t.appendChild(b);
    });
    t.appendChild(el('div', 'sp'));
    [['wave', '波形'], ['loops', 'ループ'], ['trend', 'トレンド'], ['lung', '肺 3D']].forEach(function (p) {
      var b = el('button', 'scr', p[1]);
      b.dataset.scr = p[0];
      b.onclick = function () { setScreen(p[0]); };
      t.appendChild(b);
    });
    syncTabs();
  }
  function syncTabs() {
    var t = $('tabs');
    Array.prototype.forEach.call(t.children, function (b) {
      if (b.dataset.mode) b.setAttribute('aria-pressed', b.dataset.mode === S.eng.s.mode ? 'true' : 'false');
      if (b.dataset.scr) b.setAttribute('aria-pressed', b.dataset.scr === S.screen ? 'true' : 'false');
    });
  }
  function setMode(id) {
    if (S.eng.s.mode === id) return;
    S.eng.s.mode = id;
    if (S.eng._note) S.eng._note('モード変更: ' + id);
    S.sel = null; S.pend = null;
    buildKeys(); syncTabs(); paintDial();
    lessonEvent('mode:' + id);
  }

  /* ===================== 計測値タイル ===================== */
  var valNodes = [];
  function buildVals() {
    var box = $('vals'); box.innerHTML = ''; valNodes = [];
    VALS.forEach(function (d) {
      var n = el('div', 'val');
      var v = el('div', 'v'), vs = el('span', '', '––'), u = el('span', 'u', d.u);
      v.appendChild(vs); v.appendChild(u);
      var lim = el('div', 'lim', '');
      n.appendChild(el('div', 'k', d.k)); n.appendChild(lim); n.appendChild(v);
      box.appendChild(n);
      valNodes.push({ n: n, v: vs, lim: lim, d: d });
    });
  }
  function paintVals() {
    var e = S.eng;
    for (var i = 0; i < valNodes.length; i++) {
      var o = valNodes[i], txt = o.d.get(e);
      if (o.v.textContent !== txt) o.v.textContent = txt;
      if (o.d.lim) { var lt = o.d.lim(e); if (o.lim.textContent !== lt) o.lim.textContent = lt; }
      var tone = o.d.tone ? o.d.tone(e) : '';
      if (o.n.dataset.tone !== tone) {
        o.n.className = 'val ' + tone + (o.n.dataset.spot ? ' spot' : '');
        o.n.dataset.tone = tone;
      }
    }
  }

  /* ===================== 設定キー ===================== */
  var keyNodes = {};
  function buildKeys() {
    var box = $('keys'); box.innerHTML = ''; keyNodes = {};
    (KEYS_BY_MODE[S.eng.s.mode] || []).forEach(function (id) {
      var p = P[id];
      var b = el('button', 'pkey');
      b.setAttribute('aria-pressed', 'false');
      var v = el('div', 'v'), vs = el('span'), u = el('span', 'u', p.u);
      v.appendChild(vs); v.appendChild(u);
      b.appendChild(el('div', 'k', p.k)); b.appendChild(v);
      b.onclick = function () { selectKey(id); };
      box.appendChild(b);
      keyNodes[id] = { b: b, v: vs };
    });
    paintKeys();
    if (S.lesson) applySpot(S.lesson.spot);
  }
  function fmtP(p, v) { return p.dec ? v.toFixed(p.dec) : String(Math.round(v)); }
  function paintKeys() {
    for (var id in keyNodes) {
      var p = P[id], o = keyNodes[id];
      var cur = p.get(S.eng.s);
      var show = (S.sel === id && S.pend != null) ? S.pend : cur;
      o.v.textContent = fmtP(p, show);
      o.b.setAttribute('aria-pressed', S.sel === id ? 'true' : 'false');
      o.b.classList.toggle('pending', S.sel === id && S.pend != null && S.pend !== cur);
    }
  }
  function selectKey(id) {
    if (S.sel === id) { S.sel = null; S.pend = null; }
    else { S.sel = id; S.pend = P[id].get(S.eng.s); }
    paintKeys(); paintDial();
  }
  function commit() {
    if (!S.sel || S.pend == null) return;
    var p = P[S.sel];
    if (S.pend === p.get(S.eng.s)) return;
    p.set(S.eng.s, S.pend);
    if (S.eng._note) S.eng._note('設定変更: ' + p.k + ' ' + fmtP(p, S.pend) + (p.u ? ' ' + p.u : ''));
    S.pend = p.get(S.eng.s);
    paintKeys(); paintDial();
  }
  function nudge(dir) {
    if (!S.sel) return;
    var p = P[S.sel];
    var v = (S.pend == null ? p.get(S.eng.s) : S.pend) + dir * p.step;
    v = Math.round(v / p.step) * p.step;
    S.pend = Math.max(p.min, Math.min(p.max, v));
    paintKeys(); paintDial();
  }

  /* ===================== ダイヤル ===================== */
  function paintDial() {
    var kb = $('dialK'), vb = $('dialV'), ub = $('dialU');
    if (!S.sel) {
      kb.textContent = '設定を選択'; vb.textContent = '—'; ub.textContent = '';
      $('btnOk').disabled = true;
      document.querySelector('.dialrow').classList.remove('pending');
      drawKnob(0, false); return;
    }
    var p = P[S.sel];
    kb.textContent = p.k; vb.textContent = fmtP(p, S.pend); ub.textContent = p.u;
    var dirty = S.pend !== p.get(S.eng.s);
    $('btnOk').disabled = !dirty;
    document.querySelector('.dialrow').classList.toggle('pending', dirty);
    var kn = $('knob');
    kn.setAttribute('aria-valuemin', p.min); kn.setAttribute('aria-valuemax', p.max);
    kn.setAttribute('aria-valuenow', S.pend);
    kn.setAttribute('aria-valuetext', p.k + ' ' + fmtP(p, S.pend) + ' ' + p.u);
    drawKnob((S.pend - p.min) / (p.max - p.min), dirty);
  }
  function drawKnob(f, dirty) {
    var c = $('knobC'), d = window.devicePixelRatio || 1;
    var w = c.clientWidth || 56, h = c.clientHeight || 56;
    if (c.width !== Math.round(w * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    var x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2, R = w / 2 - 2;
    var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    x.lineWidth = 3; x.lineCap = 'round';
    x.strokeStyle = PAL.knobTrack; x.beginPath(); x.arc(cx, cy, R - 1, a0, a1); x.stroke();
    if (f > 0) {
      x.strokeStyle = dirty ? PAL.paw : PAL.accent;
      x.beginPath(); x.arc(cx, cy, R - 1, a0, a0 + (a1 - a0) * f); x.stroke();
    }
    x.strokeStyle = PAL.knobTick; x.lineWidth = 1;
    for (var i = 0; i <= 10; i++) {
      var a = a0 + (a1 - a0) * (i / 10);
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
      x.lineTo(cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9));
      x.stroke();
    }
    var ap = a0 + (a1 - a0) * f;
    x.strokeStyle = dirty ? PAL.paw : PAL.knobPtr; x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(cx + Math.cos(ap) * (R - 22), cy + Math.sin(ap) * (R - 22));
    x.lineTo(cx + Math.cos(ap) * (R - 10), cy + Math.sin(ap) * (R - 10));
    x.stroke();
  }
  function bindKnob() {
    var kn = $('knob'), dragging = false, last = 0, acc = 0;
    function ang(ev) {
      var r = kn.getBoundingClientRect();
      return Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2));
    }
    kn.addEventListener('pointerdown', function (ev) {
      if (!S.sel) return;
      dragging = true; acc = 0; last = ang(ev);
      try { kn.setPointerCapture(ev.pointerId); } catch (e) { }
      ev.preventDefault();
    });
    kn.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var a = ang(ev), d = a - last;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      last = a; acc += d;
      var step = Math.PI / 12;
      var guard = 0;
      while (Math.abs(acc) >= step && guard++ < 40) {
        nudge(acc > 0 ? 1 : -1);
        acc -= (acc > 0 ? step : -step);
      }
    });
    function up(ev) { if (dragging) { dragging = false; try { kn.releasePointerCapture(ev.pointerId); } catch (e) { } } }
    kn.addEventListener('pointerup', up);
    kn.addEventListener('pointercancel', up);
    kn.addEventListener('wheel', function (ev) { if (!S.sel) return; ev.preventDefault(); nudge(ev.deltaY < 0 ? 1 : -1); }, { passive: false });
    kn.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') { nudge(1); ev.preventDefault(); }
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') { nudge(-1); ev.preventDefault(); }
      else if (ev.key === 'Enter' || ev.key === ' ') { commit(); ev.preventDefault(); }
    });
    $('btnOk').onclick = commit;
  }

  /* ===================== ハードキー ===================== */
  function bindHard() {
    $('kInsp').onclick = function () { S.eng.requestHold('insp'); lessonEvent('hold:insp'); };
    $('kExp').onclick = function () { S.eng.requestHold('exp'); lessonEvent('hold:exp'); };
    $('kO2').onclick = function () {
      var s = S.eng.s, prev = s.fio2;
      if (prev === 1.0) return;
      s.fio2 = 1.0; paintKeys(); paintDial(); flash($('kO2')); lessonEvent('o2100');
      setTimeout(function () { if (S.eng.s === s && s.fio2 === 1.0) { s.fio2 = prev; paintKeys(); paintDial(); } }, 6000);
    };
    $('kSuc').onclick = suction;
    $('kFrz').onclick = function () {
      S.frozen = !S.frozen;
      $('kFrz').classList.toggle('on', S.frozen);
      $('frz').hidden = !S.frozen;
    };
    $('kSpd').onclick = function () {
      S.speed = S.speed === 1 ? 10 : (S.speed === 10 ? 60 : 1);
      $('kSpd').textContent = '× ' + S.speed;
      $('kSpd').classList.toggle('on', S.speed > 1);
      $('ff').hidden = S.speed <= 1;
    };
    $('kAbg').onclick = abgKey;
    $('kWean').onclick = openWeaning;
    $('kLearn').onclick = openCourse;
    $('kMenu').onclick = openMenu;
    $('btnSil').onclick = function () {
      S.silenceUntil = S.silenceUntil > S.eng.clock ? -1 : S.eng.clock + 120;
    };
  }
  function flash(b) { b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 450); }

  function suction() {
    var e = S.eng;
    e.shunt = Math.min(0.9, e.shunt + 0.10);
    e.pao2 = Math.max(35, e.pao2 - 22);
    e.spo2 = E.satFromPO2(e.pao2) * 100;
    e.p.Rinsp = Math.max(4, e.p.Rinsp * 0.88);
    e.p.Rexp = Math.max(5, e.p.Rexp * 0.90);
    if (e._recomputeMechanics) e._recomputeMechanics();
    if (e._note) e._note('気管吸引を実施');
    lessonEvent('suction');
    S.banner = { t: e.clock, msg: '吸引後：一時的に酸素化が低下します' };
    flash($('kSuc'));
  }

  /* ===================== 血液ガス ===================== */
  function abgKey() {
    if (S.abgPending) return;
    S.abgPending = { readyAt: S.eng.clock + 120 };
    $('kAbg').textContent = '採血中…';
    $('kAbg').classList.add('on');
    lessonEvent('abg:order');
  }
  function abgTick() {
    if (!S.abgPending || S.eng.clock < S.abgPending.readyAt) return;
    var g = S.eng.sampleABG();
    S.abgs.push(g); S.abgPending = null;
    $('kAbg').textContent = '血液ガス'; $('kAbg').classList.remove('on');
    openABG(g);
  }

  /* ===================== 離脱・SBT ===================== */
  function startSBT() {
    var e = S.eng;
    S.sbtSaved = JSON.parse(JSON.stringify(e.s));
    e.s.mode = 'PSV'; e.s.ps = e.p.pbw < 10 ? 8 : (e.p.pbw < 25 ? 6 : 5);
    e.s.peep = Math.min(e.s.peep, 5);
    e.s.fio2 = Math.min(e.s.fio2, 0.4);
    e.sedation = Math.min(e.sedation, 0.15);
    S.sbt = { t0: e.clock, dur: 1800, badSince: -1, failMsg: null, done: null };
    S.sel = null; S.pend = null;
    buildKeys(); syncTabs(); paintDial();
    if (e._note) e._note('SBT 開始（PS 5 / PEEP 5）');
    lessonEvent('sbt:start');
  }
  function restoreSettings() {
    if (!S.sbtSaved) return;
    var e = S.eng, sv = S.sbtSaved;
    for (var k in sv) if (Object.prototype.hasOwnProperty.call(sv, k)) e.s[k] = sv[k];
    e.sedation = Math.min(0.5, e.sedation + 0.25);
    S.sel = null; S.pend = null;
    buildKeys(); syncTabs(); paintDial();
  }
  function sbtTick() {
    var b = S.sbt;
    if (!b || b.done) return;
    var e = S.eng, bad = null;
    var nm = e.nm, rrCap = Math.round(nm.rr[1] * 1.5), hrCap = Math.round(nm.hr[1] * 1.25);
    if (e.m.rrTotal > rrCap) bad = '呼吸回数が ' + rrCap + '/分を超えました';
    else if (e.spo2 < nm.spo2[0]) bad = 'SpO₂ が ' + nm.spo2[0] + '% を下回りました';
    else if (e.m.rsbiKg != null && e.m.rsbiKg > 8) bad = 'f/VT が 8 を超えました（浅く速い呼吸）';
    else if (e.hr > hrCap) bad = '頻脈（' + hrCap + '/分超）';
    else if (e.map < 65) bad = '血圧低下（平均 65 mmHg 未満）';
    else if (e.ph < 7.30) bad = 'アシドーシスが進みました';
    if (bad) {
      if (b.badSince < 0) b.badSince = e.clock;
      if (e.clock - b.badSince > 60) {
        b.done = 'fail'; b.failMsg = bad;
        restoreSettings(); openSBTResult();
      }
    } else b.badSince = -1;
    if (!b.done && e.clock - b.t0 >= b.dur) { b.done = 'pass'; openSBTResult(); }
  }

  /* ===================== トレンド ===================== */
  var trendAcc = 0;
  function trendTick(dt) {
    trendAcc += dt;
    if (trendAcc < 5) return;
    trendAcc = 0;
    var e = S.eng;
    S.trend.push({ t: e.clock, pip: e.m.pip, plat: e.m.pplat, vte: e.m.vte, mv: e.m.mv,
      spo2: e.spo2, peep: e.s.peep, fio2: e.s.fio2, pao2: e.pao2, paco2: e.paco2, rr: e.m.rrTotal });
    if (S.trend.length > 900) S.trend.shift();
  }

  /* ===================== メインループ ===================== */
  var lastT = 0;
  var railT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!lastT) { lastT = now; return; }
    if (now - railT > 400) { railT = now; paintRails(false); }
    var real = Math.min(0.25, (now - lastT) / 1000); lastT = now;
    var e = S.eng;
    if (!e.extubated) {
      var simSec = real * S.speed;
      var dt = S.speed > 1 ? 0.01 : 0.005;
      var steps = Math.min(1600, Math.round(simSec / dt));
      var sampling = S.speed <= 1 && !S.frozen;
      for (var i = 0; i < steps; i++) {
        e.step(dt, false);
        if (sampling) {
          sampAcc += dt;
          if (sampAcc >= SAMPLE_DT) {
            sampAcc -= SAMPLE_DT;
            W.paw.push(e.paw);
            W.flow.push(e.flow * 60);
            W.vol.push((e.V - e.C * e.s.peep) * 1000);
          }
          if (S.loopCur) {
            S.loopCur.push([(e.V - e.C * e.s.peep) * 1000, e.paw, e.flow * 60]);
            if (S.loopCur.length > 1600) S.loopCur.shift();
          }
        }
        if (e.phase === 'insp' && S.lastPhase !== 'insp') {
          if (S.loopCur && S.loopCur.length > 12) S.loopLast = S.loopCur;
          S.loopCur = [];
        }
        S.lastPhase = e.phase;
      }
      trendTick(simSec);
      abgTick(); sbtTick(); lessonTick(simSec);
    }
    paintVals(); paintStatus(); paintCoach();
    if (S.screen === 'wave') drawScope();
    else if (S.screen === 'loops') drawLoops();
    else if (S.screen === 'lung') drawLung(real);
    else drawTrend();
  }

  /* ===================== ステータスバー ===================== */
  var alarmIdx = 0, alarmT = 0;
  function paintStatus() {
    var e = S.eng;
    var mm = Math.floor(e.clock / 60), hh = 8 + Math.floor(mm / 60);
    var ct = String(hh % 24).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
    if ($('clk').textContent !== ct) $('clk').textContent = ct;

    var muted = S.silenceUntil > e.clock;
    $('btnSil').classList.toggle('on', muted);
    var st = muted ? '消音 ' + Math.max(0, Math.ceil(S.silenceUntil - e.clock)) + 's' : '消音 2分';
    if ($('btnSil').textContent !== st) $('btnSil').textContent = st;

    var box = $('alarm'), txt = $('alarmTxt'), led = $('ledAlarm');
    var a = e.alarms || [], sev = 0;
    a.forEach(function (x) { if (x.sev > sev) sev = x.sev; });
    var holdK = (e.hold && e.hold.kind) || e.holdPending || null;
    $('kInsp').classList.toggle('on', holdK === 'insp');
    $('kExp').classList.toggle('on', holdK === 'exp');

    var msg = null;
    if (a.length) {
      alarmT++;
      if (alarmT > 100) { alarmT = 0; alarmIdx = (alarmIdx + 1) % a.length; }
      var pick = a[alarmIdx % a.length];
      msg = pick.msg + (a.length > 1 ? '  ＋他 ' + (a.length - 1) + ' 件' : '');
    } else if (e.hold) {
      msg = e.hold.kind === 'insp' ? '吸気ポーズ中  Pplat を測定しています' : '呼気ポーズ中  total PEEP を測定しています';
    } else if (e.holdPending) {
      msg = e.holdPending === 'insp' ? '吸気ポーズ待機中  次の吸気の終わりで実行します' : '呼気ポーズ待機中  次の呼気の終わりで実行します';
    } else if (S.sbt && !S.sbt.done) {
      var left = Math.max(0, S.sbt.dur - (e.clock - S.sbt.t0));
      msg = 'SBT 実施中  残り ' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
    } else if (S.banner && e.clock - S.banner.t < 25) {
      msg = S.banner.msg;
    } else {
      msg = e.extubated ? '抜管済み' : '換気中  ' + e.s.mode;
    }
    if (txt.textContent !== msg) txt.textContent = msg;
    var cls = 'alarm' + (sev === 2 ? ' s2' : sev === 1 ? ' s1' : '') + (muted && sev ? ' muted' : '');
    if (box.className !== cls) box.className = cls;
    var lc = 'led' + (sev === 2 ? ' s2' : sev === 1 ? ' s1' : '');
    if (led.className !== lc) led.className = lc;
  }

  /* ===================== 波形描画 ===================== */
  var ctx, cvW = 0, cvH = 0;
  function fitAll() {
    var c = $('scope'), wrap = $('scopewrap');
    var d = window.devicePixelRatio || 1;
    var w = Math.max(160, wrap.clientWidth), h = Math.max(120, wrap.clientHeight);
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    ctx = c.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
    cvW = w; cvH = h;
    if (LUNG.view) LUNG.view.resize();
    paintDial();
  }

  function laneRanges() {
    var e = S.eng;
    var pHi = Math.max(40, Math.ceil((e.m.pip + 6) / 10) * 10);
    var vRef = Math.max(e.m.vte, e.s.vt, e.p.pbw * 6) * 1.5;
    var vStep = e.p.pbw < 6 ? 2 : (e.p.pbw < 20 ? 20 : 100);
    var vHi = Math.max(vStep * 2, Math.ceil(vRef / vStep) * vStep);
    return [{ lo: -5, hi: pHi }, { lo: -80, hi: 80 }, { lo: 0, hi: vHi }];
  }

  function drawScope() {
    if (!ctx) return;
    var w = cvW, h = cvH, x = ctx;
    x.fillStyle = PAL.bg; x.fillRect(0, 0, w, h);
    var padL = 36, padR = 6, padT = 2, padB = 2;
    var lh = (h - padT - padB) / 3;
    var rg = laneRanges();
    var head = W.paw.i, xw = w - padL - padR;

    for (var li = 0; li < 3; li++) {
      var lane = LANES[li], r = rg[li];
      var y0 = padT + li * lh, y1 = y0 + lh, span = r.hi - r.lo;
      var toY = (function (y1, span, lo, lh) {
        return function (v) { return y1 - 4 - (v - lo) / span * (lh - 10); };
      })(y1, span, r.lo, lh);

      x.strokeStyle = PAL.grid; x.lineWidth = 1;
      for (var s = 0; s <= SWEEP_SEC; s++) {
        var gx = Math.round(padL + xw * (s / SWEEP_SEC)) + .5;
        x.beginPath(); x.moveTo(gx, y0 + 2); x.lineTo(gx, y1 - 2); x.stroke();
      }
      if (li) {
        x.strokeStyle = PAL.grid2;
        x.beginPath(); x.moveTo(0, Math.round(y0) + .5); x.lineTo(w, Math.round(y0) + .5); x.stroke();
      }

      var zy = toY(0);
      x.strokeStyle = PAL.zero; x.setLineDash([3, 4]);
      x.beginPath(); x.moveTo(padL, zy); x.lineTo(w - padR, zy); x.stroke();
      x.setLineDash([]);
      if (li === 0) {
        var py = toY(S.eng.s.peep);
        x.strokeStyle = PAL.peep; x.setLineDash([2, 5]);
        x.beginPath(); x.moveTo(padL, py); x.lineTo(w - padR, py); x.stroke();
        x.setLineDash([]);
      }

      x.fillStyle = PAL.axis; x.font = '9px "Barlow Semi Condensed", sans-serif'; x.textAlign = 'right';
      x.fillText(String(Math.round(r.hi)), padL - 4, y0 + 11);
      x.fillText(String(Math.round(r.lo)), padL - 4, y1 - 4);
      x.textAlign = 'left';
      x.font = '600 10px "Barlow Semi Condensed", sans-serif';
      x.fillStyle = lane.css; x.globalAlpha = .9;
      x.fillText(lane.label, padL + 5, y0 + 11);
      var lw = x.measureText(lane.label).width;
      x.globalAlpha = .55; x.fillStyle = PAL.faint;
      x.fillText(lane.unit, padL + 11 + lw, y0 + 11);
      x.globalAlpha = 1;

      var ring = W[lane.key], n = ring.n;
      x.lineJoin = 'round'; x.lineCap = 'round';
      for (var pass = 0; pass < 2; pass++) {
        x.beginPath();
        var started = false;
        for (var k = 0; k < n; k++) {
          var age = (k - head + n) % n;
          if (!ring.valid[k] || age > n - 4) { started = false; continue; }
          var px = padL + xw * (k / n);
          var py2 = Math.max(y0 + 2, Math.min(y1 - 2, toY(ring.a[k])));
          if (!started) { x.moveTo(px, py2); started = true; } else x.lineTo(px, py2);
        }
        x.strokeStyle = lane.css;
        if (pass === 0) { x.globalAlpha = PAL.glow ? .22 : .16; x.lineWidth = PAL.glow ? 5.5 : 4.5; }
        else { x.globalAlpha = 1; x.lineWidth = PAL.glow ? 2 : 1.5; }
        if (PAL.glow && pass === 1) { x.shadowColor = lane.css; x.shadowBlur = PAL.glow; }
        x.stroke();
        x.shadowBlur = 0;
      }
      x.globalAlpha = 1;

      var cxp = padL + xw * (head / n);
      x.fillStyle = 'rgba(' + PAL.cursor + ',.10)'; x.fillRect(cxp, y0 + 1, 7, lh - 2);
      x.strokeStyle = 'rgba(' + PAL.cursor + ',.5)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(cxp + .5, y0 + 1); x.lineTo(cxp + .5, y1 - 1); x.stroke();
    }
  }

  /* ===================== ループ描画 ===================== */
  function drawLoops() {
    if (!ctx) return;
    var w = cvW, h = cvH, x = ctx;
    x.fillStyle = PAL.bg; x.fillRect(0, 0, w, h);
    var two = w > 470;
    var boxes = two ? [[0, 0, w / 2, h], [w / 2, 0, w / 2, h]]
                    : [[0, 0, w, h / 2], [0, h / 2, w, h / 2]];
    drawLoop(boxes[0], 'P–V ループ', 'Volume mL', 'Paw cmH₂O', 1);
    drawLoop(boxes[1], 'F–V ループ', 'Volume mL', 'Flow L/min', 2);
  }
  function drawLoop(b, title, xl, yl, yi) {
    var x = ctx, L = b[0] + 44, T = b[1] + 22, Rw = b[2] - 56, Rh = b[3] - 48;
    if (Rw < 40 || Rh < 40) return;
    var live = (S.loopCur && S.loopCur.length > 24) ? S.loopCur : null;
    var prev = S.loopLast;
    var data = live || prev;
    x.strokeStyle = PAL.grid2; x.lineWidth = 1; x.strokeRect(L + .5, T + .5, Rw, Rh);
    x.fillStyle = PAL.label; x.font = '600 10px "Barlow Semi Condensed", sans-serif'; x.textAlign = 'left';
    x.fillText(title, L, T - 8);
    x.fillStyle = PAL.axis; x.font = '9px "Barlow Semi Condensed", sans-serif';
    x.fillText(xl, L, T + Rh + 14);
    x.save(); x.translate(L - 32, T + Rh / 2); x.rotate(-Math.PI / 2);
    x.textAlign = 'center'; x.fillText(yl, 0, 0); x.restore();
    if (!data || data.length < 8) {
      x.fillStyle = PAL.faint; x.textAlign = 'center'; x.font = '11px sans-serif';
      x.fillText('計測中', L + Rw / 2, T + Rh / 2); return;
    }
    /* 呼気終末の容量を 0 とする。実機のループと同じ見え方になる。 */
    var sets = [];
    if (prev && prev.length > 8 && prev !== data) sets.push({ d: prev, dim: true });
    sets.push({ d: data, dim: false });
    var vmax = 0, ymin = 1e9, ymax = -1e9;
    sets.forEach(function (s2) {
      var v0 = s2.d[0][0];
      s2.d.forEach(function (p) {
        var v = p[0] - v0;
        if (v > vmax) vmax = v;
        if (p[yi] < ymin) ymin = p[yi];
        if (p[yi] > ymax) ymax = p[yi];
      });
    });
    vmax = Math.max(S.eng.p.pbw * 4, vmax * 1.08);
    if (yi === 1) { ymin = Math.min(-2, ymin); ymax = Math.max(20, ymax * 1.08); }
    else { var m = Math.max(Math.abs(ymin), Math.abs(ymax), 10) * 1.1; ymin = -m; ymax = m; }
    var px = function (v) { return L + v / vmax * Rw; };
    var py = function (v) { return T + Rh - (v - ymin) / (ymax - ymin) * Rh; };
    if (yi === 2) {
      x.strokeStyle = PAL.zero; x.beginPath();
      x.moveTo(L, py(0)); x.lineTo(L + Rw, py(0)); x.stroke();
    }
    sets.forEach(function (s2) {
      var v0 = s2.d[0][0];
      x.strokeStyle = yi === 1 ? PAL.paw : PAL.flow;
      x.globalAlpha = s2.dim ? 0.28 : 1;
      x.lineWidth = s2.dim ? 1 : (PAL.glow ? 2 : 1.4);
      if (PAL.glow && !s2.dim) { x.shadowColor = x.strokeStyle; x.shadowBlur = PAL.glow; } else x.shadowBlur = 0;
      x.beginPath();
      s2.d.forEach(function (p, i) {
        var a = px(p[0] - v0), c = py(p[yi]);
        if (!i) x.moveTo(a, c); else x.lineTo(a, c);
      });
      x.stroke();
      x.shadowBlur = 0;
    });
    x.globalAlpha = 1;
    x.fillStyle = PAL.axis; x.textAlign = 'right'; x.font = '9px "Barlow Semi Condensed", sans-serif';
    x.fillText(String(Math.round(ymax)), L - 4, T + 9);
    x.fillText(String(Math.round(ymin)), L - 4, T + Rh);
    x.textAlign = 'center';
    x.fillText(String(Math.round(vmax)), L + Rw, T + Rh + 14);
  }

  /* ===================== トレンド描画 ===================== */
  function drawTrend() {
    if (!ctx) return;
    var w = cvW, h = cvH, x = ctx;
    x.fillStyle = PAL.bg; x.fillRect(0, 0, w, h);
    var d = S.trend;
    if (d.length < 2) {
      x.fillStyle = PAL.faint; x.textAlign = 'center'; x.font = '11px sans-serif';
      x.fillText('トレンドを記録しています', w / 2, h / 2); return;
    }
    var series = [
      { key: 'pip', k2: 'plat', label: 'PIP / Pplat  cmH₂O', c: PAL.paw, c2: PAL.paw2 },
      { key: 'vte', label: 'Vte  mL', c: PAL.vol },
      { key: 'spo2', label: 'SpO₂  %', c: PAL.spo2, lo: 75, hi: 100 }
    ];
    var t0 = d[0].t, t1 = d[d.length - 1].t, span = Math.max(60, t1 - t0);
    var lh = h / 3, padL = 40;
    series.forEach(function (s, i) {
      var y0 = i * lh + 14, y1 = (i + 1) * lh - 8;
      var lo = s.lo, hi = s.hi;
      if (lo == null) {
        lo = 1e9; hi = -1e9;
        d.forEach(function (p) {
          var v = p[s.key];
          if (v != null && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
        });
        if (!isFinite(lo)) { lo = 0; hi = 10; }
        if (hi - lo < 5) hi = lo + 5;
        lo = Math.floor(lo * 0.9); hi = Math.ceil(hi * 1.1);
      }
      x.strokeStyle = PAL.grid2;
      x.beginPath(); x.moveTo(padL, y1 + .5); x.lineTo(w - 8, y1 + .5); x.stroke();
      x.fillStyle = s.c; x.font = '600 10px "Barlow Semi Condensed", sans-serif';
      x.textAlign = 'left'; x.globalAlpha = .9;
      x.fillText(s.label, padL + 4, y0 + 2); x.globalAlpha = 1;
      x.fillStyle = PAL.axis; x.textAlign = 'right'; x.font = '9px "Barlow Semi Condensed", sans-serif';
      x.fillText(String(Math.round(hi)), padL - 4, y0 + 6);
      x.fillText(String(Math.round(lo)), padL - 4, y1);
      [[s.key, s.c, 1.5], [s.k2, s.c2, 1]].forEach(function (pair) {
        if (!pair[0]) return;
        x.strokeStyle = pair[1]; x.lineWidth = PAL.glow ? pair[2] + 0.5 : pair[2]; x.beginPath();
        var st = false;
        d.forEach(function (p) {
          var v = p[pair[0]];
          if (v == null || !isFinite(v)) { st = false; return; }
          var px2 = padL + (p.t - t0) / span * (w - padL - 10);
          var py2 = y1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (y1 - y0 - 6);
          if (!st) { x.moveTo(px2, py2); st = true; } else x.lineTo(px2, py2);
        });
        x.stroke();
      });
    });
    x.fillStyle = PAL.axis; x.textAlign = 'center'; x.font = '9px "Barlow Semi Condensed", sans-serif';
    x.fillText('直近 ' + Math.round(span / 60) + ' 分', w / 2, h - 3);
  }

  /* ===================== 肺の 3D ビュー =====================
   * 波形と同じ枠に入る 4 番目の画面。lung3d.js が engine.js の実測値だけを見て描くので、
   * ここはタブの出し入れと HUD の文字を作るだけ。ダイヤルは普段どおり効くので、
   * PEEP や吸気圧を回すとその場で肺の膨らみと肺胞が変わる。 */
  var LUNG = { view: null, gain: 2.5, hudT: 0, lastHud: '' };

  function setScreen(id) {
    S.screen = id;
    var box = $('lung'), cv = $('scope');
    if (id === 'lung') {
      box.hidden = false; cv.style.visibility = 'hidden';
      if (!LUNG.view && LU) {
        LUNG.view = LU.create($('lungStage'));
        LUNG.view.exaggerate = LUNG.gain;
        bindLungChips();
      }
      if (LUNG.view) { LUNG.view.resize(); syncLungChips(); }
      lessonEvent('screen:lung');
    } else {
      box.hidden = true; cv.style.visibility = '';
    }
    syncTabs();
  }

  function bindLungChips() {
    $('lungGain').onclick = function () {
      LUNG.gain = LUNG.gain > 1 ? 1 : 2.5;
      if (LUNG.view) LUNG.view.exaggerate = LUNG.gain;
      syncLungChips();
    };
    $('lungSpin').onclick = function () {
      if (!LUNG.view) return;
      LUNG.view.spin = !LUNG.view.spin;
      syncLungChips();
    };
  }
  function syncLungChips() {
    var g = $('lungGain'), sp = $('lungSpin');
    g.textContent = LUNG.gain > 1 ? '動き ×2.5' : '動き 実寸';
    g.classList.toggle('on', LUNG.gain > 1);
    sp.classList.toggle('on', !!(LUNG.view && LUNG.view.spin));
  }

  function fmtVol(l) {
    var ml = l * 1000;
    return ml < 100 ? ml.toFixed(1) : Math.round(ml).toString();
  }

  function drawLung(real) {
    if (!LUNG.view || !LU) return;
    var mo = LU.readModel(S.eng);
    LUNG.view.update(mo, real, S.speed);

    // HUD は毎フレーム書き換えると読めないので 6 Hz に落とす
    LUNG.hudT += real;
    if (LUNG.hudT < 0.16) return;
    LUNG.hudT = 0;

    var e = S.eng;
    $('lungWho').innerHTML = '<b>' + esc(S.scen.title) + '</b>'
      + '<i>' + esc(mo.ageLabel) + '　' + mo.kg + ' kg　'
      + '肺の高さ ' + mo.heightCm.toFixed(0) + ' cm（実寸）'
      + (LUNG.view.gl ? '' : '　／ 2D 表示') + '</i>';

    function row(k, v, u, tone) {
      return '<div><s>' + k + '</s><em' + (tone ? ' style="color:' + tone + '"' : '') + '>'
        + v + '</em><u>' + (u || '') + '</u></div>';
    }
    var P = PAL;
    var ratioTone = function (r, hiBad) {
      if (hiBad) return r > 2.5 ? P.crit : (r > 1.5 ? P.warn : P.good);
      return r < 0.5 ? P.crit : (r < 0.8 ? P.warn : P.good);
    };
    var cT = ratioTone(mo.cRatio, false), rT = ratioTone(mo.rRatio, true);
    // 狭い画面では行を間引く（画面はスクロールしないので、入る分だけ出す）
    var tight = (LUNG.view.w || 999) < 430;
    var rows = tight ? [
      row('ガス量', fmtVol(mo.gas), 'mL'),
      row('TLC まで', Math.round(mo.fill * 100) + '%', ''),
      row('コンプライアンス', '×' + mo.cRatio.toFixed(2), '', cT),
      row('気道抵抗', '×' + mo.rRatio.toFixed(1), '', rT),
      row('総 PEEP', (mo.peep + mo.autoPeep).toFixed(1), 'cmH2O', mo.autoPeep > 2 ? P.warn : null),
      row('つぶれた肺胞', Math.round(mo.collapse * 100) + '%', '', mo.collapse > 0.3 ? P.warn : null)
    ] : [
      row('肺のガス量', fmtVol(mo.gas), 'mL'),
      row('FRC', fmtVol(mo.frc), 'mL'),
      row('TLC まで', Math.round(mo.fill * 100) + '%', ''),
      row('コンプライアンス', mo.cPerKg.toFixed(2), 'mL/cmH2O/kg', cT),
      row('　正常比', '×' + mo.cRatio.toFixed(2), '', cT),
      row('気道抵抗', Math.round(mo.R), 'cmH2O/L/s', rT),
      row('　正常比', '×' + mo.rRatio.toFixed(1), '', rT),
      row('総 PEEP', (mo.peep + mo.autoPeep).toFixed(1), 'cmH2O', mo.autoPeep > 2 ? P.warn : null),
      row('auto-PEEP', mo.autoPeep.toFixed(1), 'cmH2O', mo.autoPeep > 2 ? P.warn : null),
      row('つぶれた肺胞', Math.round(mo.collapse * 100) + '%', '', mo.collapse > 0.3 ? P.warn : null),
      row('SpO2', Math.round(e.spo2) + '%', '')
    ];
    $('lungFacts').innerHTML = rows.join('');

    // 運動方程式の 3 項。engine.js の式そのままで、和が気道内圧になる。
    var tm = LU.termsOf(mo);
    var span = Math.max(12, Math.abs(mo.paw) + 6, Math.abs(tm.resistive) + 4);
    function bar(k, v, u, col) {
      var frac = Math.max(-1, Math.min(1, v / span));
      var left = frac >= 0 ? 50 : 50 + frac * 50;
      return '<div class="eqi"><div class="eqk">' + k + '</div>'
        + '<div class="eqv">' + (v >= 0 ? '' : '−') + Math.abs(v).toFixed(1)
        + '<u style="font-size:8.5px;opacity:.7"> ' + u + '</u></div>'
        + '<div class="eqb"><i style="left:' + left.toFixed(1) + '%;width:'
        + (Math.abs(frac) * 50).toFixed(1) + '%;background:' + col + '"></i></div></div>';
    }
    $('lungEq').innerHTML =
      bar(tight ? '弾性 V/C' : '弾性 V/C（肺胞圧）', tm.elastic, 'cmH2O', PAL.vol) +
      bar('抵抗 R·V̇', tm.resistive, 'cmH2O', PAL.flow) +
      bar('筋 −Pmus', tm.muscular, 'cmH2O', PAL.spo2) +
      bar(tight ? '＝ Paw' : '＝ 気道内圧 Paw', mo.paw, 'cmH2O', PAL.paw);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ===================== ダイアログ ===================== */
  function modal(title, build, opts) {
    opts = opts || {};
    var host = $('modals');
    var back = el('div', 'modal'), box = el('div', 'mbox'), head = el('div', 'mhead');
    head.appendChild(el('h3', '', title));
    if (!opts.noClose) {
      var cb = el('button', '', '閉じる');
      cb.onclick = function () { if (back.parentNode) host.removeChild(back); };
      head.appendChild(cb);
    }
    var body = el('div', 'mbody');
    box.appendChild(head); box.appendChild(body); back.appendChild(box); host.appendChild(back);
    build(body, function () { if (back.parentNode) host.removeChild(back); });
    return back;
  }

  function openDisclaimer(first, onAgree) {
    modal('ご利用にあたって', function (b, close) {
      b.innerHTML = '<p>本アプリは人工呼吸管理を学ぶための<b>教育用シミュレーター</b>です。'
        + '実在の医療機器ではなく、表示される数値や反応は学習のために単純化した計算に基づきます。</p>'
        + '<p>実際の患者の診療判断、投薬、機器設定には使用できません。臨床では必ず施設の手順と指導医の指示に従ってください。</p>'
        + '<p class="note">モデル：単一コンパートメント肺（コンプライアンス＋気道抵抗）に各換気モードの制御則を重ねたもの。'
        + 'ガス交換はシャント式と酸素解離曲線、腎性代償は時定数 90 分で近似しています。</p>';
      var r = el('div', 'mrow');
      var ok = el('button', 'mbtn go', first ? '同意して始める' : '閉じる');
      ok.onclick = function () { close(); if (onAgree) onAgree(); };
      r.appendChild(ok); b.appendChild(r);
    }, { noClose: true });
  }

  /* 症例の重さ。カードの患者の顔色に使う。 */
  var PATIENT_TONE = { postop: 'ok', rds: 'mid', bronchiolitis: 'mid', ards: 'bad', asthma: 'bad', gbs: 'ok' };

  function openCases() {
    modal('症例を選ぶ', function (b, close) {
      b.appendChild(el('p', '', '症例ごとに肺の硬さ・気道抵抗・シャント・呼吸ドライブが異なります。設定を変えると波形と血液ガスがその場で応答します。'));
      var g = el('div', 'grid2');
      SC.SCENARIOS.forEach(function (sc) {
        var c = el('button', 'case');
        var head = el('div', 'casehead');
        var face = el('div', 'face');
        face.style.backgroundImage = 'url("' + patientArt(sc, patientBaseTone(sc), currentTheme() === 'device') + '")';
        var ct = el('div', 'ct');
        ct.appendChild(el('i', '', sc.tag));
        ct.appendChild(el('b', '', sc.title));
        head.appendChild(face); head.appendChild(ct);
        c.appendChild(head);
        c.appendChild(el('span', '', sc.oneLine));
        c.onclick = function () { close(); loadScenario(sc, true); };
        g.appendChild(c);
      });
      b.appendChild(g);
    });
  }

  function openSetup() {
    var sc = S.scen, e = S.eng;
    modal(sc.title + '｜初期設定', function (b, close) {
      var pbw = e.p.pbw;
      b.appendChild(el('p', '', sc.history));
      var g = el('div', 'grid2');
      sc.findings.forEach(function (f) {
        var r = el('div', 'row'); r.appendChild(el('span', '', f)); g.appendChild(r);
      });
      b.appendChild(g);
      var nm = e.nm, vk = nm.vtPerKg;
      var rd = function (v) { return pbw < 6 ? v.toFixed(1) : String(Math.round(v)); };
      var box = el('div', 'tip');
      box.innerHTML = '体重 <b>' + (pbw < 10 ? pbw.toFixed(1) : String(Math.round(pbw))) + ' kg</b>'
        + '（' + (sc.patient.ageLabel || nm.label) + '）　'
        + '一回換気量 ' + vk[0] + '〜' + vk[1] + ' mL/kg なら <b>'
        + rd(pbw * vk[0]) + '〜' + rd(pbw * vk[1]) + ' mL</b>。<br>'
        + 'この年齢の呼吸数は ' + nm.rr[0] + '〜' + nm.rr[1] + ' /分、'
        + 'プラトー圧は ' + nm.platMax + ' cmH₂O 以下、SpO₂ 目標は ' + nm.spo2[0] + '〜' + nm.spo2[1] + '%。<br>'
        + '学習の狙い：' + sc.teaching.join(' ／ ');
      b.appendChild(box);
      var note = el('p', 'note', '下段のキーで項目を選び、ダイヤルを回して「確定」で反映します。');
      note.style.marginTop = '10px'; b.appendChild(note);
      var r = el('div', 'mrow');
      var a = el('button', 'mbtn go', '推奨初期設定で開始');
      a.onclick = function () {
        var sg = sc.suggested;
        for (var k in sg) if (Object.prototype.hasOwnProperty.call(sg, k)) e.s[k] = sg[k];
        buildKeys(); syncTabs(); paintDial(); close();
      };
      var c = el('button', 'mbtn', '自分で設定する');
      c.onclick = close;
      r.appendChild(a); r.appendChild(c); b.appendChild(r);
    });
  }

  function openABG(g) {
    var e = S.eng, go = e.p.goals || {}, ab = e.nm.abg;
    function rng(v, r) { return !r ? '' : ((v < r[0] || v > r[1]) ? 'bad' : 'goodv'); }
    function txt(r, u) { return r[0] + '–' + r[1] + (u ? ' ' + u : ''); }
    modal('血液ガス分析（' + (e.p.ageLabel || e.nm.label) + '）', function (b, close) {
      var t = el('table', 'abg');
      [['pH', g.ph.toFixed(2), txt(ab.ph), rng(g.ph, go.ph || ab.ph)],
       ['PaCO₂', g.paco2.toFixed(1), txt(ab.paco2, 'mmHg'), rng(g.paco2, go.paco2 || ab.paco2)],
       ['PaO₂', String(Math.round(g.pao2)), txt(ab.pao2, 'mmHg'), rng(g.pao2, go.pao2 || ab.pao2)],
       ['HCO₃⁻', g.hco3.toFixed(1), txt(ab.hco3, 'mEq/L'), ''],
       ['BE', g.be.toFixed(1), '−2〜+2', ''],
       ['SaO₂', g.sao2.toFixed(1) + ' %', e.nm.spo2[0] + '–' + e.nm.spo2[1] + ' %', ''],
       ['乳酸', g.lactate.toFixed(1), '< 2.0 mmol/L', g.lactate > 2 ? 'bad' : ''],
       ['P/F 比', String(Math.round(g.pf)), 'FiO₂ ' + Math.round(g.fio2 * 100) + '% ／ PEEP ' + g.peep, g.pf < 200 ? 'bad' : '']
      ].forEach(function (r) {
        var tr = document.createElement('tr');
        tr.appendChild(el('td', '', r[0]));
        tr.appendChild(el('td', r[3], r[1]));
        tr.appendChild(el('td', '', r[2]));
        t.appendChild(tr);
      });
      b.appendChild(t);
      b.appendChild(interpret(g, e));
      var r2 = el('div', 'mrow');
      var c = el('button', 'mbtn go', '設定に戻る'); c.onclick = close;
      r2.appendChild(c); b.appendChild(r2);
    });
  }

  function interpret(g, e) {
    var msgs = [], ab = e.nm.abg, pm = e.nm.platMax;
    if (g.ph < ab.ph[0] && g.paco2 > ab.paco2[1]) msgs.push('呼吸性アシドーシス。換気量が足りていません。分時換気量（Vt または RR）を上げることを検討します。ただし auto-PEEP と Pplat に注意。');
    else if (g.ph > ab.ph[1] && g.paco2 < ab.paco2[0]) msgs.push('呼吸性アルカローシス。過換気です。RR か Vt を下げます。');
    else if (g.ph < ab.ph[0] && g.hco3 < ab.hco3[0]) msgs.push('代謝性アシドーシス。原因（循環不全・敗血症・腎不全など）の検索が要ります。呼吸での代償を妨げない設定に。');
    else msgs.push('酸塩基は概ね目標域です。');
    if (g.pf < 150) msgs.push('P/F 比 ' + Math.round(g.pf) + '。酸素化が悪く、PEEP を上げてリクルートメントを図る場面です。');
    else if (g.fio2 > 0.5 && g.pao2 > ab.pao2[1]) msgs.push('PaO₂ に余裕があります。FiO₂ を下げて酸素毒性（未熟児網膜症や気管支肺異形成の一因）を避けます。');
    if (e.m.pplat != null && e.m.pplat > pm) msgs.push('Pplat ' + Math.round(e.m.pplat) + ' cmH₂O。この年齢の目安 ' + pm + ' を超えています。Vt を減らすか PEEP を見直してください。');
    if (e.m.autoPeep > 3) msgs.push('auto-PEEP ' + e.m.autoPeep.toFixed(1) + ' cmH₂O。呼気時間が不足しています。RR を下げるか吸気時間を短くします。');
    var d = el('div', 'tip' + (g.ph < 7.30 || g.pf < 150 ? ' bad' : ''));
    d.innerHTML = msgs.join('<br>');
    return d;
  }

  function openWeaning() {
    var e = S.eng;
    lessonEvent('weaning:open');
    if (e.extubated) { openDebrief(); return; }
    modal('離脱（weaning）', function (b, close) {
      var list = SC.weaningReadiness(e);
      b.appendChild(el('p', '', 'SBT（自発呼吸トライアル）を始める前に、離脱の条件が揃っているかを確認します。'));
      list.forEach(function (c) {
        var r = el('div', 'row');
        r.appendChild(el('span', 'mk ' + (c.ok ? 'y' : 'n'), c.ok ? '✓' : '×'));
        r.appendChild(el('span', '', c.label));
        r.appendChild(el('span', 'rv', String(c.val)));
        b.appendChild(r);
      });
      var nOk = list.filter(function (c) { return c.ok; }).length;
      var tip = el('div', 'tip' + (nOk === list.length ? '' : ' bad'));
      tip.textContent = nOk === list.length
        ? '条件は揃っています。PS 5 / PEEP 5 で 30 分の SBT を行います。'
        : (list.length - nOk) + ' 項目が未達です。このまま行うと失敗しやすくなります（学習のため実施は可能）。';
      b.appendChild(tip);
      var r2 = el('div', 'mrow');
      if (!S.sbt || S.sbt.done) {
        var go = el('button', 'mbtn go', 'SBT を開始（30分）');
        go.onclick = function () { close(); startSBT(); };
        r2.appendChild(go);
      } else {
        var st = el('button', 'mbtn warn', 'SBT を中止');
        st.onclick = function () { close(); S.sbt = null; restoreSettings(); };
        r2.appendChild(st);
      }
      if (S.sbt && S.sbt.done === 'pass') {
        var ex = el('button', 'mbtn go', '抜管する');
        ex.onclick = function () { close(); doExtubate(); };
        r2.appendChild(ex);
      }
      var dbg = el('button', 'mbtn', '振り返りを見る');
      dbg.onclick = function () { close(); openDebrief(); };
      r2.appendChild(dbg);
      b.appendChild(r2);
    });
  }

  function openSBTResult() {
    var b2 = S.sbt;
    modal(b2.done === 'pass' ? 'SBT 成功' : 'SBT 失敗', function (b, close) {
      if (b2.done === 'pass') {
        b.appendChild(el('p', '', '30 分の自発呼吸トライアルを、呼吸回数・酸素化・循環を保ったまま完遂しました。抜管を検討できます。'));
        var t = el('div', 'tip');
        t.textContent = 'f/VT ' + (S.eng.m.rsbiKg == null ? '––' : S.eng.m.rsbiKg.toFixed(1))
          + '、呼吸回数 ' + Math.round(S.eng.m.rrTotal) + ' /分。';
        b.appendChild(t);
        var r = el('div', 'mrow');
        var ex = el('button', 'mbtn go', '抜管する'); ex.onclick = function () { close(); doExtubate(); };
        var wk = el('button', 'mbtn', 'もう少し様子を見る'); wk.onclick = close;
        r.appendChild(ex); r.appendChild(wk); b.appendChild(r);
      } else {
        b.appendChild(el('p', '', 'SBT を中断しました。設定は元に戻しています。'));
        var t2 = el('div', 'tip bad'); t2.textContent = '中断の理由：' + b2.failMsg;
        b.appendChild(t2);
        b.appendChild(el('p', 'note', '失敗の多くは呼吸筋疲労・循環負荷・酸塩基の異常が背景にあります。原因を直してから再挑戦してください。'));
        var r2 = el('div', 'mrow');
        var ok = el('button', 'mbtn go', '換気に戻る'); ok.onclick = close;
        r2.appendChild(ok); b.appendChild(r2);
      }
    });
  }

  function doExtubate() {
    var e = S.eng;
    var list = SC.weaningReadiness(e);
    var nOk = list.filter(function (c) { return c.ok; }).length;
    var sbtPass = !!(S.sbt && S.sbt.done === 'pass');
    var ok = sbtPass && nOk >= list.length - 1;
    e.extubated = true;
    S.extubated = { ok: ok, nOk: nOk, total: list.length, sbtPass: sbtPass };
    if (e._note) e._note(ok ? '抜管（成功）' : '抜管（再挿管）');
    lessonEvent('extubate');
    modal(ok ? '抜管：成功' : '抜管：再挿管', function (b, close) {
      if (ok) {
        b.appendChild(el('p', '', '抜管後も呼吸回数と酸素化は安定しています。酸素投与を続けながら経過を見ます。'));
      } else {
        b.appendChild(el('p', '', '抜管後まもなく呼吸努力が強まり、酸素化が悪化しました。再挿管が必要です。'));
        var t = el('div', 'tip bad');
        t.textContent = sbtPass
          ? '離脱条件のうち ' + (list.length - nOk) + ' 項目が未達のままでした。'
          : 'SBT を通していませんでした。';
        b.appendChild(t);
      }
      var r = el('div', 'mrow');
      var d = el('button', 'mbtn go', '振り返りを見る');
      d.onclick = function () { close(); openDebrief(); };
      r.appendChild(d); b.appendChild(r);
    });
  }

  function openDebrief() {
    var e = S.eng;
    var tgt = e.timeInTarget.total > 0 ? e.timeInTarget.ok / e.timeInTarget.total : 0;
    var mins = e.clock / 60;
    var harmS = (e.harm.highPlat + e.harm.highVt + e.harm.autoPeep) / 60;
    var advS = (e.harm.hypoxia + e.harm.hypotension) / 60;
    var harmPen = Math.min(25, harmS * 2.2);
    var advPen = Math.min(20, advS * 3.2 + e.harm.highFio2 / 60 * 0.8);
    var weanPts = S.extubated ? (S.extubated.ok ? 15 : 6) : (S.sbt && S.sbt.done === 'pass' ? 10 : 0);
    var score = Math.max(0, Math.round(tgt * 40 + (25 - harmPen) + (20 - advPen) + weanPts));
    modal('振り返り', function (b, close) {
      var top = el('div', 'row'); top.style.alignItems = 'baseline';
      var sn = el('div', 'score', String(score));
      sn.style.color = score >= 80 ? PAL.good : (score >= 60 ? PAL.warn : PAL.crit);
      top.appendChild(sn);
      top.appendChild(el('span', '', '／ 100　経過 ' + Math.round(mins) + ' 分'));
      b.appendChild(top);
      [['目標域にいた時間', Math.round(tgt * 100) + '%', Math.round(tgt * 40) + ' / 40'],
       ['肺保護（Pplat・Vt・auto-PEEP）', Math.round(harmS) + ' 分の逸脱', Math.round(25 - harmPen) + ' / 25'],
       ['有害事象（低酸素・低血圧・高 FiO₂）', Math.round(advS) + ' 分', Math.round(20 - advPen) + ' / 20'],
       ['離脱・抜管', S.extubated ? (S.extubated.ok ? '抜管成功' : '再挿管') : (S.sbt && S.sbt.done === 'pass' ? 'SBT 成功' : '未実施'), weanPts + ' / 15']
      ].forEach(function (r) {
        var n = el('div', 'row');
        n.appendChild(el('span', '', r[0]));
        n.appendChild(el('span', 'rv', r[1] + '　' + r[2]));
        b.appendChild(n);
      });
      var cv = el('canvas', 'chart'); b.appendChild(cv);
      setTimeout(function () { drawDebriefChart(cv); }, 0);
      if (e.events && e.events.length) {
        var h = el('p', 'note', '操作の記録'); h.style.marginTop = '10px'; b.appendChild(h);
        var box = el('div');
        box.style.maxHeight = '150px'; box.style.overflow = 'auto';
        e.events.slice(-24).forEach(function (ev) {
          var r = el('div', 'row');
          r.appendChild(el('span', '', ev.msg));
          r.appendChild(el('span', 'rv', Math.floor(ev.t / 60) + ':' + String(Math.floor(ev.t % 60)).padStart(2, '0')));
          box.appendChild(r);
        });
        b.appendChild(box);
      }
      var r3 = el('div', 'mrow');
      var again = el('button', 'mbtn go', '別の症例を選ぶ');
      again.onclick = function () { close(); openCases(); };
      var back = el('button', 'mbtn', '閉じる'); back.onclick = close;
      r3.appendChild(again); r3.appendChild(back); b.appendChild(r3);
    });
  }

  function drawDebriefChart(cv) {
    var d = window.devicePixelRatio || 1;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    var x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
    x.fillStyle = PAL.bg; x.fillRect(0, 0, w, h);
    var t = S.trend;
    if (t.length < 2) {
      x.fillStyle = PAL.faint; x.textAlign = 'center'; x.font = '11px sans-serif';
      x.fillText('データ不足', w / 2, h / 2); return;
    }
    var t0 = t[0].t, t1 = t[t.length - 1].t, span = Math.max(60, t1 - t0);
    var padL = 40, padR = 66, padT = 12, padB = 18;
    [{ k: 'pip', c: PAL.paw, lab: 'PIP', lo: 0, hi: 45 },
     { k: 'vte', c: PAL.vol, lab: 'Vte', lo: 0, hi: Math.max(10, S.eng.p.pbw * 12) },
     { k: 'spo2', c: PAL.spo2, lab: 'SpO₂', lo: 75, hi: 100 }
    ].forEach(function (s, i) {
      x.strokeStyle = s.c; x.lineWidth = PAL.glow ? 2 : 1.4; x.beginPath();
      var st = false;
      t.forEach(function (p) {
        var v = p[s.k];
        if (v == null || !isFinite(v)) { st = false; return; }
        var px = padL + (p.t - t0) / span * (w - padL - padR);
        var py = h - padB - (Math.max(s.lo, Math.min(s.hi, v)) - s.lo) / (s.hi - s.lo) * (h - padT - padB);
        if (!st) { x.moveTo(px, py); st = true; } else x.lineTo(px, py);
      });
      x.stroke();
      x.fillStyle = s.c; x.textAlign = 'right'; x.font = '10px "Barlow Semi Condensed", sans-serif';
      x.fillText(s.lab, w - 6, padT + 12 + i * 14);
    });
    x.fillStyle = PAL.axis; x.textAlign = 'center'; x.font = '9px "Barlow Semi Condensed", sans-serif';
    x.fillText('0 分', padL, h - 5);
    x.fillText(Math.round(span / 60) + ' 分', w - padR, h - 5);
  }

  function openMenu() {
    modal('メニュー', function (b, close) {
      var g = el('div', 'grid2');
      [['☰', '学習コース', function () { close(); openCourse(); }],
       ['✚', '症例を選ぶ', function () { close(); openCases(); }],
       ['⟳', '初期設定をやり直す', function () { close(); openSetup(); }],
       ['↺', 'この症例を最初から', function () { close(); loadScenario(S.scen, false); }],
       ['★', '振り返り', function () { close(); openDebrief(); }],
       ['⌂', 'タイトルへ戻る', function () { close(); endLesson(false); showTitle(); }],
       ['?', 'この教材について', function () { close(); openDisclaimer(false); }]
      ].forEach(function (p) {
        var c = el('button', 'case menuitem');
        c.appendChild(el('span', 'em', p[0]));
        c.appendChild(el('b', '', p[1]));
        c.onclick = p[2];
        g.appendChild(c);
      });
      b.appendChild(g);
      var n = el('p', 'note', '「学習コース」は呼吸器の操作を 1 から順に学ぶモードです。'
        + '「× 1 / × 10 / × 60」はシミュレーター側の早送りで（× 1 が実時間）、血液ガスは採血から 2 分後に返ります。');
      n.style.marginTop = '10px'; b.appendChild(n);
    });
  }

  /* ===================== 学習コース ===================== */
  /* 帯は機器の画面の下に出す。実機の操作をそのまま課題にするので、モーダルでは塞がない。 */

  var DONE_KEY = 'ventsim.lessons.done.v1';

  function doneSet() {
    try {
      var raw = window.localStorage.getItem(DONE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) { return []; }
  }
  function markDone(id) {
    try {
      var d = doneSet();
      if (d.indexOf(id) < 0) { d.push(id); window.localStorage.setItem(DONE_KEY, JSON.stringify(d)); }
    } catch (err) { /* プライベートブラウズなどでは記録できない。進行自体は続けられる。 */ }
  }

  /* ---- 注目の光 ----
   * 課題が「どこを押すか」「どこを見るか」を指すとき、文章で場所を説明せずに現物を光らせる。
   * spec は 'key:vt' / 'val:Pplat' / 'hard:kInsp' / 'mode:PC-AC' / 'screen:wave' / 'dial' / 'wave'。 */
  var spotted = [];

  function spotEls(spec) {
    var out = [];
    (Array.isArray(spec) ? spec : [spec]).forEach(function (one) {
      if (!one) return;
      var i = one.indexOf(':');
      var kind = i < 0 ? one : one.slice(0, i), arg = i < 0 ? '' : one.slice(i + 1), n;
      if (kind === 'key') { if (keyNodes[arg]) out.push(keyNodes[arg].b); }
      else if (kind === 'val') {
        valNodes.forEach(function (o) { if (o.d.k === arg) out.push(o.n); });
      } else if (kind === 'hard') { n = $(arg); if (n) out.push(n); }
      else if (kind === 'mode' || kind === 'screen') {
        var key = kind === 'mode' ? 'mode' : 'scr';
        Array.prototype.forEach.call($('tabs').children, function (b) {
          if (b.dataset[key] === arg) out.push(b);
        });
      } else if (kind === 'dial') { n = $('knob'); if (n) out.push(n); }
      else if (kind === 'wave') { n = $('scopewrap'); if (n) out.push(n); }
    });
    return out;
  }

  function applySpot(spec) {
    spotted.forEach(function (n) { n.classList.remove('spot'); delete n.dataset.spot; });
    spotted = spec ? spotEls(spec) : [];
    spotted.forEach(function (n) { n.classList.add('spot'); n.dataset.spot = '1'; });
  }

  /* ---- 課題に関係する計測値だけを帯にも出す ---- */
  function watchRead(list) {
    if (!list || !list.length) return null;
    var e = S.eng, out = [];
    list.forEach(function (k) {
      for (var i = 0; i < VALS.length; i++) {
        if (VALS[i].k === k) { out.push({ k: k, u: VALS[i].u, v: VALS[i].get(e) }); return; }
      }
    });
    return out.length ? out : null;
  }

  function watchHtml(now, before) {
    var h = '';
    for (var i = 0; i < now.length; i++) {
      var a = before && before[i] && before[i].k === now[i].k ? before[i].v : null;
      var chg = a != null && a !== now[i].v;
      h += '<div class="w' + (chg ? ' chg' : '') + '"><b>' + esc(now[i].k) + '</b>'
        + (a != null ? '<em>' + esc(a) + ' →</em>' : '')
        + '<span>' + esc(now[i].v) + '</span><i>' + esc(now[i].u) + '</i></div>';
    }
    return h;
  }

  function paintWatch() {
    var L = S.lesson, box = $('cWatch');
    if (!L) { box.hidden = true; return; }
    var fb = (L.mode === 'feedback' || L.mode === 'done');
    var now = watchRead(L.curWatch);
    if (!now) { if (!box.hidden) { box.hidden = true; box.innerHTML = ''; } return; }
    var h = watchHtml(now, fb ? L.snap : null);
    if (box._h !== h) { box._h = h; box.innerHTML = h; }
    box.hidden = false;
  }

  function lessonCtx() {
    var e = S.eng;
    return {
      e: e, s: e.s, m: e.m, pbw: e.p.pbw,
      abgs: S.abgs, lastAbg: S.abgs.length ? S.abgs[S.abgs.length - 1] : null,
      sbt: S.sbt, mem: null
    };
  }

  function startLesson(id) {
    var lesson = LS.lessonById(id);
    if (!lesson) return;
    var sc = SC.SCENARIOS.filter(function (x) { return x.id === lesson.scenario; })[0] || SC.SCENARIOS[0];
    loadScenario(sc, false, true);
    var st = lesson.settings || {};
    for (var k in st) if (Object.prototype.hasOwnProperty.call(st, k)) S.eng.s[k] = st[k];
    if (lesson.sedation != null) S.eng.sedation = lesson.sedation;
    S.eng._recomputeDrive();
    setScreen('wave');
    S.lesson = {
      id: id, lesson: lesson, chap: LS.chapterOf(id),
      rt: new LS.Runtime(lesson), mode: 'task', sig: '',
      tix: -1, curWatch: null, snap: null, spot: null
    };
    var cb = $('coach');
    cb.hidden = false;
    cb.classList.remove('collapsed');
    cb.setAttribute('data-chap', S.lesson.chap ? S.lesson.chap.id : 'ch1');
    $('kLearn').classList.add('on');
    buildKeys(); syncTabs(); paintDial(); fitAll();
  }

  function endLesson(silent) {
    if (!S.lesson) return;
    applySpot(null);
    S.lesson = null;
    $('coach').hidden = true;
    $('cWatch').hidden = true; $('cWatch')._h = '';
    $('kLearn').classList.remove('on');
    if (!silent) fitAll();
  }

  function lessonEvent(name) {
    var L = S.lesson;
    if (!L || L.mode !== 'task') return;
    var r = L.rt.fire(name, lessonCtx());
    if (r) afterAdvance(r);
  }

  function lessonTick(simSec) {
    var L = S.lesson;
    if (!L || L.mode !== 'task') return;
    var r = L.rt.poll(lessonCtx(), simSec);
    if (r) afterAdvance(r);
  }

  function afterAdvance(r) {
    var L = S.lesson;
    if (r.finished) {
      var first = doneSet().indexOf(L.id) < 0;
      markDone(L.id);
      L.mode = 'done';
      var n = doneSet().filter(function (id) { return LS.lessonById(id); }).length;
      var all = LS.allLessons().length;
      if (n >= all) celebrate('全レッスン修了！おめでとう 🏆');
      else if (first) celebrate('レッスン修了！ ' + n + ' / ' + all + ' 🎉');
      else celebrate('レッスン修了！ 🎉');
    }
    else L.mode = (r.why ? 'feedback' : 'task');
    L.fb = r.why || '';
    L.sig = '';
  }

  function bindCoach() {
    $('cToggle').onclick = function () {
      var c = $('coach');
      c.classList.toggle('collapsed');
      $('cToggle').textContent = c.classList.contains('collapsed') ? '▸' : '▾';
      fitAll();
    };
    $('cBrief').onclick = openBrief;
    $('cQuit').onclick = function () { endLesson(false); };
  }

  /* 話し手。ぷくぷくが学習者の代わりに「なんで？」と聞き、みどり先生が答える。
   * 説明を一方的に読ませるより、この往復のほうが頭に残る。 */
  var WHO_NAME = { doc: 'みどり先生', puku: 'ぷくぷく', pt: '患者・家族', scene: '' };

  function paintSpeaker(who, mood) {
    var av = $('cAv'), dark = currentTheme() === 'device';
    av.className = 'cav ' + (who === 'scene' ? 'none' : (who || 'doc'));
    if (who === 'scene') { av.innerHTML = ''; return; }
    var src;
    if (who === 'puku') src = AS.url('mascot_' + mood) || AS.url('mascot_happy') || AR.mascot(dark, false);
    else if (who === 'pt') src = patientArt(S.scen, patientTone(S.eng), dark);
    else src = AR.face(mood, dark);
    av.innerHTML = '<img alt="" src="' + src + '">';
  }

  /* 課題・解説・クイズの描画。毎フレーム呼ばれるので、中身が変わったときだけ差し替える。 */
  /* 先生の表情。正解や修了では笑い、クイズでは考え、誤答では困る。 */
  function coachMood(L, t) {
    if (L.mode === 'task' && t && t.talk) return t.mood || (t.who === 'doc' ? 'normal' : 'happy');
    if (L.mode === 'done' || L.mode === 'feedback') return 'happy';
    if (t && t.quiz) {
      return (L.rt.feedback && L.rt.feedback.ok === false) ? 'sad' : 'think';
    }
    var a = S.eng.alarms || [];
    for (var i = 0; i < a.length; i++) if (a[i].sev === 2) return 'alert';
    return 'normal';
  }

  function paintCoach() {
    var L = S.lesson;
    if (!L) return;
    var rt = L.rt, t = rt.task();
    var say = '', hint = '', choices = null, tone = '', who = '';

    /* 課題が変わった瞬間に、その課題が見るべき計測値を控えておく。
     * 操作のあと「前 → 後」で見せるのが、このコースの説明のしかた。 */
    if (L.mode === 'task' && L.tix !== rt.index) {
      L.tix = rt.index;
      L.curWatch = t ? t.watch : null;
      L.snap = watchRead(L.curWatch);
      L.spot = t ? t.spot : null;
      applySpot(L.spot);
    } else if (L.mode !== 'task' && L.spot) {
      L.spot = null;
      applySpot(null);
    }

    if (L.mode === 'done') {
      say = '🎉 このレッスンは終わりです。' + (rt.wrong ? '' : 'クイズは全問一度で正解でした。');
      tone = 'ok';
      choices = { kind: 'end' };
    } else if (L.mode === 'feedback') {
      say = L.fb; tone = 'ok';
      choices = { kind: 'next' };
    } else if (t && t.talk) {
      /* 会話の場面。押すところは光らせず、話し手と言葉だけを見せる。 */
      say = typeof t.say === 'function' ? t.say(rt.bind(lessonCtx())) : (t.say || '');
      who = t.who || 'doc';
      tone = who === 'scene' ? 'scene' : '';
      choices = { kind: 'talk', label: t.next || '続ける' };
    } else if (t) {
      if (t.quiz) {
        /* 設問も画面の実測値から作れるようにしておく（架空の数字より、いま出ている数字で考えさせる）。 */
        say = typeof t.quiz.q === 'function' ? t.quiz.q(rt.bind(lessonCtx())) : t.quiz.q;
        choices = { kind: 'quiz', list: t.quiz.choices };
        if (rt.feedback && rt.feedback.ok === false) { hint = rt.feedback.text; tone = ''; }
      } else {
        say = typeof t.say === 'function' ? t.say(rt.bind(lessonCtx())) : (t.say || '');
        hint = typeof t.hint === 'function' ? t.hint(rt.bind(lessonCtx())) : (t.hint || '');
      }
    }

    var pr = rt.progress();
    var mood = coachMood(L, t);
    var sig = L.mode + '|' + rt.index + '|' + say + '|' + hint + '|' + tone + '|' + who
      + '|' + (choices ? choices.kind + (choices.list ? choices.list.length : '') : '-')
      + '|' + rt.answered + '|' + mood;
    if (sig !== L.sig) {
      L.sig = sig;
      if (L.mood !== mood || L.who !== who) {
        L.mood = mood; L.who = who;
        paintSpeaker(who, mood);
      }
      $('cTitle').textContent = L.lesson.title;
      $('cChap').textContent = L.chap.tag + '　' + (pr.done + (L.mode === 'done' ? 0 : 1)) + ' / ' + pr.total;
      var dots = $('cDots'); dots.innerHTML = '';
      var acts = L.lesson.tasks, cur = rt.actionIndex();
      for (var i = 0; i < acts.length; i++) {
        if (acts[i].talk) continue;                 // 会話の場面は点にしない
        var d = el('span');
        if (i < rt.index) d.className = 'on';
        else if (i === cur && L.mode === 'task') d.className = 'cur';
        dots.appendChild(d);
      }
      var sayN = $('cSay');
      sayN.textContent = say;
      sayN.className = 'csay' + (tone ? ' ' + tone : '');
      var wn = $('cWho');
      wn.textContent = WHO_NAME[who] || '';
      wn.className = 'cwho ' + (who || 'doc');
      wn.hidden = !wn.textContent;
      var hn = $('cHint'); hn.textContent = hint; hn.hidden = !hint;
      paintChoices(choices);
    }

    paintWatch();

    var prog = $('cProg');
    var needBar = L.mode === 'task' && t && t.hold;
    prog.hidden = !needBar;
    if (needBar) $('cProgBar').style.width = Math.round(rt.holdRatio() * 100) + '%';
  }

  function paintChoices(choices) {
    var box = $('cChoices');
    box.innerHTML = '';
    if (!choices) { box.hidden = true; return; }
    box.hidden = false;
    var L = S.lesson, rt = L.rt;
    if (choices.kind === 'quiz') {
      choices.list.forEach(function (label, i) {
        var b = el('button', '', label);
        if (rt.feedback && rt.feedback.ok === false && rt.answered === i) b.className = 'ng';
        b.onclick = function () {
          var r = rt.answer(i, lessonCtx());
          if (r && r.ok) afterAdvance(r); else L.sig = '';
        };
        box.appendChild(b);
      });
    } else if (choices.kind === 'talk') {
      var tb = el('button', 'cbtn go', choices.label);
      tb.style.flex = '0 0 auto';
      tb.onclick = function () {
        var r = rt.tap(lessonCtx());
        if (r) afterAdvance(r);
      };
      box.appendChild(tb);
    } else if (choices.kind === 'next') {
      var n = el('button', 'cbtn go', '次へ');
      n.style.flex = '0 0 auto';
      n.onclick = function () { L.mode = 'task'; L.sig = ''; };
      box.appendChild(n);
    } else {
      var nid = LS.nextLessonId(L.id);
      if (nid) {
        var nb = el('button', 'cbtn go', '次のレッスンへ');
        nb.style.flex = '0 0 auto';
        nb.onclick = function () { startLesson(nid); };
        box.appendChild(nb);
      }
      var cb = el('button', 'cbtn', 'コース一覧');
      cb.style.flex = '0 0 auto';
      cb.onclick = openCourse;
      box.appendChild(cb);
      var fb = el('button', 'cbtn', 'この症例を自由に操作する');
      fb.style.flex = '0 0 auto';
      fb.onclick = function () { endLesson(false); };
      box.appendChild(fb);
    }
  }

  /* レッスンの解説。読んでから操作に入るので、ここだけはダイアログにする。 */
  function openBrief() {
    var L = S.lesson;
    if (!L) return;
    var l = L.lesson;
    modal(l.title, function (b, close) {
      var cap = el('p', 'note', L.chap.title + '　／　目安 ' + l.minutes + ' 分');
      b.appendChild(cap);
      l.brief.forEach(function (t) { b.appendChild(el('p', '', t)); });
      if (l.points && l.points.length) {
        var tip = el('div', 'tip');
        tip.innerHTML = '<b>このレッスンで覚えること</b><br>・' + l.points.join('<br>・');
        b.appendChild(tip);
      }
      var r = el('div', 'mrow');
      var go = el('button', 'mbtn go', '操作に進む');
      go.onclick = close;
      r.appendChild(go); b.appendChild(r);
    });
  }

  function openCourse() {
    var done = doneSet();
    modal('学習コース', function (b, close) {
      b.appendChild(el('p', '', 'PICU と NICU の 6 人の子どもを受け持ちながら、呼吸器の操作を順に覚えていくコースです。'
        + 'みどり先生とぷくぷくの会話を追っていくと、そのつど実機を触ることになります。上から順に進めるのが基本です。'));
      var n = LS.allLessons().length;
      var nDone = done.filter(function (id) { return LS.lessonById(id); }).length;
      var pct = Math.round(nDone / n * 100);
      var pr = el('div', 'bigprog');
      var bar = el('div', 'bar'), fill = el('i');
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      pr.appendChild(bar);
      pr.appendChild(el('div', 'pct', pct + '%'));
      b.appendChild(pr);
      b.appendChild(el('p', 'note', '修了 ' + nDone + ' / ' + n + ' レッスン'
        + (nDone >= n ? '　🏆 全レッスン修了' : '')));
      LS.CHAPTERS.forEach(function (ch) {
        var chDone = ch.lessons.filter(function (l) { return done.indexOf(l.id) >= 0; }).length;
        var h = el('div', 'chapline');
        h.setAttribute('data-chap', ch.id);
        h.appendChild(el('span', 'cdot'));
        h.appendChild(el('span', '', ch.title));
        h.appendChild(el('span', 'ccount', chDone + ' / ' + ch.lessons.length));
        h.appendChild(el('span', 'csub', ch.sub));
        b.appendChild(h);
        var g = el('div', 'grid2');
        ch.lessons.forEach(function (l, li) {
          var fin = done.indexOf(l.id) >= 0;
          var c = el('button', 'lesson' + (fin ? ' done' : ''));
          c.setAttribute('data-chap', ch.id);
          c.appendChild(el('span', 'mk ' + (fin ? 'y' : 'n'), fin ? '✓' : String(li + 1)));
          var t = el('div', 'lt');
          t.appendChild(el('b', '', l.title));
          t.appendChild(el('span', '', '目安 ' + l.minutes + ' 分'));
          c.appendChild(t);
          c.onclick = function () { close(); startLesson(l.id); };
          g.appendChild(c);
        });
        b.appendChild(g);
      });
      var r = el('div', 'mrow');
      var free = el('button', 'mbtn', 'フリー操作に戻る');
      free.onclick = function () { close(); endLesson(false); };
      r.appendChild(free);
      if (done.length) {
        var rs = el('button', 'mbtn warn', '進捗を消す');
        rs.onclick = function () {
          try { window.localStorage.removeItem(DONE_KEY); } catch (err) { /* 無視 */ }
          close(); openCourse();
        };
        r.appendChild(rs);
      }
      b.appendChild(r);
    });
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
    if (ev.key === 'Enter') commit();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
