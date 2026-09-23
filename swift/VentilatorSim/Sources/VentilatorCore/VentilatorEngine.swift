import Foundation

/// 単一コンパートメント肺モデルと簡易ガス交換を固定ステップで解くシミュレーションエンジン。
///
/// 運動方程式:  `Paw + Pmus = V/C + R·V̇`
/// 換気モードはこの肺に圧または流量を与える制御則として実装してあるので、
/// auto-PEEP・非同調・SBT 中の rapid shallow breathing は個別に作り込まなくても出てくる。
///
/// 単位は L / cmH2O / L·s⁻¹ / 秒。mL や L/min への変換は UI 側で行う。
public final class VentilatorEngine {

    public enum Phase: Sendable { case inspiration, pause, expiration }
    public enum TriggerSource: Sendable { case patient, timer, backup }
    public enum HoldKind: Sendable { case inspiratory, expiratory }

    public struct Alarm: Equatable, Sendable {
        public let message: String
        public let severity: Int      // 1 = 注意, 2 = 危険
    }

    public struct HarmTotals: Sendable {
        public var highPlateau: Double = 0
        public var highTidalVolume: Double = 0
        public var autoPEEP: Double = 0
        public var hypoxia: Double = 0
        public var hypotension: Double = 0
        public var highFiO2: Double = 0
    }

    struct BreathRecord {
        let time: Double; let volume: Double; let spontaneous: Bool; let trigger: TriggerSource
    }

    // MARK: - 公開状態

    public private(set) var patient: Patient
    public var settings: VentilatorSettings
    public private(set) var measured = MeasuredValues()

    public private(set) var clock: Double = 0          // シミュレーション内の経過秒
    public private(set) var airwayPressure: Double = 0  // cmH2O
    public private(set) var flow: Double = 0            // L/s（吸気が正）
    public private(set) var volume: Double = 0          // 弛緩位からの容量 L
    public private(set) var musclePressure: Double = 0  // cmH2O

    public private(set) var paco2: Double = 40
    public private(set) var pao2: Double = 80
    /// 肺胞の PO2（mmHg）。CO2 から逆算せず、O2 の出入りで動かす状態量。
    public private(set) var alveolarPO2: Double = 100
    public private(set) var hco3: Double = 24
    public private(set) var pH: Double = 7.4
    public private(set) var baseExcess: Double = 0
    public private(set) var spo2: Double = 98
    public private(set) var etco2: Double = 38
    public private(set) var heartRate: Double = 80
    public private(set) var meanArterialPressure: Double = 80
    public private(set) var cardiacOutput: Double = 5
    public private(set) var shunt: Double = 0.05
    public private(set) var fatigue: Double = 0          // 呼吸筋疲労 0...1

    /// 鎮静深度。0 が覚醒、1 で無呼吸。
    public var sedation: Double {
        didSet { recomputeDrive() }
    }

    public private(set) var phase: Phase = .expiration
    public private(set) var lastTrigger: TriggerSource = .timer
    public private(set) var alarms: [Alarm] = []
    public private(set) var harm = HarmTotals()
    public private(set) var timeInTarget: (inTarget: Double, total: Double) = (0, 0)
    public private(set) var isInTarget = true

    // MARK: - 内部状態

    private var compliance: Double { patient.compliance }
    /// 年齢相応の基準値。正常域も上限も年齢で決まる。
    public private(set) var norms: AgeNorms
    /// つまみの可動域。体重から作る。
    public private(set) var limits: DialLimits
    private var tidalGain: Double = 1          // 自発呼吸の努力の補正係数
    private var lastSpontaneousTidal: Double = 0   // L
    private var phaseTime: Double = 0
    private var sinceMandatory: Double = 0
    private var sinceBreath: Double = 0
    private var breathType: BreathType = .mandatory
    private var inspiredVolume: Double = 0
    private var peakFlowThisBreath: Double = 0
    private var peakPressureThisBreath: Double = 0
    private var volumeEndExp: Double = 0
    private var volumeEndInsp: Double = 0
    private var previousInspStart: Double?
    private var inspirationStart: Double?
    private var lastInspiratoryTime: Double = 1
    /// I:E の表示は数呼吸でならす（患者トリガで間隔が揺れるため）。
    private var smoothedIERatio: Double?
    /// 量規定の最後の送気流量（L/s）と、吸気終末の気道内圧。Raw の計算に使う。
    private var lastVolumeControlFlow: Double?
    private var endInspiratoryPressure: Double?
    /// 1 呼吸の最大吸気流量・最大呼気流量（L/s、呼気は負）。
    private var peakInspFlowThisBreath: Double = 0
    private var peakExpFlowThisBreath: Double = 0
    /// 吸引の陰圧で潰れた肺胞の分のシャント。数分かけて開き直す。
    private var suctionShunt: Double = 0
    private var hold: (kind: HoldKind, elapsed: Double)?
    private var pendingHold: HoldKind?

    /// 実行中のポーズ。画面でキーを点灯させるために読む。
    public var activeHold: HoldKind? { hold?.kind }
    /// 次の吸気末／呼気末に実行されるのを待っているポーズ。
    public var awaitingHold: HoldKind? { pendingHold }
    private var lastBreathWasSpontaneous = false
    private var lastBreathTrigger: TriggerSource = .timer

    private var neuralTime: Double = 0
    private var neuralCycle: Double = 60 / 14
    private var neuralInspTime: Double = 1.1
    private var muscleAmplitude: Double = 0
    private var muscleLoad: Double = 0
    private var effortActive = false

    private var pressureSum: Double = 0
    private var pressureSeconds: Double = 0
    private var gasAccumulator: Double = 0
    private var breaths: [BreathRecord] = []

    private enum BreathType { case mandatory, spontaneous }

    // MARK: - 初期化

