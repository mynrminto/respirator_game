/* エンジンの数値検証。解析解と突き合わせられるものから固める。 */
const VE = require('./engine.js');
const { SCENARIOS } = require('./scenarios.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

function scen(id) { return JSON.parse(JSON.stringify(SCENARIOS.find(s => s.id === id))); }
function mk(id, over) {
  const sc = scen(id);
  const st = VE.defaultSettings();
  Object.assign(st, over || {});
  return new VE.Engine(sc.patient, st);
}
function run(e, seconds, dt) {
  dt = dt || 0.005;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) e.step(dt, false);
}

console.log('\n1. 受動呼気の時定数 τ = R × C');
{
  const e = mk('postop', { mode: 'VC-AC', vt: 500, rr: 10, peep: 5, flow: 60, flowPattern: 'square' });
  e.sedation = 1.0; e.pmusAmp = 0; e._recomputeDrive();
  run(e, 20);
  // 吸気末まで進める
  while (e.phase !== 'insp') e.step(0.002, false);
  while (e.phase === 'insp') e.step(0.002, false);
  const vStart = e.V, veq = e.C * e.s.peep;
  const tau = e.p.Rexp * e.C;
  let t = 0;
  while (t < tau) { e.step(0.002, false); t += 0.002; }
  const frac = (e.V - veq) / (vStart - veq);
  ok('τ 経過で残容量が 36.8% になる', near(frac, 0.368, 0.02),
    `τ=${tau.toFixed(3)}s frac=${frac.toFixed(3)}`);
}

console.log('\n2. プラトー圧から静肺コンプライアンスが戻る');
{
  const e = mk('ards', { mode: 'VC-AC', vt: 300, rr: 20, peep: 10, flow: 45, pause: 0.4 });
  e.sedation = 1.0; e._recomputeDrive();
  run(e, 40);
  const cMeas = e.m.cstat / 1000;            // L/cmH2O
  ok('Cstat ≒ 実際のコンプライアンス', near(cMeas, e.C, e.C * 0.06),
    `実測 ${(e.m.cstat).toFixed(1)} mL/cmH2O / 真値 ${(e.C * 1000).toFixed(1)}`);
  ok('ドライビング圧 = Vt / C', near(e.m.dp, (e.m.vti / 1000) / e.C, 1.0),
    `ΔP=${e.m.dp.toFixed(1)} cmH2O`);
  ok('プラトー圧 < 最高気道内圧', e.m.pplat < e.m.pip,
    `Pplat=${e.m.pplat.toFixed(1)} PIP=${e.m.pip.toFixed(1)}`);
}

console.log('\n3. 気道抵抗が PIP − Pplat に出る');
{
  const e = mk('copd', { mode: 'VC-AC', vt: 450, rr: 10, peep: 5, flow: 60, flowPattern: 'square', pause: 0.4 });
  e.sedation = 1.0; e._recomputeDrive();
  run(e, 60);
  ok('Raw ≒ 真の吸気抵抗', near(e.m.raw, e.p.Rinsp, 2.5),
    `実測 ${e.m.raw.toFixed(1)} / 真値 ${e.p.Rinsp}`);
}

console.log('\n4. 呼気時間が足りないと auto-PEEP が出る');
{
  const slow = mk('copd', { mode: 'VC-AC', vt: 450, rr: 10, peep: 5, flow: 60 });
  slow.sedation = 1.0; slow._recomputeDrive(); run(slow, 120);
  const fast = mk('copd', { mode: 'VC-AC', vt: 450, rr: 26, peep: 5, flow: 60 });
  fast.sedation = 1.0; fast._recomputeDrive(); run(fast, 120);
  ok('RR 10 では auto-PEEP がほぼない', slow.m.autoPeep < 1.5, `${slow.m.autoPeep.toFixed(1)} cmH2O`);
  ok('RR 26 で auto-PEEP が出る', fast.m.autoPeep > 4, `${fast.m.autoPeep.toFixed(1)} cmH2O`);
  ok('auto-PEEP で実測一回換気量が落ちない(量規定)', fast.m.vte > 400, `${fast.m.vte.toFixed(0)} mL`);
  // 呼気ポーズで総 PEEP が測れる
  while (fast.phase !== 'exp') fast.step(0.002, false);
  fast.requestHold('exp');
  run(fast, 3);
  ok('呼気ポーズが総 PEEP を返す', fast.m.peepTot > fast.s.peep + 3,
    `総PEEP=${fast.m.peepTot.toFixed(1)} cmH2O`);
}

