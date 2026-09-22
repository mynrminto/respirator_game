/* VentSim — 肺の物理モデルを 3D で見る画面。
 *
 * 表示用に別の物理を作らない。engine.js が毎ステップ解いている単一コンパートメント肺
 *   Paw ＝ V/C ＋ R·V̇ − Pmus
 * の実測値（容量・気道内圧・肺胞圧・流量・コンプライアンス・抵抗・自発呼吸の努力・
 * auto-PEEP・シャント）をそのまま形と色に写すだけの層。
 *
 * 大きさは症例の体重で決まる（早産児 1.1 kg 〜 学童 35 kg）。FRC 30 mL/kg、TLC 80 mL/kg を
 * 基準にして、肺の高さも実寸（cm）で出す。
 *
 * three.js（vendor/three.min.js, r160 の UMD ビルド）があれば WebGL で描き、無い環境・
 * WebGL が使えない環境では同じ値を 2D canvas の前額断で描く。
 */
(function (root) {
  'use strict';

  /* ===================== 体格から決まる基準値 =====================
   * ここだけが「表示のための仮定」。engine.js は肺の絶対容量（FRC）を持たないので、
   * 小児の標準値から体重で作る。 */

  /** 機能的残気量 L（小児 30 mL/kg）。engine.js の V=0（弛緩位）がこの容量にあたる。 */
  function frcFor(kg) { return 0.030 * Math.max(0.4, kg); }
  /** 全肺気量 L（小児 80 mL/kg）。これ以上は膨らませない。 */
  function tlcFor(kg) { return 0.080 * Math.max(0.4, kg); }
  /** 両肺の高さ 実寸 cm。20 kg で 18 cm を基準に容量の 3 乗根で相似に伸ばす。 */
  function lungHeightCm(kg) { return 18 * Math.pow(Math.max(0.4, kg) / 20, 1 / 3); }
  /** 年齢相応の全肺コンプライアンス L/cmH2O（比コンプライアンス 0.9 mL/cmH2O/kg）。 */
  function cRef(kg) { return 0.0009 * Math.max(0.4, kg); }
  /** 年齢相応の気道抵抗 cmH2O/L/s。気管チューブを含む実測に合わせて 61/√kg。
   *  早産児（2.5 mm チューブ）で約 58、学童で約 10 になる。 */
  function rRef(kg) { return 61 / Math.sqrt(Math.max(0.4, kg)); }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ===================== エンジン → 表示量 =====================
   * 引数はエンジン本体（app.js の S.eng）。ここで新しい物理は起こさない。 */
  function readModel(e) {
    var p = e.p, s = e.s, m = e.m || {};
    var kg = p.pbw || p.weightKg || 20;
    var frc = frcFor(kg), tlc = tlcFor(kg);

    var vol = e.V;                        // 弛緩位からの容量 L（engine.js の定義）
    var gas = frc + vol;                  // 肺の中のガス量 L
    var palv = vol / e.C;                 // 肺胞圧 cmH2O（＝ V/C）
    var flow = e.flow;                    // L/s（吸気 +）
    var R = flow >= 0 ? p.Rinsp : p.Rexp; // 抵抗は吸気相・呼気相で異なる
    var pmus = e.pmus || 0;

    var cPerKg = e.C * 1000 / kg;         // mL/cmH2O/kg
    var refC = cRef(kg), refR = rRef(kg);
    var platMax = (e.nm && e.nm.platMax) || 30;

    return {
      kg: kg, ageLabel: p.ageLabel || p.name || '',
      frc: frc, tlc: tlc, gas: gas, vol: vol,
      heightCm: lungHeightCm(kg),
      /** FRC で 0、TLC で 1。肺がどこまで膨らんでいるか。 */
      fill: clamp((gas - frc) / Math.max(1e-6, tlc - frc), -0.35, 1.25),
      /** 一回換気量の分だけの膨らみ（呼気終末を 0 とした相対値）。 */
      tidal: clamp((vol - (e.vEE != null ? e.vEE : 0)) / Math.max(1e-6, tlc - frc), -0.4, 1.25),
      paw: e.paw, palv: palv, peep: s.peep, autoPeep: m.autoPeep || 0,
      pplat: m.pplat, pip: m.pip, flow: flow, pmus: pmus,
      C: e.C, cPerKg: cPerKg, cRatio: e.C / refC,
      R: R, Rinsp: p.Rinsp, Rexp: p.Rexp, rRatio: R / refR,
      /** 硬さ 0〜1（正常比 1.0 で 0、0.35 以下で 1）。肺の色と肋骨の動きに使う。 */
      stiff: clamp((1 - e.C / refC) / 0.65, 0, 1),
      /** 気道の細さ 0〜1（正常比 1 で 0、4 倍で 1）。気管支の太さに使う。 */
      narrow: clamp((R / refR - 1) / 3, 0, 1),
      /** つぶれた肺胞の割合。シャントをそのまま使う。 */
      collapse: clamp(e.shunt != null ? e.shunt : 0, 0, 0.85),
      /** 過膨張 0〜1。プラトー圧が年齢の上限を超えた分。 */
      over: clamp((palv - platMax) / 12, 0, 1),
      phase: e.phase, breathType: e.breathType,
      spo2: e.spo2, hr: e.hr, fio2: s.fio2, mode: s.mode,
      platMax: platMax
    };
  }

  /* 運動方程式の 3 項。Paw ＝ V/C ＋ R·V̇ − Pmus が engine.js の式そのもの。 */
  function termsOf(mo) {
    var el = mo.palv, res = mo.R * mo.flow, mus = -mo.pmus;
    return { elastic: el, resistive: res, muscular: mus, sum: el + res + mus };
  }

  /* ===================== 共通の色 ===================== */
  function pal() {
    var cs = (typeof getComputedStyle === 'function')
      ? getComputedStyle(document.documentElement) : null;
    function v(n, fb) { if (!cs) return fb; var s = cs.getPropertyValue(n).trim(); return s || fb; }
    return {
      bg: v('--screen', '#191E4C'), ink: v('--screen-ink', '#F0F2FF'),
      dim: v('--screen-dim', '#A7B0EA'), line: v('--tile-line', '#313A83'),
      paw: v('--paw', '#F5B429'), flow: v('--flow', '#2FD8A8'), vol: v('--vol', '#8FA8FF'),
      good: v('--good', '#3ECB80'), warn: v('--warn', '#FFB03A'), crit: v('--crit', '#FF4B57')
    };
  }
  function hex(c) {
    var s = String(c).trim();
    if (s.charAt(0) === '#') {
      if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      return parseInt(s.slice(1), 16);
    }
    var m = s.match(/(\d+)\D+(\d+)\D+(\d+)/);
    return m ? ((+m[1]) << 16 | (+m[2]) << 8 | (+m[3])) : 0xffffff;
  }

  /* ===================== 3D ビュー ===================== */

  var LUNG_SEG = 40, LUNG_RING = 26;

  /* 片肺の形。単位球を小児の肺らしく変形する。side=+1 が画面右（患者の左肺）。 */
  function lungGeometry(THREE, side) {
    var g = new THREE.SphereGeometry(1, LUNG_SEG, LUNG_RING);
    var pos = g.attributes.position, n = pos.count;
    for (var i = 0; i < n; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var t = (y + 1) / 2;                       // 0=肺底 1=肺尖
      var taper = 1.04 - 0.52 * Math.pow(t, 1.6);
      x *= taper; z *= taper;
      z *= 0.80;
      // 内側（縦隔側）は心臓と大血管に押されて平らになる
      var med = -side * x;
      if (med > 0) x += side * med * 0.70;
      // 心臓の切れ込み（患者の左肺だけ深い）
      if (side > 0) {
        var notch = Math.exp(-Math.pow((y + 0.30) / 0.46, 2)) * Math.max(0, -x);
        x += notch * 0.80;
      }
      // 肺底は横隔膜の丸みに沿って凹む
      if (y < -0.10) {
        var d = (-0.10 - y) / 0.90;
        y += 0.34 * d * d * Math.max(0, 1 - (x * x + z * z) * 0.75);
      }
      pos.setXYZ(i, x, y * 1.16, z);
    }
    g.computeVertexNormals();
    return g;
  }

  /* 気管支樹。中枢から 3 世代ぶん、円柱をつないだ Group を返す。
   * 太さは世代ごとに細くなり、update() で気道抵抗に応じてさらに絞る。 */
  function bronchialTree(THREE, side, mat) {
    var grp = new THREE.Group();
    var segs = [];
    function seg(from, to, r) {
      var dir = to.clone().sub(from), len = dir.length();
      var geo = new THREE.CylinderGeometry(r * 0.80, r, len, 8, 1, true);
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(from).add(to).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      grp.add(mesh);
      segs.push(mesh);
    }
    function grow(from, dir, len, r, gen) {
      var to = from.clone().add(dir.clone().multiplyScalar(len));
      seg(from, to, r);
      if (gen >= 3) return;
      for (var k = -1; k <= 1; k += 2) {
        var d = dir.clone();
        d.x += k * 0.52 * side; d.y -= 0.26; d.z += k * 0.40 * (gen % 2 ? 1 : -1);
        d.normalize();
        grow(to, d, len * 0.70, r * 0.70, gen + 1);
      }
    }
    // 主気管支：分岐部から外下方へ
    grow(new THREE.Vector3(-side * 0.76, 0.86, 0), new THREE.Vector3(side * 0.70, -0.66, 0.05).normalize(),
      0.60, 0.055, 0);
    grp.userData.segs = segs;
    return grp;
  }

  /* 肺胞（細かく描くと斑点に見えるので、房＝acinus をひとかたまりの球で表す）。 */
  function alveoliPositions(side, count) {
    var out = [];
    var seed = side > 0 ? 8712 : 2311;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < count; i++) {
      var u = rnd(), v = rnd(), w = rnd();
      var y = -0.72 + 1.44 * u;
      var t = (y + 1) / 2;
      var rad = (0.86 - 0.46 * Math.pow(t, 1.6)) * (0.55 + 0.32 * v);
      var ang = w * Math.PI * 2;
      var x = Math.cos(ang) * rad, z = Math.sin(ang) * rad * 0.74;
      if (-side * x > 0) x *= 0.30;
      out.push([x, y * 1.02, z, 0.70 + 0.42 * rnd()]);
    }
    return out;
  }

  /* 肋骨 1 本。脊椎（後ろ）から側面をまわって胸骨（前）へ、前下がりに降りる。 */
  function ribCurve(THREE, side, y, wide) {
    var p = [
      new THREE.Vector3(side * 0.12, y, -1.06),
      new THREE.Vector3(side * 1.20 * wide, y - 0.03, -0.78),
      new THREE.Vector3(side * 1.86 * wide, y - 0.07, -0.05),
      new THREE.Vector3(side * 1.52 * wide, y - 0.13, 0.62),
      new THREE.Vector3(side * 0.50 * wide, y - 0.19, 0.96),
      new THREE.Vector3(side * 0.10, y - 0.21, 1.02)
    ];
    return new THREE.CatmullRomCurve3(p, false, 'catmullrom', 0.4);
  }

  function View(host) {
    this.host = host;
    this.gl = false;
    this.exaggerate = 2.5;   // 動きの強調（実寸は 1.0）
    this.az = 0.52; this.el = 0.17;
    this.zoom = 1;          // 1 が「枠にちょうど収まる」
    this.dist = 6.4;
    this.spin = true;
    this._t = 0;
    this._kg = null;
    this._drag = null;
    this._parts = [];
  }

  View.prototype.mount = function () {
    var THREE = root.THREE;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'lungcv';
    this.host.appendChild(this.canvas);
    if (THREE) {
      try { this._initGL(THREE); this.gl = true; }
      catch (err) { this.gl = false; this.renderer = null; }
    }
    if (!this.gl) this.ctx2d = this.canvas.getContext('2d');
    this._bindPointer();
    return this.gl;
  };

  View.prototype._initGL = function (THREE) {
    var P = pal();
    var rn = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    rn.setClearColor(0x000000, 0);
    this.renderer = rn;
    var sc = new THREE.Scene();
    this.scene = sc;
    this.cam = new THREE.PerspectiveCamera(36, 1, 0.05, 80);

    sc.add(new THREE.HemisphereLight(0xffffff, 0x2a2f60, 1.05));
    var key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(2.4, 3.0, 3.4); sc.add(key);
    var fill = new THREE.DirectionalLight(0xA8BCFF, 0.85); fill.position.set(-2.8, -0.4, -2.2); sc.add(fill);
    var rim = new THREE.DirectionalLight(0xFFD9E4, 0.6); rim.position.set(0.4, 1.0, -3.0); sc.add(rim);

    this.rig = new THREE.Group();       // 体格に合わせて全体を拡縮する入れ物
    sc.add(this.rig);

    var HILUM = 0.82;                   // 肺の中心の左右オフセット
    this.hilum = HILUM;

    /* --- 肺・気管支樹・肺胞 --- */
    this.lungMat = []; this.lungs = []; this.trees = []; this.alv = [];
    for (var i = 0; i < 2; i++) {
      var side = i === 0 ? -1 : 1;
      var mat = new THREE.MeshStandardMaterial({
        color: 0xF2A0AE, roughness: 0.42, metalness: 0.0,
        emissive: 0x4A1C28, emissiveIntensity: 0.55,
        transparent: true, opacity: 0.56, depthWrite: false, side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(lungGeometry(THREE, side), mat);
      mesh.rotation.z = -side * 0.07;
      this.rig.add(mesh);
      this.lungs.push(mesh); this.lungMat.push(mat);

      var tmat = new THREE.MeshStandardMaterial({ color: 0xF2F6FC, roughness: 0.35 });
      var tree = bronchialTree(THREE, side, tmat);
      tree.userData.mat = tmat;
      this.rig.add(tree);
      this.trees.push(tree);

      var pts = alveoliPositions(side, 44);
      var im = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 12, 9),
        new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.0 }),
        pts.length);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.userData.pts = pts;
      this.rig.add(im);
      this.alv.push(im);
    }

    /* --- 気管と気管チューブ（内径はチューブで決まるので気管だけ細くする） --- */
    var trMat = new THREE.MeshStandardMaterial({ color: 0xE4EDF7, roughness: 0.4,
      transparent: true, opacity: 0.8 });
    var trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.52, 18, 1, true), trMat);
    trachea.position.y = 1.14;
    this.rig.add(trachea);
    var ettMat = new THREE.MeshStandardMaterial({ color: 0x8FD3E8, roughness: 0.45 });
    var ett = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.80, 20), ettMat);
    ett.position.y = 1.44;
    this.rig.add(ett);
    this.trachea = trachea;

    /* --- 心臓（縦隔を埋め、心拍で打つ。engine.js の hr をそのまま使う） --- */
    var hMat = new THREE.MeshStandardMaterial({ color: 0x9E2C44, roughness: 0.38 });
    var heart = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 14), hMat);
    heart.scale.set(0.86, 1.10, 0.72);
    heart.position.set(0.10, -0.22, 0.14);
    heart.rotation.z = -0.28;
    var apex = new THREE.Mesh(new THREE.ConeGeometry(0.175, 0.30, 18), hMat);
    apex.position.set(0.19, -0.48, 0.14);
    apex.rotation.z = Math.PI + 0.34;
    heart.add(apex);
    apex.position.set(0.10, -0.26, 0.0);
    this.rig.add(heart);
    this.heart = heart; this.heartPhase = 0;

    /* --- 横隔膜 --- */
    var dMat = new THREE.MeshStandardMaterial({ color: 0xC4736F, roughness: 0.5,
      transparent: true, opacity: 0.52, side: THREE.DoubleSide });
    var dome = new THREE.Mesh(new THREE.SphereGeometry(1.14, 44, 20, 0, Math.PI * 2, 0, Math.PI / 2.3), dMat);
    dome.scale.set(1.14, 0.72, 0.66);
    dome.position.y = -1.32;
    this.rig.add(dome);
    this.diaph = dome;

    /* --- 胸郭：肋骨 8 対＋胸骨＋脊椎 --- */
    var boneMat = new THREE.MeshStandardMaterial({ color: 0xFFF6E6, roughness: 0.5,
      transparent: true, opacity: 0.17, depthWrite: false });
    var cage = new THREE.Group();
    for (var r = 0; r < 8; r++) {
      var f = r / 7;
      var ry = 1.02 - f * 1.90;
      var wide = 0.62 + 0.42 * Math.sin(Math.PI * (0.20 + 0.66 * f));
      var thick = 0.030 - 0.005 * f;
      for (var sg = -1; sg <= 1; sg += 2) {
        var tube = new THREE.Mesh(
          new THREE.TubeGeometry(ribCurve(THREE, sg, ry, wide), 26, thick, 7, false), boneMat);
        cage.add(tube);
      }
    }
    this.rig.add(cage);
    this.cage = cage;

    /* --- 気流の粒：チューブ → 気管 → 主気管支 → 肺の入口まで --- */
    this.path = this._flowPath(THREE);
    var pm = new THREE.MeshBasicMaterial({ color: hex(P.flow), transparent: true, opacity: 0.95 });
    var N = 26;
    var pmesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.050, 10, 7), pm, N);
    pmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rig.add(pmesh);
    this.parts = pmesh; this.partMat = pm;
    this._parts = [];
    for (var q = 0; q < N; q++) this._parts.push({ u: q / N, lane: q % 2 });

    this._tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(),
      s: new THREE.Vector3(), c: new THREE.Color(), c2: new THREE.Color() };
    this.C = {
      lung: new THREE.Color(0xF2A0AE), stiffC: new THREE.Color(0xE9DFE6),
      warn: new THREE.Color(hex(P.warn)), crit: new THREE.Color(hex(P.crit)),
      open: new THREE.Color(0xFFC2CE), shut: new THREE.Color(0x6A4668),
      tree: new THREE.Color(0xF2F6FC)
    };
  };

  /* 気管 → 主気管支 → 肺の中心。左右 2 本の折れ線。 */
  View.prototype._flowPath = function (THREE) {
    function line(side) {
      return [
        new THREE.Vector3(0, 1.76, 0),
        new THREE.Vector3(0, 0.90, 0),
        new THREE.Vector3(side * 0.08, 0.84, 0.01),
        new THREE.Vector3(side * 0.46, 0.44, 0.03),
        new THREE.Vector3(side * 0.78, 0.04, 0.02)
      ];
    }
    return [line(-1), line(1)];
  };

  View.prototype._bindPointer = function () {
    var self = this, c = this.canvas;
    function pos(ev) {
      var t = ev.touches && ev.touches[0];
      return { x: t ? t.clientX : ev.clientX, y: t ? t.clientY : ev.clientY };
    }
    function down(ev) {
      self._drag = pos(ev); self.spin = false;
      if (ev.cancelable) ev.preventDefault();
    }
    function move(ev) {
      if (!self._drag) return;
      var p = pos(ev);
      self.az += (p.x - self._drag.x) * 0.008;
      self.el = clamp(self.el - (p.y - self._drag.y) * 0.006, -0.9, 1.1);
      self._drag = p;
      if (ev.cancelable) ev.preventDefault();
    }
    function up() { self._drag = null; }
    c.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    c.addEventListener('touchstart', down, { passive: false });
    c.addEventListener('touchmove', move, { passive: false });
    c.addEventListener('touchend', up);
    c.addEventListener('wheel', function (ev) {
      self.zoom = clamp(self.zoom * (1 + (ev.deltaY > 0 ? 0.1 : -0.1)), 0.45, 1.8);
      ev.preventDefault();
    }, { passive: false });
  };

  View.prototype.resize = function () {
    var w = Math.max(160, this.host.clientWidth), h = Math.max(120, this.host.clientHeight);
    var d = Math.min(2, window.devicePixelRatio || 1);
    this.w = w; this.h = h;
    if (this.gl) {
      this.renderer.setPixelRatio(d);
      this.renderer.setSize(w, h, false);
      var aspect = w / h;
      this.cam.aspect = aspect;
      this.cam.updateProjectionMatrix();
      // 収めたい半径（モデル座標）。横は肋骨まで、縦は気管の先から横隔膜まで。
      var tanV = Math.tan(this.cam.fov * Math.PI / 360);
      this.dist = Math.max(2.05 / tanV, 2.25 / (tanV * aspect));
    } else {
      this.canvas.width = Math.round(w * d); this.canvas.height = Math.round(h * d);
      this.ctx2d = this.canvas.getContext('2d');
      this.ctx2d.setTransform(d, 0, 0, d, 0, 0);
    }
  };

  View.prototype.themeChanged = function () {
    if (!this.gl) return;
    var P = pal();
    this.partMat.color.set(hex(P.flow));
  };

  /** 体格が変わったとき（症例を切り替えたとき）だけ全体の縮尺を作り直す。 */
  View.prototype._fitTo = function (mo) {
    if (this._kg === mo.kg) return;
    this._kg = mo.kg;
    // 縮尺は肺の実寸（cm）に比例させるが、早産児でも小さすぎて見えないと学べないので
    // カメラ距離を同じだけ詰める。実寸の比較は HUD の「肺の高さ ○ cm」で伝える。
    var s = Math.pow(mo.kg / 20, 1 / 3);
    if (this.gl) this.rig.scale.set(s, s, s);
    this._fitScale = s;
  };

  /**
   * dtReal: 実時間の経過秒（粒の進み方に使う）
   * speed:  シミュレーションの倍速
   */
  View.prototype.update = function (mo, dtReal, speed) {
    this._fitTo(mo);
    this._t += dtReal;
    if (this.spin) this.az += dtReal * 0.12;
    if (this.gl) this._updateGL(mo, dtReal, speed);
    else this._draw2d(mo, dtReal);
  };

  View.prototype._updateGL = function (mo, dtReal, speed) {
    var T = this._tmp, P = pal(), C = this.C, H = this.hilum;

    // --- 膨らみ。FRC を 1 として体積比の 3 乗根で相似に伸ばす。
    // 一回換気量は FRC の 2 割ほどで、実寸だと動きが 5% しか出ない。学習の邪魔に
    // ならない範囲で強調倍率を掛け、HUD に倍率を明記する（「動き 実寸」で 1.0 に戻せる）。
    var g = this.exaggerate;
    var volRatio = 1 + (mo.gas / mo.frc - 1) * g;
    var lin = Math.pow(Math.max(0.35, volRatio), 1 / 3);

    var press = clamp(mo.palv / Math.max(8, mo.platMax), 0, 1.6);
    var hot = clamp(press - 0.80, 0, 1);
    for (var i = 0; i < 2; i++) {
      var side = i === 0 ? -1 : 1;
      var ox = side * H * lin;

      var L = this.lungs[i];
      L.scale.set(lin, lin, lin);
      L.position.x = ox;
      var c = T.c.copy(C.lung);
      c.lerp(C.stiffC, mo.stiff * 0.55);      // 硬い肺は白っぽく
      c.lerp(C.warn, hot * 0.75);             // 圧が高いと橙
      c.lerp(C.crit, mo.over * 0.55);         // 上限を超えると赤
      this.lungMat[i].color.copy(c);
      this.lungMat[i].opacity = 0.50 + 0.14 * clamp(mo.fill, 0, 1);

      // --- 気管支：抵抗が高いほど細く、色も警告側へ
      var tree = this.trees[i], segs = tree.userData.segs;
      var k = 1 - 0.58 * mo.narrow;
      tree.scale.set(lin, lin, lin);
      tree.position.x = ox;
      for (var j = 0; j < segs.length; j++) segs[j].scale.set(k, 1, k);
      tree.userData.mat.color.copy(T.c2.copy(C.tree).lerp(C.warn, mo.narrow * 0.85));

      // --- 肺胞（房）：つぶれた分は小さく暗く、開いている分は換気で膨らむ
      var im = this.alv[i], pts = im.userData.pts;
      im.scale.set(lin, lin, lin);
      im.position.x = ox;
      var openR = Math.pow(Math.max(0.3, volRatio), 1 / 3);
      for (var a = 0; a < pts.length; a++) {
        var pt = pts[a];
        // 並びは固定。手前から順につぶれ、PEEP を上げると同じ順に開く。
        var shut = (a / pts.length) < mo.collapse;
        var r = 0.056 * pt[3] * (shut ? 0.38 : openR);
        T.v.set(pt[0], pt[1], pt[2]);
        T.s.set(r, r, r);
        T.m.compose(T.v, T.q.identity(), T.s);
        im.setMatrixAt(a, T.m);
        im.setColorAt(a, shut ? T.c.copy(C.shut)
          : T.c.copy(C.open).lerp(C.crit, mo.over * 0.8));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }

    // --- 気管：気道抵抗の分だけ内腔を絞る
    this.trachea.scale.set(1 - 0.30 * mo.narrow, 1, 1 - 0.30 * mo.narrow);

    // --- 心臓：engine.js の心拍数で打つ
    var hr = Math.max(40, mo.hr || 120);
    this.heartPhase += dtReal * Math.max(1, speed || 1) * hr / 60;
    while (this.heartPhase > 1) this.heartPhase -= 1;
    var beat = Math.exp(-Math.pow(this.heartPhase / 0.16, 2)) * 0.10;
    this.heart.scale.set(0.86 * (1 - beat), 1.10 * (1 - beat * 0.6), 0.72 * (1 - beat));

    // --- 横隔膜：容量で下がり、自発呼吸の努力があるとさらに下がって平らになる
    var eff = clamp(mo.pmus / 20, 0, 1);
    this.diaph.position.y = -1.32 - (lin - 1) * 0.9 - eff * 0.26;
    this.diaph.scale.set(1.14 * lin, 0.72 - eff * 0.18, 0.66 * lin);

    // --- 胸郭：吸気で少し広がる
    var cs = 1 + (lin - 1) * 0.55;
    this.cage.scale.set(cs, 1 + (lin - 1) * 0.22, cs);

    // --- 気流の粒：流量（L/s）をそのまま速さにする
    var v = mo.flow;
    var adv = v * 1.7 * dtReal * Math.max(1, speed || 1);
    var showParts = Math.abs(v) > 0.004;
    this.parts.visible = showParts;
    if (showParts) {
      this.partMat.color.set(v >= 0 ? hex(P.flow) : hex(P.paw));
      this.partMat.opacity = clamp(0.4 + Math.abs(v) * 1.6, 0.4, 0.95);
      for (var q = 0; q < this._parts.length; q++) {
        var pp = this._parts[q];
        pp.u += adv;
        while (pp.u > 1) pp.u -= 1;
        while (pp.u < 0) pp.u += 1;
        var pl = this.path[pp.lane];
        var fi = pp.u * (pl.length - 1);
        var i0 = Math.min(pl.length - 2, Math.floor(fi));
        T.v.copy(pl[i0]).lerp(pl[i0 + 1], fi - i0);
        var pr = 0.85 + 0.45 * Math.sin(q * 2.1);
        T.s.set(pr, pr, pr);
        T.m.compose(T.v, T.q.identity(), T.s);
        this.parts.setMatrixAt(q, T.m);
      }
      this.parts.instanceMatrix.needsUpdate = true;
    }

    // --- カメラ
    var f = this._fitScale || 1;
    var d = this.dist * f * this.zoom;
    this.cam.position.set(
      Math.sin(this.az) * Math.cos(this.el) * d,
      Math.sin(this.el) * d + 0.05 * f,
      Math.cos(this.az) * Math.cos(this.el) * d);
    this.cam.lookAt(0, -0.10 * f, 0);
    this.renderer.render(this.scene, this.cam);
  };

  /* ===================== WebGL が無いときの前額断 =====================
   * 描くものは 3D と同じ（同じ readModel を見る）。HUD の文字と重ならないよう、
   * 上下左右に余白を取った枠の中に収める。 */
  View.prototype._draw2d = function (mo, dtReal) {
    var x = this.ctx2d;
    if (!x) return;
    var P = pal(), w = this.w, h = this.h;
    x.clearRect(0, 0, w, h);

    var g = this.exaggerate;
    var volRatio = 1 + (mo.gas / mo.frc - 1) * g;
    var lin = Math.pow(Math.max(0.35, volRatio), 1 / 3);

    // HUD（上の症例名・右の数値・下の方程式）を避けた作図枠
    var padT = 44, padB = 64, padR = Math.min(170, w * 0.30), padL = 10;
    var bw = Math.max(80, w - padL - padR), bh = Math.max(80, h - padT - padB);
    var cx = padL + bw / 2, cy = padT + bh / 2;
    var U = Math.min(bw / 4.2, bh / 3.3);        // 基準長
    var lw = U * 0.92 * lin, lh = U * 1.22 * lin, hil = U * 1.02;

    var press = clamp(mo.palv / Math.max(8, mo.platMax), 0, 1.6);
    var hot = clamp(press - 0.80, 0, 1);

    /* 胸郭：肋骨を薄い弧で */
    x.save();
    x.strokeStyle = P.line; x.lineWidth = 1.4; x.globalAlpha = 0.55;
    for (var r = 0; r < 7; r++) {
      var f = r / 6;
      var ry = cy - lh * 0.92 + lh * 1.95 * f;
      var rx = (hil + lw) * (0.72 + 0.30 * Math.sin(Math.PI * (0.22 + 0.64 * f)));
      x.beginPath();
      x.moveTo(cx - rx, ry);
      x.quadraticCurveTo(cx, ry + U * 0.16, cx + rx, ry);
      x.stroke();
    }
    x.restore();

    /* 横隔膜：肺底の下にドームを一本の線で */
    x.save();
    var dy = cy + lh * 0.98 + U * 0.10 + clamp(mo.pmus / 20, 0, 1) * U * 0.16;
    var dGrad = x.createLinearGradient(cx, dy - U * 0.5, cx, dy + U * 0.2);
    dGrad.addColorStop(0, 'rgba(196,115,111,.55)');
    dGrad.addColorStop(1, 'rgba(150,80,80,.15)');
    x.beginPath();
    x.moveTo(cx - (hil + lw) * 0.96, dy);
    x.quadraticCurveTo(cx, dy - U * 0.78, cx + (hil + lw) * 0.96, dy);
    x.lineTo(cx + (hil + lw) * 0.96, dy + U * 0.22);
    x.quadraticCurveTo(cx, dy - U * 0.50, cx - (hil + lw) * 0.96, dy + U * 0.22);
    x.closePath();
    x.fillStyle = dGrad; x.fill();
    x.strokeStyle = 'rgba(196,115,111,.9)'; x.lineWidth = 2;
    x.beginPath();
    x.moveTo(cx - (hil + lw) * 0.96, dy);
    x.quadraticCurveTo(cx, dy - U * 0.78, cx + (hil + lw) * 0.96, dy);
    x.stroke();
    x.restore();

    /* 気管と気管チューブ */
    x.save();
    var carina = cy - lh * 0.94;
    x.strokeStyle = '#DCE6F2'; x.lineWidth = Math.max(2.5, U * 0.13 * (1 - 0.30 * mo.narrow));
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx, carina - U * 0.42); x.lineTo(cx, carina); x.stroke();
    x.strokeStyle = '#8FD3E8'; x.lineWidth = Math.max(2, U * 0.085);
    x.beginPath(); x.moveTo(cx, Math.max(padT - 4, carina - U * 0.95)); x.lineTo(cx, carina - U * 0.22); x.stroke();
    x.restore();

    /* 左右の肺。輪郭は塗りにもクリップにも使うので一度だけ作る。 */
    function lungPath(ax, sd) {
      x.beginPath();
      x.moveTo(ax + sd * lw * 0.06, cy - lh * 0.96);
      x.bezierCurveTo(ax + sd * lw * 0.66, cy - lh * 0.92,
                      ax + sd * lw * 1.02, cy - lh * 0.18,
                      ax + sd * lw * 0.76, cy + lh * 0.84);
      x.bezierCurveTo(ax + sd * lw * 0.58, cy + lh * 1.02,
                      ax + sd * lw * 0.02, cy + lh * 1.00,
                      ax - sd * lw * 0.30, cy + lh * 0.66);
      x.bezierCurveTo(ax - sd * lw * 0.46, cy + lh * 0.42,
                      ax - sd * lw * 0.10, cy + lh * 0.10,
                      ax - sd * lw * 0.26, cy - lh * 0.20);
      x.bezierCurveTo(ax - sd * lw * 0.38, cy - lh * 0.56,
                      ax - sd * lw * 0.28, cy - lh * 0.92,
                      ax + sd * lw * 0.06, cy - lh * 0.96);
      x.closePath();
    }

    for (var sd = -1; sd <= 1; sd += 2) {
      var ax = cx + sd * hil;

      x.save();
      lungPath(ax, sd);
      var grad = x.createLinearGradient(ax, cy - lh, ax, cy + lh);
      grad.addColorStop(0, hot > 0.3 ? P.warn : '#F7B3BF');
      grad.addColorStop(1, mo.stiff > 0.4 ? '#D2BAC6' : '#E2839A');
      x.fillStyle = grad; x.globalAlpha = 0.60; x.fill();
      x.globalAlpha = 1;
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1.6; x.stroke();
      x.restore();

      // 中身（気管支と肺胞）は肺の輪郭の中だけに描く
      x.save();
      lungPath(ax, sd);
      x.clip();

      var narrowCol = mo.narrow > 0.05
        ? 'rgba(255,176,58,' + (0.6 + 0.35 * mo.narrow).toFixed(2) + ')' : '#EDF2F9';
      var hx = ax - sd * lw * 0.18, hy = cy - lh * 0.46;   // 肺門
      x.strokeStyle = narrowCol;
      x.lineWidth = Math.max(1.4, U * 0.090 * (1 - 0.58 * mo.narrow));
      x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath();
      x.moveTo(hx, hy);
      x.quadraticCurveTo(ax + sd * lw * 0.05, cy + lh * 0.05,
                         ax + sd * lw * 0.12, cy + lh * 0.55);
      x.stroke();
      x.lineWidth = Math.max(1, U * 0.050 * (1 - 0.58 * mo.narrow));
      [[-0.40, 0.62], [0.05, 0.86], [0.42, 0.55], [0.66, 0.30]].forEach(function (br) {
        var fy = cy + lh * br[0] * 0.9;
        x.beginPath();
        x.moveTo(ax + sd * lw * (0.02 + br[0] * 0.12), fy);
        x.quadraticCurveTo(ax + sd * lw * br[1] * 0.6, fy - lh * 0.04,
                           ax + sd * lw * br[1], fy - lh * 0.10);
        x.stroke();
      });

      // 肺胞（房）。並びは固定。つぶれた分は小さく暗い。
      var n = 26;
      for (var a = 0; a < n; a++) {
        var ang = (a * 2.39996) + (sd > 0 ? 0.4 : 2.0);          // 黄金角でばらす
        var rad01 = Math.sqrt((a + 0.6) / n);
        var axp = ax + Math.cos(ang) * lw * 0.74 * rad01;
        var ay = cy + Math.sin(ang) * lh * 0.80 * rad01;
        var shut = (a / n) < mo.collapse;
        var rad = U * 0.080 * (shut ? 0.40 : lin) * (0.78 + 0.34 * ((a * 17 % 7) / 7));
        x.beginPath(); x.arc(axp, ay, rad, 0, Math.PI * 2);
        x.fillStyle = shut ? '#6A4668' : (mo.over > 0.3 ? P.crit : '#FFC2CE');
        x.fill();
      }
      x.restore();

      // 主気管支は肺の外（分岐部から肺門まで）にも見える
      x.save();
      x.strokeStyle = narrowCol;
      x.lineWidth = Math.max(1.6, U * 0.095 * (1 - 0.58 * mo.narrow));
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(cx, carina);
      x.lineTo(hx, hy);
      x.stroke();
      x.restore();
    }

    /* 気流 */
    if (Math.abs(mo.flow) > 0.004) {
      x.save();
      x.fillStyle = mo.flow >= 0 ? P.flow : P.paw;
      for (var q = 0; q < this._parts.length; q++) {
        var pp = this._parts[q] || (this._parts[q] = { u: q / 26, lane: q % 2 });
        pp.u += mo.flow * 0.5 * dtReal;
        while (pp.u > 1) pp.u -= 1;
        while (pp.u < 0) pp.u += 1;
        var sl = pp.lane ? 1 : -1, px, py;
        if (pp.u < 0.4) {
          px = cx; py = carina - U * 0.90 + (U * 0.90) * (pp.u / 0.4);
        } else {
          var t2 = (pp.u - 0.4) / 0.6;
          var bx = cx + sl * (hil - lw * 0.22), by = cy - lh * 0.55;
          px = cx + (bx - cx) * t2;
          py = carina + (by - carina) * t2 + t2 * t2 * lh * 0.5;
        }
        x.beginPath(); x.arc(px, py, Math.max(1.6, U * 0.045), 0, Math.PI * 2); x.fill();
      }
      x.restore();
    }

  };

  View.prototype.dispose = function () {
    if (this.gl && this.renderer) { this.renderer.dispose(); }
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  };

  function create(host) {
    var v = new View(host);
    v.mount();
    return v;
  }

  var api = {
    frcFor: frcFor, tlcFor: tlcFor, lungHeightCm: lungHeightCm,
    cRef: cRef, rRef: rRef, readModel: readModel, termsOf: termsOf,
    create: create, View: View
  };
  root.VentLung3D = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