    public init(patient: Patient, settings: VentilatorSettings) {
        self.patient = patient
        self.settings = settings
        self.sedation = patient.sedation
        self.norms = Physiology.norms(for: patient)
        self.limits = Physiology.dialLimits(weightKg: patient.predictedBodyWeight,
                                            norms: Physiology.norms(for: patient))
        reset()
    }

    public func reset() {
        norms = Physiology.norms(for: patient)
        limits = Physiology.dialLimits(weightKg: patient.predictedBodyWeight, norms: norms)
        tidalGain = 1
        lastSpontaneousTidal = 0
        clock = 0
        volume = compliance * settings.peep
        airwayPressure = settings.peep
        flow = 0
        phase = .expiration
        phaseTime = 0
        sinceMandatory = 0
        sinceBreath = 0
        volumeEndExp = volume
        volumeEndInsp = volume
        paco2 = patient.paco2
        pao2 = patient.pao2
        hco3 = patient.hco3
        pH = Physiology.pH(hco3: hco3, paco2: paco2)
        spo2 = Physiology.saturation(po2: pao2) * 100
        alveolarPO2 = max(Self.alveolarO2Floor,
                          Physiology.alveolarPO2(fio2: settings.fio2, paco2: paco2))
        heartRate = patient.heartRate
        meanArterialPressure = patient.meanArterialPressure
        cardiacOutput = patient.cardiacOutput
        shunt = patient.shuntAtLowPEEP
        hold = nil
        pendingHold = nil
        previousInspStart = nil
        inspirationStart = nil
        smoothedIERatio = nil
        lastVolumeControlFlow = nil
        endInspiratoryPressure = nil
        peakInspFlowThisBreath = 0
        peakExpFlowThisBreath = 0
        suctionShunt = 0
        measured = MeasuredValues()
        measured.totalPEEP = settings.peep
        measured.meanAirwayPressure = settings.peep
        breaths.removeAll()
        recomputeDrive()
    }

    // MARK: - 手技

    /// 吸気ポーズ（プラトー圧）／呼気ポーズ（総 PEEP と auto-PEEP）。
    /// 実機と同じく、押した瞬間ではなく次の吸気末／呼気末で実行する。
    /// 途中で止めるとプラトー圧も総 PEEP も別の時点の圧を測ってしまう。
    public func requestHold(_ kind: HoldKind) {
        guard hold == nil, pendingHold == nil else { return }
        pendingHold = kind
    }

    /// 気道抵抗の現在値。レッスンが痰づまりを起こすときなどに、元の値を控えておくために使う。
    public var airwayResistance: (inspiratory: Double, expiratory: Double) {
        (patient.resistanceInsp, patient.resistanceExp)
    }

    /// 気道抵抗を差し替える。痰の貯留や吸引など、肺そのもの以外の理由で通りにくさが変わる場面用。
    public func setAirwayResistance(inspiratory: Double, expiratory: Double) {
        patient.resistanceInsp = max(1, inspiratory)
        patient.resistanceExp = max(1, expiratory)
    }

    /// 気管吸引。吸引のあいだは換気が止まり、陰圧で肺胞が潰れる。SpO₂ はその場で数 % 落ち、
    /// 潰れた肺胞が開き直すまでの数分はシャントが増える。痰が取れたぶん抵抗は下がる。
    public func suction() {
        suctionShunt = 0.15
        let drop = settings.fio2 >= 0.99 ? 4.0 : 7.0      // 先に 100% で貯金していれば落ち込みは小さい
        spo2 = max(40, spo2 - drop)
        pao2 = min(pao2, Physiology.po2(fromSaturation: spo2 / 100))
        alveolarPO2 = min(alveolarPO2, pao2)     // 吸い出されたぶん肺胞の O2 も減っている
        patient.resistanceInsp = max(4, patient.resistanceInsp * 0.88)
        patient.resistanceExp = max(5, patient.resistanceExp * 0.90)
    }

    /// 呼吸筋の努力の大きさ（cmH2O）。離脱の条件「自発呼吸がある」の判定に使う。
    public var inspiratoryEffortAmplitude: Double { muscleAmplitude }

    public func drawBloodGas() -> BloodGas {
        let jitter = { (scale: Double) in (Double.random(in: 0...1) - 0.5) * scale }
        let lactate = Physiology.clamp(
            1.0 + (meanArterialPressure < norms.meanArterialPressureMin
                   ? (norms.meanArterialPressureMin - meanArterialPressure) * 0.06 : 0)
                + (spo2 < 85 ? 1.5 : 0), 0.4, 9)
        return BloodGas(time: clock,
                        pH: (pH + jitter(0.008)),
                        paco2: paco2 + jitter(1.2),
                        pao2: pao2 + jitter(3),
                        hco3: hco3,
                        baseExcess: baseExcess,
                        sao2: Physiology.saturation(po2: pao2) * 100,
                        lactate: lactate,
                        fio2: settings.fio2,
                        peep: settings.peep)
    }

    // MARK: - 1 ステップ

    /// 換気を始めた直後は PIP や Vte がまだ 0 のまま。数呼吸ぶん先に進めて、
    /// 最初の 1 コマから実測のそろった画面を見せる（セリフに 0 が差し込まれるのも防ぐ）。
    public func settle() {
        let dt = 0.005
        var elapsed = 0.0
        while breaths.count < 2 && elapsed < 12 {
            step(dt: dt)
            elapsed += dt
        }
    }

