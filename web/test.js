/* エンジンの数値検証。解析解と突き合わせられるものから固める。
 * 症例はすべて小児なので、体重 1.1 kg から 35 kg までで同じ式が成り立つことを見る。 */
const fs = require('fs');
const path = require('path');
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
  Object.assign(st, sc.suggested, over || {});
  const nm = VE.normsFor(sc.patient);
  st.alarms = VE.alarmsFor(VE.predictedBodyWeight(sc.patient), nm, st.vt, st.rr);
  return new VE.Engine(sc.patient, st);
}
function run(e, seconds, dt) {
  dt = dt || 0.005;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) e.step(dt, false);
}
/** 呼気ポーズを次の呼気末で実行し、総 PEEP を測り終えるまで進める。 */
function expPause(e) {
  while (e.phase !== 'insp') e.step(0.002, false);
  e.requestHold('exp');
  run(e, 14, 0.005);
}

console.log('\n1. 受動呼気の時定数 τ = R × C');
{
  const e = mk('postop', { mode: 'VC-AC', vt: 180, rr: 10, peep: 5, flow: 24, flowPattern: 'square' });
  e.sedation = 1.0; e.pmusAmp = 0; e._recomputeDrive();
  run(e, 20);
  while (e.phase !== 'insp') e.step(0.002, false);
  while (e.phase === 'insp') e.step(0.002, false);
  const vStart = e.V, veq = e.C * e.s.peep;
  const tau = e.p.Rexp * e.C;
  let t = 0;
  while (t < tau) { e.step(0.002, false); t += 0.002; }
  const frac = (e.V - veq) / (vStart - veq);
  ok('τ 経過で残容量が 36.8% になる', near(frac, 0.368, 0.02),
    `τ=${tau.toFixed(3)}s frac=${frac.toFixed(3)}`);

  // 早産児（C が 40 分の 1）でも同じ式が成り立つこと
  const n = mk('rds', { mode: 'PC-AC', pinsp: 10, ti: 0.30, rr: 40, peep: 6 });
  n.sedation = 1.0; n.pmusAmp = 0; n._recomputeDrive();
  run(n, 20);
  while (n.phase !== 'insp') n.step(0.001, false);
  while (n.phase === 'insp') n.step(0.001, false);
  const vS2 = n.V, veq2 = n.C * n.s.peep, tau2 = n.p.Rexp * n.C;
  let t2 = 0;
  while (t2 < tau2) { n.step(0.0005, false); t2 += 0.0005; }
  const frac2 = (n.V - veq2) / (vS2 - veq2);
  ok('早産児（τ 0.05 秒）でも同じ', near(frac2, 0.368, 0.03),
    `τ=${tau2.toFixed(3)}s frac=${frac2.toFixed(3)}`);
}

console.log('\n2. プラトー圧から静肺コンプライアンスが戻る');
{
  const e = mk('ards', { mode: 'VC-AC', vt: 85, rr: 26, peep: 10, flow: 12, pause: 0.4 });
  e.sedation = 1.0; e._recomputeDrive();
  run(e, 60);
  const cMeas = e.m.cstat / 1000;            // L/cmH2O
  ok('Cstat ≒ 実際のコンプライアンス', near(cMeas, e.C, e.C * 0.06),
    `実測 ${(e.m.cstat).toFixed(2)} mL/cmH2O / 真値 ${(e.C * 1000).toFixed(2)}`);
  ok('ドライビング圧 = Vt / C', near(e.m.dp, (e.m.vti / 1000) / e.C, 1.0),
    `ΔP=${e.m.dp.toFixed(1)} cmH2O`);
  ok('プラトー圧 < 最高気道内圧', e.m.pplat < e.m.pip,
    `Pplat=${e.m.pplat.toFixed(1)} PIP=${e.m.pip.toFixed(1)}`);

  // 体重 1.1 kg でも Cstat が出ること（成人向けの 50 mL の下限が残っていると null になる）
  const n = mk('rds', { mode: 'VC-AC', vt: 5.5, rr: 45, peep: 6, flow: 1.5, pause: 0.15 });
  n.sedation = 1.0; n._recomputeDrive();
  run(n, 60);
  ok('早産児でも Cstat が計算される', n.m.cstat != null && near(n.m.cstat / 1000, n.C, n.C * 0.10),
    `Cstat=${(n.m.cstat || 0).toFixed(2)} / 真値 ${(n.C * 1000).toFixed(2)} mL/cmH2O`);
}

console.log('\n3. 気道抵抗が PIP − Pplat に出る');
{
  const e = mk('bronchiolitis', { mode: 'VC-AC', vt: 45, rr: 20, peep: 6, flow: 6, flowPattern: 'square', pause: 0.3 });
  e.sedation = 1.0; e._recomputeDrive();
  run(e, 60);
  ok('Raw ≒ 真の吸気抵抗', near(e.m.raw, e.p.Rinsp, e.p.Rinsp * 0.12),
    `実測 ${e.m.raw.toFixed(0)} / 真値 ${e.p.Rinsp}`);
  ok('細いチューブでは Raw が成人の桁を超える', e.m.raw > 40, `Raw=${e.m.raw.toFixed(0)} cmH2O/L/s`);
}

console.log('\n4. 呼気時間が足りないと auto-PEEP が出る（細気管支炎の乳児）');
{
  const slow = mk('bronchiolitis', { mode: 'VC-AC', vt: 45, rr: 20, peep: 6, flow: 6 });
  slow.sedation = 1.0; slow._recomputeDrive(); run(slow, 180);
  const fast = mk('bronchiolitis', { mode: 'VC-AC', vt: 45, rr: 45, peep: 6, flow: 6 });
  fast.sedation = 1.0; fast._recomputeDrive(); run(fast, 180);
  ok('RR 20 では auto-PEEP がほぼない', slow.m.autoPeep < 1.5, `${slow.m.autoPeep.toFixed(1)} cmH2O`);
  ok('RR 45 で auto-PEEP が出る', fast.m.autoPeep > 3, `${fast.m.autoPeep.toFixed(1)} cmH2O`);
  ok('auto-PEEP で実測一回換気量が落ちない(量規定)', fast.m.vte > 40, `${fast.m.vte.toFixed(0)} mL`);
  expPause(fast);
  ok('呼気ポーズが総 PEEP を返す', fast.m.peepTot > fast.s.peep + 2,
    `総PEEP=${fast.m.peepTot.toFixed(1)} cmH2O`);
}

console.log('\n5. 分時肺胞換気量と PaCO2');
{
  const e = mk('postop', { mode: 'VC-AC', vt: 150, rr: 18, peep: 5, fio2: 0.4, flow: 20 });
  e.sedation = 1.0; e._recomputeDrive();
  run(e, 60 * 45, 0.01);
  const vdAnat = 2.0 * e.p.pbw / 1000;
  const vd = vdAnat + e.p.vdCircuit / 1000 + e.p.vdAlvFrac * (e.m.vte / 1000);
  const va = (e.m.vte / 1000 - vd) * e.m.rrTotal;
  const expect = 0.863 * e.p.vco2 * (1 + 0.13 * (e.temp - 37)) / va;
  ok('PaCO2 が 0.863·VCO2/VA に収束', near(e.paco2, expect, 2.0),
    `PaCO2=${e.paco2.toFixed(1)} 理論値=${expect.toFixed(1)}`);

  const before = e.paco2;
  e.s.rr = 26; run(e, 60 * 30, 0.01);
  ok('呼吸数を上げると PaCO2 が下がる', e.paco2 < before - 5,
    `${before.toFixed(1)} → ${e.paco2.toFixed(1)} mmHg`);
}

