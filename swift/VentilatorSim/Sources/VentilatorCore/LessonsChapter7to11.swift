import Foundation

/* 第7〜11章。web/lessons.js の CH7〜CH11 と同じ内容（課題の順番・クイズの正解・押す場所）。
 * 1〜6 章で習ったことを、残りの症例を受け持ちながらもう一度使う。
 * どの章も 初期設定 → 血液ガスで調整 → 離脱・抜管 の順に進む。 */
extension LessonLibrary {

    /// 離脱の条件がすべてそろったか（「離脱」キーのリストが全部 ✓）。
    static func readyToWean(_ c: LessonContext) -> Bool {
        Weaning.readiness(for: c.engine).allSatisfy(\.met)
    }

    static let lesson7_1 = Lesson(
        id: "7-1", title: "吐ける回数で決める", minutes: 8, scenarioID: "bronchiolitis",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 42; s.respiratoryRate = 40; s.peep = 6; s.fio2 = 0.5
            s.inspiratoryFlow = 5; s.inspiratoryPause = 0.3
        },
        sedation: 0.9,
        brief: [
            "細気管支炎は気道が細く、とくに吐く息が通りにくい。呼吸回数を上げると吐ききれず auto-PEEP がたまる。",
            "CO₂ を下げたいときは、回数より量。Pplat の上限の中で一回換気量を 7〜8 mL/kg まで使う。",
            "細気管支炎では PaCO₂ 60〜70、pH 7.20 以上を許容する。数字を正常にするより、吐かせることを優先する。",
            "auto-PEEP が消えると、肺胞を支えていた圧も消える。SpO₂ が下がったら設定の PEEP で支え直す。"
        ],
        points: ["回数を上げると吐ききれない",
                 "CO₂ は回数より量で（Pplat の上限の中で）",
                 "pH 7.20 以上なら高 CO₂ を許す"],
        tasks: [
            .talk(.scene, "5 日目の朝。そうた君の呼吸回数は、夜のうちに 40 回まで上げられていた。CO₂ を下げるためだったと、申し送りにある。"),
            .talk(.doctor, "そうた君は、今日から{名前}先生の受け持ちです。まず、この設定がこの子に合っているかを確かめましょう。"),
            .talk(.puku, "回数を上げたら CO₂ が下がるんでしょ？ 何がいけないの？"),
            .talk(.doctor, "下がるかわりに、吐く時間が削られます。細い気道の子は、吐くのにいちばん時間がかかります。"),
            .talk(.doctor, "吐ききれずに肺に残った空気の圧が auto-PEEP。挿管した夜に、この子で一度測りましたね。もう一度測ります。"),
            .key("「呼気ポーズ」で、吐き残しを測ってください。",
                 event: .expiratoryHold)
                .spotting(["hard:kExp"]),
            .step("測り終わるのを待ちます。",
                  check: { $0.holdSettled && $0.measured.autoPEEP > 0 })
                .explaining { c in
                "総 PEEP " + String(format: "%.1f", c.measured.totalPEEP) + " に対して設定 PEEP は " + LessonLibrary.number(c.settings.peep)
                        + "。差の " + String(format: "%.1f", c.memory["ap71"] ?? 0) + " cmH₂O が、吐ききれずに残った圧です。"
            }
                .passing { c in
                c.memory["ap71"] = c.measured.autoPEEP
            }
                .spotting(["val:auto-PEEP"]).watching(["auto-PEEP", "PEEP tot", "ABP mean"]),
            .talk(.doctor, "τ（タウ）は吐くときの速さの目安でした。3τ でほぼ吐ききれます。この子の τ は 0.7 秒ほど。気道が細いぶん長いのです。"),
            .quiz("τ 0.7 秒の乳児。RR 40 なら 1 呼吸 1.5 秒。足りないのはどれですか。",
                  ["吐く時間",
                   "吸う時間",
                   "酸素の濃さ",
                   "鎮静の深さ"], answer: 0,
                  miss: [nil,
                   "吸気時間は設定で決まっていて、削られるのは呼気のほうです。",
                   "酸素は吐き残しと関係しません。",
                   "鎮静では吐く時間は増えません。"],
                  why: "吸気 0.5 秒を引くと、呼気は 1 秒。3τ の 2 秒に届きません。吐ききる前に次の吸気が来るので、空気が少しずつたまっていきます。"),
            .step("呼吸回数を下げ、auto-PEEP を 3 cmH₂O 未満にしてください。",
                  hint: "下げたら、もう一度「呼気ポーズ」で測ります。この子は RR 24 前後が目安です。",
                  why: "吐く時間が戻り、たまっていた空気が抜けました。そのかわり分時換気量は減ります。",
                  check: { c in
                      c.measured.autoPEEP < 3 && c.settings.respiratoryRate < 30 && c.holdSettled
                  })
                .spotting(["key:rr", "hard:kExp"]).watching(["auto-PEEP", "ABP mean", "MV"]),
            .talk(.doctor, "回数を下げたぶん、CO₂ は上がります。ここで量を使います。1 回を大きくすれば、死腔で無駄になる割合が減ります。"),
            .talk(.puku, "でも量を増やしたら、肺が伸ばされすぎない？"),
            .talk(.doctor, "だから Pplat を見張ります。この年齢の上限は、タイルの下に出ています。その内側でなら 8 mL/kg まで使えます。"),
            .step("一回換気量を 8 mL/kg にして確定してください。",
                  hold: 10,
                  why: "Pplat は上限の内側です。同じ分時換気量でも、回数より量で稼ぐほうが CO₂ はよく抜けます。",
                  check: { c in
                      guard let plat = c.measured.plateauPressure else { return false }
                      return abs(c.settings.tidalVolume - c.pbw * 8) <= 3 && plat <= c.engine.norms.plateauMax
                  })
                .hinting { c in
                "体重 " + String(format: "%.1f", c.pbw) + " kg × 8 ＝ 約 " + LessonLibrary.mlkg(c.pbw, 8) + " mL。Pplat が上限を超えないことも確かめます。"
            }
                .spotting(["key:vt"]).watching(["Vte", "Pplat", "ΔP"]),
            .talk(.scene, "しばらくして、SpO₂ がじわじわと下がりはじめた。パルスの音が、少しずつ低くなる。")
                .starting { c in
                let s = c.engine.shuntSetting
                    c.engine.setShunt(low: max(s.low, 0.40), minimum: s.minimum)
            },
            .talk(.puku, "吐き残しを減らしたのに、どうして酸素が下がるの？"),
            .talk(.doctor, "吐き残しの圧が、潰れかけた肺胞を支えていたからです。その分を、設定の PEEP で支え直します。"),
            .step("PEEP を 8 にし、SpO₂ 92% 以上を 30 秒保ってください。",
                  hint: "足りなければ FiO₂ も少し上げます。PEEP を上げたら血圧も見ます。",
                  hold: 30,
                  why: "たまたま残った圧ではなく、決めた圧で肺胞を支えます。いくつかけているかが分かる圧に置き換えた、ということです。",
                  check: { $0.settings.peep >= 8 && $0.engine.spo2 >= 92 })
                .spotting(["key:peep", "key:fio2"]).watching(["SpO₂", "ABP mean", "Pplat"]),
            .talk(.doctor, "では、この設定で CO₂ がどこまで上がるか。換気を変えてから数分おいて採血しましょう。"),
            .step("数分進めてから採血し、pH を確かめてください。",
                  hint: "「× 10」で 5 分ほど進めてから「血液ガス」を押します。",
                  check: { !$0.bloodGases.isEmpty })
                .explaining { c in
                guard let g = c.lastBloodGas else { return "" }
                    return String(format: "pH %.2f、PaCO₂ %.0f、HCO₃⁻ %.0f。", g.pH, g.paco2, g.hco3)
                        + (g.pH >= 7.2 ? "CO₂ は高めですが、pH は許せる範囲です。"
                           : "pH が 7.20 を割っています。Pplat の上限の中で、量か回数を少し戻します。")
            }
                .spotting(["hard:kAbg"]).watching(["etCO₂", "MV"]),
            .talk(.doctor, "CO₂ が高い日が続くと、腎臓が HCO₃⁻ を増やして pH を戻しにきます。代償でしたね。この子は数日かけて、それが起きています。"),
            .quiz("細気管支炎の乳児、pH 7.25 / PaCO₂ 64、auto-PEEP 1。どうしますか。",
                  ["呼吸回数を 40 に戻す",
                   "このまま許容する",
                   "PEEP を 0 にする",
                   "鎮静を浅くする"], answer: 1,
                  miss: ["また吐ききれなくなり、血圧が下がります。夜の設定に逆戻りです。",
                   nil,
                   "肺胞を支える圧がなくなり、酸素化が落ちます。",
                   "自分で速く吸いはじめ、吐く時間がさらに削られます。"],
                  why: "pH 7.20 以上なら許容します。CO₂ の数字を正常にするより、吐かせて肺と循環を守るほうが大事です。気道の炎症が引けば、CO₂ は自然に下がってきます。")
        ])

    static let lesson7_2 = Lesson(
        id: "7-2", title: "夜中の痰づまり", minutes: 6, scenarioID: "bronchiolitis",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 48; s.respiratoryRate = 24; s.peep = 8; s.fio2 = 0.55
            s.inspiratoryFlow = 6; s.inspiratoryPause = 0.3
        },
        sedation: 0.9,
        brief: [
            "RSV 細気管支炎は痰が多い。乳児の細いチューブは、わずかな痰でも抵抗がはっきり上がる。",
            "圧が上がったら、まず吸気ポーズ。PIP だけ上がれば抵抗、Pplat も上がれば肺の硬さ。",
            "吸引の前に FiO₂ を上げて酸素を貯金する。カテーテルはチューブ内径の半分以下、1 回 10 秒以内。"
        ],
        points: ["圧が上がったら、まず吸気ポーズ",
                 "PIP だけ上がる＝抵抗（痰が多い）",
                 "吸引は 100% O₂ のあとで、短く"],
        tasks: [
            .talk(.scene, "6 日目の夜。{名前}先生の 3 回目の当直。そうた君は、夕方から痰が増えていると申し送られた。"),
            .talk(.doctor, "わたしは隣の部屋にいます。鳴ったら、最初の一手は{名前}先生に任せます。順番はもう知っているはずです。"),
            .talk(.puku, "えっ、ぼくたちだけで？"),
            .talk(.doctor, "まずは落ち着いているいまの数字を控えておくこと。比べる相手がないと、何が変わったか分かりません。"),
            .step("いまの PIP と Pplat を覚えておいてください。",
                  why: "これが平常時の値です。",
                  check: { $0.measured.plateauPressure != nil && $0.measured.staticCompliance != nil })
                .passing { c in
                c.memory["pip0"] = c.measured.peakPressure
                    c.memory["plat0"] = c.measured.plateauPressure ?? 0
            }
                .spotting(["val:PIP", "val:Pplat"]).watching(["PIP", "Pplat", "Raw"]),
            .talk(.scene, "午前 2 時。気道内圧上限のアラーム。そうた君がむせて、顔が赤くなっている。")
                .starting { c in
                let r = c.engine.airwayResistance
                    c.memory["rInsp0"] = r.inspiratory
                    c.memory["rExp0"] = r.expiratory
                    c.engine.setAirwayResistance(inspiratory: r.inspiratory * 3.0,
                                                 expiratory: r.expiratory * 1.6)
            },
            .talk(.puku, "な、鳴った！ 先生を呼んでくる？"),
            .talk(.scene, "いぶき先生の声を思い出す。設定を変える前に、まず上がった圧の中身を分けること。"),
            .key("PIP が上がりました。まず何をしますか。",
                 hint: "原因を切り分けるキーがハードキーにあります。",
                 event: .inspiratoryHold,
                 why: "吸気ポーズで Pplat を測ります。")
                .missing([.suction: "まだ原因が分かっていません。痰なのか、肺が硬くなったのか、先に切り分けます。",
                      .oxygenFlush: "SpO₂ はまだ保たれています。いま知りたいのは、圧が上がった理由です。",
                      .expiratoryHold: "呼気ポーズは吐き残しを見るもの。上がった PIP の中身を分けるのは別のキーです。"])
                .spotting(["hard:kInsp"]).watching(["PIP", "Pplat", "Raw"]),
            .step("測り終わるのを待ち、さっきの値と比べてください。",
                  check: { $0.measured.plateauPressure != nil && $0.holdSettled })
                .explaining { c in
                let pip0 = Int((c.memory["pip0"] ?? 0).rounded()), plat0 = Int((c.memory["plat0"] ?? 0).rounded())
                    let pip = Int(c.measured.peakPressure.rounded()), plat = Int((c.measured.plateauPressure ?? 0).rounded())
                    return "PIP は \(pip0) → \(pip) と上がったのに、Pplat は \(plat0) → \(plat) とほとんど変わっていません。"
            }
                .watching(["PIP", "Pplat", "Raw"]),
            .quiz("PIP だけが上がり、Pplat はほぼ同じ。Raw も上がっています。原因は？",
                  ["肺が硬くなった",
                   "気道の抵抗が上がった（痰など）",
                   "回路のリーク",
                   "PEEP が高すぎる"], answer: 1,
                  miss: ["肺が硬くなれば Pplat も上がります。",
                   nil,
                   "リークなら圧は下がります。",
                   "PEEP は触っていません。"],
                  why: "PIP と Pplat の差が開いた＝抵抗の増加です。聴診で痰の音。内径 3.5 mm のチューブは、断面積が大人の 8 mm のチューブの 5 分の 1 ほどしかありません。"),
            .talk(.scene, "ドアが開いて、いぶき先生が入ってきた。モニターを一目見て、小さくうなずく。"),
            .talk(.doctor, "切り分けは合っています。吸引中は換気が止まるので、短く。カテーテルはチューブ内径の半分以下を選びます。"),
            .quiz("乳児の気管吸引。1 回にかけてよい時間の目安は？",
                  ["10 秒以内",
                   "30 秒",
                   "1 分",
                   "痰が取れきるまで"], answer: 0,
                  miss: [nil,
                   "30 秒も換気を止めると、乳児の SpO₂ は大きく落ちます。",
                   "長すぎます。徐脈になることもあります。",
                   "取りきれなければ、休んでから何回かに分けます。"],
                  why: "乳児は酸素の蓄えが少なく、吸引で徐脈にもなりやすい。短く、必要なら間をあけて何回かに分けます。"),
            .key("「100% O₂」を押してから「気管吸引」を押してください。",
                 event: .suction,
                 why: "粘い痰が取れました。抵抗が戻り、PIP が下がります。")
                .passing { c in
                if let ri = c.memory["rInsp0"], let re = c.memory["rExp0"] {
                        c.engine.setAirwayResistance(inspiratory: ri, expiratory: re)
                    }
            }
                .spotting(["hard:kO2", "hard:kSuc"]).watching(["PIP", "SpO₂"]),
            .step("SpO₂ と心拍を 1 分見てください。",
                  hold: 60,
                  why: "吸引のあいだに SpO₂ は一度下がり、そこから戻っていきます。先に 100% で貯金したぶん、浅く済みます。乳児は吸引で徐脈にもなるので、心拍も一緒に見ます。",
                  check: { _ in true })
                .spotting(["val:SpO₂"]).watching(["SpO₂", "HR", "PIP"]),
            .talk(.puku, "もう詰まらないようにできないの？"),
            .talk(.doctor, "加湿をしっかり、体の向きをこまめに変える。痰の多い時期を、安全にやり過ごすのがわたしたちの仕事です。"),
            .quiz("では、PIP も Pplat も上がり、左の胸の上がりが悪かったら？",
                  ["痰づまり",
                   "片肺挿管・気胸・大きな無気肺",
                   "回路のリーク",
                   "鎮静が浅い"], answer: 1,
                  miss: ["痰なら Pplat は上がりません。",
                   nil,
                   "リークなら圧は下がります。",
                   "鎮静では片側の胸の動きは変わりません。"],
                  why: "Pplat も上がるのは肺の側の問題です。DOPE の D（チューブの位置）と P（気胸）。チューブの深さ、聴診、胸の X 線で確かめます。")
        ])

    static let lesson7_3 = Lesson(
        id: "7-3", title: "抜管して高流量鼻カニュラへ", minutes: 9, scenarioID: "bronchiolitis",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 48; s.respiratoryRate = 20; s.peep = 6; s.fio2 = 0.45
            s.inspiratoryFlow = 6; s.inspiratoryPause = 0.3
        },
        sedation: 0.6,
        brief: [
            "細気管支炎の人工呼吸は数日から 1 週間ほど。痰が減り、熱が下がり、呼気の音が軽くなれば離脱を考える。",
            "条件と SBT は学童と同じ考え方。乳児の SBT は、細いチューブの抵抗を補うため PS 8・PEEP 5 で行う。",
            "抜管後はすぐ高流量鼻カニュラ（HFNC）。温めて加湿した酸素を 2 L/kg/分ほど流し、呼吸の仕事を減らす。"
        ],
        points: ["痰・熱・呼気の音が落ち着いたら離脱を考える",
                 "乳児の SBT は PS 8・PEEP 5",
                 "抜管後は HFNC で支え、崩れたら早めに決める"],
        tasks: [
            .talk(.scene, "8 日目の朝。そうた君の熱は下がり、痰もずいぶん減った。胸の音から、呼気のヒューヒューが消えている。")
                .starting { c in
                c.engine.adjustPatient { p in
                        p.resistanceInsp = 40; p.resistanceExp = 60
                        p.shuntAtLowPEEP = 0.15; p.shuntMinimum = 0.08
                        p.driveGain = 1.0; p.temperature = 37.0
                    }
            },
            .talk(.doctor, "そうた君を、離脱の目で見てみましょう。手順はハルト君のときと同じです。"),
            .talk(.puku, "ハルト君より、ずっと小さいよ？"),
            .talk(.doctor, "考え方は同じです。違うのはチューブの細さ。だから SBT でも、学童より少し強めに手伝います。"),
            .key("「離脱」キーで、条件のリストを開いてください。",
                 event: .openWeaning,
                 why: "× がついている項目が、いま足りていないものです。")
                .spotting(["hard:kWean"]),
            .step("設定と鎮静を調整して、リストを全部 ✓ にしてください。",
                  hint: "FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅くして自発呼吸を出します。「離脱」キーで開き直せます。",
                  why: "条件がそろいました。ここで初めて SBT に進めます。",
                  check: { LessonLibrary.readyToWean($0) })
                .spotting(["key:fio2", "key:peep", "key:sed"]).watching(["SpO₂", "RR tot", "ABP mean"]),
            .talk(.doctor, "f/VT を覚えていますか。呼吸回数 ÷ 一回換気量（mL/kg）。8 を超える浅く速い呼吸は、疲れのサインでした。"),
            .quiz("体重 6 kg、RR 48、一回換気量 36 mL。f/VT はいくつですか。",
                  ["8",
                   "6",
                   "48",
                   "判定できない"], answer: 0,
                  miss: [nil,
                   "それは一回換気量を mL/kg にした値です。RR をそれで割ります。",
                   "RR をそのまま答えています。",
                   "体重と RR と量があれば計算できます。"],
                  why: "36 ÷ 6 ＝ 6 mL/kg、48 ÷ 6 ＝ 8。ちょうど境目です。乳児は呼吸数がもともと速いので、数だけで慌てず f/VT で見ます。"),
            .key("「離脱」キーから SBT を開始してください。",
                 event: .startSBT,
                 why: "PEEP 5 と PS 8 に切り替わり、30 分の計測が始まりました。")
                .spotting(["hard:kWean"]),
            .step("30 分の SBT を、最後まで通してください。",
                  hint: "「× 10」や「× 60」で早送りできます。中止になったら原因を直して、もう一度開始します。",
                  why: "30 分、呼吸回数も酸素化も循環も保てました。",
                  check: { $0.sbt.finished && $0.sbt.passed })
                .spotting(["val:f/VT"]).watching(["f/VT", "RR tot", "SpO₂", "HR"]),
            .talk(.doctor, "抜いたら、すぐ高流量鼻カニュラ（HFNC）。温めて加湿した酸素を、鼻から大きな流量で流す方法です。乳児なら 1 kg あたり 2 L/分が目安。"),
            .talk(.puku, "入院した日に、つけてたやつだ！"),
            .talk(.doctor, "そうです。吸う仕事を少し肩代わりし、鼻の奥の死腔を洗い流してくれます。抜管後の 1〜2 日を支えます。"),
            .quiz("抜管 2 時間後、呼吸数 70、陥没呼吸が強まってきました。どうしますか。",
                  ["朝まで様子を見る",
                   "HFNC を見直し、悪化が続けば早めに再挿管を決める",
                   "鎮静薬を使う",
                   "水分を絞る"], answer: 1,
                  miss: ["乳児は崩れはじめると速い。待つほど疲れきってから挿管し直すことになります。",
                   nil,
                   "呼吸が弱まり、かえって危険です。",
                   "呼吸の悪化の答えになっていません。"],
                  why: "乳児は崩れはじめると速い。粘りすぎて疲れきってから挿管し直すほうが危険です。決めるなら早く。"),
            .key("「離脱」キーから抜管してください。",
                 event: .extubate)
                .spotting(["hard:kWean"]),
            .step("結果を確認してください。",
                  why: "抜管できました。そうた君は HFNC につながれ、自分の力で息をしています。",
                  check: { $0.extubated })
                .watching(["SpO₂", "RR tot"])
        ])

    static let lesson8_1 = Lesson(
        id: "8-1", title: "事故抜管と、設定のやり直し", minutes: 8, scenarioID: "ards",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 140; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 1
            s.inspiratoryFlow = 12; s.inspiratoryPause = 0.3
        },
        sedation: 0.92,
        brief: [
            "事故抜管は、Vte の急な低下、etCO₂ の波の消失、泣き声で気づく。迷ったら抜いて、バッグとマスクで換気する。",
            "入れ直したあとは、設定を一から組み直す。量は 5〜6 mL/kg、PEEP で肺胞を開き直し、FiO₂ は SpO₂ を見て下げる。",
            "一度潰れた ARDS の肺は、開き直すまで時間がかかる。PEEP を上げたら Pplat と血圧も見る。"
        ],
        points: ["Vte 急低下＋etCO₂ 消失＋声＝チューブが抜けた",
                 "入れ直したら 量 → PEEP → FiO₂ → 回数 の順に組み直す",
                 "100% の酸素のまま置いておかない"],
        tasks: [
            .talk(.scene, "8 日目の昼。ミオちゃんは酸素の量が減り、少しずつ良くなっていた。床ずれを防ぐため、体の向きを変えようとした、そのとき。")
                .starting { c in
                c.engine.adjustPatient { p in
                        p.compliance = 0.0075
                        p.shuntAtLowPEEP = 0.32; p.shuntMinimum = 0.10
                        p.temperature = 37.8
                    }
            },
            .talk(.scene, "呼吸器のアラーム。Vte が急に小さくなり、etCO₂ の波が消えた。口元から、かすれた泣き声が聞こえる。"),
            .talk(.puku, "泣き声？ チューブが入ってたら、声は出ないはずじゃ…"),
            .talk(.doctor, "etCO₂ は、吐いた息に含まれる CO₂ です。チューブを通って息が出入りしていれば、画面に波が出ます。"),
            .quiz("Vte が急に減り、etCO₂ の波が消え、声が出ています。何が起きましたか。",
                  ["チューブが抜けた（事故抜管）",
                   "痰づまり",
                   "気胸",
                   "回路の結露"], answer: 0,
                  miss: [nil,
                   "痰なら PIP が上がり、声は出ません。",
                   "気胸なら圧が上がります。声は出ません。",
                   "結露では etCO₂ の波は消えません。"],
                  why: "声が出るのは、チューブが声帯を通っていない証拠です。DOPE の D（位置）。迷ったらチューブを抜いて、バッグとマスクで換気します。"),
            .talk(.scene, "いぶき先生がすぐにバッグとマスクで換気し、新しいチューブを入れ直した。胸が左右そろって上がる。"),
            .talk(.doctor, "入りました。呼吸器は、入れ直すときの設定のまま仮につないであります。{名前}先生、一から組み直してください。"),
            .talk(.puku, "どこから決めるの？"),
            .talk(.doctor, "体重から量。次に PEEP で肺胞を開き、酸素を下げ、最後に回数。この子の肺は硬いので、量は 6 mL/kg までです。"),
            .key("「患者情報」キーで、ミオちゃんの体重を確かめてください。",
                 hint: "閉じるときは「呼吸器に戻る」。",
                 event: .openPatientInfo)
                .explaining { c in "体重 " + String(format: "%.0f", c.pbw) + " kg。6 mL/kg なら約 " + LessonLibrary.mlkg(c.pbw, 6) + " mL です。" }
                .spotting(["hard:kPt"]),
            .step("一回換気量を 6 mL/kg にして確定してください。",
                  hold: 6,
                  why: "いまの肺に合った量になりました。Pplat と ΔP も下がっています。",
                  check: { abs($0.settings.tidalVolume - $0.pbw * 6) <= 5 })
                .hinting { c in
                "体重 " + String(format: "%.0f", c.pbw) + " kg × 6 ＝ 約 " + LessonLibrary.mlkg(c.pbw, 6) + " mL です。"
            }
                .spotting(["key:vt"]).watching(["Vte", "Pplat", "ΔP"]),
            .talk(.doctor, "抜けていたあいだに、肺胞はまた潰れました。PEEP 5 では支えきれません。開き直しましょう。"),
            .step("PEEP を 10 に上げて確定してください。",
                  hint: "実際は 2 ずつ上げて、Pplat と血圧を見ながら進めます。",
                  check: { $0.settings.peep >= 10 })
                .spotting(["key:peep"]).watching(["SpO₂", "Pplat", "ABP mean"]),
            .step("そのまま 60 秒、SpO₂ と Pplat と血圧を見てください。",
                  hold: 60,
                  check: { $0.settings.peep >= 10 })
                .explaining { c in
                let n = c.engine.norms
                    return "Pplat {Pplat} は上限 " + LessonLibrary.number(n.plateauMax) + " の内側です。"
                        + (c.engine.meanArterialPressure < n.meanArterialPressureMin
                           ? "平均動脈圧は下限 " + LessonLibrary.number(n.meanArterialPressureMin) + " を割っています。輸液が足りているかも確かめます。"
                           : "血圧も保てています。")
            }
                .watching(["SpO₂", "Pplat", "ABP mean"]),
            .talk(.doctor, "開いたら、酸素は下げる。100% のままにしないこと。この子の SpO₂ の目標は 92〜97% です。"),
            .step("SpO₂ 92% 以上のまま、FiO₂ を 60% 以下にしてください。",
                  hint: "5〜10% ずつ下げて SpO₂ を確かめます。",
                  hold: 30,
                  why: "PEEP で開いてから FiO₂ を下げる。この順番でしたね。",
                  check: { $0.settings.fio2 <= 0.61 && $0.engine.spo2 >= 92 })
                .spotting(["key:fio2"]).watching(["SpO₂"]),
            .talk(.doctor, "最後に回数。量を絞ったぶん、CO₂ は回数で補います。この子なら 28〜30 回あたりから始めます。"),
            .step("回数を整えてから採血し、pH 7.25 以上を確かめてください。",
                  hint: "RR を上げたら「× 10」で数分進め、「血液ガス」を押します。低ければ RR を足して採り直します。",
                  check: { ($0.lastBloodGas?.pH ?? 0) >= 7.25 })
                .explaining { c in
                guard let g = c.lastBloodGas else { return "" }
                    return String(format: "pH %.2f、PaCO₂ %.0f。", g.pH, g.paco2) + "量は 6 mL/kg のまま、回数で pH を戻せました。"
            }
                .spotting(["key:rr", "hard:kAbg"]).watching(["MV", "etCO₂", "auto-PEEP"]),
            .quiz("入れ直したあと FiO₂ 100% のまま 6 時間、SpO₂ は 100%。何が問題ですか。",
                  ["問題ない",
                   "濃い酸素そのものが肺を傷める",
                   "CO₂ が上がる",
                   "血圧が下がる"], answer: 1,
                  miss: ["SpO₂ 100% は、余裕がどれだけあるかを教えてくれません。",
                   nil,
                   "FiO₂ は CO₂ には効きません。",
                   "FiO₂ は血圧には直接効きません。"],
                  why: "高い酸素は、それ自体が肺を傷めます。SpO₂ 100% は「PaO₂ が 100 以上のどこか」という意味しかありません。慌ただしい場面ほど、下げ忘れが起きます。")
        ])

    static let lesson8_2 = Lesson(
        id: "8-2", title: "酸素と PEEP を下げていく", minutes: 9, scenarioID: "ards",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 84; s.respiratoryRate = 28; s.peep = 10; s.fio2 = 0.5
            s.inspiratoryFlow = 12; s.inspiratoryPause = 0.3
        },
        sedation: 0.8,
        brief: [
            "良くなってきたら、下げる順番は FiO₂ が先、PEEP があと。PEEP を先に下げると、開いた肺胞がまた潰れる。",
            "PEEP は 1 回に 2 cmH₂O ずつ。下げたら 30 分〜1 時間は SpO₂ を見て、落ちたら戻す。",
            "下げられたかどうかは血液ガスの P/F 比で確かめる。P/F 200 以上・FiO₂ 0.4 以下・PEEP 7 以下が離脱の入口。"
        ],
        points: ["先に FiO₂、あとで PEEP",
                 "PEEP は 2 ずつ、落ちたら戻す",
                 "P/F 比で答え合わせ"],
        tasks: [
            .talk(.scene, "10 日目の朝。ミオちゃんの胸の X 線は、白かった影が少しずつ薄くなってきた。熱も下がりはじめている。")
                .starting { c in
                c.engine.adjustPatient { p in
                        p.compliance = 0.0088
                        p.shuntAtLowPEEP = 0.26; p.shuntMinimum = 0.08
                        p.temperature = 37.3
                    }
            },
            .talk(.doctor, "上げるのは誰でもできます。下げるときに、その人の腕が出ます。まず、いまの酸素化を数字で見ましょう。"),
            .talk(.doctor, "P/F 比は、PaO₂ を FiO₂（小数）で割った値。正常は 400 以上、200 を超えれば離脱を考えはじめます。"),
            .step("採血して、いまの P/F 比を確かめてください。",
                  check: { !$0.bloodGases.isEmpty })
                .explaining { c in
                "P/F 比 \(Int((c.lastBloodGas?.pfRatio ?? 0).rounded()))。再挿管の日より、ずっと良くなっています。"
            }
                .passing { c in
                if let g = c.lastBloodGas { c.memory["pf81"] = g.pfRatio }
            }
                .spotting(["hard:kAbg"]).watching(["SpO₂", "Pplat"]),
            .talk(.puku, "じゃあ、PEEP も酸素も、いっぺんに下げちゃおう！"),
            .talk(.doctor, "いっぺんに動かすと、悪くなったときにどちらのせいか分かりません。1 つずつ、決まった順番で。"),
            .quiz("良くなってきた ARDS。先に下げるのはどちらですか。",
                  ["FiO₂",
                   "PEEP",
                   "一回換気量",
                   "どちらでもよい"], answer: 0,
                  miss: [nil,
                   "PEEP を先に下げると、開いていた肺胞がまた潰れます。",
                   "量は肺保護のために、すでに絞っています。",
                   "順番があります。"],
                  why: "濃い酸素は肺を傷めるので、先に下げます。PEEP は肺胞を開いておく支えなので、最後まで残します。"),
            .step("SpO₂ 92% 以上のまま、FiO₂ を 40% 以下にしてください。",
                  hold: 30,
                  why: "FiO₂ 40% まで下がりました。次は PEEP です。",
                  check: { $0.settings.fio2 <= 0.41 && $0.engine.spo2 >= 92 })
                .spotting(["key:fio2"]).watching(["SpO₂"]),
            .talk(.doctor, "PEEP は 2 ずつ。下げたら、しばらく SpO₂ を見ます。落ちてくるなら、まだ肺胞が支えを必要としている証拠です。"),
            .step("PEEP を 2 ずつ下げて 8 にし、90 秒 SpO₂ 92% 以上を保ってください。",
                  hint: "「× 10」で早送りすると、変化がはやく見えます。",
                  hold: 90,
                  why: "肺胞は潰れずに保たれています。Pplat が下がり、血圧も少し楽になりました。",
                  check: { $0.settings.peep <= 8 && $0.engine.spo2 >= 92 })
                .spotting(["key:peep"]).watching(["SpO₂", "Pplat", "ABP mean"]),
            .step("もう一度採血して、P/F 比を確かめてください。",
                  hint: "「× 10」で数分進めてから採血します。",
                  check: { $0.bloodGases.count >= 2 && ($0.lastBloodGas?.pfRatio ?? 0) >= 160 })
                .explaining { c in
                "P/F 比 \(Int((c.memory["pf81"] ?? 0).rounded())) → \(Int((c.lastBloodGas?.pfRatio ?? 0).rounded()))。"
                        + "酸素も PEEP も下げたのに、酸素化は保てています。肺そのものが良くなってきた証拠です。"
            }
                .spotting(["hard:kAbg"]).watching(["SpO₂"]),
            .quiz("PEEP を 8 → 6 に下げて 20 分、SpO₂ が 95 → 89% に落ちました。どうしますか。",
                  ["PEEP を 8 に戻す",
                   "FiO₂ だけ上げて PEEP 6 のまま",
                   "さらに PEEP を下げる",
                   "様子を見る"], answer: 0,
                  miss: [nil,
                   "潰れはじめた肺胞は、酸素では開きません。支えの圧を戻します。",
                   "もっと潰れます。",
                   "肺胞は時間とともにさらに潰れていきます。"],
                  why: "肺胞が潰れはじめたサインです。PEEP を戻し、半日〜1 日おいてから、もう一度試します。下げられなかったこと自体が、肺の状態を教えてくれます。")
        ])

    static let lesson8_3 = Lesson(
        id: "8-3", title: "硬い肺の離脱", minutes: 10, scenarioID: "ards",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 84; s.respiratoryRate = 24; s.peep = 7; s.fio2 = 0.4
            s.inspiratoryFlow = 12; s.pressureSupport = 10; s.inspiratoryPause = 0.3
        },
        sedation: 0.7,
        brief: [
            "長く A/C で休んでいた子は、いきなり SBT ではなく、まず PSV で自分で吸う力を取り戻させる。",
            "PS は「目標の換気量を楽に出せる最小の圧」。Vte 6〜8 mL/kg と呼吸回数で決める。",
            "長く使った鎮静薬は少しずつ減らす。急にやめると離脱症状（ふるえ・興奮・発汗・発熱）が出る。",
            "抜管前にカフリークテスト。漏れなければ声門下の浮腫を疑い、ステロイドを考える。"
        ],
        points: ["まず PSV で自分で吸う力を取り戻す",
                 "PS は 6〜8 mL/kg を楽に出せる最小の圧",
                 "鎮静薬は少しずつ減らす"],
        tasks: [
            .talk(.scene, "12 日目。ミオちゃんの肺の影はほとんど消えた。熱もなく、お母さんの声に目を開けるようになった。")
                .starting { c in
                c.engine.adjustPatient { p in
                        p.compliance = 0.0105
                        p.shuntAtLowPEEP = 0.14; p.shuntMinimum = 0.05
                        p.driveGain = 1.1; p.temperature = 37.0
                    }
            },
            .talk(.doctor, "ここからは外す相談です。硬かった肺ほど、外すときは慎重に。まず手伝い方を変えます。"),
            .talk(.puku, "いきなり SBT じゃないの？"),
            .talk(.doctor, "12 日間、ほとんどの呼吸を機械に任せていました。先に PSV で、自分で吸うことを思い出してもらいます。"),
            .talk(.doctor, "鎮静薬も 12 日使っています。急に切ると、ふるえや興奮が出ます（離脱症状）。浅くするのは、少しずつ。"),
            .step("「鎮静」を 30% まで下げて確定してください。",
                  why: "呼吸中枢が目を覚まし、自分で吸いはじめます。",
                  check: { $0.engine.sedation <= 0.32 })
                .spotting(["key:sed"]).watching(["RR tot"]),
            .talk(.doctor, "PSV は、患者が吸うたびに決めた圧で後押しするだけのモードでしたね。始めるのも止めるのも、この子です。"),
            .key("モードを「PSV」に切り替えてください。",
                 event: .modePSV,
                 why: "機械からの強制換気がなくなりました。すべての呼吸を、ミオちゃんが始めています。")
                .spotting(["mode:PSV"]),
            .step("PS を調整して Vte を 6〜8 mL/kg に入れ、30 秒保ってください。",
                  hold: 30,
                  why: "楽に目標の量を出せています。呼吸回数も、この年齢の範囲です。",
                  check: { (5.5...8.5).contains($0.tidalPerKg) })
                .hinting { c in
                "体重 " + LessonLibrary.number(c.pbw) + " kg なので目標は " + LessonLibrary.mlkg(c.pbw, 6) + "〜" + LessonLibrary.mlkg(c.pbw, 8) + " mL です。"
            }
                .spotting(["key:ps"]).watching(["Vte", "RR tot", "f/VT"]),
            .talk(.doctor, "f/VT は、呼吸回数 ÷ 一回換気量（mL/kg）。8 を超える浅く速い呼吸は、疲れのサインです。"),
            .quiz("体重 14 kg、RR 36、Vte 84 mL。f/VT はいくつですか。",
                  ["6",
                   "0.4",
                   "36",
                   "判定できない"], answer: 0,
                  miss: [nil,
                   "割る向きが逆です。RR を mL/kg で割ります。",
                   "RR をそのまま答えています。",
                   "体重と RR と量があれば計算できます。"],
                  why: "84 ÷ 14 ＝ 6 mL/kg、36 ÷ 6 ＝ 6。8 未満なので、浅く速い呼吸にはなっていません。"),
            .key("「離脱」キーで、条件のリストを開いてください。",
                 event: .openWeaning,
                 why: "× がついている項目が、いま足りていないものです。")
                .spotting(["hard:kWean"]),
            .step("設定を調整して、リストを全部 ✓ にしてください。",
                  hint: "FiO₂ 40% 以下、PEEP 7 以下。P/F 比も 200 以上が要ります。",
                  why: "条件がそろいました。",
                  check: { LessonLibrary.readyToWean($0) })
                .spotting(["key:fio2", "key:peep", "key:sed"]).watching(["SpO₂", "RR tot", "ABP mean"]),
            .key("「離脱」キーから SBT を開始してください。",
                 event: .startSBT,
                 why: "PEEP 5 と PS 8 に切り替わり、30 分の計測が始まりました。")
                .spotting(["hard:kWean"]),
            .step("30 分の SBT を、最後まで通してください。",
                  hint: "「× 10」や「× 60」で早送りできます。中止になったら原因を直して、もう一度開始します。",
                  why: "30 分、崩れずに呼吸できました。",
                  check: { $0.sbt.finished && $0.sbt.passed })
                .spotting(["val:f/VT"]).watching(["f/VT", "RR tot", "SpO₂", "HR"]),
            .talk(.doctor, "カフリークテストは、カフの空気を抜いて、チューブのまわりから空気が漏れるかを見る検査。漏れなければ、声門の下が腫れています。"),
            .quiz("挿管 12 日目の 3 歳。カフリークがありません。どうしますか。",
                  ["ステロイドを使い、半日〜1 日おいて再評価する",
                   "そのまま抜管する",
                   "鎮静を深くする",
                   "気管切開を決める"], answer: 0,
                  miss: [nil,
                   "抜管後に声門下の浮腫で窒息しかけ、再挿管になる危険が高い状態です。",
                   "浮腫は鎮静では引きません。",
                   "1 回の結果で決めるのは早すぎます。"],
                  why: "長く挿管した子ほど声門の下が腫れます。ステロイドで浮腫を引かせてから抜くと、抜管後の stridor を減らせます。"),
            .talk(.scene, "ステロイドを使って半日。もう一度カフを抜くと、チューブのまわりから、かすかに空気の漏れる音がした。"),
            .key("「離脱」キーから抜管してください。",
                 event: .extubate)
                .spotting(["hard:kWean"]),
            .step("結果を確認してください。",
                  why: "抜管できました。ミオちゃんは HFNC をつけて、お母さんの手を握り返しています。",
                  check: { $0.extubated })
                .watching(["SpO₂", "RR tot"])
        ])

    static let lesson9_1 = Lesson(
        id: "9-1", title: "生まれてすぐの初期設定", minutes: 8, scenarioID: "rds",
        prepare: { s in
            s.mode = .pressureAssistControl
            s.inspiratoryPressure = 18; s.respiratoryRate = 40; s.peep = 5; s.fio2 = 1
            s.inspiratoryTime = 0.5
        },
        sedation: 0.8,
        brief: [
            "新生児は圧規定（PC）が基本。カフのないチューブから漏れるので、量を決めても保証できない。",
            "目標は Vte 4〜6 mL/kg、吸気時間 0.3 秒前後、呼吸回数 40〜60、PEEP 5〜7。",
            "入れすぎると CO₂ が下がりすぎる。低い PaCO₂ は脳の血流を減らし、早産児の脳を傷める。",
            "SpO₂ の目標は 90〜95%。高すぎる酸素は未熟児網膜症の原因になる。"
        ],
        points: ["新生児は PC。Vte 4〜6 mL/kg を P insp で作る",
                 "吸気時間 0.3 秒、PEEP 5〜7",
                 "SpO₂ は 90〜95%（上げすぎない）"],
        tasks: [
            .talk(.scene, "2 週目、NICU の夜。在胎 28 週で生まれた男の子が、保育器ごと運ばれてきた。体重 1,100 g。あおい君。"),
            .talk(.scene, "分娩室で挿管され、肺を広げる薬が気管から 1 回入っている。呼吸器は、蘇生したときの設定のままだ。"),
            .talk(.doctor, "その薬がサーファクタント。肺胞の内側に薄く広がり、しぼまないように支える物質です。早産の子は、これが足りません。"),
            .talk(.puku, "ぼく、この大きさの子は初めて…。手のひらに乗っちゃいそう。"),
            .talk(.doctor, "新生児は、圧を決める PC で換気するのが一般的です。カフのないチューブで漏れるので、量を決めても守れないからです。"),
            .talk(.doctor, "まず吸気時間（Ti）。新生児の肺は小さく、τ が短いので、0.3 秒ほどで満ちます。長いと、吸いきったまま押し続けることになります。"),
            .step("Ti を 0.3 秒にして確定してください。",
                  why: "吐く時間にゆとりができました。この子の自然な呼吸のリズムにも近くなります。",
                  check: { $0.settings.inspiratoryTime <= 0.35 })
                .spotting(["key:ti"]).watching(["I:E", "Vte"]),
            .talk(.doctor, "P insp は、PEEP に上乗せする吸気の圧。上げるほど入る量が増えます。目標は 4〜6 mL/kg、この子なら 4.4〜6.6 mL です。"),
            .talk(.puku, "いまは何 mL 入ってるの？")
                .looking(["val:Vte"]),
            .step("P insp を下げて、Vte を 4〜6 mL/kg に入れてください。",
                  hold: 20,
                  why: "蘇生のときは、肺を広げるために強めに押していました。そのままでは入れすぎで、CO₂ も下がりすぎます。",
                  check: { (4...6.4).contains($0.tidalPerKg) })
                .hinting { c in
                "体重 " + LessonLibrary.number(c.pbw) + " kg なので " + LessonLibrary.mlkg(c.pbw, 4) + "〜" + LessonLibrary.mlkg(c.pbw, 6) + " mL。Vte のタイルの右上が mL/kg です。"
            }
                .spotting(["key:pinsp"]).watching(["Vte", "PIP", "etCO₂"]),
            .quiz("早産児で PaCO₂ 25 まで下がっています。何が心配ですか。",
                  ["脳の血流が減り、脳を傷める",
                   "肺が硬くなる",
                   "血糖が下がる",
                   "何も心配ない"], answer: 0,
                  miss: [nil,
                   "CO₂ そのものは肺の硬さを変えません。",
                   "血糖とは直接関係しません。",
                   "低すぎる CO₂ は、早産児では見逃せない害があります。"],
                  why: "CO₂ が下がると脳の血管が縮み、血流が減ります。早産児の脳はこれに弱く、脳室周囲白質軟化症の原因になります。入れすぎないことも、守ることのうちです。"),
            .talk(.doctor, "PEEP は肺胞の支え。サーファクタント不足で肺胞がしぼむ病気を呼吸窮迫症候群（RDS）と言い、PEEP 5〜7 が目安です。"),
            .step("PEEP を 7 に上げて確定してください。",
                  hold: 10,
                  why: "しぼみかけた肺胞が支えられ、酸素化が良くなりはじめます。",
                  check: { $0.settings.peep >= 7 })
                .spotting(["key:peep"]).watching(["SpO₂", "Vte", "ABP mean"]),
            .talk(.doctor, "早産児の SpO₂ の目標は 90〜95%。上げすぎると、目の網膜の血管が異常に伸びます。未熟児網膜症です。"),
            .step("FiO₂ を下げて、SpO₂ を 90〜95% に 30 秒入れてください。",
                  hint: "5〜10% ずつ下げます。95% を超えていたら、まだ下げられます。",
                  hold: 30,
                  why: "酸素を「足りるだけ」に合わせました。多すぎても少なすぎても害になるのが、早産児の酸素です。",
                  check: { $0.settings.fio2 < 0.99 && (90...95).contains($0.engine.spo2) })
                .spotting(["key:fio2"]).watching(["SpO₂"]),
            .quiz("早産児で SpO₂ 99%、FiO₂ 0.5。どうしますか。",
                  ["そのまま",
                   "FiO₂ を下げる",
                   "PEEP を上げる",
                   "呼吸回数を上げる"], answer: 1,
                  miss: ["SpO₂ 99% は、この子には高すぎます。",
                   nil,
                   "酸素化は足りています。",
                   "回数は CO₂ のつまみです。"],
                  why: "目標は 90〜95%。99% は高すぎるので下げます。量・時間・圧・酸素、考え方はハルト君と同じで、桁だけが違います。")
        ])

    static let lesson9_2 = Lesson(
        id: "9-2", title: "サーファクタントが効いてきた", minutes: 8, scenarioID: "rds",
        prepare: { s in
            s.mode = .pressureAssistControl
            s.inspiratoryPressure = 12; s.respiratoryRate = 45; s.peep = 7; s.fio2 = 0.45
            s.inspiratoryTime = 0.3
        },
        sedation: 0.8,
        brief: [
            "サーファクタントが効くと、数時間で肺が急に柔らかくなる。PC では、同じ圧のまま入る量が増えていく。",
            "気づかずにいると、入れすぎ（容量損傷）と CO₂ の下がりすぎが同時に起きる。Vte を見て P insp を下げる。",
            "早産児の血液ガスの目標は pH 7.25 以上、PaCO₂ 45〜55 前後。正常値より高めを許す。"
        ],
        points: ["肺が柔らかくなると、PC では量が増える",
                 "Vte を見て P insp を下げる",
                 "早産児は PaCO₂ 45〜55 を許す"],
        tasks: [
            .talk(.scene, "生まれて 6 時間。あおい君の胸の上がりが、少しずつ大きくなってきた。保育器の中で、手足をもぞもぞと動かしている。")
                .starting { c in
                c.engine.adjustPatient { p in
                        p.compliance = 0.0008
                        p.shuntAtLowPEEP = 0.26; p.shuntMinimum = 0.10
                    }
            },
            .talk(.doctor, "サーファクタントが効いてきました。ここからの数時間は、呼吸器の前を離れられません。"),
            .talk(.puku, "良くなってるなら、安心なんじゃないの？"),
            .talk(.doctor, "PC は圧を約束するモードでした。肺が柔らかくなると、同じ圧で入る量が増えます。何が起きるか、見てみましょう。"),
            .step("Vte と Cstat を 30 秒見てください。",
                  hold: 30,
                  check: { _ in true })
                .explaining { c in
                "Vte は " + String(format: "%.1f", c.tidalPerKg) + " mL/kg。圧は変えていないのに、目標の 6 を超えています。肺が柔らかくなった（Cstat が上がった）ぶんです。"
            }
                .spotting(["val:Vte", "val:Cstat"]).watching(["Vte", "Cstat", "etCO₂"]),
            .quiz("PC で肺が急に柔らかくなりました。このまま放っておくと？",
                  ["入れすぎと、CO₂ の下がりすぎが起きる",
                   "量が減って CO₂ が上がる",
                   "何も変わらない",
                   "圧が上がる"], answer: 0,
                  miss: [nil,
                   "逆です。同じ圧で入る量は増えます。",
                   "量が変わっています。",
                   "PC では圧は設定どおりです。"],
                  why: "肺胞が伸ばされすぎ（容量損傷）、CO₂ も吐き出されすぎます。圧を約束するモードでは、量を見張るのが人の仕事です。"),
            .step("P insp を下げて、Vte を 4〜6 mL/kg に戻してください。",
                  hold: 20,
                  why: "同じ量を、より低い圧で入れられるようになりました。これが「肺が良くなった」の姿です。",
                  check: { (4...6.2).contains($0.tidalPerKg) && $0.settings.inspiratoryPressure < 12 })
                .hinting { c in
                "目標は " + LessonLibrary.mlkg(c.pbw, 4) + "〜" + LessonLibrary.mlkg(c.pbw, 6) + " mL。1 ずつ下げて Vte を見ます。"
            }
                .spotting(["key:pinsp"]).watching(["Vte", "PIP", "ΔP"]),
            .talk(.doctor, "柔らかくなれば、酸素の通り道も開きます。SpO₂ を見てください。"),
            .step("SpO₂ 90〜95% を保ったまま、FiO₂ を 30% 以下にしてください。",
                  hold: 30,
                  why: "酸素も下げられました。サーファクタントが効くと、FiO₂ は数時間で大きく下がります。",
                  check: { $0.settings.fio2 <= 0.31 && (90...96).contains($0.engine.spo2) })
                .spotting(["key:fio2"]).watching(["SpO₂"]),
            .talk(.doctor, "早産児の血液ガスは、正常値より少し CO₂ が高めでも許します。pH 7.25 以上、PaCO₂ 45〜55 前後が目安です。"),
            .step("数分進めてから採血し、PaCO₂ を確かめてください。",
                  hint: "「× 10」で 5 分ほど進めてから「血液ガス」を押します。",
                  check: { !$0.bloodGases.isEmpty })
                .explaining { c in
                guard let g = c.lastBloodGas else { return "" }
                    return String(format: "pH %.2f、PaCO₂ %.0f。", g.pH, g.paco2)
                        + (g.paco2 < 40 ? "まだ少し下がりすぎです。呼吸回数を下げる余地があります。" : "この子の目標の範囲です。")
            }
                .spotting(["hard:kAbg"]).watching(["etCO₂", "MV"]),
            .quiz("早産児、pH 7.28 / PaCO₂ 52。どうしますか。",
                  ["このままでよい",
                   "呼吸回数を上げて CO₂ を 40 にする",
                   "P insp を上げる",
                   "FiO₂ を上げる"], answer: 0,
                  miss: [nil,
                   "正常値に合わせようと換気を増やすと、肺を傷め、CO₂ も下がりすぎます。",
                   "量が増えて肺を傷めます。",
                   "FiO₂ は CO₂ には効きません。"],
                  why: "早産児は、肺を守るために高めの CO₂ を許します。換気を減らすほど、慢性肺疾患（気管支肺異形成症）を減らせます。")
        ])

    static let lesson9_3 = Lesson(
        id: "9-3", title: "抜管して CPAP へ", minutes: 9, scenarioID: "rds",
        prepare: { s in
            s.mode = .pressureAssistControl
            s.inspiratoryPressure = 9; s.respiratoryRate = 40; s.peep = 6; s.fio2 = 0.3
            s.inspiratoryTime = 0.3
        },
        sedation: 0.6,
        brief: [
            "早産児はできるだけ早く抜管する。挿管が長いほど、肺と脳の合併症が増える。",
            "抜管の前にカフェイン。未熟な呼吸中枢を目覚めさせ、無呼吸を減らし、抜管の成功率を上げる。",
            "回数と圧を下げて、自分の呼吸を引き出す。抜管後は鼻から CPAP（nCPAP）で肺胞を支え続ける。"
        ],
        points: ["早産児はできるだけ早く抜管する",
                 "カフェインで呼吸中枢を目覚めさせる",
                 "抜管後は nCPAP で支える"],
        tasks: [
            .talk(.scene, "生まれて 3 日目。あおい君の酸素は 30% まで下がった。足の裏をくすぐると、顔をしかめて泣くそぶりを見せる。")
                .starting { c in
                c.engine.adjustPatient { p in
                        p.compliance = 0.0012
                        p.shuntAtLowPEEP = 0.12; p.shuntMinimum = 0.05
                        p.hco3Base = 24
                    }
                    /* 3 日間 PaCO₂ 50 前後が続いたので、腎臓が HCO₃⁻ を少し貯めている。 */
                    c.engine.setBicarbonate(26)
            },
            .talk(.doctor, "早産の子は、チューブが入っている時間が長いほど、肺も脳も傷みます。外せるなら、早く外します。"),
            .talk(.doctor, "先にカフェインを入れます。未熟な呼吸中枢を目覚めさせて、息が止まる発作（無呼吸）を減らす薬です。")
                .starting { c in
                c.engine.adjustPatient { p in p.maxInspiratoryPressure = 12; p.driveGain = 1.3 }
            },
            .talk(.puku, "コーヒーに入ってるやつ？ 赤ちゃんに？"),
            .talk(.doctor, "同じ物質です。早産児の無呼吸の、いちばん基本の薬です。そのうえで、機械の手伝いを減らして自分の呼吸を引き出します。"),
            .step("回数と P insp を下げ、自分の呼吸が 4 回/分 以上出るまで待ちます。",
                  hint: "RR 20〜25、P insp 7 前後が目安です。CO₂ が少し上がると、自分で吸いはじめます。",
                  why: "機械が引いたぶん、あおい君が自分で吸いはじめました。RR tot が設定より多くなっています。",
                  check: { c in
                      c.settings.respiratoryRate <= 30
                          && (c.measured.respiratoryRateTriggered >= 4 || c.measured.respiratoryRateSpontaneous >= 4)
                  })
                .spotting(["key:rr", "key:pinsp", "val:RR tot"]).watching(["RR tot", "Vte", "SpO₂"]),
            .key("「離脱」キーで、条件のリストを開いてください。",
                 event: .openWeaning,
                 why: "× がついている項目が、いま足りていないものです。")
                .spotting(["hard:kWean"]),
            .step("設定と鎮静を調整して、リストを全部 ✓ にしてください。",
                  hint: "FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅く。",
                  why: "条件がそろいました。",
                  check: { LessonLibrary.readyToWean($0) })
                .spotting(["key:fio2", "key:peep", "key:sed"]).watching(["SpO₂", "RR tot", "ABP mean"]),
            .talk(.doctor, "早産児の呼吸は不規則です。速くなったり、間があいたりをくり返します（周期性呼吸）。SpO₂ と心拍が保たれていれば、慌てません。"),
            .step("「離脱」キーから SBT を開始し、最後まで通してください。",
                  hint: "早送りを使ってください。中止になったら原因を直して、もう一度開始します。",
                  why: "自分の力で 30 分、呼吸を保てました。",
                  check: { $0.sbt.finished && $0.sbt.passed })
                .spotting(["hard:kWean"]).watching(["f/VT", "RR tot", "SpO₂", "HR"]),
            .talk(.doctor, "抜いたら、すぐ鼻から CPAP（nCPAP）。鼻に当てた管から一定の圧をかけ続け、PEEP の代わりに肺胞を支えます。"),
            .quiz("抜管後の nCPAP。30 秒ほど息が止まり、心拍が 80 に落ちました。まずすることは？",
                  ["体をさすって刺激し、戻らなければバッグで換気する",
                   "様子を見る",
                   "CPAP の圧を下げる",
                   "カフェインを中止する"], answer: 0,
                  miss: [nil,
                   "無呼吸と徐脈が続けば、脳に酸素が届きません。",
                   "圧を下げても呼吸は戻りません。",
                   "カフェインは無呼吸を減らす側の薬です。"],
                  why: "早産児の無呼吸は、まず刺激。戻らなければマスクとバッグで換気します。くり返すなら、再挿管も考えます。"),
            .key("「離脱」キーから抜管してください。",
                 event: .extubate)
                .spotting(["hard:kWean"]),
            .step("結果を確認してください。",
                  why: "抜管できました。あおい君は nCPAP につながれ、小さな胸で、自分の息をしています。",
                  check: { $0.extubated })
                .watching(["SpO₂", "RR tot"])
        ])

    static let lesson10_1 = Lesson(
        id: "10-1", title: "吐かせる初期設定", minutes: 8, scenarioID: "asthma",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 280; s.respiratoryRate = 24; s.peep = 5; s.fio2 = 0.6
            s.inspiratoryFlow = 30; s.inspiratoryPause = 0.3
        },
        sedation: 0.95,
        brief: [
            "喘息重積は、細くなった気管支から息が吐けない病気。回数を上げると auto-PEEP がたまり、血圧が下がる。",
            "設定は「吐かせる」が最優先。呼吸回数は少なく（学童で 10〜14）、吸気流量を上げて吸気時間を短くする。",
            "PIP は抵抗の分で高く出る。肺胞を守る目安は Pplat 30 以下と auto-PEEP。PIP だけで慌てない。"
        ],
        points: ["回数は少なく、呼気時間を長く",
                 "吸気流量を上げて吸気を短く",
                 "PIP より Pplat と auto-PEEP を見る"],
        tasks: [
            .talk(.scene, "3 週目の夕方。救急外来から、11 歳の男の子が運ばれてきた。喘息の発作で、吸入も点滴も効かず、意識が落ちて挿管された。レン君。"),
            .talk(.scene, "救急外来では、手でバッグを速く押していた。呼吸器も、その勢いのまま 24 回で動いている。血圧が下がってきている。")
                .starting { c in
                c.engine.lowerBloodPressure(to: 52)
            },
            .talk(.puku, "胸がふくらんだまま、ぜんぜんしぼんでない…"),
            .talk(.doctor, "吐けていないのです。喘息は、気管支が細くなって、とくに吐く息が出ていかない病気です。まず吐き残しを測ります。"),
            .key("「呼気ポーズ」で、吐き残しを測ってください。",
                 event: .expiratoryHold)
                .spotting(["hard:kExp"]),
            .step("測り終わるのを待ちます。",
                  check: { $0.holdSettled && $0.measured.autoPEEP > 0 })
                .explaining { c in
                "吐き残しの圧は " + String(format: "%.1f", c.memory["ap101"] ?? 0) + " cmH₂O。胸の中の圧が上がり、心臓に血液が戻れなくなっています。"
            }
                .passing { c in
                c.memory["ap101"] = c.measured.autoPEEP
                    c.memory["map101"] = c.engine.meanArterialPressure
            }
                .spotting(["val:auto-PEEP"]).watching(["auto-PEEP", "PEEP tot", "ABP mean"]),
            .talk(.doctor, "そうた君で覚えた順番です。いちばん効くのは、回数を下げて吐く時間を作ること。学童なら 10〜14 回まで下げます。"),
            .step("呼吸回数を 12 以下に下げてください。",
                  hold: 10,
                  why: "1 呼吸が 5 秒になり、吐く時間が大きく伸びました。",
                  check: { $0.settings.respiratoryRate <= 12 })
                .spotting(["key:rr"]).watching(["auto-PEEP", "ABP mean", "MV"]),
            .step("平均動脈圧が下限まで戻るのを見届けてください。",
                  hint: "戻るまで数分かかります。「× 10」で早送りできます。",
                  hold: 10,
                  check: { $0.engine.meanArterialPressure >= $0.engine.norms.meanArterialPressureMin })
                .explaining { c in
                "平均動脈圧 \(Int((c.memory["map101"] ?? 0).rounded())) → {ABP mean}。たまった空気が抜け、心臓に血液が戻りはじめました。"
            }
                .spotting(["val:ABP mean"]).watching(["ABP mean", "auto-PEEP", "SpO₂"]),
            .talk(.doctor, "次は吸気流量。速く入れれば、吸う時間が短くなり、そのぶん吐く時間が伸びます。"),
            .step("吸気流量を 40 L/分 に上げて確定してください。",
                  hold: 6,
                  why: "吸う時間と吐く時間の比（I:E）の、吐く側が伸びました。かわりに PIP は上がっています。",
                  check: { $0.settings.inspiratoryFlow >= 40 })
                .spotting(["key:flow"]).watching(["PIP", "Pplat", "I:E"]),
            .talk(.puku, "PIP がすごく高いよ！ 大丈夫なの？"),
            .talk(.doctor, "それを確かめる方法を、もう知っていますね。吸い終わりで流れを止めて、肺胞の圧だけを測ります。"),
            .key("「吸気ポーズ」を押して、Pplat を測ってください。",
                 event: .inspiratoryHold)
                .spotting(["hard:kInsp"]).watching(["PIP", "Pplat"]),
            .step("測り終わるのを待ちます。",
                  why: "PIP は高くても、Pplat は上限の 30 よりずっと低い。高いのは細い気管支を押し流す分で、肺胞にはかかっていません。",
                  check: { $0.measured.plateauPressure != nil && $0.holdSettled })
                .watching(["PIP", "Pplat", "Raw"]),
            .quiz("喘息の子で PIP 40、Pplat 18、auto-PEEP 2。いちばん気にするのは？",
                  ["PIP 40 なので流量を下げる",
                   "Pplat と auto-PEEP が低いので、いまは許容できる",
                   "PEEP を 15 に上げる",
                   "一回換気量を増やす"], answer: 1,
                  miss: ["流量を下げると吸気が伸び、吐く時間が削られます。",
                   nil,
                   "吐けない肺に外から圧を足すと、さらにふくらみます。",
                   "吐く量が増えて、吐き残しが増えます。"],
                  why: "肺胞を守る目安は Pplat と auto-PEEP。PIP は抵抗の分で高く出ます。PIP を下げようと流量を落とすのは、喘息ではよくある逆効果です。"),
            .step("SpO₂ 94% 以上のまま、FiO₂ を 40% 以下にしてください。",
                  hold: 20,
                  why: "喘息の子の肺胞は潰れていないので、酸素はすぐ下げられます。問題は、吐けないことだけです。",
                  check: { $0.settings.fio2 <= 0.41 && $0.engine.spo2 >= 94 })
                .spotting(["key:fio2"]).watching(["SpO₂"])
        ])

    static let lesson10_2 = Lesson(
        id: "10-2", title: "CO₂ を許し、血圧を守る", minutes: 8, scenarioID: "asthma",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 280; s.respiratoryRate = 12; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 40; s.inspiratoryPause = 0.3
        },
        sedation: 0.95,
        brief: [
            "吐かせる設定では CO₂ が上がる。喘息重積では pH 7.20 前後まで許し、回数を上げて CO₂ を追わない。",
            "auto-PEEP で血圧が急に落ちたら、回路を一瞬外して吐かせる（胸を軽く押す）。そのあと回数を下げる。",
            "高い CO₂ を許せないのは、頭蓋内圧が高いとき・肺高血圧・重い心機能低下。喘息の子は多くが当てはまらない。"
        ],
        points: ["喘息重積では pH 7.20 前後まで CO₂ を許す",
                 "回数を上げて CO₂ を追わない",
                 "急な血圧低下には、回路を外して吐かせる"],
        tasks: [
            .talk(.scene, "その夜。レン君の採血の結果を見た別の当直医が、CO₂ が高いと言って呼吸回数を 22 回に上げていった。")
                .starting { c in
                c.engine.settings.respiratoryRate = 22
            },
            .talk(.puku, "あれ、それってそうた君のときと同じ…"),
            .talk(.doctor, "同じ落とし穴です。数字だけを見ると、誰でも一度はやります。何が起きるか、モニターを見ていてください。"),
            .step("平均動脈圧と auto-PEEP の動きを 40 秒見てください。",
                  hold: 40,
                  why: "回数を上げたぶん吐ききれず、空気がたまっていきます。平均動脈圧が下がってきました。",
                  check: { _ in true })
                .spotting(["val:ABP mean", "val:auto-PEEP"]).watching(["ABP mean", "PIP", "SpO₂"]),
            .quiz("吐き残しで血圧が急に 40 台まで落ちました。最初にできることは？",
                  ["回路を一瞬外し、胸を軽く押して吐かせる",
                   "輸液だけを急いで入れる",
                   "PEEP を上げる",
                   "回数をさらに上げる"], answer: 0,
                  miss: [nil,
                   "輸液も助けになりますが、たまった空気が抜けないと戻りません。",
                   "外から圧を足すと、さらにふくらみます。",
                   "もっと吐けなくなります。"],
                  why: "回路を外すと、たまった空気が一気に出ていき、数秒で血圧が戻ることがあります。そのうえで回数を下げます。"),
            .step("呼吸回数を下げ、auto-PEEP を 3 未満にしてください。",
                  hint: "下げてから「呼気ポーズ」で測り直します。RR 12 以下が目安です。",
                  why: "吐く時間が戻り、たまっていた空気が抜けました。",
                  check: { c in
                      c.settings.respiratoryRate <= 14 && c.measured.autoPEEP < 3 && c.holdSettled
                  })
                .spotting(["key:rr", "hard:kExp"]).watching(["auto-PEEP", "ABP mean", "MV"]),
            .talk(.doctor, "では、CO₂ はどこまで許すのか。採血して、自分の目で確かめましょう。"),
            .step("数分進めてから採血し、pH と PaCO₂ を確かめてください。",
                  hint: "「× 10」で 5 分ほど進めてから「血液ガス」を押します。",
                  check: { !$0.bloodGases.isEmpty })
                .explaining { c in
                guard let g = c.lastBloodGas else { return "" }
                    return String(format: "pH %.2f、PaCO₂ %.0f。", g.pH, g.paco2)
                        + (g.pH >= 7.2 ? "CO₂ は高くても、pH は許せる範囲です。"
                           : "pH が 7.20 を割っています。回数を 1〜2 回だけ足し、auto-PEEP を見ながら調整します。")
            }
                .spotting(["hard:kAbg"]).watching(["etCO₂", "ABP mean"]),
            .talk(.doctor, "高い CO₂ を許す考え方は、ミオちゃんのときと同じ permissive hypercapnia。違うのは、守っているのが肺胞ではなく循環だということです。"),
            .quiz("喘息重積、pH 7.21 / PaCO₂ 66、平均血圧は保てています。どうしますか。",
                  ["このまま許容し、気管支を広げる治療を続ける",
                   "回数を 22 に戻す",
                   "一回換気量を 12 mL/kg に増やす",
                   "PEEP を上げる"], answer: 0,
                  miss: [nil,
                   "さっきの状態に戻り、血圧が下がります。",
                   "Pplat と吐き残しが増えます。",
                   "CO₂ には効きません。"],
                  why: "吐ける範囲の換気で、高い CO₂ は許します。CO₂ を下げるのは機械ではなく、ステロイドや気管支拡張薬で気道が開くことです。"),
            .talk(.puku, "数字を良くしようとして、子どもを悪くしちゃうことがあるんだね。"),
            .quiz("高い CO₂ を許してはいけないのは、どの子ですか。",
                  ["頭部外傷で頭蓋内圧が高い子",
                   "喘息重積の子",
                   "ARDS の子",
                   "細気管支炎の子"], answer: 0,
                  miss: [nil,
                   "喘息重積は、高い CO₂ を許す代表です。",
                   "ARDS も肺を守るために許します。",
                   "細気管支炎でも許します。"],
                  why: "CO₂ が上がると脳の血管が広がり、頭蓋内圧がさらに上がります。肺高血圧や重い心不全の子でも使えません。")
        ])

    static let lesson10_3 = Lesson(
        id: "10-3", title: "気管支が開いたら", minutes: 9, scenarioID: "asthma",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 280; s.respiratoryRate = 12; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 40; s.inspiratoryPause = 0.3
        },
        sedation: 0.7,
        brief: [
            "喘息の人工呼吸は短い。気管支が開けば 1〜3 日で外せることが多い。",
            "開いてきたことは、PIP と Pplat の差（抵抗の分）が縮むことで分かる。auto-PEEP も消えていく。",
            "鎮静を浅くすると咳や体動で発作がぶり返すことがある。抜くと決めたら、間をあけずに進める。"
        ],
        points: ["PIP − Pplat が縮む＝気管支が開いた",
                 "auto-PEEP が消えたら回数を戻せる",
                 "決めたら間をあけずに抜管まで進める"],
        tasks: [
            .talk(.scene, "翌日の昼。ステロイドと気管支拡張薬が効いてきた。聴診すると、呼気の音がはっきり聞こえる。")
                .starting { c in
                c.engine.adjustPatient { p in
                        p.resistanceInsp = 16; p.resistanceExp = 22
                        p.heartRate = 100; p.driveGain = 1.0
                    }
            },
            .talk(.doctor, "気管支が開いたかどうかは、数字でも分かります。昨日と同じ方法で、圧の中身を分けてみましょう。"),
            .key("「吸気ポーズ」を押して、Pplat を測ってください。",
                 event: .inspiratoryHold)
                .spotting(["hard:kInsp"]).watching(["PIP", "Pplat"]),
            .step("測り終わるのを待ちます。",
                  why: "PIP と Pplat の差が、昨日よりずっと小さくなっています。Raw も下がりました。気管支が開いた証拠です。",
                  check: { $0.measured.plateauPressure != nil && $0.holdSettled })
                .watching(["PIP", "Pplat", "Raw"]),
            .quiz("昨日は PIP 40 / Pplat 18、今日は PIP 24 / Pplat 17。何が変わりましたか。",
                  ["気道の抵抗が下がった",
                   "肺が硬くなった",
                   "一回換気量が減った",
                   "PEEP が上がった"], answer: 0,
                  miss: [nil,
                   "肺が硬くなれば Pplat が上がります。Pplat はほぼ同じです。",
                   "VC なので量は同じです。",
                   "PEEP は触っていません。"],
                  why: "差（抵抗の分）が 22 → 7 に縮みました。肺胞にかかる Pplat はほぼ同じ。同じ数字の読み方で、良くなったことも分かります。"),
            .talk(.doctor, "喘息の人工呼吸は、うまくいけば短く済みます。開いたら、間をあけずに外しにいきます。"),
            .key("「離脱」キーで、条件のリストを開いてください。",
                 event: .openWeaning,
                 why: "× がついている項目が、いま足りていないものです。")
                .spotting(["hard:kWean"]),
            .step("設定と鎮静を調整して、リストを全部 ✓ にしてください。",
                  hint: "鎮静を浅くして自発呼吸を出します。FiO₂ 40% 以下、PEEP 7 以下。",
                  why: "条件がそろいました。",
                  check: { LessonLibrary.readyToWean($0) })
                .spotting(["key:fio2", "key:peep", "key:sed"]).watching(["SpO₂", "RR tot", "ABP mean"]),
            .talk(.puku, "目が覚めたら、また発作が起きたりしない？"),
            .talk(.doctor, "起きることがあります。だから SBT のあいだも聴診と呼気ポーズで、吐けているかを確かめ続けます。"),
            .step("「離脱」キーから SBT を開始し、最後まで通してください。",
                  hint: "早送りを使ってください。中止になったら原因を直して、もう一度開始します。",
                  why: "30 分、吐けなくなることもなく呼吸できました。",
                  check: { $0.sbt.finished && $0.sbt.passed })
                .spotting(["hard:kWean"]).watching(["f/VT", "RR tot", "SpO₂", "HR"]),
            .quiz("抜管後、喘息の再発を防ぐのにいちばん大事なことは？",
                  ["吸入ステロイドを毎日続ける",
                   "発作のときだけ吸入する",
                   "運動を禁止する",
                   "酸素を家でも続ける"], answer: 0,
                  miss: [nil,
                   "それでは炎症がくすぶり続けます。レン君は自己中断から重積になりました。",
                   "運動は、発作をコントロールできていれば続けられます。",
                   "発作のない日の酸素は要りません。"],
                  why: "レン君は吸入ステロイドを自分でやめていました。治療は呼吸器を外して終わりではなく、次の発作を起こさないことまでです。"),
            .key("「離脱」キーから抜管してください。",
                 event: .extubate)
                .spotting(["hard:kWean"]),
            .step("結果を確認してください。",
                  why: "抜管できました。レン君は少しかすれた声で「…ごめんなさい、薬」と言った。",
                  check: { $0.extubated })
                .watching(["SpO₂", "RR tot"])
        ])

    static let lesson11_1 = Lesson(
        id: "11-1", title: "休ませながら鍛える", minutes: 9, scenarioID: "gbs",
        prepare: { s in
            s.mode = .pressureSupport
            s.pressureSupport = 12; s.peep = 5; s.fio2 = 0.3; s.respiratoryRate = 16
            s.tidalVolume = 160
        },
        sedation: 0.2,
        brief: [
            "呼吸の筋肉は、使わなければ衰え、使いすぎれば疲れる。SBT に失敗した日は、24 時間しっかり休ませる。",
            "鍛えるときは、PS を少しずつ下げて、呼吸回数と f/VT を見る。浅く速くなってきたら、そこが今日の限界。",
            "昼に鍛え、夜は休ませる。疲れきるまで粘らせると、翌日はかえって弱くなる。"
        ],
        points: ["失敗した日は休ませる",
                 "PS を下げて、RR と f/VT で限界を見る",
                 "浅く速くなったら PS を戻して休ませる"],
        tasks: [
            .talk(.scene, "3 週目。あかりちゃんは挿管から 4 週間を過ぎた。手で物をつかめるようになった。最初の SBT のあとは熱と痰で抜管を見送り、2 回目の SBT は 18 分で崩れた。"),
            .talk(.doctor, "あかりちゃんの肺はきれいです。足りないのは筋力だけ。だから、休ませながら鍛えます。"),
            .talk(.puku, "休ませながら、鍛える？ どっちなの？"),
            .talk(.doctor, "両方です。筋肉は、使わなければ衰え、使いすぎれば疲れます。その間の、ちょうどいい負荷を探します。"),
            .talk(.doctor, "いまは PSV で、PS は 12。この子が吸うたびに、かなり強く後押ししています。呼吸は楽なはずです。"),
            .step("呼吸回数と f/VT を 60 秒見てください。",
                  hold: 60,
                  why: "ゆっくり深い呼吸です。いまは、ほとんど機械が仕事をしています。",
                  check: { $0.measured.rsbiPerKg != nil })
                .passing { c in
                c.memory["rr111"] = c.measured.respiratoryRateTotal
            }
                .spotting(["val:RR tot", "val:f/VT"]).watching(["RR tot", "f/VT", "Vte"]),
            .step("PS を 7 に下げて、15 分見てください。",
                  hint: "「× 60」で早送りできます。RR tot と f/VT の動きに注目します。",
                  hold: 900,
                  check: { $0.settings.pressureSupport <= 7 })
                .explaining { c in
                "呼吸回数 \(Int((c.memory["rr111"] ?? 0).rounded())) → {RR tot}。手伝いを減らすと、浅く速くなっていきます。"
                        + "最初の数分は保てても、時間とともに崩れていくのが筋力の弱い子の特徴です。"
            }
                .spotting(["key:ps", "val:RR tot"]).watching(["RR tot", "f/VT", "Vte"]),
            .quiz("PS を下げて 15 分。RR がじわじわ上がり、Vte が減ってきました。どうしますか。",
                  ["PS を戻して休ませる",
                   "さらに PS を下げて鍛える",
                   "鎮静を深くする",
                   "そのまま 1 時間粘る"], answer: 0,
                  miss: [nil,
                   "疲れた筋肉にさらに負荷をかけると、翌日はかえって弱くなります。",
                   "呼吸が弱まり、休むのとは違います。",
                   "疲れきるまで粘らせるのは、鍛えることになりません。"],
                  why: "浅く速くなってきたところが、今日の限界です。そこで手伝いを戻し、休ませる。明日は少し長く、少し低い PS で試します。"),
            .step("PS を 10 以上に戻し、呼吸回数が落ち着くのを見てください。",
                  hold: 120,
                  why: "後押しが戻り、呼吸が深くゆっくりになりました。今日の練習はここまでです。",
                  check: { $0.settings.pressureSupport >= 10 })
                .spotting(["key:ps"]).watching(["RR tot", "f/VT", "Vte"]),
            .talk(.patient, "（あかりちゃんが、文字盤を指でたどる。「つかれた。でも、きのうより、ながかった」）"),
            .talk(.doctor, "昼に少し鍛えて、夜はしっかり休ませる。毎日の小さな積み重ねが、いちばんの近道です。"),
            .quiz("神経筋の病気で長く挿管している子。夜間の設定で正しいのは？",
                  ["夜は手伝いを十分にして、呼吸の筋肉を休ませる",
                   "夜こそ PS を下げて鍛える",
                   "夜は鎮静を深くして呼吸を止める",
                   "夜も昼も同じ低い PS"], answer: 0,
                  miss: [nil,
                   "眠っているあいだは呼吸が浅くなり、疲れがたまります。",
                   "止めると筋肉はかえって衰えます。",
                   "休む時間がなくなり、疲れが抜けません。"],
                  why: "休む時間がないと、疲れは翌日に持ち越されます。鍛える時間と休む時間を分けるのが、長い離脱のこつです。")
        ])

    static let lesson11_2 = Lesson(
        id: "11-2", title: "三度目の SBT と抜管", minutes: 10, scenarioID: "gbs",
        prepare: { s in
            s.mode = .pressureSupport
            s.pressureSupport = 8; s.peep = 5; s.fio2 = 0.3; s.respiratoryRate = 16
            s.tidalVolume = 160
        },
        sedation: 0.2,
        brief: [
            "神経筋の病気では、肺がきれいでも、咳の力が弱いと痰を出せない。抜管の前に咳と飲み込みも確かめる。",
            "長く挿管した子は、抜管後に NPPV（マスクでの陽圧換気）で手伝うと、再挿管を減らせることがある。",
            "カフリークテストで声門下の浮腫を確かめる。漏れなければステロイドを考える。"
        ],
        points: ["肺だけでなく、咳と飲み込みを確かめる",
                 "抜管後は NPPV で手伝うことがある",
                 "長い挿管ほどカフリークを確かめる"],
        tasks: [
            .talk(.scene, "3 週目の終わり。あかりちゃんは、手すりにつかまって座れるようになった。毎日の練習で、PS 8 なら 1 日じゅう疲れずにいられる。")
                .starting { c in
                c.engine.adjustPatient { p in p.maxInspiratoryPressure = 12; p.fatigueLoad = 0.3 }
            },
            .talk(.doctor, "今日、もう一度 SBT をします。前回は 18 分で崩れました。今度は、30 分を目指します。"),
            .talk(.puku, "がんばれ、あかりちゃん…！"),
            .key("「離脱」キーで、条件のリストを開いてください。",
                 event: .openWeaning,
                 why: "× がついている項目が、いま足りていないものです。")
                .spotting(["hard:kWean"]),
            .step("設定と鎮静を調整して、リストを全部 ✓ にしてください。",
                  hint: "FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅く、自発呼吸があること。",
                  why: "条件がそろいました。",
                  check: { LessonLibrary.readyToWean($0) })
                .spotting(["key:fio2", "key:peep", "key:sed"]).watching(["SpO₂", "RR tot", "ABP mean"]),
            .key("「離脱」キーから SBT を開始してください。",
                 event: .startSBT,
                 why: "PEEP 5 と PS 6 に切り替わり、30 分の計測が始まりました。")
                .spotting(["hard:kWean"]),
            .step("30 分の SBT を、最後まで見届けてください。",
                  hint: "「× 10」や「× 60」で早送りできます。後半の RR と f/VT に注目します。",
                  why: "30 分、後半まで崩れずに呼吸できました。前回、18 分で崩れた子です。",
                  check: { $0.sbt.finished && $0.sbt.passed })
                .spotting(["val:f/VT"]).watching(["f/VT", "RR tot", "Vte", "SpO₂"]),
            .talk(.doctor, "ギラン・バレーの子は、呼吸の筋肉だけでなく、咳や飲み込みの力も弱っています。肺がきれいでも、痰を出せなければ戻ってきます。"),
            .quiz("SBT に通ったあかりちゃん。抜管の前に、ほかに確かめることは？",
                  ["咳の強さ・飲み込み・カフリーク",
                   "何もない",
                   "体重",
                   "胸の X 線だけ"], answer: 0,
                  miss: [nil,
                   "SBT は呼吸の力の試験です。気道を守れるかは別に見ます。",
                   "体重は設定を決める材料ですが、抜管の判断ではありません。",
                   "肺はきれいです。見るのは気道を守る力です。"],
                  why: "呼吸が保てることと、気道を守れることは別でした。神経筋の病気では、咳と飲み込みがとくに大事です。4 週間挿管していたので、カフリークも確かめます。"),
            .talk(.doctor, "抜いたあと、マスクで陽圧をかけて呼吸を手伝う方法があります。NPPV です。弱い筋肉の子の、抜管後の支えになります。"),
            .talk(.scene, "あかりちゃんが、大きく咳をした。チューブの中を、痰が勢いよく上がってくる。"),
            .key("「離脱」キーから抜管してください。",
                 event: .extubate)
                .spotting(["hard:kWean"]),
            .step("結果を確認してください。",
                  why: "抜管できました。あかりちゃんは NPPV のマスクの下で、4 週間ぶりに自分の声で「ありがとう」と言った。",
                  check: { $0.extubated })
                .watching(["SpO₂", "RR tot"])
        ])
}