    /// `dt` 秒だけ進める。指数積分を使っているので 5 ms でも 12 ms でも結果はほぼ変わらない。
    public func step(dt: Double) {
        clock += dt
        phaseTime += dt
        sinceMandatory += dt
        sinceBreath += dt

        updateMuscleEffort(dt: dt)

        if hold != nil {
            stepHold(dt: dt)
            updateGasExchange(dt: dt)
            return
        }

        switch phase {
        case .inspiration: stepInspiration(dt: dt)
        case .pause:       stepPause(dt: dt)
        case .expiration:  stepExpiration(dt: dt)
        }

        // 1 呼吸の最大吸気流量・最大呼気流量（波形の目盛りを体重に合わせるのに使う）
        if phase == .inspiration {
            if flow > peakInspFlowThisBreath { peakInspFlowThisBreath = flow }
        } else if flow < peakExpFlowThisBreath {
            peakExpFlowThisBreath = flow
        }

        pressureSum += airwayPressure * dt
        pressureSeconds += dt
        if pressureSeconds > 8 {
            measured.meanAirwayPressure = pressureSum / pressureSeconds
            pressureSum = 0
            pressureSeconds = 0
        }
        updateGasExchange(dt: dt)
    }

    // MARK: - 自発呼吸努力

    private func updateMuscleEffort(dt: Double) {
        neuralTime += dt
        if neuralTime >= neuralCycle {
            neuralTime = 0
            effortActive = true
        }
        if effortActive, neuralTime <= neuralInspTime, muscleAmplitude > 0 {
            let x = neuralTime / neuralInspTime
            musclePressure = muscleAmplitude * sin(.pi * pow(x, 0.78))
        } else {
            musclePressure = 0
            if neuralTime > neuralInspTime { effortActive = false }
        }
    }

    private func recomputeDrive() {
        let w = patient.predictedBodyWeight
        let vco2 = patient.vco2 * (1 + 0.13 * (patient.temperature - 37))
        /* 安静時分時換気量は「必要な肺胞換気量 ÷ (1 − 死腔率)」から出す。
         * 成人の 0.1 L/kg/分という係数では、体重 1 kg の早産児で 2 桁ずれる。 */
        let deadFraction = Physiology.clamp(
            (2.0 * w + patient.circuitDeadSpace) / Swift.max(1, w * 7), 0.15, 0.7)
        let restingVE = (0.863 * vco2 / patient.co2Setpoint) / (1 - deadFraction)
        var drive = 1 + 0.11 * (paco2 - patient.co2Setpoint)
        if pao2 < 60 { drive += (60 - pao2) * 0.022 }
        let currentPH = Physiology.pH(hco3: hco3, paco2: paco2)
        if currentPH < 7.30 { drive += (7.30 - currentPH) * 3.0 }
        drive = Physiology.clamp(drive * patient.driveGain, 0, 6)

        let awake = Physiology.clamp(1 - sedation, 0, 1)
        let demand = restingVE * drive * awake

        guard awake >= 0.06, demand >= 0.08 * restingVE else {   // 深鎮静・筋弛緩 → 無呼吸
            muscleAmplitude = 0
            muscleLoad = 0
            neuralCycle = 99
            return
        }

        let baseRate = (norms.respiratoryRate.lowerBound + norms.respiratoryRate.upperBound) / 2
        let demandRatio = demand / Swift.max(1e-6, restingVE)
        let rate = Physiology.clamp(baseRate * (0.55 + 0.45 * demandRatio) + baseRate * fatigue,
                                    norms.respiratoryRate.lowerBound * 0.7, norms.respiratoryRateMax)
        neuralCycle = 60 / rate
        neuralInspTime = Physiology.clamp(0.62 * neuralCycle, norms.inspiratoryTimeMin, 1.3)

        let targetTidal = demand / rate                        // L
        /* 実際に出た一回換気量を見て、努力の大きさを少しずつ合わせ込む。
         * 開ループの係数だけだと、吸気時間の短い小児で必要な換気量に届かない。 */
        if lastSpontaneousTidal > 0, targetTidal > 0 {
            let err = Physiology.clamp(targetTidal / lastSpontaneousTidal, 0.25, 4)
            tidalGain = Physiology.clamp(tidalGain * (1 + 0.08 * (err - 1)), 0.5, 4)
        }
        let needed = (targetTidal / compliance) * 0.62 * tidalGain
        /* 呼吸筋の余力。鎮静は「出せる力」を減らすが、疲労の分母にはしない。
         * 分母に鎮静を入れると、深く鎮静した患者ほど全力で呼吸していることになってしまう。 */
        let capacity = patient.maxInspiratoryPressure * (1 - 0.55 * fatigue)
        let ceiling = capacity * awake
        muscleAmplitude = Physiology.clamp(needed, 0, ceiling)
        /* 呼吸仕事量は年齢相応の呼吸数で正規化する。16 /分は成人の値で、
         * そのままでは乳児の呼吸数だけで負荷が 3 倍に見えてしまう。 */
        muscleLoad = capacity > 0
            ? (muscleAmplitude / capacity) * Physiology.clamp(rate / baseRate, 0, 2.2)
            : 0
    }

    /// 疲れはじめる負荷と疲れる速さは症例で変えられる。
    private func updateFatigue(dt: Double) {
        var load = muscleLoad
        // A/C では送気の大半を機械が担うので、呼吸筋は休んでいる。SIMV はその中間。
        switch settings.mode {
        case .volumeAssistControl, .pressureAssistControl: load *= 0.4
        case .simvVolume: load *= 0.7
        default: break
        }
        let threshold = patient.fatigueLoad ?? 0.62
        let tau = patient.fatigueTau ?? 95
        if load > threshold {
            fatigue += (load - threshold) * dt / tau
        } else {
            fatigue -= dt / 420
        }
        fatigue = Physiology.clamp(fatigue, 0, 1)
    }

    // MARK: - 相ごとの処理