console.log('\n6. 小児 ARDS で PEEP を上げると酸素化が改善する');
{
  const lo = mk('ards', { mode: 'VC-AC', vt: 85, rr: 28, peep: 5, fio2: 0.6, flow: 12 });
  lo.sedation = 1.0; lo._recomputeDrive(); run(lo, 60 * 20, 0.01);
  const hi = mk('ards', { mode: 'VC-AC', vt: 85, rr: 28, peep: 14, fio2: 0.6, flow: 12 });
  hi.sedation = 1.0; hi._recomputeDrive(); run(hi, 60 * 20, 0.01);
  ok('PEEP 14 の方が PaO2 が高い', hi.pao2 > lo.pao2 + 15,
    `PEEP5: ${lo.pao2.toFixed(0)} → PEEP14: ${hi.pao2.toFixed(0)} mmHg`);
  ok('PEEP 14 の方が心拍出量が低い', hi.co < lo.co,
    `CO ${lo.co.toFixed(2)} → ${hi.co.toFixed(2)} L/min`);
  ok('小児 ARDS の P/F 比が低い', lo.pao2 / lo.s.fio2 < 200, `P/F=${(lo.pao2 / lo.s.fio2).toFixed(0)}`);
}

console.log('\n7. FiO2 と PaO2');
{
  const e = mk('postop', { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.21, flow: 24 });
  e.sedation = 1.0; e._recomputeDrive(); run(e, 60 * 20, 0.01);
  const room = e.pao2;
  e.s.fio2 = 1.0; run(e, 60 * 12, 0.01);
  ok('FiO2 1.0 で PaO2 が大きく上がる', e.pao2 > room + 150,
    `${room.toFixed(0)} → ${e.pao2.toFixed(0)} mmHg`);
  ok('正常肺の FiO2 0.21 で PaO2 が生理的範囲', room > 60 && room < 110, `${room.toFixed(0)} mmHg`);
}

console.log('\n8. 自発呼吸とトリガ（PSV）');
{
  const e = mk('gbs', { mode: 'PSV', ps: 12, peep: 5, fio2: 0.4, trigFlow: 1.0 });
  e.sedation = 0.1; e._recomputeDrive();
  run(e, 180, 0.005);
  const spont = e.breaths.filter(b => b.spont).length;
  ok('患者トリガで自発呼吸が立つ', spont > 5, `直近60秒で ${e.m.rrSpont.toFixed(0)} 回/分`);
  ok('PSV で一回換気量が得られる', e.m.vte > 60, `Vte=${e.m.vte.toFixed(0)} mL`);
  ok('f/VT（体重あたり）が計算される', e.m.rsbiKg != null && e.m.rsbiKg > 0,
    `f/VT=${(e.m.rsbiKg || 0).toFixed(1)}`);
}

console.log('\n9. 筋力の弱い児は SBT で浅く速い呼吸になる');
{
  const sup = mk('gbs', { mode: 'PSV', ps: 14, peep: 5, fio2: 0.4 });
  sup.sedation = 0.1; sup._recomputeDrive(); run(sup, 60 * 10, 0.01);
  const sbt = mk('gbs', { mode: 'CPAP', ps: 0, peep: 5, fio2: 0.4 });
  sbt.sedation = 0.1; sbt._recomputeDrive(); run(sbt, 60 * 25, 0.01);
  ok('サポートを切ると f/VT が上がる', sbt.m.rsbiKg > sup.m.rsbiKg + 3,
    `PS14: ${sup.m.rsbiKg.toFixed(1)} → CPAP: ${sbt.m.rsbiKg.toFixed(1)}`);
  ok('SBT 中に呼吸筋疲労が蓄積する', sbt.fatigue > 0.2, `fatigue=${sbt.fatigue.toFixed(2)}`);
  ok('一回換気量が落ちて呼吸数が上がる', sbt.m.rrTotal > sup.m.rrTotal,
    `RR ${sup.m.rrTotal.toFixed(0)} → ${sbt.m.rrTotal.toFixed(0)} /分`);
}

console.log('\n10. 肺が正常な児は SBT を通る');
{
  const e = mk('postop', { mode: 'CPAP', ps: 0, peep: 5, fio2: 0.4 });
  e.sedation = 0.1; e._recomputeDrive(); run(e, 60 * 30, 0.01);
  ok('f/VT < 8', e.m.rsbiKg < 8, `f/VT=${e.m.rsbiKg.toFixed(1)}`);
  ok('PaCO2 が保たれる', e.paco2 < 55, `PaCO2=${e.paco2.toFixed(0)} mmHg`);
  ok('疲労が溜まらない', e.fatigue < 0.35, `fatigue=${e.fatigue.toFixed(2)}`);
}

console.log('\n11. 細気管支炎の許容的高炭酸ガス血症');
{
  const e = mk('bronchiolitis', { mode: 'VC-AC', vt: 45, rr: 25, peep: 6, fio2: 0.5, flow: 6 });
  e.sedation = 1.0; e._recomputeDrive(); run(e, 60 * 25, 0.01);
  ok('高 CO2 でも pH は 7.20 以上に保たれる', e.ph >= 7.20 && e.paco2 > 55,
    `pH=${e.ph.toFixed(2)} PaCO2=${e.paco2.toFixed(0)}`);
  const ph0 = e.ph;
  e.s.rr = 35; run(e, 60 * 15, 0.01);
  ok('換気を増やすと pH が上がる', e.ph > ph0 + 0.05,
    `pH ${ph0.toFixed(2)} → ${e.ph.toFixed(2)}`);
  expPause(e);
  ok('そのかわり auto-PEEP が増える', e.m.autoPeep > 1.5, `auto-PEEP=${e.m.autoPeep.toFixed(1)} cmH2O`);
}

console.log('\n12. PCV は肺が硬いと一回換気量が落ちる');
{
  const a = mk('postop', { mode: 'PC-AC', pinsp: 12, ti: 0.7, rr: 20, peep: 5 });
  a.sedation = 1.0; a._recomputeDrive(); run(a, 60);
  const b = mk('ards', { mode: 'PC-AC', pinsp: 12, ti: 0.7, rr: 20, peep: 5 });
  b.sedation = 1.0; b._recomputeDrive(); run(b, 60);
  ok('同じ吸気圧でも硬い肺では Vt が小さい', b.m.vte < a.m.vte * 0.75,
    `術後 ${a.m.vte.toFixed(0)} mL / 小児ARDS ${b.m.vte.toFixed(0)} mL`);
}

console.log('\n13. 血液ガス採取の整合性');
{
  const e = mk('ards', { mode: 'VC-AC', vt: 85, rr: 30, peep: 12, fio2: 0.7, flow: 12 });
  e.sedation = 1.0; e._recomputeDrive(); run(e, 60 * 15, 0.01);
  const g = e.sampleABG();
  const phCalc = 6.1 + Math.log10(g.hco3 / (0.03 * g.paco2));
  ok('Henderson-Hasselbalch が閉じている', near(g.ph, phCalc, 0.03),
    `pH=${g.ph} 計算値=${phCalc.toFixed(2)}`);
  ok('P/F 比が返る', g.pf > 0, `P/F=${g.pf}`);
}

