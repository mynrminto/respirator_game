/* 成人版（web/adult/）の検証。node web/test-adult.js
 * エンジンは小児版と共通なので、ここでは成人の基準値・成人 6 症例の病態・レッスンと物語の構造・
 * 全レッスンの通しプレイ（tools/autoplay.js、VENT_EDITION=adult）を見る。
 * 構造の検査は test.js の 18・18b・23・25・26・28 番と同じ基準にそろえてある。 */
process.env.VENT_EDITION = 'adult';
const fs = require('fs');
const path = require('path');
const VE = require('./engine.js');
const SC = require('./adult/scenarios.js');
const LS = require('./adult/lessons.js');
const ST = require('./adult/story.js');
const ED = (() => { globalThis.VENT_EDITION = 'adult'; return require('./edition.js'); })();
const { SCENARIOS } = SC;

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
}
function scen(id) { return JSON.parse(JSON.stringify(SCENARIOS.find(s => s.id === id))); }
function mk(id, over, sed) {
  const sc = scen(id);
  const st = VE.defaultSettings();
  Object.assign(st, sc.suggested, over || {});
  const nm = VE.normsFor(sc.patient);
  st.alarms = VE.alarmsFor(VE.predictedBodyWeight(sc.patient), nm, st.vt, st.rr);
  const e = new VE.Engine(sc.patient, st);
  if (sed != null) { e.sedation = sed; e._recomputeDrive(); }
  return e;
}
function run(e, seconds, dt) {
  dt = dt || 0.01;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) e.step(dt, false);
}
function expPause(e) {
  while (e.phase !== 'insp') e.step(0.002, false);
  e.requestHold('exp');
  run(e, 14, 0.005);
}

console.log('\n1. 成人の基準値と予測体重');
{
  const p = scen('postop').patient;
  const nm = VE.normsFor(p);
  ok('18 歳以上は「成人」の基準', nm.label === '成人' && nm.rr[0] === 12 && nm.rr[1] === 20
    && nm.platMax === 30 && nm.dpMax === 15 && nm.mapMin === 65, JSON.stringify(nm.rr));
  const pbw = VE.predictedBodyWeight(p);
  ok('設定の基準は身長からの予測体重（実体重ではない）', Math.abs(pbw - 66.0) < 0.5 && !p.weightKg,
    `PBW ${pbw.toFixed(1)} kg（実体重 ${p.bodyKg} kg）`);
  ok('女性の予測体重', Math.abs(VE.predictedBodyWeight(scen('ards').patient) - 50.6) < 0.5);
  const L = VE.limitsFor(pbw, nm);
  ok('一回換気量のダイヤルは 10 mL 刻みで 6〜8 mL/kg を含む', L.vt.step === 10 && L.vt.min <= pbw * 6 && L.vt.max >= pbw * 8,
    `${L.vt.min}〜${L.vt.max} mL`);
  ok('症例はすべて成人で、実体重を設定の基準にしていない',
    SCENARIOS.every(s => s.patient.age >= 18 && !s.patient.weightKg && s.patient.bodyKg > 0));
  ok('症例は 6 例で、ID が重ならない', SCENARIOS.length === 6 && new Set(SCENARIOS.map(s => s.id)).size === 6);
}

console.log('\n2. 症例が意図した状態で始まる（推奨初期設定で 10 分）');
for (const s of SCENARIOS) {
  const e = mk(s.id, {}, 1.0);
  run(e, 600);
  const finite = [e.ph, e.paco2, e.pao2, e.spo2, e.hr, e.map].every(Number.isFinite);
  ok(`${s.id}: 値が有限で、SpO₂ ${e.spo2.toFixed(0)}% / MAP ${e.map.toFixed(0)}`, finite && e.spo2 > 80 && e.map > 40,
    `pH ${e.ph.toFixed(2)} PaCO2 ${e.paco2.toFixed(0)} PIP ${e.m.pip.toFixed(0)}`);
}