console.log('\n5. 分時肺胞換気量と PaCO2');
{
  const e = mk('postop', { mode: 'VC-AC', vt: 450, rr: 12, peep: 5, fio2: 0.4, flow: 50 });
  e.sedation = 1.0; e._recomputeDrive();
  run(e, 60 * 45, 0.01);
  const vdAnat = 2.0 * e.p.pbw / 1000, vd = vdAnat + 0.030 + e.p.vdAlvFrac * (e.m.vte / 1000);
  const va = (e.m.vte / 1000 - vd) * e.m.rrTotal;
  const expect = 0.863 * e.p.vco2 * (1 + 0.13 * (e.temp - 37)) / va;
  ok('PaCO2 が 0.863·VCO2/VA に収束', near(e.paco2, expect, 2.0),
    `PaCO2=${e.paco2.toFixed(1)} 理論値=${expect.toFixed(1)}`);

  const before = e.paco2;
  e.s.rr = 20; run(e, 60 * 30, 0.01);
  ok('呼吸数を上げると PaCO2 が下がる', e.paco2 < before - 6,
    `${before.toFixed(1)} → ${e.paco2.toFixed(1)} mmHg`);
}

console.log('\n6. ARDS で PEEP を上げると酸素化が改善する');
{
  const lo = mk('ards', { mode: 'VC-AC', vt: 300, rr: 24, peep: 5, fio2: 0.6, flow: 45 });
  lo.sedation = 1.0; lo._recomputeDrive(); run(lo, 60 * 20, 0.01);
  const hi = mk('ards', { mode: 'VC-AC', vt: 300, rr: 24, peep: 14, fio2: 0.6, flow: 45 });
  hi.sedation = 1.0; hi._recomputeDrive(); run(hi, 60 * 20, 0.01);
  ok('PEEP 14 の方が PaO2 が高い', hi.pao2 > lo.pao2 + 15,
    `PEEP5: ${lo.pao2.toFixed(0)} → PEEP14: ${hi.pao2.toFixed(0)} mmHg`);
  ok('PEEP 14 の方が心拍出量が低い', hi.co < lo.co,
    `CO ${lo.co.toFixed(2)} → ${hi.co.toFixed(2)} L/min`);
  ok('ARDS の P/F 比が低い', lo.pao2 / lo.s.fio2 < 200, `P/F=${(lo.pao2 / lo.s.fio2).toFixed(0)}`);
}

console.log('\n7. FiO2 と PaO2');
{
  const e = mk('postop', { mode: 'VC-AC', vt: 450, rr: 16, peep: 5, fio2: 0.21, flow: 50 });
  e.sedation = 1.0; e._recomputeDrive(); run(e, 60 * 20, 0.01);
  const room = e.pao2;
  e.s.fio2 = 1.0; run(e, 60 * 12, 0.01);
  ok('FiO2 1.0 で PaO2 が大きく上がる', e.pao2 > room + 150,
    `${room.toFixed(0)} → ${e.pao2.toFixed(0)} mmHg`);
  ok('正常肺の FiO2 0.21 で PaO2 が生理的範囲', room > 60 && room < 110, `${room.toFixed(0)} mmHg`);
}

