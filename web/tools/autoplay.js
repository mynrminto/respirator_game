/* レッスンを頭から最後まで、機械で通しプレイする。
 *   node web/tools/autoplay.js            … 全レッスン
 *   node web/tools/autoplay.js 7-1 9-2    … 指定したレッスンだけ
 * 画面（app.js）の代わりに、採血の 2 分待ち・SBT の判定・100% O₂ の 2 分・抜管を同じ規則で持ち、
 * 「操作の課題」は SOLVE に書いた手順（プレイヤーがダイヤルで回す値）で解く。
 * ダイヤルの可動域（engine の limitsFor）を外れる値は使えない。
 * 目的は「その課題が、この症例のエンジンで本当に達成できるか」を確かめること。
 * test.js の 27 番がこれを呼ぶ。 */
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'engine.js'));
const SC = require(path.join(__dirname, '..', 'scenarios.js'));
const LS = require(path.join(__dirname, '..', 'lessons.js'));

/* ---- プレイヤーの手順 ----
 * キーはレッスン ID、値は課題の say（指示文）の書き出しと、そこで回す値。
 * set: { vt: 84, rr: 30 } の形で設定を回す。sed は鎮静（0〜1）。
 * wait: 秒 … 条件が満たされるまでの上限（既定 900 秒）。 */
const SOLVE = {
  '7-1': [
    ['呼吸回数を下げ', { set: { rr: 24 } }],
    ['一回換気量を 8', { set: { vt: 48 } }],
    ['PEEP を 8', { set: { peep: 8, fio2: 0.6 } }]
  ],
  '7-3': [
    ['設定と鎮静を', { set: { fio2: 0.35, peep: 5, sed: 0.3 } }]
  ],
  '8-1': [
    ['一回換気量を 6', { set: { vt: 84 } }],
    ['PEEP を 10', { set: { peep: 10 } }],
    ['SpO₂ 92% 以上のまま、FiO₂ を 60', { set: { fio2: 0.6 } }],
    ['回数を整えてから', { set: { rr: 28 } }]
  ],
  '8-2': [
    ['SpO₂ 92% 以上のまま、FiO₂ を 40', { set: { fio2: 0.4 } }],
    ['PEEP を 2 ずつ', { set: { peep: 8 } }]
  ],
  '8-3': [
    ['「鎮静」を 30', { set: { sed: 0.3 } }],
    ['PS を調整して', { set: { ps: 8 } }],
    ['設定を調整して', { set: { fio2: 0.35, peep: 6 } }]
  ],
  '9-1': [
    ['Ti を', { set: { ti: 0.3 } }],
    ['P insp を下げて', { set: { pinsp: 11 } }],
    ['PEEP を 7', { set: { peep: 7 } }],
    ['FiO₂ を下げて', { set: { fio2: 0.6 } }]
  ],
  '9-2': [
    ['P insp を下げて', { set: { pinsp: 8 } }],
    ['SpO₂ 90〜95% を保ったまま', { set: { fio2: 0.25 } }]
  ],
  '9-3': [
    ['回数と P insp を', { set: { rr: 20, pinsp: 7 } }],
    ['設定と鎮静を', { set: { fio2: 0.3, peep: 6, sed: 0.1 } }]
  ],
  '10-1': [
    ['呼吸回数を 12', { set: { rr: 12 } }],
    ['吸気流量を', { set: { flow: 40 } }],
    ['SpO₂ 94% 以上のまま', { set: { fio2: 0.4 } }]
  ],
  '10-2': [
    ['呼吸回数を下げ', { set: { rr: 12 } }]
  ],
  '10-3': [
    ['設定と鎮静を', { set: { fio2: 0.35, peep: 5, sed: 0.3 } }]
  ],
  '11-1': [
    ['PS を 7', { set: { ps: 7 } }],
    ['PS を 10', { set: { ps: 10 } }]
  ],
  '11-2': [
    ['設定と鎮静を', { set: { fio2: 0.3, peep: 5, sed: 0.2 } }]
  ],
  '12-1': [
    ['MAP を 13', { set: { hfoMap: 14 } }],
    ['Amp を上げて', { set: { hfoAmp: 28 } }],
    ['SpO₂ 90〜95% のまま、FiO₂ を 40', { set: { fio2: 0.4 } }]
  ],
  '12-2': [
    ['Amp を上げて', { set: { hfoAmp: 32 } }],
    ['Freq を 10', { set: { hfoFreq: 10 } }],
    ['tcPCO₂ が', { set: { hfoAmp: 23 } }]
  ],
  '12-3': [
    ['MAP（平均気道内圧）を 1〜2', { set: { hfoMap: 11 } }],
    ['SpO₂ 90〜95% のまま、FiO₂ を 30', { set: { fio2: 0.23 } }]
  ],
  '13-1': [
    ['NAVA を 1.5', { set: { navaLevel: 1.5 } }]
  ],
  '13-2': [
    ['PEEP を上げて', { set: { peep: 7 } }],
    ['NAVA を 1.0', { set: { navaLevel: 1.0 } }]
  ],
  '13-3': [
    ['SpO₂ 90〜95% のまま、Edi', { set: { fio2: 0.25 } }]
  ],
  '13-4': [
    ['Flow を 6', { set: { hfncFlow: 6 } }],
    ['FiO₂ を下げて', { set: { fio2: 0.25 } }],
    ['Flow を 4', { set: { hfncFlow: 4 } }]
  ]
};