console.log('\n14. 体重と年齢別の基準値');
{
  ok('小児は実体重をそのまま使う', VE.predictedBodyWeight(scen('ards').patient) === 14);
  ok('早産児 1.1 kg', VE.predictedBodyWeight(scen('rds').patient) === 1.1);
  ok('成人式も残っている（男性 170cm ≒ 66.0 kg）', near(VE.predictedBodyWeight('M', 170), 66.0, 0.3));

  const nn = VE.ageNorms(0), inf = VE.ageNorms(4), sch = VE.ageNorms(96);
  ok('新生児の呼吸数の基準が 40〜60', nn.rr[0] === 40 && nn.rr[1] === 60);
  ok('年齢が上がると呼吸数の基準が下がる', inf.rr[1] > sch.rr[1], `乳児 ${inf.rr[1]} / 学童 ${sch.rr[1]}`);
  ok('新生児の平均血圧の下限は 30 前後', nn.mapMin <= 35 && nn.mapMin >= 28, `${nn.mapMin} mmHg`);
  ok('新生児のプラトー圧の上限は学童より低い', nn.platMax < sch.platMax,
    `${nn.platMax} / ${sch.platMax} cmH2O`);
  ok('新生児の SpO2 目標は上限が 95%', nn.spo2[1] === 95, `${nn.spo2[0]}–${nn.spo2[1]}%`);

  // すべての症例で、推奨初期設定がダイヤルの可動域に収まっていること
  let outOfRange = [];
  for (const sc of SCENARIOS) {
    const pbw = VE.predictedBodyWeight(sc.patient);
    const L = VE.limitsFor(pbw, VE.normsFor(sc.patient));
    const g = sc.suggested;
    const chk = (k, v) => { if (v != null && L[k] && (v < L[k].min || v > L[k].max)) outOfRange.push(`${sc.id}:${k}=${v}`); };
    chk('vt', g.vt); chk('rr', g.rr); chk('ti', g.ti); chk('flow', g.flow);
    chk('pinsp', g.pinsp); chk('ps', g.ps); chk('trig', g.trigFlow);
  }
  ok('推奨初期設定がすべてダイヤルの範囲内', outOfRange.length === 0, outOfRange.join(' '));

  // アラーム初期値が設定値の周りに正しく枠を作ること
  let badAlarm = [];
  for (const sc of SCENARIOS) {
    const pbw = VE.predictedBodyWeight(sc.patient), g = sc.suggested;
    const a = VE.alarmsFor(pbw, VE.normsFor(sc.patient), g.vt, g.rr);
    if (!(a.vtLow < g.vt && g.vt < a.vtHigh)) badAlarm.push(sc.id + ':vt');
    const mv = g.vt / 1000 * g.rr;
    if (!(a.mvLow < mv && mv < a.mvHigh)) badAlarm.push(sc.id + ':mv');
    if (!(a.pMax > 20 && a.pMax < 45)) badAlarm.push(sc.id + ':pMax');
  }
  ok('アラーム初期値が設定値を挟んでいる', badAlarm.length === 0, badAlarm.join(' '));
}

console.log('\n15. 症例が意図した状態で始まる');
{
  const want = {
    postop:        { vtkg: [6.5, 7.5], ph: [7.33, 7.46] },
    rds:           { vtkg: [4.0, 6.0], ph: [7.20, 7.42] },
    bronchiolitis: { vtkg: [6.5, 8.0], ph: [7.18, 7.42] },
    ards:          { vtkg: [5.5, 6.5], ph: [7.18, 7.45] },
    asthma:        { vtkg: [6.5, 7.8], ph: [7.10, 7.30] },
    gbs:           { vtkg: [6.5, 7.6], ph: [7.32, 7.48] }
  };
  for (const sc of SCENARIOS) {
    const e = mk(sc.id);
    run(e, 60 * 15, 0.01);
    const w = want[sc.id], vk = e.m.vte / e.p.pbw;
    ok(`${sc.id}：推奨設定の Vt が ${w.vtkg[0]}〜${w.vtkg[1]} mL/kg`,
      vk >= w.vtkg[0] && vk <= w.vtkg[1], `${vk.toFixed(1)} mL/kg（${e.m.vte.toFixed(1)} mL）`);
    ok(`${sc.id}：pH が想定の範囲`, e.ph >= w.ph[0] && e.ph <= w.ph[1],
      `pH=${e.ph.toFixed(2)} PaCO2=${e.paco2.toFixed(0)} PaO2=${e.pao2.toFixed(0)} SpO2=${e.spo2.toFixed(0)}%`);
    ok(`${sc.id}：呼吸数が年齢相応の範囲を大きく外れない`,
      e.m.rrTotal >= e.nm.rr[0] * 0.5 && e.m.rrTotal <= e.nm.rrMax,
      `RR=${e.m.rrTotal.toFixed(0)}（基準 ${e.nm.rr[0]}〜${e.nm.rr[1]}）`);
    ok(`${sc.id}：心拍と平均血圧が生理的な範囲`,
      e.hr > e.nm.hr[0] * 0.6 && e.hr < e.nm.hr[1] * 1.5 && e.map > 20 && e.map < 110,
      `HR=${e.hr.toFixed(0)} MAP=${e.map.toFixed(0)}`);
  }
}

console.log('\n16. 60倍速でも結果が変わらない');
{
  const a = mk('postop', { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4, flow: 24 });
  a.sedation = 1.0; a._recomputeDrive(); run(a, 60 * 10, 0.005);
  const b = mk('postop', { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4, flow: 24 });
  b.sedation = 1.0; b._recomputeDrive(); run(b, 60 * 10, 0.012);
  ok('dt 5ms と 12ms で PaCO2 が一致', near(a.paco2, b.paco2, 1.0),
    `${a.paco2.toFixed(1)} / ${b.paco2.toFixed(1)} mmHg`);
  ok('dt 5ms と 12ms で Vte が一致', near(a.m.vte, b.m.vte, 8),
    `${a.m.vte.toFixed(0)} / ${b.m.vte.toFixed(0)} mL`);
}

console.log('\n17. ポーズ操作のタイミング');
{
  const e = mk('postop', { mode: 'VC-AC', vt: 180, rr: 18, peep: 5, fio2: 0.4, flow: 24 });
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
    near(e.m.cstat, e.p.compliance * 1000, 2),
    `Cstat=${e.m.cstat.toFixed(1)} 実値=${(e.p.compliance * 1000).toFixed(1)} mL/cmH2O`);

  const c = mk('bronchiolitis', { mode: 'VC-AC', vt: 45, rr: 40, peep: 6, fio2: 0.5, flow: 6 });
  c.sedation = 1.0; c._recomputeDrive();
  run(c, 60, 0.005);
  while (c.phase !== 'insp') c.step(0.005, false);   // 吸気の最中に押す
  c.requestHold('exp');
  ok('呼気ポーズも押した瞬間には入らない', c.hold === null);
  run(c, 14, 0.005);
  ok('呼気ポーズで auto-PEEP が検出される', c.m.autoPeep > 0.5,
    `auto-PEEP=${c.m.autoPeep.toFixed(1)} cmH2O`);
  ok('ポーズ後も換気が続く', (run(c, 30, 0.005), c.m.vte > 35), `Vte=${c.m.vte.toFixed(0)} mL`);
}

