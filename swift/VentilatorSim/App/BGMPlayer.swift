import AVFoundation
import Foundation

/// BGM。昼の曲と夜の曲の 2 曲を、音のファイルを持たずにその場で合成する（web/bgm.js と同じ曲・同じ音色・同じ手順）。
///
/// - day   … 昼。ハ長調・88 BPM。エレピの和音、やわらかいベース、小さなシェイカー、後半にマリンバの旋律。
/// - night … 夜。イ短調・66 BPM。ゆっくり立ち上がるパッド、低いベース、オルゴールの高い音。
///
/// 流す場所と時刻は Web 版と同じ。
/// - タイトル … 昼
/// - 物語の幕 … 幕ごとの時刻（StoryScene.time）
/// - レッスン … 章の時刻（StoryLibrary.chapterTime）。第1章＝初日の夜、第5章＝当直の夜、ほかは昼
/// - 症例で練習 … 端末の時計。6 時〜17 時台は昼、それ以外は夜
/// 切り替えは 2.5 秒のクロスフェード。
///
/// 音量はアラームやパルス音よりずっと小さく、アラームが鳴っているあいだはさらに下げる。
/// 音全体（SoundBoard.isEnabled）を切ると BGM も止まる。BGM だけ切ることもできる（メニュー）。
/// オーディオセッションは SoundBoard と同じ .ambient なので、マナーモードでは鳴らない。
///
/// 楽譜と音色の数値は BGMScore.swift（web/tools/bgm-swift.js が bgm.js から書き出す）。
/// 1 曲分（40〜60 秒）をはじめて流すときに裏で合成し、ループで流す。
final class BGMPlayer {
    static let shared = BGMPlayer()

    private static let enabledKey = "ventsim.bgm.v1"

    /// BGM だけを流すかどうか。音全体が切れていれば、こちらがオンでも流れない。
    var isEnabled: Bool {
        get { UserDefaults.standard.object(forKey: Self.enabledKey) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: Self.enabledKey); apply() }
    }

    /// 端末の時計で選ぶ（症例で練習）。
    static func clockTrack(_ date: Date = Date()) -> String {
        let h = Calendar.current.component(.hour, from: date)
        return (6..<18).contains(h) ? "day" : "night"
    }

    private let format = AVAudioFormat(standardFormatWithSampleRate: BGMScore.rate, channels: 2)!
    private let bus = AVAudioMixerNode()
    private var nodes: [AVAudioPlayerNode] = []
    private var nodeTrack: [String?] = [nil, nil]
    private var active = 0
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    private var rendering: Set<String> = []
    private var wanted: String?
    private var playing: String?
    private var ducked = false
    private var fadeTimer: Timer?
    private var attached = false

    private init() {}

    private func attach() {
        guard !attached else { return }
        attached = true
        let engine = SoundBoard.shared.engine
        engine.attach(bus)
        engine.connect(bus, to: engine.mainMixerNode, format: nil)
        bus.outputVolume = BGMScore.gain
        for _ in 0..<2 {
            let n = AVAudioPlayerNode()
            engine.attach(n)
            engine.connect(n, to: bus, format: format)
            n.volume = 0
            nodes.append(n)
        }
    }

    /// 流したい曲を伝える（"day" / "night" / nil）。何度呼んでもよい。
    func want(_ track: String?) {
        wanted = track.flatMap { BGMScore.songs[$0] == nil ? nil : $0 }
        apply()
    }

    /// アラームが鳴っているあいだは下げる。
    func duck(_ on: Bool) {
        guard on != ducked else { return }
        ducked = on
        if attached { bus.outputVolume = BGMScore.gain * (on ? BGMScore.duck : 1) }
    }

    /// 音の設定が変わったとき・画面が変わったときに呼ぶ。
    func apply() {
        let target = isEnabled && SoundBoard.shared.isEnabled ? wanted : nil
        attach()
        // エンジンが止まって再開した（着信・バックグラウンドなど）ときは、流していた曲をかけ直す
        if let playing, playing == target, !nodes[active].isPlaying, let buffer = buffers[playing] {
            guard SoundBoard.shared.start() else { return }
            nodes[active].scheduleBuffer(buffer, at: nil, options: .loops)
            nodes[active].play()
            return
        }
        guard target != playing else { return }
        if let target, buffers[target] == nil { prepare(target); return }   // できあがったら apply し直す
        if target != nil { guard SoundBoard.shared.start() else { return } }
        let old = active
        playing = target
        if let target, let buffer = buffers[target] {
            active = 1 - old
            let n = nodes[active]
            n.stop()
            n.volume = 0
            n.scheduleBuffer(buffer, at: nil, options: .loops)
            n.play()
            nodeTrack[active] = target
        }
        crossfade(from: old, to: target == nil ? nil : active)
    }

    private func crossfade(from old: Int, to new: Int?) {
        fadeTimer?.invalidate()
        let start = Date()
        let oldStart = nodes[old].volume
        let newStart = new.map { nodes[$0].volume } ?? 0
        fadeTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            let k = Float(min(1, Date().timeIntervalSince(start) / BGMScore.fade))
            if old != new { self.nodes[old].volume = oldStart * (1 - k) }
            if let new { self.nodes[new].volume = newStart + (1 - newStart) * k }
            if k >= 1 {
                timer.invalidate()
                if old != new { self.nodes[old].stop(); self.nodeTrack[old] = nil }
            }
        }
    }

    private func prepare(_ track: String) {
        guard !rendering.contains(track), let song = BGMScore.songs[track] else { return }
        rendering.insert(track)
        let format = self.format
        DispatchQueue.global(qos: .utility).async {
            let (l, r) = BGMSynth.render(song: song, rate: BGMScore.rate)
            DispatchQueue.main.async {
                self.rendering.remove(track)
                guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(l.count)),
                      let ch = buffer.floatChannelData else { return }
                buffer.frameLength = AVAudioFrameCount(l.count)
                l.withUnsafeBufferPointer { ch[0].update(from: $0.baseAddress!, count: l.count) }
                r.withUnsafeBufferPointer { ch[1].update(from: $0.baseAddress!, count: r.count) }
                self.buffers[track] = buffer
                self.apply()
            }
        }
    }
}