    private func stepHold(dt: Double) {
        guard var h = hold else { return }
        h.elapsed += dt
        hold = h
        flow = 0
        airwayPressure = volume / compliance - musclePressure * 0.35
        switch h.kind {
        case .expiratory:
            measured.totalPEEP = volume / compliance
        case .inspiratory:
            measured.plateauPressure = volume / compliance
        }
        if h.elapsed > 2.2 {
            /* ポーズのあいだは次の呼吸の時計を止めておく。止めないと、ポーズ明けの呼気が
             * 短く切られて吐ききれず、見かけの auto-PEEP が赤く出る。 */
            sinceMandatory = max(0, sinceMandatory - h.elapsed)
            if h.kind == .expiratory {
                measured.autoPEEP = max(0, measured.totalPEEP - settings.peep)
            } else {
                recomputeMechanics()
            }
            hold = nil
            phase = .expiration
            phaseTime = 0
        }
    }

    private func stepInspiration(dt: Double) {
        if breathType == .mandatory, settings.mode.isVolumeTargeted {
            // 量規定：流量を指令し、圧が従う
            let setFlow = settings.inspiratoryFlow / 60
            var q = setFlow
            if settings.flowPattern == .decelerating {
                let progress = Physiology.clamp(inspiredVolume / (settings.tidalVolume / 1000), 0, 1)
                q = setFlow * (1 - 0.5 * progress)
            }
            /* 早産児では 1 刻みで運ぶ量が一回換気量の数 % になるので、行き過ぎないよう切る。 */
            let targetVolume = settings.tidalVolume / 1000
            var dV = q * dt
            if inspiredVolume + dV > targetVolume { dV = max(0, targetVolume - inspiredVolume) }
            flow = q
            lastVolumeControlFlow = q
            volume += dV
            inspiredVolume += dV
            airwayPressure = volume / compliance + patient.resistanceInsp * q - musclePressure
            endInspiratoryPressure = airwayPressure

            if inspiredVolume >= targetVolume - 1e-9 {
                if settings.inspiratoryPause > 0 { beginPause() } else { endInspiration() }
            } else if airwayPressure > settings.alarms.peakPressure + 10 {
                endInspiration()                      // 圧リミット
            }
        } else {
            // 圧規定（PC / PS / SIMV の自発）
            let setPressure = breathType == .mandatory ? settings.inspiratoryPressure : settings.pressureSupport
            let rise = Physiology.clamp(phaseTime / max(0.02, settings.riseTime), 0, 1)
            let target = settings.peep + setPressure * rise
            airwayPressure = target

            let tau = patient.resistanceInsp * compliance
            let equilibrium = compliance * (target + musclePressure)
            let newVolume = equilibrium + (volume - equilibrium) * exp(-dt / tau)
            flow = (newVolume - volume) / dt
            inspiredVolume += newVolume - volume
            volume = newVolume
            peakFlowThisBreath = max(peakFlowThisBreath, flow)

            if breathType == .mandatory {
                if phaseTime >= settings.inspiratoryTime {
                    if settings.inspiratoryPause > 0 { beginPause() } else { endInspiration() }
                }
            } else {
                let cycleOff = peakFlowThisBreath * settings.expiratoryTriggerFraction
                let tiMinPS = norms.inspiratoryTimeMin * 0.8, tiMaxPS = norms.inspiratoryTimeMin * 7
                if (phaseTime > tiMinPS && flow <= cycleOff) || phaseTime > tiMaxPS { endInspiration() }
            }
        }
        peakPressureThisBreath = max(peakPressureThisBreath, airwayPressure)
    }

    private func stepPause(dt _: Double) {
        flow = 0
        airwayPressure = volume / compliance - musclePressure * 0.35
        measured.plateauPressure = volume / compliance
        /* 先に呼吸を締めてから計算する。逆にすると vEI と PIP が 1 つ前の呼吸の値のままで、
         * Cstat と Raw が呼吸ごとに跳ねる。 */
        if phaseTime >= settings.inspiratoryPause {
            endInspiration()
            recomputeMechanics()
        }
    }

    private func stepExpiration(dt: Double) {
        /* 患者が吸おうとすると、回路の圧は PEEP より少しだけ下がる。
         * 機械が応えなかった努力（トリガを鈍くしたとき）は、この小さな切れ込みとして圧波形に残る。 */
        airwayPressure = settings.peep - 0.5 * musclePressure
        let tau = patient.resistanceExp * compliance
        let equilibrium = compliance * (settings.peep + musclePressure)
        let newVolume = equilibrium + (volume - equilibrium) * exp(-dt / tau)
        flow = (newVolume - volume) / dt
        volume = newVolume

        let triggerThreshold = settings.triggerFlow / 60
        let mandatoryInterval = 60 / max(1, settings.respiratoryRate)

        if phaseTime > norms.triggerLockout, flow > triggerThreshold {
            // 吸気努力が auto-PEEP を上回れば流量が正に振れてトリガがかかる。
            // 上回れなければ ineffective effort になる（別に実装する必要はない）。
            if settings.mode.isSpontaneousOnly {
                beginBreath(.spontaneous, trigger: .patient)
            } else if settings.mode == .simvVolume {
                let inWindow = sinceMandatory >= mandatoryInterval - 0.6
                let grid = sinceMandatory - mandatoryInterval
                beginBreath(inWindow ? .mandatory : .spontaneous, trigger: .patient)
                /* 窓の中で同期した強制換気は、時計の刻みを保つ（早めた分だけ次を遅らせる）。
                 * 0 に戻すと、同期するたびに強制換気の回数が設定より増えていく。 */
                if inWindow { sinceMandatory = grid }
            } else {
                beginBreath(.mandatory, trigger: .patient)   // A/C
            }
        } else if !settings.mode.isSpontaneousOnly,
                  sinceMandatory >= mandatoryInterval, phaseTime > 0.3 {
            beginBreath(.mandatory, trigger: .timer)
        } else if settings.mode.isSpontaneousOnly,
                  sinceBreath > settings.alarms.apneaSeconds {
            beginBreath(.mandatory, trigger: .backup)
        }
    }