console.log('\n8. 自発呼吸とトリガ（PSV）');
{
  const e = mk('gbs', { mode: 'PSV', ps: 12, peep: 5, fio2: 0.4, trigFlow: 2 });
  e.sedation = 0.1; e._recomputeDrive();
  run(e, 180, 0.005);
  const spont = e.breaths.filter(b => b.spont).length;
  ok('患者トリガで自発呼吸が立つ', spont > 5, `直近60秒で ${e.m.rrSpont.toFixed(0)} 回/分`);
  ok('PSV で一回換気量が得られる', e.m.vte > 150, `Vte=${e.m.vte.toFixed(0)} mL`);
  ok('RSBI が計算される', e.m.rsbi != null && e.m.rsbi > 0, `RSBI=${(e.m.rsbi || 0).toFixed(0)}`);
}

console.log('\n9. 筋力の弱い患者は SBT で rapid shallow breathing になる');
{
  const sup = mk('gbs', { mode: 'PSV', ps: 14, peep: 5, fio2: 0.4 });
  sup.sedation = 0.1; sup._recomputeDrive(); run(sup, 60 * 10, 0.01);
  const sbt = mk('gbs', { mode: 'CPAP', ps: 0, peep: 5, fio2: 0.4 });
  sbt.sedation = 0.1; sbt._recomputeDrive(); run(sbt, 60 * 25, 0.01);
  ok('サポートを切ると RSBI が上がる', sbt.m.rsbi > sup.m.rsbi + 60,
    `PS14: ${sup.m.rsbi.toFixed(0)} → CPAP: ${sbt.m.rsbi.toFixed(0)}`);
  ok('SBT 中に呼吸筋疲労が蓄積する', sbt.fatigue > 0.2, `fatigue=${sbt.fatigue.toFixed(2)}`);
  ok('一回換気量が落ちて呼吸数が上がる', sbt.m.rrTotal > sup.m.rrTotal,
    `RR ${sup.m.rrTotal.toFixed(0)} → ${sbt.m.rrTotal.toFixed(0)} /分`);
}

console.log('\n10. 肺が正常な患者は SBT を通る');
{
  const e = mk('postop', { mode: 'CPAP', ps: 0, peep: 5, fio2: 0.4 });
  e.sedation = 0.1; e._recomputeDrive(); run(e, 60 * 30, 0.01);
  ok('RSBI < 105', e.m.rsbi < 105, `RSBI=${e.m.rsbi.toFixed(0)}`);
  ok('PaCO2 が保たれる', e.paco2 < 55, `PaCO2=${e.paco2.toFixed(0)} mmHg`);
  ok('疲労が溜まらない', e.fatigue < 0.35, `fatigue=${e.fatigue.toFixed(2)}`);
}

console.log('\n11. COPD の慢性代償と pH');
{
  const e = mk('copd', { mode: 'VC-AC', vt: 450, rr: 12, peep: 5, fio2: 0.35, flow: 55 });
  e.sedation = 1.0; e._recomputeDrive(); run(e, 60 * 20, 0.01);
  ok('高 CO2 でも pH は代償されている', e.ph > 7.28, `pH=${e.ph.toFixed(2)} PaCO2=${e.paco2.toFixed(0)}`);
  const ph0 = e.ph;
  e.s.rr = 24; run(e, 60 * 10, 0.01);
  ok('急に換気を増やすとアルカローシスに振れる', e.ph > ph0 + 0.05,
    `pH ${ph0.toFixed(2)} → ${e.ph.toFixed(2)}`);
}

console.log('\n12. PCV は肺が硬いと一回換気量が落ちる');
{
  const a = mk('postop', { mode: 'PC-AC', pinsp: 15, ti: 1.0, rr: 14, peep: 5 });
  a.sedation = 1.0; a._recomputeDrive(); run(a, 60);
  const b = mk('ards', { mode: 'PC-AC', pinsp: 15, ti: 1.0, rr: 14, peep: 5 });
  b.sedation = 1.0; b._recomputeDrive(); run(b, 60);
  ok('同じ吸気圧でも硬い肺では Vt が小さい', b.m.vte < a.m.vte * 0.75,
    `正常 ${a.m.vte.toFixed(0)} mL / ARDS ${b.m.vte.toFixed(0)} mL`);
}

