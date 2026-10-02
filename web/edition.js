/* VentSim — 版（こども版／成人版）ごとに違う言葉と表示。
 * 版は window.VENT_EDITION で決める（成人版は build.js --edition adult が 'adult' を埋め込む）。
 * 症例・レッスン・物語は版ごとに別ファイル（成人版は adult/ 以下）で、ここには画面の文言だけを置く。 */
(function (root) {
  'use strict';
  var adult = root.VENT_EDITION === 'adult';
  var E = adult ? {
    id: 'adult',
    adult: true,
    title: 'おとなの人工呼吸器シミュレーター',
    hello: 'はじめまして。集中治療科の いぶき先生です。\nいっしょに 患者さんの呼吸を守りましょう。',
    waiting: '佐藤さんが待っています。',
    course: 'ICU の 6 人の患者さんを受け持ちながら、呼吸器の操作を順に覚えていくコースです。',
    o2tox: 'PaO₂ に余裕があります。FiO₂ を下げて酸素毒性（吸収性無気肺や肺障害の一因）を避けます。',
    platAge: 'この目安',
    ward: 'ICU'
  } : {
    id: 'peds',
    adult: false,
    title: 'こどもの人工呼吸器シミュレーター',
    hello: 'はじめまして。小児科の いぶき先生です。\nいっしょに こどもたちの呼吸を守りましょう。',
    waiting: 'ハルト君が待っています。',
    course: 'PICU と NICU の 6 人の子どもを受け持ちながら、呼吸器の操作を順に覚えていくコースです。',
    o2tox: 'PaO₂ に余裕があります。FiO₂ を下げて酸素毒性（未熟児網膜症や気管支肺異形成の一因）を避けます。',
    platAge: 'この年齢の目安',
    ward: 'PICU'
  };
  /* 離脱の浅く速い呼吸の指標。小児は f ÷ (mL/kg)（8 未満）、成人は RSBI ＝ f ÷ Vt[L]（105 未満）。 */
  E.fvt = adult
    ? { unit: '/分/L', limit: 105, lim: '<105', get: function (m) { return m.rsbi; }, dec: 0,
        fail: 'RSBI（f/VT）が 105 を超えました（浅く速い呼吸）' }
    : { unit: '/分/(mL/kg)', limit: 8, lim: '<8', get: function (m) { return m.rsbiKg; }, dec: 1,
        fail: 'f/VT が 8 を超えました（浅く速い呼吸）' };
  root.VentEdition = E;
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