// MARK: - 楽譜と音色の型（BGMScore.swift が使う）

struct BGMInstrument {
    enum Kind { case fm, mallet, bass, pad, noise }
    var kind: Kind
    var attack: Double, tau: Double, release: Double, gain: Double, pan: Double
    var index: Double, indexTau: Double, indexBase: Double
    var partial: Double, partialGain: Double, partialTau: Double
    var detune: Double
}

struct BGMNote {
    var inst: String
    var t: Double, d: Double, f: Double, v: Double
}

struct BGMSong {
    var length: Double
    var feedback: Double, damp: Double, wet: Double
    var notes: [BGMNote]
}

// MARK: - 合成（web/bgm.js の voiceInto / Reverb / Renderer と同じ手順）

enum BGMSynth {
    static let tableSize = 4096
    static let sine: [Float] = (0...tableSize).map { Float(sin(2 * Double.pi * Double($0) / Double(tableSize))) }
    /// 8 倍音までのやわらかいのこぎり波（1/n^1.3）。ピークで割って ±1 にそろえる。
    static let softSaw: [Float] = {
        var t = (0...tableSize).map { i -> Double in
            let x = Double(i) / Double(tableSize)
            return (1...8).reduce(0.0) { $0 + sin(2 * Double.pi * Double($1) * x) / pow(Double($1), 1.3) }
        }
        let peak = t.map(abs).max() ?? 1
        t = t.map { $0 / peak }
        return t.map(Float.init)
    }()

    static let combs = [0.0297, 0.0371, 0.0411, 0.0437]
    static let allpass = [0.005, 0.0017]
    static let spread = 0.0011

    static func render(song: BGMSong, rate: Double) -> ([Float], [Float]) {
        let n = Int((song.length * rate).rounded())
        var left = [Float](repeating: 0, count: n), right = [Float](repeating: 0, count: n)
        left.withUnsafeMutableBufferPointer { l in
            right.withUnsafeMutableBufferPointer { r in
                for note in song.notes {
                    guard let p = BGMScore.instruments[note.inst] else { continue }
                    voice(into: l, r, note: note, p: p, rate: rate)
                }
            }
        }
        let wl = reverb(left, rate: rate, song: song, spread: 0)
        let wr = reverb(right, rate: rate, song: song, spread: spread)
        let wet = Float(song.wet)
        var peak: Float = 1e-9
        for i in 0..<n {
            left[i] = left[i] * (1 - wet) + wl[i] * wet * 3
            right[i] = right[i] * (1 - wet) + wr[i] * wet * 3
            peak = max(peak, abs(left[i]), abs(right[i]))
        }
        let g = 0.8 / peak
        for i in 0..<n { left[i] *= g; right[i] *= g }
        return (left, right)
    }

