import Foundation

/* 第12・13章。web/lessons.js の CH12・CH13 と同じ内容（課題の順番・クイズの正解・押す場所）。
 * ローテ最後の週の NICU。在胎 25 週のつむぎちゃんを HFO から NAVA、鼻の NIV-NAVA へ、
 * 同じ日のあおい君を HFNC へ移す。
 * HFO の 3 つのつまみ：酸素化は MAP、CO₂ は振幅（Amp）と周波数（Freq）。
 * 周波数を下げると一回の揺れが大きくなり、かえって CO₂ が下がる（VentilatorEngine.stepHFO）。 */
extension LessonLibrary {

    /// HFO の一回換気量（mL/kg）。
    static func hfoTidalPerKg(_ c: LessonContext) -> Double { c.measured.hfoTidalVolume / c.pbw }

    // MARK: - 第12章 ふるえる息（HFO）

    static let lesson12_1 = Lesson(
        id: "12-1", title: "揺らして、ひらく", minutes: 9, scenarioID: "micro",
        prepare: { s in
            s.mode = .pressureAssistControl
            s.inspiratoryPressure = 20; s.peep = 6; s.respiratoryRate = 55; s.fio2 = 0.7; s.inspiratoryTime = 0.3
            s.hfoMeanPressure = 10; s.hfoAmplitude = 15; s.hfoFrequency = 12
        },
        sedation: 0.85,
        brief: [
            "HFO（高頻度振動換気）は、平均気道内圧 MAP のまわりで、1 秒に 10〜15 回の小さな揺れを送る。",
            "1 回の量（VThf）は死腔より小さい。肺を大きく膨らませたりしぼませたりしないので、傷めにくい。",
            "始めは MAP を、従来の換気の平均気道内圧より 2〜3 cmH₂O 高く。酸素化は MAP で決まる。",
            "振幅（Amp）は、胸の揺れがおへそのあたりまで見える大きさから。VThf は 1.5〜2.5 mL/kg が目安。"
        ],
        points: ["HFO は MAP のまわりの小さく速い揺れ",
                 "MAP は従来の換気の平均気道内圧 ＋2〜3 から",
                 "VThf 1.5〜2.5 mL/kg、胸がおへそまで揺れる振幅"],
        tasks: [
            .talk(.scene, "4 週目の朝。NICU の奥の保育器に、在胎 25 週で生まれた女の子がいる。体重 720 g。つむぎちゃん。"),
            .talk(.scene, "サーファクタントは 2 回入った。それでも胸はほとんど上がらず、酸素は 70% のままだ。"),
            .talk(.doctor, "P insp を上げても、思うほど量が入りません。肺が硬く、圧を上げるほど、肺の傷（空気の漏れ）が増えていきます。")
                .looking(["val:PIP", "val:Vte"]),
            .talk(.puku, "じゃあ、どうするの？ もっと押すの？"),
            .talk(.doctor, "押すのをやめて、揺らします。高頻度振動換気、HFO。1 秒に 10〜15 回、小さな揺れを送り続ける呼吸器です。"),
            .talk(.doctor, "肺は、平均気道内圧（MAP）で膨らんだまま保たれます。血圧の平均（ABP mean）とは別物です。いまの換気の平均気道内圧は {Pmean} cmH₂O。HFO の MAP は、これより 2〜3 高く始めます。"),
            .key("モードを HFO に切り替えてください。",
                 event: .modeHFO,
                 why: "波形が細かく震えはじめました。圧の波形の真ん中の点線が MAP です。")
                .spotting(["mode:HFO"]),
            .step("MAP を 13 cmH₂O 以上にして確定してください。",
                  hint: "従来の換気の平均気道内圧より 2〜3 高く。MAP のキーで回します。",
                  hold: 10,
                  why: "肺胞を開いたまま保つ圧を、少し高く据えました。酸素化はここから上がってきます。",
                  check: { $0.settings.hfoMeanPressure >= 13 })
                .spotting(["key:map"]).watching(["Pmean", "SpO₂"]),
            .talk(.puku, "Amp と Freq は？"),
            .talk(.doctor, "Amp は振幅、揺れの大きさ（cmH₂O）。Freq は周波数、1 秒に何回揺らすか（Hz）です。1 回の揺れで動く量が VThf。CO₂ を出す力は「周波数 × VThf の 2 乗」で、これを DCO₂ と呼びます。"),
            .talk(.doctor, "口から肺胞までの、ガス交換をしない通り道を死腔と言います。新生児でおよそ 2 mL/kg。VThf は、それより小さいのがふつうです。"),
            .step("Amp を上げて、VThf を 1.5〜2.5 mL/kg に入れてください。",
                  hold: 10,
                  why: "つむぎちゃんの胸が、おへそのあたりまで細かく揺れています。ベッドサイドでは、この揺れを見て振幅を合わせます。",
                  check: { c in
                      let x = LessonLibrary.hfoTidalPerKg(c)
                      return x >= 1.5 && x <= 2.5
                  })
                .hinting { c in
                    "体重 " + LessonLibrary.number(c.pbw) + " kg なので " + LessonLibrary.mlkg(c.pbw, 1.5) + "〜"
                        + LessonLibrary.mlkg(c.pbw, 2.5) + " mL。VThf のタイルの右上が mL/kg です。"
                }
                .spotting(["key:amp"]).watching(["VThf", "DCO₂"]),
            .quiz("VThf は死腔より小さいのに、CO₂ が出ていくのはなぜですか。",
                  ["速い揺れで気道のガスがかき混ぜられ、少しずつ運ばれるから",
                   "肺胞で CO₂ が消えるから",
                   "酸素が CO₂ を押し出すから",
                   "実は出ていない"], answer: 0,
                  miss: [nil,
                   "CO₂ は体から出ていかなければ消えません。",
                   "酸素が押し出すわけではありません。",
                   "HFO でも CO₂ はきちんと下がります。"],
                  why: "気道の中で、揺れがガスを混ぜて運びます。CO₂ の出ていく量は DCO₂、つまり「周波数 × VThf の 2 乗」に比例します。画面の DCO₂ がその目安です。"),
            .talk(.doctor, "酸素化は MAP で決まります。肺が開いてきたら、FiO₂ から下げます。早産児の SpO₂ の目標は 90〜95% でしたね。"),
            .step("SpO₂ 90〜95% のまま、FiO₂ を 40% 以下に。",
                  hint: "SpO₂ が 90% に届かなければ、MAP を 1〜2 上げてから FiO₂ を下げます。",
                  hold: 30,
                  why: "70% だった酸素が {FiO₂}% まで下がりました。押さずに、開いて揺らす。これが HFO です。",
                  check: { $0.settings.fio2 <= 0.41 && $0.engine.spo2 >= 90 && $0.engine.spo2 <= 95 })
                .spotting(["key:fio2", "key:map"]).watching(["SpO₂", "Pmean", "ABP mean"])
        ])