    private func beginPause() { phase = .pause; phaseTime = 0 }

    private func beginBreath(_ type: BreathType, trigger: TriggerSource) {
        if pendingHold == .expiratory {      // 呼気末でポーズに入り、この呼吸は始めない
            pendingHold = nil
            hold = (.expiratory, 0)
            measured.totalPEEP = volume / compliance
            return
        }
        measured.peakExpiratoryFlow = -peakExpFlowThisBreath * 60
        peakExpFlowThisBreath = 0
        volumeEndExp = volume
        /* 肺胞の圧は弾性圧（V/C）から患者の吸気努力を引いたもの。努力で引き込んだ分まで
         * auto-PEEP に数えると、自発のある子で 0.2〜1 cmH₂O の見かけの値が出続ける。 */
        let alveolarEndExp = volume / compliance - musclePressure
        measured.totalPEEP = max(settings.peep, alveolarEndExp)
        measured.autoPEEP = max(0, alveolarEndExp - settings.peep)
        previousInspStart = clock
        inspirationStart = clock

        phase = .inspiration
        phaseTime = 0
        breathType = type
        lastTrigger = trigger
        inspiredVolume = 0
        peakPressureThisBreath = 0
        peakFlowThisBreath = 0
        sinceBreath = 0
        /* 強制換気の時計は強制換気でだけ戻す。SIMV の自発呼吸で戻すと、
         * 自発が多いほど強制換気が減り、設定 RR が守られなくなる。 */
        if type == .mandatory { sinceMandatory = 0 }
        lastBreathWasSpontaneous = (type == .spontaneous)
        lastBreathTrigger = trigger
    }

    private func endInspiration() {
        measured.peakInspiratoryFlow = peakInspFlowThisBreath * 60
        peakInspFlowThisBreath = 0
        // ポーズも吸気時間に含める
        lastInspiratoryTime = inspirationStart.map { clock - $0 } ?? phaseTime
        volumeEndInsp = volume
        measured.peakPressure = peakPressureThisBreath
        let tidal = (volumeEndInsp - volumeEndExp) * 1000
        measured.tidalVolumeExp = tidal
        if lastBreathWasSpontaneous { lastSpontaneousTidal = tidal / 1000 }
        phase = .expiration
        phaseTime = 0
        breaths.append(BreathRecord(time: clock, volume: tidal, spontaneous: lastBreathWasSpontaneous,
                                    trigger: lastBreathTrigger))
        if breaths.count > 200 { breaths.removeFirst() }
        recomputeRates()
        if pendingHold == .inspiratory {
            pendingHold = nil
            hold = (.inspiratory, 0)
            measured.plateauPressure = volume / compliance
        }
    }

    private func recomputeMechanics() {
        guard let plateau = measured.plateauPressure else { return }
        let tidal = volumeEndInsp - volumeEndExp
        guard tidal > 0.0005 else { return }
        let driving = plateau - max(settings.peep, volumeEndExp / compliance)
        measured.drivingPressure = driving
        measured.staticCompliance = driving > 0.5 ? (tidal * 1000) / driving : nil
        let endFlow = lastVolumeControlFlow ?? settings.inspiratoryFlow / 60
        /* 患者トリガの呼吸は吸気努力のぶん PIP が低く出るので、Raw の計算に使わない。 */
        if settings.mode.isVolumeTargeted, lastBreathTrigger != .patient {
            /* 吸気終末の圧と流量で割る。漸減波では PIP と終末流量が同じ瞬間ではないので、PIP は使わない。 */
            let endPressure = endInspiratoryPressure ?? measured.peakPressure
            let raw: Double? = endFlow > 0.004 ? (endPressure - plateau) / endFlow : nil
            if let raw, raw >= 0 { measured.airwayResistance = raw } else { measured.airwayResistance = nil }
        }
    }

