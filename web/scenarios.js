/* VentSim — 症例データ。コードを触らずに症例を足せるよう、パラメータだけで病態を表す。
 * すべて小児（新生児〜思春期）。設定の基準は予測体重ではなく実体重（weightKg）。
 * ageMonths から年齢相応の呼吸数・心拍・血圧・圧の上限が決まる（engine.js の ageNorms）。
 * tone は患者の絵の顔色（ok / mid / bad）。年齢層は ageMonths から自動で決まるので持たない。
 * ward は入室している病棟、nickname は学習コースの物語での呼び名（物語に出てこない症例は持たない）。 */
(function (root) {
  'use strict';

  var SCENARIOS = [
    {
      id: 'postop', tone: 'ok',
      ward: 'PICU',  nickname: 'ハルト君',
      title: '小児外科術後の呼吸管理',
      tag: '入門',
      oneLine: '肺はほぼ正常。体重あたりの初期設定と離脱の流れを一通り通す症例。',
      history: '8歳 男児、体重 25 kg、身長 126 cm。穿孔性虫垂炎による腹膜炎で緊急開腹術。'
        + '手術室から挿管のまま PICU に入室した。麻酔から覚めきっておらず、自発呼吸はほとんどない。'
        + '胸部X線は両下肺にわずかな無気肺があるのみ。',
      findings: ['体温 37.2℃', '心拍 100 /分', '血圧 96/58 mmHg（平均 68）', '胸部聴診：左右差なし',
        '気管チューブ：カフ付き 5.5 mm、口角 17 cm'],
      teaching: ['体重あたり（mL/kg）で一回換気量を決める', '小児の正常呼吸数に合わせる',
        'FiO2 を早く下げる', 'SBT から抜管までの流れ'],
      patient: {
        name: '8歳 男児', sex: 'M', heightCm: 126, age: 8, ageMonths: 96, weightKg: 25,
        ageLabel: '8歳', vdCircuit: 12,
        compliance: 0.0200, Rinsp: 14, Rexp: 17,
        shunt0: 0.12, shuntMin: 0.06, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.04,
        vco2: 105, hb: 11.0, hco3: 24, hco3Base: 24, paco2: 42, pao2: 92,
        co: 3.3, hr: 100, map: 68, temp: 37.2,
        sedation: 0.85, driveGain: 1.0, maxPmus: 22, co2Setpoint: 40,
        goals: { ph: [7.32, 7.46], paco2: [33, 48], pao2: [70, 120] }
      },
      suggested: { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4,
        flow: 18, ti: 0.7, pinsp: 12, ps: 8, rise: 0.12, trigFlow: 1.0, pause: 0 }
    },
    {
      id: 'rds', tone: 'mid',
      ward: 'NICU',
      title: '早産児の呼吸窮迫症候群（RDS）',
      tag: '新生児',
      oneLine: 'サーファクタント投与後の硬い肺。mL 単位の換気量と短い吸気時間を扱う。',
      history: '在胎 28週2日、日齢 1、体重 1,100 g。出生直後から呻吟と陥没呼吸。'
        + '気管挿管しサーファクタントを 1 回投与した。胸部X線はすりガラス様陰影と air bronchogram。'
        + '動脈管は開存しているが治療は要していない。',
      findings: ['体温 36.9℃（保育器内）', '心拍 150 /分', '平均血圧 32 mmHg', 'Hb 16.0 g/dL',
        '気管チューブ：カフなし 2.5 mm、口角 7 cm'],
      teaching: ['一回換気量は 4〜6 mL/kg（＝ 4〜7 mL）', '吸気時間 0.3 秒前後と速い呼吸数',
        'SpO2 目標は 90〜95%（上げすぎない）', '許容できる高 CO2 血症'],
      patient: {
        name: '在胎28週 日齢1', sex: 'M', heightCm: 37, age: 0, ageMonths: 0, weightKg: 1.1,
        ageLabel: '在胎28週 日齢1', vdCircuit: 1.0,
        compliance: 0.00055, Rinsp: 70, Rexp: 95,
        shunt0: 0.50, shuntMin: 0.18, recruitP: 9, recruitK: 2.0, vdAlvFrac: 0.06,
        vco2: 6.0, hb: 16.0, hco3: 20, hco3Base: 20, paco2: 52, pao2: 55,
        co: 0.22, hr: 150, map: 32, temp: 36.9,
        sedation: 0.80, driveGain: 1.0, maxPmus: 10, co2Setpoint: 45,
        goals: { ph: [7.22, 7.42], paco2: [45, 60], pao2: [45, 75] }
      },
      suggested: { mode: 'PC-AC', pinsp: 10, peep: 6, rr: 55, fio2: 0.35, ti: 0.30,
        vt: 6, flow: 2, ps: 6, rise: 0.06, trigFlow: 0.4, pause: 0 }
    },
    {
      id: 'bronchiolitis', tone: 'mid',
      ward: 'PICU',  nickname: 'そうた君',
      title: 'RSV 細気管支炎',
      tag: 'auto-PEEP',
      oneLine: '気道が細く痰が多い。呼吸数を上げると息が吐けなくなる乳児の典型。',
      history: '生後 4か月、体重 6.0 kg。3日前から鼻汁と咳、前日から哺乳不良。'
        + '高流量鼻カニュラでも陥没呼吸と無呼吸発作があり気管挿管。RSV 抗原陽性。'
        + '胸部X線は過膨張と右中葉の無気肺。',
      findings: ['体温 38.2℃', '心拍 165 /分', '平均血圧 52 mmHg', '呼気延長と wheeze、痰が多い',
        '気管チューブ：カフなし 3.5 mm、口角 10 cm'],
      teaching: ['時定数と呼気時間（乳児でも同じ考え方）', '呼気ポーズで総 PEEP を測る',
        '頻呼吸が auto-PEEP を作る', '痰づまりで気道内圧が上がる'],
      patient: {
        name: '生後4か月', sex: 'M', heightCm: 62, age: 0, ageMonths: 4, weightKg: 6.0,
        ageLabel: '生後4か月', vdCircuit: 5,
        compliance: 0.0039, Rinsp: 80, Rexp: 170,
        shunt0: 0.34, shuntMin: 0.16, recruitP: 9, recruitK: 2.5, vdAlvFrac: 0.14,
        vco2: 36, hb: 10.5, hco3: 26, hco3Base: 24, paco2: 62, pao2: 62,
        co: 1.1, hr: 158, map: 52, temp: 38.2,
        sedation: 0.85, driveGain: 1.5, maxPmus: 14, co2Setpoint: 42,
        goals: { ph: [7.20, 7.42], paco2: [45, 75], pao2: [50, 90] }
      },
      suggested: { mode: 'VC-AC', vt: 45, rr: 25, peep: 6, fio2: 0.5,
        flow: 6, ti: 0.5, pinsp: 14, ps: 8, rise: 0.08, trigFlow: 0.6, pause: 0 }
    },
    {
      id: 'ards', tone: 'bad',
      ward: 'PICU',  nickname: 'ミオちゃん',
      title: '小児 ARDS（インフルエンザ肺炎）',
      tag: '酸素化',
      oneLine: '硬い肺と大きなシャント。小児の肺保護換気と PEEP の調整を学ぶ。',
      history: '3歳 女児、体重 14 kg、身長 95 cm。インフルエンザ A 型のあと発熱が続き、'
        + 'リザーバーマスク 10 L/分でも SpO2 86%、呼吸数 52 /分で気管挿管。'
        + '胸部X線は両側びまん性浸潤影。心エコーで心機能は保たれている。',
      findings: ['体温 38.8℃', '心拍 150 /分', '血圧 84/44 mmHg（平均 55）', '挿管前の P/F 比は 80 台',
        '気管チューブ：カフ付き 4.5 mm、口角 13 cm'],
      teaching: ['小児 ARDS でも 5〜6 mL/kg の一回換気量', 'プラトー圧 28 以下・ドライビング圧 14 以下',
        'PEEP を上げると酸素化は改善するが血圧は下がる', '小児での permissive hypercapnia'],
      patient: {
        name: '3歳 女児', sex: 'F', heightCm: 95, age: 3, ageMonths: 36, weightKg: 14,
        ageLabel: '3歳', vdCircuit: 6,
        compliance: 0.0062, Rinsp: 28, Rexp: 34,
        norms: { dpMax: 14 },        // 小児 ARDS ではドライビング圧を 14 以下に抑える
        shunt0: 0.38, shuntMin: 0.12, recruitP: 12, recruitK: 3.0, vdAlvFrac: 0.10,
        vco2: 60, hb: 10.0, hco3: 22, hco3Base: 22, paco2: 58, pao2: 55,
        co: 2.1, hr: 150, map: 63, temp: 38.8,
        sedation: 0.92, driveGain: 1.7, maxPmus: 20, co2Setpoint: 40,
        goals: { ph: [7.20, 7.45], paco2: [40, 70], pao2: [55, 95] }
      },
      suggested: { mode: 'VC-AC', vt: 85, rr: 30, peep: 10, fio2: 0.8,
        flow: 12, ti: 0.55, pinsp: 16, ps: 10, rise: 0.10, trigFlow: 0.8, pause: 0 }
    },
    {
      id: 'asthma', tone: 'bad',
      ward: 'PICU',
      title: '喘息重積発作',
      tag: '上級',
      oneLine: '極端に高い気道抵抗。息を吐かせることを最優先にする学童の症例。',
      history: '11歳 男児、体重 35 kg、身長 142 cm。喘息で吸入ステロイドを自己中断していた。'
        + '発作で救急搬入、会話不能。吸入と全身ステロイドでも改善せず、'
        + '意識が落ちてきたため気管挿管。silent chest。',
      findings: ['体温 36.8℃', '心拍 150 /分（吸入β2刺激薬の影響もある）',
        '血圧 92/50 mmHg（平均 62）', '呼気がほとんど聞こえない',
        '気管チューブ：カフ付き 6.5 mm、口角 20 cm'],
      teaching: ['低い呼吸数と長い呼気時間', 'auto-PEEP による血圧低下',
        '最高気道内圧よりプラトー圧を見る', '小児でも pH 7.20 までは許容する'],
      patient: {
        name: '11歳 男児', sex: 'M', heightCm: 142, age: 11, ageMonths: 132, weightKg: 35,
        ageLabel: '11歳', vdCircuit: 12,
        compliance: 0.0245, Rinsp: 50, Rexp: 85,
        shunt0: 0.16, shuntMin: 0.10, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.14,
        vco2: 140, hb: 13.5, hco3: 24, hco3Base: 22, paco2: 72, pao2: 66,
        co: 4.2, hr: 150, map: 78, temp: 36.8, volumeDepleted: true,
        sedation: 0.95, driveGain: 1.5, maxPmus: 26, co2Setpoint: 40,
        goals: { ph: [7.20, 7.45], paco2: [40, 80], pao2: [60, 110] }
      },
      suggested: { mode: 'VC-AC', vt: 250, rr: 12, peep: 5, fio2: 0.6,
        flow: 30, ti: 0.8, pinsp: 18, ps: 10, rise: 0.15, trigFlow: 1.5, pause: 0 }
    },
    {
      id: 'gbs', tone: 'ok',
      ward: 'PICU',  nickname: 'あかりちゃん',
      title: 'ギラン・バレー症候群',
      tag: '離脱',
      oneLine: '肺は正常だが呼吸筋が弱い。離脱の可否を筋力で判断する。',
      history: '7歳 女児、体重 22 kg、身長 120 cm。感冒の 2週間後から歩けなくなり、'
        + '下肢から上行する筋力低下。肺活量が低下し CO2 が溜まってきたため気管挿管。'
        + '肺そのものに病変はなく、胸部X線は正常。免疫グロブリン大量療法を開始している。',
      findings: ['体温 36.7℃', '心拍 95 /分', '血圧 100/58 mmHg（平均 68）', '四肢筋力 MMT 2',
        '気管チューブ：カフ付き 5.5 mm、口角 16 cm'],
      teaching: ['肺が正常でも離脱できないことがある', 'SBT 中の浅くて速い呼吸',
        '小児では f/VT を体重あたりで見る'],
      patient: {
        name: '7歳 女児', sex: 'F', heightCm: 120, age: 7, ageMonths: 84, weightKg: 22,
        ageLabel: '7歳', vdCircuit: 10,
        compliance: 0.0210, Rinsp: 13, Rexp: 16,
        shunt0: 0.10, shuntMin: 0.05, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.05,
        vco2: 95, hb: 12.0, hco3: 26, hco3Base: 24, paco2: 50, pao2: 82,
        co: 2.9, hr: 95, map: 68, temp: 36.7,
        sedation: 0.20, driveGain: 1.2, maxPmus: 8, co2Setpoint: 40,
        fatigueLoad: 0.2, fatigueTau: 170,      // 軽い負荷でも 15 分ほどで疲れてくる
        goals: { ph: [7.32, 7.46], paco2: [33, 48], pao2: [70, 120] }
      },
      suggested: { mode: 'VC-AC', vt: 160, rr: 16, peep: 5, fio2: 0.4,
        flow: 16, ti: 0.7, pinsp: 12, ps: 8, rise: 0.12, trigFlow: 1.0, pause: 0 }
    }
  ];

  /* A/C では患者が吸った呼吸も強制換気として送られるので、自発はトリガの回数でも数える。 */
  function spontOk(eng) {
    var m = eng.m;
    return m.rrSpont >= 4 || (m.rrTrig || 0) >= 4 || eng.pmusAmp > 2;
  }

  /* 離脱の前提条件。小児では平均血圧の下限が年齢で変わるので、症例の基準値から取る。 */
  function weaningReadiness(eng) {
    var s = eng.s, m = eng.m, nm = eng.nm;
    return [
      { label: 'FiO₂ 0.4 以下', ok: s.fio2 <= 0.41, val: Math.round(s.fio2 * 100) + '%' },
      { label: 'PEEP 7 以下', ok: s.peep <= 7, val: s.peep + ' cmH₂O' },
      { label: 'PaO₂/FiO₂ 200 以上', ok: (eng.pao2 / s.fio2) >= 200, val: Math.round(eng.pao2 / s.fio2) },
      { label: 'pH 7.30 以上', ok: eng.ph >= 7.30, val: eng.ph.toFixed(2) },
      { label: '循環が安定（平均血圧 ' + nm.mapMin + ' 以上）', ok: eng.map >= nm.mapMin, val: Math.round(eng.map) + ' mmHg' },
      { label: '覚醒している（鎮静 浅い）', ok: eng.sedation <= 0.4, val: eng.sedation <= 0.4 ? '覚醒' : '鎮静下' },
      { label: '自発呼吸がある', ok: spontOk(eng), val: spontOk(eng) ? 'あり' : '乏しい' }
    ];
  }

  /* ===================== 患者情報 ===================== */

  /* 患者情報パネルの見出し。物語の呼び名があればそれを主に、無ければ「8歳 男児」を出す。 */
  function patientProfile(sc) {
    var p = sc.patient, kg = p.weightKg;
    var ageSex = (p.ageLabel || p.name) + ' ' + (p.sex === 'F' ? '女児' : '男児');
    return {
      name: sc.nickname || ageSex,
      ageSex: sc.nickname ? ageSex : '',
      ward: sc.ward || 'PICU',
      weight: (kg < 10 ? kg.toFixed(1) : String(Math.round(kg))) + ' kg',
      height: p.heightCm + ' cm'
    };
  }

  /* 体重と年齢から決まる設定の目安。初期設定の画面と患者情報で同じものを出す。 */
  function targetsFor(eng) {
    var nm = eng.nm, kg = eng.p.pbw, vk = nm.vtPerKg;
    var rd = function (v) { return kg < 6 ? v.toFixed(1) : String(Math.round(v)); };
    return [
      { k: '一回換気量', v: vk[0] + '〜' + vk[1] + ' mL/kg', sub: rd(kg * vk[0]) + '〜' + rd(kg * vk[1]) + ' mL' },
      { k: '呼吸数', v: nm.rr[0] + '〜' + nm.rr[1] + ' /分', sub: nm.label + 'の正常' },
      { k: 'プラトー圧', v: nm.platMax + ' 以下', sub: 'cmH₂O' },
      { k: 'ドライビング圧', v: nm.dpMax + ' 以下', sub: 'cmH₂O' },
      { k: 'SpO₂ 目標', v: nm.spo2[0] + '〜' + nm.spo2[1] + ' %', sub: '' },
      { k: '平均血圧', v: nm.mapMin + ' 以上', sub: 'mmHg' }
    ];
  }

  /* 鎮静の深さ。離脱の条件（0.4 以下で覚醒）と同じ境目で言葉にする。 */
  function sedationLabel(x) {
    return x > 0.75 ? '深い' : (x > 0.4 ? '中くらい' : '浅い（覚醒）');
  }

  var api = { SCENARIOS: SCENARIOS, weaningReadiness: weaningReadiness, spontOk: spontOk,
    patientProfile: patientProfile, targetsFor: targetsFor, sedationLabel: sedationLabel };
  root.VentScenarios = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
