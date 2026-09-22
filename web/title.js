/* タイトル画面。WebGL（PixiJS）で 1 枚の絵として組み立てる。
 *
 * ここだけ描画の作り方が違う理由:
 *   ゲームのタイトルに必要な「奥行き・待機アニメ・粒子・場面転換」は、
 *   普通の Web の部品の積み重ねでは硬くなる。絵として動かせる面を 1 枚持たせる。
 *   人工呼吸器の操作画面は実機らしさが中身そのものなので、そちらには手を入れない。
 *
 * 使い方:
 *   VentTitle.show({ mount, dark, done, total, line, items, onSelect, onTheme })
 *   VentTitle.hide()
 *   VentTitle.rect(id)  … 動作確認用。ボタンの位置を CSS ピクセルで返す。
 */
(function () {
  'use strict';

  var FONT = '"Dela Gothic One","M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Yu Gothic",sans-serif';
  var app = null;           // PIXI.Application
  var opts = null;
  var tex = {};             // data URI -> Texture
  var buttons = {};         // id -> Container
  var layers = null;
  var anim = [];            // 毎フレーム呼ぶもの
  var building = false;

  function available() { return !!(window.PIXI && window.VentArt); }

  /* ---- SVG を実ピクセルに焼いてテクスチャにする ---- */
  function dpr() { return Math.min(2, window.devicePixelRatio || 1); }

  function texture(uri, w, h) {
    var key = uri.length + ':' + w + ':' + uri.slice(-40);
    if (tex[key]) return Promise.resolve(tex[key]);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var r = dpr();
        if (uri.slice(0, 5) !== 'data:') {
          /* 生成画像（PNG）はそのまま貼る。SVG のように描き直す必要がない。 */
          var t0 = window.PIXI.ImageSource
            ? new window.PIXI.Texture({ source: new window.PIXI.ImageSource({ resource: img, resolution: 1 }) })
            : window.PIXI.Texture.from(img);
          tex[key] = t0;
          resolve(t0);
          return;
        }
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * r));
        c.height = Math.max(1, Math.round(h * r));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var t;
        if (window.PIXI.CanvasSource) {
          t = new window.PIXI.Texture({ source: new window.PIXI.CanvasSource({ resource: c, resolution: r }) });
        } else {
          t = window.PIXI.Texture.from(c);
        }
        tex[key] = t;
        resolve(t);
      };
      img.onerror = function () { resolve(null); };
      img.src = uri;
    });
  }

  function sprite(t) { return new window.PIXI.Sprite(t); }

  /* 生成画像（assets/）があればそれを、無ければ art.js の SVG を焼く。 */
  function pick(name, w, h, svgUri) {
    var AS = window.VentAssets;
    if (AS && AS.has(name)) {
      var sz = AS.size(name);
      return texture(AS.url(name), sz.w, sz.h);
    }
    return texture(svgUri, w, h);
  }

  function hasAsset(name) { return !!(window.VentAssets && window.VentAssets.has(name)); }

  /* 9 スライスを「テクスチャの高さが h になる縮尺」で貼る。角が潰れない。 */
  function fitNine(ns, w, h) {
    var k = h / ns.texture.height;
    ns.scale.set(k);
    ns.width = w / k;
    ns.height = h / k;
  }

  function nine(t, l, top, r, b) {
    return new window.PIXI.NineSliceSprite({ texture: t, leftWidth: l, topHeight: top, rightWidth: r, bottomHeight: b });
  }

  function text(str, size, color, weight, stroke) {
    var style = {
      fontFamily: FONT, fontSize: size, fontWeight: weight || '800', fill: color,
      align: 'center', lineHeight: Math.round(size * 1.45)
    };
    if (stroke) style.stroke = { color: stroke, width: Math.max(3, size * 0.18), join: 'round' };
    style.dropShadow = { color: 0x2E2545, alpha: 0.28, blur: 2, angle: Math.PI / 2, distance: Math.max(2, size * 0.08) };
    return new window.PIXI.Text({ text: str, style: style });
  }

  /* ---- 画面を組み立てる ---- */
  function show(o) {
    if (!available()) return Promise.resolve(false);
    if (building) return Promise.resolve(false);
    building = true;
    opts = o;
    var A = window.VentArt;
    var mount = o.mount;

    var ready = app ? Promise.resolve(app) : createApp(mount);
    return ready.then(function () {
      if (mount && app.canvas.parentNode !== mount) mount.appendChild(app.canvas);
      return fonts();
    }).then(function () {
      return window.VentAssets ? window.VentAssets.ready : null;
    }).then(function () {
      var dark = !!o.dark;
      var icons = ['go', 'course', 'cases', 'about'].map(function (id) {
        return hasAsset('icon_' + id) ? pick('icon_' + id) : Promise.resolve(null);
      });
      return Promise.all([
        pick(dark ? 'bg_title_night' : 'bg_title_day', 1600, 1000, A.room(dark)),
        pick('doctor_normal', 420, 560, A.doctor(dark, false)),
        hasAsset('doctor_normal') ? pick('doctor_normal') : texture(A.doctor(dark, true), 420, 560),
        pick('mascot_happy', 360, 360, A.mascot(dark, false)),
        hasAsset('mascot_happy') ? pick(hasAsset('mascot_excited') ? 'mascot_excited' : 'mascot_happy')
                                 : texture(A.mascot(dark, true), 360, 360),
        pick(['patient_postop', 'patient_infant', 'patient_child', 'patient_bed'].filter(hasAsset)[0] || 'patient_bed', 520, 360, A.patient('ok', dark, 'infant')),
        pick('ui_ribbon', 720, 200, A.ribbon(dark)),
        texture(A.bubble(dark), 200, 140),
        pick('ui_button_primary', 160, 120, A.plate('go', dark)),
        pick('ui_button', 160, 120, A.plate('plain', dark)),
        texture(A.badge('#FF8A3D', dark), 96, 96),
        texture(A.badge('#5B7CFA', dark), 96, 96),
        texture(A.barTrack(dark), 120, 40),
        texture(A.barFill(), 120, 40),
        texture(A.mote(dark ? '#9FC0FF' : '#FFF2C4'), 64, 64),
        hasAsset('logo') ? pick('logo') : Promise.resolve(null)
      ].concat(icons));
    }).then(function (t) {
      var AS = window.VentAssets;
      build({
        room: t[0], doctor: t[1], doctorBlink: t[2], mascot: t[3], mascotBlink: t[4],
        patient: t[5], ribbon: t[6], bubble: t[7], plateGo: t[8], plate: t[9],
        badgeGo: t[10], badge: t[11], barTrack: t[12], barFill: t[13], mote: t[14],
        logo: t[15], icons: { go: t[16], course: t[17], cases: t[18], about: t[19] },
        nineGo: (AS && AS.nine('ui_button_primary')) || { left: 40, top: 40, right: 40, bottom: 44 },
        nine: (AS && AS.nine('ui_button')) || { left: 40, top: 40, right: 40, bottom: 44 }
      });
      building = false;
      return true;
    }).catch(function (e) {
      building = false;
      if (window.console) console.warn('title:', e);
      return false;
    });
  }

  function createApp(mount) {
    app = new window.PIXI.Application();
    var size = box(mount);
    return app.init({
      width: size.w, height: size.h,
      backgroundAlpha: 1, background: 0xFFF1E4,
      antialias: true, resolution: dpr(), autoDensity: true,
      preference: 'webgl'
    }).then(function () {
      app.canvas.style.display = 'block';
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      app.ticker.add(tick);
      window.addEventListener('resize', onResize);
      return app;
    });
  }

  function fonts() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    /* 書体が来る前に文字を焼くと、あとから差し替わらない。少しだけ待つ。 */
    return Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1200); })]);
  }

  function box(mount) {
    var el = mount || document.body;
    var w = Math.max(320, el.clientWidth || window.innerWidth);
    var h = Math.max(420, el.clientHeight || window.innerHeight);
    return { w: w, h: h };
  }

  function tick(ticker) {
    var dt = (ticker && ticker.deltaMS != null ? ticker.deltaMS : 16) / 1000;
    for (var i = 0; i < anim.length; i++) anim[i](dt);
  }

  function onResize() {
    if (!app || !opts) return;
    var s = box(opts.mount);
    app.renderer.resize(s.w, s.h);
    layout();
  }

  /* ---- 場面そのもの ---- */
  function build(t) {
    var P = window.PIXI;
    anim.length = 0;
    buttons = {};
    app.stage.removeChildren();
    app.stage.eventMode = 'static';

    layers = {
      bg: new P.Container(), cast: new P.Container(), fx: new P.Container(),
      ui: new P.Container(), over: new P.Container(), t: t
    };
    app.stage.addChild(layers.bg, layers.cast, layers.fx, layers.ui, layers.over);

    /* 背景 */
    layers.room = sprite(t.room);
    layers.bg.addChild(layers.room);
    /* メニュー列の下敷き。背景が機材で込み入っているので、文字の後ろだけ少し落ち着かせる。 */
    layers.shade = new P.Graphics();
    layers.bg.addChild(layers.shade);

    /* 登場人物 */
    layers.patient = sprite(t.patient);
    layers.patient.anchor.set(0.5, 1);
    layers.mascot = sprite(t.mascot);
    layers.mascot.anchor.set(0.5, 1);
    layers.doctor = sprite(t.doctor);
    layers.doctor.anchor.set(0.5, 1);
    layers.cast.addChild(layers.patient, layers.mascot, layers.doctor);

    /* 光の粒 */
    layers.motes = [];
    for (var i = 0; i < 16; i++) {
      var m = sprite(t.mote);
      m.anchor.set(0.5);
      m.alpha = 0.25 + Math.random() * 0.45;
      m.scale.set(0.2 + Math.random() * 0.5);
      m._sp = 10 + Math.random() * 26;
      m._ph = Math.random() * Math.PI * 2;
      layers.fx.addChild(m);
      layers.motes.push(m);
    }

    /* ロゴ */
    layers.ribbon = sprite(t.ribbon);
    layers.ribbon.anchor.set(0.5);
    layers.logo = text('VentaSim', 54, 0xFFFFFF, '900', 0x2E2545);
    layers.logo.anchor.set(0.5);
    layers.logoArt = t.logo ? sprite(t.logo) : null;
    if (layers.logoArt) { layers.logoArt.anchor.set(0.5); layers.logo.visible = false; layers.ribbon.visible = false; }
    if (layers.logoArt) layers.ui.addChild(layers.logoArt);
    layers.sub = text('こどもの人工呼吸器シミュレーター', 15, opts.dark ? 0xCFE0FF : 0x5A4A70, '800');
    layers.sub.anchor.set(0.5);
    layers.ui.addChild(layers.ribbon, layers.logo, layers.sub);

    /* ふきだし */
    layers.bubble = nine(t.bubble, 48, 48, 48, 48);
    layers.tail = new P.Graphics();
    layers.say = text(opts.line || '', 14, opts.dark ? 0xE8F0FF : 0x3A3050, '700');
    layers.say.anchor.set(0.5);
    layers.say.style.dropShadow = false;
    layers.ui.addChild(layers.tail, layers.bubble, layers.say);

    /* メニュー */
    layers.menu = new P.Container();
    layers.ui.addChild(layers.menu);
    (opts.items || []).forEach(function (item, idx) {
      var b = makeButton(item, t);
      b._idx = idx;
      layers.menu.addChild(b);
      buttons[item.id] = b;
    });

    /* 足もと：進捗とテーマ */
    layers.barTrack = nine(t.barTrack, 20, 20, 20, 20);
    layers.barFill = nine(t.barFill, 20, 20, 20, 20);
    layers.pct = text('0%', 14, opts.dark ? 0xCFE0FF : 0x5A4A70, '800');
    layers.pct.anchor.set(0, 0.5);
    layers.theme = makeChip(opts.themeLabel || 'ポップ', t);
    layers.ui.addChild(layers.barTrack, layers.barFill, layers.pct, layers.theme);

    /* 場面転換用の覆い */
    layers.veil = new P.Graphics();
    layers.veil.eventMode = 'none';
    layers.veil.alpha = 0;
    layers.over.addChild(layers.veil);

    layout();
    idle();
    intro();
  }

  function makeButton(item, t) {
    var P = window.PIXI;
    var c = new P.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';
    var ins = item.primary ? t.nineGo : t.nine;
    var plate = nine(item.primary ? t.plateGo : t.plate, ins.left, ins.top, ins.right, ins.bottom);
    var icon = t.icons && t.icons[item.id];
    var badge = sprite(icon || (item.primary ? t.badgeGo : t.badge));
    badge.anchor.set(0.5);
    var glyph = text(icon ? '' : item.glyph, 22, 0xFFFFFF, '900', 0x2E2545);
    glyph.anchor.set(0.5);
    var title = text(item.title, 19, item.primary ? 0xFFFFFF : (opts.dark ? 0xE8F0FF : 0x3A3050), '900',
                     item.primary ? 0x8A3B10 : null);
    title.anchor.set(0, 0.5);
    var sub = text(item.sub || '', 12, item.primary ? 0xFFF0DC : (opts.dark ? 0x9FB3D9 : 0x7A6B92), '700');
    sub.anchor.set(0, 0.5);
    sub.style.dropShadow = false;
    c.addChild(plate, badge, glyph, title, sub);
    c._parts = { plate: plate, badge: badge, glyph: glyph, title: title, sub: sub };
    c._item = item;

    var down = false;
    c.on('pointerdown', function () { down = true; c._parts.plate.y = 4; badge.y += 4; glyph.y += 4; title.y += 4; sub.y += 4; });
    var up = function (fire) {
      if (!down) return;
      down = false;
      layoutButton(c, c._w, c._h);
      if (fire) select(item.id);
    };
    c.on('pointerup', function () { up(true); });
    c.on('pointerupoutside', function () { up(false); });
    c.on('pointerover', function () { c.scale.set(1.02); });
    c.on('pointerout', function () { c.scale.set(1); });
    return c;
  }

  function makeChip(label, t) {
    var P = window.PIXI;
    var c = new P.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';
    var plate = nine(t.plate, t.nine.left, t.nine.top, t.nine.right, t.nine.bottom);
    var tx = text(label, 12, opts.dark ? 0xCFE0FF : 0x5A4A70, '800');
    tx.anchor.set(0.5);
    tx.style.dropShadow = false;
    c.addChild(plate, tx);
    c._parts = { plate: plate, label: tx };
    c.on('pointerup', function () { if (opts.onTheme) opts.onTheme(); });
    return c;
  }

  /* ---- 配置 ----
   * 縦長（スマホ）は上から「ロゴ・ふきだし・キャラ・メニュー」。
   * 横長（PC）は左にメニュー、右にキャラを大きく立たせる。
   */
  function layout() {
    if (!app || !layers) return;
    var w = app.screen.width;
    var h = app.screen.height;
    var wide = w >= 900 && w > h * 1.05;
    var short = h < 620 && !wide;

    /* 背景は画面を覆うように拡大 */
    var rw = layers.room.texture.width, rh = layers.room.texture.height;
    var s = Math.max(w / rw, h / rh);
    layers.room.scale.set(s);
    layers.room.x = (w - rw * s) / 2;
    layers.room.y = (h - rh * s) / 2;

    var col = wide ? Math.min(470, w * 0.42) : Math.min(520, w - 28);
    var colCx = wide ? Math.max(col / 2 + 24, w * 0.29) : w / 2;

    /* ロゴ */
    var logoW = wide ? col : Math.min(col, w * 0.92);
    var ribbonRatio = layers.ribbon.texture.height / layers.ribbon.texture.width;
    var logoH = logoW * (layers.logoArt ? layers.logoArt.texture.height / layers.logoArt.texture.width : ribbonRatio);
    if (layers.logoArt) {
      layers.logoArt.width = logoW; layers.logoArt.height = logoH;
      layers.logoArt.x = colCx; layers.logoArt.y = (short ? 14 : wide ? 34 : 24) + logoH / 2;
    }
    layers.ribbon.width = logoW;
    layers.ribbon.height = logoH;
    layers.ribbon.x = colCx;
    layers.ribbon.y = (short ? 14 : wide ? 34 : 24) + logoH / 2;
    layers.logo.style.fontSize = Math.round(logoH * 0.52);
    layers.logo.style.stroke = { color: 0x2E2545, width: Math.max(4, logoH * 0.09), join: 'round' };
    layers.logo.x = colCx;
    layers.logo.y = layers.ribbon.y - logoH * 0.04;
    layers.sub.x = colCx;
    layers.sub.y = layers.ribbon.y + logoH * 0.62;

    /* ふきだし（文字の量で高さが決まるので先に置く） */
    var bw = Math.min(col, 380);
    layers.say.style.fontSize = short ? 12.5 : 14;
    layers.say.style.wordWrap = true;
    layers.say.style.wordWrapWidth = bw - 34;
    var bh2 = Math.max(short ? 46 : 54, layers.say.height + 26);
    fitNine(layers.bubble, bw, bh2);
    layers.bubble.x = colCx - bw / 2;
    layers.bubble.y = layers.sub.y + (short ? 12 : 18);
    layers.say.x = colCx;
    layers.say.y = layers.bubble.y + bh2 / 2;

    /* メニュー */
    var bh = short ? 52 : (wide ? 66 : 62);
    var gap = short ? 7 : 9;
    var n = layers.menu.children.length;
    var footY, menuTop;
    if (wide) {
      menuTop = layers.bubble.y + bh2 + 26;
      footY = menuTop + n * bh + (n - 1) * gap + 28;
    } else {
      footY = h - (short ? 26 : 34);
      menuTop = footY - (short ? 16 : 22) - (n * bh + (n - 1) * gap);
    }
    for (var i = 0; i < n; i++) {
      var b = layers.menu.children[i];
      b.x = colCx - col / 2;
      b.y = menuTop + i * (bh + gap);
      layoutButton(b, col, bh);
    }

    /* 登場人物。横長ではメニューの右側だけを使い、重ならないようにする。 */
    var castBottom, castH, areaL = 0, areaR = w;
    if (wide) {
      areaL = colCx + col / 2 + 12;
      areaR = w - 12;
      castBottom = h * 0.93;
      castH = Math.min(h * 0.60, (areaR - areaL) * 1.05, h - 170);
    } else {
      castBottom = menuTop - (short ? 6 : 12);
      castH = Math.max(120, castBottom - (layers.bubble.y + bh2 + (short ? 2 : 8)));
    }

    layers.doctor.height = castH;
    layers.doctor.width = castH * (layers.doctor.texture.width / layers.doctor.texture.height);
    layers.doctor.x = wide ? areaR - layers.doctor.width * 0.5
      : Math.min(w - layers.doctor.width * 0.5 - 6, colCx + col * 0.22);
    layers.doctor.y = castBottom;

    layers.mascot.height = castH * (wide ? 0.32 : 0.42);
    layers.mascot.width = layers.mascot.height * (layers.mascot.texture.width / layers.mascot.texture.height);
    layers.mascot.x = Math.max(areaL + layers.mascot.width * 0.5,
      layers.doctor.x - layers.doctor.width * 0.58 - layers.mascot.width * 0.30);
    layers.mascot.y = castBottom - castH * (wide ? 0.46 : 0.34);
    layers.mascot._baseY = layers.mascot.y;

    layers.patient.height = castH * (wide ? 0.32 : 0.40);
    layers.patient.width = layers.patient.height * (layers.patient.texture.width / layers.patient.texture.height);
    layers.patient.x = Math.max(areaL + layers.patient.width * 0.5,
      wide ? layers.doctor.x - layers.doctor.width * 0.5 - layers.patient.width * 0.34
           : Math.max(layers.patient.width * 0.5 + 14, colCx - col * 0.30));
    layers.patient.y = castBottom;
    layers.patient.visible = castH > 150;

    /* ふきだしのしっぽは先生のほうへ向ける */
    var tx0 = Math.min(layers.bubble.x + bw - 40, Math.max(layers.bubble.x + 40, layers.doctor.x - 40));
    layers.tail.clear();
    layers.tail.moveTo(tx0 - 22, layers.bubble.y + bh2 - 14)
      .lineTo(tx0 + 30, layers.bubble.y + bh2 + 22)
      .lineTo(tx0 + 22, layers.bubble.y + bh2 - 14)
      .fill({ color: opts.dark ? 0x111A31 : 0xFFFFFF })
      .stroke({ color: 0x2E2545, width: 5, join: 'round' });

    /* メニュー列の下敷き（ロゴの上から足もとまで） */
    layers.shade.clear();
    layers.shade.roundRect(colCx - col / 2 - 26, (layers.logoArt ? layers.logoArt.y : layers.ribbon.y) - logoH / 2 - 22,
        col + 52, footY - ((layers.logoArt ? layers.logoArt.y : layers.ribbon.y) - logoH / 2) + 62, 34)
      .fill({ color: opts.dark ? 0x0B1020 : 0xFFF8EE, alpha: opts.dark ? 0.62 : 0.72 });

    /* 足もと：進捗とテーマ */
    var chipW = 74, chipH = 26;

    var barW = col - chipW - 64;
    fitNine(layers.barTrack, barW, 22);
    layers.barTrack.x = colCx - col / 2; layers.barTrack.y = footY - 11;
    var ratio = opts.total ? Math.max(0, Math.min(1, opts.done / opts.total)) : 0;
    fitNine(layers.barFill, Math.max(22, barW * ratio), 22);
    layers.barFill.x = layers.barTrack.x; layers.barFill.y = layers.barTrack.y;
    layers.barFill.visible = ratio > 0;
    layers.pct.text = Math.round(ratio * 100) + '%';
    layers.pct.x = layers.barTrack.x + barW + 10;
    layers.pct.y = footY;
    layers.theme.x = wide ? layers.pct.x + 52 : colCx + col / 2 - chipW;
    layers.theme.y = footY - chipH / 2;
    fitNine(layers.theme._parts.plate, chipW, chipH + 6);
    layers.theme._parts.label.x = chipW / 2;
    layers.theme._parts.label.y = chipH / 2 - 1;

    layers.veil.clear();
    layers.veil.rect(0, 0, w, h).fill({ color: 0xFFFFFF });
  }

  function layoutButton(c, w, h) {
    c._w = w; c._h = h;
    var p = c._parts;
    fitNine(p.plate, w, h + 6);
    p.plate.x = 0; p.plate.y = 0;
    p.badge.x = 34; p.badge.y = h / 2 - 2;
    p.badge.width = h * 0.62; p.badge.height = h * 0.62;
    p.glyph.x = p.badge.x; p.glyph.y = p.badge.y - 1;
    p.glyph.style.fontSize = Math.round(h * 0.34);
    var tx = 34 + h * 0.42;
    p.title.x = tx;
    p.title.style.fontSize = Math.round(h * 0.30);
    p.sub.x = tx;
    p.sub.style.fontSize = Math.round(h * 0.19);
    if (p.sub.text) {
      p.title.y = h / 2 - h * 0.15;
      p.sub.y = h / 2 + h * 0.21;
      p.sub.visible = h > 46;
    } else {
      p.title.y = h / 2;
      p.sub.visible = false;
    }
  }

  /* ---- 待機の動き ---- */
  function idle() {
    var t = 0, blinkAt = 2 + Math.random() * 3, blinking = 0;
    anim.push(function (dt) {
      t += dt;
      /* ぷくぷくは呼吸に合わせて上下する */
      var br = Math.sin(t * 1.6);
      layers.mascot.scale.y = layers.mascot.scale.x * (1 + br * 0.04) / (1 + 0 * br);
      layers.mascot.y = (layers.mascot._baseY || layers.mascot.y) - br * 5;
      /* 先生はゆっくり揺れる */
      layers.doctor.rotation = Math.sin(t * 0.8) * 0.012;
      /* まばたき */
      if (blinking > 0) {
        blinking -= dt;
        if (blinking <= 0) {
          layers.doctor.texture = layers.t.doctor;
          layers.mascot.texture = layers.t.mascot;
        }
      } else if (t > blinkAt) {
        blinkAt = t + 2.4 + Math.random() * 3.5;
        blinking = 0.14;
        layers.doctor.texture = layers.t.doctorBlink;
        layers.mascot.texture = layers.t.mascotBlink;
      }
      /* 光の粒 */
      var w = app.screen.width;
      var h = app.screen.height;
      for (var i = 0; i < layers.motes.length; i++) {
        var m = layers.motes[i];
        if (m.y === 0 || m.y == null || m.y < -20) {
          m.x = Math.random() * w;
          m.y = h + Math.random() * h * 0.5;
        }
        m.y -= m._sp * dt;
        m.x += Math.sin(t * 0.7 + m._ph) * 8 * dt;
        if (m.y < -20) m.y = h + 20;
      }
    });
  }

  /* ---- 登場の動き ---- */
  function intro() {
    var items = layers.menu.children;
    var start = performance.now();
    var from = [];
    for (var i = 0; i < items.length; i++) from.push(items[i].y);
    layers.ribbon.scale.x *= 0.9;
    var step = function (dt) {
      var e = (performance.now() - start) / 1000;
      for (var i = 0; i < items.length; i++) {
        var d = Math.max(0, Math.min(1, (e - 0.06 * i) / 0.42));
        var k = back(d);
        items[i].alpha = Math.min(1, d * 1.6);
        items[i].y = from[i] + (1 - k) * 46;
      }
      var lg = Math.max(0, Math.min(1, e / 0.5));
      layers.logo.scale.set(0.86 + back(lg) * 0.14);
      if (e > 0.9) {
        for (var j = 0; j < items.length; j++) { items[j].alpha = 1; items[j].y = from[j]; }
        layers.logo.scale.set(1);
        remove(step);
      }
    };
    anim.push(step);
  }

  function back(x) {
    /* 行き過ぎてから戻る補間。ボタンが「置かれる」感じになる。 */
    var c1 = 1.70158, c3 = c1 + 1;
    var v = 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    return x >= 1 ? 1 : v;
  }

  function remove(fn) {
    var i = anim.indexOf(fn);
    if (i >= 0) anim.splice(i, 1);
  }

  /* ---- 選んだとき ---- */
  function select(id) {
    if (!opts || !opts.onSelect) return;
    var fn = opts.onSelect;
    /* 画面に入っていく感じを出す。転換が終わってから本体を呼ぶ。 */
    var start = performance.now();
    var done = false;
    var step = function () {
      var e = (performance.now() - start) / 260;
      var k = Math.min(1, e);
      app.stage.scale.set(1 + k * 0.08);
      app.stage.x = -app.screen.width * 0.04 * k;
      app.stage.y = -app.screen.height * 0.04 * k;
      layers.veil.alpha = k * 0.85;
      if (k >= 1 && !done) {
        done = true;
        remove(step);
        app.stage.scale.set(1); app.stage.x = 0; app.stage.y = 0; layers.veil.alpha = 0;
        fn(id);
      }
    };
    if (reduceMotion()) { fn(id); return; }
    anim.push(step);
  }

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function hide() {
    if (app) app.ticker.stop();
  }

  function resume() {
    if (app) app.ticker.start();
  }

  /* 動作確認用。ボタンの位置（CSS ピクセル）を返す。 */
  function rect(id) {
    var b = buttons[id];
    if (!b || !app) return null;
    var g = b.getBounds();
    var c = app.canvas.getBoundingClientRect();
    return { x: c.left + g.x, y: c.top + g.y, w: g.width, h: g.height,
             cx: c.left + g.x + g.width / 2, cy: c.top + g.y + g.height / 2 };
  }

  function setLine(str) {
    if (layers && layers.say) layers.say.text = str;
  }

  window.VentTitle = {
    available: available, show: show, hide: hide, resume: resume,
    rect: rect, layout: layout, setLine: setLine
  };
})();
