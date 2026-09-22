/* VentSim のキャラクター。画像ファイルを持たずに済むよう、すべてインライン SVG で描く。
 * 表情は mood で切り替える。'normal' | 'happy' | 'think' | 'alert' | 'sad'
 * 色はテーマに依らず固定（機器の画面ではなく筐体の上に載るため）。
 */
(function () {
  'use strict';

  /* ---- 目と口。キャラクター間で使い回す ---- */
  function eyes(mood, cx1, cx2, cy, r) {
    if (mood === 'happy') {
      return '<path d="M' + (cx1 - r) + ' ' + cy + ' q' + r + ' ' + (-r * 1.3) + ' ' + (r * 2) + ' 0" '
        + 'stroke="#2A2340" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
        + '<path d="M' + (cx2 - r) + ' ' + cy + ' q' + r + ' ' + (-r * 1.3) + ' ' + (r * 2) + ' 0" '
        + 'stroke="#2A2340" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    }
    if (mood === 'think') {
      return '<ellipse cx="' + cx1 + '" cy="' + cy + '" rx="' + r * 0.55 + '" ry="' + r * 0.8 + '" fill="#2A2340"/>'
        + '<ellipse cx="' + cx2 + '" cy="' + cy + '" rx="' + r * 0.55 + '" ry="' + r * 0.8 + '" fill="#2A2340"/>'
        + '<path d="M' + (cx1 - r) + ' ' + (cy - r * 1.5) + ' l' + (r * 1.8) + ' ' + (-r * 0.4) + '" '
        + 'stroke="#2A2340" stroke-width="2" stroke-linecap="round"/>'
        + '<path d="M' + (cx2 + r) + ' ' + (cy - r * 1.5) + ' l' + (-r * 1.8) + ' ' + (-r * 0.4) + '" '
        + 'stroke="#2A2340" stroke-width="2" stroke-linecap="round"/>';
    }
    if (mood === 'alert') {
      return '<circle cx="' + cx1 + '" cy="' + cy + '" r="' + r * 0.9 + '" fill="#fff"/>'
        + '<circle cx="' + cx1 + '" cy="' + cy + '" r="' + r * 0.5 + '" fill="#2A2340"/>'
        + '<circle cx="' + cx2 + '" cy="' + cy + '" r="' + r * 0.9 + '" fill="#fff"/>'
        + '<circle cx="' + cx2 + '" cy="' + cy + '" r="' + r * 0.5 + '" fill="#2A2340"/>';
    }
    return '<ellipse cx="' + cx1 + '" cy="' + cy + '" rx="' + r * 0.62 + '" ry="' + r * 0.85 + '" fill="#2A2340"/>'
      + '<ellipse cx="' + cx2 + '" cy="' + cy + '" rx="' + r * 0.62 + '" ry="' + r * 0.85 + '" fill="#2A2340"/>';
  }

  function mouth(mood, cx, cy, w) {
    if (mood === 'happy') {
      return '<path d="M' + (cx - w) + ' ' + cy + ' q' + w + ' ' + (w * 1.15) + ' ' + (w * 2) + ' 0" '
        + 'stroke="#2A2340" stroke-width="2.4" fill="#FF8098" stroke-linejoin="round"/>';
    }
    if (mood === 'sad') {
      return '<path d="M' + (cx - w * 0.8) + ' ' + (cy + w * 0.4) + ' q' + (w * 0.8) + ' ' + (-w * 0.9) + ' '
        + (w * 1.6) + ' 0" stroke="#2A2340" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    }
    if (mood === 'alert') {
      return '<ellipse cx="' + cx + '" cy="' + (cy + w * 0.2) + '" rx="' + w * 0.5 + '" ry="' + w * 0.62 + '" fill="#2A2340"/>';
    }
    return '<path d="M' + (cx - w * 0.7) + ' ' + cy + ' q' + (w * 0.7) + ' ' + (w * 0.7) + ' ' + (w * 1.4) + ' 0" '
      + 'stroke="#2A2340" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  }

  function blush(cx1, cx2, cy, r) {
    return '<ellipse cx="' + cx1 + '" cy="' + cy + '" rx="' + r + '" ry="' + r * 0.62 + '" fill="#FF9DB5" opacity=".55"/>'
      + '<ellipse cx="' + cx2 + '" cy="' + cy + '" rx="' + r + '" ry="' + r * 0.62 + '" fill="#FF9DB5" opacity=".55"/>';
  }

  function svg(inner, extraClass) {
    return '<svg class="chr' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 120 120" '
      + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  /* ===================== 指導医：みどり先生 =====================
   * レッスンを教える側。帯や解説で話す。 */
  function doctor(mood, opts) {
    opts = opts || {};
    var m = mood || 'normal';
    var g = '';
    if (opts.disc) {
      g += '<circle cx="60" cy="60" r="58" fill="' + (opts.disc === true ? '#E8FBF3' : opts.disc) + '"/>';
    }
    /* 体：スクラブ */
    g += '<path d="M28 120 q2-26 18-33 l14-5 h0 l14 5 q16 7 18 33 z" fill="#2FC9A4"/>';
    g += '<path d="M46 82 l14 13 14-13 -6-3 -8 7 -8-7 z" fill="#1EA98A"/>';
    /* 聴診器 */
    g += '<path d="M48 84 q0 22 12 22 q12 0 12-16" stroke="#455169" stroke-width="3" fill="none" stroke-linecap="round"/>';
    g += '<circle cx="72" cy="92" r="5.5" fill="#8FA0BC"/><circle cx="72" cy="92" r="2.6" fill="#DCE4F2"/>';
    /* 首 */
    g += '<rect x="53" y="70" width="14" height="12" rx="6" fill="#F7CEA8"/>';
    /* 顔 */
    g += '<circle cx="60" cy="52" r="26" fill="#FFDEC0"/>';
    /* 髪 */
    g += '<path d="M33 52 q0-28 27-28 q27 0 27 28 q0-13-9-16 q-9 8-27 6 q-12-1-18 10 z" fill="#3C3355"/>';
    g += '<path d="M33 52 q-4 12 1 20 q-6-12-1-20z" fill="#3C3355"/>';
    g += '<path d="M87 52 q4 12-1 20 q6-12 1-20z" fill="#3C3355"/>';
    /* 表情 */
    g += blush(45, 75, 60, 5.5);
    g += eyes(m, 51, 69, 53, 4.6);
    g += mouth(m, 60, 62, 5.5);
    return svg(g, opts.cls);
  }

  /* ===================== マスコット：ぷくぷく =====================
   * ふわふわの「息」の精。白い雲のような丸い体に、頭に小さな空気の渦。呼吸に合わせてふくらむ。 */
  function mascot(mood, opts) {
    opts = opts || {};
    var m = mood || 'happy';
    var g = '';
    if (opts.disc) g += '<circle cx="60" cy="60" r="58" fill="' + (opts.disc === true ? '#FFF0F4' : opts.disc) + '"/>';
    g += '<g class="puku">';
    /* 体 */
    g += '<path d="M40 100 q-20 0-21-19 q-1-16 13-19 q-2-19 17-22 q10-13 25-5 q17-5 23 13 q15 3 15 19 q0 17-15 19 q-5 12-19 10 q-10 9-21 2 q-10 5-17 2z" fill="#F4F8FF" stroke="#2E2545" stroke-width="3" stroke-linejoin="round"/>';
    g += '<ellipse cx="42" cy="52" rx="12" ry="7" fill="#FFFFFF" opacity=".9" transform="rotate(-18 42 52)"/>';
    /* 頭の渦 */
    g += '<path d="M66 37 q-2-13 10-14 q9 0 7 9 q-1 5-7 4" fill="none" stroke="#2E2545" stroke-width="3" stroke-linecap="round"/>';
    /* 表情 */
    g += blush(40, 80, 76, 6);
    g += eyes(m, 47, 73, 66, 5);
    g += mouth(m, 60, 76, 6);
    g += '</g>';
    return svg(g, (opts.cls || '') + ' mascot');
  }

  /* ===================== 患者 =====================
   * 症例カードと画面の見出しに出す。tone で顔色を変える。 */
  function patient(tone, opts) {
    opts = opts || {};
    var skin = tone === 'bad' ? '#E9C3B4' : (tone === 'mid' ? '#F5D2B4' : '#FFDEC0');
    var g = '';
    if (opts.disc) g += '<circle cx="60" cy="60" r="58" fill="' + (opts.disc === true ? '#EEF3FF' : opts.disc) + '"/>';
    /* 枕と布団 */
    g += '<path d="M10 96 q50-16 100 0 v24 h-100 z" fill="#BFD0F5"/>';
    g += '<ellipse cx="60" cy="92" rx="44" ry="14" fill="#EAF0FF"/>';
    /* 頭 */
    g += '<circle cx="60" cy="58" r="26" fill="' + skin + '"/>';
    g += '<path d="M34 56 q2-24 26-24 q24 0 26 24 q-6-12-26-12 q-20 0-26 12z" fill="#4A4160"/>';
    /* 閉じた目 */
    g += '<path d="M46 56 q5 5 10 0" stroke="#2A2340" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    g += '<path d="M64 56 q5 5 10 0" stroke="#2A2340" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    /* 気管チューブ */
    g += '<path d="M60 70 q0 10-14 16 q-14 6-30 4" stroke="#CFE0FF" stroke-width="7" fill="none" stroke-linecap="round"/>';
    g += '<path d="M60 70 q0 10-14 16 q-14 6-30 4" stroke="#8FB0EE" stroke-width="2" fill="none" stroke-linecap="round"/>';
    g += '<rect x="50" y="64" width="20" height="9" rx="4.5" fill="#FFFFFF" stroke="#C9D4F0" stroke-width="2"/>';
    /* SpO2 の光 */
    if (tone === 'bad') g += '<circle cx="96" cy="44" r="7" fill="#FF5570" opacity=".85"/>';
    return svg(g, opts.cls);
  }

  /* ===================== ロゴ ===================== */
  function logo() {
    return '<svg class="tlogoart" viewBox="0 0 320 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
      + '<defs><linearGradient id="lg" x1="0" x2="1">'
      + '<stop offset="0" stop-color="#FF5E8A"/><stop offset="42%" stop-color="#FFB020"/>'
      + '<stop offset="74%" stop-color="#12C48B"/><stop offset="100%" stop-color="#5B7CFA"/>'
      + '</linearGradient></defs>'
      /* 波形が文字の下を走る */
      + '<path d="M8 78 h40 l10-26 l10 44 l10-18 h44 l8-12 l8 24 l8-12 h58 l10-20 l10 34 l8-14 h80" '
      + 'stroke="url(#lg)" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>'
      + '<text x="160" y="52" text-anchor="middle" font-size="46" font-weight="800" fill="url(#lg)" '
      + 'font-family="M PLUS Rounded 1c, Hiragino Maru Gothic ProN, sans-serif">VentaSim</text>'
      + '</svg>';
  }

  window.VentChars = { doctor: doctor, mascot: mascot, patient: patient, logo: logo };
})();