console.log('\n13. 血液ガス採取の整合性');
{
  const e = mk('ards', { mode: 'VC-AC', vt: 300, rr: 22, peep: 12, fio2: 0.7, flow: 45 });
  e.sedation = 1.0; e._recomputeDrive(); run(e, 60 * 15, 0.01);
  const g = e.sampleABG();
  const phCalc = 6.1 + Math.log10(g.hco3 / (0.03 * g.paco2));
  ok('Henderson-Hasselbalch が閉じている', near(g.ph, phCalc, 0.03),
    `pH=${g.ph} 計算値=${phCalc.toFixed(2)}`);
  ok('P/F 比が返る', g.pf > 0, `P/F=${g.pf}`);
}

console.log('\n14. 予測体重');
{
  ok('男性 170cm ≒ 66.0 kg', near(VE.predictedBodyWeight('M', 170), 66.0, 0.3));
  ok('女性 158cm ≒ 50.6 kg', near(VE.predictedBodyWeight('F', 158), 50.6, 0.3));
}

console.log('\n15. 60倍速でも結果が変わらない');
{
  const a = mk('postop', { mode: 'VC-AC', vt: 450, rr: 14, peep: 5, fio2: 0.4, flow: 50 });
  a.sedation = 1.0; a._recomputeDrive(); run(a, 60 * 10, 0.005);
  const b = mk('postop', { mode: 'VC-AC', vt: 450, rr: 14, peep: 5, fio2: 0.4, flow: 50 });
  b.sedation = 1.0; b._recomputeDrive(); run(b, 60 * 10, 0.012);
  ok('dt 5ms と 12ms で PaCO2 が一致', near(a.paco2, b.paco2, 1.0),
    `${a.paco2.toFixed(1)} / ${b.paco2.toFixed(1)} mmHg`);
  ok('dt 5ms と 12ms で Vte が一致', near(a.m.vte, b.m.vte, 15),
    `${a.m.vte.toFixed(0)} / ${b.m.vte.toFixed(0)} mL`);
}

console.log('\n16. ポーズ操作のタイミング');
{
  // 呼気の途中で吸気ポーズを押しても、実行されるのは次の吸気末でなければならない。
  const e = mk('postop', { mode: 'VC-AC', vt: 450, rr: 12, peep: 5, fio2: 0.4, flow: 50 });
  e.sedation = 1.0; e._recomputeDrive();
  run(e, 20, 0.005);
  while (e.phase !== 'exp' || e.phaseT < 1.0) e.step(0.005, false);  // 呼気の半ばで押す
  e.requestHold('insp');
  ok('押した瞬間はポーズに入らない', e.hold === null && e.holdPending === 'insp');
  run(e, 12, 0.005);
  const pplat = e.m.pplat, peepTot = e.m.peepTot;
  ok('Pplat が PEEP より十分高い', pplat > peepTot + 4,
    `Pplat=${pplat.toFixed(1)} PEEP tot=${peepTot.toFixed(1)} cmH2O`);
  ok('Pplat から出した Cstat が実際のコンプライアンスに一致',
    near(e.m.cstat, e.p.compliance * 1000, 6),
    `Cstat=${e.m.cstat.toFixed(0)} 実値=${(e.p.compliance * 1000).toFixed(0)} mL/cmH2O`);

  // 呼気ポーズは呼気末で実行され、total PEEP を測る。
  const c = mk('copd', { mode: 'VC-AC', vt: 450, rr: 20, peep: 5, fio2: 0.4, flow: 45 });
  c.sedation = 1.0; c._recomputeDrive();
  run(c, 60, 0.005);
  while (c.phase !== 'insp') c.step(0.005, false);   // 吸気の最中に押す
  c.requestHold('exp');
  ok('呼気ポーズも押した瞬間には入らない', c.hold === null);
  run(c, 14, 0.005);
  ok('呼気ポーズで auto-PEEP が検出される', c.m.autoPeep > 0.5,
    `auto-PEEP=${c.m.autoPeep.toFixed(1)} cmH2O`);
  ok('ポーズ後も換気が続く', (run(c, 30, 0.005), c.m.vte > 300), `Vte=${c.m.vte.toFixed(0)} mL`);
}

