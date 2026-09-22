/* ゲーム画面の絵。すべてインライン SVG で作り、data URI として返す。
 * ここで作った絵を title.js が WebGL のテクスチャにして並べる。
 *
 * 描き方の約束（ゲームらしく見せるための最低限）:
 *   - 主役には濃い輪郭線を入れる。線幅は 5〜7。
 *   - 面は 2 段階で塗る（地の色＋影の色）。上側にハイライトを 1 本入れる。
 *   - 背景は彩度と明度を落として、手前のキャラクターを浮かせる。
 */
(function () {
  'use strict';

  function svg(w, h, inner, defs) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" '
      + 'viewBox="0 0 ' + w + ' ' + h + '">'
      + (defs ? '<defs>' + defs + '</defs>' : '') + inner + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  function lg(id, x1, y1, x2, y2, stops) {
    var s = '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">';
    for (var i = 0; i < stops.length; i++) {
      s += '<stop offset="' + stops[i][0] + '" stop-color="' + stops[i][1] + '"/>';
    }
    return s + '</linearGradient>';
  }

  function rg(id, cx, cy, r, stops) {
    var s = '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '">';
    for (var i = 0; i < stops.length; i++) {
      s += '<stop offset="' + stops[i][0] + '" stop-color="' + stops[i][1]
        + '" stop-opacity="' + (stops[i][2] == null ? 1 : stops[i][2]) + '"/>';
    }
    return s + '</radialGradient>';
  }

  var LINE = '#2E2545';          // 輪郭線
  function outline(w) { return 'stroke="' + LINE + '" stroke-width="' + (w || 6) + '" stroke-linejoin="round" stroke-linecap="round"'; }

  /* ============================================================
   * 背景：夜明けの ICU。窓の外が明るくなっていくところ。
   * 手前のキャラクターを立たせたいので、色は淡くしてある。
   * ========================================================== */
  function room(dark) {
    var W = 1600, H = 1000;
    var defs = ''
      + lg('sky', 0, 0, 0, 1, dark
          ? [[0, '#14204A'], [0.45, '#1B2C63'], [1, '#2A3F7E']]
          : [[0, '#FFD9A6'], [0.38, '#FFC3C8'], [0.72, '#D9CDF4'], [1, '#B9D2FA']])
      + rg('sun', 0.5, 0.5, 0.5, dark
          ? [[0, '#8FA8FF', 0.55], [1, '#8FA8FF', 0]]
          : [[0, '#FFF3C4', 0.95], [0.55, '#FFD79A', 0.5], [1, '#FFD79A', 0]])
      + lg('wall', 0, 0, 0, 1, dark
          ? [[0, '#141A2E'], [1, '#0E1425']]
          : [[0, '#FFF6EC'], [1, '#FBE7E4']])
      + lg('floor', 0, 0, 0, 1, dark
          ? [[0, '#0D1322'], [1, '#131B30']]
          : [[0, '#E7DCEF'], [1, '#D9CFE8']])
      + lg('curtain', 0, 0, 1, 0, dark
          ? [[0, '#22305C'], [0.5, '#1A2549'], [1, '#22305C']]
          : [[0, '#FFE6EE'], [0.5, '#FFD3E1'], [1, '#FFE6EE']]);

    var g = '';
    g += '<rect width="' + W + '" height="' + H + '" fill="url(#wall)"/>';

    /* 壁の板目。真っ平らにしない。 */
    for (var x = 0; x < W; x += 80) {
      g += '<rect x="' + x + '" y="0" width="2" height="760" fill="' + (dark ? '#1B2540' : '#F3DFE2') + '" opacity=".7"/>';
    }

    /* 窓 */
    g += '<rect x="330" y="80" width="940" height="470" rx="26" fill="url(#sky)"/>';
    g += '<circle cx="' + (dark ? 470 : 980) + '" cy="300" r="210" fill="url(#sun)"/>';
    if (!dark) g += '<circle cx="980" cy="300" r="52" fill="#FFF6D0" opacity=".95"/>';
    else g += '<circle cx="470" cy="250" r="34" fill="#E8EEFF" opacity=".9"/>';

    /* 遠景の街 */
    var city = dark ? '#0F1A3C' : '#C9BEEA';
    var bars = [[360, 430, 90, 120], [460, 390, 70, 160], [540, 420, 110, 130], [660, 360, 80, 190],
                [750, 410, 130, 140], [890, 380, 90, 170], [990, 425, 120, 125], [1120, 395, 100, 155]];
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      g += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="6" fill="' + city + '" opacity="' + (dark ? .95 : .55) + '"/>';
      if (dark) {
        for (var wy = b[1] + 14; wy < b[1] + b[3] - 10; wy += 22) {
          for (var wx = b[0] + 12; wx < b[0] + b[2] - 12; wx += 24) {
            g += '<rect x="' + wx + '" y="' + wy + '" width="8" height="10" fill="#FFD98A" opacity="' + (((wx + wy) % 3) ? .15 : .55) + '"/>';
          }
        }
      }
    }
    /* 雲 */
    if (!dark) {
      g += '<ellipse cx="560" cy="200" rx="120" ry="34" fill="#FFF" opacity=".55"/>'
        + '<ellipse cx="640" cy="180" rx="90" ry="28" fill="#FFF" opacity=".45"/>'
        + '<ellipse cx="1080" cy="170" rx="100" ry="26" fill="#FFF" opacity=".4"/>';
    }

    /* 窓枠 */
    var frame = dark ? '#2A3660' : '#FFFFFF';
    g += '<rect x="330" y="80" width="940" height="470" rx="26" fill="none" stroke="' + frame + '" stroke-width="18"/>';
    g += '<rect x="786" y="80" width="18" height="470" fill="' + frame + '"/>';
    g += '<rect x="330" y="306" width="940" height="16" fill="' + frame + '"/>';
    g += '<rect x="300" y="540" width="1000" height="26" rx="13" fill="' + frame + '"/>';

    /* カーテン */
    g += '<path d="M120 40 q60 40 40 120 q-20 80 10 160 q30 80 0 180 q-20 60 10 140 h-170 v-600 z" fill="url(#curtain)"/>';
    g += '<path d="M1480 40 q-60 40-40 120 q20 80-10 160 q-30 80 0 180 q20 60-10 140 h170 v-600 z" fill="url(#curtain)"/>';

    /* 床 */
    g += '<rect x="0" y="760" width="' + W + '" height="240" fill="url(#floor)"/>';
    g += '<rect x="0" y="756" width="' + W + '" height="10" fill="' + (dark ? '#0A0F1C' : '#CFC2E2') + '"/>';

    /* 小物：点滴台とモニター */
    var metal = dark ? '#43507A' : '#B9C4DC';
    g += '<rect x="214" y="300" width="10" height="470" rx="5" fill="' + metal + '"/>'
      + '<path d="M180 770 h80 M219 770 v10" stroke="' + metal + '" stroke-width="10" stroke-linecap="round"/>'
      + '<rect x="186" y="320" width="66" height="96" rx="16" fill="' + (dark ? '#1B2440' : '#EAF2FF') + '" stroke="' + metal + '" stroke-width="6"/>'
      + '<rect x="196" y="360" width="46" height="46" rx="10" fill="' + (dark ? '#2B6E8F' : '#BFE6F5') + '"/>';

    g += '<rect x="1330" y="330" width="170" height="130" rx="18" fill="' + (dark ? '#0B1226' : '#2A3560') + '" stroke="' + metal + '" stroke-width="8"/>'
      + '<path d="M1348 420 h30 l12-40 l14 62 l12-30 h40 l10-20 l12 34 h18" fill="none" stroke="#3BEFC0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>'
      + '<rect x="1404" y="460" width="10" height="310" fill="' + metal + '"/>'
      + '<path d="M1370 770 h80" stroke="' + metal + '" stroke-width="10" stroke-linecap="round"/>';

    /* 観葉植物 */
    g += '<path d="M1230 770 q-10-70 20-110 q-40 10-56-30 q40-6 60 14 q-4-54 26-74 q22 26 12 74 q26-30 62-20 q-14 40-54 40 q28 40 18 106 z" fill="' + (dark ? '#1E5546' : '#8FD9B6') + '"/>'
      + '<path d="M1206 762 h84 l-12 64 h-60 z" fill="' + (dark ? '#3A2A44' : '#E6A38C') + '"/>';

    return svg(W, H, g, defs);
  }

  /* ============================================================
   * キャラクター
   * ========================================================== */

  /* 指導医：みどり先生（立ち絵） */
  function doctor(dark, blink) {
    var W = 420, H = 560;
    var defs = lg('coat', 0, 0, 1, 0, [[0, '#FFFFFF'], [1, '#E4E9F5']])
      + lg('scrub', 0, 0, 0, 1, [[0, '#3BD6AE'], [1, '#17A585']])
      + lg('hair', 0, 0, 0, 1, [[0, '#4A3E6B'], [1, '#2E2545']]);
    var g = '';
    /* 影 */
    g += '<ellipse cx="210" cy="536" rx="120" ry="18" fill="' + (dark ? '#000' : '#7A5C86') + '" opacity=".22"/>';
    /* 白衣（体） */
    g += '<path d="M120 520 q-6-170 44-214 l46-22 l46 22 q50 44 44 214 z" fill="url(#coat)" ' + outline(7) + '/>';
    /* スクラブの前身頃 */
    g += '<path d="M168 296 q42 34 84 0 q18 78 12 224 h-108 q-6-146 12-224 z" fill="url(#scrub)" ' + outline(6) + '/>';
    /* 襟 */
    g += '<path d="M164 292 l46 44 l46-44 l-20-10 l-26 24 l-26-24 z" fill="#0F8E73" ' + outline(5) + '/>';
    /* 腕 */
    g += '<path d="M128 322 q-26 70-12 140 q4 22 26 18 q18-4 14-26 q-10-62 6-118 z" fill="url(#coat)" ' + outline(6) + '/>';
    g += '<path d="M292 322 q26 70 12 140 q-4 22-26 18 q-18-4-14-26 q10-62-6-118 z" fill="url(#coat)" ' + outline(6) + '/>';
    g += '<circle cx="142" cy="486" r="20" fill="#FFDEC0" ' + outline(5) + '/>';
    g += '<circle cx="278" cy="486" r="20" fill="#FFDEC0" ' + outline(5) + '/>';
    /* 聴診器 */
    g += '<path d="M176 300 q-6 84 34 84 q40 0 40-56" fill="none" stroke="#3C4A66" stroke-width="10" stroke-linecap="round"/>'
      + '<circle cx="250" cy="332" r="18" fill="#9AACC9" ' + outline(5) + '/><circle cx="250" cy="332" r="8" fill="#DCE6F7"/>';
    /* 首と顔 */
    g += '<rect x="186" y="228" width="48" height="44" rx="22" fill="#F0C39C" ' + outline(5) + '/>';
    g += '<circle cx="210" cy="172" r="92" fill="#FFDEC0" ' + outline(7) + '/>';
    /* 髪 */
    g += '<path d="M118 178 q-4-104 92-104 q96 0 92 104 q-6-48-34-58 q-30 30-96 20 q-44-6-54 38 z" fill="url(#hair)" ' + outline(7) + '/>';
    g += '<path d="M118 178 q-16 46 4 82 q-26-44-4-82z" fill="url(#hair)"/>';
    g += '<path d="M302 178 q16 46-4 82 q26-44 4-82z" fill="url(#hair)"/>';
    /* 表情 */
    g += '<ellipse cx="178" cy="196" rx="20" ry="12" fill="#FF9DB5" opacity=".5"/>';
    g += '<ellipse cx="244" cy="196" rx="20" ry="12" fill="#FF9DB5" opacity=".5"/>';
    if (blink) {
      g += '<path d="M168 178 q12 12 24 0" fill="none" ' + outline(7) + '/>';
      g += '<path d="M230 178 q12 12 24 0" fill="none" ' + outline(7) + '/>';
    } else {
      g += '<ellipse cx="180" cy="176" rx="11" ry="15" fill="' + LINE + '"/>'
        + '<circle cx="184" cy="170" r="4" fill="#fff"/>';
      g += '<ellipse cx="242" cy="176" rx="11" ry="15" fill="' + LINE + '"/>'
        + '<circle cx="246" cy="170" r="4" fill="#fff"/>';
    }
    g += '<path d="M198 210 q14 16 28 0" fill="none" ' + outline(6) + '/>';
    return svg(W, H, g, defs);
  }

  /* マスコット：ぷくぷく（肺） */
  function mascot(dark, blink) {
    var W = 360, H = 360;
    var defs = rg('lung', 0.35, 0.3, 0.8, [[0, '#FFC3D2'], [0.55, '#FF8FA8'], [1, '#F26C8C']])
      + rg('gloss', 0.3, 0.2, 0.5, [[0, '#FFFFFF', 0.85], [1, '#FFFFFF', 0]]);
    var g = '';
    g += '<ellipse cx="180" cy="336" rx="96" ry="14" fill="' + (dark ? '#000' : '#7A5C86') + '" opacity=".2"/>';
    /* 気管 */
    g += '<rect x="158" y="36" width="44" height="66" rx="18" fill="#F2F6FF" ' + outline(6) + '/>';
    g += '<path d="M166 56 h28 M166 76 h28" stroke="#C6D2EC" stroke-width="7" stroke-linecap="round"/>';
    /* 肺 */
    g += '<path d="M168 96 q-14 8-40 22 q-54 30-54 104 q0 80 54 88 q40 6 40-46 z" fill="url(#lung)" ' + outline(7) + '/>';
    g += '<path d="M192 96 q14 8 40 22 q54 30 54 104 q0 80-54 88 q-40 6-40-46 z" fill="url(#lung)" ' + outline(7) + '/>';
    /* つや */
    g += '<ellipse cx="110" cy="156" rx="34" ry="24" fill="url(#gloss)" transform="rotate(-22 110 156)"/>';
    /* 表情 */
    g += '<ellipse cx="116" cy="228" rx="20" ry="12" fill="#FF6E93" opacity=".6"/>';
    g += '<ellipse cx="244" cy="228" rx="20" ry="12" fill="#FF6E93" opacity=".6"/>';
    if (blink) {
      g += '<path d="M126 206 q14 14 28 0" fill="none" ' + outline(7) + '/>'
        + '<path d="M206 206 q14 14 28 0" fill="none" ' + outline(7) + '/>';
    } else {
      g += '<ellipse cx="140" cy="204" rx="13" ry="17" fill="' + LINE + '"/><circle cx="145" cy="197" r="5" fill="#fff"/>'
        + '<ellipse cx="220" cy="204" rx="13" ry="17" fill="' + LINE + '"/><circle cx="225" cy="197" r="5" fill="#fff"/>';
    }
    g += '<path d="M160 232 q20 24 40 0 q-20 32-40 0z" fill="#B23A5B" ' + outline(5) + '/>';
    return svg(W, H, g, defs);
  }

  /* 患者（ベッドごと）。tone で顔色と表示を変える。 */
  function patient(tone, dark) {
    var W = 520, H = 360;
    var skin = tone === 'bad' ? '#E7BCAC' : (tone === 'mid' ? '#F5D2B4' : '#FFDEC0');
    var defs = lg('quilt', 0, 0, 0, 1, dark
        ? [[0, '#2B3A6B'], [1, '#1B2749']]
        : [[0, '#CFE0FF'], [1, '#A9C4F5']])
      + lg('bed', 0, 0, 0, 1, [[0, '#E9EEF8'], [1, '#C6D0E6']]);
    var g = '';
    g += '<ellipse cx="260" cy="344" rx="200" ry="14" fill="' + (dark ? '#000' : '#7A5C86') + '" opacity=".2"/>';
    /* ベッドの脚と枠 */
    g += '<rect x="60" y="300" width="18" height="44" rx="9" fill="#9AA7C4" ' + outline(5) + '/>'
      + '<rect x="442" y="300" width="18" height="44" rx="9" fill="#9AA7C4" ' + outline(5) + '/>';
    g += '<rect x="40" y="150" width="26" height="160" rx="13" fill="url(#bed)" ' + outline(6) + '/>';
    /* 枕 */
    g += '<ellipse cx="140" cy="212" rx="86" ry="46" fill="#F4F7FF" ' + outline(6) + '/>';
    /* 掛け布団 */
    g += '<path d="M150 258 q160-46 300-6 q30 8 30 30 v26 q-180 22-346 0 q-8-34 16-50z" fill="url(#quilt)" ' + outline(7) + '/>';
    g += '<path d="M200 262 q140-30 260 4" fill="none" stroke="#FFFFFF" stroke-width="6" opacity=".6"/>';
    /* 頭 */
    g += '<circle cx="152" cy="196" r="66" fill="' + skin + '" ' + outline(7) + '/>';
    g += '<path d="M90 190 q6-62 62-62 q58 0 64 62 q-16-30-64-30 q-48 0-62 30z" fill="#4A4160" ' + outline(6) + '/>';
    /* 閉じた目 */
    g += '<path d="M116 196 q14 14 28 0" fill="none" ' + outline(6) + '/>'
      + '<path d="M164 196 q14 14 28 0" fill="none" ' + outline(6) + '/>';
    g += '<path d="M140 228 q12 8 24 0" fill="none" ' + outline(5) + '/>';
    /* 気管チューブ */
    g += '<path d="M152 236 q0 34-46 52 q-40 16-76 4" fill="none" stroke="#DCE9FF" stroke-width="20" stroke-linecap="round"/>'
      + '<path d="M152 236 q0 34-46 52 q-40 16-76 4" fill="none" stroke="#8FB0EE" stroke-width="6" stroke-linecap="round"/>'
      + '<rect x="126" y="222" width="52" height="24" rx="12" fill="#FFFFFF" ' + outline(5) + '/>';
    if (tone === 'bad') {
      g += '<circle cx="330" cy="150" r="26" fill="#FF5570" opacity=".9"/>'
        + '<path d="M318 150 h8 l5-14 l7 26 l5-12 h9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    return svg(W, H, g, defs);
  }

  /* ============================================================
   * 部品：板、丸バッジ、リボン、ふきだし
   * すべて 9 スライスで伸ばせるように、角と中央を分けてある。
   * ========================================================== */

  /* ボタンの板。kind: 'go'（主役） | 'plain' | 'dark' */
  function plate(kind, dark) {
    var W = 160, H = 120;
    var top, bottom, edge, lip;
    if (kind === 'go') {
      top = '#FFC24D'; bottom = '#FF8A3D'; edge = '#8A3B10'; lip = '#C4560F';
    } else if (dark) {
      top = '#26314F'; bottom = '#18213A'; edge = '#0A0F1C'; lip = '#0E1526';
    } else {
      top = '#FFFFFF'; bottom = '#EFE6F7'; edge = '#6A5B87'; lip = '#C3B4D6';
    }
    var defs = lg('face', 0, 0, 0, 1, [[0, top], [1, bottom]]);
    var g = ''
      + '<rect x="8" y="16" width="' + (W - 16) + '" height="' + (H - 24) + '" rx="26" fill="' + lip + '" stroke="' + edge + '" stroke-width="6"/>'
      + '<rect x="8" y="8" width="' + (W - 16) + '" height="' + (H - 24) + '" rx="26" fill="url(#face)" stroke="' + edge + '" stroke-width="6"/>'
      + '<rect x="22" y="20" width="' + (W - 44) + '" height="14" rx="7" fill="#FFFFFF" opacity="' + (dark && kind !== 'go' ? .12 : .45) + '"/>';
    return svg(W, H, g, defs);
  }

  /* 丸バッジ（アイコンの下敷き） */
  function badge(color, dark) {
    var W = 96, H = 96;
    var defs = lg('bd', 0, 0, 0, 1, [[0, '#FFFFFF'], [1, color]]);
    var g = '<circle cx="48" cy="50" r="40" fill="' + (dark ? '#0A0F1C' : '#6A5B87') + '" opacity=".5"/>'
      + '<circle cx="48" cy="46" r="40" fill="url(#bd)" stroke="' + LINE + '" stroke-width="6"/>'
      + '<ellipse cx="48" cy="28" rx="22" ry="10" fill="#FFFFFF" opacity=".6"/>';
    return svg(W, H, g, defs);
  }

  /* ロゴの下敷きリボン */
  function ribbon(dark) {
    var W = 720, H = 200;
    var defs = lg('rb', 0, 0, 0, 1, dark
        ? [[0, '#2B3A6B'], [1, '#18234A']]
        : [[0, '#FF7FA4'], [1, '#F0507F']]);
    var g = ''
      + '<path d="M40 150 l-30 40 v-96 l30 26z" fill="' + (dark ? '#101936' : '#B93765') + '" ' + outline(5) + '/>'
      + '<path d="M680 150 l30 40 v-96 l-30 26z" fill="' + (dark ? '#101936' : '#B93765') + '" ' + outline(5) + '/>'
      + '<rect x="34" y="40" width="652" height="120" rx="28" fill="url(#rb)" ' + outline(7) + '/>'
      + '<rect x="58" y="56" width="604" height="16" rx="8" fill="#FFFFFF" opacity=".35"/>';
    return svg(W, H, g, defs);
  }

  /* ふきだし（9 スライス用。しっぽは別に描く） */
  function bubble(dark) {
    var W = 200, H = 140;
    var g = '<rect x="8" y="8" width="' + (W - 16) + '" height="' + (H - 16) + '" rx="34" '
      + 'fill="' + (dark ? '#111A31' : '#FFFFFF') + '" ' + outline(6) + '/>';
    return svg(W, H, g);
  }

  /* 進捗バーの地と中身 */
  function barTrack(dark) {
    var W = 120, H = 40;
    return svg(W, H, '<rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" rx="14" '
      + 'fill="' + (dark ? '#0C1426' : '#E7DCEF') + '" ' + outline(6) + '/>');
  }

  function barFill() {
    var W = 120, H = 40;
    var defs = lg('bf', 0, 0, 1, 0, [[0, '#FF5E8A'], [0.5, '#FFB020'], [1, '#12C48B']]);
    return svg(W, H, '<rect x="10" y="10" width="' + (W - 20) + '" height="' + (H - 20) + '" rx="10" fill="url(#bf)"/>', defs);
  }

  /* 光の粒（浮かぶ粒子） */
  function mote(color) {
    var defs = rg('m', 0.5, 0.5, 0.5, [[0, color, 1], [0.4, color, 0.5], [1, color, 0]]);
    return svg(64, 64, '<circle cx="32" cy="32" r="32" fill="url(#m)"/>', defs);
  }

  /* 紙吹雪の紙片 */
  function confetti(color) {
    return svg(24, 36, '<rect x="2" y="2" width="20" height="32" rx="5" fill="' + color + '"/>');
  }

  /* 学習帯やトーストに出す、みどり先生の顔だけ。立ち絵と同じ描き方で small size 向けに省略してある。 */
  function face(mood, dark) {
    var m = mood || 'normal';
    var defs = lg('fsc', 0, 0, 0, 1, [[0, '#3BD6AE'], [1, '#17A585']]);
    var g = '<circle cx="60" cy="60" r="60" fill="' + (dark ? '#0F1B18' : '#E9FBF4') + '"/>';
    g += '<path d="M16 124 q4-34 24-42 l20-8 l20 8 q20 8 24 42 z" fill="url(#fsc)" ' + outline(5) + '/>';
    g += '<circle cx="60" cy="56" r="34" fill="#FFDEC0" ' + outline(5) + '/>';
    g += '<path d="M25 56 q0-36 35-36 q35 0 35 36 q-2-17-12-21 q-12 11-35 8 q-16-2-23 13z" fill="#332B4E" ' + outline(5) + '/>';
    g += '<ellipse cx="42" cy="66" rx="8" ry="5" fill="#FF9DB5" opacity=".55"/>';
    g += '<ellipse cx="78" cy="66" rx="8" ry="5" fill="#FF9DB5" opacity=".55"/>';
    if (m === 'happy') {
      g += '<path d="M42 56 q6-8 12 0" fill="none" ' + outline(5) + '/>'
        + '<path d="M66 56 q6-8 12 0" fill="none" ' + outline(5) + '/>'
        + '<path d="M52 70 q8 12 16 0 q-8 6-16 0z" fill="#B23A5B" ' + outline(4) + '/>';
    } else if (m === 'think') {
      g += '<ellipse cx="48" cy="58" rx="4" ry="6" fill="' + LINE + '"/>'
        + '<ellipse cx="72" cy="58" rx="4" ry="6" fill="' + LINE + '"/>'
        + '<path d="M40 46 l12-3 M80 46 l-12-3" ' + outline(4) + '/>'
        + '<path d="M54 72 h12" ' + outline(4) + '/>';
    } else if (m === 'alert') {
      g += '<circle cx="48" cy="58" r="8" fill="#fff" ' + outline(3) + '/><circle cx="48" cy="58" r="4" fill="' + LINE + '"/>'
        + '<circle cx="72" cy="58" r="8" fill="#fff" ' + outline(3) + '/><circle cx="72" cy="58" r="4" fill="' + LINE + '"/>'
        + '<ellipse cx="60" cy="74" rx="5" ry="6" fill="' + LINE + '"/>';
    } else if (m === 'sad') {
      g += '<ellipse cx="48" cy="60" rx="5" ry="6" fill="' + LINE + '"/>'
        + '<ellipse cx="72" cy="60" rx="5" ry="6" fill="' + LINE + '"/>'
        + '<path d="M40 48 l12 4 M80 48 l-12 4" ' + outline(4) + '/>'
        + '<path d="M52 74 q8-8 16 0" fill="none" ' + outline(4) + '/>';
    } else {
      g += '<ellipse cx="48" cy="58" rx="5" ry="7" fill="' + LINE + '"/><circle cx="50" cy="55" r="2" fill="#fff"/>'
        + '<ellipse cx="72" cy="58" rx="5" ry="7" fill="' + LINE + '"/><circle cx="74" cy="55" r="2" fill="#fff"/>'
        + '<path d="M53 72 q7 7 14 0" fill="none" ' + outline(4) + '/>';
    }
    return svg(120, 120, g, defs);
  }

  window.VentArt = {
    room: room, doctor: doctor, mascot: mascot, patient: patient, face: face,
    plate: plate, badge: badge, ribbon: ribbon, bubble: bubble,
    barTrack: barTrack, barFill: barFill, mote: mote, confetti: confetti
  };
})();