    /* 呼吸回数は「直近 20 秒の呼吸の間隔」から出す（少なくとも 3 間隔）。60 秒の窓で数えると、
     * 設定を変えてから表示が追いつくまで 1 分近くかかり、窓の端の数え方で設定より 1〜3 回多く出る。
     * 自発・トリガの割合だけは 60 秒で見る。混ざった呼吸では短い窓だと割合が大きく揺れるため。 */
    private func recomputeRates() {
        let now = clock
        let records = breaths
        let last = records.count - 1
        var first = -1
        var i = last
        while i >= 0 {
            if now - records[i].time > 60 { break }
            if now - records[i].time <= 20 || last - i <= 3 { first = i }
            i -= 1
        }
        let n = first >= 0 ? last - first : 0       // 間隔の数。最初の呼吸は起点にだけ使う
        var volumeSum = 0.0, spontaneousShort = 0, spontaneousVolumeSum = 0.0
        if n > 0 {
            for record in records[(first + 1)...] {
                volumeSum += record.volume
                if record.spontaneous {
                    spontaneousShort += 1
                    spontaneousVolumeSum += record.volume
                }
            }
        }
        var countAll = 0, spontaneous = 0, triggered = 0
        i = last
        while i >= 0, now - records[i].time <= 60 {
            countAll += 1
            if records[i].spontaneous { spontaneous += 1 }
            if records[i].trigger == .patient { triggered += 1 }
            i -= 1
        }
        if n >= 1 {
            let rate = Double(n) * 60 / max(0.5, records[last].time - records[first].time)
            measured.respiratoryRateTotal = rate
            measured.respiratoryRateSpontaneous = countAll > 0 ? rate * Double(spontaneous) / Double(countAll) : 0
            measured.respiratoryRateTriggered = countAll > 0 ? rate * Double(triggered) / Double(countAll) : 0
            measured.minuteVolume = (volumeSum / Double(n)) / 1000 * rate
        } else {
            measured.respiratoryRateTotal = 0
            measured.respiratoryRateSpontaneous = 0
            measured.respiratoryRateTriggered = 0
            measured.minuteVolume = 0
        }

        /* 成人の RSBI（f/VT[L] < 105）は小児では常に桁外れになる。
         * 小児では f ÷ (一回換気量 mL/kg) で見て、8 未満を目安にする。
         * f はモードを切り替えた直後でも正しく出るよう、短い窓の自発の割合から出す。 */
        var meanTidal: Double? = nil
        if spontaneousShort >= 2 { meanTidal = spontaneousVolumeSum / Double(spontaneousShort) }
        if let vt = meanTidal, vt > 0.2 {
            let f = max(n >= 1 ? measured.respiratoryRateTotal * Double(spontaneousShort) / Double(n) : 0, 1)
            measured.rsbi = min(3000, f / (vt / 1000))
            measured.rsbiPerKg = min(60, f / (vt / patient.predictedBodyWeight))
        } else if spontaneousShort >= 2 {
            measured.rsbi = 3000
            measured.rsbiPerKg = 60
        } else if spontaneous == 0 {
            measured.rsbi = nil                     // 自発がなければ出さない
            measured.rsbiPerKg = nil
        }

        /* I:E は 1 呼吸の吸気時間（ポーズ込み）と、呼吸の間隔の平均から出す。
         * 患者トリガで間隔が揺れるので、数呼吸でならして表示する。 */
        let ti = lastInspiratoryTime > 0 ? lastInspiratoryTime : settings.inspiratoryTime
        let ttot = measured.respiratoryRateTotal > 0.5
            ? 60 / measured.respiratoryRateTotal
            : 60 / max(1, settings.respiratoryRate)
        let ratio = max(0.2, (ttot - ti) / max(0.1, ti))
        let smoothed = smoothedIERatio.map { $0 + 0.4 * (ratio - $0) } ?? ratio
        smoothedIERatio = smoothed
        measured.ieRatio = String(format: "1:%.1f", smoothed)
    }

    // MARK: - ガス交換・循環

    /* 酸素と CO2 の貯え。 */
    static let frcPerKg = 25.0           // mL/kg  鎮静・仰臥位の機能的残気量（PEEP 0 のとき）
    static let bloodVolumePerKg = 75.0   // mL/kg  循環血液量
    static let co2StorePerKg = 0.33      // mL/kg/mmHg  速く平衡する CO2 の貯え
    static let alveolarO2Floor = 12.0    // mmHg

    /* 肺胞 PO2 が 1 mmHg 下がるあいだに体が使える O2 の量（mL/mmHg）。
     * 肺のガス（FRC + PEEP で広げた分。潰れた肺胞＝シャントの分は O2 を持たない）と、
     * 血液（75 mL/kg）。血液は酸素解離曲線の傾きの分だけ効くので、平坦部ではほとんど
     * 役に立たず、SpO2 が 90% を切るあたりから下がり方を緩める。 */
    func oxygenCapacity() -> Double {
        let kg = patient.predictedBodyWeight
        let lungL = Self.frcPerKg * kg / 1000 * (1 - shunt) + max(0, volumeEndExp)
        let gas = lungL * 1000 / (Physiology.barometric - Physiology.waterVapor)
        let hb = patient.hemoglobin
        let slope = (Physiology.oxygenContent(po2: alveolarPO2 + 1, hemoglobin: hb)
            - Physiology.oxygenContent(po2: max(0, alveolarPO2 - 1), hemoglobin: hb)) / 2
        let blood = Self.bloodVolumePerKg * kg / 1000 * 10 * slope * (1 - shunt)
        return gas + blood
    }