console.log('\n10. 学習コースの構造');
{
  const LS = require('./lessons.js');
  const flat = LS.allLessons();
  ok('章とレッスンがある', LS.CHAPTERS.length === 6 && flat.length === 19,
    `${LS.CHAPTERS.length} 章 / ${flat.length} レッスン`);

  const ids = flat.map(x => x.lesson.id);
  ok('レッスン ID が重複しない', new Set(ids).size === ids.length);

  const scenIds = new Set(SCENARIOS.map(s => s.id));
  let badScenario = [], badSetting = [], badTask = [], badQuiz = [];
  const settingKeys = new Set(Object.keys(VE.defaultSettings()));
  for (const { lesson } of flat) {
    if (!scenIds.has(lesson.scenario)) badScenario.push(lesson.id);
    for (const k of Object.keys(lesson.settings || {})) {
      if (!settingKeys.has(k)) badSetting.push(lesson.id + ':' + k);
    }
    if (!lesson.brief || !lesson.brief.length || !lesson.points || !lesson.points.length) badTask.push(lesson.id);
    for (const t of lesson.tasks) {
      const kinds = [t.check, t.event, t.quiz].filter(Boolean).length;
      if (kinds !== 1) badTask.push(lesson.id + ' の課題の進み方が一意でない');
      if (t.quiz) {
        const q = t.quiz;
        if (!(q.answer >= 0 && q.answer < q.choices.length)) badQuiz.push(lesson.id);
        if (new Set(q.choices).size !== q.choices.length) badQuiz.push(lesson.id + ' 選択肢の重複');
        if (!q.why) badQuiz.push(lesson.id + ' 解説なし');
      }
    }
  }
  ok('すべて実在の症例を指している', badScenario.length === 0, badScenario.join(','));
  ok('設定の上書きキーがエンジンに存在する', badSetting.length === 0, badSetting.join(','));
  ok('解説と要点がそろっている', badTask.length === 0, badTask.join(' / '));
  ok('クイズの正解番号と選択肢が妥当', badQuiz.length === 0, badQuiz.join(','));

  // 目標として出す数値が、その症例で本当に到達できる範囲にあるか
  for (const id of ['2-1', '4-4']) {
    const l = LS.lessonById(id);
    const sc = SCENARIOS.find(s => s.id === l.scenario);
    const pbw = VE.predictedBodyWeight(sc.patient.sex, sc.patient.heightCm);
    const target = pbw * 6;
    ok(`${id} の 6 mL/kg 目標がダイヤルの範囲内`, target >= 200 && target <= 800,
      `目標 ${target.toFixed(0)} mL（PBW ${pbw.toFixed(1)} kg）`);
  }
}

