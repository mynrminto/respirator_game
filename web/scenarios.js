/* VentSim — 症例データ。コードを触らずに症例を足せるよう、パラメータだけで病態を表す。 */
(function (root) {
  'use strict';

  var SCENARIOS = [
    {
      id: 'postop',
      title: '開腹術後の呼吸不全',
      tag: '入門',
      oneLine: '肺はほぼ正常。初期設定と離脱の流れを一通り通す症例。',
      history: '68歳男性、身長 170 cm。S状結腸切除後。手術室から挿管のまま ICU 入室。'
        + '麻酔から覚めきっておらず、自発呼吸はほとんどない。胸部X線は無気肺が軽度あるのみ。',
      findings: ['体温 36.8℃', '心拍 88 /分', '血圧 118/64 mmHg', '胸部聴診：左右差なし'],
      teaching: ['予測体重から一回換気量を決める', 'FiO2 を早く下げる', 'SBT から抜管までの流れ'],
      patient: {
        name: '68歳 男性', sex: 'M', heightCm: 170, age: 68,
        compliance: 0.050, Rinsp: 7, Rexp: 9,
        shunt0: 0.10, shuntMin: 0.05, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.03,
        vco2: 200, hb: 11.5, hco3: 24, hco3Base: 24, paco2: 42, pao2: 90,
        co: 5.0, hr: 88, map: 80, temp: 36.8,
        sedation: 0.85, driveGain: 1.0, maxPmus: 24, co2Setpoint: 40,
        goals: { ph: [7.32, 7.46], paco2: [33, 48], pao2: [70, 120] }
      },
      suggested: { mode: 'VC-AC', vt: 430, rr: 14, peep: 5, fio2: 0.4 }
    },
    {
      id: 'ards',
      title: '重症肺炎による ARDS',
      tag: '酸素化',
      oneLine: '硬い肺と大きなシャント。肺保護換気と PEEP の調整を学ぶ。',
      history: '54歳女性、身長 158 cm。市中肺炎で 3 日前から発熱。'
        + 'リザーバーマスク 15 L/分でも SpO2 88%、呼吸数 34 /分で挿管。胸部X線は両側びまん性浸潤影。',
      findings: ['体温 38.6℃', '心拍 112 /分', '血圧 104/58 mmHg', 'P/F 比は挿管前 80 台'],
      teaching: ['6 mL/kg 予測体重の一回換気量', 'プラトー圧 30 以下・ドライビング圧 15 以下',
        'PEEP を上げると酸素化は改善するが血圧は下がる', 'permissive hypercapnia'],
      patient: {
        name: '54歳 女性', sex: 'F', heightCm: 158, age: 54,
        compliance: 0.028, Rinsp: 9, Rexp: 11,
        shunt0: 0.36, shuntMin: 0.10, recruitP: 12, recruitK: 3.0, vdAlvFrac: 0.14,
        vco2: 200, hb: 10.5, hco3: 22, hco3Base: 22, paco2: 55, pao2: 58,
        co: 5.6, hr: 112, map: 74, temp: 38.6,
        sedation: 0.9, driveGain: 1.7, maxPmus: 30, co2Setpoint: 40,
        goals: { ph: [7.25, 7.45], pao2: [55, 95] }
      },
      suggested: { mode: 'VC-AC', vt: 300, rr: 24, peep: 12, fio2: 0.8 }
    },
    {
      id: 'copd',
      title: 'COPD 急性増悪',
      tag: 'auto-PEEP',
      oneLine: '気道抵抗が高く呼気に時間がかかる。呼吸数を上げると息が吐けなくなる。',
      history: '72歳男性、身長 165 cm。COPD で在宅酸素療法中。感冒を契機に増悪し、'
        + 'NPPV でも改善せず挿管。普段から PaCO2 は 55〜60 mmHg で経過している。',
      findings: ['体温 37.2℃', '心拍 104 /分', '血圧 132/70 mmHg', '呼気延長と wheeze'],
      teaching: ['時定数と呼気時間', '呼気ポーズで総 PEEP を測る',
        '慢性の高 CO2 を正常化しない', '頻呼吸が auto-PEEP を作る'],
      patient: {
        name: '72歳 男性', sex: 'M', heightCm: 165, age: 72,
        compliance: 0.072, Rinsp: 18, Rexp: 28,
        shunt0: 0.16, shuntMin: 0.10, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.18,
        vco2: 210, hb: 15.8, hco3: 34, hco3Base: 24, paco2: 68, pao2: 62,
        co: 5.2, hr: 104, map: 88, temp: 37.2,
        sedation: 0.85, driveGain: 1.1, maxPmus: 20, co2Setpoint: 55,
        goals: { ph: [7.30, 7.46], pao2: [55, 85] }
      },
      suggested: { mode: 'VC-AC', vt: 450, rr: 12, peep: 5, fio2: 0.4 }
    },
    {
      id: 'asthma',
      title: '重症喘息発作',
      tag: '上級',
      oneLine: '極端に高い気道抵抗。息を吐かせることを最優先にする。',
      history: '29歳女性、身長 160 cm。喘息発作で救急搬入。会話不能、'
        + 'SpO2 89%、意識が落ちてきたため気管挿管。silent chest。',
      findings: ['体温 36.9℃', '心拍 128 /分', '血圧 96/54 mmHg', '呼気がほとんど聞こえない'],
      teaching: ['低い呼吸数と長い呼気時間', 'auto-PEEP による血圧低下',
        '最高気道内圧よりプラトー圧を見る'],
      patient: {
        name: '29歳 女性', sex: 'F', heightCm: 160, age: 29,
        compliance: 0.055, Rinsp: 26, Rexp: 46,
        shunt0: 0.14, shuntMin: 0.08, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.18,
        vco2: 235, hb: 13.2, hco3: 21, hco3Base: 21, paco2: 70, pao2: 66,
        co: 4.6, hr: 128, map: 68, temp: 36.9, volumeDepleted: true,
        sedation: 0.95, driveGain: 1.5, maxPmus: 26, co2Setpoint: 40,
        goals: { ph: [7.20, 7.45], pao2: [60, 110] }
      },
      suggested: { mode: 'VC-AC', vt: 400, rr: 12, peep: 5, fio2: 0.6 }
    },
    {
      id: 'gbs',
      title: 'ギラン・バレー症候群',
      tag: '離脱',
      oneLine: '肺は正常だが呼吸筋が弱い。離脱の可否を筋力で判断する。',
      history: '45歳男性、身長 172 cm。下肢から上行する筋力低下。'
        + '肺活量が低下し CO2 が溜まってきたため挿管。肺そのものに病変はない。',
      findings: ['体温 36.6℃', '心拍 82 /分', '血圧 126/72 mmHg', '四肢筋力 MMT 2'],
      teaching: ['肺が正常でも離脱できないことがある', 'SBT 中の rapid shallow breathing',
        'RSBI の読み方'],
      patient: {
        name: '45歳 男性', sex: 'M', heightCm: 172, age: 45,
        compliance: 0.052, Rinsp: 7, Rexp: 9,
        shunt0: 0.10, shuntMin: 0.05, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.05,
        vco2: 200, hb: 13.0, hco3: 26, hco3Base: 24, paco2: 52, pao2: 78,
        co: 5.0, hr: 82, map: 86, temp: 36.6,
        sedation: 0.25, driveGain: 1.2, maxPmus: 9, co2Setpoint: 40,
        goals: { ph: [7.32, 7.46], paco2: [33, 48], pao2: [70, 120] }
      },
      suggested: { mode: 'VC-AC', vt: 450, rr: 14, peep: 5, fio2: 0.4 }
    }
  ];

  /* 離脱の前提条件 */
  function weaningReadiness(eng) {
    var s = eng.s, m = eng.m;
    return [
      { label: 'FiO2 0.4 以下', ok: s.fio2 <= 0.41, val: Math.round(s.fio2 * 100) + '%' },
      { label: 'PEEP 8 以下', ok: s.peep <= 8, val: s.peep + ' cmH2O' },
      { label: 'PaO2/FiO2 150 以上', ok: (eng.pao2 / s.fio2) >= 150, val: Math.round(eng.pao2 / s.fio2) },
      { label: 'pH 7.30 以上', ok: eng.ph >= 7.30, val: eng.ph.toFixed(2) },
      { label: '循環が安定（MAP 65 以上）', ok: eng.map >= 65, val: Math.round(eng.map) + ' mmHg' },
      { label: '覚醒している（鎮静 浅い）', ok: eng.sedation <= 0.4, val: eng.sedation <= 0.4 ? '覚醒' : '鎮静下' },
      { label: '自発呼吸がある', ok: m.rrSpont >= 4 || eng.pmusAmp > 2, val: m.rrSpont >= 4 ? 'あり' : '乏しい' }
    ];
  }

  var api = { SCENARIOS: SCENARIOS, weaningReadiness: weaningReadiness };
  root.VentScenarios = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