console.log('\n18. 学習コースの構造');
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
      const kinds = [t.check, t.event, t.quiz, t.talk].filter(Boolean).length;
      if (kinds !== 1) badTask.push(lesson.id + ' の課題の進み方が一意でない');
      if (t.talk && !t.say) badTask.push(lesson.id + ' の会話に言葉がない');
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

  // レッスンの初期設定が、その症例のダイヤルの可動域に収まっていること
  let outside = [];
  for (const { lesson } of flat) {
    const sc = SCENARIOS.find(s => s.id === lesson.scenario);
    const L = VE.limitsFor(VE.predictedBodyWeight(sc.patient), VE.normsFor(sc.patient));
    const st = lesson.settings || {};
    const chk = (k, v) => { if (v != null && L[k] && (v < L[k].min || v > L[k].max)) outside.push(`${lesson.id}:${k}=${v}`); };
    chk('vt', st.vt); chk('rr', st.rr); chk('ti', st.ti); chk('flow', st.flow);
    chk('pinsp', st.pinsp); chk('ps', st.ps); chk('trig', st.trigFlow); chk('pause', st.pause);
  }
  ok('レッスンの初期設定がすべてダイヤルの範囲内', outside.length === 0, outside.join(' '));

  // 目標として出す数値が、その症例で本当に到達できる範囲にあるか
  for (const id of ['2-1', '3-1', '4-4']) {
    const l = LS.lessonById(id);
    const sc = SCENARIOS.find(s => s.id === l.scenario);
    const pbw = VE.predictedBodyWeight(sc.patient);
    const L = VE.limitsFor(pbw, VE.normsFor(sc.patient));
    const target = pbw * 6;
    ok(`${id} の 6 mL/kg 目標がダイヤルの範囲内`, target >= L.vt.min && target <= L.vt.max,
      `目標 ${target.toFixed(1)} mL（体重 ${pbw} kg、範囲 ${L.vt.min}〜${L.vt.max}）`);
  }
}