    static let lesson12_2 = Lesson(
        id: "12-2", title: "CO₂ は揺れの大きさで", minutes: 9, scenarioID: "micro",
        prepare: { s in
            s.mode = .hfo
            s.hfoMeanPressure = 14; s.hfoAmplitude = 22; s.hfoFrequency = 15; s.fio2 = 0.4
        },
        sedation: 0.85,
        brief: [
            "HFO の CO₂ は、振幅（Amp）を上げると下がる。CO₂ の出ていく量は 周波数 × VThf² に比例する（DCO₂）。",
            "周波数を下げると、1 回の揺れが長くなって VThf が増え、CO₂ はかえって下がる。従来の換気と逆向き。",
            "HFO 中は etCO₂ が測れない。経皮 CO₂（tcPCO₂）で流れを追い、血液ガスで確かめる。",
            "CO₂ の下がりすぎは、早産児の脳の血流を減らす。目標は PaCO₂ 45〜55 前後。"
        ],
        points: ["CO₂ は Amp で下げる",
                 "周波数を下げると VThf が増え、CO₂ が下がる",
                 "tcPCO₂ で追い、血液ガスで確かめる"],
        tasks: [
            .talk(.scene, "生まれて 1 日目の夜。つむぎちゃんは HFO の上で、小さく揺れ続けている。"),
            .talk(.doctor, "HFO では、吐き出す息の CO₂（etCO₂）が測れません。代わりに、皮膚を温めて CO₂ を測る経皮 CO₂（tcPCO₂）を見ます。"),
            .talk(.puku, "tcPCO₂ が {tcPCO₂} …高くない？")
                .looking(["val:tcPCO₂"]),
            .key("「血液ガス」キーで採血してください。",
                 event: .orderBloodGas)
                .spotting(["hard:kAbg"]),
            .step("結果が返るまで待ちます。",
                  check: { !$0.bloodGases.isEmpty })
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "PaCO₂ %.0f mmHg、pH %.2f。", g.paco2, g.pH)
                        + (g.paco2 > 55 ? "CO₂ が溜まっています。" : "tcPCO₂ と同じ向きの値です。")
                }
                .watching(["tcPCO₂", "VThf"]),
            .talk(.doctor, "CO₂ を出すのは揺れです。まず振幅（Amp）を上げます。2〜3 cmH₂O ずつ、VThf と tcPCO₂ を見ながら。"),
            .step("Amp を上げて、VThf を 1.6 mL/kg 以上にしてください。",
                  hold: 10,
                  why: "VThf と DCO₂ が増えました。tcPCO₂ は数分遅れて下がってきます。",
                  check: { LessonLibrary.hfoTidalPerKg($0) >= 1.6 })
                .hinting { c in
                    "体重 " + LessonLibrary.number(c.pbw) + " kg なので " + LessonLibrary.mlkg(c.pbw, 1.6) + " mL 以上。"
                }
                .spotting(["key:amp"]).watching(["VThf", "DCO₂", "tcPCO₂"]),
            .talk(.puku, "じゃあ周波数は？ 従来の換気なら、回数を上げると CO₂ が下がったよね。"),
            .talk(.doctor, "HFO では逆です。周波数を上げると 1 回の揺れが短くなり、細いチューブの先まで届く揺れが小さくなります。"),
            .step("Freq を 10 Hz に下げて、VThf の変化を見ます。",
                  hold: 10,
                  why: "振幅は同じなのに、VThf が増えました。1 回の揺れが長いほど、チューブの先まで届くからです。このままでは CO₂ が下がりすぎるかもしれません。",
                  check: { $0.settings.hfoFrequency <= 10 })
                .spotting(["key:freq"]).watching(["VThf", "DCO₂", "tcPCO₂"]),
            .quiz("振幅をこれ以上上げたくない。CO₂ がまだ高い。周波数は？",
                  ["下げる", "上げる", "変えない", "0 にする"], answer: 0,
                  miss: [nil,
                   "上げると VThf が減り、CO₂ はかえって溜まります。",
                   "周波数も、CO₂ を動かすつまみです。",
                   "揺れが止まります。"],
                  why: "周波数を下げると VThf が増え、CO₂ が出ます。従来の換気の「回数」と、向きが逆になるのが HFO です。"),
            .step("tcPCO₂ が 45〜58 mmHg に入るまで待ちます。",
                  hint: "下がりすぎたら Amp を下げます。CO₂ の下がりすぎは、早産児の脳の血流を減らします。",
                  hold: 20,
                  why: "CO₂ が目標に入りました。HFO の CO₂ は振幅と周波数、酸素化は MAP。つまみの役割が分かれています。",
                  check: { $0.engine.tcpco2 >= 45 && $0.engine.tcpco2 <= 58 })
                .spotting(["key:amp", "key:freq"]).watching(["tcPCO₂", "VThf"]),
            .step("もう一度採血して、PaCO₂ を確かめてください。",
                  hint: "「血液ガス」キーで採血し、結果が返るまで待ちます。",
                  check: { c in
                      guard c.bloodGases.count >= 2, let g = c.lastBloodGas else { return false }
                      return g.paco2 >= 40 && g.paco2 <= 58
                  })
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "PaCO₂ %.0f mmHg、pH %.2f", g.paco2, g.pH)
                        + "。tcPCO₂ は流れを追うもの、答え合わせは血液ガスです。"
                }
                .spotting(["hard:kAbg"]).watching(["tcPCO₂"])
        ])

    static let lesson12_3 = Lesson(
        id: "12-3", title: "肺が開いたら、MAP を下げる", minutes: 9, scenarioID: "micro",
        prepare: { s in
            s.mode = .hfo
            s.hfoMeanPressure = 15; s.hfoAmplitude = 26; s.hfoFrequency = 12; s.fio2 = 0.35
        },
        sedation: 0.8,
        brief: [
            "肺が良くなると、同じ MAP では膨らみすぎる。胸部X線で横隔膜が第 9 後肋骨より下がっていたら過膨張。",
            "過膨張は心臓への血の戻りを妨げ、血圧を下げる。酸素化もかえって悪くなる。",
            "HFO からの離脱は、FiO₂ を 30% 前後まで下げてから、MAP を 1〜2 ずつ下げていく。"
        ],
        points: ["肺が良くなったら MAP を下げる",
                 "過膨張は血圧を下げる",
                 "FiO₂ を先に、MAP はそのあと少しずつ"],
        tasks: [
            .talk(.scene, "生まれて 3 日目の朝。胸部X線の肺は、白さがずいぶん抜けてきた。横隔膜は、背中側の肋骨で 10 本目まで下がっている。")
                .starting { c in
                    c.engine.setLungCompliance(0.00034)
                    c.engine.adjustPatient { p in
                        p.shuntAtLowPEEP = 0.32; p.shuntMinimum = 0.15
                        p.recruitmentP50 = 8; p.recruitmentK = 1.6
                        p.alveolarDeadSpaceFraction = 0.08
                    }
                },
            .talk(.doctor, "早産児の肺は、横隔膜が背中側の肋骨で 8〜9 本目にあるのがちょうどいい広がりです。10 本目は、膨らみすぎ。"),
            .talk(.puku, "良くなったのに、血圧が下がってきてるよ…？")
                .looking(["val:ABP mean", "val:SpO₂"]),
            .talk(.doctor, "肺が柔らかくなって、同じ MAP（平均気道内圧）では膨らみすぎたんです。膨らんだ肺が心臓を押し、血が戻りにくくなります。"),
            .step("MAP（平均気道内圧）を 1〜2 ずつ下げ、血圧（ABP mean）を保ってください。",
                  hint: "MAP を 11 前後まで。SpO₂ が 90% を切るなら下げすぎです。",
                  hold: 20,
                  why: "膨らみすぎがとれて、血圧が戻りました。酸素化も落ちていません。",
                  check: { c in
                      c.settings.hfoMeanPressure <= 12
                          && c.engine.meanArterialPressure >= c.engine.norms.meanArterialPressureMin + 2
                          && c.engine.spo2 >= 90
                  })
                .spotting(["key:map"]).watching(["ABP mean", "SpO₂", "Pmean"]),
            .quiz("HFO から降りる準備。先に下げるのはどれですか。",
                  ["FiO₂ を 30% 前後まで", "MAP を一気に 6 まで", "周波数を 5 Hz まで", "振幅を 0 まで"], answer: 0,
                  miss: [nil,
                   "MAP を急に下げると、開いた肺がまたしぼみます。",
                   "周波数は CO₂ のつまみです。",
                   "振幅が 0 では、CO₂ が出ていきません。"],
                  why: "酸素を先に、MAP はそのあと 1〜2 ずつ。開いた肺をしぼませないように、ゆっくり降ります。"),
            .step("SpO₂ 90〜95% のまま、FiO₂ を 30% 以下に。",
                  hold: 30,
                  why: "酸素は {FiO₂}%、MAP は {MAP}。HFO を降りる日が見えてきました。",
                  check: { $0.settings.fio2 <= 0.31 && $0.engine.spo2 >= 90 && $0.engine.spo2 <= 95 })
                .spotting(["key:fio2"]).watching(["SpO₂", "Pmean"]),
            .talk(.doctor, "数日のうちに、ふつうの換気に戻します。そのとき使うのは、つむぎちゃん自身の呼吸の合図に合わせる呼吸器です。")
        ])

    // MARK: - 第13章 自分のリズム（NAVA・NIV-NAVA・HFNC）

    /* つむぎちゃんの日齢 5〜7（NAVA → 抜管して NIV-NAVA）と、同じ日のあおい君（HFNC）。
     * NAVA は横隔膜の電気活動 Edi に比例して圧を足す。トリガも吸い終わりも Edi が決める。
     * NAVA レベルを上げると、呼吸中枢が力を抜き、Edi が下がる（Vte はあまり変わらない）。 */
    static func navaDay5(_ p: inout Patient) {
        p.ageLabel = "在胎25週 日齢5"; p.weightKg = 0.75
        p.compliance = 0.00045; p.shuntAtLowPEEP = 0.18; p.shuntMinimum = 0.06
        p.recruitmentP50 = 8; p.recruitmentK = 2.0; p.alveolarDeadSpaceFraction = 0.06
        p.hco3 = 24; p.hco3Base = 24; p.paco2 = 50; p.pao2 = 60
        p.sedation = 0.2; p.driveGain = 1.2; p.maxInspiratoryPressure = 9; p.meanArterialPressure = 36
    }

    static let lesson13_1 = Lesson(
        id: "13-1", title: "横隔膜の声を聞く", minutes: 8, scenarioID: "micro",
        patient: navaDay5,
        prepare: { s in
            s.mode = .pressureAssistControl
            s.inspiratoryPressure = 12; s.peep = 6; s.respiratoryRate = 40; s.fio2 = 0.3; s.inspiratoryTime = 0.3
            s.navaLevel = 0.5
        },
        sedation: 0.2,
        brief: [
            "Edi は横隔膜の電気活動（µV）。胃管の先の電極で測る、呼吸中枢の「吸え」という指令そのもの。",
            "NAVA は Edi に比例した圧を足す。NAVA レベル（cmH₂O/µV）は、Edi 1 µV あたりに足す圧。",
            "トリガも吸い終わりも Edi が決めるので、呼吸器が子どものリズムにぴったり合う。",
            "NAVA レベルを上げると Edi が下がり、Vte はあまり変わらない。Edi peak 5〜15 µV が目安。"
        ],
        points: ["Edi ＝ 呼吸中枢の指令",
                 "NAVA は Edi に比例して圧を足す",
                 "レベルを上げると Edi が下がる。Edi peak 5〜15"],
        tasks: [
            .talk(.scene, "生まれて 5 日目。つむぎちゃんは HFO を降り、ふつうの換気に戻った。鎮静も浅くなり、自分でも吸おうとしている。"),
            .talk(.scene, "胃に入っている管が、先に電極のついたものに替わった。画面の端に、見慣れない「Edi」の文字。"),
            .talk(.doctor, "Edi は横隔膜の電気活動です。脳の呼吸中枢が「吸え」と命じた強さが、そのまま µV（マイクロボルト）で出ます。"),
            .talk(.puku, "赤ちゃんが、どれだけ吸いたいか分かるってこと？"),
            .talk(.doctor, "そうです。その Edi に比例して圧を足すのが NAVA。吸いはじめも、吸い終わりも、つむぎちゃんの呼吸中枢が決めます。"),
            .key("モードを NAVA に切り替えてください。",
                 event: .modeNAVA,
                 why: "NAVA のキーは、NAVA レベルと PEEP、FiO₂。P insp・RR・Ti は、息が止まったときのバックアップ換気の設定です。")
                .spotting(["mode:NAVA"]),
            .step("Edi peak が出るまで待ちます。",
                  hold: 15,
                  why: "Edi peak は 1 回の吸気の山、Edi min は吐いているときの谷です。",
                  check: { $0.measured.ediPeak != nil && $0.engine.clock > 20 })
                .spotting(["val:Edi peak"]).watching(["Edi peak", "Edi min", "PIP", "RR tot"]),
            .talk(.doctor, "NAVA レベルは、Edi 1 µV あたりに足す圧（cmH₂O/µV）。いまは {NAVA}。手伝いが少ないので、Edi peak が {Edi peak} µV と高めです。"),
            .step("NAVA を 1.5 に上げて、Edi と Vte を見ます。",
                  hold: 40,
                  why: "PIP は上がり、Edi peak は下がりました。Vte はあまり変わっていません。",
                  check: { $0.settings.navaLevel >= 1.45 })
                .spotting(["key:nava"]).watching(["Edi peak", "Vte", "PIP", "RR tot"]),
            .quiz("NAVA レベルを上げたら Edi peak が下がりました。なぜですか。",
                  ["機械が手伝う分、呼吸中枢が力を抜いたから",
                   "電極がずれたから",
                   "肺が硬くなったから",
                   "鎮静が深くなったから"], answer: 0,
                  miss: [nil,
                   "ずれたなら、Edi は急に消えたり乱れたりします。",
                   "肺の硬さは変わっていません。",
                   "鎮静は触っていません。"],
                  why: "子どもは、必要な量だけ吸おうとします。機械が手伝うほど、自分の力は少なくて済む。Edi はその「がんばり」の目盛りです。"),
            .talk(.doctor, "Edi peak が 15 µV を超えるなら手伝い不足、5 µV を切るなら手伝いすぎ。その間に入る NAVA レベルを探します。"),
            .step("Edi peak を 5〜15 µV に入れて、保ってください。",
                  hint: "NAVA レベルは 0.5〜2 cmH₂O/µV が目安です。",
                  hold: 30,
                  why: "つむぎちゃんのがんばりと、機械の手伝いの釣り合いがとれました。",
                  check: { c in
                      guard let peak = c.measured.ediPeak else { return false }
                      return peak >= 5 && peak <= 15 && c.engine.spo2 >= 90
                  })
                .spotting(["key:nava"]).watching(["Edi peak", "Vte", "SpO₂"])
        ])

    static let lesson13_2 = Lesson(
        id: "13-2", title: "息が止まっても", minutes: 9, scenarioID: "micro",
        patient: navaDay5,
        prepare: { s in
            s.mode = .nava
            s.navaLevel = 1.5; s.peep = 4; s.fio2 = 0.3
            s.inspiratoryPressure = 12; s.respiratoryRate = 30; s.inspiratoryTime = 0.3
        },
        sedation: 0.2,
        brief: [
            "Edi min は吐いているときの横隔膜の緊張。高いのは、肺がしぼまないよう横隔膜がブレーキをかけている印。",
            "Edi min が高ければ PEEP を上げる。肺を PEEP で支えると、横隔膜が休める。",
            "早産児は呼吸中枢が未熟で、息が止まる（無呼吸発作）。Edi が平らになるのが目印。",
            "NAVA は Edi が止まると、設定の P insp・RR でバックアップ換気をする。戻れば NAVA に戻る。"
        ],
        points: ["Edi min が高ければ PEEP を上げる",
                 "無呼吸では Edi が平らになる",
                 "バックアップ換気が安全網"],
        tasks: [
            .talk(.scene, "生まれて 6 日目の夜。つむぎちゃんの呼吸は、速くなったり、間があいたりをくり返している。")
                .starting { c in
                    c.engine.adjustPatient { p in p.recruitmentP50 = 9 }
                },
            .talk(.doctor, "Edi min を見てください。吐いているあいだも、横隔膜が {Edi min} µV 働いています。")
                .looking(["val:Edi min"]),
            .talk(.puku, "吐いてるときなのに、どうして働くの？"),
            .talk(.doctor, "肺がしぼみかけていると、吐ききらないよう横隔膜がブレーキをかけます。PEEP で支えてあげれば、そのブレーキが要らなくなります。"),
            .step("PEEP を上げて、Edi min を 3 µV 未満にしてください。",
                  hint: "PEEP を 1 ずつ。6〜7 が目安です。",
                  hold: 20,
                  why: "Edi min が下がりました。横隔膜が、吐くたびにブレーキをかけなくてよくなりました。",
                  check: { c in
                      guard let low = c.measured.ediMin else { return false }
                      return low < 3
                  })
                .spotting(["key:peep"]).watching(["Edi min", "Edi peak", "SpO₂"]),
            .talk(.scene, "そのとき、Edi の線が、すっと平らになった。つむぎちゃんの胸が止まっている。")
                .starting { c in
                    c.engine.centralApnea(seconds: 25)
                },
            .step("画面の変化を見ます。",
                  why: "Edi が止まって 5 秒。呼吸器が、設定の P insp と RR でバックアップ換気を始めました。",
                  check: { $0.engine.navaBackup })
                .spotting(["val:Edi peak"]).watching(["RR tot", "SpO₂", "HR"]),
            .talk(.doctor, "無呼吸発作です。早産の子は呼吸中枢が未熟で、ときどき「吸え」を出し忘れます。だから Edi が平らになる。"),
            .step("つむぎちゃんの呼吸が戻るまで待ちます。",
                  why: "Edi が戻ると、呼吸器は NAVA に戻りました。バックアップは、止まったときだけの安全網です。",
                  check: { !$0.engine.navaBackup && $0.engine.clock > $0.engine.apneaUntil + 5 })
                .watching(["RR tot", "SpO₂", "HR"]),
            .quiz("Edi はしっかり出ているのに、Vte がほとんど入りません。何を疑いますか。",
                  ["チューブが痰で詰まっている", "無呼吸発作", "鎮静が深すぎる", "NAVA レベルが高すぎる"], answer: 0,
                  miss: [nil,
                   "無呼吸なら Edi も平らになります。",
                   "鎮静が深ければ Edi も小さくなります。",
                   "レベルが高ければ、Vte はむしろ増えます。"],
                  why: "「吸え」は出ているのに空気が入らない。通り道の問題です。Edi が平らか、出ているかで、止まった理由が分かれます。"),
            .talk(.doctor, "無呼吸がくり返すなら、カフェインを確かめます。抜管の前にも欠かせない薬でした。"),
            .step("NAVA を 1.0 に下げ、Edi peak 5〜15 µV を保ちます。",
                  hint: "NAVA レベルを下げても Edi が 15 を超えなければ、つむぎちゃんの力が戻ってきた印です。",
                  hold: 30,
                  why: "少ない手伝いで、自分の力で吸えています。チューブを抜く準備ができてきました。",
                  check: { c in
                      guard let peak = c.measured.ediPeak else { return false }
                      return c.settings.navaLevel <= 1.05 && peak >= 5 && peak <= 15 && c.engine.spo2 >= 90
                  })
                .spotting(["key:nava"]).watching(["Edi peak", "RR tot", "SpO₂"])
        ])

    static let lesson13_3 = Lesson(
        id: "13-3", title: "チューブを抜いても", minutes: 8, scenarioID: "micro",
        patient: { p in
            p.ageLabel = "在胎25週 日齢7"; p.weightKg = 0.78
            p.compliance = 0.0005; p.shuntAtLowPEEP = 0.30; p.shuntMinimum = 0.15
            p.recruitmentP50 = 7; p.recruitmentK = 2.0; p.alveolarDeadSpaceFraction = 0.05
            p.hco3 = 24; p.hco3Base = 24; p.paco2 = 50; p.pao2 = 60
            p.sedation = 0.1; p.driveGain = 1.2; p.maxInspiratoryPressure = 9; p.meanArterialPressure = 37
            p.leak = 0.35
        },
        prepare: { s in
            s.mode = .nava
            s.navaLevel = 1.0; s.peep = 6; s.fio2 = 0.3
            s.inspiratoryPressure = 12; s.respiratoryRate = 30; s.inspiratoryTime = 0.3
        },
        sedation: 0.1,
        brief: [
            "NIV-NAVA は、抜管したあと鼻のマスクやプロングから NAVA を続ける方法。",
            "鼻からは必ず漏れる（リーク）。流量でトリガする呼吸器は、漏れで空振りしたり、勝手に吸気を始めたりする。",
            "Edi は漏れに関係ないので、NIV-NAVA はリークがあっても吸いはじめと吸い終わりがずれない。",
            "鼻からでは Vte は漏れた分だけ少なく出る。Edi と呼吸数、SpO₂ で見る。"
        ],
        points: ["抜管後も NAVA を鼻から続けられる",
                 "リークがあっても Edi のトリガはずれない",
                 "Vte より Edi・呼吸数・SpO₂ を見る"],
        tasks: [
            .talk(.scene, "生まれて 7 日目の朝。つむぎちゃんの Edi は落ち着き、NAVA レベルは 1 まで下がった。今日、チューブを抜く。"),
            .talk(.doctor, "抜いたあとも、Edi のカテーテルは胃に残します。鼻のマスクから、同じ NAVA を続けられる。NIV-NAVA です。"),
            .talk(.puku, "NIV って？"),
            .talk(.doctor, "非侵襲的換気。チューブを入れずに、鼻や顔のマスクから呼吸を支えることです。"),
            .key("抜管して、モードを NIV-NAVA にしてください。",
                 event: .modeNIVNAVA,
                 why: "チューブが抜けて、鼻のマスクにつながりました。")
                .spotting(["mode:NIV-NAVA"]),
            .step("リークと Vte を見ます。",
                  hold: 15,
                  why: "{Leak}% が漏れています。Vte は、肺に入った量より少なく出ます。",
                  check: { $0.measured.leak > 0.2 && $0.measured.ediPeak != nil && $0.engine.clock > 15 })
                .spotting(["val:Leak"]).watching(["Leak", "Vte", "Edi peak", "RR tot"]),
            .quiz("鼻からの換気で漏れが多いと、流量でトリガする呼吸器はどうなりますか。",
                  ["空振りしたり、勝手に吸気を始めたりする",
                   "何も変わらない",
                   "もっと正確になる",
                   "吸気が長くなるだけ"], answer: 0,
                  miss: [nil,
                   "漏れは流量のトリガを狂わせます。",
                   "漏れは雑音です。正確にはなりません。",
                   "それだけでは済みません。"],
                  why: "漏れた空気を「吸った」と勘違いしたり、本当の吸気を見落としたりします。Edi は漏れに関係ないので、NIV-NAVA は合図がずれません。"),
            .talk(.doctor, "鼻からでは、量で見るのは難しい。Edi peak、呼吸数、SpO₂ で、手伝いが足りているかを見ます。"),
            .step("SpO₂ 90〜95% のまま、Edi peak 5〜15 µV を保ちます。",
                  hint: "Edi が 15 を超えるなら NAVA レベルを上げ、SpO₂ が高ければ FiO₂ を下げます。",
                  hold: 30,
                  why: "チューブがなくても、つむぎちゃんの合図で呼吸器が動いています。",
                  check: { c in
                      guard let peak = c.measured.ediPeak else { return false }
                      return peak >= 5 && peak <= 15 && c.engine.spo2 >= 90 && c.engine.spo2 <= 95
                  })
                .spotting(["key:nava", "key:fio2"]).watching(["Edi peak", "RR tot", "SpO₂"]),
            .quiz("NIV-NAVA で Edi peak 25 µV、呼吸数 90 回/分。まず考えることは？",
                  ["手伝い不足。NAVA レベルを上げ、悪ければ再挿管も考える",
                   "手伝いすぎ。NAVA レベルを下げる",
                   "電極を抜く",
                   "そのまま様子を見る"], answer: 0,
                  miss: [nil,
                   "Edi が高いのは、がんばりすぎの印です。",
                   "Edi は、いちばん大事な目盛りです。",
                   "このまま続けば疲れきってしまいます。"],
                  why: "Edi が高く呼吸が速いのは、がんばりすぎ。手伝いを増やし、それでも足りなければチューブに戻ります。")
        ])

    static let lesson13_4 = Lesson(
        id: "13-4", title: "鼻から流れる風", minutes: 8, scenarioID: "rds",
        patient: { p in
            p.ageLabel = "在胎28週 日齢21（修正31週）"; p.weightKg = 1.4
            p.compliance = 0.0016; p.shuntAtLowPEEP = 0.32; p.shuntMinimum = 0.05
            p.recruitmentP50 = 4; p.recruitmentK = 1.5; p.alveolarDeadSpaceFraction = 0.04
            p.hco3 = 24; p.hco3Base = 24; p.paco2 = 48; p.pao2 = 60
            p.sedation = 0; p.driveGain = 1.1; p.maxInspiratoryPressure = 12
            p.vco2 = 7.6; p.cardiacOutput = 0.28; p.meanArterialPressure = 38
            p.fatigueLoad = 1.0; p.fatigueTau = 600
        },
        prepare: { s in
            s.mode = .hfnc
            s.hfncFlow = 2; s.fio2 = 0.3
        },
        sedation: 0,
        brief: [
            "HFNC（高流量鼻カニュラ）は、温めて加湿したガスを鼻から大きな流量で流す。早産児なら 4〜8 L/分。",
            "流れが鼻と喉の死腔を洗い流し、少しの圧で肺胞を支える。その圧は測れず、流量・口の開き・鼻の隙間で変わる。",
            "カニュラは鼻の穴の半分ほどの太さに。隙間がないと、思わぬ高い圧がかかる。",
            "呼吸を送る機械ではない。無呼吸は助けない。まず刺激、戻らなければバッグで換気する。"
        ],
        points: ["HFNC は温めた大流量で死腔を洗い、肺胞を少し支える",
                 "圧は測れない。カニュラは鼻の穴の半分",
                 "無呼吸は助けない"],
        tasks: [
            .talk(.scene, "同じ日の午後。隣の保育器のあおい君は、生まれて 3 週。体重は 1,400 g になった。"),
            .talk(.scene, "鼻の CPAP の当たるところが赤くなっている。今朝から、鼻の管は細くて柔らかいカニュラに替わった。"),
            .talk(.doctor, "高流量鼻カニュラ、HFNC です。温めて加湿したガスを、鼻から大きな流量で流し続けます。鼻にやさしく、抱っこもしやすい。"),
            .talk(.puku, "あれ、波形が出てないよ？")
                .looking(["wave"]),
            .talk(.doctor, "HFNC は流すだけの機械なので、圧も換気量も測れません。見るのは呼吸数、SpO₂、それに陥没呼吸や鼻翼呼吸です。"),
            .talk(.doctor, "朝につないだときの流量のままです。早産児なら 4〜8 L/分。この流量では、鼻と喉の死腔が洗いきれていません。")
                .looking(["val:RR tot", "val:SpO₂"]),
            .step("Flow を 6 L/min に上げてください。",
                  hold: 30,
                  why: "呼吸数が落ち着き、SpO₂ が上がりました。流れが死腔を洗い、少しの圧で肺胞を支えています。",
                  check: { $0.settings.hfncFlow >= 6 })
                .spotting(["key:hflow"]).watching(["RR tot", "SpO₂", "tcPCO₂"]),
            .quiz("HFNC のカニュラの太さは？",
                  ["鼻の穴の半分くらい", "鼻の穴をぴったりふさぐ", "太いほどよい", "細いほど圧が高い"], answer: 0,
                  miss: [nil,
                   "ふさぐと逃げ道がなくなり、思わぬ高い圧がかかります。",
                   "太いほど隙間がなくなります。",
                   "細いと圧は逃げやすくなります。"],
                  why: "隙間から余分な流れが逃げるので、圧が上がりすぎません。HFNC の圧は測れないぶん、逃げ道を残しておきます。"),
            .step("FiO₂ を下げて、SpO₂ 90〜95% を 30 秒保ってください。",
                  hold: 30,
                  why: "酸素も下がりました。この流量なら、薄い酸素でも足ります。",
                  check: { $0.settings.fio2 <= 0.29 && $0.engine.spo2 >= 90 && $0.engine.spo2 <= 95 })
                .spotting(["key:fio2"]).watching(["SpO₂", "RR tot"]),
            .quiz("HFNC 中に 20 秒息が止まり、心拍が 80 に。まずすることは？",
                  ["体をさすって刺激し、戻らなければバッグで換気する", "流量を上げる", "FiO₂ を 100% にする", "様子を見る"], answer: 0,
                  miss: [nil,
                   "HFNC は呼吸を送りません。流量を上げても息は戻りません。",
                   "息が止まっていては、酸素は肺に入りません。",
                   "無呼吸と徐脈は待てません。"],
                  why: "HFNC は自分で息をする子を支えるだけ。止まった息は、刺激とバッグで戻します。NAVA のバックアップとの違いです。"),
            .talk(.doctor, "良くなってきたら、流量を 1 L/分ずつ下げていきます。呼吸数と SpO₂ が変わらなければ、次の段へ。"),
            .step("Flow を 4 L/min まで下げ、SpO₂ 90% 以上を保ちます。",
                  hold: 30,
                  why: "あおい君は、4 L/分でも落ち着いています。鼻から流れる風だけで、自分の息を続けています。",
                  check: { $0.settings.hfncFlow <= 4 && $0.engine.spo2 >= 90 })
                .spotting(["key:hflow"]).watching(["SpO₂", "RR tot"])
        ])
}
