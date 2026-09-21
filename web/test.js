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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