console.log('\n3. 成人の病態');
{
  const fast = mk('copd', { rr: 24 }, 1.0); run(fast, 600); expPause(fast);
  const slow = mk('copd', { rr: 12 }, 1.0); run(slow, 600); expPause(slow);
  ok('COPD：呼吸数を上げると auto-PEEP、下げると消える', fast.m.autoPeep > 3 && slow.m.autoPeep < 2,
    `RR24 ${fast.m.autoPeep.toFixed(1)} → RR12 ${slow.m.autoPeep.toFixed(1)} cmH2O`);
  const lo = mk('ards', { vt: 300, rr: 28, peep: 6 }, 1.0); run(lo, 900);
  const hi = mk('ards', { vt: 300, rr: 28, peep: 14 }, 1.0); run(hi, 900);
  ok('ARDS：PEEP を上げると P/F が改善し、血圧は下がる',
    hi.pao2 / hi.s.fio2 > lo.pao2 / lo.s.fio2 + 20 && hi.map < lo.map,
    `P/F ${(lo.pao2 / lo.s.fio2).toFixed(0)} → ${(hi.pao2 / hi.s.fio2).toFixed(0)}、MAP ${lo.map.toFixed(0)} → ${hi.map.toFixed(0)}`);
  const prot = mk('ards', { vt: 300, rr: 28, peep: 10, pause: 0.3 }, 1.0); run(prot, 300);
  ok('ARDS：6 mL/kg なら Pplat 30・ΔP 15 以下', prot.m.pplat <= 30 && prot.m.dp <= 15,
    `Pplat ${prot.m.pplat.toFixed(0)} ΔP ${prot.m.dp.toFixed(0)}`);
  const w5 = mk('chf', { peep: 5 }, 1.0); run(w5, 900);
  const w10 = mk('chf', { peep: 10 }, 1.0); run(w10, 900);
  ok('心原性肺水腫：PEEP で酸素化が大きく改善する', w10.spo2 > w5.spo2 + 4,
    `SpO2 ${w5.spo2.toFixed(0)} → ${w10.spo2.toFixed(0)}%`);
  const g = mk('gbs', { mode: 'PSV', ps: 5, peep: 5 }, 0.2); run(g, 1500);
  ok('GBS：SBT で浅く速い呼吸になり、RSBI が 105 を超える', g.m.rsbi > 105, `RSBI ${g.m.rsbi.toFixed(0)}`);
  const pt = mk('postop', { mode: 'PSV', ps: 5, peep: 5 }, 0.2); run(pt, 600);
  ok('術後：肺が正常なら SBT の RSBI は 105 未満', pt.m.rsbi < 105, `RSBI ${pt.m.rsbi.toFixed(0)}`);
  const a = mk('asthma', { rr: 22 }, 1.0); run(a, 600); expPause(a);
  const a2 = mk('asthma', { rr: 10 }, 1.0); run(a2, 600); expPause(a2);
  ok('喘息：呼吸数を下げると auto-PEEP が減る（そのぶん CO₂ は許す）', a2.m.autoPeep < a.m.autoPeep - 3 && a2.paco2 > a.paco2,
    `auto-PEEP ${a.m.autoPeep.toFixed(1)}→${a2.m.autoPeep.toFixed(1)} MAP ${a.map.toFixed(0)}→${a2.map.toFixed(0)}`);
}