console.log('\n18b. 教材は読み物ではなく操作であること');
{
  const LS = require('./lessons.js');
  const flat = LS.allLessons();
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // watch / spot が指す先が、実際に画面にあるものか。
  const block = (open, close) => {
    const i = app.indexOf(open);
    return i < 0 ? '' : app.slice(i, app.indexOf(close, i));
  };
  const valKeys = new Set([...block('var VALS = [', '\n  ];').matchAll(/\{ k: '([^']+)'/g)].map(m => m[1]));
  const keyIds = new Set([...block('var P = {', '\n  };').matchAll(/^\s+([a-z0-9]+):\s+\{ k: '/gm)].map(m => m[1]));
  const hardIds = new Set([...html.matchAll(/class="hkey[^"]*" id="([^"]+)"/g)].map(m => m[1]));
  const modeIds = new Set([...app.matchAll(/\{ id: '([A-Z-]+(?:-[A-Z]+)?)', label:/g)].map(m => m[1]));
  ok('画面の計測値・設定キー・ハードキーを読み取れた',
    valKeys.size >= 10 && keyIds.size >= 8 && hardIds.size >= 8,
    `計測値 ${valKeys.size} / 設定キー ${keyIds.size} / ハードキー ${hardIds.size} / モード ${modeIds.size}`);

  let badWatch = [], badSpot = [];
  const checkSpot = (id, spec) => {
    for (const one of (Array.isArray(spec) ? spec : [spec])) {
      const i = one.indexOf(':');
      const kind = i < 0 ? one : one.slice(0, i), arg = i < 0 ? '' : one.slice(i + 1);
      if (kind === 'dial' || kind === 'wave') continue;
      if (kind === 'val' && valKeys.has(arg)) continue;
      if (kind === 'key' && keyIds.has(arg)) continue;
      if (kind === 'hard' && hardIds.has(arg)) continue;
      if (kind === 'mode' && modeIds.has(arg)) continue;
      if (kind === 'screen' && ['wave', 'loops', 'trend'].includes(arg)) continue;
      badSpot.push(`${id}:${one}`);
    }
  };
  for (const { lesson } of flat) {
    for (const t of lesson.tasks) {
      for (const w of t.watch || []) if (!valKeys.has(w)) badWatch.push(`${lesson.id}:${w}`);
      if (t.spot) checkSpot(lesson.id, t.spot);
    }
  }
  ok('watch がすべて実在の計測値を指す', badWatch.length === 0, badWatch.join(' '));
  ok('spot がすべて実在の操作先を指す', badSpot.length === 0, badSpot.join(' '));

  // 文章の量。指示は一息で読める長さ、会話はひと呼吸で話せる長さ。
  // どちらも太らせると「読む教材」に逆戻りする。
  const WHO = ['scene', 'doc', 'puku', 'pt'];
  let longSay = [], longBrief = [], longQ = [], longTalk = [], badWho = [];
  let nAction = 0, nQuiz = 0, nTalk = 0, noWatch = [];
  let noOpening = [], fewTalk = [];
  for (const { lesson } of flat) {
    if (lesson.brief.length > 4) longBrief.push(lesson.id + ' 解説が 4 行超');
    for (const b of lesson.brief) if (b.length > 100) longBrief.push(`${lesson.id}:${b.length}字`);
    // レッスンは必ず場面から始まる。いきなり「◯◯を押してください」では物語にならない。
    if (!lesson.tasks[0] || !lesson.tasks[0].talk) noOpening.push(lesson.id);
    let talkHere = 0;
    for (const t of lesson.tasks) {
      if (t.talk) {
        talkHere++; nTalk++;
        if (WHO.indexOf(t.who || 'doc') < 0) badWho.push(`${lesson.id}:${t.who}`);
        if (typeof t.say === 'string' && t.say.length > 120) longTalk.push(`${lesson.id}:${t.say.length}字`);
        continue;
      }
      if (typeof t.say === 'string' && t.say.length > 48) longSay.push(`${lesson.id}:${t.say.length}字`);
      if (t.quiz && typeof t.quiz.q === 'string' && t.quiz.q.length > 62) longQ.push(`${lesson.id}:${t.quiz.q.length}字`);
      if (t.quiz) nQuiz++; else nAction++;
      // 待つだけ・見るだけの課題は、何を見ればよいかを画面で示していること
      if (t.check && !t.quiz && !t.watch && !t.spot) noWatch.push(lesson.id);
    }
    if (talkHere < 3) fewTalk.push(`${lesson.id}:${talkHere}`);
  }
  ok('指示は一息で読める長さに収まっている', longSay.length === 0, longSay.join(' '));
  ok('会話はひと呼吸で話せる長さ（120 字以内）', longTalk.length === 0, longTalk.join(' '));
  ok('解説は 4 行以内・1 行 100 字以内', longBrief.length === 0, longBrief.join(' '));
  ok('設問は 62 字以内', longQ.length === 0, longQ.join(' '));
  ok('観察の課題には必ず見どころが付いている', noWatch.length === 0, noWatch.join(' '));
  ok('話し手がすべて実在する', badWho.length === 0, badWho.join(' '));
  ok('どのレッスンも場面から始まる', noOpening.length === 0, noOpening.join(' '));
  ok('どのレッスンにも会話が 3 場面以上ある', fewTalk.length === 0, fewTalk.join(' '));
  ok('操作と観察がクイズより多い（クイズに偏っていない）', nAction > nQuiz,
    `操作・観察 ${nAction} 件 / クイズ ${nQuiz} 件 / 会話 ${nTalk} 場面`);

  // レッスンを始めた瞬間に操作へ入れること（解説ダイアログで足止めしない）
  ok('レッスン開始時に解説ダイアログを開かない',
    !/fitAll\(\);\s*\n\s*openBrief\(\);/.test(app));

  // 登場人物が口にする数値は画面の実測から差し込むこと（{PIP} のように書く）。
  // セリフに数字を書き込むと「PIP は 22」と言いながら画面は 18、というずれが起きる。
  {
    const captions = new Set([...app.matchAll(/\bk: '([^']+)'/g)].map(m => m[1]));
    const swiftDir = path.join(__dirname, '..', 'swift', 'VentilatorSim', 'Sources', 'VentilatorCore');
    const sources = { 'lessons.js': fs.readFileSync(path.join(__dirname, 'lessons.js'), 'utf8') };
    for (const f of ['LessonsChapter1to3.swift', 'LessonsChapter4to6.swift']) {
      const fp = path.join(swiftDir, f);
      if (fs.existsSync(fp)) sources[f] = fs.readFileSync(fp, 'utf8');
    }
    const unknown = [], hard = [];
    const measured = ['PIP', 'Pplat', 'PEEP tot', 'ΔP', 'Vte', 'MV', 'RR tot', 'Cstat', 'Raw',
      'auto-PEEP', 'f/VT', 'SpO₂', 'etCO₂', 'HR', 'ABP mean'];
    const hardRe = new RegExp('(?:' + measured.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
      + ') (?:は|が|も) [0-9]');
    for (const [name, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/\{([^{}\n]+)\}/g)) {
        if (/^[ _a-zA-Z0-9]*$/.test(m[1]) || /^\s/.test(m[1])) continue;   // コードの波括弧
        if (!captions.has(m[1])) unknown.push(`${name}:{${m[1]}}`);
      }
      // 会話の行（talk / .talk）に、実測値を数字で断言している文がないこと
      for (const line of src.split('\n')) {
        if (!/talk/.test(line) && !/^\s*say: '/.test(line)) continue;
        if (hardRe.test(line)) hard.push(`${name}: ${line.trim().slice(0, 60)}`);
      }
    }
    const placeholders = [...sources['lessons.js'].matchAll(/\{([^{}\n]+)\}/g)]
      .filter(m => !/^[ _a-zA-Z0-9]*$/.test(m[1]) && !/^\s/.test(m[1]));
    ok('セリフの差し込み名（{PIP} など）がすべて画面の見出しと一致する', unknown.length === 0, unknown.join(' '));
    ok('セリフが実測値を数字で断言していない（差し込みを使う）', hard.length === 0, hard.join(' / '));
    ok('差し込みを使っているセリフがある', placeholders.length >= 3, `${placeholders.length} 箇所`);
  }
}

console.log('\n19. レッスンの進行');
{
  const LS = require('./lessons.js');
  const lesson = LS.lessonById('1-2');
  const e = mk('postop', Object.assign({}, lesson.settings));
  e.sedation = 1.0; e._recomputeDrive();
  const rt = new LS.Runtime(lesson);
  const ctx = () => ({ e, s: e.s, m: e.m, pbw: e.p.pbw, abgs: [], lastAbg: null, sbt: null });
  // 会話の場面は「続ける」で読み飛ばせる。物語を挟んでも判定が壊れないことを、ここで確かめる。
  const skipTalk = (r, c) => { let n = 0; while (r.task() && r.task().talk) { r.tap(c()); n++; } return n; };

  ok('会話の場面から始まり、「続ける」で操作に着く', skipTalk(rt, ctx) > 0);
  ok('最初の課題はキー操作', rt.task().event === 'hold:insp');
  const ix0 = rt.index;
  ok('関係ないイベントでは進まない', rt.fire('hold:exp', ctx()) === null && rt.index === ix0);
  ok('正しいイベントで進む', rt.fire('hold:insp', ctx()) !== null && rt.index === ix0 + 1);

  e.requestHold('insp');
  ok('測定前は進まない', rt.poll(ctx(), 0.5) === null);
  run(e, 14, 0.005);
  ok('Pplat が出たら進む', rt.poll(ctx(), 0.5) !== null && rt.index === ix0 + 2);

  skipTalk(rt, ctx);
  ok('そのあとはクイズ', !!rt.task().quiz);
  const wrong = (rt.task().quiz.answer + 1) % rt.task().quiz.choices.length;
  const qix = rt.index;
  ok('誤答では進まない', rt.answer(wrong, ctx()).ok === false && rt.index === qix);
  ok('正解で進み、解説が返る', (() => {
    const r = rt.answer(rt.task().quiz.answer, ctx());
    return r.ok === true && r.why.length > 0 && rt.index === qix + 1;
  })());

  // hold 付きの課題は、条件を満たし続けた時間で進む。
  const l22 = LS.lessonById('2-2');
  const e2 = mk('postop', Object.assign({}, l22.settings));
  e2.sedation = 1.0; e2._recomputeDrive();
  const rt2 = new LS.Runtime(l22);
  const ctx2 = () => ({ e: e2, s: e2.s, m: e2.m, pbw: e2.p.pbw, abgs: [], lastAbg: null, sbt: null });
  e2.s.rr = 24;
  run(e2, 90, 0.005);
  const ix2 = (skipTalk(rt2, ctx2), rt2.index);
  ok('条件を満たしても hold 前は進まない', rt2.poll(ctx2(), 5) === null, `MV=${e2.m.mv.toFixed(2)}`);
  ok('満たし続ければ進む', rt2.poll(ctx2(), 30) !== null && rt2.index === ix2 + 1);

  // onStart の副作用（病態を起こす）が効くこと。
  const l51 = LS.lessonById('5-1');
  const e3 = mk('postop', Object.assign({}, l51.settings));
  e3.sedation = 1.0; e3._recomputeDrive();
  const rt3 = new LS.Runtime(l51);
  const ctx3 = () => ({ e: e3, s: e3.s, m: e3.m, pbw: e3.p.pbw, abgs: [], lastAbg: null, sbt: null });
  run(e3, 40, 0.005);
  skipTalk(rt3, ctx3);                       // 場面の説明を読み飛ばす
  rt3.poll(ctx3(), 1);                       // 1 番目（平常時の記録）を通過させる
  ok('平常時の PIP を記録した', rt3.mem.pip0 > 0, `PIP=${(rt3.mem.pip0 || 0).toFixed(1)}`);
  const r0 = e3.p.Rinsp;
  skipTalk(rt3, ctx3);
  rt3.poll(ctx3(), 1);                       // 2 番目に入ると onStart が発火する
  ok('痰づまりで気道抵抗が上がる', e3.p.Rinsp > r0 * 4, `Rinsp ${r0} → ${e3.p.Rinsp.toFixed(0)}`);
  run(e3, 30, 0.005);
  ok('PIP は上がるが Pplat はほぼ変わらない',
    e3.m.pip > rt3.mem.pip0 + 8 && Math.abs(e3.m.pplat - rt3.mem.plat0) < 3,
    `PIP ${rt3.mem.pip0.toFixed(0)}→${e3.m.pip.toFixed(0)} / Pplat ${rt3.mem.plat0.toFixed(0)}→${e3.m.pplat.toFixed(0)}`);
  ok('上限圧アラームが鳴る', e3.alarms.some(a => a.k === 'pip'),
    `PIP=${e3.m.pip.toFixed(0)} 上限=${e3.s.alarms.pMax}`);
}

console.log('\n20. レッスンの目標が到達可能か');
{
  const LS = require('./lessons.js');
  // 5-2：細気管支炎に auto-PEEP がはっきり出て、呼吸回数を下げれば消えること
  const l = LS.lessonById('5-2');
  const bad = mk('bronchiolitis', Object.assign({}, l.settings));
  bad.sedation = 1.0; bad._recomputeDrive();
  run(bad, 120, 0.005);
  expPause(bad);
  ok('初期設定で auto-PEEP がはっきり出る', bad.m.autoPeep > 3,
    `auto-PEEP=${bad.m.autoPeep.toFixed(1)} cmH2O`);

  const good = mk('bronchiolitis', Object.assign({}, l.settings, { rr: 22 }));
  good.sedation = 1.0; good._recomputeDrive();
  run(good, 180, 0.005);
  expPause(good);
  ok('呼吸回数を下げると 3 cmH2O 未満まで減る', good.m.autoPeep < 3,
    `auto-PEEP=${good.m.autoPeep.toFixed(1)} cmH2O`);

  // 4-3：小児 ARDS で PEEP を上げれば P/F が改善すること
  const l43 = LS.lessonById('4-3');
  const low = mk('ards', Object.assign({}, l43.settings));
  low.sedation = 1.0; low._recomputeDrive();
  run(low, 900, 0.01);
  const pfLow = low.pao2 / low.s.fio2;
  const high = mk('ards', Object.assign({}, l43.settings, { peep: 14 }));
  high.sedation = 1.0; high._recomputeDrive();
  run(high, 900, 0.01);
  const pfHigh = high.pao2 / high.s.fio2;
  ok('PEEP を上げると P/F が 20 以上改善する', pfHigh > pfLow + 20,
    `P/F ${pfLow.toFixed(0)} → ${pfHigh.toFixed(0)}`);
  // 課題どおり FiO2 60% まで下げても SpO2 92% 以上を保てること
  high.s.fio2 = 0.6;
  run(high, 300, 0.01);
  ok('PEEP 14 なら FiO2 60% でも SpO2 92% 以上', high.spo2 >= 92,
    `SpO2=${high.spo2.toFixed(0)}% PaO2=${high.pao2.toFixed(0)}`);

  // 4-4：肺保護の枠（Vt 6 mL/kg・年齢相応の Pplat と ΔP）が小児 ARDS で成立すること
  const l44 = LS.lessonById('4-4');
  const sc = SCENARIOS.find(s => s.id === 'ards');
  const pbw = VE.predictedBodyWeight(sc.patient);
  const prot = mk('ards', Object.assign({}, l44.settings, { vt: Math.round(pbw * 6 / 5) * 5, pause: 0.3 }));
  prot.sedation = 1.0; prot._recomputeDrive();
  run(prot, 180, 0.005);
  ok('6 mL/kg なら年齢相応の Pplat・ΔP に収まる',
    prot.m.pplat <= prot.nm.platMax && prot.m.dp <= prot.nm.dpMax,
    `Pplat=${prot.m.pplat.toFixed(0)}（上限 ${prot.nm.platMax}） ΔP=${prot.m.dp.toFixed(0)}（上限 ${prot.nm.dpMax}）`);
  // 課題どおり Vt を触らず RR だけで pH 7.25 以上に持っていけること
  const fixRR = mk('ards', Object.assign({}, l44.settings, { vt: Math.round(pbw * 6 / 5) * 5, rr: 40 }));
  fixRR.sedation = 1.0; fixRR._recomputeDrive();
  run(fixRR, 60 * 30, 0.01);
  ok('RR だけで pH 7.25 以上に届く', fixRR.ph >= 7.25,
    `pH=${fixRR.ph.toFixed(2)} PaCO2=${fixRR.paco2.toFixed(0)} RR=${fixRR.m.rrTotal.toFixed(0)}`);

  // 4-2：低換気の初期設定から、換気量を増やせば PaCO2 が目標域に入ること
  const l42 = LS.lessonById('4-2');
  const hypo = mk('postop', Object.assign({}, l42.settings));
  hypo.sedation = 1.0; hypo._recomputeDrive();
  run(hypo, 900, 0.01);
  ok('低換気の初期設定で高 CO2 になる', hypo.paco2 > 50, `PaCO2=${hypo.paco2.toFixed(0)} mmHg`);
  hypo.s.vt = 180; hypo.s.rr = 20;
  run(hypo, 900, 0.01);
  ok('MV を 3.2 以上にすると PaCO2 が目標域に入る',
    hypo.paco2 >= 33 && hypo.paco2 <= 48 && hypo.m.mv >= 3.2,
    `PaCO2=${hypo.paco2.toFixed(0)} MV=${hypo.m.mv.toFixed(2)}`);

  // 2-2：MV 3.0〜4.2 L/分 の目標が届くこと
  const l22b = LS.lessonById('2-2');
  const mvE = mk('postop', Object.assign({}, l22b.settings, { rr: 24 }));
  mvE.sedation = 1.0; mvE._recomputeDrive();
  run(mvE, 120, 0.005);
  ok('2-2 の MV 目標（3.0〜4.2）に届く', mvE.m.mv >= 3.0 && mvE.m.mv <= 4.2,
    `MV=${mvE.m.mv.toFixed(2)} L/分`);

  // 5-3：急変の課題が本当に「PIP も Pplat も上がり、Vte は変わらず、SpO2 が落ちる」形になること
  const l53 = LS.lessonById('5-3');
  const e53 = mk('postop', Object.assign({}, l53.settings));
  e53.sedation = 1.0; e53._recomputeDrive();
  run(e53, 120, 0.01);
  const before = { pip: e53.m.pip, plat: e53.m.pplat, vte: e53.m.vte, spo2: e53.spo2 };
  const rt53 = new LS.Runtime(l53);
  const ctx53 = () => ({ e: e53, s: e53.s, m: e53.m, pbw: e53.p.pbw, abgs: [], lastAbg: null, sbt: null });
  // 急変は最初のト書きに入った瞬間に起きる（語っている最中に画面の数字が落ちていくように）。
  rt53.enter(ctx53());
  while (rt53.task() && rt53.task().talk) rt53.tap(ctx53());
  rt53.enter(ctx53());
  run(e53, 300, 0.01);
  expPause(e53);
  ok('5-3 の急変で PIP も Pplat も上がる',
    e53.m.pip > before.pip + 8 && e53.m.pplat > before.plat + 8,
    `PIP ${before.pip.toFixed(0)}→${e53.m.pip.toFixed(0)} / Pplat ${before.plat.toFixed(0)}→${e53.m.pplat.toFixed(0)}`);
  ok('5-3 の急変でも Vte は保たれる（リークではない）',
    Math.abs(e53.m.vte - before.vte) < before.vte * 0.1,
    `Vte ${before.vte.toFixed(0)}→${e53.m.vte.toFixed(0)} mL`);
  ok('5-3 の急変で SpO2 が落ちる', e53.spo2 < before.spo2 - 3,
    `SpO2 ${before.spo2.toFixed(0)}→${e53.spo2.toFixed(0)}%`);
  // ドレーン後の課題で元に戻ること
  // ドレーンを入れる課題（シャントと硬さを戻す onStart を持つ）まで進める
  rt53.index = l53.tasks.findIndex(t => t.hold === 40);
  rt53.enter(ctx53());
  run(e53, 600, 0.01);
  ok('5-3 の処置で圧も酸素化も戻る',
    e53.m.pip < before.pip + 3 && e53.spo2 > before.spo2 - 2,
    `PIP=${e53.m.pip.toFixed(0)} SpO2=${e53.spo2.toFixed(0)}%`);

  // 6-1：離脱条件をすべて満たせること
  const l61 = LS.lessonById('6-1');
  const w = mk('postop', Object.assign({}, l61.settings, { peep: 5, fio2: 0.4 }));
  w.sedation = 0.2; w._recomputeDrive();
  run(w, 60 * 20, 0.01);
  ok('6-1 の離脱条件をすべて満たせる',
    w.s.fio2 <= 0.41 && w.s.peep <= 7 && (w.pao2 / w.s.fio2) >= 200 && w.ph >= 7.30
      && w.map >= w.nm.mapMin && w.sedation <= 0.4 && (w.m.rrSpont >= 4 || w.pmusAmp > 2),
    `P/F=${(w.pao2 / w.s.fio2).toFixed(0)} pH=${w.ph.toFixed(2)} MAP=${w.map.toFixed(0)}（下限 ${w.nm.mapMin}）`);
}

console.log('\n21. Web 版と iPhone 版がそろっているか');
{
  /* 片方だけ直すと、同じ教材のはずが別物になる。
   * Swift はここではコンパイルできないので、レッスンの骨格だけを突き合わせる。 */
  const LS = require('./lessons.js');
  const dir = path.join(__dirname, '..', 'swift', 'VentilatorSim', 'Sources', 'VentilatorCore');
  if (!fs.existsSync(dir)) {
    console.log('  --   swift/ が無いので省略');
  } else {
    const src = ['LessonsChapter1to3.swift', 'LessonsChapter4to6.swift']
      .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

    // Swift 側のレッスンを、id ごとに切り出す
    const swiftLessons = [];
    const head = /id: "([0-9]-[0-9])", title: "([^"]+)", minutes: (\d+)/g;
    let m, marks = [];
    while ((m = head.exec(src))) marks.push({ id: m[1], title: m[2], minutes: +m[3], at: m.index });
    marks.forEach((mk, i) => {
      const body = src.slice(mk.at, i + 1 < marks.length ? marks[i + 1].at : src.length);
      swiftLessons.push({
        id: mk.id, title: mk.title, minutes: mk.minutes,
        quizAnswers: [...body.matchAll(/answer: (\d+)/g)].map(x => +x[1]),
        watch: [...body.matchAll(/\.watching\(\[([^\]]*)\]\)/g)].map(x => x[1]),
        spot: [...body.matchAll(/\.spotting\(\[([^\]]*)\]\)/g)].map(x => x[1]),
        holds: [...body.matchAll(/hold: (\d+)/g)].map(x => +x[1]),
        // 会話の場面。話し手の並びまでそろっていること
        talk: [...body.matchAll(/\.talk\(\.(scene|doctor|puku|patient), "/g)].map(x => x[1])
      });
    });

    const js = LS.allLessons().map(x => x.lesson);
    ok('Swift 側にも 19 レッスンある', swiftLessons.length === 19, `${swiftLessons.length} 件`);

    let diff = [];
    for (const l of js) {
      const sw = swiftLessons.find(x => x.id === l.id);
      if (!sw) { diff.push(l.id + ' が Swift に無い'); continue; }
      if (sw.title !== l.title) diff.push(`${l.id} の題が違う`);
      if (sw.minutes !== l.minutes) diff.push(`${l.id} の所要時間 ${l.minutes}/${sw.minutes}`);
      const jsAnswers = l.tasks.filter(t => t.quiz).map(t => t.quiz.answer);
      if (jsAnswers.join(',') !== sw.quizAnswers.join(',')) {
        diff.push(`${l.id} のクイズの正解 [${jsAnswers}] / [${sw.quizAnswers}]`);
      }
      const jsHolds = l.tasks.filter(t => t.hold).map(t => t.hold);
      if (jsHolds.join(',') !== sw.holds.join(',')) {
        diff.push(`${l.id} の保持秒数 [${jsHolds}] / [${sw.holds}]`);
      }
      const WHO = { scene: 'scene', doc: 'doctor', puku: 'puku', pt: 'patient' };
      const jsTalk = l.tasks.filter(t => t.talk).map(t => WHO[t.who || 'doc']);
      if (jsTalk.join(',') !== sw.talk.join(',')) {
        diff.push(`${l.id} の会話 ${jsTalk.length} 場面 / ${sw.talk.length} 場面`);
      }
      const jsWatch = l.tasks.filter(t => t.watch).length;
      const jsSpot = l.tasks.filter(t => t.spot).length;
      if (jsWatch !== sw.watch.length) diff.push(`${l.id} の watch の数 ${jsWatch}/${sw.watch.length}`);
      if (jsSpot !== sw.spot.length) diff.push(`${l.id} の spot の数 ${jsSpot}/${sw.spot.length}`);
    }
    ok('題・所要時間・クイズの正解・保持秒数・見どころ・会話がそろっている', diff.length === 0,
       diff.join(' / '));
  }
}

console.log('\n22. 肺の 3D ビュー（lung3d.js は表示用の物理を持たない）');
{
  const LU = require('./lung3d.js');

  // 体格から決まる基準値
  let frcOk = true, tlcOk = true, order = [];
  for (const sc of SCENARIOS) {
    const kg = sc.patient.weightKg;
    if (!near(LU.frcFor(kg), 0.030 * kg, 1e-9)) frcOk = false;
    if (!near(LU.tlcFor(kg), 0.080 * kg, 1e-9)) tlcOk = false;
    order.push([kg, LU.lungHeightCm(kg)]);
  }
  ok('FRC は全症例で 30 mL/kg', frcOk);
  ok('TLC は全症例で 80 mL/kg', tlcOk);
  order.sort((a, b) => a[0] - b[0]);
  let mono = true, inRange = true;
  for (let i = 0; i < order.length; i++) {
    if (i && order[i][1] <= order[i - 1][1]) mono = false;
    if (order[i][1] < 5 || order[i][1] > 25) inRange = false;
  }
  ok('肺の高さが体重の順に大きくなる', mono,
    order.map(o => `${o[0]}kg:${o[1].toFixed(1)}cm`).join(' '));
  ok('肺の高さが小児の範囲（5〜25 cm）に収まる', inRange);

  // エンジンの実測値をそのまま写していること
  {
    const e = mk('postop');
    e.sedation = 1.0; e.pmusAmp = 0; e._recomputeDrive();
    run(e, 30);
    const m = LU.readModel(e);
    ok('肺のガス量 ＝ FRC ＋ エンジンの V', near(m.gas, LU.frcFor(e.p.pbw) + e.V, 1e-12),
      `${(m.gas * 1000).toFixed(1)} mL`);
    ok('肺胞圧 ＝ V/C（エンジンと同じ式）', near(m.palv, e.V / e.C, 1e-12),
      `${m.palv.toFixed(2)} cmH2O`);
    ok('コンプライアンスと抵抗はエンジンの値そのもの',
      m.C === e.C && (m.R === e.p.Rinsp || m.R === e.p.Rexp));
  }

  // 運動方程式 Paw = V/C + R·V̇ − Pmus が表示側でも閉じていること。
  // 呼気相は離散化の分だけずれるので、刻みを細かくすると誤差が縮むことも見る。
  function worstResidual(id, dt) {
    const e = mk(id);
    e.sedation = 1.0; e.pmusAmp = 0; e._recomputeDrive();
    run(e, 20, dt);
    let worst = 0;
    const n = Math.round(20 / dt);
    for (let i = 0; i < n; i++) {
      e.step(dt, false);
      if (e.hold || e.phase === 'pause') continue;   // ポーズ中は測定用に別式を使う
      const m = LU.readModel(e);
      worst = Math.max(worst, Math.abs(LU.termsOf(m).sum - m.paw));
    }
    return worst;
  }
  for (const id of ['postop', 'bronchiolitis', 'asthma']) {
    const w = worstResidual(id, 0.005);
    ok(`${id}：3 項の和が気道内圧に一致`, w < 0.25, `最大誤差 ${w.toFixed(3)} cmH2O`);
  }
  {
    const coarse = worstResidual('rds', 0.005), fine = worstResidual('rds', 0.0005);
    ok('rds：誤差は離散化由来（刻みを 1/10 にすると縮む）', fine < coarse * 0.35,
      `${coarse.toFixed(3)} → ${fine.toFixed(3)} cmH2O`);
  }

  // 病態が形の指標に出ること
  function model(id) {
    const e = mk(id);
    e.sedation = 1.0; e.pmusAmp = 0; e._recomputeDrive();
    run(e, 60);
    while (e.phase !== 'insp') e.step(0.002, false);   // 吸気の頭でそろえる
    return { e, m: LU.readModel(e) };
  }
  const M = {};
  for (const id of ['postop', 'gbs', 'rds', 'ards', 'bronchiolitis', 'asthma']) M[id] = model(id);

  ok('正常肺はコンプライアンス正常比 0.8〜1.2',
    M.postop.m.cRatio > 0.8 && M.postop.m.cRatio < 1.2 &&
    M.gbs.m.cRatio > 0.8 && M.gbs.m.cRatio < 1.2,
    `postop ×${M.postop.m.cRatio.toFixed(2)} gbs ×${M.gbs.m.cRatio.toFixed(2)}`);
  ok('硬い肺（RDS・ARDS）は正常比 0.7 未満で硬さが立つ',
    M.rds.m.cRatio < 0.7 && M.ards.m.cRatio < 0.7 &&
    M.rds.m.stiff > 0.3 && M.ards.m.stiff > 0.3,
    `rds ×${M.rds.m.cRatio.toFixed(2)}(硬さ ${M.rds.m.stiff.toFixed(2)}) ` +
    `ards ×${M.ards.m.cRatio.toFixed(2)}(硬さ ${M.ards.m.stiff.toFixed(2)})`);
  ok('正常肺は気道抵抗も正常比 1.5 倍未満で気道が細くならない',
    M.postop.m.rRatio < 1.5 && M.gbs.m.rRatio < 1.5 && M.gbs.m.narrow < 0.2,
    `postop ×${M.postop.m.rRatio.toFixed(2)} gbs ×${M.gbs.m.rRatio.toFixed(2)}`);
  ok('細気管支炎と喘息は気道抵抗 3 倍以上で気道が細く描かれる',
    M.bronchiolitis.m.rRatio > 3 && M.asthma.m.rRatio > 3 &&
    M.bronchiolitis.m.narrow > 0.6 && M.asthma.m.narrow > 0.6,
    `細気管支炎 ×${M.bronchiolitis.m.rRatio.toFixed(1)} 喘息 ×${M.asthma.m.rRatio.toFixed(1)}`);
  ok('つぶれた肺胞の割合はシャントそのもの',
    near(M.ards.m.collapse, M.ards.e.shunt, 1e-12) && M.ards.m.collapse > 0.1,
    `ARDS ${(M.ards.m.collapse * 100).toFixed(0)}%`);
  let ratio01 = true;
  for (const id in M) {
    const m = M[id].m;
    if (m.narrow < 0 || m.narrow > 1 || m.stiff < 0 || m.stiff > 1 ||
        m.over < 0 || m.over > 1 || m.collapse < 0 || m.collapse > 1) ratio01 = false;
  }
  ok('形の指標（硬さ・細さ・過膨張・虚脱）は 0〜1 に収まる', ratio01);

  // 設定を変えると表示も動くこと（PEEP を上げれば肺は膨らみシャントは減る）
  {
    const lo = mk('ards', { peep: 5 }), hi = mk('ards', { peep: 14 });
    for (const e of [lo, hi]) { e.sedation = 1.0; e.pmusAmp = 0; e._recomputeDrive(); run(e, 180, 0.01); }
    while (lo.phase !== 'insp') lo.step(0.002, false);
    while (hi.phase !== 'insp') hi.step(0.002, false);
    const a = LU.readModel(lo), b = LU.readModel(hi);
    ok('PEEP を上げると肺のガス量と膨らみが増える', b.gas > a.gas && b.fill > a.fill,
      `${(a.gas * 1000).toFixed(0)} → ${(b.gas * 1000).toFixed(0)} mL`);
    ok('PEEP を上げるとつぶれた肺胞が減る', b.collapse < a.collapse,
      `${(a.collapse * 100).toFixed(0)}% → ${(b.collapse * 100).toFixed(0)}%`);
  }

  // 肺は TLC を超えて膨らませない前提の指標であること
  {
    const e = mk('postop', { vt: 700, rr: 12 });
    e.s.alarms.pMax = 90;                 // 圧リミットで頭打ちにならないようにする
    e.sedation = 1.0; e.pmusAmp = 0; e._recomputeDrive();
    run(e, 40);
    let maxFill = 0, over = 0;
    for (let i = 0; i < 4000; i++) {
      e.step(0.005, false);
      const m = LU.readModel(e);
      maxFill = Math.max(maxFill, m.fill); over = Math.max(over, m.over);
    }
    ok('大きすぎる一回換気量で過膨張が立つ', over > 0.2 && maxFill > 0.3,
      `fill=${(maxFill * 100).toFixed(0)}% 過膨張=${over.toFixed(2)}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
