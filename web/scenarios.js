/* VentSim — 症例データ。コードを触らずに症例を足せるよう、パラメータだけで病態を表す。
 * すべて小児（新生児〜思春期）。設定の基準は予測体重ではなく実体重（weightKg）。
 * ageMonths から年齢相応の呼吸数・心拍・血圧・圧の上限が決まる（engine.js の ageNorms）。
 * tone は患者の絵の顔色（ok / mid / bad）。年齢層は ageMonths から自動で決まるので持たない。
 * ward は入室している病棟、nickname は学習コースの物語での呼び名。 */
(function (root) {
  'use strict';

  var SCENARIOS = [
    {
      id: 'postop',
      recovery: { days: 1, to: { temp: 37.0 } }, tone: 'ok',
      ward: 'PICU',  nickname: 'ハルト君',
      title: '小児外科術後の呼吸管理',
      tag: '入門',
      oneLine: '肺はほぼ正常。ショックのあいだ人工呼吸を続けた術後の子で、初期設定から抜管までを一通り通す。',
      history: '8歳 男児、体重 25 kg、身長 126 cm。穿孔性虫垂炎による汎発性腹膜炎と敗血症性ショックで緊急開腹術。'
        + '術中から大量輸液とノルアドレナリンを要し、腸管浮腫でお腹も張っている。循環が落ち着くまで人工呼吸を続ける方針で、挿管のまま PICU に入室した。鎮静中で、自発呼吸はほとんどない。'
        + '胸部X線は両下肺にわずかな無気肺があるのみ。',
      findings: ['体温 37.2℃', '心拍 100 /分', '血圧 96/58 mmHg（平均 68、ノルアドレナリン 0.1 μg/kg/分）', '胸部聴診：左右差なし',
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
      id: 'rds',
      recovery: { days: 3, to: { C: 0.0012, shunt0: 0.12, shuntMin: 0.05, hco3Base: 24, maxPmus: 12, driveGain: 1.3 } }, tone: 'mid', modes: 'nicu',
      ward: 'NICU',  nickname: 'あおい君',
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
      id: 'micro',
      recovery: { days: 7, to: { C: 0.0005, shunt0: 0.18, shuntMin: 0.06, recruitP: 7, vdAlvFrac: 0.05, hco3Base: 24, maxPmus: 9, driveGain: 1.2 } }, tone: 'bad', artAs: 'rds',
      ward: 'NICU',  nickname: 'つむぎちゃん',
      modes: 'nicu',
      title: '超早産児の重症 RDS（HFO・NAVA）',
      tag: 'NICU',
      oneLine: '在胎 25 週・720 g。HFO で肺を開き、NAVA で自分のリズムに合わせ、鼻からの支えへ。',
      history: '在胎 25週3日、日齢 1、出生体重 720 g の女児。分娩室で挿管し、サーファクタントを 2 回投与した。'
        + '従来の換気で最高気道内圧が 25 cmH₂O を超えても PaCO₂ が下がらない。'
        + '胸部X線はすりガラス様陰影が強く、左肺に間質性肺気腫が出はじめている。',
      findings: ['体温 36.8℃（保育器内、湿度 80%）', '心拍 165 /分', '平均血圧 33 mmHg', 'Hb 15.0 g/dL',
        '気管チューブ：カフなし 2.5 mm、口角 6.5 cm', '胃管：Edi カテーテル（NAVA 用）'],
      teaching: ['HFO：酸素化は MAP、CO₂ は振幅（と周波数）', '周波数を下げると CO₂ が下がる',
        'NAVA：Edi を見て NAVA レベルを合わせる', '鼻から支える：NIV-NAVA と HFNC'],
      patient: {
        name: '在胎25週 日齢1', sex: 'F', heightCm: 32, age: 0, ageMonths: 0, weightKg: 0.72,
        ageLabel: '在胎25週 日齢1', vdCircuit: 1.0,
        compliance: 0.0002, Rinsp: 110, Rexp: 140,
        shunt0: 0.55, shuntMin: 0.10, recruitP: 11, recruitK: 2.0, vdAlvFrac: 0.15,
        vco2: 4.0, hb: 15.0, hco3: 19, hco3Base: 19, paco2: 62, pao2: 45,
        co: 0.15, hr: 165, map: 33, temp: 36.8,
        sedation: 0.85, driveGain: 1.0, maxPmus: 8, co2Setpoint: 45, nme: 0.5, leak: 0.35,
        fatigueLoad: 1.0, fatigueTau: 600,
        norms: { mapMin: 25 },
        goals: { ph: [7.20, 7.40], paco2: [45, 60], pao2: [45, 70] }
      },
      suggested: { mode: 'PC-AC', pinsp: 20, peep: 6, rr: 55, fio2: 0.7, ti: 0.3,
        vt: 4, flow: 2, ps: 6, rise: 0.06, trigFlow: 0.4, pause: 0,
        hfoMap: 12, hfoAmp: 18, hfoFreq: 12, navaLevel: 1.5, hfncFlow: 6 }
    },
    {
      id: 'bronchiolitis',
      recovery: { days: 7, to: { Rinsp: 40, Rexp: 60, shunt0: 0.15, shuntMin: 0.08, driveGain: 1.0, temp: 37.0 } }, tone: 'mid',
      ward: 'PICU',  nickname: 'そうた君',
      title: 'RSV 細気管支炎',
      tag: 'auto-PEEP',
      oneLine: '気道が細く痰が多い。呼吸数を上げると息が吐けなくなる乳児の典型。',
      history: '生後 4か月、体重 6.0 kg。4日前から鼻汁と咳。2日前に哺乳不良で入院し、高流量鼻カニュラを開始した。'
        + '陥没呼吸が強まり、無呼吸発作も出たため気管挿管。RSV 抗原陽性。'
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
      id: 'ards',
      recovery: { days: 11, to: { C: 0.0105, shunt0: 0.14, shuntMin: 0.05, driveGain: 1.1, temp: 37.0 } }, tone: 'bad',
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
      id: 'asthma',
      recovery: { days: 1, to: { Rinsp: 16, Rexp: 22, hr: 100, driveGain: 1.0 } }, tone: 'bad',
      ward: 'PICU',  nickname: 'レン君',
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
      id: 'gbs',
      recovery: { days: 21, to: { maxPmus: 16, fatigueLoad: 0.45 } }, tone: 'ok',
      ward: 'PICU',  nickname: 'あかりちゃん',
      title: 'ギラン・バレー症候群',
      tag: '離脱',
      oneLine: '肺は正常だが呼吸筋が弱い。離脱の可否を筋力で判断する。',
      history: '7歳 女児、体重 22 kg、身長 120 cm。感冒の 2週間後から歩けなくなり、'
        + '下肢から上行する筋力低下。肺活量が低下し CO2 が溜まってきたため気管挿管し、免疫グロブリン大量療法を行った。挿管から 16 日目。手足は少しずつ動くようになってきたが、まだ力は弱い。'
        + '肺そのものに病変はなく、胸部X線は正常。',
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

  /* 自由操作で時間がたつと病気は治っていく。recovery.to は各症例の「離脱を考えられる日」の値で、
   * レッスンの台本がその日に入れる値と同じ。days 日でほぼ（95%）そこへ近づく指数の歩みにするので、
   * 吸引で抵抗が下がったなど、ほかの変化と重ねても壊れない。C は肺のコンプライアンス、temp は体温、
   * ほかは患者の値（p）。レッスン中は呼ばない（台本が日ごとの値を入れる）。 */
  function recover(eng, sc, seconds) {
    var r = sc && sc.recovery;
    if (!r || !(seconds > 0)) return;
    var k = 1 - Math.exp(-3 * seconds / (r.days * 86400));
    for (var key in r.to) {
      if (!Object.prototype.hasOwnProperty.call(r.to, key)) continue;
      var tg = r.to[key];
      if (key === 'C') eng.C += (tg - eng.C) * k;
      else if (key === 'temp') eng.temp += (tg - eng.temp) * k;
      else if (eng.p[key] != null) eng.p[key] += (tg - eng.p[key]) * k;
    }
  }

  /* 自由操作で抜管したあとの支え。高流量鼻カニュラを、子どもは 2 L/kg/分、
   * 3 kg 未満の新生児は 6 L/分で始める（つまみの可動域に収める）。FiO₂ は抜管前のまま。 */
  function postExtubationFlow(eng) {
    var L = eng.limits.hfncFlow, kg = eng.p.pbw;
    var f = kg < 3 ? 6 : kg * 2;
    f = Math.round(f / L.step) * L.step;
    return Math.max(L.min, Math.min(L.max, f));
  }

  /* 抜管後に呼吸が崩れてきたしるし。SBT の中止基準と同じ物差しで、pH だけは少し待つ
   * （抜管直後の軽い高炭酸ガスはよくある）。崩れていなければ null。 */
  function extubationTrouble(eng) {
    var m = eng.m, nm = eng.nm;
    var rrCap = Math.round(nm.rr[1] * 1.5), hrCap = Math.round(nm.hr[1] * 1.25);
    if (eng.sinceBreath > 20) return '無呼吸';
    if (m.rrTotal > rrCap) return '呼吸回数が ' + rrCap + '/分を超えました';
    if (eng.spo2 < nm.spo2[0]) return 'SpO₂ が ' + nm.spo2[0] + '% を下回りました';
    if (eng.hr > hrCap) return '頻脈（' + hrCap + '/分超）';
    if (eng.ph < 7.25) return '呼吸性アシドーシスが進みました（pH ' + eng.ph.toFixed(2) + '）';
    return null;
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

  /* レッスンの日の姿。物語の日にちが進んで体重や肺が変わった子は、レッスンの patient で
   * 症例の値を上書きする（あおい君の 3 週目は 1,400 g、など）。上書きが無ければ症例そのもの。 */
  function forLesson(sc, lesson) {
    if (!lesson || !lesson.patient) return sc;
    var out = {}, k;
    for (k in sc) if (Object.prototype.hasOwnProperty.call(sc, k)) out[k] = sc[k];
    out.patient = {};
    for (k in sc.patient) if (Object.prototype.hasOwnProperty.call(sc.patient, k)) out.patient[k] = sc.patient[k];
    for (k in lesson.patient) if (Object.prototype.hasOwnProperty.call(lesson.patient, k)) out.patient[k] = lesson.patient[k];
    return out;
  }

  var api = { SCENARIOS: SCENARIOS, weaningReadiness: weaningReadiness, spontOk: spontOk,
    postExtubationFlow: postExtubationFlow, recover: recover, extubationTrouble: extubationTrouble,
    patientProfile: patientProfile, targetsFor: targetsFor, sedationLabel: sedationLabel, forLesson: forLesson };
  root.VentScenarios = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
