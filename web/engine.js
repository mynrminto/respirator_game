/* VentSim — 呼吸生理エンジン
 * 単一コンパートメント肺モデル + 簡易ガス交換 + 循環連成 + 呼吸ドライブ。
 * 単位: 容量 L / 圧 cmH2O / 流量 L·s^-1 / 時間 s。UI 境界で mL・L/min に変換する。
 * 運動方程式:  Paw + Pmus = V/C + R·V̇
 */
(function (root) {
  'use strict';

  var PB = 760, PH2O = 47, RQ = 0.8;
  /* 酸素と CO2 の貯え。値の出どころは _gas と _o2Capacity のコメントを参照。 */
  var FRC_PER_KG = 25;           // mL/kg  鎮静・仰臥位の機能的残気量（PEEP 0 のとき）
  var BLOOD_PER_KG = 75;         // mL/kg  循環血液量
  var CO2_STORE_PER_KG = 0.33;   // mL/kg/mmHg  速く平衡する CO2 の貯え
  var PA_O2_FLOOR = 12;          // mmHg

  /* ---------- 酸素解離曲線 (Severinghaus) ---------- */
  function satFromPO2(p) {
    if (p <= 0) return 0;
    var s = 1 / (23400 / (p * p * p + 150 * p) + 1);
    return Math.max(0, Math.min(1, s));
  }
  function po2FromSat(s) {
    if (s <= 0) return 0;
    if (s >= 0.9999) return 700;
    var lo = 0, hi = 700, mid;
    for (var i = 0; i < 60; i++) {
      mid = (lo + hi) / 2;
      if (satFromPO2(mid) < s) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function o2Content(po2, hb) { return 1.34 * hb * satFromPO2(po2) + 0.003 * po2; }
  function po2FromContent(c, hb) {
    var lo = 0, hi = 700, mid;
    for (var i = 0; i < 60; i++) {
      mid = (lo + hi) / 2;
      if (o2Content(mid, hb) < c) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* 小児では身長からの予測体重を使わない。実体重（早産児なら出生体重ではなく現体重）が
   * すべての設定の基準になる。weightKg があればそれを、無ければ成人式に落ちる。 */
  function predictedBodyWeight(p, heightCm) {
    if (p && typeof p === 'object') {
      if (p.weightKg) return p.weightKg;
      return predictedBodyWeight(p.sex, p.heightCm);
    }
    var base = p === 'F' ? 45.5 : 50;
    return Math.max(25, base + 0.91 * (heightCm - 152.4));
  }

  /* ---------- 年齢別の基準値 ----------
   * 症例ごとに毎回書かなくて済むよう、月齢と体重から既定値を作る。
   * 症例側の patient.norms に同じキーを書けば上書きされる。
   * rr/hr は正常域、mapMin は許容できる平均血圧の下限（新生児は在胎週数がおおよその目安）。 */
  function ageNorms(ageMonths) {
    var a = ageMonths;
    if (a < 1)   return { label: '新生児',   rr: [40, 60], hr: [120, 160], mapMin: 30, spo2: [90, 95],
                          platMax: 24, dpMax: 12, vtPerKg: [4, 6],  vdCircuit: 1.0, apnea: 10,
                          rrMax: 80, tiMin: 0.20, trigLock: 0.10,
                          abg: { ph: [7.25, 7.40], paco2: [40, 55], pao2: [45, 75], hco3: [18, 24] } };
    if (a < 12)  return { label: '乳児',     rr: [30, 50], hr: [110, 160], mapMin: 45, spo2: [92, 97],
                          platMax: 26, dpMax: 13, vtPerKg: [5, 7],  vdCircuit: 5,   apnea: 15,
                          rrMax: 70, tiMin: 0.30, trigLock: 0.12,
                          abg: { ph: [7.33, 7.45], paco2: [33, 45], pao2: [70, 100], hco3: [19, 24] } };
    if (a < 36)  return { label: '幼児',     rr: [24, 40], hr: [100, 140], mapMin: 50, spo2: [92, 97],
                          platMax: 28, dpMax: 14, vtPerKg: [5, 7],  vdCircuit: 8,   apnea: 15,
                          rrMax: 60, tiMin: 0.35, trigLock: 0.15,
                          abg: { ph: [7.34, 7.45], paco2: [33, 45], pao2: [80, 100], hco3: [20, 25] } };
    if (a < 72)  return { label: '未就学児', rr: [20, 30], hr: [90, 130],  mapMin: 55, spo2: [92, 97],
                          platMax: 28, dpMax: 15, vtPerKg: [6, 8],  vdCircuit: 10,  apnea: 18,
                          rrMax: 55, tiMin: 0.40, trigLock: 0.18,
                          abg: { ph: [7.35, 7.45], paco2: [34, 45], pao2: [80, 100], hco3: [21, 26] } };
    if (a < 144) return { label: '学童',     rr: [18, 26], hr: [75, 115],  mapMin: 60, spo2: [94, 98],
                          platMax: 30, dpMax: 15, vtPerKg: [6, 8],  vdCircuit: 12,  apnea: 20,
                          rrMax: 45, tiMin: 0.45, trigLock: 0.20,
                          abg: { ph: [7.35, 7.45], paco2: [35, 45], pao2: [80, 100], hco3: [22, 26] } };
    return           { label: '思春期',      rr: [14, 22], hr: [60, 100],  mapMin: 65, spo2: [94, 98],
                          platMax: 30, dpMax: 15, vtPerKg: [6, 8],  vdCircuit: 15,  apnea: 20,
                          rrMax: 40, tiMin: 0.50, trigLock: 0.25,
                          abg: { ph: [7.35, 7.45], paco2: [35, 45], pao2: [80, 100], hco3: [22, 26] } };
  }

  /* 症例の patient から、エンジンと画面が使う基準値一式を作る。 */
  function normsFor(p) {
    var n = ageNorms(p.ageMonths != null ? p.ageMonths : 12 * (p.age || 12));
    var o = {};
    for (var k in n) if (Object.prototype.hasOwnProperty.call(n, k)) o[k] = n[k];
    var ov = p.norms || {};
    for (var k2 in ov) if (Object.prototype.hasOwnProperty.call(ov, k2)) o[k2] = ov[k2];
    return o;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function approach(cur, target, dt, tau) {
    if (tau <= 0) return target;
    var k = 1 - Math.exp(-dt / tau);
    return cur + (target - cur) * k;
  }

  /* ---------- 既定の人工呼吸器設定 ---------- */
  /* つまみの可動域。小児は体重で 2 桁変わるので、症例ごとに作る。 */
  function limitsFor(pbw, nm) {
    var fine = pbw < 6, small = pbw < 20;
    var vtStep = fine ? 0.5 : (small ? 5 : 10);
    var vtMax = Math.max(vtStep * 4, Math.ceil(pbw * 15 / vtStep) * vtStep);
    var vtMin = Math.max(vtStep, Math.floor(pbw * 2 / vtStep) * vtStep);
    var flowMax = Math.max(4, Math.ceil(pbw * 1.6));
    var flowStep = flowMax <= 12 ? 0.5 : (flowMax <= 40 ? 1 : 5);
    return {
      vt:    { min: vtMin, max: vtMax, step: vtStep, dec: fine ? 1 : 0 },
      rr:    { min: 5, max: nm.rrMax, step: 1 },
      ti:    { min: nm.tiMin, max: fine ? 1.0 : (small ? 1.8 : 2.5), step: 0.05, dec: 2 },
      flow:  { min: flowStep, max: flowMax, step: flowStep, dec: flowStep < 1 ? 1 : 0 },
      pause: { min: 0, max: fine ? 0.4 : 0.8, step: fine ? 0.05 : 0.1, dec: 2 },
      trig:  { min: 0.2, max: fine ? 3 : 8, step: fine ? 0.1 : 0.5, dec: 1 },
      pinsp: { min: 4, max: fine ? 30 : 40, step: 1 },
      ps:    { min: 0, max: fine ? 20 : 25, step: 1 }
    };
  }

  /* 体重に合わせたアラーム初期値。実機と同じで、設定値の周りに枠を作る。 */
  function alarmsFor(pbw, nm, vt, rr) {
    var mv = vt / 1000 * rr;
    return {
      pMax: Math.round(nm.platMax + 8),
      vtLow: Math.max(1, Math.round(vt * 0.55)),
      vtHigh: Math.round(pbw * 10),
      mvLow: Math.max(0.05, Math.round(mv * 0.6 * 100) / 100),
      mvHigh: Math.round(mv * 1.8 * 100) / 100,
      rrHigh: Math.round(Math.min(nm.rrMax, rr * 1.5 + 8)),
      apnea: nm.apnea
    };
  }

  function defaultSettings() {
    return {
      mode: 'VC-AC',      // VC-AC | PC-AC | SIMV-VC | PSV | CPAP
      vt: 450,            // mL
      rr: 14,             // 回/分（設定換気回数）
      peep: 5,            // cmH2O
      fio2: 1.0,          // 0.21–1.0
      pinsp: 15,          // PEEP からの上乗せ (cmH2O)
      ti: 1.0,            // 吸気時間 (s) — PC / SIMV
      flow: 50,           // 吸気流量 (L/min) — VC
      flowPattern: 'decel', // square | decel
      ps: 10,             // プレッシャーサポート (cmH2O)
      trigFlow: 2.0,      // 流量トリガ感度 (L/min)
      eSens: 0.25,        // 呼気トリガ（ピーク流量比）
      pause: 0,           // 吸気ポーズ (s)
      rise: 0.15,         // 立ち上がり時間 (s)
      alarms: { pMax: 35, vtLow: 250, vtHigh: 800, mvLow: 3, mvHigh: 15, rrHigh: 35, apnea: 20 }
    };
  }

  /* ---------- エンジン ---------- */
  function Engine(patient, settings) {
    this.p = JSON.parse(JSON.stringify(patient));
    this.s = settings || defaultSettings();
    this.reset();
  }

  Engine.prototype.reset = function () {
    var p = this.p, s = this.s;
    p.pbw = predictedBodyWeight(p);
    this.nm = normsFor(p);
    this.limits = limitsFor(p.pbw, this.nm);
    this.t = 0;
    this.clock = 0;                 // 経過（シミュレーション内秒）
    this.C = p.compliance;          // L/cmH2O
    this.V = this.C * s.peep;       // 弛緩位からの容量
    this.paw = s.peep;
    this.flow = 0;
    this.phase = 'exp';
    this.phaseT = 0;
    this.breathType = 'mand';
    this.vtInsp = 0;
    this.peakFlowThisBreath = 0;
    this.pipThis = 0;
    this.pawSum = 0; this.pawN = 0;
    this.vEE = this.V;              // 直前の呼気終末容量
    this.vEI = this.V;
    this.sinceMand = 0;             // 前回の強制換気開始からの秒
    this.sinceBreath = 0;           // 前回の吸気開始からの秒
    this.hold = null;               // {kind:'insp'|'exp', t, value}
    this.holdPending = null;

    // 自発呼吸（神経性）
    this.pmus = 0;
    this.neuralT = 0;
    this.neuralTtot = 60 / 14;
    this.neuralTi = 1.1;
    this.pmusAmp = 0;
    this.effortActive = false;
    this.fatigue = 0;
    this.vtGain = 1;                // 努力の補正係数（実測 Vt を見て動く）
    this._lastSpontVte = 0;         // L
    this.sedation = p.sedation != null ? p.sedation : 0.9;

    // 血液ガス・循環
    this.paco2 = p.paco2 != null ? p.paco2 : 40;
    this.hco3 = p.hco3 != null ? p.hco3 : 24;
    this.pao2 = p.pao2 != null ? p.pao2 : 80;
    this.spo2 = satFromPO2(this.pao2) * 100;
    this.pAO2 = Math.max(PA_O2_FLOOR, s.fio2 * (PB - PH2O) - this.paco2 / RQ);   // 肺胞 PO2
    this.co = p.co || 5.0;
    this.hr = p.hr || 88;
    this.map = p.map || 80;
    this.shunt = p.shunt0;
    this.etco2 = 38;
    this.temp = p.temp || 37.0;

    // 計測値
    this.m = {
      pip: 0, pplat: null, pmean: s.peep, peepTot: s.peep,
      vte: 0, vti: 0, mv: 0, rrTotal: 0, rrSpont: 0, rrTrig: 0,
      cstat: null, raw: null, dp: null, ie: '1:2', rsbi: null, autoPeep: 0,
      peakInsp: 0, peakExp: 0
    };
    this._fIn = 0; this._fEx = 0;
    this.breaths = [];              // {t, vte, spont, trig}
    this.waveform = { paw: [], flow: [], vol: [], n: 0 };
    this.wfCap = 1500;
    this.alarms = [];
    this.lastTrigger = null;        // 'patient' | 'timer' | 'backup'
    this.apneaT = 0;
    this.events = [];
    this.extubated = false;
    this.suctionShunt = 0;
    this.sbt = null;
    this.timeInTarget = { total: 0, ok: 0 };
    this.harm = { highPlat: 0, highVt: 0, autoPeep: 0, hypoxia: 0, hypotension: 0, highFio2: 0 };
    this._wfClock = 0;
    this._gasClock = 0;
    this._recomputeDrive();
  };

  Engine.prototype.setSetting = function (k, v) {
    if (k === 'peep' && this.phase === 'exp') { /* そのまま反映 */ }
    this.s[k] = v;
  };

  /* ---------- 呼吸ドライブ ---------- */
  Engine.prototype._recomputeDrive = function () {
    var p = this.p;
    var vco2 = p.vco2 * (1 + 0.13 * (this.temp - 37));      // 発熱で代謝亢進
    var setpoint = p.co2Setpoint != null ? p.co2Setpoint : 40;
    /* 安静時分時換気量は「必要な肺胞換気量 ÷ (1 − 死腔率)」から出す。
     * 成人の 0.1 L/kg/分という係数では、体重 1 kg の早産児で 2 桁ずれる。 */
    var vdFrac = clamp((2.0 * p.pbw + (p.vdCircuit != null ? p.vdCircuit : this.nm.vdCircuit))
      / Math.max(1, p.pbw * 7), 0.15, 0.7);
    var va0 = 0.863 * vco2 / setpoint;                       // L/min
    var ve0 = va0 / (1 - vdFrac);
    var drive = 1 + 0.11 * (this.paco2 - setpoint);
    if (this.pao2 < 60) drive += (60 - this.pao2) * 0.022;   // 低酸素刺激
    var ph = 6.1 + Math.log10(Math.max(2, this.hco3) / (0.03 * Math.max(10, this.paco2)));
    if (ph < 7.30) drive += (7.30 - ph) * 3.0;               // 代謝性アシドーシス
    drive *= (p.driveGain != null ? p.driveGain : 1);
    drive = clamp(drive, 0, 6);

    var awake = clamp(1 - this.sedation, 0, 1);
    var veDemand = ve0 * drive * awake;
    this.veDemand = veDemand;

    if (awake < 0.06 || veDemand < 0.08 * ve0) {             // 深鎮静・筋弛緩 → 無呼吸
      this.pmusAmp = 0;
      this.neuralTtot = 99;
      return;
    }
    // 疲労と病態で呼吸数が増え、一回換気量が落ちる
    var nm = this.nm;
    var rr0 = (nm.rr[0] + nm.rr[1]) / 2;                     // 年齢相応の安静時呼吸数
    var demandRatio = veDemand / Math.max(1e-6, ve0);
    var rrN = clamp(rr0 * (0.55 + 0.45 * demandRatio) + rr0 * this.fatigue,
      nm.rr[0] * 0.7, nm.rrMax);
    this.neuralTtot = 60 / rrN;
    this.neuralTi = clamp(0.62 * this.neuralTtot, nm.tiMin, 1.3);

    var vtTarget = (veDemand / rrN);                         // L
    /* 実際に出た一回換気量を見て、努力の大きさを少しずつ合わせ込む。
     * 呼吸中枢が「足りなければもっと強く吸う」ことに相当する。 */
    if (this._lastSpontVte > 0 && vtTarget > 0) {
      var err = clamp(vtTarget / this._lastSpontVte, 0.25, 4);
      this.vtGain = clamp(this.vtGain * (1 + 0.08 * (err - 1)), 0.5, 4);
    }
    var ampNeeded = (vtTarget / this.C) * 0.62 * this.vtGain;
    /* 呼吸筋の余力。鎮静は「出せる力」を減らすが、疲労の分母にはしない。
     * 分母に鎮静を入れると、深く鎮静した患者ほど全力で呼吸していることになってしまう。 */
    var capacity = (p.maxPmus != null ? p.maxPmus : 25) * (1 - 0.55 * this.fatigue);
    var maxP = capacity * awake;
    this.pmusAmp = clamp(ampNeeded, 0, maxP);
    this.muscleLoad = capacity > 0
      ? (this.pmusAmp / capacity) * clamp(rrN / rr0, 0, 2.2)
      : 0;
  };

  /* 疲れはじめる負荷と疲れる速さは症例で変えられる。神経筋疾患の子は、軽い負荷でも
   * 数十分かけて少しずつ疲れていく（SBT の後半で崩れる）。 */
  Engine.prototype._updateFatigue = function (dt) {
    var load = this.muscleLoad || 0;
    /* A/C では送気の大半を機械が担うので、呼吸筋は休んでいる。SIMV はその中間。 */
    var md = this.s.mode;
    if (md === 'VC-AC' || md === 'PC-AC') load *= 0.4;
    else if (md === 'SIMV-VC') load *= 0.7;
    var th = this.p.fatigueLoad != null ? this.p.fatigueLoad : 0.62;
    var tau = this.p.fatigueTau != null ? this.p.fatigueTau : 95;
    if (load > th) this.fatigue += (load - th) * dt / tau;
    else this.fatigue -= dt / 420;
    this.fatigue = clamp(this.fatigue, 0, 1);
  };

  /* ---------- 1 ステップ ---------- */
  Engine.prototype.step = function (dt, sampleWave) {
    var s = this.s, p = this.p;
    this.t += dt; this.clock += dt;
    this.phaseT += dt; this.sinceMand += dt; this.sinceBreath += dt;

    /* 神経性の吸気努力 */
    this.neuralT += dt;
    if (this.neuralT >= this.neuralTtot) { this.neuralT = 0; this.effortActive = true; }
    if (this.effortActive && this.neuralT <= this.neuralTi && this.pmusAmp > 0) {
      var x = this.neuralT / this.neuralTi;
      // 立ち上がりが速く、終末で急に緩む実際の形に寄せる
      this.pmus = this.pmusAmp * Math.sin(Math.PI * Math.pow(x, 0.78));
    } else {
      this.pmus = 0;
      if (this.neuralT > this.neuralTi) this.effortActive = false;
    }

    /* ホールド操作（吸気ポーズ／呼気ポーズ） */
    if (this.hold) {
      this.hold.t += dt;
      this.flow = 0;
      this.paw = this.V / this.C - this.pmus * 0.35;
      if (this.hold.kind === 'exp') this.m.peepTot = this.V / this.C;
      else this.m.pplat = this.V / this.C;
      if (this.hold.t > 2.2) {
        /* ポーズのあいだは次の呼吸の時計を止めておく。止めないと、ポーズ明けの呼気が
         * 短く切られて吐ききれず、見かけの auto-PEEP が赤く出る。 */
        this.sinceMand = Math.max(0, this.sinceMand - this.hold.t);
        if (this.hold.kind === 'exp') {
          this.m.autoPeep = Math.max(0, this.m.peepTot - s.peep);
        } else {
          this._recomputeMechanics();
        }
        this.hold = null;
        this.phase = 'exp'; this.phaseT = 0;
      }
      this._sample(dt, sampleWave);
      this._gas(dt);
      return;
    }

    var mandInterval = 60 / Math.max(1, s.rr);
    var spontMode = (s.mode === 'PSV' || s.mode === 'CPAP');
    var simv = (s.mode === 'SIMV-VC');

    /* --------- 吸気相 --------- */
    if (this.phase === 'insp') {
      var target, tau;
      if (this.breathType === 'mand' && (s.mode === 'VC-AC' || simv)) {
        // 量規定：流量を指令し、圧が従う
        var qset = s.flow / 60;
        var q = qset;
        if (s.flowPattern === 'decel') {
          var frac = clamp(this.vtInsp / (s.vt / 1000), 0, 1);
          q = qset * (1 - 0.5 * frac);
        }
        var target0 = s.vt / 1000;
        var dV = q * dt;
        if (this.vtInsp + dV > target0) dV = Math.max(0, target0 - this.vtInsp);  // 行き過ぎない
        this.flow = q;
        this._qLast = q;
        this.V += dV;
        this.vtInsp += dV;
        this.paw = this.V / this.C + p.Rinsp * q - this.pmus;
        this._pawEnd = this.paw;
        if (this.vtInsp >= target0 - 1e-9) {
          if (s.pause > 0) { this.phase = 'pause'; this.phaseT = 0; }
          else { this._endInsp(); }
        } else if (this.paw > s.alarms.pMax + 10) {   // 圧リミット
          this._raise('高気道内圧で吸気を中断');
          this._endInsp();
        }
      } else {
        // 圧規定（PC / PS / SIMV の自発）
        var pset = (this.breathType === 'mand') ? s.pinsp : s.ps;
        var rise = clamp(this.phaseT / Math.max(0.02, s.rise), 0, 1);
        target = s.peep + pset * rise;
        this.paw = target;
        tau = p.Rinsp * this.C;
        var veq = this.C * (target + this.pmus);
        var vNew = veq + (this.V - veq) * Math.exp(-dt / tau);
        this.flow = (vNew - this.V) / dt;
        this.vtInsp += (vNew - this.V);
        this.V = vNew;
        if (this.flow > this.peakFlowThisBreath) this.peakFlowThisBreath = this.flow;
        if (this.breathType === 'mand') {
          if (this.phaseT >= s.ti) { if (s.pause > 0) { this.phase = 'pause'; this.phaseT = 0; } else this._endInsp(); }
        } else {
          var cycleOff = this.peakFlowThisBreath * s.eSens;
          var tiMinPS = this.nm.tiMin * 0.8, tiMaxPS = this.nm.tiMin * 7;
          if ((this.phaseT > tiMinPS && this.flow <= cycleOff) || this.phaseT > tiMaxPS) this._endInsp();
        }
      }
      if (this.paw > this.pipThis) this.pipThis = this.paw;
    }
    /* --------- 吸気ポーズ --------- */
    else if (this.phase === 'pause') {
      this.flow = 0;
      this.paw = this.V / this.C - this.pmus * 0.35;
      this.m.pplat = this.V / this.C;
      /* 先に呼吸を締めてから計算する。逆にすると vEI と PIP が 1 つ前の呼吸の値のままで、
       * Cstat と Raw が呼吸ごとに跳ねる。 */
      if (this.phaseT >= s.pause) { this._endInsp(); this._recomputeMechanics(); }
    }
    /* --------- 呼気相 --------- */
    else {
      /* 患者が吸おうとすると、回路の圧は PEEP より少しだけ下がる。
       * 機械が応えなかった努力（トリガを鈍くしたとき）は、この小さな切れ込みとして圧波形に残る。 */
      this.paw = s.peep - 0.5 * this.pmus;
      var tauE = p.Rexp * this.C;
      var veqE = this.C * (s.peep + this.pmus);
      var vNewE = veqE + (this.V - veqE) * Math.exp(-dt / tauE);
      this.flow = (vNewE - this.V) / dt;
      this.V = vNewE;

      /* トリガ判定 */
      var trigQ = s.trigFlow / 60;
      var canTrigger = this.phaseT > this.nm.trigLock;
      if (canTrigger && this.flow > trigQ) {
        if (spontMode) this._startBreath('spont', 'patient');
        else if (simv) {
          var inWindow = this.sinceMand >= mandInterval - 0.6;
          var grid = this.sinceMand - mandInterval;
          this._startBreath(inWindow ? 'mand' : 'spont', 'patient');
          /* 窓の中で同期した強制換気は、時計の刻みを保つ（早めた分だけ次を遅らせる）。
           * 0 に戻すと、同期するたびに強制換気の回数が設定より増えていく。 */
          if (inWindow) this.sinceMand = grid;
        } else this._startBreath('mand', 'patient');   // A/C：全部強制換気
      } else if (!spontMode && this.sinceMand >= mandInterval && this.phaseT > this.nm.trigLock * 1.2) {
        this._startBreath('mand', 'timer');
      } else if (spontMode && this.sinceBreath > s.alarms.apnea) {
        this._raise('無呼吸：バックアップ換気');
        this._startBreath('mand', 'backup');
      }
    }

    /* 1 呼吸の最大吸気流量・最大呼気流量（波形の目盛りを体重に合わせるのに使う） */
    if (this.phase === 'insp') { if (this.flow > this._fIn) this._fIn = this.flow; }
    else if (this.flow < this._fEx) this._fEx = this.flow;

    this._sample(dt, sampleWave);
    this._gas(dt);
  };

  Engine.prototype._startBreath = function (type, trig) {
    var s = this.s;
    if (this.holdPending === 'exp') {           // 呼気末でポーズに入り、この呼吸は始めない
      this.holdPending = null;
      this.hold = { kind: 'exp', t: 0 };
      this.m.peepTot = this.V / this.C;
      return;
    }
    this.m.peakExp = -this._fEx * 60; this._fEx = 0;
    this.vEE = this.V;
    /* 肺胞の圧は弾性圧（V/C）から患者の吸気努力を引いたもの。努力で引き込んだ分まで
     * auto-PEEP に数えると、自発のある子で 0.2〜1 cmH₂O の見かけの値が出続ける。 */
    var palvEE = this.V / this.C - this.pmus;
    this.m.peepTot = Math.max(s.peep, palvEE);
    this.m.autoPeep = Math.max(0, palvEE - s.peep);
    this.m._ttot = this._prevInspStart != null ? (this.clock - this._prevInspStart) : 0;
    this._prevInspStart = this.clock;
    this._inspStart = this.clock;
    this.phase = 'insp'; this.phaseT = 0;
    this.breathType = type;
    this.lastTrigger = trig;
    this.vtInsp = 0;
    this.pipThis = 0;
    this.peakFlowThisBreath = 0;
    this.sinceBreath = 0;
    /* 強制換気の時計は強制換気でだけ戻す。SIMV の自発呼吸で戻すと、
     * 自発が多いほど強制換気が減り、設定 RR が守られなくなる。 */
    if (type === 'mand') this.sinceMand = 0;
    this._lastBreathSpont = (type === 'spont');
    this._lastBreathTrig = trig;
  };

  Engine.prototype._endInsp = function () {
    this.m.peakInsp = this._fIn * 60; this._fIn = 0;
    this._lastTi = this._inspStart != null ? this.clock - this._inspStart : this.phaseT;   // ポーズも吸気時間に含める
    this.vEI = this.V;
    this.m.pip = this.pipThis;
    this.m.vti = (this.vEI - this.vEE) * 1000;
    this.phase = 'exp'; this.phaseT = 0;
    var vte = this.m.vti;                      // リークなしを仮定
    this.m.vte = vte;
    if (this._lastBreathSpont) this._lastSpontVte = vte / 1000;
    this.breaths.push({ t: this.clock, vte: vte, spont: this._lastBreathSpont, trig: this._lastBreathTrig });
    if (this.breaths.length > 200) this.breaths.shift();
    this._recomputeRates();
    if (this.holdPending === 'insp') {
      this.holdPending = null;
      this.hold = { kind: 'insp', t: 0 };
      this.m.pplat = this.V / this.C;
    }
  };

  Engine.prototype._recomputeMechanics = function () {
    var vt = (this.vEI - this.vEE);
    if (this.m.pplat != null && vt > 0.0005) {
      var dp = this.m.pplat - Math.max(this.s.peep, this.vEE / this.C);
      this.m.dp = dp;
      this.m.cstat = dp > 0.5 ? (vt * 1000) / dp : null;
      var peak = this.m.pip;
      var qEnd = this._qLast || this.s.flow / 60;
      /* 患者トリガの呼吸は吸気努力のぶん PIP が低く出るので、Raw の計算に使わない。 */
      if ((this.s.mode === 'VC-AC' || this.s.mode === 'SIMV-VC') && this._lastBreathTrig !== 'patient') {
        /* 吸気終末の圧と流量で割る。漸減波では PIP と終末流量が同じ瞬間ではないので、PIP は使わない。 */
        var pEnd = this._pawEnd != null ? this._pawEnd : peak;
        var raw = qEnd > 0.004 ? (pEnd - this.m.pplat) / qEnd : null;
        this.m.raw = (raw != null && raw >= 0) ? raw : null;
      }
    }
  };

  /* 呼吸回数は「直近 20 秒の呼吸の間隔」から出す（少なくとも 3 間隔）。60 秒の窓で数えると、
   * 設定を変えてから表示が追いつくまで 1 分近くかかり、窓の端の数え方で設定より 1〜3 回多く出る。
   * 自発・トリガの割合だけは 60 秒で見る。混ざった呼吸では短い窓だと割合が大きく揺れるため。 */
  Engine.prototype._recomputeRates = function () {
    var now = this.clock, B = this.breaths, first = -1, i;
    for (i = B.length - 1; i >= 0; i--) {
      if (now - B[i].t > 60) break;
      if (now - B[i].t <= 20 || B.length - 1 - i <= 3) first = i;
    }
    var n = first >= 0 ? B.length - 1 - first : 0;     // 間隔の数。最初の呼吸は起点にだけ使う
    var vteSum = 0, nsShort = 0, vtSpontSum = 0;
    for (i = first + 1; n > 0 && i < B.length; i++) {
      vteSum += B[i].vte;
      if (B[i].spont) { nsShort++; vtSpontSum += B[i].vte; }
    }
    var nAll = 0, ns = 0, nt = 0;
    for (i = B.length - 1; i >= 0 && now - B[i].t <= 60; i--) {
      nAll++;
      if (B[i].spont) ns++;
      if (B[i].trig === 'patient') nt++;
    }
    if (n >= 1) {
      var rate = n * 60 / Math.max(0.5, B[B.length - 1].t - B[first].t);
      this.m.rrTotal = rate;
      this.m.rrSpont = nAll ? rate * ns / nAll : 0;
      this.m.rrTrig = nAll ? rate * nt / nAll : 0;
      this.m.mv = (vteSum / n) / 1000 * rate;
    } else {
      this.m.rrTotal = 0; this.m.rrSpont = 0; this.m.rrTrig = 0;
      this.m.mv = 0;
    }
    /* 成人の RSBI（f/VT[L] < 105）は小児では常に桁外れになる。
     * 小児では f ÷ (一回換気量 mL/kg) で見て、8 未満を目安にする。
     * f はモードを切り替えた直後でも正しく出るよう、短い窓の自発の割合から出す。 */
    var vtMean = null;
    if (nsShort >= 2) vtMean = vtSpontSum / nsShort;
    if (vtMean != null && vtMean > 0.2) {
      var fSpont = Math.max(n >= 1 ? this.m.rrTotal * nsShort / n : 0, 1);
      this.m.rsbi = Math.min(3000, fSpont / (vtMean / 1000));
      this.m.rsbiKg = Math.min(60, fSpont / (vtMean / this.p.pbw));
    } else if (nsShort >= 2) {
      this.m.rsbi = 3000; this.m.rsbiKg = 60;
    } else if (ns === 0) {
      this.m.rsbi = null; this.m.rsbiKg = null;       // 自発がなければ出さない
    }
    /* I:E は 1 呼吸の吸気時間（ポーズ込み）と、呼吸の間隔の平均から出す。
     * 患者トリガで間隔が揺れるので、数呼吸でならして表示する。 */
    var ti = this._lastTi || this.s.ti;
    var ttot = this.m.rrTotal > 0.5 ? 60 / this.m.rrTotal : 60 / Math.max(1, this.s.rr);
    var ratio = Math.max(0.2, (ttot - ti) / Math.max(0.1, ti));
    this._ieRatio = this._ieRatio == null ? ratio : this._ieRatio + 0.4 * (ratio - this._ieRatio);
    this.m.ie = '1:' + this._ieRatio.toFixed(1);
  };

  /* ポーズは押した瞬間ではなく、次の吸気末（吸気ポーズ）／呼気末（呼気ポーズ）で実行する。
   * 実機と同じで、これを守らないと Pplat も total PEEP も違う時点の圧を測ってしまう。 */
  Engine.prototype.requestHold = function (kind) {
    if (this.hold || this.holdPending) return;
    this.holdPending = kind;
  };

  Engine.prototype._sample = function (dt, sampleWave) {
    this.pawSum += this.paw * dt; this.pawN += dt;
    if (this.pawN > 8) { this.m.pmean = this.pawSum / this.pawN; this.pawSum = 0; this.pawN = 0; }
    if (!sampleWave) return;
    this._wfClock += dt;
    if (this._wfClock >= 0.02) {
      this._wfClock = 0;
      var w = this.waveform;
      w.paw.push(this.paw); w.flow.push(this.flow * 60); w.vol.push((this.V - this.C * this.s.peep) * 1000);
      if (w.paw.length > this.wfCap) { w.paw.shift(); w.flow.shift(); w.vol.shift(); }
    }
  };

  /* ---------- ガス交換・循環 ---------- */
  Engine.prototype._gas = function (dt) {
    this._gasClock += dt;
    if (this._gasClock < 0.25) return;
    var d = this._gasClock; this._gasClock = 0;
    var p = this.p, s = this.s;

    var vco2 = p.vco2 * (1 + 0.13 * (this.temp - 37));
    var vo2 = vco2 / RQ;

    // 死腔と肺胞換気量
    var nm = this.nm;
    var vdAnat = 2.0 * p.pbw / 1000;                        // L（2 mL/kg は小児も同じ）
    var vdCircuit = (p.vdCircuit != null ? p.vdCircuit : nm.vdCircuit) / 1000;  // 回路＋フローセンサ
    var vtL = Math.max(0.0002, this.m.vte / 1000);
    var vdAlv = (p.vdAlvFrac || 0) * vtL;
    var vd = vdAnat + vdCircuit + vdAlv;
    /* 死腔を引いた残りが肺胞換気量。体重で 2 桁変わるので床も体重比にする。 */
    var va = Math.max(0.04 * vtL, vtL - vd) * Math.max(1, this.m.rrTotal);

    // 過膨張は死腔を増やす
    var plat = this.m.pplat != null ? this.m.pplat : (this.V / this.C);
    if (plat > nm.platMax - 2) va *= clamp(1 - (plat - (nm.platMax - 2)) * 0.02, 0.6, 1);

    /* 呼吸が測れるまで（開始直後の数秒）は換気量が 0 に見えるので、ガスを動かさない。 */
    var measured = this.m.rrTotal > 0 || this.clock > 20;

    /* CO2：普段は 3 分ほどの時定数で動く。ただし換気がほとんど無いときの上がり方は
     * 体の CO2 の貯え（速く平衡する分 ≈ 0.33 mL/kg/mmHg）で頭打ちになり、
     * 無呼吸でも 1 分に十数 mmHg までしか上がらない。 */
    var paco2ss = clamp(0.863 * vco2 / va, 8, 160);
    var tau = paco2ss > this.paco2 ? 190 : 130;
    var tauStore = 60 * 0.863 * (CO2_STORE_PER_KG * p.pbw) / va;   // s
    if (!measured) { /* そのまま */ }
    else if (tauStore > tau) this.paco2 = clamp(approach(this.paco2, 0.863 * vco2 / va, d, tauStore), 8, 160);
    else this.paco2 = approach(this.paco2, paco2ss, d, tau);

    // リクルートメント：総 PEEP でシャントが減る
    var peepTot = this.m.peepTot || s.peep;
    var recr = 1 / (1 + Math.exp((peepTot - (p.recruitP || 12)) / (p.recruitK || 3.0)));
    var shunt = (p.shuntMin || 0.05) + ((p.shunt0 || 0.1) - (p.shuntMin || 0.05)) * recr;
    if (plat > nm.platMax) shunt += (plat - nm.platMax) * 0.006;   // 過膨張で悪化
    if (p.prone) shunt *= 0.75;
    if (this.suctionShunt > 0.001) {              // 吸引の陰圧で潰れた肺胞は数分かけて開き直す
      shunt += this.suctionShunt;
      this.suctionShunt *= Math.exp(-d / 50);
    }
    this.shunt = clamp(shunt, 0.02, 0.65);

    // 循環：平均気道内圧で静脈還流が落ちる
    var coTarget = (p.co || 5.0) * clamp(1 - 0.014 * Math.max(0, this.m.pmean - 5), 0.60, 1);
    if (p.volumeDepleted) coTarget *= 0.85;
    coTarget = Math.max(0.35 * (p.co || 5.0), coTarget);
    /* 子どもは一回拍出量をあまり増やせないので、徐脈になると心拍出量はほぼ心拍に比例して落ちる。
     * 低酸素の徐脈から心停止に向かう流れはここから出る。 */
    var brady = Math.pow(clamp(this.hr / nm.hr[0], 0.05, 1), 1.5);
    this.co = approach(this.co, coTarget * brady, d, brady < 1 ? 6 : 25);

    // 酸素化
    /* 肺胞の O2 は CO2 から逆算せず、O2 そのものの出入りで動かす。
     * 入る量 = 肺胞換気量 ×（吸入 − 肺胞）、出る量 = 酸素消費量。貯えは
     * 肺に残っているガス（FRC）と、血液のヘモグロビンが手放せる分。
     * 換気が止まると FRC の O2 は 1 分もたずに使い切られ、CO2 より先に SpO2 が落ちる。
     * 釣り合った状態では肺胞気式 PAO2 = PIO2 − PaCO2 / R と同じ値になる。 */
    var pio2 = s.fio2 * (PB - PH2O);
    if (measured) {
      var pAss = pio2 - 0.863 * vo2 / va;
      var cap = this._o2Capacity();                               // mL/mmHg
      this.pAO2 = clamp(approach(this.pAO2, pAss, d, 60 * 0.863 * cap / va), PA_O2_FLOOR, pio2);
    }
    var ccO2 = o2Content(this.pAO2, p.hb);
    var coFloor = 0.25 * (p.co || 5.0);
    var caO2 = ccO2 - this.shunt * vo2 / ((1 - this.shunt) * 10 * Math.max(coFloor, this.co));
    caO2 = Math.max(2, caO2);
    var pao2Target = po2FromContent(caO2, p.hb);
    this.pao2 = approach(this.pao2, pao2Target, d, 8);           // 肺から動脈までの数秒
    var sat = satFromPO2(this.pao2) * 100;
    this.spo2 = approach(this.spo2, sat, d, 14);

    // 酸塩基：HCO3 は数時間かけて代償する
    var chronic = 24 + 0.38 * (this.paco2 - 40);
    var hco3Target = clamp((p.hco3Base || 24) + (chronic - 24), 6, 45);
    this.hco3 = approach(this.hco3, hco3Target, d, 5400);
    this.ph = 6.1 + Math.log10(Math.max(2, this.hco3) / (0.03 * Math.max(8, this.paco2)));
    this.be = this.hco3 - 24.4 + 14.8 * (this.ph - 7.4);
    /* etCO2 は吐き終わりのガス。一回換気量が気道＋回路の死腔（センサーより患者側）に近いと、
     * 肺胞のガスがセンサーまで届かず低く出る（Vt が死腔の 1.6 倍あればほぼ肺胞の値）。
     * 肺に届く血流が落ちても CO2 が運ばれず低くなる（心拍出量が普段の半分を切ったところから）。 */
    var etAlv = Math.max(0, this.paco2 - 3 - (p.vdAlvFrac || 0) * 25);
    var reach = smoothstep(0.5, 1.6, vtL / Math.max(0.0001, vdAnat + vdCircuit));
    var perf = clamp(this.co / (0.5 * (p.co || 5.0)), 0, 1);
    if (measured) this.etco2 = approach(this.etco2, etAlv * reach * perf, d, 8);

    // 心拍・血圧
    var hrScale = nm.hr[1] / 100;
    var hrTarget = (p.hr || 85)
      + clamp((nm.spo2[0] - this.spo2) * 1.8 * hrScale, 0, 35 * hrScale)
      + clamp((this.paco2 - 40) * 0.5 * hrScale, -8 * hrScale, 22 * hrScale)
      + clamp((7.35 - this.ph) * 60 * hrScale, 0, 25 * hrScale)
      + 22 * hrScale * (this.muscleLoad > 0.6 ? this.muscleLoad - 0.6 : 0) * 2;
    /* 重い低酸素では、はじめの頻脈のあとに徐脈になり、放っておけば心停止に向かう。
     * 小児は成人より早く徐脈になり、若いほどその閾値が高い（新生児は SpO2 78% から）。 */
    var bradySpo2 = nm.label === '新生児' ? 78 : (nm.label === '乳児' ? 72 : 65);
    var bradySlope = nm.label === '新生児' ? 3.2 : 3.6 * hrScale;
    if (this.spo2 < bradySpo2) hrTarget -= (bradySpo2 - this.spo2) * bradySlope;
    this.hr = approach(this.hr, clamp(hrTarget, nm.hr[0] * 0.2, nm.hr[1] * 1.45), d, 12);
    var mapTarget = clamp((p.map || 80) * (this.co / (p.co || 5)) * (this.ph < 7.2 ? 0.88 : 1),
      nm.mapMin * 0.25, nm.mapMin * 2.2);
    this.map = approach(this.map, mapTarget, d, 15);

    this._recomputeDrive();
    this._updateFatigue(d);
    this._scoreTick(d);
    this._alarmCheck();
  };

  /* 肺胞 PO2 が 1 mmHg 下がるあいだに体が使える O2 の量（mL/mmHg）。
   * 肺のガス（FRC + PEEP で広げた分。潰れた肺胞＝シャントの分は O2 を持たない）と、
   * 血液（75 mL/kg）。血液は酸素解離曲線の傾きの分だけ効くので、平坦部ではほとんど
   * 役に立たず、SpO2 が 90% を切るあたりから下がり方を緩める。 */
  Engine.prototype._o2Capacity = function () {
    var p = this.p;
    var lungL = FRC_PER_KG * p.pbw / 1000 * (1 - this.shunt) + Math.max(0, this.vEE);
    var gas = lungL * 1000 / (PB - PH2O);
    var pa = this.pAO2, h = 1;
    var slope = (o2Content(pa + h, p.hb) - o2Content(Math.max(0, pa - h), p.hb)) / (2 * h);  // mL/dL/mmHg
    var blood = BLOOD_PER_KG * p.pbw / 1000 * 10 * slope * (1 - this.shunt);
    return gas + blood;
  };

  /* ---------- 目標達成と有害事象の集計 ---------- */
  Engine.prototype._scoreTick = function (d) {
    var g = this.p.goals || {};
    var ok = true;
    if (g.ph && (this.ph < g.ph[0] || this.ph > g.ph[1])) ok = false;
    if (g.paco2 && (this.paco2 < g.paco2[0] || this.paco2 > g.paco2[1])) ok = false;
    if (g.pao2 && (this.pao2 < g.pao2[0] || this.pao2 > g.pao2[1])) ok = false;
    this.inTarget = ok;
    this.timeInTarget.total += d;
    if (ok) this.timeInTarget.ok += d;

    var nm = this.nm;
    var plat = this.m.pplat != null ? this.m.pplat : this.V / this.C;
    if (plat > nm.platMax) this.harm.highPlat += d;
    if (this.m.vte / this.p.pbw > nm.vtPerKg[1] + 1.5) this.harm.highVt += d;
    if (this.m.autoPeep > 3) this.harm.autoPeep += d;
    if (this.spo2 < nm.spo2[0] - 3) this.harm.hypoxia += d;
    if (this.map < nm.mapMin) this.harm.hypotension += d;
    if (this.s.fio2 > 0.6) this.harm.highFio2 += d;
  };

  Engine.prototype._raise = function (msg) {
    var last = this.events[this.events.length - 1];
    if (last && last.msg === msg && this.clock - last.t < 30) return;
    this.events.push({ t: this.clock, msg: msg });
    if (this.events.length > 60) this.events.shift();
  };

  Engine.prototype._alarmCheck = function () {
    var a = [], s = this.s, m = this.m;
    if (m.pip > s.alarms.pMax) a.push({ k: 'pip', msg: '気道内圧上限', sev: 2 });
    if (m.vte < s.alarms.vtLow && this.clock > 20) a.push({ k: 'vt', msg: '一回換気量 低下', sev: 2 });
    if (m.vte > s.alarms.vtHigh) a.push({ k: 'vth', msg: '一回換気量 過大', sev: 1 });
    if (m.mv < s.alarms.mvLow && this.clock > 30) a.push({ k: 'mv', msg: '分時換気量 低下', sev: 2 });
    if (m.mv > s.alarms.mvHigh) a.push({ k: 'mvh', msg: '分時換気量 過大', sev: 1 });
    if (m.rrTotal > s.alarms.rrHigh) a.push({ k: 'rr', msg: '頻呼吸', sev: 1 });
    if (this.spo2 < this.nm.spo2[0]) a.push({ k: 'spo2', msg: 'SpO2 低下', sev: 2 });
    if (m.autoPeep > 5) a.push({ k: 'ap', msg: 'auto-PEEP', sev: 1 });
    if (this.map < this.nm.mapMin) a.push({ k: 'map', msg: '血圧低下', sev: 2 });
    if (this.hr < this.nm.hr[0] * 0.8) a.push({ k: 'hr', msg: '徐脈', sev: 2 });
    this.alarms = a;
  };

  /* ---------- 気管吸引 ----------
   * 吸引のあいだは換気が止まり、陰圧で肺胞が潰れる。SpO₂ はその場で数 % 落ち、
   * 潰れた肺胞が開き直すまでの数分はシャントが増える。痰が取れたぶん抵抗は下がる。 */
  Engine.prototype.suction = function () {
    this.suctionShunt = 0.15;
    var drop = this.s.fio2 >= 0.99 ? 4 : 7;       // 先に 100% で貯金していれば落ち込みは小さい
    this.spo2 = Math.max(40, this.spo2 - drop);
    this.pao2 = Math.min(this.pao2, po2FromSat(this.spo2 / 100));
    this.pAO2 = Math.min(this.pAO2, this.pao2);       // 吸い出されたぶん肺胞の O2 も減っている
    this.p.Rinsp = Math.max(4, this.p.Rinsp * 0.88);
    this.p.Rexp = Math.max(5, this.p.Rexp * 0.90);
    this._raise('気管吸引を実施');
  };

  /* ---------- 血液ガス採取 ---------- */
  Engine.prototype.sampleABG = function () {
    var j = function (v, n) { return Math.round(v * Math.pow(10, n)) / Math.pow(10, n); };
    return {
      t: this.clock,
      ph: j(this.ph + (Math.random() - 0.5) * 0.008, 2),
      paco2: j(this.paco2 + (Math.random() - 0.5) * 1.2, 1),
      pao2: j(this.pao2 + (Math.random() - 0.5) * 3, 0),
      hco3: j(this.hco3, 1),
      be: j(this.be, 1),
      sao2: j(satFromPO2(this.pao2) * 100, 1),
      lactate: j(clamp(1.0 + (this.map < this.nm.mapMin ? (this.nm.mapMin - this.map) * 0.06 : 0)
        + (this.spo2 < this.nm.spo2[0] - 6 ? 1.5 : 0), 0.4, 9), 1),
      fio2: this.s.fio2,
      peep: this.s.peep,
      pf: j(this.pao2 / this.s.fio2, 0)
    };
  };

  Engine.prototype.snapshot = function () {
    return {
      clock: this.clock, paw: this.paw, flow: this.flow, vol: this.V,
      paco2: this.paco2, pao2: this.pao2, ph: this.ph, hco3: this.hco3,
      spo2: this.spo2, hr: this.hr, map: this.map, etco2: this.etco2,
      shunt: this.shunt, co: this.co, fatigue: this.fatigue,
      m: this.m, alarms: this.alarms, pmusAmp: this.pmusAmp,
      rrNeural: 60 / this.neuralTtot, sedation: this.sedation
    };
  };

  var api = {
    Engine: Engine,
    defaultSettings: defaultSettings,
    predictedBodyWeight: predictedBodyWeight,
    ageNorms: ageNorms,
    normsFor: normsFor,
    limitsFor: limitsFor,
    alarmsFor: alarmsFor,
    satFromPO2: satFromPO2,
    po2FromSat: po2FromSat,
    o2Content: o2Content,
    clamp: clamp
  };
  root.VentEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