console.log('\n4. 版の切り替え（edition.js と build.js）');
{
  ok('成人版の RSBI は f ÷ Vt[L]、上限 105', ED.adult && ED.fvt.limit === 105 && ED.fvt.get({ rsbi: 80, rsbiKg: 3 }) === 80);
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  ok('index.html が edition.js を app.js・title.js より前に読む',
    html.indexOf('src="edition.js"') > 0 && html.indexOf('src="edition.js"') < html.indexOf('src="title.js"')
    && html.indexOf('src="edition.js"') < html.indexOf('src="app.js"'));
  const { execFileSync } = require('child_process');
  const tmp = path.join(require('os').tmpdir(), 'vent-adult-dev.html');
  execFileSync(process.execPath, [path.join(__dirname, 'build.js'), '--edition', 'adult', '--dev', tmp]);
  const a = fs.readFileSync(tmp, 'utf8');
  ok('build.js --edition adult が成人版のデータと版の印を差し込む',
    /window\.VENT_EDITION = 'adult'/.test(a) && ['scenarios', 'lessons', 'story'].every(f => a.includes(`src="adult/${f}.js"`))
    && !a.includes('こどもの人工呼吸器') && a.includes('おとなの人工呼吸器'));
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  ok('成人版は小児の患者画像を使わない', /ED\.adult \? \['patient_adult_'/.test(app));
}

console.log('\n5. 学習コースの構造');
{
  const flat = LS.allLessons();
  ok('11 章 33 レッスン（小児版と同じ ID）', LS.CHAPTERS.length === 11 && flat.length === 33,
    `${LS.CHAPTERS.length} 章 / ${flat.length} レッスン`);
  const ids = flat.map(x => x.lesson.id);
  ok('レッスン ID が重複しない', new Set(ids).size === ids.length);
  const scenIds = new Set(SCENARIOS.map(s => s.id));
  let badScenario = [], badSetting = [], badTask = [], badQuiz = [];
  const settingKeys = new Set(Object.keys(VE.defaultSettings()));
  for (const { lesson } of flat) {
    if (!scenIds.has(lesson.scenario)) badScenario.push(lesson.id);
    for (const k of Object.keys(lesson.settings || {})) if (!settingKeys.has(k)) badSetting.push(lesson.id + ':' + k);
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
  ok('すべて成人版の症例を指している', badScenario.length === 0, badScenario.join(','));
  ok('設定の上書きキーがエンジンに存在する', badSetting.length === 0, badSetting.join(','));
  ok('解説と要点がそろっている', badTask.length === 0, badTask.join(' / '));
  ok('クイズの正解番号と選択肢が妥当', badQuiz.length === 0, badQuiz.join(','));
  let outside = [];
  for (const { lesson } of flat) {
    const sc = SCENARIOS.find(s => s.id === lesson.scenario);
    if (!sc) continue;
    const L = VE.limitsFor(VE.predictedBodyWeight(sc.patient), VE.normsFor(sc.patient));
    const st = lesson.settings || {};
    const chk = (k, v) => { if (v != null && L[k] && (v < L[k].min || v > L[k].max)) outside.push(`${lesson.id}:${k}=${v}`); };
    chk('vt', st.vt); chk('rr', st.rr); chk('ti', st.ti); chk('flow', st.flow);
    chk('pinsp', st.pinsp); chk('ps', st.ps); chk('trig', st.trigFlow); chk('pause', st.pause);
  }
  ok('レッスンの初期設定がすべてダイヤルの範囲内', outside.length === 0, outside.join(' '));
  // 小児の言葉が残っていないこと
  const src = fs.readFileSync(path.join(__dirname, 'adult', 'lessons.js'), 'utf8')
    + fs.readFileSync(path.join(__dirname, 'adult', 'story.js'), 'utf8');
  const kids = ['ハルト', 'あおい君', 'そうた', 'ミオちゃん', 'レン君', 'あかりちゃん', 'PICU', 'NICU', '男児', '女児',
    '保育器', 'カフなし', '小児科', 'こども', '子ども', '乳児', '早産児', '細気管支炎', 'サーファクタント'];
  const left = kids.filter(w => src.includes(w));
  ok('小児の呼び名・病棟・用語が残っていない', left.length === 0, left.join(' '));
}

console.log('\n6. 教材は読み物ではなく操作であること（test.js 18b と同じ基準）');
{
  const flat = LS.allLessons();
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const block = (open, close) => { const i = app.indexOf(open); return i < 0 ? '' : app.slice(i, app.indexOf(close, i)); };
  const valKeys = new Set([...block('var VALS = [', '\n  ];').matchAll(/\{ k: '([^']+)'/g)].map(m => m[1]));
  const keyIds = new Set([...block('var P = {', '\n  };').matchAll(/^\s+([a-z0-9]+):\s+\{ k: '/gm)].map(m => m[1]));
  const hardIds = new Set([...html.matchAll(/class="hkey[^"]*" id="([^"]+)"/g)].map(m => m[1]));
  const modeIds = new Set([...app.matchAll(/\{ id: '([A-Z-]+(?:-[A-Z]+)?)', label:/g)].map(m => m[1]));
  let badWatch = [], badSpot = [];
  const checkSpot = (id, spec) => {
    for (const one of (Array.isArray(spec) ? spec : [spec])) {
      const i = one.indexOf(':');
      const kind = i < 0 ? one : one.slice(0, i), arg = i < 0 ? '' : one.slice(i + 1);
      if (kind === 'dial' || kind === 'wave') continue;
      if (kind === 'lane' && ['paw', 'flow', 'vol'].includes(arg)) continue;
      if (kind === 'val' && valKeys.has(arg)) continue;
      if (kind === 'key' && keyIds.has(arg)) continue;
      if (kind === 'hard' && hardIds.has(arg)) continue;
      if (kind === 'mode' && modeIds.has(arg)) continue;
      if (kind === 'screen' && ['wave', 'loops', 'trend'].includes(arg)) continue;
      badSpot.push(`${id}:${one}`);
    }
  };
  for (const { lesson } of flat) for (const t of lesson.tasks) {
    for (const w of t.watch || []) if (!valKeys.has(w)) badWatch.push(`${lesson.id}:${w}`);
    if (t.spot) checkSpot(lesson.id, t.spot);
    if (t.look) checkSpot(lesson.id, t.look);
  }
  ok('watch がすべて実在の計測値を指す', badWatch.length === 0, badWatch.join(' '));
  ok('spot がすべて実在の操作先を指す', badSpot.length === 0, badSpot.join(' '));

  const WHO = ['scene', 'doc', 'puku', 'pt'];
  let longSay = [], longBrief = [], longQ = [], longTalk = [], badWho = [], noWatch = [], noOpening = [], fewTalk = [];
  let nAction = 0, nQuiz = 0;
  for (const { lesson } of flat) {
    if (lesson.brief.length > 4) longBrief.push(lesson.id + ' 解説が 4 行超');
    for (const b of lesson.brief) if (b.length > 100) longBrief.push(`${lesson.id}:${b.length}字`);
    if (!lesson.tasks[0] || !lesson.tasks[0].talk) noOpening.push(lesson.id);
    let talkHere = 0;
    for (const t of lesson.tasks) {
      if (t.talk) {
        talkHere++;
        if (WHO.indexOf(t.who || 'doc') < 0) badWho.push(`${lesson.id}:${t.who}`);
        if (typeof t.say === 'string' && t.say.length > 120) longTalk.push(`${lesson.id}:${t.say.length}字`);
        continue;
      }
      if (typeof t.say === 'string' && t.say.length > 48) longSay.push(`${lesson.id}:${t.say.length}字`);
      if (t.quiz && typeof t.quiz.q === 'string' && t.quiz.q.length > 62) longQ.push(`${lesson.id}:${t.quiz.q.length}字`);
      if (t.quiz) nQuiz++; else nAction++;
      if (t.check && !t.quiz && !t.watch && !t.spot) noWatch.push(lesson.id);
    }
    if (talkHere < 3) fewTalk.push(`${lesson.id}:${talkHere}`);
  }
  ok('指示は一息で読める長さ（48 字以内）', longSay.length === 0, longSay.join(' '));
  ok('会話はひと呼吸で話せる長さ（120 字以内）', longTalk.length === 0, longTalk.join(' '));
  ok('解説は 4 行以内・1 行 100 字以内', longBrief.length === 0, longBrief.join(' '));
  ok('設問は 62 字以内', longQ.length === 0, longQ.join(' '));
  ok('観察の課題には必ず見どころが付いている', noWatch.length === 0, noWatch.join(' '));
  ok('話し手がすべて実在する', badWho.length === 0, badWho.join(' '));
  ok('どのレッスンも場面から始まる', noOpening.length === 0, noOpening.join(' '));
  ok('どのレッスンにも会話が 3 場面以上ある', fewTalk.length === 0, fewTalk.join(' '));
  ok('操作と観察がクイズより多い', nAction > nQuiz, `操作・観察 ${nAction} / クイズ ${nQuiz}`);

  const captions = new Set([...app.matchAll(/\bk: '([^']+)'/g)].map(m => m[1]));
  captions.add('名前');
  const src = fs.readFileSync(path.join(__dirname, 'adult', 'lessons.js'), 'utf8');
  const unknown = [], hard = [];
  const measured = ['PIP', 'Pplat', 'PEEP tot', 'ΔP', 'Vte', 'MV', 'RR tot', 'Cstat', 'Raw',
    'auto-PEEP', 'f/VT', 'SpO₂', 'etCO₂', 'HR', 'ABP mean'];
  const hardRe = new RegExp('(?:' + measured.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ') (?:は|が|も) [0-9]');
  for (const m of src.matchAll(/\{([^{}\n]+)\}/g)) {
    if (/^[ _a-zA-Z0-9]*$/.test(m[1]) || /^\s/.test(m[1])) continue;
    if (!captions.has(m[1])) unknown.push(`{${m[1]}}`);
  }
  for (const line of src.split('\n')) {
    if (!/talk/.test(line) && !/^\s*say: '/.test(line)) continue;
    if (hardRe.test(line)) hard.push(line.trim().slice(0, 60));
  }
  ok('セリフの差し込み名がすべて画面の見出しと一致する', unknown.length === 0, unknown.join(' '));
  ok('セリフが実測値を数字で断言していない', hard.length === 0, hard.join(' / '));
}

console.log('\n7. 患者情報');
{
  const byId = id => SCENARIOS.find(s => s.id === id);
  const p = SC.patientProfile(byId('postop'));
  ok('呼び名・年齢・性別・病棟・予測体重・実体重が出る',
    p.name === '佐藤さん' && p.ageSex === '68歳 男性' && p.ward === 'ICU' && p.weight === '66 kg'
    && p.weightLabel === '予測体重' && p.bodyWeight === '72 kg', JSON.stringify(p));
  ok('どの症例にも物語の呼び名がある', SCENARIOS.every(s => !!s.nickname));
  const t = SC.targetsFor(mk('postop', {}));
  ok('一回換気量の目安は予測体重 × 6〜8 mL/kg', t[0].v === '6〜8 mL/kg' && /^400〜530 mL/.test(t[0].sub), t[0].sub);
  let badName = [];
  for (const { lesson } of LS.allLessons()) for (const t2 of lesson.tasks) {
    if (typeof t2.say !== 'string') continue;
    for (const m of t2.say.matchAll(/([一-龥]{1,3}さん)/g)) {
      if (/^(患者|看護師|奥|旦那|娘|息子|お子|皆|みな)/.test(m[1])) continue;
      if (!SCENARIOS.find(s => s.nickname === m[1]) && !/(奥さん|娘さん|息子さん)$/.test(m[1])) badName.push(lesson.id + ':' + m[1]);
    }
  }
  ok('レッスンに出てくる患者の呼び名がすべて症例に登録されている', badName.length === 0, [...new Set(badName)].join(' '));
}

console.log('\n8. 物語');
{
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'manifest.json'), 'utf8'));
  const ids = ST.SCENES.map(s => s.id);
  ok('プロローグで始まりエピローグで終わる', ids[0] === 'prologue' && ids[ids.length - 1] === 'epilogue');
  const missing = [];
  for (const ch of LS.CHAPTERS) for (const k of ['-open', '-close']) if (!ST.sceneById(ch.id + k)) missing.push(ch.id + k);
  ok('どの章にも扉と幕がある', missing.length === 0, missing.join(' '));
  ok('章の扉の文字が章の題と一致する', ST.SCENES.filter(s => s.kind === 'open').every(s => {
    const ch = LS.CHAPTERS.find(c => c.id === s.chapter);
    return ch && ch.title.replace(/^第\d+章\s*/, '') === s.card.title && s.card.kicker === ch.title.match(/^第\d+章/)[0];
  }));
  const WHO = ['scene', 'doc', 'puku', 'me', 'nurse', 'pt', 'fam'];
  const MOOD = { doc: ['normal', 'happy', 'think', 'alert'], puku: ['happy', 'excited', 'sad', 'alert'] };
  const bad = [], long = [], names = [], badBg = [];
  let nameLines = 0;
  ST.SCENES.forEach(s => {
    if (!ST.BG[s.bg]) badBg.push(s.id + ':' + s.bg);
    s.lines.forEach(l => {
      if (WHO.indexOf(l.who) < 0) bad.push(`${s.id}:${l.who}`);
      if ((l.who === 'pt' || l.who === 'fam') && !l.name) bad.push(`${s.id}:${l.who} に呼び名が無い`);
      if (l.case && !SCENARIOS.find(x => x.id === l.case)) bad.push(`${s.id}:${l.case}`);
      if (l.bg && !ST.BG[l.bg]) badBg.push(s.id + ':' + l.bg);
      if (l.mood && MOOD[l.who] && MOOD[l.who].indexOf(l.mood) < 0) badBg.push(`${s.id}:${l.who}/${l.mood}`);
      const filled = ST.fill(l.say, 'あいうえおかきく');
      if (filled.length > 72) long.push(`${s.id}:${filled.length}字`);
      for (const m of l.say.matchAll(/\{([^{}]+)\}/g)) if (m[1] !== '名前') names.push(`${s.id}:{${m[1]}}`);
      if (l.input === 'name') nameLines++;
      for (const c of l.choose || []) if (!c.label || !c.reply || c.reply.length > 72) bad.push(`${s.id}: 選択肢`);
    });
  });
  ok('話し手・患者の症例・選択肢が正しい', bad.length === 0, bad.join(' '));
  ok('台詞は会話窓に収まる長さ（名前込みで 72 字以内）', long.length === 0, long.join(' '));
  ok('差し込みは {名前} だけ', names.length === 0, names.join(' '));
  ok('背景の名前と表情が実在する', badBg.length === 0, badBg.join(' '));
  ok('名前を聞くのはプロローグの 1 回だけ', nameLines === 1);
  ok('どの背景も、今ある絵のどれかで表示できる', Object.keys(ST.BG).every(k => ST.BG[k].some(n => manifest[n])));
  ok('最後の章のあとにエピローグ', ST.LAST_CHAPTER === LS.CHAPTERS[LS.CHAPTERS.length - 1].id
    && JSON.stringify(ST.after('11-2', LS.chapterOf('11-2'), [])) === JSON.stringify(['ch11-close', 'epilogue']));
  ok('どの章にも BGM の時刻がある', LS.CHAPTERS.every(ch => ST.CHAPTER_TIME[ch.id] === 'day' || ST.CHAPTER_TIME[ch.id] === 'night'));
}

console.log('\n9. 全レッスンを機械で通しプレイする（tools/autoplay.js）');
{
  const AP = require('./tools/autoplay.js');
  const ids = LS.allLessons().map(x => x.lesson.id);
  const failed = [], badExt = [], noPlan = [];
  for (const id of ids) {
    if (!AP.SOLVE[id]) noPlan.push(id);
    try {
      const r = AP.play(id);
      if (!r.ok) failed.push(id);
      if (r.ext && !r.ext.ok) badExt.push(id + ':' + r.ext.list.join('/'));
    } catch (err) { failed.push(err.message); }
  }
  ok('全レッスンに手順がある', noPlan.length === 0, noPlan.join(' '));
  ok('全 33 レッスンが、プレイヤーの手順で最後まで進む', failed.length === 0, failed.join(' / '));
  ok('抜管の課題はすべて抜管成功で終わる', badExt.length === 0, badExt.join(' '));
  const late = LS.CHAPTERS.slice(6);
  const cases = new Set(late.reduce((a, ch) => a.concat(ch.lessons.map(l => l.scenario)), []));
  ok('佐藤さん以外の 5 人が、それぞれ 1 章ずつ受け持たれる', ['copd', 'ards', 'chf', 'asthma', 'gbs'].every(c => cases.has(c)));
  ok('第7〜11章はどれも抜管で終わる', late.every(ch => ch.lessons[ch.lessons.length - 1].tasks.some(t => t.event === 'extubate')));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
