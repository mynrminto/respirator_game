import AVFoundation
import Foundation

/// BGM。タイトルの曲、昼の曲・夜の曲、アラームの曲の 4 曲を、音のファイルを持たずにその場で合成する（web/bgm.js と同じ曲・同じ音色・同じ手順）。
///
/// - title … タイトル。ハ長調・118 BPM。弾むベース、裏拍で跳ねるエレピ、頭からマリンバの旋律、後半はオルゴールを重ねる。
/// - day   … 昼。ハ長調・88 BPM。エレピの和音、やわらかいベース、小さなシェイカー、後半にマリンバの旋律。
/// - night … 夜。ハ長調・72 BPM。ゆっくり立ち上がるパッド、低いベース、オルゴールの高い音。不穏にならない静かな夜。
/// - alarm … アラームが出ているあいだだけ。イ短調・100 BPM。刻むベース、パッド、マリンバの分散和音。暗い曲はこれだけ。
///
/// 流す場所と時刻は Web 版と同じ。
/// - タイトル … タイトルの曲
/// - 物語の幕 … 幕ごとの時刻（StoryScene.time）
/// - レッスン … 章の時刻（StoryLibrary.chapterTime）。第1章＝初日の夜、第5章＝当直の夜、ほかは昼
/// - 症例で練習 … 端末の時計。6 時〜17 時台は昼、それ以外は夜
/// - レッスン・症例でアラーム（黄・赤）が出ているあいだ … アラームの曲（消音の 2 分間も、アラームが続くあいだはそのまま）。
///   アラームが hold 秒続けて消えたら元の曲へ戻る。
/// 切り替えは 2.5 秒のクロスフェード。
///
/// 音量はアラームやパルス音よりずっと小さく、アラームが鳴っているあいだはさらに下げる。
/// 音全体（SoundBoard.isEnabled）を切ると BGM も止まる。BGM だけ切ることもできる（メニュー）。
/// オーディオセッションは SoundBoard と同じ .ambient なので、マナーモードでは鳴らない。
///
/// 録音した曲（Suno で作った曲）が `Bundle.main/assets/bgm/bgm_<曲>.m4a` にあれば、合成の代わりにそれを流す
/// （web/assets/bgm をフォルダ参照で同梱。44.1 kHz・ステレオ、小節の頭で切ったループ、音量は合成の曲にそろえてある）。
/// 末尾の AAC の詰め物は bgm.json のフレーム数で切り落とす。ファイルが無い曲は今までどおり合成する。
///
/// 楽譜と音色の数値は BGMScore.swift（web/tools/bgm-swift.js が bgm.js から書き出す）。
/// 1 曲分（30〜55 秒）を裏で合成してループで流す。場面に入った瞬間に鳴るよう、起動直後（prepareAll）に
/// 全曲を並べて作り始め、できた波形は端末のキャッシュに取っておく（2 回目からは読むだけ）。
final class BGMPlayer {
    static let shared = BGMPlayer()

    private static let enabledKey = "ventsim.bgm.v1"
    /// アラームが消えてから元の曲へ戻るまで（秒）。鳴ったり止んだりで曲が行き来しないように。bgm.js の HOLD と同じ。
    static let hold: TimeInterval = 3
    /// 合成の手順を変えたら上げる（端末に取ってある古い波形を使わないように）。
    private static let synthVersion = 2

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
    /// 録音した曲の形式。プレイヤーは形式ごとに 2 本ずつ持つ（0・1 が合成、2・3 が録音）。
    private static let fileRate: Double = 44100
    /// 録音しかない曲が読めないときに代わりに合成する曲（bgm.js の FALLBACK と同じ）。
    static let fallback: [String: String] = ["breath": "day", "nicu": "night"]
    private let fileFormat = AVAudioFormat(standardFormatWithSampleRate: BGMPlayer.fileRate, channels: 2)!
    private let bus = AVAudioMixerNode()
    private var nodes: [AVAudioPlayerNode] = []
    private var nodeTrack: [String?] = [nil, nil, nil, nil]
    private var active = 0
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    private var rendering: Set<String> = []
    private var wanted: String?
    private var playing: String?
    private var ducked = false
    private var lastAlarm = -Double.infinity
    private var fadeTimer: Timer?
    private var attached = false

    private init() {}

    private func attach() {
        guard !attached else { return }
        attached = true
        let engine = SoundBoard.shared.engine
        engine.attach(bus)
        engine.connect(bus, to: engine.mainMixerNode, format: nil)
        bus.outputVolume = BGMScore.gain * (ducked ? BGMScore.duck : 1)
        for f in [format, format, fileFormat, fileFormat] {
            let n = AVAudioPlayerNode()
            engine.attach(n)
            engine.connect(n, to: bus, format: f)
            n.volume = 0
            nodes.append(n)
        }
    }

