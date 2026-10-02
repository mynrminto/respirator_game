/* VentSim 成人版 — 症例データ。小児版（../scenarios.js）と同じ形・同じ API で、
 * 読み込むファイルを差し替えるだけで成人版になる（build.js --edition adult）。
 * すべて成人。設定の基準は身長と性別から出す予測体重（PBW）。weightKg は持たない
 * （持つとエンジンが実体重を基準にしてしまう）。表示用の実体重は bodyKg に置く。
 * age から成人の呼吸数・心拍・血圧・圧の上限が決まる（engine.js の ageNorms の「成人」）。
 * tone は患者の絵の顔色（ok / mid / bad）。ward は入室している病棟、nickname は物語での呼び名。
 * 症例 ID は小児版と同じ役割のものは同じにしてある（postop / ards / asthma / gbs）。
 * 細気管支炎の代わりに COPD（copd）、早産児 RDS の代わりに心原性肺水腫（chf）を置く。 */
(function (root) {
  'use strict';

  var SCENARIOS = [
    {
      id: 'postop', tone: 'ok',
      ward: 'ICU',  nickname: '佐藤さん',
      title: '腹膜炎術後の呼吸管理',
      tag: '入門',
      oneLine: '肺はほぼ正常。敗血症性ショックのあいだ人工呼吸を続けた術後の人で、初期設定から抜管までを一通り通す。',
      history: '68歳 男性、身長 170 cm、体重 72 kg。S状結腸穿孔による汎発性腹膜炎と敗血症性ショックで緊急手術（ハルトマン手術）。'
        + '術中から大量輸液とノルアドレナリンを要し、腸管浮腫でお腹も張っている。循環が落ち着くまで人工呼吸を続ける方針で、挿管のまま ICU に入室した。鎮静中で、自発呼吸はほとんどない。'
        + '胸部X線は両下肺にわずかな無気肺があるのみ。',
      findings: ['体温 37.4℃', '心拍 96 /分', '血圧 104/58 mmHg（平均 72、ノルアドレナリン 0.1 μg/kg/分）', '胸部聴診：左右差なし',
        '気管チューブ：内径 8.0 mm、門歯 23 cm'],
      teaching: ['予測体重（身長と性別）で一回換気量を決める', '成人の呼吸数 12〜20 回に合わせる',
        'FiO2 を早く下げる', 'SBT から抜管までの流れ'],
      patient: {
        name: '68歳 男性', sex: 'M', heightCm: 170, age: 68, bodyKg: 72,
        ageLabel: '68歳',
        compliance: 0.050, Rinsp: 8, Rexp: 10,
        shunt0: 0.12, shuntMin: 0.05, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.04,
        vco2: 210, hb: 11.0, hco3: 23, hco3Base: 23, paco2: 42, pao2: 92,
        co: 5.2, hr: 96, map: 72, temp: 37.4,
        sedation: 0.85, driveGain: 1.0, maxPmus: 24, co2Setpoint: 40,
        goals: { ph: [7.32, 7.46], paco2: [33, 48], pao2: [70, 120] }
      },
      suggested: { mode: 'VC-AC', vt: 480, rr: 14, peep: 5, fio2: 0.4,
        flow: 50, ti: 1.0, pinsp: 14, ps: 8, rise: 0.15, trigFlow: 2.0, pause: 0 }
    },
    {
      id: 'chf', tone: 'mid',
      ward: 'ICU',  nickname: '鈴木さん',
      title: '急性心不全（心原性肺水腫）',
      tag: '肺水腫',
      oneLine: '水でふやけた肺。PEEP が酸素化と心臓の両方を助け、利尿とともに肺が軽くなっていく。',
      history: '78歳 女性、身長 152 cm、体重 54 kg。高血圧と心房細動で通院中。夜中に急に息が苦しくなり救急搬送。'
        + '起坐呼吸、ピンク色の泡沫痰。NPPV を始めたがマスクを嫌がって外してしまい、SpO2 80% 台が続いたため気管挿管した。'
        + '胸部X線は両側の蝶形陰影と胸水。心エコーで左室の動きは保たれているが、左房が大きい。',
      findings: ['体温 36.6℃', '心拍 118 /分（心房細動）', '血圧 168/92 mmHg（平均 117）', '両肺に湿性ラ音',
        '気管チューブ：内径 7.0 mm、門歯 21 cm'],
      teaching: ['肺水腫には PEEP が効く（肺胞の水を押し戻す）', '陽圧は心臓の後負荷も下げる',
        '利尿が効けば肺は急に軽くなる', '抜管後の NPPV'],
      patient: {
        name: '78歳 女性', sex: 'F', heightCm: 152, age: 78, bodyKg: 54,
        ageLabel: '78歳',
        compliance: 0.030, Rinsp: 10, Rexp: 13,
        shunt0: 0.40, shuntMin: 0.10, recruitP: 8, recruitK: 2.2, vdAlvFrac: 0.06,
        vco2: 170, hb: 11.5, hco3: 21, hco3Base: 23, paco2: 46, pao2: 55,
        co: 3.8, hr: 118, map: 117, temp: 36.6,
        sedation: 0.85, driveGain: 1.4, maxPmus: 22, co2Setpoint: 40,
        goals: { ph: [7.32, 7.46], paco2: [35, 48], pao2: [60, 100] }
      },
      suggested: { mode: 'VC-AC', vt: 330, rr: 18, peep: 8, fio2: 0.8,
        flow: 45, ti: 0.9, pinsp: 14, ps: 8, rise: 0.15, trigFlow: 2.0, pause: 0 }
    },
    {
      id: 'copd', tone: 'mid',
      ward: 'ICU',  nickname: '田中さん',
      title: 'COPD 急性増悪',
      tag: 'auto-PEEP',
      oneLine: '気道抵抗が高く呼気に時間がかかる。呼吸数を上げると息が吐けなくなる、成人の典型。',
      history: '72歳 男性、身長 165 cm、体重 52 kg。COPD（元喫煙者、50 箱年）で在宅酸素療法中。普段の PaCO2 は 55 mmHg 前後。'
        + '3日前からの感冒をきっかけに息切れと膿性痰が増え、救急外来で NPPV を始めたが CO2 がさらに溜まり、意識が落ちたため気管挿管。'
        + '胸部X線は過膨張と右下肺の浸潤影。',
      findings: ['体温 37.9℃', '心拍 108 /分', '血圧 138/74 mmHg（平均 95）', '呼気延長と wheeze、痰が多い',
        '気管チューブ：内径 8.0 mm、門歯 22 cm'],
      teaching: ['時定数と呼気時間', '呼気ポーズで総 PEEP を測る',
        '頻呼吸が auto-PEEP を作る', '普段の CO2 まで戻せばよい（正常化しない）', '痰づまりで気道内圧が上がる'],
      patient: {
        name: '72歳 男性', sex: 'M', heightCm: 165, age: 72, bodyKg: 52,
        ageLabel: '72歳',
        compliance: 0.070, Rinsp: 18, Rexp: 30,
        shunt0: 0.18, shuntMin: 0.10, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.18,
        vco2: 210, hb: 15.5, hco3: 33, hco3Base: 32, paco2: 72, pao2: 58,
        co: 5.0, hr: 108, map: 95, temp: 37.9,
        norms: { spo2: [88, 92] },   // COPD の SpO2 目標（高 CO2 を悪化させないため上げすぎない）
        sedation: 0.85, driveGain: 1.1, maxPmus: 18, co2Setpoint: 55,
        goals: { ph: [7.30, 7.46], paco2: [45, 65], pao2: [55, 85] }
      },
      suggested: { mode: 'VC-AC', vt: 450, rr: 14, peep: 5, fio2: 0.4,
        flow: 50, ti: 0.9, pinsp: 16, ps: 10, rise: 0.15, trigFlow: 2.0, pause: 0 }
    },
    {
      id: 'ards', tone: 'bad',
      ward: 'ICU',  nickname: '山本さん',
      title: 'ARDS（インフルエンザ肺炎）',
      tag: '酸素化',
      oneLine: '硬い肺と大きなシャント。肺保護換気と PEEP の調整を学ぶ。',
      history: '54歳 女性、身長 158 cm、体重 64 kg。インフルエンザ A 型のあと発熱と咳が続き、'
        + 'リザーバーマスク 15 L/分でも SpO2 86%、呼吸数 36 /分で気管挿管。'
        + '胸部X線は両側びまん性浸潤影。心エコーで心機能は保たれている。',
      findings: ['体温 38.7℃', '心拍 112 /分', '血圧 102/56 mmHg（平均 71）', '挿管前の P/F 比は 80 台',
        '気管チューブ：内径 7.5 mm、門歯 21 cm'],
      teaching: ['予測体重 6 mL/kg の一回換気量', 'プラトー圧 30 以下・ドライビング圧 15 以下',
        'PEEP を上げると酸素化は改善するが血圧は下がる', 'permissive hypercapnia'],
      patient: {
        name: '54歳 女性', sex: 'F', heightCm: 158, age: 54, bodyKg: 64,
        ageLabel: '54歳',
        compliance: 0.026, Rinsp: 10, Rexp: 12,
        shunt0: 0.38, shuntMin: 0.12, recruitP: 12, recruitK: 3.0, vdAlvFrac: 0.12,
        vco2: 220, hb: 10.5, hco3: 22, hco3Base: 22, paco2: 56, pao2: 56,
        co: 5.6, hr: 112, map: 82, temp: 38.7,
        sedation: 0.92, driveGain: 1.7, maxPmus: 30, co2Setpoint: 40,
        goals: { ph: [7.20, 7.45], paco2: [40, 70], pao2: [55, 95] }
      },
      suggested: { mode: 'VC-AC', vt: 400, rr: 22, peep: 10, fio2: 0.8,
        flow: 50, ti: 0.9, pinsp: 18, ps: 10, rise: 0.15, trigFlow: 2.0, pause: 0 }
    },
    {
      id: 'asthma', tone: 'bad',
      ward: 'ICU',  nickname: '高橋さん',
      title: '重症喘息発作',
      tag: '上級',
      oneLine: '極端に高い気道抵抗。息を吐かせることを最優先にする。',
      history: '29歳 女性、身長 160 cm、体重 55 kg。小児期からの喘息で、吸入ステロイドを自己中断していた。'
        + '発作で救急搬入、会話不能。吸入と全身ステロイドでも改善せず、'
        + '意識が落ちてきたため気管挿管。silent chest。',
      findings: ['体温 36.9℃', '心拍 128 /分（吸入β2刺激薬の影響もある）',
        '血圧 96/54 mmHg（平均 68）', '呼気がほとんど聞こえない',
        '気管チューブ：内径 7.5 mm、門歯 21 cm'],
      teaching: ['低い呼吸数と長い呼気時間', 'auto-PEEP による血圧低下',
        '最高気道内圧よりプラトー圧を見る', 'pH 7.20 までは許容する'],
      patient: {
        name: '29歳 女性', sex: 'F', heightCm: 160, age: 29, bodyKg: 55,
        ageLabel: '29歳',
        compliance: 0.055, Rinsp: 26, Rexp: 46,
        shunt0: 0.14, shuntMin: 0.08, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.16,
        vco2: 235, hb: 13.2, hco3: 22, hco3Base: 22, paco2: 72, pao2: 66,
        co: 4.6, hr: 128, map: 92, temp: 36.9, volumeDepleted: true,
        sedation: 0.95, driveGain: 1.5, maxPmus: 26, co2Setpoint: 40,
        goals: { ph: [7.20, 7.45], paco2: [40, 80], pao2: [60, 110] }
      },
      suggested: { mode: 'VC-AC', vt: 420, rr: 12, peep: 5, fio2: 0.6,
        flow: 60, ti: 0.8, pinsp: 20, ps: 10, rise: 0.15, trigFlow: 2.0, pause: 0 }
    },
    {
      id: 'gbs', tone: 'ok',
      ward: 'ICU',  nickname: '伊藤さん',
      title: 'ギラン・バレー症候群',
      tag: '離脱',
      oneLine: '肺は正常だが呼吸筋が弱い。離脱の可否を筋力で判断する。',
      history: '45歳 男性、身長 172 cm、体重 70 kg。胃腸炎の 2週間後から歩けなくなり、'
        + '下肢から上行する筋力低下。肺活量が 15 mL/kg を切り CO2 が溜まってきたため気管挿管し、免疫グロブリン大量療法を行った。挿管から 16 日目。手足は少しずつ動くようになってきたが、まだ力は弱い。'
        + '肺そのものに病変はなく、胸部X線は正常。',
      findings: ['体温 36.6℃', '心拍 84 /分', '血圧 124/72 mmHg（平均 89）', '四肢筋力 MMT 2',
        '気管チューブ：内径 8.0 mm、門歯 23 cm'],
      teaching: ['肺が正常でも離脱できないことがある', 'SBT 中の浅くて速い呼吸（rapid shallow breathing）',
        'RSBI（f/VT）の読み方'],
      patient: {
        name: '45歳 男性', sex: 'M', heightCm: 172, age: 45, bodyKg: 70,
        ageLabel: '45歳',
        compliance: 0.052, Rinsp: 7, Rexp: 9,
        shunt0: 0.10, shuntMin: 0.05, recruitP: 8, recruitK: 2.5, vdAlvFrac: 0.05,
        vco2: 200, hb: 13.0, hco3: 26, hco3Base: 24, paco2: 50, pao2: 80,
        co: 5.0, hr: 84, map: 89, temp: 36.6,
        sedation: 0.20, driveGain: 1.2, maxPmus: 9, co2Setpoint: 40,
        fatigueLoad: 0.2, fatigueTau: 600,      // 軽い負荷でも 15 分ほどで疲れてくる
        goals: { ph: [7.32, 7.46], paco2: [33, 48], pao2: [70, 120] }
      },
      suggested: { mode: 'VC-AC', vt: 480, rr: 14, peep: 5, fio2: 0.4,
        flow: 50, ti: 1.0, pinsp: 14, ps: 8, rise: 0.15, trigFlow: 2.0, pause: 0 }
    }
  ];

  /* A/C では患者が吸った呼吸も強制換気として送られるので、自発はトリガの回数でも数える。 */
  function spontOk(eng) {
    var m = eng.m;
    return m.rrSpont >= 4 || (m.rrTrig || 0) >= 4 || eng.pmusAmp > 2;
  }

  /* 離脱の前提条件（成人）。 */
  function weaningReadiness(eng) {
    var s = eng.s, nm = eng.nm;
    return [
      { label: 'FiO₂ 0.4 以下', ok: s.fio2 <= 0.41, val: Math.round(s.fio2 * 100) + '%' },
      { label: 'PEEP 8 以下', ok: s.peep <= 8, val: s.peep + ' cmH₂O' },
      { label: 'PaO₂/FiO₂ 150 以上', ok: (eng.pao2 / s.fio2) >= 150, val: Math.round(eng.pao2 / s.fio2) },
      { label: 'pH 7.30 以上', ok: eng.ph >= 7.30, val: eng.ph.toFixed(2) },
      { label: '循環が安定（平均血圧 ' + nm.mapMin + ' 以上）', ok: eng.map >= nm.mapMin, val: Math.round(eng.map) + ' mmHg' },
      { label: '覚醒している（鎮静 浅い）', ok: eng.sedation <= 0.4, val: eng.sedation <= 0.4 ? '覚醒' : '鎮静下' },
      { label: '自発呼吸がある', ok: spontOk(eng), val: spontOk(eng) ? 'あり' : '乏しい' }
    ];
  }

  /* ===================== 患者情報 ===================== */

  function patientProfile(sc) {
    var p = sc.patient;
    var ageSex = (p.ageLabel || p.name) + ' ' + (p.sex === 'F' ? '女性' : '男性');
    var pbw = predictedBodyWeight(p);
    return {
      name: sc.nickname || ageSex,
      ageSex: sc.nickname ? ageSex : '',
      ward: sc.ward || 'ICU',
      weight: Math.round(pbw) + ' kg',
      weightLabel: '予測体重',
      bodyWeight: p.bodyKg ? p.bodyKg + ' kg' : '',
      height: p.heightCm + ' cm'
    };
  }

  function predictedBodyWeight(p) {
    var base = p.sex === 'F' ? 45.5 : 50;
    return Math.max(25, base + 0.91 * (p.heightCm - 152.4));
  }

  /* 予測体重から決まる設定の目安。 */
  function targetsFor(eng) {
    var nm = eng.nm, kg = eng.p.pbw, vk = nm.vtPerKg;
    var rd = function (v) { return String(Math.round(v / 10) * 10); };
    return [
      { k: '一回換気量', v: vk[0] + '〜' + vk[1] + ' mL/kg', sub: rd(kg * vk[0]) + '〜' + rd(kg * vk[1]) + ' mL（予測体重）' },
      { k: '呼吸数', v: nm.rr[0] + '〜' + nm.rr[1] + ' /分', sub: nm.label + 'の正常' },
      { k: 'プラトー圧', v: nm.platMax + ' 以下', sub: 'cmH₂O' },
      { k: 'ドライビング圧', v: nm.dpMax + ' 以下', sub: 'cmH₂O' },
      { k: 'SpO₂ 目標', v: nm.spo2[0] + '〜' + nm.spo2[1] + ' %', sub: '' },
      { k: '平均血圧', v: nm.mapMin + ' 以上', sub: 'mmHg' }
    ];
  }

  function sedationLabel(x) {
    return x > 0.75 ? '深い' : (x > 0.4 ? '中くらい' : '浅い（覚醒）');
  }

  var api = { SCENARIOS: SCENARIOS, weaningReadiness: weaningReadiness, spontOk: spontOk,
    patientProfile: patientProfile, targetsFor: targetsFor, sedationLabel: sedationLabel, adult: true };
  root.VentScenarios = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
