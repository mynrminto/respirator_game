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

    struct BreathRecord { let time: Double; let volume: Double; let spontaneous: Bool }

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
    private var lastInspiratoryTime: Double = 1
    private var lastCycleTime: Double = 0
    private var hold: (kind: HoldKind, elapsed: Double)?
    private var pendingHold: HoldKind?

    /// 実行中のポーズ。画面でキーを点灯させるために読む。
    public var activeHold: HoldKind? { hold?.kind }
    /// 次の吸気末／呼気末に実行されるのを待っているポーズ。
    public var awaitingHold: HoldKind? { pendingHold }
    private var lastBreathWasSpontaneous = false

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
        reset()
    }

    public func reset() {
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
        heartRate = patient.heartRate
        meanArterialPressure = patient.meanArterialPressure
        cardiacOutput = patient.cardiacOutput
        shunt = patient.shuntAtLowPEEP
        hold = nil
        pendingHold = nil
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

    public func drawBloodGas() -> BloodGas {
        let jitter = { (scale: Double) in (Double.random(in: 0...1) - 0.5) * scale }
        let lactate = Physiology.clamp(
            1.0 + (meanArterialPressure < 60 ? (60 - meanArterialPressure) * 0.06 : 0)
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
        let vco2 = patient.vco2 * (1 + 0.13 * (patient.temperature - 37))
        let restingVE = 0.1 * patient.predictedBodyWeight * (vco2 / 200)
        var drive = 1 + 0.11 * (paco2 - patient.co2Setpoint)
        if pao2 < 60 { drive += (60 - pao2) * 0.022 }
        let currentPH = Physiology.pH(hco3: hco3, paco2: paco2)
        if currentPH < 7.30 { drive += (7.30 - currentPH) * 3.0 }
        drive = Physiology.clamp(drive * patient.driveGain, 0, 6)

        let awake = Physiology.clamp(1 - sedation, 0, 1)
        let demand = restingVE * drive * awake

        guard awake >= 0.06, demand >= 0.5 else {     // 深鎮静・筋弛緩 → 無呼吸
            muscleAmplitude = 0
            muscleLoad = 0
            neuralCycle = 99
            return
        }

        let rate = Physiology.clamp(10 + 1.9 * (demand - restingVE) + 26 * fatigue, 8, 48)
        neuralCycle = 60 / rate
        neuralInspTime = Physiology.clamp(0.62 * neuralCycle, 0.45, 1.3)

        let targetTidal = demand / rate                        // L
        let needed = (targetTidal / compliance) * 0.62          // 抵抗分を含めた粗い逆算
        let ceiling = patient.maxInspiratoryPressure * awake * (1 - 0.55 * fatigue)
        muscleAmplitude = Physiology.clamp(needed, 0, ceiling)
        muscleLoad = ceiling > 0 ? (muscleAmplitude / ceiling) * (rate / 16) : 0
    }

    private func updateFatigue(dt: Double) {
        if muscleLoad > 0.62 {
            fatigue += (muscleLoad - 0.62) * dt / 95
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
            flow = q
            volume += q * dt
            inspiredVolume += q * dt
            airwayPressure = volume / compliance + patient.resistanceInsp * q - musclePressure

            if inspiredVolume >= settings.tidalVolume / 1000 {
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
                if (phaseTime > 0.25 && flow <= cycleOff) || phaseTime > 2.8 { endInspiration() }
            }
        }
        peakPressureThisBreath = max(peakPressureThisBreath, airwayPressure)
    }

    private func stepPause(dt _: Double) {
        flow = 0
        airwayPressure = volume / compliance - musclePressure * 0.35
        measured.plateauPressure = volume / compliance
        if phaseTime >= settings.inspiratoryPause {
            recomputeMechanics()
            endInspiration()
        }
    }

    private func stepExpiration(dt: Double) {
        airwayPressure = settings.peep
        let tau = patient.resistanceExp * compliance
        let equilibrium = compliance * (settings.peep + musclePressure)
        let newVolume = equilibrium + (volume - equilibrium) * exp(-dt / tau)
        flow = (newVolume - volume) / dt
        volume = newVolume

        let triggerThreshold = settings.triggerFlow / 60
        let mandatoryInterval = 60 / max(1, settings.respiratoryRate)

        if phaseTime > 0.25, flow > triggerThreshold {
            // 吸気努力が auto-PEEP を上回れば流量が正に振れてトリガがかかる。
            // 上回れなければ ineffective effort になる（別に実装する必要はない）。
            if settings.mode.isSpontaneousOnly {
                beginBreath(.spontaneous, trigger: .patient)
            } else if settings.mode == .simvVolume {
                let inWindow = sinceMandatory >= mandatoryInterval - 0.6
                beginBreath(inWindow ? .mandatory : .spontaneous, trigger: .patient)
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
        volumeEndExp = volume
        measured.totalPEEP = max(settings.peep, volume / compliance)
        measured.autoPEEP = max(0, volume / compliance - settings.peep)
        lastCycleTime = previousInspStart.map { clock - $0 } ?? 0
        previousInspStart = clock

        phase = .inspiration
        phaseTime = 0
        breathType = type
        lastTrigger = trigger
        inspiredVolume = 0
        peakPressureThisBreath = 0
        peakFlowThisBreath = 0
        sinceBreath = 0
        sinceMandatory = 0
        lastBreathWasSpontaneous = (type == .spontaneous)
    }

    private func endInspiration() {
        lastInspiratoryTime = phaseTime
        volumeEndInsp = volume
        measured.peakPressure = peakPressureThisBreath
        let tidal = (volumeEndInsp - volumeEndExp) * 1000
        measured.tidalVolumeExp = tidal
        phase = .expiration
        phaseTime = 0
        breaths.append(BreathRecord(time: clock, volume: tidal, spontaneous: lastBreathWasSpontaneous))
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
        guard tidal > 0.05 else { return }
        let driving = plateau - measured.totalPEEP
        measured.drivingPressure = driving
        measured.staticCompliance = driving > 0.5 ? (tidal * 1000) / driving : nil
        if settings.mode.isVolumeTargeted {
            let endFlow = settings.inspiratoryFlow / 60
            measured.airwayResistance = endFlow > 0.05
                ? (measured.peakPressure - plateau) / endFlow : nil
        }
    }

    private func recomputeRates() {
        let window = 60.0
        var total = 0, spontaneous = 0
        var volumeSum = 0.0, spontaneousVolumeSum = 0.0
        for record in breaths.reversed() {
            if clock - record.time > window { break }
            total += 1
            volumeSum += record.volume
            if record.spontaneous {
                spontaneous += 1
                spontaneousVolumeSum += record.volume
            }
        }
        let span = min(window, max(5, clock))
        measured.respiratoryRateTotal = Double(total) * 60 / span
        measured.respiratoryRateSpontaneous = Double(spontaneous) * 60 / span
        measured.minuteVolume = volumeSum / 1000 * 60 / span

        if spontaneous >= 2 {
            let meanTidalL = (spontaneousVolumeSum / Double(spontaneous)) / 1000
            measured.rsbi = meanTidalL > 0.02
                ? min(250, (Double(spontaneous) * 60 / span) / meanTidalL) : 250
        } else if measured.respiratoryRateSpontaneous > 0, measured.tidalVolumeExp > 0 {
            measured.rsbi = min(250, measured.respiratoryRateTotal / (measured.tidalVolumeExp / 1000))
        }

        let ti = lastInspiratoryTime
        let ttot = lastCycleTime > 0.3 ? lastCycleTime : 60 / max(1, settings.respiratoryRate)
        let ratio = max(0.2, (ttot - ti) / max(0.1, ti))
        measured.ieRatio = String(format: "1:%.1f", ratio)
    }

    // MARK: - ガス交換・循環

    private func updateGasExchange(dt: Double) {
        gasAccumulator += dt
        guard gasAccumulator >= 0.25 else { return }
        let d = gasAccumulator
        gasAccumulator = 0

        let vco2 = patient.vco2 * (1 + 0.13 * (patient.temperature - 37))
        let vo2 = vco2 / Physiology.respiratoryQuotient

        // 死腔と肺胞換気量
        let anatomicDeadSpace = 2.0 * patient.predictedBodyWeight / 1000     // L
        let circuitDeadSpace = 0.030
        let tidalL = max(0.05, measured.tidalVolumeExp / 1000)
        let deadSpace = anatomicDeadSpace + circuitDeadSpace
            + patient.alveolarDeadSpaceFraction * tidalL
        var alveolarVentilation = max(0.15, tidalL - deadSpace)
            * max(1, measured.respiratoryRateTotal)

        let plateau = measured.plateauPressure ?? (volume / compliance)
        if plateau > 28 {                       // 過膨張は死腔を増やす
            alveolarVentilation *= Physiology.clamp(1 - (plateau - 28) * 0.02, 0.6, 1)
        }

        let steadyStateCO2 = Physiology.clamp(0.863 * vco2 / alveolarVentilation, 8, 160)
        paco2 = Physiology.approach(paco2, toward: steadyStateCO2, dt: d,
                                    tau: steadyStateCO2 > paco2 ? 190 : 130)

        // PEEP によるリクルートメント
        let totalPEEP = measured.totalPEEP
        let recruitable = 1 / (1 + exp((totalPEEP - patient.recruitmentP50) / patient.recruitmentK))
        var currentShunt = patient.shuntMinimum
            + (patient.shuntAtLowPEEP - patient.shuntMinimum) * recruitable
        if plateau > 30 { currentShunt += (plateau - 30) * 0.006 }
        if patient.prone { currentShunt *= 0.75 }
        shunt = Physiology.clamp(currentShunt, 0.02, 0.65)

        // 平均気道内圧が高いほど静脈還流が落ちる
        var targetCO = patient.cardiacOutput
            * Physiology.clamp(1 - 0.014 * max(0, measured.meanAirwayPressure - 5), 0.60, 1)
        if patient.volumeDepleted { targetCO *= 0.85 }
        cardiacOutput = Physiology.approach(cardiacOutput, toward: max(1.8, targetCO), dt: d, tau: 25)

        // 酸素化（シャント式を閉じた形で解く）
        let alveolarO2 = Physiology.alveolarPO2(fio2: settings.fio2, paco2: paco2)
        let endCapillary = Physiology.oxygenContent(po2: max(20, alveolarO2),
                                                    hemoglobin: patient.hemoglobin)
        let arterial = max(2, endCapillary
            - shunt * vo2 / ((1 - shunt) * 10 * max(1.5, cardiacOutput)))
        let targetPaO2 = Physiology.po2(fromContent: arterial, hemoglobin: patient.hemoglobin)
        pao2 = Physiology.approach(pao2, toward: targetPaO2, dt: d, tau: 42)
        spo2 = Physiology.approach(spo2, toward: Physiology.saturation(po2: pao2) * 100,
                                   dt: d, tau: 14)

        // 酸塩基：腎性代償は数時間かけて動く
        let chronic = 24 + 0.38 * (paco2 - 40)
        let target = Physiology.clamp(patient.hco3Base + (chronic - 24), 6, 45)
        hco3 = Physiology.approach(hco3, toward: target, dt: d, tau: 5400)
        pH = Physiology.pH(hco3: hco3, paco2: paco2)
        baseExcess = hco3 - 24.4 + 14.8 * (pH - 7.4)
        etco2 = Physiology.approach(etco2,
                                    toward: paco2 - 3 - patient.alveolarDeadSpaceFraction * 25,
                                    dt: d, tau: 8)

        // 循環
        let hrTarget = patient.heartRate
            + Physiology.clamp((90 - spo2) * 1.8, 0, 35)
            + Physiology.clamp((paco2 - 40) * 0.5, -8, 22)
            + Physiology.clamp((7.35 - pH) * 60, 0, 25)
            + 44 * max(0, muscleLoad - 0.6)
        heartRate = Physiology.approach(heartRate, toward: Physiology.clamp(hrTarget, 45, 165),
                                        dt: d, tau: 12)
        let mapTarget = Physiology.clamp(
            patient.meanArterialPressure * (cardiacOutput / patient.cardiacOutput)
                * (pH < 7.2 ? 0.88 : 1), 35, 130)
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

        if plateau > 30 { harm.highPlateau += dt }
        if measured.tidalVolumeExp / patient.predictedBodyWeight > 8.5 { harm.highTidalVolume += dt }
        if measured.autoPEEP > 3 { harm.autoPEEP += dt }
        if spo2 < 88 { harm.hypoxia += dt }
        if meanArterialPressure < 60 { harm.hypotension += dt }
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
        if spo2 < 90 { list.append(.init(message: "SpO₂ 低下", severity: 2)) }
        if measured.autoPEEP > 5 { list.append(.init(message: "auto-PEEP", severity: 1)) }
        if meanArterialPressure < 60 { list.append(.init(message: "血圧低下", severity: 2)) }
        alarms = list
    }

    // MARK: - 病態の操作（手技）

    public func setProne(_ prone: Bool) { patient.prone = prone }

    /// 気管吸引。一時的にシャントが増えて SpO2 が下がる。
    public func applySuctionEffect(multiplier: Double = 1.7) {
        patient.shuntAtLowPEEP = min(0.75, patient.shuntAtLowPEEP * multiplier)
    }

    public func restoreShunt(to value: Double) { patient.shuntAtLowPEEP = value }
}