    /// 起動直後に一度呼ぶ。全曲を裏で作り始める（タイトルの曲を先に）。何度呼んでもよい。
    func prepareAll() {
        for track in ["title", "day", "night", "alarm", "breath", "nicu"] { prepare(track) }
    }

    /// 流したい曲を伝える（"title" / "day" / "night" / "alarm" / nil）。何度呼んでもよい。
    func want(_ track: String?) {
        let track = track.flatMap { BGMScore.songs[$0] ?? Self.fallback[$0].flatMap { BGMScore.songs[$0] } == nil && Self.fileURL($0) == nil ? nil : $0 }
        let now = ProcessInfo.processInfo.systemUptime
        if track == "alarm" {
            lastAlarm = now
        } else if wanted == "alarm", track == "day" || track == "night", now - lastAlarm < Self.hold {
            return
        }
        wanted = track
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
            // 曲の形式に合うプレイヤー 2 本のうち、いま鳴っていないほう
            let pair = buffer.format.sampleRate == fileFormat.sampleRate ? [2, 3] : [0, 1]
            active = pair[0] == old ? pair[1] : pair[0]
            let n = nodes[active]
            n.stop()
            n.volume = 0
            n.scheduleBuffer(buffer, at: nil, options: .loops)
            n.play()
            nodeTrack[active] = target
        }
        crossfade(from: old, to: target == nil ? nil : active)
    }

    /// new を上げ、ほかの鳴っているプレイヤーはすべて下げて止める（途中で次の切り替えが来ても置き去りにしない）。
    private func crossfade(from old: Int, to new: Int?) {
        fadeTimer?.invalidate()
        let start = Date()
        let outs = nodes.indices.filter { $0 != new && (nodes[$0].isPlaying || nodes[$0].volume > 0 || $0 == old) }
        let outStart = outs.map { nodes[$0].volume }
        let newStart = new.map { nodes[$0].volume } ?? 0
        fadeTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            let k = Float(min(1, Date().timeIntervalSince(start) / BGMScore.fade))
            for (i, n) in outs.enumerated() { self.nodes[n].volume = outStart[i] * (1 - k) }
            if let new { self.nodes[new].volume = newStart + (1 - newStart) * k }
            if k >= 1 {
                timer.invalidate()
                for n in outs { self.nodes[n].stop(); self.nodeTrack[n] = nil }
            }
        }
    }

    /// 裏で 1 曲作る（端末に取ってあれば読むだけ）。曲ごとに別々に走るので、4 曲が並んで進む。
    private func prepare(_ track: String) {
        guard buffers[track] == nil, !rendering.contains(track) else { return }
        if let url = Self.fileURL(track) {
            rendering.insert(track)
            let frames = Self.fileFrames[track]
            DispatchQueue.global(qos: track == "title" ? .userInitiated : .utility).async {
                let buffer = Self.read(url, frames: frames)
                DispatchQueue.main.async {
                    self.rendering.remove(track)
                    if let buffer { self.buffers[track] = buffer; self.apply() }
                    else { self.synthesize(track) }   // 読めなければ合成に落ちる
                }
            }
            return
        }
        synthesize(track)
    }

    private func synthesize(_ track: String) {
        guard buffers[track] == nil, !rendering.contains(track),
              let song = BGMScore.songs[track] ?? Self.fallback[track].flatMap({ BGMScore.songs[$0] }) else { return }
        rendering.insert(track)
        let format = self.format
        DispatchQueue.global(qos: track == "title" ? .userInitiated : .utility).async {
            let file = Self.cacheFile(track, song: song)
            let n = Int((song.length * BGMScore.rate).rounded())
            let buffer = Self.load(file, frames: n, format: format) ?? {
                let (l, r) = BGMSynth.render(song: song, rate: BGMScore.rate)
                let b = Self.buffer(l, r, format: format)
                if let b { Self.save(b, to: file, track: track) }
                return b
            }()
            DispatchQueue.main.async {
                self.rendering.remove(track)
                guard let buffer else { return }
                self.buffers[track] = buffer
                self.apply()
            }
        }
    }

    // MARK: 録音した曲（Bundle.main/assets/bgm）

    private static func fileURL(_ track: String) -> URL? {
        Bundle.main.url(forResource: "bgm_\(track)", withExtension: "m4a", subdirectory: "assets/bgm")
    }

    /// 曲ごとのループの長さ（44.1 kHz のフレーム数）。bgm.json に書いてある。
    private static let fileFrames: [String: Int] = {
        guard let url = Bundle.main.url(forResource: "bgm", withExtension: "json", subdirectory: "assets/bgm"),
              let data = try? Data(contentsOf: url),
              let table = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let frames = table["frames"] as? [String: NSNumber] else { return [:] }
        return frames.mapValues { $0.intValue }
    }()

    /// 1 曲を丸ごと読む。末尾の詰め物は frames で切る。44.1 kHz・ステレオでなければ使わない。
    private static func read(_ url: URL, frames: Int?) -> AVAudioPCMBuffer? {
        guard let file = try? AVAudioFile(forReading: url),
              file.processingFormat.sampleRate == fileRate, file.processingFormat.channelCount == 2,
              let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
              (try? file.read(into: buffer)) != nil, buffer.frameLength > 0 else { return nil }
        if let frames, frames > 0, frames < Int(buffer.frameLength) { buffer.frameLength = AVAudioFrameCount(frames) }
        return buffer
    }

    private static func buffer(_ l: [Float], _ r: [Float], format: AVAudioFormat) -> AVAudioPCMBuffer? {
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(l.count)),
              let ch = buffer.floatChannelData else { return nil }
        buffer.frameLength = AVAudioFrameCount(l.count)
        l.withUnsafeBufferPointer { ch[0].update(from: $0.baseAddress!, count: l.count) }
        r.withUnsafeBufferPointer { ch[1].update(from: $0.baseAddress!, count: r.count) }
        return buffer
    }

    // MARK: 端末のキャッシュ（Caches/bgm/曲-楽譜の指紋.f32。L のあとに R を並べた 32 ビット浮動小数点）

    private static var cacheDir: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.appendingPathComponent("bgm", isDirectory: true)
    }

    /// 楽譜・音色・合成の手順が変われば別の名前になる（FNV-1a）。
    private static func cacheFile(_ track: String, song: BGMSong) -> URL? {
        var h: UInt64 = 0xcbf2_9ce4_8422_2325
        func mix(_ d: Double) {
            var b = d.bitPattern
            for _ in 0..<8 { h = (h ^ (b & 0xff)) &* 0x100_0000_01b3; b >>= 8 }
        }
        mix(Double(synthVersion)); mix(BGMScore.rate)
        mix(song.length); mix(song.feedback); mix(song.damp); mix(song.wet)
        for note in song.notes {
            note.inst.utf8.forEach { mix(Double($0)) }
            mix(note.t); mix(note.d); mix(note.f); mix(note.v)
        }
        for (name, p) in BGMScore.instruments.sorted(by: { $0.key < $1.key }) {
            name.utf8.forEach { mix(Double($0)) }
            [p.attack, p.tau, p.release, p.gain, p.pan, p.index, p.indexTau, p.indexBase,
             p.partial, p.partialGain, p.partialTau, p.detune].forEach(mix)
        }
        return cacheDir?.appendingPathComponent("\(track)-\(String(h, radix: 16)).f32")
    }

    private static func load(_ file: URL?, frames n: Int, format: AVAudioFormat) -> AVAudioPCMBuffer? {
        guard let file, let data = try? Data(contentsOf: file), data.count == n * 2 * MemoryLayout<Float>.size,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(n)),
              let ch = buffer.floatChannelData else { return nil }
        buffer.frameLength = AVAudioFrameCount(n)
        data.withUnsafeBytes { raw in
            let f = raw.bindMemory(to: Float.self)
            ch[0].update(from: f.baseAddress!, count: n)
            ch[1].update(from: f.baseAddress! + n, count: n)
        }
        return buffer
    }

    /// 書き込めなくても鳴らすのには困らない（次の起動でまた作る）。同じ曲の古い版は消す。
    private static func save(_ buffer: AVAudioPCMBuffer, to file: URL?, track: String) {
        guard let file, let dir = cacheDir, let ch = buffer.floatChannelData else { return }
        let n = Int(buffer.frameLength)
        var data = Data(capacity: n * 2 * MemoryLayout<Float>.size)
        data.append(UnsafeBufferPointer(start: ch[0], count: n))
        data.append(UnsafeBufferPointer(start: ch[1], count: n))
        let fm = FileManager.default
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        for old in (try? fm.contentsOfDirectory(atPath: dir.path)) ?? []
        where old.hasPrefix(track + "-") && old != file.lastPathComponent {
            try? fm.removeItem(at: dir.appendingPathComponent(old))
        }
        try? data.write(to: file, options: .atomic)
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

/// Xcode の Debug（最適化なし）でも 1 曲 1 秒ほどで作れるよう、音を足す内側のループでは
/// 配列の添字や min・max・入れ子の関数を使わず、ポインタと四則演算だけで書く
/// （配列のままだと Debug では 1 曲 7〜12 秒かかり、そのあいだ BGM が鳴らなかった）。
enum BGMSynth {
    static let tableSize = 4096
    /// 表は一度だけ作ってアプリが終わるまで持つ（解放しない）。
    static let sine: UnsafeMutablePointer<Float> = table((0...tableSize).map { sin(2 * Double.pi * Double($0) / Double(tableSize)) })
    /// 8 倍音までのやわらかいのこぎり波（1/n^1.3）。ピークで割って ±1 にそろえる。
    static let softSaw: UnsafeMutablePointer<Float> = {
        let t = (0...tableSize).map { i -> Double in
            let x = Double(i) / Double(tableSize)
            return (1...8).reduce(0.0) { $0 + sin(2 * Double.pi * Double($1) * x) / pow(Double($1), 1.3) }
        }
        let peak = t.map(abs).max() ?? 1
        return table(t.map { $0 / peak })
    }()

    private static func table(_ v: [Double]) -> UnsafeMutablePointer<Float> {
        let p = UnsafeMutablePointer<Float>.allocate(capacity: v.count)
        for (i, x) in v.enumerated() { p[i] = Float(x) }
        return p
    }

    static let combs = [0.0297, 0.0371, 0.0411, 0.0437]
    static let allpass = [0.005, 0.0017]
    static let spread = 0.0011

    static func render(song: BGMSong, rate: Double) -> ([Float], [Float]) {
        let n = Int((song.length * rate).rounded())
        var left = [Float](repeating: 0, count: n), right = [Float](repeating: 0, count: n)
        let wl = UnsafeMutablePointer<Float>.allocate(capacity: n), wr = UnsafeMutablePointer<Float>.allocate(capacity: n)
        defer { wl.deallocate(); wr.deallocate() }
        left.withUnsafeMutableBufferPointer { lb in
            right.withUnsafeMutableBufferPointer { rb in
                let l = lb.baseAddress!, r = rb.baseAddress!
                for note in song.notes {
                    guard let p = BGMScore.instruments[note.inst] else { continue }
                    voice(into: l, r, total: n, note: note, p: p, rate: rate)
                }
                reverb(l, into: wl, count: n, rate: rate, song: song, spread: 0)
                reverb(r, into: wr, count: n, rate: rate, song: song, spread: spread)
                let wet = Float(song.wet), dry = 1 - wet, w3 = wet * 3
                var peak: Float = 1e-9
                for i in 0..<n {
                    let a = l[i] * dry + wl[i] * w3, b = r[i] * dry + wr[i] * w3
                    l[i] = a; r[i] = b
                    let m = a < 0 ? -a : a, k = b < 0 ? -b : b
                    if m > peak { peak = m }
                    if k > peak { peak = k }
                }
                let g = 0.8 / peak
                for i in 0..<n { l[i] *= g; r[i] *= g }
            }
        }
        return (left, right)
    }

    /// 1 音を L・R に足し込む。ループの長さを超えた分は頭へ回り込む。
    /// a 秒で直線に立ち上がり、時定数 tau で減衰（0 なら平ら）、長さ d を過ぎたら rel 秒で直線に消える。
    private static func voice(into l: UnsafeMutablePointer<Float>, _ r: UnsafeMutablePointer<Float>, total: Int,
                              note: BGMNote, p: BGMInstrument, rate: Double) {
        let start = Int((note.t * rate).rounded())
        let aN = Swift.max(1, Int((p.attack * rate).rounded()))
        let dN = Int((note.d * rate).rounded())
        let relN = Swift.max(1, Int((p.release * rate).rounded()))
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
        let ts = Double(tableSize), twoPi = 2 * Double.pi
        let sine = Self.sine, saw = Self.softSaw
        let ib = p.indexBase, pg = p.partial, kind = p.kind
        let invA = 1 / Double(aN), invRel = 1 / Double(relN)
        var j = start % total
        for i in 0..<count {
            var e: Double
            if i < aN { e = Double(i) * invA } else { e = body; body *= kb }
            if i >= dN { e *= 1 - Double(i - dN) * invRel }
            var s = 0.0
            switch kind {
            case .fm:
                var m = ph + (x + ib) * Double(sine[Int(ph * ts)]) / twoPi
                m -= m.rounded(.down)
                s = Double(sine[Int(m * ts)])
                x *= kx
                ph += inc; if ph >= 1 { ph -= 1 }
            case .mallet:
                s = Double(sine[Int(ph * ts)]) + x * Double(sine[Int(ph2 * ts)])
                x *= kx
                ph += inc; if ph >= 1 { ph -= 1 }
                ph2 += inc * pg; if ph2 >= 1 { ph2 -= ph2.rounded(.down) }
            case .bass:
                s = Double(sine[Int(ph * ts)]) + 0.35 * Double(sine[Int(ph2 * ts)]) + 0.12 * Double(sine[Int(ph3 * ts)])
                ph += inc; if ph >= 1 { ph -= 1 }
                ph2 += 2 * inc; if ph2 >= 1 { ph2 -= 1 }
                ph3 += 3 * inc; if ph3 >= 1 { ph3 -= 1 }
            case .pad:
                // 2 本を少しずらして左右に広げる
                let a1 = Double(saw[Int(ph * ts)]), a2 = Double(saw[Int(ph2 * ts)])
                ph += inc * up; if ph >= 1 { ph -= 1 }
                ph2 += inc * dn; if ph2 >= 1 { ph2 -= 1 }
                l[j] += Float((a1 * 0.8 + a2 * 0.2) * e * gl)
                r[j] += Float((a2 * 0.8 + a1 * 0.2) * e * gr)
                j += 1; if j >= total { j = 0 }
                continue
            case .noise:
                // web と同じ線形合同法。差分で低い成分を落とす
                seed = seed &* 1664525 &+ 1013904223
                let w = Double(seed) / 2147483648 - 1
                s = w - prev; prev = w
            }
            l[j] += Float(s * e * gl)
            r[j] += Float(s * e * gr)
            j += 1; if j >= total { j = 0 }
        }
    }

    /// くし形 4 本＋全域通過 2 本。ループの継ぎ目が切れないよう、2 周回して 2 周目を使う。
    private static func reverb(_ x: UnsafeMutablePointer<Float>, into out: UnsafeMutablePointer<Float>, count n: Int,
                               rate: Double, song: BGMSong, spread: Double) {
        let len = combs.map { Int((($0 + spread) * rate).rounded()) } + allpass.map { Int(($0 * rate).rounded()) }
        let buf = len.map { c -> UnsafeMutablePointer<Float> in
            let p = UnsafeMutablePointer<Float>.allocate(capacity: c)
            p.initialize(repeating: 0, count: c)
            return p
        }
        defer { buf.forEach { $0.deallocate() } }
        let c0 = buf[0], c1 = buf[1], c2 = buf[2], c3 = buf[3], a0 = buf[4], a1 = buf[5]
        let n0 = len[0], n1 = len[1], n2 = len[2], n3 = len[3], m0 = len[4], m1 = len[5]
        var p0 = 0, p1 = 0, p2 = 0, p3 = 0, q0 = 0, q1 = 0
        var lp0: Float = 0, lp1: Float = 0, lp2: Float = 0, lp3: Float = 0
        let fb = Float(song.feedback), damp = Float(song.damp), keep = 1 - damp
        for pass in 0..<2 {
            for i in 0..<n {
                let inp = x[i] * 0.25
                let o0 = c0[p0], o1 = c1[p1], o2 = c2[p2], o3 = c3[p3]
                lp0 = o0 * keep + lp0 * damp; c0[p0] = inp + lp0 * fb; p0 += 1; if p0 >= n0 { p0 = 0 }
                lp1 = o1 * keep + lp1 * damp; c1[p1] = inp + lp1 * fb; p1 += 1; if p1 >= n1 { p1 = 0 }
                lp2 = o2 * keep + lp2 * damp; c2[p2] = inp + lp2 * fb; p2 += 1; if p2 >= n2 { p2 = 0 }
                lp3 = o3 * keep + lp3 * damp; c3[p3] = inp + lp3 * fb; p3 += 1; if p3 >= n3 { p3 = 0 }
                var y = o0 + o1 + o2 + o3
                let b0 = a0[q0]; a0[q0] = y + b0 * 0.5; q0 += 1; if q0 >= m0 { q0 = 0 }; y = b0 - y * 0.5
                let b1 = a1[q1]; a1[q1] = y + b1 * 0.5; q1 += 1; if q1 >= m1 { q1 = 0 }; y = b1 - y * 0.5
                if pass == 1 { out[i] = y }
            }
        }
    }
}
