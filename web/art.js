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
      s += '<stop offset="' + stops[i][0] + '" stop-color="' + stops[i][1]
        + '" stop-opacity="' + (stops[i][2] == null ? 1 : stops[i][2]) + '"/>';
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
    /* 集中治療室のベッドスペース。参考写真（ref/icu-bay-reference.png）と同じ画角:
     * 足側の斜めから、目の高さのやや上。真ん中にベッド、左手前に呼吸器とモニターのカート、
     * 右に輸液ポンプの柱と大型の装置、奥に窓とカーテン、床は広く。手前中央は立ち絵のために空ける。 */
    var defs = ''
      + lg('sky', 0, 0, 0, 1, dark
          ? [[0, '#141F48'], [1, '#2A3F7E']]
          : [[0, '#DCEBFF'], [1, '#F6F0E4']])
      + lg('wall', 0, 0, 0, 1, dark
          ? [[0, '#1A2036'], [1, '#12172A']]
          : [[0, '#F7F1E6'], [1, '#E9E0D2']])
      + lg('floor', 0, 0, 0, 1, dark
          ? [[0, '#2A2230'], [1, '#161220']]
          : [[0, '#D8B48E'], [1, '#B98D66']])
      + lg('curtain', 0, 0, 1, 0, dark
          ? [[0, '#3A3548'], [0.5, '#2C2838'], [1, '#3A3548']]
          : [[0, '#EAD9B8'], [0.5, '#DCC7A0'], [1, '#EAD9B8']])
      + lg('cab', 0, 0, 0, 1, dark ? [[0, '#3B4A66'], [1, '#26324A']] : [[0, '#F4F7FA'], [1, '#CFD9E6']])
      + lg('mint', 0, 0, 0, 1, dark ? [[0, '#2F6E78'], [1, '#1E4A52']] : [[0, '#BFE9E4'], [1, '#8FCFC8']])
      + lg('sheet', 0, 0, 0, 1, dark ? [[0, '#5E6A8A'], [1, '#3F4863']] : [[0, '#FFFFFF'], [1, '#DCE3F0']])
      + lg('scr', 0, 0, 0, 1, [[0, '#0E1730'], [1, '#08101F']])
      + rg('glow', 0.5, 0.5, 0.5, [[0, '#4FE3FF', dark ? 0.35 : 0.12], [1, '#4FE3FF', 0]]);
    var metal = dark ? '#5A6580' : '#A7B2C4';
    var dim = dark ? .55 : 1;

    /* 画面。波形を 3 本描く。 */
    function screen(x, y, w, h, big) {
      var s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="url(#scr)" ' + outline(5) + '/>';
      if (dark) s += '<rect x="' + (x - 40) + '" y="' + (y - 40) + '" width="' + (w + 80) + '" height="' + (h + 80) + '" fill="url(#glow)"/>' + s;
      var cols = ['#3BEFC0', '#4FE3FF', '#FFD75E'];
      var n = big ? 3 : 2, gap = h / (n + 0.4), x0 = x + 10, x1 = x + w - 10;
      for (var i = 0; i < n; i++) {
        var cy = y + gap * (i + 0.8), d = 'M' + x0 + ' ' + cy;
        for (var px = x0; px < x1; px += (x1 - x0) / 6) {
          if (i === 0) d += ' l' + ((x1 - x0) / 18) + ' 0 l4 -' + (gap * .55) + ' l5 ' + (gap * .8) + ' l4 -' + (gap * .25) + ' l' + ((x1 - x0) / 18 - 13) + ' 0';
          else if (i === 1) d += ' q' + ((x1 - x0) / 12) + ' -' + (gap * .7) + ' ' + ((x1 - x0) / 6) + ' 0';
          else d += ' l' + ((x1 - x0) / 12) + ' -' + (gap * .5) + ' l' + ((x1 - x0) / 12) + ' ' + (gap * .5);
        }
        s += '<path d="' + d + '" fill="none" stroke="' + cols[i] + '" stroke-width="' + (big ? 4 : 3) + '" stroke-linejoin="round" opacity=".95"/>';
        s += '<text x="' + (x1 - 4) + '" y="' + (cy - gap * .15) + '" font-family="sans-serif" font-size="' + (big ? 22 : 14) + '" font-weight="700" fill="' + cols[i] + '" text-anchor="end">' + ['120', '98', '24'][i] + '</text>';
      }
      return s;
    }
    /* キャスター */
    function wheel(cx, cy, r) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#4A5068" ' + outline(4) + '/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r * .4) + '" fill="#9AA3B8"/>'; }
    /* シリンジポンプ */
    function pump(x, y, w) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="46" rx="8" fill="url(#cab)" ' + outline(4) + '/>'
        + '<rect x="' + (x + 8) + '" y="' + (y + 9) + '" width="' + (w * .46) + '" height="26" rx="4" fill="#0E1730"/>'
        + '<text x="' + (x + 14) + '" y="' + (y + 28) + '" font-family="sans-serif" font-size="16" font-weight="700" fill="#7FF0C8">2.5</text>'
        + '<rect x="' + (x + w * .58) + '" y="' + (y + 14) + '" width="' + (w * .34) + '" height="16" rx="8" fill="#DCE9FF" ' + outline(3) + '/>'
        + '<circle cx="' + (x + w - 12) + '" cy="' + (y + 40) + '" r="3" fill="#3BEFC0"/>';
    }

    var g = '';
    /* 壁と天井 */
    g += '<rect width="' + W + '" height="' + H + '" fill="url(#wall)"/>';
    g += '<rect x="0" y="0" width="' + W + '" height="118" fill="' + (dark ? '#0F1424' : '#F1ECE3') + '"/>';
    for (var lx = 90; lx < W; lx += 380) {
      g += '<rect x="' + lx + '" y="30" width="230" height="52" rx="10" fill="' + (dark ? '#1C2440' : '#FFFFFF') + '" ' + outline(4) + '/>';
      if (!dark) g += '<rect x="' + (lx + 10) + '" y="40" width="210" height="32" rx="6" fill="#FFF9E8"/>';
    }
    g += '<rect x="0" y="112" width="' + W + '" height="12" fill="' + (dark ? '#0A0E1C' : '#D9D0C2') + '"/>';

    /* 奥の窓（2 つ）と、その間の壁面パネル */
    [[210, 160], [980, 160]].forEach(function (p) {
      g += '<rect x="' + p[0] + '" y="' + p[1] + '" width="330" height="220" rx="10" fill="url(#sky)" ' + outline(7) + '/>';
      g += '<rect x="' + (p[0] + 160) + '" y="' + p[1] + '" width="10" height="220" fill="' + (dark ? '#2A3660' : '#FFFFFF') + '"/>';
      g += '<rect x="' + p[0] + '" y="' + (p[1] + 105) + '" width="330" height="10" fill="' + (dark ? '#2A3660' : '#FFFFFF') + '"/>';
      /* ブラインド */
      for (var by = p[1] + 14; by < p[1] + 100; by += 16) g += '<rect x="' + (p[0] + 8) + '" y="' + by + '" width="314" height="5" fill="' + (dark ? '#1B2650' : '#FFFFFF') + '" opacity=".7"/>';
    });
    /* 医療ガスのパネル（ベッドの頭側の壁） */
    g += '<rect x="600" y="300" width="360" height="300" rx="12" fill="' + (dark ? '#1F2740' : '#EDE7DB') + '" ' + outline(5) + '/>';
    g += '<rect x="600" y="418" width="360" height="70" fill="' + (dark ? '#2A3350' : '#DAD3C6') + '" ' + outline(4) + '/>';
    [['#4CC66F', 650], ['#F2CE3C', 710], ['#9AA3B8', 770], ['#4CC66F', 850], ['#9AA3B8', 910]].forEach(function (o) {
      g += '<circle cx="' + o[1] + '" cy="453" r="16" fill="' + o[0] + '" ' + outline(4) + '/><circle cx="' + o[1] + '" cy="453" r="6" fill="#2E2545" opacity=".6"/>';
    });
    for (var sx = 640; sx < 940; sx += 60) g += '<rect x="' + sx + '" y="520" width="34" height="34" rx="6" fill="' + (dark ? '#0F1424' : '#FFFFFF') + '" ' + outline(3) + '/><circle cx="' + (sx + 11) + '" cy="537" r="3" fill="#2E2545"/><circle cx="' + (sx + 23) + '" cy="537" r="3" fill="#2E2545"/>';
    /* 壁のモニター */
    g += '<rect x="640" y="316" width="280" height="90" rx="10" fill="' + (dark ? '#2A3350' : '#C9D2E0') + '" ' + outline(4) + '/>' + screen(650, 324, 260, 74, false);
    /* 掲示板 */
    g += '<rect x="1370" y="200" width="200" height="150" rx="8" fill="' + (dark ? '#2C2A3E' : '#E6D7B8') + '" ' + outline(5) + '/>';
    [[1386, 214], [1470, 220], [1400, 280], [1490, 276]].forEach(function (c) { g += '<rect x="' + c[0] + '" y="' + c[1] + '" width="60" height="54" fill="#FFFFFF" opacity="' + dim + '" ' + outline(2) + '/>'; });

    /* カーテンレールとカーテン */
    g += '<rect x="0" y="126" width="' + W + '" height="8" fill="' + metal + '"/>';
    g += '<path d="M0 134 h150 q-10 60 8 120 q-18 70 4 140 q-20 80 6 160 q-18 40 8 90 h-176 z" fill="url(#curtain)" ' + outline(5) + '/>';
    g += '<path d="M560 134 h60 q-8 70 6 130 q-12 80 4 150 q-10 60 4 110 h-84 q14-60 0-120 q-12-80 6-140 q-10-70 4-130 z" fill="url(#curtain)" ' + outline(5) + '/>';
    g += '<path d="M' + W + ' 134 h-170 q14 70-4 130 q12 80-2 160 q14 80-6 140 q12 40-6 90 h188 z" fill="url(#curtain)" ' + outline(5) + '/>';

    /* 床 */
    g += '<rect x="0" y="640" width="' + W + '" height="360" fill="url(#floor)"/>';
    g += '<rect x="0" y="636" width="' + W + '" height="10" fill="' + (dark ? '#0A0E1C' : '#8F6B4A') + '"/>';
    for (var fx = -300; fx < W + 300; fx += 200) g += '<path d="M' + (800 + (fx - 800) * .25) + ' 646 L' + fx + ' 1000" stroke="' + (dark ? '#1E1828' : '#C69E75') + '" stroke-width="3" opacity=".6"/>';

    /* ベッド（中景） */
    g += '<rect x="560" y="560" width="470" height="150" rx="16" fill="url(#cab)" ' + outline(6) + '/>';
    g += '<rect x="548" y="500" width="30" height="180" rx="12" fill="url(#cab)" ' + outline(5) + '/>';
    g += '<rect x="1012" y="520" width="30" height="160" rx="12" fill="url(#cab)" ' + outline(5) + '/>';
    g += '<path d="M580 600 q40-60 120-58 h300 q30 0 30 30 v40 h-450 z" fill="url(#sheet)" ' + outline(6) + '/>';
    g += '<path d="M700 560 q140-30 300 0" fill="none" stroke="#FFFFFF" stroke-width="6" opacity="' + (dark ? .2 : .7) + '"/>';
    g += '<ellipse cx="640" cy="580" rx="52" ry="26" fill="' + (dark ? '#8892B0' : '#FFFFFF') + '" ' + outline(5) + '/>';
    g += '<rect x="560" y="640" width="470" height="14" fill="' + metal + '"/>';
    g += wheel(600, 716, 14) + wheel(990, 716, 14);
    /* ベッド脇の点滴スタンド */
    g += '<rect x="1058" y="360" width="8" height="380" fill="' + metal + '"/>'
      + '<path d="M1020 372 h84" stroke="' + metal + '" stroke-width="8" stroke-linecap="round"/>'
      + '<rect x="1024" y="380" width="30" height="70" rx="8" fill="' + (dark ? '#26324A' : '#EAF2FF') + '" ' + outline(3) + '/>'
      + '<rect x="1072" y="380" width="30" height="70" rx="8" fill="' + (dark ? '#4A3A5C' : '#FFE1E8') + '" ' + outline(3) + '/>'
      + '<path d="M1039 450 q10 90-80 120" stroke="#8FB0EE" stroke-width="3" fill="none"/>';

    /* 右：シリンジポンプの柱 */
    g += '<rect x="1156" y="300" width="10" height="440" fill="' + metal + '"/>';
    for (var py = 0; py < 4; py++) g += pump(1104, 400 + py * 56, 114);
    g += '<path d="M1128 740 h60 M1158 740 v10" stroke="' + metal + '" stroke-width="10" stroke-linecap="round"/>' + wheel(1132, 758, 10) + wheel(1186, 758, 10);
    /* 右手前：大型装置（透析・ECMO 風） */
    g += '<rect x="1250" y="380" width="300" height="520" rx="20" fill="url(#cab)" ' + outline(7) + '/>';
    g += '<rect x="1250" y="380" width="300" height="60" rx="20" fill="url(#mint)" ' + outline(5) + '/>';
    g += '<rect x="1270" y="392" width="260" height="36" rx="10" fill="url(#mint)"/>';
    g += screen(1272, 460, 200, 120, false);
    g += '<rect x="1272" y="600" width="256" height="70" rx="10" fill="' + (dark ? '#1C2440' : '#E6EDF5') + '" ' + outline(4) + '/>';
    for (var kx = 1290; kx < 1520; kx += 46) g += '<circle cx="' + kx + '" cy="635" r="14" fill="' + (dark ? '#33405C' : '#FFFFFF') + '" ' + outline(3) + '/>';
    g += '<rect x="1300" y="690" width="60" height="150" rx="10" fill="#FF7A8A" opacity=".9" ' + outline(4) + '/>'
      + '<rect x="1380" y="700" width="40" height="120" rx="10" fill="#FFB86B" opacity=".9" ' + outline(4) + '/>'
      + '<path d="M1330 690 q0-140 -150-120 q-60 8-60 90" fill="none" stroke="#E4586C" stroke-width="7" stroke-linecap="round"/>'
      + '<path d="M1400 700 q10-160 -180-150" fill="none" stroke="#6B7CFF" stroke-width="7" stroke-linecap="round"/>';
    g += wheel(1290, 912, 16) + wheel(1510, 912, 16);

    /* 左：モニターのスタンド */
    g += '<rect x="506" y="470" width="8" height="380" fill="' + metal + '"/>';
    g += '<path d="M466 850 h88" stroke="' + metal + '" stroke-width="10" stroke-linecap="round"/>' + wheel(472, 866, 12) + wheel(548, 866, 12);
    g += '<rect x="412" y="330" width="200" height="140" rx="12" fill="' + (dark ? '#2A3350' : '#C9D2E0') + '" ' + outline(5) + '/>' + screen(422, 340, 180, 120, true);
    /* 左手前：人工呼吸器のカート */
    g += '<rect x="60" y="520" width="320" height="380" rx="22" fill="url(#cab)" ' + outline(7) + '/>';
    g += '<rect x="60" y="520" width="320" height="40" rx="18" fill="url(#mint)" ' + outline(5) + '/>';
    g += '<rect x="84" y="580" width="270" height="60" rx="10" fill="' + (dark ? '#1C2440' : '#E6EDF5') + '" ' + outline(4) + '/>';
    for (var bx = 100; bx < 340; bx += 48) g += '<rect x="' + bx + '" y="594" width="34" height="32" rx="8" fill="' + (dark ? '#33405C' : '#FFFFFF') + '" ' + outline(3) + '/>';
    g += '<circle cx="320" cy="700" r="34" fill="' + (dark ? '#33405C' : '#FFFFFF') + '" ' + outline(5) + '/><path d="M320 700 l14-20" stroke="#2E2545" stroke-width="5" stroke-linecap="round"/>';
    g += '<rect x="84" y="660" width="180" height="120" rx="10" fill="' + (dark ? '#1C2440' : '#DCE3F0') + '" ' + outline(4) + '/>';
    for (var vy = 676; vy < 770; vy += 14) g += '<rect x="96" y="' + vy + '" width="156" height="5" rx="2" fill="' + (dark ? '#33405C' : '#B7C3D6') + '"/>';
    g += '<rect x="84" y="800" width="270" height="70" rx="10" fill="' + (dark ? '#1C2440' : '#E6EDF5') + '" ' + outline(4) + '/>';
    g += wheel(110, 916, 18) + wheel(330, 916, 18);
    /* 呼吸器の画面（腕の上） */
    g += '<rect x="230" y="360" width="8" height="160" fill="' + metal + '"/>';
    g += '<rect x="100" y="240" width="290" height="200" rx="14" fill="' + (dark ? '#2A3350' : '#C9D2E0') + '" ' + outline(6) + '/>' + screen(112, 252, 266, 176, true);
    /* 回路（青と白の蛇管）がベッドへ */
    g += '<path d="M380 540 q120-140 250-90 q60 30 60 110" fill="none" stroke="' + (dark ? '#2A3660' : '#FFFFFF') + '" stroke-width="18" stroke-linecap="round"/>'
      + '<path d="M380 540 q120-140 250-90 q60 30 60 110" fill="none" stroke="#8FB0EE" stroke-width="8" stroke-linecap="round" stroke-dasharray="6 8"/>'
      + '<path d="M370 560 q120-100 240-60" fill="none" stroke="#3BD6AE" stroke-width="6" stroke-linecap="round" opacity=".9"/>';
    /* 床のケーブル */
    g += '<path d="M380 900 q100-40 200 20 q120 60 260 -10" fill="none" stroke="' + (dark ? '#0A0E1C' : '#5A4A60') + '" stroke-width="5" opacity=".6"/>'
      + '<path d="M1040 720 q60 120 200 140" fill="none" stroke="' + (dark ? '#0A0E1C' : '#5A4A60') + '" stroke-width="5" opacity=".6"/>';
    /* ベッドのくま（唯一の飾り） */
    g += '<circle cx="960" cy="562" r="9" fill="#D9A066" ' + outline(3) + '/><circle cx="984" cy="562" r="9" fill="#D9A066" ' + outline(3) + '/>'
      + '<circle cx="972" cy="576" r="20" fill="#E8B77A" ' + outline(4) + '/><ellipse cx="972" cy="582" rx="8" ry="6" fill="#FFE2B8"/>'
      + '<circle cx="965" cy="572" r="2.4" fill="' + LINE + '"/><circle cx="979" cy="572" r="2.4" fill="' + LINE + '"/><circle cx="972" cy="580" r="2.4" fill="' + LINE + '"/>';

    return svg(W, H, g, defs);
  }

  /* ============================================================
   * キャラクター
   * ========================================================== */

  /* 指導医：いぶき先生（立ち絵） */
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
    /* 胸のくまのバッジ（小児科医のしるし） */
    g += '<circle cx="150" cy="356" r="16" fill="#FFF3B0" ' + outline(4) + '/>'
      + '<circle cx="143" cy="349" r="4" fill="#D9A066"/><circle cx="157" cy="349" r="4" fill="#D9A066"/>'
      + '<circle cx="150" cy="357" r="9" fill="#E8B77A"/><circle cx="147" cy="355" r="1.6" fill="' + LINE + '"/><circle cx="153" cy="355" r="1.6" fill="' + LINE + '"/>'
      + '<ellipse cx="150" cy="360" rx="3.6" ry="2.6" fill="#FFE2B8"/>';
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

  /* マスコット：ぷくぷく（ふわふわの「息」の精）。
   * 肺そのものの形は怖いと言われたので、白くて丸い雲のような体に、頭に小さな空気の渦。 */
  function mascot(dark, blink) {
    var W = 360, H = 360;
    var defs = rg('puff', 0.4, 0.3, 0.75, [[0, '#FFFFFF'], [0.6, '#F1F7FF'], [1, '#CFE2FF']])
      + rg('gloss', 0.3, 0.2, 0.5, [[0, '#FFFFFF', 0.9], [1, '#FFFFFF', 0]]);
    var g = '';
    g += '<ellipse cx="180" cy="336" rx="100" ry="14" fill="' + (dark ? '#000' : '#7A5C86') + '" opacity=".2"/>';
    /* 体：丸いこぶをつなげた雲 */
    g += '<path d="M120 300 q-60 0-62-58 q-2-46 40-56 q-6-58 52-66 q30-40 76-14 q52-14 70 38 q44 8 44 56 q0 52-46 58 q-14 36-56 30 q-30 26-64 6 q-30 14-54 6z" fill="url(#puff)" ' + outline(7) + '/>';
    /* つや */
    g += '<ellipse cx="128" cy="150" rx="40" ry="26" fill="url(#gloss)" transform="rotate(-18 128 150)"/>';
    /* 頭の小さな空気の渦 */
    g += '<path d="M198 110 q-6-40 30-42 q28 0 22 26 q-4 16-20 12" fill="none" ' + outline(7) + '/>';
    /* 表情 */
    g += '<ellipse cx="118" cy="226" rx="22" ry="13" fill="#FF9DB5" opacity=".65"/>';
    g += '<ellipse cx="246" cy="226" rx="22" ry="13" fill="#FF9DB5" opacity=".65"/>';
    if (blink) {
      g += '<path d="M128 204 q14 14 28 0" fill="none" ' + outline(7) + '/>'
        + '<path d="M208 204 q14 14 28 0" fill="none" ' + outline(7) + '/>';
    } else {
      g += '<ellipse cx="142" cy="202" rx="13" ry="17" fill="' + LINE + '"/><circle cx="147" cy="195" r="5" fill="#fff"/>'
        + '<ellipse cx="222" cy="202" rx="13" ry="17" fill="' + LINE + '"/><circle cx="227" cy="195" r="5" fill="#fff"/>';
    }
    g += '<path d="M166 232 q16 18 32 0" fill="none" ' + outline(6) + '/>';
    /* 手：小さな丸 */
    g += '<circle cx="84" cy="262" r="16" fill="#FFFFFF" ' + outline(5) + '/><circle cx="280" cy="262" r="16" fill="#FFFFFF" ' + outline(5) + '/>';
    return svg(W, H, g, defs);
  }

  /* 患者。小児科なので、年齢層で見た目を変える。
   *   kind: 'neonate'（保育器の新生児） | 'infant'（ベビーベッドの乳児、既定） | 'child'（ベッドの学童）
   *   tone: 'ok' | 'mid' | 'bad'（顔色。SpO₂ と症例の重さで決まる） */
  function patient(tone, dark, kind) {
    var W = 520, H = 360;
    kind = kind || 'infant';
    var skin = tone === 'bad' ? '#E7BCAC' : (tone === 'mid' ? '#F5D2B4' : '#FFDEC0');
    var cheek = tone === 'bad' ? '#D9A6B0' : '#FFB3C6';
    var defs = lg('quilt', 0, 0, 0, 1, dark
        ? [[0, '#2B3A6B'], [1, '#1B2749']]
        : [[0, '#FFE1EC'], [1, '#F5BFD6']])
      + lg('bed', 0, 0, 0, 1, [[0, '#FFFFFF'], [1, '#DCE4F4']])
      + lg('glass', 0, 0, 0, 1, [[0, '#FFFFFF', 0.55], [0.5, '#DDF3FF', 0.25], [1, '#BFE3FF', 0.35]])
      + lg('cab', 0, 0, 0, 1, dark ? [[0, '#3A4670'], [1, '#26304F']] : [[0, '#F1F4FB'], [1, '#C9D3E8']]);
    var g = '';
    var metal = '#9AA7C4';

    /* 赤ちゃん・子ども本体。頭の中心 (cx, cy)、頭の半径 r。 */
    function kid(cx, cy, r, bodyW, hair) {
      var s = '';
      /* 胴（掛け布団の下） */
      s += '<path d="M' + (cx + r * 0.6) + ' ' + (cy + r * 0.9) + ' q' + bodyW * 0.55 + '-' + r * 0.7 + ' ' + bodyW + '-' + r * 0.1
        + ' q' + (r * 0.5) + ' ' + (r * 0.15) + ' ' + (r * 0.5) + ' ' + (r * 0.55) + ' v' + (r * 0.5)
        + ' q-' + (bodyW * 0.62) + ' ' + (r * 0.4) + ' -' + (bodyW + r * 1.1) + ' 0 q-' + (r * 0.2) + '-' + (r * 0.6) + ' ' + (r * 0.3) + '-' + (r * 0.95) + 'z" fill="url(#quilt)" ' + outline(7) + '/>';
      /* 布団の星 */
      var sx = cx + r * 1.6, sy = cy + r * 1.05;
      s += '<path d="M' + sx + ' ' + (sy - 9) + ' l3 6 l7 1 l-5 5 l1 7 l-6-3 l-6 3 l1-7 l-5-5 l7-1z" fill="#FFF" opacity=".75"/>';
      s += '<path d="M' + (sx + 46) + ' ' + (sy + 2) + ' l2 5 l6 1 l-4 4 l1 6 l-5-3 l-5 3 l1-6 l-4-4 l6-1z" fill="#FFF" opacity=".6"/>';
      /* 頭 */
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + skin + '" ' + outline(7) + '/>';
      /* 髪：赤ちゃんは一房、子どもは前髪 */
      if (hair === 'tuft') {
        s += '<path d="M' + (cx - 6) + ' ' + (cy - r) + ' q4-30 26-26 q-14 6-10 26z" fill="#4A4160" ' + outline(5) + '/>';
      } else {
        s += '<path d="M' + (cx - r * 0.95) + ' ' + (cy - r * 0.05) + ' q6-' + r * 1.1 + ' ' + r * 0.95 + '-' + r * 1.1 + ' q' + r * 0.9 + ' 0 ' + r * 0.95 + ' ' + r * 1.1
          + ' q-' + r * 0.3 + '-' + r * 0.5 + '-' + r * 0.95 + '-' + r * 0.45 + ' q-' + r * 0.6 + ' 0-' + r * 0.95 + ' ' + r * 0.45 + 'z" fill="#4A4160" ' + outline(6) + '/>';
      }
      /* ほっぺ */
      s += '<ellipse cx="' + (cx - r * 0.55) + '" cy="' + (cy + r * 0.2) + '" rx="' + r * 0.26 + '" ry="' + r * 0.16 + '" fill="' + cheek + '" opacity=".6"/>'
        + '<ellipse cx="' + (cx + r * 0.55) + '" cy="' + (cy + r * 0.2) + '" rx="' + r * 0.26 + '" ry="' + r * 0.16 + '" fill="' + cheek + '" opacity=".6"/>';
      /* 閉じた目 */
      s += '<path d="M' + (cx - r * 0.55) + ' ' + (cy - r * 0.02) + ' q' + r * 0.18 + ' ' + r * 0.2 + ' ' + r * 0.36 + ' 0" fill="none" ' + outline(6) + '/>'
        + '<path d="M' + (cx + r * 0.19) + ' ' + (cy - r * 0.02) + ' q' + r * 0.18 + ' ' + r * 0.2 + ' ' + r * 0.36 + ' 0" fill="none" ' + outline(6) + '/>';
      /* 心電図の電極 3 つとリード、足の SpO₂ プローブ */
      var ex = cx + r * 1.15, ey = cy + r * 0.7;
      s += '<path d="M' + ex + ' ' + ey + ' q' + (r * 1.2) + '-' + (r * 0.4) + ' ' + (r * 2.4) + '-' + (r * 1.6) + '" fill="none" stroke="#7FD3A8" stroke-width="3"/>'
        + '<path d="M' + (ex + r * 0.4) + ' ' + (ey + r * 0.25) + ' q' + (r * 1.2) + '-' + (r * 0.3) + ' ' + (r * 2.0) + '-' + (r * 1.35) + '" fill="none" stroke="#FFFFFF" stroke-width="3"/>'
        + '<circle cx="' + ex + '" cy="' + ey + '" r="' + (r * 0.13) + '" fill="#FFFFFF" ' + outline(3) + '/>'
        + '<circle cx="' + (ex + r * 0.4) + '" cy="' + (ey + r * 0.25) + '" r="' + (r * 0.13) + '" fill="#FFFFFF" ' + outline(3) + '/>'
        + '<circle cx="' + (ex + r * 0.55) + '" cy="' + (ey - r * 0.15) + '" r="' + (r * 0.13) + '" fill="#FFFFFF" ' + outline(3) + '/>';
      var fx = cx + bodyW + r * 1.25, fy = cy + r * 1.25;
      s += '<rect x="' + (fx - r * 0.22) + '" y="' + (fy - r * 0.14) + '" width="' + (r * 0.44) + '" height="' + (r * 0.28) + '" rx="' + (r * 0.1) + '" fill="#DCE9FF" ' + outline(3) + '/>'
        + '<circle cx="' + fx + '" cy="' + fy + '" r="' + (r * 0.07) + '" fill="#FF3B5C"/>'
        + '<path d="M' + fx + ' ' + (fy + r * 0.14) + ' q' + (r * 0.3) + ' ' + (r * 0.8) + ' ' + (r * 1.2) + ' ' + (r * 0.9) + '" fill="none" stroke="#9AA7C4" stroke-width="3"/>';
      /* 気管チューブ（口から左へ） */
      var mx = cx, my = cy + r * 0.62;
      s += '<path d="M' + mx + ' ' + my + ' q-' + r * 0.2 + ' ' + r * 0.7 + '-' + r * 1.3 + ' ' + r * 0.85 + ' q-' + r * 0.6 + ' ' + r * 0.1 + '-' + r * 1.5 + ' 0" fill="none" stroke="#DCE9FF" stroke-width="' + Math.max(12, r * 0.3) + '" stroke-linecap="round"/>'
        + '<path d="M' + mx + ' ' + my + ' q-' + r * 0.2 + ' ' + r * 0.7 + '-' + r * 1.3 + ' ' + r * 0.85 + ' q-' + r * 0.6 + ' ' + r * 0.1 + '-' + r * 1.5 + ' 0" fill="none" stroke="#8FB0EE" stroke-width="' + Math.max(4, r * 0.1) + '" stroke-linecap="round"/>'
        + '<rect x="' + (mx - r * 0.34) + '" y="' + (my - r * 0.16) + '" width="' + r * 0.68 + '" height="' + r * 0.32 + '" rx="' + r * 0.16 + '" fill="#FFFFFF" ' + outline(5) + '/>';
      return s;
    }

    /* くまのぬいぐるみ */
    function bear(x, y, k) {
      var s = '';
      s += '<circle cx="' + (x - 16 * k) + '" cy="' + (y - 20 * k) + '" r="' + 9 * k + '" fill="#D9A066" ' + outline(4) + '/>'
        + '<circle cx="' + (x + 16 * k) + '" cy="' + (y - 20 * k) + '" r="' + 9 * k + '" fill="#D9A066" ' + outline(4) + '/>'
        + '<circle cx="' + x + '" cy="' + (y - 8 * k) + '" r="' + 22 * k + '" fill="#E8B77A" ' + outline(5) + '/>'
        + '<ellipse cx="' + x + '" cy="' + (y - 2 * k) + '" rx="' + 9 * k + '" ry="' + 7 * k + '" fill="#FFE2B8"/>'
        + '<circle cx="' + x + '" cy="' + (y - 5 * k) + '" r="' + 3 * k + '" fill="' + LINE + '"/>'
        + '<circle cx="' + (x - 8 * k) + '" cy="' + (y - 12 * k) + '" r="' + 2.4 * k + '" fill="' + LINE + '"/>'
        + '<circle cx="' + (x + 8 * k) + '" cy="' + (y - 12 * k) + '" r="' + 2.4 * k + '" fill="' + LINE + '"/>';
      return s;
    }

    g += '<ellipse cx="260" cy="344" rx="200" ry="14" fill="' + (dark ? '#000' : '#7A5C86') + '" opacity=".2"/>';

    if (kind === 'neonate') {
      /* 保育器：台と、透明なドーム */
      g += '<rect x="70" y="250" width="380" height="70" rx="16" fill="url(#cab)" ' + outline(6) + '/>';
      g += '<rect x="96" y="272" width="120" height="26" rx="8" fill="' + (dark ? '#1B2440' : '#EAF2FF') + '" ' + outline(4) + '/>';
      g += '<circle cx="360" cy="285" r="7" fill="#3BEFC0"/><circle cx="386" cy="285" r="7" fill="#FFC24D"/>';
      g += '<circle cx="110" cy="330" r="14" fill="#6B7590" ' + outline(4) + '/><circle cx="410" cy="330" r="14" fill="#6B7590" ' + outline(4) + '/>';
      /* マット */
      g += '<rect x="90" y="222" width="340" height="30" rx="12" fill="url(#bed)" ' + outline(5) + '/>';
      /* 赤ちゃん（小さめ） */
      g += kid(170, 200, 34, 130, 'tuft');
      /* ドーム（手前に、半透明） */
      g += '<path d="M78 250 v-90 q0-70 70-70 h224 q70 0 70 70 v90 z" fill="url(#glass)" ' + outline(6) + '/>';
      g += '<path d="M110 176 q4-56 60-62" fill="none" stroke="#FFF" stroke-width="8" stroke-linecap="round" opacity=".8"/>';
      /* 処置窓 */
      g += '<circle cx="330" cy="200" r="26" fill="none" stroke="#FFF" stroke-width="7" opacity=".85"/>';
    } else if (kind === 'child') {
      /* 学童のベッド：おとな用より小さく、くまつき */
      g += '<rect x="70" y="300" width="18" height="44" rx="9" fill="' + metal + '" ' + outline(5) + '/>'
        + '<rect x="432" y="300" width="18" height="44" rx="9" fill="' + metal + '" ' + outline(5) + '/>';
      g += '<rect x="50" y="160" width="26" height="150" rx="13" fill="url(#bed)" ' + outline(6) + '/>';
      g += '<rect x="60" y="252" width="400" height="44" rx="14" fill="url(#bed)" ' + outline(6) + '/>';
      g += '<ellipse cx="150" cy="222" rx="80" ry="42" fill="#F4F7FF" ' + outline(6) + '/>';
      g += kid(160, 202, 56, 200, 'bangs');
      g += bear(420, 250, 1.1);
    } else {
      /* 乳児のベビーベッド：柵が後ろに立つ */
      var bar = dark ? '#3D4870' : '#FFFFFF';
      for (var i = 0; i < 9; i++) {
        g += '<rect x="' + (78 + i * 46) + '" y="120" width="12" height="150" rx="6" fill="' + bar + '" ' + outline(4) + '/>';
      }
      g += '<rect x="60" y="106" width="400" height="22" rx="11" fill="' + bar + '" ' + outline(5) + '/>';
      /* マットと側板 */
      g += '<rect x="50" y="248" width="420" height="34" rx="12" fill="url(#bed)" ' + outline(6) + '/>';
      g += '<rect x="50" y="270" width="420" height="52" rx="14" fill="' + (dark ? '#2B3556' : '#FBE3EC') + '" ' + outline(6) + '/>';
      g += '<circle cx="110" cy="330" r="12" fill="#6B7590" ' + outline(4) + '/><circle cx="410" cy="330" r="12" fill="#6B7590" ' + outline(4) + '/>';
      /* 赤ちゃん */
      g += kid(160, 210, 44, 150, 'tuft');
      g += bear(420, 246, 0.9);
      /* 吊りモビール */
      g += '<path d="M330 40 v66" stroke="' + metal + '" stroke-width="4"/>'
        + '<path d="M290 106 h80" stroke="' + metal + '" stroke-width="4" stroke-linecap="round"/>'
        + '<path d="M296 106 v22 M364 106 v18" stroke="' + metal + '" stroke-width="3"/>'
        + '<path d="M296 128 l4 8 l9 1 l-6 6 l1 9 l-8-4 l-8 4 l1-9 l-6-6 l9-1z" fill="#FFD75E" ' + outline(3) + '/>'
        + '<path d="M364 124 q-14 4-14 16 q0 12 14 16 q-8-8 0-32z" fill="#FFF3B0" ' + outline(3) + '/>';
    }
    if (tone === 'bad') {
      g += '<circle cx="470" cy="70" r="26" fill="#FF5570" opacity=".9"/>'
        + '<path d="M458 70 h8 l5-14 l7 26 l5-12 h9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
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

  /* 学習帯やトーストに出す、いぶき先生の顔だけ。立ち絵と同じ描き方で small size 向けに省略してある。 */
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