console.log('\n11. レッスンの進行');
{
  const LS = require('./lessons.js');
  const lesson = LS.lessonById('1-2');
  const e = mk('postop', Object.assign({}, lesson.settings));
  e.sedation = 1.0; e._recomputeDrive();
  const rt = new LS.Runtime(lesson);
  const ctx = () => ({ e, s: e.s, m: e.m, pbw: e.p.pbw, abgs: [], lastAbg: null, sbt: null });

  ok('最初の課題はキー操作', rt.task().event === 'hold:insp');
  ok('関係ないイベントでは進まない', rt.fire('hold:exp', ctx()) === null && rt.index === 0);
  ok('正しいイベントで進む', rt.fire('hold:insp', ctx()) !== null && rt.index === 1);

  // 2 番目は測定待ち。押したポーズが終わるまで進まない。
  e.requestHold('insp');
  ok('測定前は進まない', rt.poll(ctx(), 0.5) === null);
  run(e, 14, 0.005);
  ok('Pplat が出たら進む', rt.poll(ctx(), 0.5) !== null && rt.index === 2);

  // クイズは正解しないと進まない。
  ok('3 番目はクイズ', !!rt.task().quiz);
  const wrong = (rt.task().quiz.answer + 1) % rt.task().quiz.choices.length;
  ok('誤答では進まない', rt.answer(wrong, ctx()).ok === false && rt.index === 2);
  ok('正解で進み、解説が返る', (() => {
    const r = rt.answer(rt.task().quiz.answer, ctx());
    return r.ok === true && r.why.length > 0 && rt.index === 3;
  })());

  // hold 付きの課題は、条件を満たし続けた時間で進む。
  const l22 = LS.lessonById('2-2');
  const e2 = mk('postop', Object.assign({}, l22.settings));
  e2.sedation = 1.0; e2._recomputeDrive();
  const rt2 = new LS.Runtime(l22);
  const ctx2 = () => ({ e: e2, s: e2.s, m: e2.m, pbw: e2.p.pbw, abgs: [], lastAbg: null, sbt: null });
  e2.s.rr = 18;
  run(e2, 90, 0.005);
  ok('条件を満たしても hold 前は進まない', rt2.poll(ctx2(), 5) === null, `MV=${e2.m.mv.toFixed(1)}`);
  ok('満たし続ければ進む', rt2.poll(ctx2(), 30) !== null && rt2.index === 1);

  // onStart の副作用（病態を起こす）が効くこと。
  const l51 = LS.lessonById('5-1');
  const e3 = mk('postop', Object.assign({}, l51.settings));
  e3.sedation = 1.0; e3._recomputeDrive();
  const rt3 = new LS.Runtime(l51);
  const ctx3 = () => ({ e: e3, s: e3.s, m: e3.m, pbw: e3.p.pbw, abgs: [], lastAbg: null, sbt: null });
  run(e3, 40, 0.005);
  rt3.poll(ctx3(), 1);                       // 1 番目（平常時の記録）を通過させる
  ok('平常時の PIP を記録した', rt3.mem.pip0 > 0, `PIP=${(rt3.mem.pip0 || 0).toFixed(1)}`);
  const r0 = e3.p.Rinsp;
  rt3.poll(ctx3(), 1);                       // 2 番目に入ると onStart が発火する
  ok('痰づまりで気道抵抗が上がる', e3.p.Rinsp > r0 * 4, `Rinsp ${r0} → ${e3.p.Rinsp.toFixed(0)}`);
  run(e3, 30, 0.005);
  ok('PIP は上がるが Pplat はほぼ変わらない',
    e3.m.pip > rt3.mem.pip0 + 8 && Math.abs(e3.m.pplat - rt3.mem.plat0) < 3,
    `PIP ${rt3.mem.pip0.toFixed(0)}→${e3.m.pip.toFixed(0)} / Pplat ${rt3.mem.plat0.toFixed(0)}→${e3.m.pplat.toFixed(0)}`);
  ok('上限圧アラームが鳴る', e3.alarms.some(a => a.k === 'pip'),
    `PIP=${e3.m.pip.toFixed(0)} 上限=${e3.s.alarms.pMax}`);
}