    /// 1 音を L・R に足し込む。ループの長さを超えた分は頭へ回り込む。
    /// a 秒で直線に立ち上がり、時定数 tau で減衰（0 なら平ら）、長さ d を過ぎたら rel 秒で直線に消える。
    private static func voice(into l: UnsafeMutableBufferPointer<Float>, _ r: UnsafeMutableBufferPointer<Float>,
                              note: BGMNote, p: BGMInstrument, rate: Double) {
        let total = l.count
        let start = Int((note.t * rate).rounded())
        let aN = max(1, Int((p.attack * rate).rounded()))
        let dN = Int((note.d * rate).rounded())
        let relN = max(1, Int((p.release * rate).rounded()))
        let count = dN + relN
        let kb = p.tau > 0 ? exp(-1 / (p.tau * rate)) : 1
        let amp = p.gain * note.v
        var gl = (((1 - p.pan) / 2).squareRoot()) * amp, gr = (((1 + p.pan) / 2).squareRoot()) * amp
        let inc = note.f / rate
        var ph = 0.0, ph2 = 0.0, ph3 = 0.0, body = 1.0
        var up = 1.0, dn = 1.0, kx = 1.0, x = 1.0, prev = 0.0
        var seed = UInt32(truncatingIfNeeded: start + 1)
        if seed == 0 { seed = 1 }
        switch p.kind {
        case .pad: up = pow(2, p.detune / 1200); dn = 1 / up; gl = amp; gr = amp
        case .fm: kx = exp(-1 / (p.indexTau * rate)); x = p.index
        case .mallet: kx = exp(-1 / (p.partialTau * rate)); x = p.partialGain
        default: break
        }
        let ts = Double(tableSize)
        func at(_ table: [Float], _ phase: Double) -> Double { Double(table[Int(phase * ts)]) }
        for i in 0..<count {
            var e = i < aN ? Double(i) / Double(aN) : body
            if i >= aN { body *= kb }
            if i >= dN { e *= 1 - Double(i - dN) / Double(relN) }
            let j = (start + i) % total
            var s = 0.0
            switch p.kind {
            case .fm:
                let m = ph + (x + p.indexBase) * at(sine, ph) / (2 * Double.pi)
                s = at(sine, m - m.rounded(.down))
                x *= kx
                ph += inc; if ph >= 1 { ph -= 1 }
            case .mallet:
                s = at(sine, ph) + x * at(sine, ph2)
                x *= kx
                ph += inc; if ph >= 1 { ph -= 1 }
                ph2 += inc * p.partial; if ph2 >= 1 { ph2 -= ph2.rounded(.down) }
            case .bass:
                s = at(sine, ph) + 0.35 * at(sine, ph2) + 0.12 * at(sine, ph3)
                ph += inc; if ph >= 1 { ph -= 1 }
                ph2 += 2 * inc; if ph2 >= 1 { ph2 -= 1 }
                ph3 += 3 * inc; if ph3 >= 1 { ph3 -= 1 }
            case .pad:
                // 2 本を少しずらして左右に広げる
                let a1 = at(softSaw, ph), a2 = at(softSaw, ph2)
                ph += inc * up; if ph >= 1 { ph -= 1 }
                ph2 += inc * dn; if ph2 >= 1 { ph2 -= 1 }
                l[j] += Float((a1 * 0.8 + a2 * 0.2) * e * gl)
                r[j] += Float((a2 * 0.8 + a1 * 0.2) * e * gr)
                continue
            case .noise:
                // web と同じ線形合同法。差分で低い成分を落とす
                seed = seed &* 1664525 &+ 1013904223
                let w = Double(seed) / 2147483648 - 1
                s = w - prev; prev = w
            }
            l[j] += Float(s * e * gl)
            r[j] += Float(s * e * gr)
        }
    }

    /// くし形 4 本＋全域通過 2 本。ループの継ぎ目が切れないよう、2 周回して 2 周目を使う。
    private static func reverb(_ x: [Float], rate: Double, song: BGMSong, spread: Double) -> [Float] {
        let n = x.count
        var out = [Float](repeating: 0, count: n)
        var cb = combs.map { [Float](repeating: 0, count: Int((($0 + spread) * rate).rounded())) }
        var ab = allpass.map { [Float](repeating: 0, count: Int(($0 * rate).rounded())) }
        var cp = [0, 0, 0, 0], lp: [Float] = [0, 0, 0, 0], ap = [0, 0]
        let fb = Float(song.feedback), damp = Float(song.damp)
        for pass in 0..<2 {
            for i in 0..<n {
                let inp = x[i] * 0.25
                var y: Float = 0
                for k in 0..<4 {
                    let o = cb[k][cp[k]]
                    lp[k] = o * (1 - damp) + lp[k] * damp
                    cb[k][cp[k]] = inp + lp[k] * fb
                    cp[k] += 1; if cp[k] >= cb[k].count { cp[k] = 0 }
                    y += o
                }
                for k in 0..<2 {
                    let o = ab[k][ap[k]]
                    ab[k][ap[k]] = y + o * 0.5
                    ap[k] += 1; if ap[k] >= ab[k].count { ap[k] = 0 }
                    y = o - y * 0.5
                }
                if pass == 1 { out[i] = y }
            }
        }
        return out
    }
}