function mkEngine(lesson) {
  const sc = SC.forLesson(SC.SCENARIOS.find(x => x.id === lesson.scenario), lesson);
  const st = E.defaultSettings();
  Object.assign(st, sc.suggested);
  const nm0 = E.normsFor(sc.patient);
  st.alarms = E.alarmsFor(E.predictedBodyWeight(sc.patient), nm0, st.vt, st.rr);
  const e = new E.Engine(sc.patient, st);
  settle(e, 0);
  Object.assign(e.s, lesson.settings || {});
  if (lesson.sedation != null) e.sedation = lesson.sedation;
  e._recomputeDrive();
  settle(e, 2);
  return e;
}
function settle(e, extra) {
  let t = 0;
  const need = e.breaths.length < 2 ? 2 : e.breaths.length + (extra || 0);
  while (e.breaths.length < need && t < 12) { e.step(0.005, false); t += 0.005; }
}

function play(id, opt) {
  opt = opt || {};
  const lesson = LS.lessonById(id);
  const e = mkEngine(lesson);
  const S = { abgs: [], abgPending: null, sbt: null, sbtSaved: null, o2: null };
  const rt = new LS.Runtime(lesson);
  const log = [];
  const ctx = () => ({ e, s: e.s, m: e.m, pbw: e.p.pbw, abgs: S.abgs,
    lastAbg: S.abgs.length ? S.abgs[S.abgs.length - 1] : null, sbt: S.sbt, mem: null });
  const L = e.limits;
  const LIM = { vt: L.vt, rr: L.rr, ti: L.ti, flow: L.flow, pinsp: L.pinsp, ps: L.ps,
    hfoMap: L.hfoMap, hfoAmp: L.hfoAmp, hfoFreq: L.hfoFreq, navaLevel: L.navaLevel, hfncFlow: L.hfncFlow,
    peep: { min: 0, max: 24 }, fio2: { min: 0.21, max: 1 } };

  function startSBT() {
    S.sbtSaved = JSON.parse(JSON.stringify(e.s));
    e.s.mode = 'PSV'; e.s.ps = e.p.pbw < 10 ? 8 : (e.p.pbw < 25 ? 6 : 5);
    e.s.peep = Math.min(e.s.peep, 5); e.s.fio2 = Math.min(e.s.fio2, 0.4);
    e.sedation = Math.min(e.sedation, 0.15); e._recomputeDrive();
    S.sbt = { t0: e.clock, dur: 1800, badSince: -1, failMsg: null, done: null, tEnd: null };
  }
  function restore() {
    const sv = S.sbtSaved; if (!sv) return;
    Object.assign(e.s, sv); e.sedation = Math.min(0.5, e.sedation + 0.25);
  }
  function sbtTick() {
    const b = S.sbt; if (!b || b.done) return;
    const nm = e.nm, rrCap = Math.round(nm.rr[1] * 1.5), hrCap = Math.round(nm.hr[1] * 1.25);
    let bad = null;
    if (e.m.rrTotal > rrCap) bad = 'RR>' + rrCap;
    else if (e.spo2 < nm.spo2[0]) bad = 'SpO2<' + nm.spo2[0];
    else if (e.m.rsbiKg != null && e.m.rsbiKg > 8) bad = 'f/VT>8';
    else if (e.hr > hrCap) bad = 'HR>' + hrCap;
    else if (e.map < nm.mapMin) bad = 'MAP<' + nm.mapMin;
    else if (e.ph < 7.30) bad = 'pH<7.30';
    if (bad) {
      if (b.badSince < 0) b.badSince = e.clock;
      if (e.clock - b.badSince > 60) { b.done = 'fail'; b.failMsg = bad; b.tEnd = e.clock; restore(); }
    } else b.badSince = -1;
    if (!b.done && e.clock - b.t0 >= b.dur) { b.done = 'pass'; b.tEnd = e.clock; }
  }
  function tick(sec) {
    const dt = 0.01, n = Math.round(sec / dt);
    for (let i = 0; i < n; i++) {
      if (!e.extubated) e.step(dt, false);
      else e.clock += dt;
    }
    if (S.abgPending != null && e.clock >= S.abgPending) { S.abgs.push(e.sampleABG()); S.abgPending = null; }
    if (!e.extubated) sbtTick();
    if (S.o2 && e.clock >= S.o2.until) { if (e.s.fio2 >= 0.999) e.s.fio2 = S.o2.prev; S.o2 = null; }
  }
  function doEvent(name) {
    if (name === 'hold:insp') e.requestHold('insp');
    else if (name === 'hold:exp') e.requestHold('exp');
    else if (name === 'abg:order') { if (S.abgPending == null) S.abgPending = e.clock + 120; }
    else if (name === 'suction') {
      if (!S.o2 && e.s.fio2 < 0.999) { S.o2 = { prev: e.s.fio2, until: e.clock + 120 }; e.s.fio2 = 1; }
      e.suction();
    }
    else if (name === 'o2100') { if (!S.o2 && e.s.fio2 < 0.999) { S.o2 = { prev: e.s.fio2, until: e.clock + 120 }; e.s.fio2 = 1; } }
    else if (name === 'sbt:start') startSBT();
    else if (name === 'extubate') {
      const list = SC.weaningReadiness(e), nOk = list.filter(x => x.ok).length;
      const pass = !!(S.sbt && S.sbt.done === 'pass');
      S.ext = { ok: pass && nOk >= list.length - 1, nOk, list: list.filter(x => !x.ok).map(x => x.label) };
      e.extubated = true;
    }
    else if (name.indexOf('mode:') === 0) { e.s.mode = name.slice(5); e._recomputeDrive(); }
    const r = rt.fire(name, ctx());
    return r;
  }
  function applySet(set) {
    for (const k in set) {
      let v = set[k];
      if (k === 'sed') { e.sedation = v; e._recomputeDrive(); continue; }
      const lim = LIM[k];
      if (lim && (v < lim.min - 1e-9 || v > lim.max + 1e-9)) throw new Error(`${id}: ${k}=${v} がダイヤルの範囲外 ${lim.min}〜${lim.max}`);
      e.s[k] = v;
    }
  }
  const state = () => `VThf/kg ${(e.m.vtHf / e.p.pbw).toFixed(2)} tc ${e.tcpco2.toFixed(0)} Edi ${e.m.ediPeak == null ? '-' : e.m.ediPeak.toFixed(1)}/${e.m.ediMin == null ? '-' : e.m.ediMin.toFixed(1)} SpO2 ${e.spo2.toFixed(0)} MAP ${e.map.toFixed(0)}/${e.nm.mapMin} aP ${e.m.autoPeep.toFixed(1)} PIP ${e.m.pip.toFixed(0)} Pplat ${e.m.pplat == null ? '-' : e.m.pplat.toFixed(0)} Vte/kg ${(e.m.vte / e.p.pbw).toFixed(1)} pH ${e.ph.toFixed(2)} CO2 ${e.paco2.toFixed(0)} RR ${e.m.rrTotal.toFixed(0)}`;
  const steps = SOLVE[id] || [];
  let guard = 0;
  while (!rt.finished && guard++ < 400) {
    const t = rt.task();
    rt.enter(ctx());
    if (t.talk) { rt.tap(ctx()); continue; }
    if (t.quiz) { rt.answer(t.quiz.answer, ctx()); continue; }
    const say = typeof t.say === 'function' ? t.say(ctx()) : t.say;
    const plan = steps.find(p => say.indexOf(p[0]) === 0);
    if (plan && plan[1].set) applySet(plan[1].set);
    if (t.event) {
      if (t.event === 'extubate' || t.event === 'sbt:start') { /* そのまま */ }
      const r = doEvent(t.event);
      if (!r) throw new Error(`${id}: イベント ${t.event} で進まない（${say}）`);
      log.push(`${say} → ${t.event}`);
      continue;
    }
    // 判定の課題：採血が要る課題は、1 回採ってから待つ
    const waitMax = (plan && plan[1].wait) || 2400;
    const t0 = e.clock;
    let advanced = false, ordered = false;
    const needsAbg = /採血|abgs|lastAbg/.test(say + (t.check ? t.check.toString() : ''));
    const needsHold = /paused/.test(t.check.toString()) && String(t.spot || '').indexOf('kExp') >= 0;
    let lastHold = -99;
    if (/SBT/.test(say) && /sbt/.test(t.check.toString()) && !S.sbt) startSBT();
    while (e.clock - t0 < waitMax) {
      if (needsAbg && S.abgPending == null && !ordered && e.clock - t0 > ((plan && plan[1].abgAfter) || 240)) {
        S.abgPending = e.clock + 120; ordered = true;
      }
      if (needsAbg && ordered && S.abgPending == null && !advanced) ordered = false;   // 結果が出ても届かなければ採り直す
      tick(0.5);
      if (needsHold && e.hold == null && e.holdPending == null && e.clock - lastHold > 20) {
        e.requestHold('exp'); lastHold = e.clock;     // 設定を変えたあと、もう一度測り直す
      }
      const r = rt.poll(ctx(), 0.5);
      if (r) { advanced = true; log.push(`${say} → ${Math.round(e.clock - t0)} 秒 ｜ ${state()} ｜ ${r.why || ''}`); break; }
    }
    if (!advanced) {
      const m = e.m;
      throw new Error(`${id}: 「${say}」が ${waitMax} 秒で達成できない`
        + ` [Vte ${m.vte.toFixed(1)} / ${(m.vte / e.p.pbw).toFixed(1)} mL/kg, PIP ${m.pip.toFixed(0)}, Pplat ${m.pplat == null ? '-' : m.pplat.toFixed(0)},`
        + ` ΔP ${m.dp == null ? '-' : m.dp.toFixed(0)}, autoPEEP ${m.autoPeep.toFixed(1)}, SpO2 ${e.spo2.toFixed(0)}, MAP ${e.map.toFixed(0)}/${e.nm.mapMin},`
        + ` pH ${e.ph.toFixed(2)}, PaCO2 ${e.paco2.toFixed(0)}, PaO2 ${e.pao2.toFixed(0)}, RR ${m.rrTotal.toFixed(0)}, f/VT ${m.rsbiKg == null ? '-' : m.rsbiKg.toFixed(1)},`
        + ` sbt ${S.sbt ? S.sbt.done + ' ' + S.sbt.failMsg : '-'}, Edi ${m.ediPeak == null ? '-' : m.ediPeak.toFixed(1)}]`);
    }
  }
  return { id, ok: rt.finished, log, ext: S.ext, final: { spo2: e.spo2, map: e.map, ph: e.ph, paco2: e.paco2 } };
}

module.exports = { play, SOLVE };

if (require.main === module) {
  const ids = process.argv.slice(2);
  const list = ids.length ? ids : Object.keys(SOLVE);
  let fail = 0;
  for (const id of list) {
    try {
      const r = play(id);
      console.log('ok  ', id, r.ext ? (r.ext.ok ? '抜管成功' : '再挿管 ' + r.ext.list.join('/')) : '');
      if (process.env.V) r.log.forEach(x => console.log('       ', x));
    } catch (err) { fail++; console.log('FAIL', err.message); }
  }
  process.exit(fail ? 1 : 0);
}