console.log('\n12. レッスンの目標が到達可能か');
{
  const LS = require('./lessons.js');
  // 5-2：COPD に auto-PEEP がはっきり出て、呼吸回数を下げれば消えること
  const l = LS.lessonById('5-2');
  const bad = mk('copd', Object.assign({}, l.settings));
  bad.sedation = 1.0; bad._recomputeDrive();
  run(bad, 90, 0.005);
  while (bad.phase !== 'insp') bad.step(0.005, false);
  bad.requestHold('exp');
  run(bad, 14, 0.005);
  ok('初期設定で auto-PEEP がはっきり出る', bad.m.autoPeep > 3,
    `auto-PEEP=${bad.m.autoPeep.toFixed(1)} cmH2O`);

  const good = mk('copd', Object.assign({}, l.settings, { rr: 10 }));
  good.sedation = 1.0; good._recomputeDrive();
  run(good, 120, 0.005);
  while (good.phase !== 'insp') good.step(0.005, false);
  good.requestHold('exp');
  run(good, 14, 0.005);
  ok('呼吸回数を下げると 3 cmH2O 未満まで減る', good.m.autoPeep < 3,
    `auto-PEEP=${good.m.autoPeep.toFixed(1)} cmH2O`);

  // 4-3：ARDS で PEEP を上げれば P/F が改善すること
  const l43 = LS.lessonById('4-3');
  const low = mk('ards', Object.assign({}, l43.settings));
  low.sedation = 1.0; low._recomputeDrive();
  run(low, 600, 0.01);
  const pfLow = low.pao2 / low.s.fio2;
  const high = mk('ards', Object.assign({}, l43.settings, { peep: 14 }));
  high.sedation = 1.0; high._recomputeDrive();
  run(high, 600, 0.01);
  const pfHigh = high.pao2 / high.s.fio2;
  ok('PEEP を上げると P/F が 20 以上改善する', pfHigh > pfLow + 20,
    `P/F ${pfLow.toFixed(0)} → ${pfHigh.toFixed(0)}`);
  // PEEP 14 まで開いたあとなら、FiO2 60% でも SpO2 90% 以上を保てること
  high.s.fio2 = 0.6;
  run(high, 300, 0.01);
  ok('PEEP 14 なら FiO2 60% でも SpO2 90% 以上', high.spo2 >= 90,
    `SpO2=${high.spo2.toFixed(0)}% PaO2=${high.pao2.toFixed(0)}`);

  // 4-4：肺保護の枠（Vt 6 mL/kg・Pplat ≤30・ΔP ≤15）が ARDS で成立すること
  const l44 = LS.lessonById('4-4');
  const sc = SCENARIOS.find(s => s.id === 'ards');
  const pbw = VE.predictedBodyWeight(sc.patient.sex, sc.patient.heightCm);
  const prot = mk('ards', Object.assign({}, l44.settings, { vt: Math.round(pbw * 6 / 10) * 10, pause: 0.3 }));
  prot.sedation = 1.0; prot._recomputeDrive();
  run(prot, 120, 0.005);
  ok('6 mL/kg なら Pplat 30 以下・ΔP 15 以下に収まる',
    prot.m.pplat <= 30 && prot.m.dp <= 15,
    `Pplat=${prot.m.pplat.toFixed(0)} ΔP=${prot.m.dp.toFixed(0)}`);

  // 4-2：低換気の初期設定から、換気量を増やせば PaCO2 が目標域に入ること
  const l42 = LS.lessonById('4-2');
  const hypo = mk('postop', Object.assign({}, l42.settings));
  hypo.sedation = 1.0; hypo._recomputeDrive();
  run(hypo, 900, 0.01);
  ok('低換気の初期設定で高 CO2 になる', hypo.paco2 > 50, `PaCO2=${hypo.paco2.toFixed(0)} mmHg`);
  hypo.s.vt = 480; hypo.s.rr = 14;
  run(hypo, 900, 0.01);
  ok('MV を 6.5 以上にすると PaCO2 が目標域に入る',
    hypo.paco2 >= 33 && hypo.paco2 <= 48 && hypo.m.mv >= 6.5,
    `PaCO2=${hypo.paco2.toFixed(0)} MV=${hypo.m.mv.toFixed(1)}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
