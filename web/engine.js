/* VentSim — 呼吸生理エンジン
 * 単一コンパートメント肺モデル + 簡易ガス交換 + 循環連成 + 呼吸ドライブ。
 * 単位: 容量 L / 圧 cmH2O / 流量 L·s^-1 / 時間 s。UI 境界で mL・L/min に変換する。
 * 運動方程式:  Paw + Pmus = V/C + R·V̇
 */
(function (root) {
  'use strict';

  var PB = 760, PH2O = 47, RQ = 0.8;

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
    this.co = p.co || 5.0;
    this.hr = p.hr || 88;
    this.map = p.map || 80;
    this.shunt = p.shunt0;
    this.etco2 = 38;
    this.temp = p.temp || 37.0;

    // 計測値
    this.m = {
      pip: 0, pplat: null, pmean: s.peep, peepTot: s.peep,
      vte: 0, vti: 0, mv: 0, rrTotal: 0, rrSpont: 0,
      cstat: null, raw: null, dp: null, ie: '1:2', rsbi: null, autoPeep: 0
    };
    this.breaths = [];              // {t, vte, spont}
    this.waveform = { paw: [], flow: [], vol: [], n: 0 };
    this.wfCap = 1500;
    this.alarms = [];
    this.lastTrigger = null;        // 'patient' | 'timer' | 'backup'
    this.apneaT = 0;
    this.events = [];
    this.extubated = false;
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

  Engine.prototype._updateFatigue = function (dt) {
    var load = this.muscleLoad || 0;
    if (load > 0.62) this.fatigue += (load - 0.62) * dt / 95;
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
        this.V += dV;
        this.vtInsp += dV;
        this.paw = this.V / this.C + p.Rinsp * q - this.pmus;
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
      if (this.phaseT >= s.pause) { this._recomputeMechanics(); this._endInsp(); }
    }
    /* --------- 呼気相 --------- */
    else {
      this.paw = s.peep;
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
          this._startBreath(inWindow ? 'mand' : 'spont', 'patient');
        } else this._startBreath('mand', 'patient');   // A/C：全部強制換気
      } else if (!spontMode && this.sinceMand >= mandInterval && this.phaseT > this.nm.trigLock * 1.2) {
        this._startBreath('mand', 'timer');
      } else if (spontMode && this.sinceBreath > s.alarms.apnea) {
        this._raise('無呼吸：バックアップ換気');
        this._startBreath('mand', 'backup');
      }
    }

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
    this.vEE = this.V;
    this.m.peepTot = Math.max(s.peep, this.V / this.C);
    this.m.autoPeep = Math.max(0, this.V / this.C - s.peep);
    this.m._ttot = this._prevInspStart != null ? (this.clock - this._prevInspStart) : 0;
    this._prevInspStart = this.clock;
    this.phase = 'insp'; this.phaseT = 0;
    this.breathType = type;
    this.lastTrigger = trig;
    this.vtInsp = 0;
    this.pipThis = 0;
    this.peakFlowThisBreath = 0;
    this.sinceBreath = 0;
    if (type === 'mand' || trig === 'patient') this.sinceMand = 0;
    if (type === 'mand' && trig !== 'patient') this.sinceMand = 0;
    this._lastBreathSpont = (type === 'spont');
    this._lastBreathTrig = trig;
  };

  Engine.prototype._endInsp = function () {
    this._lastTi = this.phaseT;
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
      var dp = this.m.pplat - this.m.peepTot;
      this.m.dp = dp;
      this.m.cstat = dp > 0.5 ? (vt * 1000) / dp : null;
      var peak = this.m.pip;
      var qEnd = this.s.flow / 60;
      if (this.s.mode === 'VC-AC' || this.s.mode === 'SIMV-VC') {
        var raw = qEnd > 0.004 ? (peak - this.m.pplat) / qEnd : null;
        this.m.raw = (raw != null && raw >= 0) ? raw : null;
      }
    }
  };

  Engine.prototype._recomputeRates = function () {
    var win = 60, now = this.clock, n = 0, ns = 0, vteSum = 0, vtSpontSum = 0;
    for (var i = this.breaths.length - 1; i >= 0; i--) {
      var b = this.breaths[i];
      if (now - b.t > win) break;
      n++; vteSum += b.vte;
      if (b.spont) { ns++; vtSpontSum += b.vte; }
    }
    var span = Math.min(win, Math.max(5, now));
    this.m.rrTotal = n * 60 / span;
    this.m.rrSpont = ns * 60 / span;
    this.m.mv = vteSum / 1000 * 60 / span;
    /* 成人の RSBI（f/VT[L] < 105）は小児では常に桁外れになる。
     * 小児では f ÷ (一回換気量 mL/kg) で見て、8 未満を目安にする。 */
    var vtMean = null;
    if (ns >= 2) vtMean = vtSpontSum / ns;
    else if (this.m.rrSpont > 0 && this.m.vte > 0) vtMean = this.m.vte;
    if (vtMean != null && vtMean > 0.2) {
      var fSpont = Math.max(this.m.rrSpont, 1);
      this.m.rsbi = Math.min(3000, fSpont / (vtMean / 1000));
      this.m.rsbiKg = Math.min(60, fSpont / (vtMean / this.p.pbw));
    } else if (this.m.rrSpont > 0) {
      this.m.rsbi = 3000; this.m.rsbiKg = 60;
    }
    var ti = this._lastTi || this.s.ti;
    var ttot = this.m._ttot > 0.3 ? this.m._ttot : 60 / Math.max(1, this.s.rr);
    var ratio = Math.max(0.2, (ttot - ti) / Math.max(0.1, ti));
    this.m.ie = '1:' + ratio.toFixed(1);
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

    var paco2ss = clamp(0.863 * vco2 / va, 8, 160);
    var tau = paco2ss > this.paco2 ? 190 : 130;
    this.paco2 = approach(this.paco2, paco2ss, d, tau);

    // リクルートメント：総 PEEP でシャントが減る
    var peepTot = this.m.peepTot || s.peep;
    var recr = 1 / (1 + Math.exp((peepTot - (p.recruitP || 12)) / (p.recruitK || 3.0)));
    var shunt = (p.shuntMin || 0.05) + ((p.shunt0 || 0.1) - (p.shuntMin || 0.05)) * recr;
    if (plat > nm.platMax) shunt += (plat - nm.platMax) * 0.006;   // 過膨張で悪化
    if (p.prone) shunt *= 0.75;
    this.shunt = clamp(shunt, 0.02, 0.65);

    // 循環：平均気道内圧で静脈還流が落ちる
    var coTarget = (p.co || 5.0) * clamp(1 - 0.014 * Math.max(0, this.m.pmean - 5), 0.60, 1);
    if (p.volumeDepleted) coTarget *= 0.85;
    this.co = approach(this.co, Math.max(0.35 * (p.co || 5.0), coTarget), d, 25);

    // 酸素化
    var pao2Alv = s.fio2 * (PB - PH2O) - this.paco2 / RQ;
    var ccO2 = o2Content(Math.max(20, pao2Alv), p.hb);
    var coFloor = 0.25 * (p.co || 5.0);
    var caO2 = ccO2 - this.shunt * vo2 / ((1 - this.shunt) * 10 * Math.max(coFloor, this.co));
    caO2 = Math.max(2, caO2);
    var pao2Target = po2FromContent(caO2, p.hb);
    this.pao2 = approach(this.pao2, pao2Target, d, 42);
    var sat = satFromPO2(this.pao2) * 100;
    this.spo2 = approach(this.spo2, sat, d, 14);

    // 酸塩基：HCO3 は数時間かけて代償する
    var chronic = 24 + 0.38 * (this.paco2 - 40);
    var hco3Target = clamp((p.hco3Base || 24) + (chronic - 24), 6, 45);
    this.hco3 = approach(this.hco3, hco3Target, d, 5400);
    this.ph = 6.1 + Math.log10(Math.max(2, this.hco3) / (0.03 * Math.max(8, this.paco2)));
    this.be = this.hco3 - 24.4 + 14.8 * (this.ph - 7.4);
    this.etco2 = approach(this.etco2, this.paco2 - 3 - (p.vdAlvFrac || 0) * 25, d, 8);

    // 心拍・血圧
    var hrScale = nm.hr[1] / 100;
    var hrTarget = (p.hr || 85)
      + clamp((nm.spo2[0] - this.spo2) * 1.8 * hrScale, 0, 35 * hrScale)
      + clamp((this.paco2 - 40) * 0.5 * hrScale, -8 * hrScale, 22 * hrScale)
      + clamp((7.35 - this.ph) * 60 * hrScale, 0, 25 * hrScale)
      + 22 * hrScale * (this.muscleLoad > 0.6 ? this.muscleLoad - 0.6 : 0) * 2;
    /* 新生児・乳児は重い低酸素で頻脈ではなく徐脈になる。 */
    if (nm.label === '新生児' && this.spo2 < 78) hrTarget -= (78 - this.spo2) * 3.2;
    this.hr = approach(this.hr, clamp(hrTarget, nm.hr[0] * 0.75, nm.hr[1] * 1.45), d, 12);
    var mapTarget = clamp((p.map || 80) * (this.co / (p.co || 5)) * (this.ph < 7.2 ? 0.88 : 1),
      nm.mapMin * 0.5, nm.mapMin * 2.2);
    this.map = approach(this.map, mapTarget, d, 15);

    this._recomputeDrive();
    this._updateFatigue(d);
    this._scoreTick(d);
    this._alarmCheck();
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
    this.alarms = a;
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