    private func updateGasExchange(dt: Double) {
        gasAccumulator += dt
        guard gasAccumulator >= 0.25 else { return }
        let d = gasAccumulator
        gasAccumulator = 0

        let vco2 = patient.vco2 * (1 + 0.13 * (patient.temperature - 37))
        let vo2 = vco2 / Physiology.respiratoryQuotient

        // 死腔と肺胞換気量
        let anatomicDeadSpace = 2.0 * patient.predictedBodyWeight / 1000     // L（2 mL/kg は小児も同じ）
        let circuitDeadSpace = patient.circuitDeadSpace / 1000
        let tidalL = max(0.0002, measured.tidalVolumeExp / 1000)
        let deadSpace = anatomicDeadSpace + circuitDeadSpace
            + patient.alveolarDeadSpaceFraction * tidalL
        /* 死腔を引いた残りが肺胞換気量。体重で 2 桁変わるので床も体重比にする。 */
        var alveolarVentilation = max(0.04 * tidalL, tidalL - deadSpace)
            * max(1, measured.respiratoryRateTotal)

        let plateau = measured.plateauPressure ?? (volume / compliance)
        if plateau > norms.plateauMax - 2 {     // 過膨張は死腔を増やす
            alveolarVentilation *= Physiology.clamp(1 - (plateau - 28) * 0.02, 0.6, 1)
        }

        /* 呼吸が測れるまで（開始直後の数秒）は換気量が 0 に見えるので、ガスを動かさない。 */
        let ventilationMeasured = measured.respiratoryRateTotal > 0 || clock > 20

        /* CO2：普段は 3 分ほどの時定数で動く。ただし換気がほとんど無いときの上がり方は
         * 体の CO2 の貯え（速く平衡する分 ≈ 0.33 mL/kg/mmHg）で頭打ちになり、
         * 無呼吸でも 1 分に十数 mmHg までしか上がらない。 */
        let steadyStateCO2 = Physiology.clamp(0.863 * vco2 / alveolarVentilation, 8, 160)
        let co2Tau = steadyStateCO2 > paco2 ? 190.0 : 130.0
        let co2StoreTau = 60 * 0.863 * (Self.co2StorePerKg * patient.predictedBodyWeight)
            / alveolarVentilation
        if !ventilationMeasured {
            // そのまま
        } else if co2StoreTau > co2Tau {
            paco2 = Physiology.clamp(
                Physiology.approach(paco2, toward: 0.863 * vco2 / alveolarVentilation,
                                    dt: d, tau: co2StoreTau), 8, 160)
        } else {
            paco2 = Physiology.approach(paco2, toward: steadyStateCO2, dt: d, tau: co2Tau)
        }

        // PEEP によるリクルートメント
        let totalPEEP = measured.totalPEEP
        let recruitable = 1 / (1 + exp((totalPEEP - patient.recruitmentP50) / patient.recruitmentK))
        var currentShunt = patient.shuntMinimum
            + (patient.shuntAtLowPEEP - patient.shuntMinimum) * recruitable
        if plateau > norms.plateauMax { currentShunt += (plateau - norms.plateauMax) * 0.006 }
        if patient.prone { currentShunt *= 0.75 }
        if suctionShunt > 0.001 {           // 吸引の陰圧で潰れた肺胞は数分かけて開き直す
            currentShunt += suctionShunt
            suctionShunt *= exp(-d / 50)
        }
        shunt = Physiology.clamp(currentShunt, 0.02, 0.65)

        // 平均気道内圧が高いほど静脈還流が落ちる
        var targetCO = patient.cardiacOutput
            * Physiology.clamp(1 - 0.014 * max(0, measured.meanAirwayPressure - 5), 0.60, 1)
        if patient.volumeDepleted { targetCO *= 0.85 }
        /* 子どもは一回拍出量をあまり増やせないので、徐脈になると心拍出量はほぼ心拍に比例して落ちる。
         * 低酸素の徐脈から心停止に向かう流れはここから出る。 */
        let brady = pow(Physiology.clamp(heartRate / norms.heartRate.lowerBound, 0.05, 1), 1.5)
        cardiacOutput = Physiology.approach(cardiacOutput,
            toward: max(0.25 * patient.cardiacOutput, targetCO) * brady,
            dt: d, tau: brady < 1 ? 6 : 25)

        // 酸素化
        /* 肺胞の O2 は CO2 から逆算せず、O2 そのものの出入りで動かす。
         * 入る量 = 肺胞換気量 ×（吸入 − 肺胞）、出る量 = 酸素消費量。貯えは
         * 肺に残っているガス（FRC）と、血液のヘモグロビンが手放せる分。
         * 換気が止まると FRC の O2 は 1 分もたずに使い切られ、CO2 より先に SpO2 が落ちる。
         * 釣り合った状態では肺胞気式 PAO2 = PIO2 − PaCO2 / R と同じ値になる。 */
        let inspiredO2 = settings.fio2 * (Physiology.barometric - Physiology.waterVapor)
        if ventilationMeasured {
            let steadyStateO2 = inspiredO2 - 0.863 * vo2 / alveolarVentilation
            let o2Tau = 60 * 0.863 * oxygenCapacity() / alveolarVentilation
            alveolarPO2 = Physiology.clamp(
                Physiology.approach(alveolarPO2, toward: steadyStateO2, dt: d, tau: o2Tau),
                Self.alveolarO2Floor, inspiredO2)
        }
        let endCapillary = Physiology.oxygenContent(po2: alveolarPO2,
                                                    hemoglobin: patient.hemoglobin)
        let arterial = max(2, endCapillary
            - shunt * vo2 / ((1 - shunt) * 10 * max(0.25 * patient.cardiacOutput, cardiacOutput)))
        let targetPaO2 = Physiology.po2(fromContent: arterial, hemoglobin: patient.hemoglobin)
        pao2 = Physiology.approach(pao2, toward: targetPaO2, dt: d, tau: 8)   // 肺から動脈までの数秒
        spo2 = Physiology.approach(spo2, toward: Physiology.saturation(po2: pao2) * 100,
                                   dt: d, tau: 14)

        // 酸塩基：腎性代償は数時間かけて動く
        let chronic = 24 + 0.38 * (paco2 - 40)
        let target = Physiology.clamp(patient.hco3Base + (chronic - 24), 6, 45)
        hco3 = Physiology.approach(hco3, toward: target, dt: d, tau: 5400)
        pH = Physiology.pH(hco3: hco3, paco2: paco2)
        baseExcess = hco3 - 24.4 + 14.8 * (pH - 7.4)
        /* etCO2 は吐き終わりのガス。一回換気量が気道＋回路の死腔（センサーより患者側）に近いと、
         * 肺胞のガスがセンサーまで届かず低く出る（Vt が死腔の 1.6 倍あればほぼ肺胞の値）。
         * 肺に届く血流が落ちても CO2 が運ばれず低くなる（心拍出量が普段の半分を切ったところから）。 */
        if ventilationMeasured {
            let alveolarEtCO2 = max(0, paco2 - 3 - patient.alveolarDeadSpaceFraction * 25)
            let reach = Physiology.smoothstep(0.5, 1.6,
                tidalL / max(0.0001, anatomicDeadSpace + circuitDeadSpace))
            let perfusion = Physiology.clamp(cardiacOutput / (0.5 * patient.cardiacOutput), 0, 1)
            etco2 = Physiology.approach(etco2, toward: alveolarEtCO2 * reach * perfusion,
                                        dt: d, tau: 8)
        }

        // 循環
        let hrScale = norms.heartRate.upperBound / 100
        var hrTarget = patient.heartRate
            + Physiology.clamp((norms.spo2Target.lowerBound - spo2) * 1.8 * hrScale, 0, 35 * hrScale)
            + Physiology.clamp((paco2 - 40) * 0.5 * hrScale, -8 * hrScale, 22 * hrScale)
            + Physiology.clamp((7.35 - pH) * 60 * hrScale, 0, 25 * hrScale)
            + 44 * hrScale * max(0, muscleLoad - 0.6)
        /* 重い低酸素では、はじめの頻脈のあとに徐脈になり、放っておけば心停止に向かう。
         * 小児は成人より早く徐脈になり、若いほどその閾値が高い（新生児は SpO2 78% から）。 */
        let bradySpO2: Double = norms.label == "新生児" ? 78 : (norms.label == "乳児" ? 72 : 65)
        let bradySlope = norms.label == "新生児" ? 3.2 : 3.6 * hrScale
        if spo2 < bradySpO2 { hrTarget -= (bradySpO2 - spo2) * bradySlope }
        heartRate = Physiology.approach(heartRate,
            toward: Physiology.clamp(hrTarget, norms.heartRate.lowerBound * 0.2,
                                     norms.heartRate.upperBound * 1.45),
                                        dt: d, tau: 12)
        let mapTarget = Physiology.clamp(
            patient.meanArterialPressure * (cardiacOutput / patient.cardiacOutput)
                * (pH < 7.2 ? 0.88 : 1),
            norms.meanArterialPressureMin * 0.25, norms.meanArterialPressureMin * 2.2)
        meanArterialPressure = Physiology.approach(meanArterialPressure, toward: mapTarget,
                                                   dt: d, tau: 15)

        recomputeDrive()
        updateFatigue(dt: d)
        accumulateScore(dt: d, plateau: plateau)
        refreshAlarms()
    }

