import AVFoundation
import Foundation

/// 操作音とアラーム音。Web 版 web/sound.js と同じ音程・長さ・間隔で、音のファイルは持たずにその場で合成する。
///
/// 操作音は 4 種類。
/// - click   … 機器のキー（設定キー・ハードキー・モード・消音など）。硬くて短い打鍵音。
/// - tick    … ダイヤルが 1 目盛り動いた。ごく小さく高い音。
/// - confirm … 「確定」で設定が患者に反映された。上がる 2 音。
/// - tap     … 機器の外のボタン（学習帯など）。丸く柔らかい音。
///
/// アラーム音は IEC 60601-1-8 の考え方に寄せる（ド・ラ・ファの 3 音の並びで優先度を分ける）。
/// - high   … 赤（危険）。3 音＋2 音を 2 回、計 10 音を 8 秒ごと。
/// - medium … 黄（注意）。3 音をゆっくり 1 回、15 秒ごと。
/// 優先度が上がった瞬間は待たずにすぐ鳴らす。消音中・音をオフにしたときは鳴らさない。
/// 時刻は実時間で数える（早送り中に連打にならないように）。
///
/// オーディオセッションは .ambient にしてあるので、マナーモードでは鳴らず、ほかのアプリの音も止めない。
final class SoundBoard {
    static let shared = SoundBoard()

    enum Cue: CaseIterable { case click, tick, confirm, tap, alarmHigh, alarmMedium }

    static let highEvery: Double = 8
    static let mediumEvery: Double = 15
    private static let enabledKey = "ventsim.sound.v1"

    /// 音を鳴らすかどうか。メニューから切り替え、次回の起動にも残す。
    var isEnabled: Bool {
        get { UserDefaults.standard.object(forKey: Self.enabledKey) as? Bool ?? true }
        set {
            UserDefaults.standard.set(newValue, forKey: Self.enabledKey)
            if newValue { play(.tap) } else { alarmLevel = 0 }
        }
    }

    private let engine = AVAudioEngine()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)!
    private var players: [Cue: AVAudioPlayerNode] = [:]
    private var buffers: [Cue: AVAudioPCMBuffer] = [:]
    private var running = false

    private var alarmLevel = 0
    private var alarmAt = Date.distantPast

    private init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        for cue in Cue.allCases {
            let node = AVAudioPlayerNode()
            engine.attach(node)
            engine.connect(node, to: engine.mainMixerNode, format: format)
            players[cue] = node
            buffers[cue] = render(Self.notes(for: cue))
        }
        engine.mainMixerNode.outputVolume = 0.6
    }

    func play(_ cue: Cue) {
        guard isEnabled, start(), let node = players[cue], let buffer = buffers[cue] else { return }
        node.scheduleBuffer(buffer, at: nil, options: .interrupts)
        if !node.isPlaying { node.play() }
    }

    /// 5 Hz の更新ごとに呼ぶ。level は 0 / 1（注意）/ 2（危険）。
    func updateAlarm(level: Int, silenced: Bool, now: Date = Date()) {
        guard isEnabled, level > 0, !silenced else { alarmLevel = 0; return }
        let every = level >= 2 ? Self.highEvery : Self.mediumEvery
        let due = level > alarmLevel || now.timeIntervalSince(alarmAt) >= every
        alarmLevel = level
        guard due else { return }
        alarmAt = now
        play(level >= 2 ? .alarmHigh : .alarmMedium)
    }

    private func start() -> Bool {
        if running && engine.isRunning { return true }
        do {
            try AVAudioSession.sharedInstance().setActive(true)
            try engine.start()
            running = true
        } catch {
            running = false
        }
        return running
    }

    // MARK: - 合成

    /// 1 音。f は Hz、t は開始、d は長さ（秒）、to があれば音程を滑らせる。
    /// harmonics は（倍数, 強さ）の組。アラームは 2・3・5 倍を足して機器らしい硬い音にする。
    private struct Note {
        var f: Double, t: Double, d: Double, gain: Double
        var square = false
        var to: Double? = nil
        var harmonics: [(Double, Double)] = [(1, 1)]
    }

    private static let c5 = 523.25, a4 = 440.0, f4 = 349.23
    private static let alarmHarmonics: [(Double, Double)] = [(1, 1), (2, 0.35), (3, 0.22), (5, 0.12)]

    private static func notes(for cue: Cue) -> [Note] {
        switch cue {
        case .click:
            return [Note(f: 2300, t: 0, d: 0.018, gain: 0.10, square: true),
                    Note(f: 170, t: 0, d: 0.03, gain: 0.30)]
        case .tick:
            return [Note(f: 3400, t: 0, d: 0.008, gain: 0.05, square: true)]
        case .confirm:
            return [Note(f: 1046.5, t: 0, d: 0.07, gain: 0.26),
                    Note(f: 1568, t: 0.085, d: 0.11, gain: 0.26)]
        case .tap:
            return [Note(f: 740, t: 0, d: 0.06, gain: 0.20, to: 1110)]
        case .alarmHigh:
            // 3 音（ド・ラ・ファ）＋2 音（ラ・ファ）、少し空けてもう一度。web/sound.js の ALARM.high と同じ。
            var out: [Note] = [], t = 0.0
            let seq = [c5, a4, f4, a4, f4]
            for _ in 0..<2 {
                for (k, f) in seq.enumerated() {
                    out.append(Note(f: f, t: t, d: 0.13, gain: 0.34, harmonics: alarmHarmonics))
                    t += (k == 2 ? 0.34 : 0.19)
                }
                t += 0.55
            }
            return out
        case .alarmMedium:
            return [c5, a4, f4].enumerated().map { k, f in
                Note(f: f, t: Double(k) * 0.32, d: 0.2, gain: 0.26, harmonics: alarmHarmonics)
            }
        }
    }

    private func render(_ notes: [Note]) -> AVAudioPCMBuffer? {
        let rate = format.sampleRate
        let length = (notes.map { $0.t + $0.d }.max() ?? 0) + 0.06
        let frames = AVAudioFrameCount(length * rate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
              let data = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = frames
        for i in 0..<Int(frames) { data[i] = 0 }
        for n in notes {
            let start = Int(n.t * rate), count = Int((n.d + 0.03) * rate)
            var phase = [Double](repeating: 0, count: n.harmonics.count)
            for i in 0..<count where start + i < Int(frames) {
                let time = Double(i) / rate
                // 立ち上がり 4 ms、長さの 6 割まで平ら、そのあと指数で減衰（web の voice と同じ形）
                let attack = min(1, time / 0.004)
                let hold = n.d * 0.6
                let env = time <= hold ? attack : attack * exp(-(time - hold) / max(0.008, (n.d - hold + 0.03) / 5))
                let f = n.to.map { n.f * pow($0 / n.f, min(1, time / n.d)) } ?? n.f
                var s = 0.0
                for (h, harmonic) in n.harmonics.enumerated() {
                    phase[h] += 2 * .pi * f * harmonic.0 / rate
                    let wave = sin(phase[h])
                    s += (n.square ? (wave >= 0 ? 1 : -1) : wave) * harmonic.1
                }
                data[start + i] += Float(s * n.gain * env)
            }
        }
        return buffer
    }
}