    // MARK: - 採点と警報

    private func accumulateScore(dt: Double, plateau: Double) {
        var ok = true
        if let range = patient.goals.pH, !range.contains(pH) { ok = false }
        if let range = patient.goals.paco2, !range.contains(paco2) { ok = false }
        if let range = patient.goals.pao2, !range.contains(pao2) { ok = false }
        isInTarget = ok
        timeInTarget.total += dt
        if ok { timeInTarget.inTarget += dt }

        if plateau > norms.plateauMax { harm.highPlateau += dt }
        if measured.tidalVolumeExp / patient.predictedBodyWeight > norms.tidalPerKg.upperBound + 1.5 {
            harm.highTidalVolume += dt
        }
        if measured.autoPEEP > 3 { harm.autoPEEP += dt }
        if spo2 < norms.spo2Target.lowerBound - 3 { harm.hypoxia += dt }
        if meanArterialPressure < norms.meanArterialPressureMin { harm.hypotension += dt }
        if settings.fio2 > 0.6 { harm.highFiO2 += dt }
    }

    private func refreshAlarms() {
        var list: [Alarm] = []
        let limits = settings.alarms
        if measured.peakPressure > limits.peakPressure { list.append(.init(message: "気道内圧上限", severity: 2)) }
        if measured.tidalVolumeExp < limits.tidalVolumeLow, clock > 20 {
            list.append(.init(message: "一回換気量 低下", severity: 2))
        }
        if measured.tidalVolumeExp > limits.tidalVolumeHigh { list.append(.init(message: "一回換気量 過大", severity: 1)) }
        if measured.minuteVolume < limits.minuteVolumeLow, clock > 30 {
            list.append(.init(message: "分時換気量 低下", severity: 2))
        }
        if measured.minuteVolume > limits.minuteVolumeHigh { list.append(.init(message: "分時換気量 過大", severity: 1)) }
        if measured.respiratoryRateTotal > limits.respiratoryRateHigh { list.append(.init(message: "頻呼吸", severity: 1)) }
        if spo2 < norms.spo2Target.lowerBound { list.append(.init(message: "SpO₂ 低下", severity: 2)) }
        if measured.autoPEEP > 5 { list.append(.init(message: "auto-PEEP", severity: 1)) }
        if meanArterialPressure < norms.meanArterialPressureMin { list.append(.init(message: "血圧低下", severity: 2)) }
        if heartRate < norms.heartRate.lowerBound * 0.8 { list.append(.init(message: "徐脈", severity: 2)) }
        alarms = list
    }

    // MARK: - 病態の操作（手技）

    public func setProne(_ prone: Bool) { patient.prone = prone }

    /// 気管吸引。一時的にシャントが増えて SpO2 が下がる。
    public func applySuctionEffect(multiplier: Double = 1.7) {
        patient.shuntAtLowPEEP = min(0.75, patient.shuntAtLowPEEP * multiplier)
    }

    public func restoreShunt(to value: Double) { patient.shuntAtLowPEEP = value }

    /// 急変の途中から場面を始めるとき、SpO₂ をその値まで先に落としておく（PaO₂ も上限で切る）。
    /// すでに低ければ何もしない。
    public func lowerOxygenation(spo2 maxSpO2: Double, pao2 maxPaO2: Double) {
        guard spo2 > maxSpO2 else { return }
        spo2 = maxSpO2
        pao2 = min(pao2, maxPaO2)
    }

    /// 肺の硬さ。レッスンが気胸や片肺挿管を起こすときに、元の値を控えてから差し替える。
    public var lungCompliance: Double { patient.compliance }
    public func setLungCompliance(_ value: Double) { patient.compliance = max(0.0001, value) }

    /// シャントの下限と PEEP が低いときの値。まとめて動かすと酸素化だけを悪くできる。
    public var shuntSetting: (low: Double, minimum: Double) {
        (patient.shuntAtLowPEEP, patient.shuntMinimum)
    }
    public func setShunt(low: Double, minimum: Double) {
        patient.shuntAtLowPEEP = Physiology.clamp(low, 0.02, 0.9)
        patient.shuntMinimum = Physiology.clamp(minimum, 0.02, 0.9)
    }
}
