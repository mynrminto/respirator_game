import Foundation

/* 第4〜6章。血液ガス、トラブル対応、離脱まで。
 * 文面・課題・判定はすべて web/lessons.js と同じ。片方だけ直さないこと。 */

extension LessonLibrary {

    // MARK: - 第4章　血液ガスを読む

    static let lesson4_1 = Lesson(
        id: "4-1", title: "4 ステップで読む", minutes: 6, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        brief: [
            "① pH → ② PaCO₂（呼吸性か）→ ③ HCO₃⁻（代謝性か）→ ④ 代償が予想どおりか、の順に読む。",
            "急性の呼吸性アシドーシスは PaCO₂ +10 で HCO₃⁻ +1、慢性なら +3.5。ずれていれば別の異常が隠れている。",
            "正常値は年齢で違う（HCO₃⁻ は新生児 18〜24、幼児以降 21〜26）。酸素化は P/F と OI で別枠。"
        ],
        points: ["pH → PaCO₂ → HCO₃⁻ → 代償の順で読む",
                 "急性は PaCO₂ +10 で HCO₃⁻ +1、慢性は +3.5",
                 "正常値は年齢で違う。酸素化は P/F と OI で別に評価する"],
        tasks: [
            .talk(.scene, "朝 6 時。ハルト君の定時の採血。いぶき先生が、結果の読み方を教えてくれるという。"),
            .talk(.doctor, "血液ガスは 4 ステップで読みます。順番さえ守れば、迷いません。"),
            .talk(.puku, "4 つも覚えるの？"),
            .talk(.doctor, "pH → PaCO₂ → HCO₃⁻ → 代償。それだけです。まず採ってみましょう。"),
            .key("「血液ガス」を押して採血してください。", event: .orderBloodGas,
                 why: "結果が出るまで約 2 分かかります。急ぐときは「× 10」で早送りできます。")
                .spotting(["hard:kAbg"]),
            .step("結果が返るまで待ちます。",
                  check: { !$0.bloodGases.isEmpty })
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "pH %.2f / PaCO₂ %.0f / PaO₂ %.0f。この画面はハードキーからいつでも開き直せます。",
                                  g.pH, g.paco2, g.pao2)
                }
                .watching(["etCO₂", "SpO₂"]),
            .talk(.doctor, "返ってきましたね。まず、いまの結果を順番どおりに読んでみましょう。"),
            .quiz("いまの結果はどう読みますか。",
                  asking: { c in
                      guard let g = c.lastBloodGas else { return "いまの結果はどう読みますか。" }
                      return String(format: "いまの結果は pH %.2f / PaCO₂ %.0f / HCO₃⁻ %.0f。どう読みますか。",
                                    g.pH, g.paco2, g.hco3)
                  },
                  ["ほぼ正常範囲",
                   "呼吸性アシドーシス",
                   "代謝性アシドーシス",
                   "呼吸性アルカローシス"], answer: 0,
                  miss: [nil, "pH と PaCO₂ を基準値と比べてください。どちらも範囲に入っています。",
                         "HCO₃⁻ は下がっていません。", "PaCO₂ は下がっていません。"],
                  why: "① pH は正常、② PaCO₂ も正常、③ HCO₃⁻ も正常。いまの設定で換気は足りています。正常を一度読んでおくと、崩れたときの違いに気づけます。"),
            .talk(.doctor, "代償の目安を 1 つだけ。PaCO₂ が 10 上がると、HCO₃⁻ は急性なら +1、数日たった慢性なら +3.5。"),
            .quiz("pH 7.28 / PaCO₂ 58 / HCO₃⁻ 26。これは何ですか。",
                  ["代謝性アシドーシス",
                   "急性の呼吸性アシドーシス",
                   "慢性の呼吸性アシドーシス",
                   "呼吸性アルカローシス"], answer: 1,
                  miss: ["HCO₃⁻ は下がっていません。主犯は PaCO₂ です。", nil,
                         "慢性なら HCO₃⁻ は +6 前後（約 30）まで上がっているはず。+2 は急性の予想です。",
                         "pH 7.28 はアシデミアです。"],
                  why: "PaCO₂ +18 に対し HCO₃⁻ は +2 と、急性の予想どおりです。これが HCO₃⁻ 35・pH 7.36 なら腎性代償が完成した慢性型で、気管支肺異形成症や神経筋疾患で見ます。"),
            .quiz("pH 7.22 / PaCO₂ 30 / HCO₃⁻ 12。これは何ですか。",
                  ["呼吸性アシドーシス",
                   "代謝性アシドーシスと呼吸性代償",
                   "呼吸性アルカローシス",
                   "混合性アルカローシス"], answer: 1,
                  miss: ["PaCO₂ は 30 と低い。呼吸はむしろ CO₂ を吐き出しています。", nil,
                         "pH 7.22 なのでアルカローシスではありません。", "pH 7.22 なのでアルカローシスではありません。"],
                  why: "アシデミアなのに PaCO₂ は低い。主犯は HCO₃⁻ 12 で、低い PaCO₂ は過換気で代償している姿です。ここで鎮静をかけて呼吸を抑えると、pH は一気に落ちます。"),
            .quiz("PaO₂ 70 mmHg、FiO₂ 0.8 のときの P/F 比は？",
                  ["56",
                   "88",
                   "140",
                   "判定できない"], answer: 1,
                  miss: ["掛け算になっています。PaO₂ を FiO₂ で割ります。", nil,
                         "FiO₂ を 0.5 で割っています。0.8 で割ります。", "PaO₂ と FiO₂ があれば計算できます。"],
                  why: "70 ÷ 0.8 ＝ 88。300 以下で軽症、200 以下で中等症、100 以下で重症です。動脈ラインがない小児では S/F 比や OI（4 以上で軽症、16 以上で重症）で代用します。")
        ])

    static let lesson4_2 = Lesson(
        id: "4-2", title: "CO₂ を換気量で動かす", minutes: 7, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 120; s.respiratoryRate = 14; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 16; s.inspiratoryPause = 0.3
        },
        brief: [
            "PaCO₂ ＝ CO₂ の産生 ÷ 肺胞換気量。肺胞換気量 ＝（Vt − 死腔）× RR。",
            "死腔は 1 呼吸ごとに引かれるので、同じ MV なら Vt を増やすほうがよく効く。",
            "新生児は成人の倍近く CO₂ を作り、発熱でも 1℃ あたり 10〜13% 増える。効き始めるまで数分。"
        ],
        points: ["PaCO₂ ∝ CO₂産生 ÷ 肺胞換気量",
                 "小児ほど死腔の割合が大きく、Vt を増やすほうが効く",
                 "発熱で CO₂ 産生が増える。効き始めるまで数分かかる"],
        tasks: [
            .talk(.doctor, "CO₂ を下げる方法は、実は 1 つしかありません。何だと思いますか。"),
            .talk(.puku, "酸素を増やす…？"),
            .talk(.doctor, "違います。触ってみれば、身体で覚えられます。まず採血から。"),
            .key("まず採血して、いまの PaCO₂ を確かめてください。", event: .orderBloodGas)
                .spotting(["hard:kAbg"]),
            .step("結果が返るまで待ちます。",
                  check: { !$0.bloodGases.isEmpty })
                .passing { c in if let g = c.lastBloodGas { c.memory.gases["first"] = g } }
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "PaCO₂ %.0f mmHg、pH %.2f。換気が足りていません。", g.paco2, g.pH)
                }
                .watching(["MV", "etCO₂"]),
            .quiz("この呼吸性アシドーシスを直すために、まず動かすのはどれですか。",
                  ["FiO₂ を上げる",
                   "PEEP を上げる",
                   "分時換気量を増やす",
                   "鎮静を深くする"], answer: 2,
                  miss: ["FiO₂ は酸素のつまみ。CO₂ には効きません。", "PEEP は酸素化のつまみ。CO₂ には効きません。", nil,
                         "呼吸が弱くなり、CO₂ はむしろ上がります。"],
                  why: "CO₂ を下げる方法は換気を増やすことだけです。FiO₂ も PEEP も酸素化のつまみで、CO₂ には効きません。"),
            .talk(.doctor, "では動かします。効きはじめるまで数分かかることも、いっしょに覚えてください。"),
            .step("一回換気量と呼吸回数を上げて、MV を 3.2 L/分 以上にしてください。",
                  hold: 15,
                  why: "CO₂ が動くまで数分かかります。変えた直後に採血しても、まだ動いていません。",
                  check: { $0.measured.minuteVolume >= 3.2 })
                .hinting { c in
                    String(format: "体重 %.0f kg。Vt は 8 mL/kg（約 %@ mL）まで安全に上げられます。",
                           c.pbw, LessonLibrary.mlkg(c.pbw, 8))
                }
                .spotting(["key:vt", "key:rr"]).watching(["MV", "Pplat", "etCO₂"]),
            .step("もう一度採血して、PaCO₂ が 35〜48 mmHg に入ったことを確かめてください。",
                  hint: "「× 10」で 5 分ほど進めてから採血します。",
                  check: { c in
                      guard c.bloodGases.count >= 2, let g = c.lastBloodGas else { return false }
                      return g.paco2 >= 33 && g.paco2 <= 48
                  })
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "PaCO₂ %.0f mmHg、pH %.2f。換気量を増やしたぶんだけ CO₂ が抜けました。",
                                  g.paco2, g.pH)
                }
                .spotting(["hard:kAbg"]).watching(["MV", "etCO₂"]),
            .talk(.puku, "量と回数、どっちを上げても同じじゃないの？"),
            .quiz("Vt 120→160 と RR 20→27、どちらがよく効きますか（MV の増分はほぼ同じ）。",
                  ["Vt を増やすほう",
                   "RR を上げるほう",
                   "同じ",
                   "場合による"], answer: 0,
                  miss: [nil, "回数を増やすと、そのたびに死腔の分も一緒に増えます。",
                         "MV は同じでも、死腔を引いた残り（肺胞換気量）が違います。",
                         "肺が正常なら答えは決まります。例外は Pplat の上限に当たるときです。"],
                  why: "回数を増やすと死腔換気も一緒に増えます。ただし Pplat と ΔP の上限が先に来ます。小児 ARDS のように Vt を増やせない場面では、やむをえず RR で押します。"),
            .quiz("RR を上げすぎたときに起きることはどれですか。",
                  ["auto-PEEP",
                   "高 FiO₂ による酸素毒性",
                   "リーク",
                   "カフ圧の上昇"], answer: 0,
                  miss: [nil, "FiO₂ は回数とは関係ありません。", "リークは回数では起きません。", "カフ圧は回数では変わりません。"],
                  why: "呼気時間が足りず、吐ききる前に次の吸気が来ます。空気が残って血圧が下がり、トリガもできなくなります。")
        ])

    static let lesson4_3 = Lesson(
        id: "4-3", title: "酸素化を読む ─ P/F 比と PEEP", minutes: 8, scenarioID: "ards",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 85; s.respiratoryRate = 30; s.peep = 5; s.fio2 = 0.8
            s.inspiratoryFlow = 12; s.inspiratoryPause = 0.3
        },
        brief: [
            "シャント（潰れた肺胞を血が素通りすること）には FiO₂ が効かない。素通りする血はどれだけ濃い酸素でも素通りする。",
            "だから ARDS では FiO₂ より先に PEEP で肺胞を開き、そのあと FiO₂ を下げる。",
            "PEEP を上げたら 3 つ見る。P/F（改善したか）、Pplat と ΔP（過膨張していないか）、血圧（循環が保てるか）。"
        ],
        points: ["シャントには FiO₂ が効かない",
                 "PEEP で肺胞を開いてから FiO₂ を下げる",
                 "PEEP を上げたら P/F・Pplat・血圧の 3 つを見る"],
        tasks: [
            .talk(.scene, "ミオちゃんの FiO₂ は {FiO₂}%。それでも SpO₂ は {SpO₂}% までしか上がらない。"),
            .talk(.puku, "酸素をこんなに吸わせてるのに、どうして上がらないの？"),
            .talk(.doctor, "潰れた肺胞を、血が素通りしているからです。素通りする血には、濃い酸素は届きません。"),
            .key("まず採血して、いまの P/F 比を確かめてください。", event: .orderBloodGas)
                .spotting(["hard:kAbg"]),
            .step("結果が返るまで待ちます。",
                  check: { !$0.bloodGases.isEmpty })
                .passing { c in if let g = c.lastBloodGas { c.memory["pf0"] = g.pfRatio } }
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "P/F 比 %.0f。FiO₂ 80%% を吸わせてもこれだけしか上がらないのは、シャントが大きいからです。",
                                  g.pfRatio)
                }
                .watching(["SpO₂", "Pplat"]),
            .talk(.doctor, "だから先に肺胞を開きます。ここが PEEP の出番です。"),
            .step("PEEP を 14 cmH₂O まで上げて確定してください。",
                  hint: "実際は 2 cmH₂O ずつ上げて、Pplat と血圧を見ながら進めます。",
                  check: { $0.settings.peep >= 14 })
                .spotting(["key:peep"]).watching(["SpO₂", "Pplat", "ABP mean"]),
            .step("そのまま 60 秒、SpO₂ と Pplat と平均動脈圧を見てください。",
                  hold: 60,
                  check: { $0.settings.peep >= 14 })
                .explaining { c in
                    let mapMin = c.engine.norms.meanArterialPressureMin
                    return "ARDS の肺にはリクルートできる部分が多いので、酸素化が改善します。"
                        + (c.engine.meanArterialPressure < mapMin
                           ? "ただし平均動脈圧 {ABP mean} は下限 \(Int(mapMin)) を割りました。輸液が足りているか、PEEP を 2 下げるかを考えます。"
                           : "")
                }
                .watching(["SpO₂", "Pplat", "ABP mean"]),
            .step("もう一度採血して、P/F 比が上がったことを確かめてください。",
                  hint: "「× 10」で早送りすると待ち時間が縮みます。",
                  check: { c in
                      guard c.bloodGases.count >= 2, let g = c.lastBloodGas,
                            let base = c.memory["pf0"] else { return false }
                      return g.pfRatio > base + 20
                  })
                .explaining { c in
                    guard let g = c.lastBloodGas, let base = c.memory["pf0"] else { return "" }
                    return String(format: "P/F 比 %.0f → %.0f。FiO₂ は一切触っていません。開いた肺が増えた分です。",
                                  base, g.pfRatio)
                }
                .spotting(["hard:kAbg"]).watching(["SpO₂"]),
            .talk(.doctor, "開いたら、酸素は下げる。この順番が大事です。"),
            .step("SpO₂ 92% 以上を保ったまま、FiO₂ を 60% 以下に下げてください。",
                  hold: 30,
                  why: "「PEEP で開いてから FiO₂ を下げる」という順番です。逆だと、FiO₂ だけが高いまま肺は潰れたまま、という状態が続きます。",
                  check: { $0.settings.fio2 <= 0.61 && $0.engine.spo2 >= 92 })
                .spotting(["key:fio2"]).watching(["SpO₂"]),
            .quiz("PEEP を 10 → 16 にしたら、P/F は変わらず平均血圧だけ 62 → 44 に下がりました。これは？",
                  ["まだ PEEP が足りない",
                   "開く肺がもう残っておらず、過膨張と循環抑制だけが起きている",
                   "FiO₂ を上げれば解決する",
                   "測定の誤差"], answer: 1,
                  miss: ["上げても P/F が動かないなら、足りないのではなく開く肺がないのです。", nil,
                         "シャントには FiO₂ は効きにくく、血圧の問題も残ります。",
                         "血圧が 18 も下がるのは誤差ではありません。"],
                  why: "PEEP を戻し、腹臥位など別の手段を考えます。「上げても改善しない」こと自体が肺についての情報です。小児は循環の予備が少ないので、上げる前に輸液が足りているかを確かめておきます。")
        ])

    static let lesson4_4 = Lesson(
        id: "4-4", title: "permissive hypercapnia ─ CO₂ を許す", minutes: 7, scenarioID: "ards",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 130; s.respiratoryRate = 26; s.peep = 12; s.fio2 = 0.6
            s.inspiratoryFlow = 14; s.inspiratoryPause = 0.3
        },
        brief: [
            "ARDS では優先順位が入れ替わる。Vt 5〜6 mL/kg・Pplat ≤28・ΔP ≤14 を CO₂ より優先する。",
            "その結果 PaCO₂ が上がっても、pH が保たれていれば許す（PALICC は pH 7.15〜7.30）。",
            "例外は 3 つ。頭蓋内圧上昇、肺高血圧、重症の心機能低下。いずれも高 CO₂ は使えない。"
        ],
        points: ["Vt 5〜6 mL/kg・Pplat ≤28・ΔP ≤14 を CO₂ より優先",
                 "pH 7.20〜7.25 以上なら高 CO₂ を許す（PALICC は 7.15〜7.30）",
                 "頭蓋内圧上昇・肺高血圧・心不全では使えない"],
        tasks: [
            .talk(.doctor, "P/F は良くなりました。でも今度は Pplat が高い。ここからは、何かを諦める相談です。"),
            .talk(.puku, "諦める？"),
            .talk(.doctor, "CO₂ を下げきることを諦めます。そのぶん肺を守る、という考え方です。"),
            .quiz("いまの Vte は何 mL/kg ですか。Vte のタイルで確かめてください。",
                  ["約 5 mL/kg",
                   "約 7 mL/kg",
                   "約 9 mL/kg",
                   "約 12 mL/kg"], answer: 2,
                  miss: ["タイルの右上をもう一度。5 mL/kg なら 70 mL ほどのはずです。",
                         "タイルの右上をもう一度。7 mL/kg なら 100 mL ほどのはずです。", nil,
                         "タイルの右上をもう一度。そこまでは入っていません。"],
                  why: "肺保護の枠をはみ出しています。")
                .explaining { c in
                    String(format: "Vte %.1f mL/kg、Pplat {Pplat}。肺保護の枠をはみ出しています。", c.tidalPerKg)
                }
                .spotting(["val:Vte", "val:Pplat"]).watching(["Vte", "Pplat", "ΔP"]),
            .step("一回換気量を 6 mL/kg に下げ、Pplat と ΔP を上限以下にしてください。",
                  hold: 15,
                  why: "肺保護の条件を満たしました。当然、CO₂ は上がります。",
                  check: { c in
                      guard let plat = c.measured.plateauPressure,
                            let dp = c.measured.drivingPressure else { return false }
                      return c.tidalPerKg <= 6.6 && plat <= c.engine.norms.plateauMax
                          && dp <= c.engine.norms.drivingPressureMax
                  })
                .hinting { c in
                    String(format: "目標 Vt は約 %@ mL、Pplat は %.0f 以下、ΔP は %.0f 以下です。",
                           LessonLibrary.mlkg(c.pbw, 6),
                           c.engine.norms.plateauMax, c.engine.norms.drivingPressureMax)
                }
                .spotting(["key:vt"]).watching(["Vte", "Pplat", "ΔP"]),
            .step("採血して、CO₂ と pH がどうなったか確かめてください。",
                  hint: "「× 10」で 5 分ほど進めてから採血すると、変化がはっきりします。",
                  check: { !$0.bloodGases.isEmpty })
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "PaCO₂ %.0f mmHg、pH %.2f。", g.paco2, g.pH)
                }
                .spotting(["hard:kAbg"]).watching(["etCO₂"]),
            .talk(.doctor, "どこまで許すのか。線を引いておきましょう。"),
            .quiz("3歳、pH 7.26 / PaCO₂ 58、Pplat 27、Vt は 6 mL/kg。どうしますか。",
                  ["Vt を増やして CO₂ を下げる",
                   "このままでよい（必要なら RR を少し上げる）",
                   "PEEP を下げる",
                   "鎮静を深くする"], answer: 1,
                  miss: ["数字を良くするために肺を傷めることになります。", nil,
                         "PEEP は酸素化のつまみで、CO₂ は下がりません。", "呼吸が抑えられ、CO₂ はむしろ上がります。"],
                  why: "pH 7.25 以上なら許容範囲です。ここで Vt を増やすのは、数字を良くするために肺を傷めること。もう少し上げたいなら RR で、この年齢なら 40〜50 /分 まで使えることもあります。"),
            .step("Vt は触らず RR だけを上げ、採血で pH 7.25 以上を確かめてください。",
                  hint: "RR を 4〜6 回/分 ずつ上げ、「× 10」で数分進めてから採血します。",
                  check: { c in
                      guard let g = c.lastBloodGas, let n0 = c.memory["nAbg"],
                            let vt0 = c.memory["vt44"] else { return false }
                      return Double(c.bloodGases.count) > n0 && g.pH >= 7.25 && c.settings.tidalVolume <= vt0
                  })
                .starting { c in
                    c.memory["nAbg"] = Double(c.bloodGases.count)
                    c.memory["vt44"] = c.settings.tidalVolume
                }
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "pH %.2f、PaCO₂ %.0f。Vt を触らずに pH を戻せました。小児 ARDS ではこれが正しい順番です。",
                                  g.pH, g.paco2)
                }
                .spotting(["key:rr", "hard:kAbg"]).watching(["Vte", "MV", "auto-PEEP"]),
            .key("「呼気ポーズ」で、回数を上げた副作用が出ていないか確かめてください。", event: .expiratoryHold)
                .spotting(["hard:kExp"]),
            .step("測り終わるのを待ちます。",
                  check: { $0.holdSettled && $0.measured.totalPEEP > 0 })
                .explaining { c in
                    (c.measured.autoPEEP < 3 ? "まだ余裕があります。" : "出始めています。ここが呼吸回数の上限です。")
                        + " ARDS の肺は硬いぶん早く吐けるので高い RR に耐えますが、次章の細気管支炎では逆になります。"
                }
                .watching(["auto-PEEP", "PEEP tot"])
        ])

    // MARK: - 第5章　アラームとトラブル

    static let lesson5_1 = Lesson(
        id: "5-1", title: "気道内圧が上がった", minutes: 6, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        brief: [
            "PIP ↑・Pplat → （差が開いた）＝ 抵抗の問題。痰、チューブの屈曲・閉塞・咬み込み、気管支攣縮。",
            "PIP ↑・Pplat ↑（差は同じ）＝ コンプライアンスの問題。無気肺、気胸、肺水腫、腹部膨満。",
            "設定を変える前に吸気ポーズを 1 回。それだけで原因が半分に絞れる。"
        ],
        points: ["まず吸気ポーズで Pplat を測る",
                 "PIP だけ上がる＝抵抗",
                 "PIP も Pplat も上がる＝コンプライアンス低下"],
        tasks: [
            .talk(.scene, "午前 3 時。ハルト君のベッドサイドで、いぶき先生が夜の回診をしている。"),
            .talk(.doctor, "アラームは鳴ってから考えると遅い。順番を決めておきます。まず、落ち着いているいまの数字を控えます。"),
            .step("いまの PIP と Pplat を覚えておいてください。",
                  why: "これが平常時の値です。",
                  check: { $0.measured.plateauPressure != nil && $0.measured.staticCompliance != nil })
                .passing { c in
                    c.memory["pip0"] = c.measured.peakPressure
                    c.memory["plat0"] = c.measured.plateauPressure ?? 0
                }
                .spotting(["val:PIP", "val:Pplat"]).watching(["PIP", "Pplat", "Raw"]),
            .talk(.scene, "そのとき、アラームが鳴った。気道内圧上限。ハルト君がむせている。")
                .starting { c in
                    let r = c.engine.airwayResistance
                    c.memory["rInsp0"] = r.inspiratory
                    c.memory["rExp0"] = r.expiratory
                    c.engine.setAirwayResistance(inspiratory: r.inspiratory * 7.0,
                                                 expiratory: r.expiratory * 3.5)
                },
            .key("PIP が急に上がりました。設定を変える前に、何をしますか。",
                 hint: "原因を切り分けるキーがハードキーにあります。",
                 event: .inspiratoryHold,
                 why: "正解です。吸気ポーズで Pplat を測ります。")
                .missing([
                    .suction: "まだ原因が分かっていません。痰なのか、肺が硬くなったのか、先に切り分けます。",
                    .oxygenFlush: "酸素化は保たれています。いま知りたいのは、圧が上がった理由です。",
                    .expiratoryHold: "呼気ポーズは吐き残しを見るもの。上がった PIP の中身を分けるのは別のキーです。"
                ])
                .spotting(["hard:kInsp"]).watching(["PIP", "Pplat", "Raw"]),
            .step("測り終わるのを待ち、さっきの値と比べてください。",
                  check: { $0.measured.plateauPressure != nil && $0.holdSettled })
                .explaining { c in
                    String(format: "PIP は %.0f → %.0f と上がったのに、Pplat は %.0f → %.0f とほとんど変わっていません。",
                           c.memory["pip0"] ?? 0, c.measured.peakPressure,
                           c.memory["plat0"] ?? 0, c.measured.plateauPressure ?? 0)
                }
                .watching(["PIP", "Pplat", "Raw"]),
            .talk(.doctor, "PIP と Pplat、どちらが上がったか。それだけで犯人が絞れます。"),
            .quiz("この所見から考えられるのはどれですか。",
                  ["肺が硬くなった",
                   "気道抵抗が上がった",
                   "PEEP が高すぎる",
                   "回路のリーク"], answer: 1,
                  miss: ["肺が硬くなれば Pplat も上がります。Pplat は動いていません。", nil,
                         "PEEP は触っていません。", "リークなら圧も量も下がります。"],
                  why: "差が開いた＝抵抗の増加で、Raw も上がっています。聴診すると痰の音。ハルト君は痰でした。痰、屈曲、咬み込み、気管支攣縮を順に確認します。小児は体位を変えただけでチューブが折れたり深く入ったりするので、直前に何をしたかを必ず確かめます。"),
            .quiz("吸引する前にやっておいたほうがよいことは？",
                  ["鎮静を深くする",
                   "FiO₂ を一時的に 100% にする",
                   "PEEP を下げる",
                   "呼吸回数を上げる"], answer: 1,
                  miss: ["鎮静は咳を止めるだけで、痰は減りません。", nil,
                         "吸引で肺胞は潰れやすくなります。PEEP を下げるのは逆です。", "回数では吸引中の酸素の落ち込みは防げません。"],
                  why: "吸引中は換気が止まり、陰圧で肺胞が潰れます。小児は酸素の蓄えが少なく、成人よりはるかに速く落ちます。カテーテルはチューブ内径の半分以下を選び、10〜15 秒以内で終えます。"),
            .talk(.puku, "痰なら、すぐ吸っちゃえばいいんじゃないの？"),
            .talk(.doctor, "吸引は酸素も一緒に持っていきます。先に貯金してから吸う。順番を守りましょう。"),
            .key("「100% O₂」を押してから「気管吸引」を押してください。", event: .suction,
                 why: "痰が取れました。抵抗が戻り、PIP が下がります。")
                .passing { c in
                    if let ri = c.memory["rInsp0"], let re = c.memory["rExp0"] {
                        c.engine.setAirwayResistance(inspiratory: ri, expiratory: re)
                    }
                }
                .spotting(["hard:kO2", "hard:kSuc"]).watching(["PIP", "SpO₂"]),
            .step("SpO₂ の動きを 30 秒見てください。", hold: 30,
                  why: "吸引のあいだは換気が止まり、陰圧で肺胞も潰れるので、SpO₂ が一時的に下がりました。先に 100% で貯金しておいたぶん、落ち込みは小さく、すぐ戻ります。新生児では徐脈も起こるので心拍も一緒に見ます。",
                  check: { _ in true })
                .spotting(["val:SpO₂"]).watching(["SpO₂", "HR", "PIP"])
        ])

    static let lesson5_2 = Lesson(
        id: "5-2", title: "auto-PEEP ─ 吐ききれていない", minutes: 7, scenarioID: "bronchiolitis",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 45; s.respiratoryRate = 45; s.peep = 6; s.fio2 = 0.5
            s.inspiratoryFlow = 5; s.inspiratoryPause = 0.3
        },
        brief: [
            "呼気が終わる前に次の吸気が来ると吐き残しがたまる。その圧が auto-PEEP。",
            "困るのは 3 つ。血圧が下がる、肺胞が余分に伸ばされる、吸っても auto-PEEP の分を吸い下げるまでトリガできない。",
            "対策はまず呼吸回数を下げること。次に吸気流量を上げて吸気時間を短くする。"
        ],
        points: ["auto-PEEP は吐き残しの圧",
                 "呼気ポーズ（総 PEEP − 設定 PEEP）で測る",
                 "対策の第一は呼吸回数を下げること"],
        tasks: [
            .talk(.scene, "RSV のそうた君（生後 4 か月）。呼吸回数を上げたのに、血圧が下がってきた。"),
            .talk(.doctor, "入れることばかり見ていると、これを見落とします。吐けているかどうか。")
                .looking(["lane:flow"]),
            .talk(.puku, "吐くのって、放っておけば出ていくんじゃないの？"),
            .talk(.doctor, "細い気道では、出ていく時間が足りません。波形に出ます。見てください。"),
            .step("流量波形（真ん中、緑）を 20 秒見てください。呼気がゼロに戻りきっていますか。",
                  hold: 20,
                  why: "呼気が底からゼロに戻る前に、次の吸気で断ち切られています。これが吐き残しの形です。",
                  check: { _ in true })
                .spotting(["wave"]).watching(["RR tot", "I:E"]),
            .key("「呼気ポーズ」を押して、実際に測ってください。", event: .expiratoryHold)
                .spotting(["hard:kExp"]),
            .step("測り終わるのを待ちます。",
                  check: { $0.holdSettled && $0.measured.autoPEEP > 0 })
                .passing { c in c.memory["ap0"] = c.measured.autoPEEP }
                .explaining { c in
                    String(format: "総 PEEP %.1f に対して設定 PEEP は %.0f。差の %.1f cmH₂O が auto-PEEP です。",
                           c.measured.totalPEEP, c.settings.peep, c.memory["ap0"] ?? 0)
                }
                .spotting(["val:auto-PEEP"]).watching(["auto-PEEP", "PEEP tot", "ABP mean"]),
            .talk(.doctor, "測れました。では、これを減らすにはどうするか。"),
            .quiz("auto-PEEP をいちばん確実に減らすのはどれですか。",
                  ["呼吸回数を下げる",
                   "一回換気量を上げる",
                   "吸気時間を延ばす",
                   "PEEP を上げる"], answer: 0,
                  miss: [nil, "入れる量が増えれば、吐く量も増えます。逆効果です。",
                         "吸気が伸びれば、そのぶん呼気が削られます。", "PEEP を足しても吐き残しは減りません。"],
                  why: "1 呼吸の時間が伸び、その分がそのまま呼気時間になります。換気量を上げると吐く量が増えて逆効果、吸気時間を延ばすと呼気時間が削られます。"),
            .step("呼吸回数を下げ、auto-PEEP を 3 cmH₂O 未満にしてください。",
                  hint: "もう一度「呼気ポーズ」で測り直します。この乳児は呼気に 2 秒要るので RR 20〜25 が目安。",
                  why: "呼吸回数を下げると CO₂ は上がりますが、細気管支炎では PaCO₂ 60〜70、pH 7.20 台までは許容します。無理に正常化しようと回数を上げると、空気が溜まって血圧が下がります。",
                  check: { c in
                      c.measured.autoPEEP < 3 && c.settings.respiratoryRate < 30 && c.holdSettled
                  })
                .spotting(["key:rr", "hard:kExp"]).watching(["auto-PEEP", "ABP mean", "MV"]),
            .step("平均動脈圧が下限まで戻るのを見届けてください。",
                  hold: 10,
                  check: { $0.engine.meanArterialPressure >= $0.engine.norms.meanArterialPressureMin })
                .starting { c in c.memory["map0"] = c.engine.meanArterialPressure }
                .explaining { c in
                    "平均動脈圧 \(Int((c.memory["map0"] ?? 0).rounded())) → {ABP mean}。たまっていた空気が抜けて胸腔内圧が下がり、静脈還流が戻りました。auto-PEEP は、肺だけでなく循環の問題でもあります。"
                }
                .spotting(["val:ABP mean"]).watching(["ABP mean", "SpO₂", "auto-PEEP"]),
            .quiz("喘息重積の学童で吸気流量を 30 → 50 L/分 に上げたら、PIP は上がり Pplat は変わりません。これは？",
                  ["危険なのですぐ戻すべき",
                   "吸気時間が短くなり呼気時間が伸びるので、この患者には有利",
                   "換気量が増えすぎている",
                   "意味がない操作"], answer: 1,
                  miss: ["上がったのは抵抗の分だけで、肺胞にかかる Pplat は同じです。", nil,
                         "VC なので量は設定どおりです。", "吸気が短くなるぶん、呼気の時間が増えます。"],
                  why: "上がった PIP は抵抗の分で、肺胞にはかかっていません。吸気が早く終わるぶん呼気に使える時間が増えます。症例一覧の「喘息重積発作」で同じことを試せます。"),
            .quiz("auto-PEEP が 8 cmH₂O ある患者が、吸っても機械が反応しません。なぜですか。",
                  ["トリガ感度の設定ミス",
                   "まず auto-PEEP の 8 cmH₂O 分を吸い下げないと、回路に流れが生まれないから",
                   "鎮静が深いから",
                   "リークがあるから"], answer: 1,
                  miss: ["感度を上げても、回路に流れが生まれなければ反応しません。", nil,
                         "吸おうとしているので鎮静のせいではありません。", "リークはむしろ誤って反応させる方向です。"],
                  why: "その子は毎回、余分な仕事を強いられています。外から PEEP をかけて差を埋める方法もありますが、まず吐かせるのが先。「合わないから鎮静を足す」の前に、ここを疑ってください。")
        ])

    static let lesson5_3 = Lesson(
        id: "5-3", title: "SpO₂ が下がった ─ DOPE で切り分ける", minutes: 7, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        brief: [
            "D 位置（片肺挿管・抜けかけ）／ O 閉塞（痰・屈曲・咬み込み）／ P 気胸 ／ E 機器と回路。",
            "小児は D と O が多い。気管が短くチューブが細く、首を動かすだけで位置が変わる。",
            "順番は ①FiO₂ 100% ②胸の上がりと呼吸音 ③PIP と Pplat ④分からなければ用手換気で切り分ける。"
        ],
        points: ["DOPE の 4 つを順に確認",
                 "まず FiO₂ 100%、次に患者を見る",
                 "圧と量の動き方の組み合わせで切り分ける"],
        tasks: [
            // 病態はここで起こす。語っている最中に画面の数字が実際に落ちていくようにするため。
            // 気づいた時点ではもう下がりはじめているので、SpO₂ は 93% から始める。
            .talk(.scene, "モニタの音が低くなった。ハルト君の SpO₂ は {SpO₂}%。まだ下がっていく。")
                .starting { c in
                    c.memory["c0"] = c.engine.lungCompliance
                    let s = c.engine.shuntSetting
                    c.memory["shuntLow0"] = s.low
                    c.memory["shuntMin0"] = s.minimum
                    c.engine.setLungCompliance(c.engine.lungCompliance * 0.42)
                    c.engine.setShunt(low: 0.40, minimum: 0.40)
                    c.engine.lowerOxygenation(spo2: 93, pao2: 68)
                },
            .talk(.doctor, "DOPE。チューブのずれ、詰まり、気胸、機械の不具合。この 4 つを順に切ります。"),
            .talk(.puku, "4 つも、あわてて思い出せないよ…"),
            .talk(.doctor, "だから手が先です。まず酸素。考えるのはそのあとで間に合います。"),
            .key("SpO₂ が下がりはじめました。最初の一手を打ってください。",
                 hint: "時間を稼いでから原因を探します。",
                 event: .oxygenFlush,
                 why: "2 分間だけ FiO₂ 100% になり、そのあと自動で元に戻ります。そのあいだに原因を探します。")
                .spotting(["hard:kO2"]).watching(["SpO₂", "PIP", "Pplat"]),
            .key("「吸気ポーズ」で、圧がどちらの型かを確かめてください。", event: .inspiratoryHold)
                .spotting(["hard:kInsp"]).watching(["PIP", "Pplat", "Vte"]),
            .step("測り終わるのを待ちます。PIP・Pplat・Vte の 3 つを見てください。",
                  why: "PIP も Pplat も上がり、Vte は設定どおり返っています。つまりリークでも抵抗でもなく、肺が硬くなった形です。",
                  check: { $0.measured.plateauPressure != nil && $0.holdSettled })
                .watching(["PIP", "Pplat", "Vte"]),
            .talk(.doctor, "圧の形と、聴診。2 つ合わせると 1 つに絞れます。")
                .looking(["lane:paw"]),
            .quiz("この所見に加えて、左の呼吸音が聞こえません。何を疑いますか。",
                  ["右片肺挿管または気胸",
                   "痰づまり",
                   "回路のリーク",
                   "鎮静が浅い"], answer: 0,
                  miss: [nil, "痰なら差（PIP − Pplat）が開きます。今回は Pplat も上がっています。",
                         "リークなら Vte が減ります。Vte は保たれています。", "鎮静では片側の呼吸音は消えません。"],
                  why: "片肺挿管なら、チューブは右主気管支に入りやすいので消えるのは左。0.5〜1 cm 引き抜けば戻ります。チューブの深さが変わっていなければ、次に疑うのは気胸です。"),
            .talk(.scene, "チューブの深さは変わっていない。胸の X 線を撮ると、左に気胸があった。すぐに胸腔ドレーンが入る。"),
            .step("SpO₂ と圧が戻るのを 40 秒見てください。",
                  hold: 40,
                  why: "肺が戻れば圧も酸素化も戻ります。人工呼吸器の設定をいじっても直らない原因があることが分かります。",
                  check: { _ in true })
                .starting { c in
                    if let c0 = c.memory["c0"] { c.engine.setLungCompliance(c0) }
                    if let low = c.memory["shuntLow0"], let floor = c.memory["shuntMin0"] {
                        c.engine.setShunt(low: low, minimum: floor)
                    }
                }
                .spotting(["val:SpO₂"]).watching(["SpO₂", "PIP", "Pplat"]),
            .quiz("では、SpO₂ が下がり PIP も Pplat も下がって Vte が急に減ったら？",
                  ["気胸",
                   "痰づまり",
                   "回路が外れた・大きなリーク",
                   "肺水腫"], answer: 2,
                  miss: ["気胸なら圧は上がります。", "痰なら PIP は上がります。", nil, "肺水腫なら圧は上がります。"],
                  why: "圧も量も同時に下がるのはリークの形です。接続・カフ・加温加湿器を確認します。小児では自己抜去もこの形になり、回路が小さく軽いぶん目立ちません。")
        ])

    // MARK: - 第6章　離脱と抜管

    static let lesson6_1 = Lesson(
        id: "6-1", title: "離脱できる条件を確かめる", minutes: 6, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 18; s.peep = 10; s.fio2 = 0.6
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        sedation: 0.7,
        brief: [
            "毎日「外せるか」を確かめる。長くつけるほど肺炎・せん妄・筋力低下が積み上がるから。",
            "小児の条件：原因が改善、FiO₂ ≤0.4、PEEP ≤7、P/F ≥200、pH ≥7.30、循環が安定、覚醒、自発呼吸あり。",
            "成人よりやや厳しめに置く。チューブが細く、抜管後に上気道浮腫で戻ってくる率が高いため。"
        ],
        points: ["毎日「外せるか」を確かめる",
                 "小児は PEEP 7 以下・P/F 200 以上とやや厳しめ",
                 "抜管の可否は SBT の結果で決める"],
        tasks: [
            .talk(.scene, "朝。ハルト君が目を開けて、チューブを気にして手を動かしている。"),
            .talk(.puku, "元気そうだし、もう抜いちゃえば？"),
            .talk(.doctor, "その「元気そう」を数字にして確かめるのが、この章です。"),
            .key("「離脱」キーを押して、条件のリストを見てください。", event: .openWeaning,
                 why: "× がついている項目が、いま足りていないものです。")
                .spotting(["hard:kWean"]),
            .step("設定と鎮静を調整して、リストの項目をすべて ✓ にしてください。",
                  hint: "FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅くして自発呼吸を出します。「離脱」キーでいつでもリストを開き直せます。",
                  why: "条件が揃いました。ここで初めて SBT に進めます。",
                  check: { c in Weaning.readiness(for: c.engine).allSatisfy(\.met) })
                .spotting(["key:fio2", "key:peep", "key:sed"]).watching(["SpO₂", "RR tot", "ABP mean"]),
            .talk(.doctor, "全部 ✓ になりました。では、このまま抜いていいでしょうか。"),
            .quiz("条件を全部満たしていれば、そのまま抜管してよいですか。",
                  ["よい",
                   "よくない。SBT で実際に耐えられるか確かめる",
                   "半分でよい",
                   "医師の判断次第"], answer: 1,
                  miss: ["条件は「試してよい」の意味です。耐えられるかは別に確かめます。", nil,
                         "半分では足りません。そして全部そろっても、まだ試験が要ります。",
                         "判断の材料を作るのが、次の試験です。"],
                  why: "条件は「試してよい」という意味で、「外せる」ではありません。呼吸筋の持久力は、この項目のどれにも表れないからです。"),
            .quiz("鎮静を浅くしないまま離脱を進めると、何が困りますか。",
                  ["自発呼吸が出ないので、呼吸筋が持つかどうか評価できない",
                   "血圧が上がる",
                   "FiO₂ が下げられない",
                   "特に困らない"], answer: 0,
                  miss: [nil, "血圧はむしろ鎮静を浅くしたときに上がりやすいものです。",
                         "FiO₂ は鎮静とは関係なく下げられます。", "困ります。評価ができません。"],
                  why: "評価そのものが成り立ちません。毎日の鎮静中断と SBT をセットで行うと人工呼吸の日数が短くなります。ただし小児は自己抜去の危険があるので、評価のあいだは人手を確保します。")
        ])

    static let lesson6_2 = Lesson(
        id: "6-2", title: "SBT ─ 自発呼吸トライアル", minutes: 9, scenarioID: "gbs",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 160; s.respiratoryRate = 16; s.peep = 5; s.fio2 = 0.35
            s.inspiratoryFlow = 16; s.pressureSupport = 8; s.inspiratoryPause = 0.3
        },
        sedation: 0.2,
        brief: [
            "SBT ＝ 手伝いをほとんど外した状態で 30 分耐えられるかを見る試験。PEEP 5 ＋ チューブ抵抗ぶんの PS。",
            "中止基準は年齢相応で置く。呼吸回数が正常上限の 1.5 倍、SpO₂ が目標を下回る、心拍 +25%、陥没呼吸や鼻翼呼吸。",
            "成人の RSBI は小児に使えない。f/VT ＝ RR ÷ Vt(mL/kg) で見て、8 超で失敗しやすい。"
        ],
        points: ["PEEP 5 ＋ チューブ抵抗ぶんの PS で 30 分（小児ほど PS は高め）",
                 "f/VT = RR ÷ Vt(mL/kg)、8 超で失敗しやすい",
                 "肺が正常でも呼吸筋が弱ければ離脱できない"],
        tasks: [
            .talk(.scene, "ギラン・バレーのあかりちゃん（7歳）。肺はきれい。でも、力が入らない。"),
            .talk(.doctor, "肺が良くても外せないことがあります。この子で見るのは、肺ではなく筋力です。"),
            .talk(.puku, "筋力って、どうやって測るの？"),
            .talk(.doctor, "浅くて速い呼吸になるかどうかで分かります。f/VT ＝ 呼吸回数 ÷ 一回換気量（mL/kg）。8 を超えると危ない。"),
            .quiz("体重 22 kg の児が RR 40、一回換気量 110 mL。f/VT はいくつですか。",
                  ["1.8",
                   "8",
                   "40",
                   "判定できない"], answer: 1,
                  miss: ["一回換気量を mL/kg にしてから割ります。110 ÷ 22 ＝ 5。", nil,
                         "RR をそのまま答えています。5 mL/kg で割ります。", "体重と RR と Vt があれば計算できます。"],
                  why: "110 ÷ 22 ＝ 5 mL/kg、40 ÷ 5 ＝ 8。目安に達しており、抜管すると再挿管になりやすい状態です。成人式の RSBI なら 364 となり、「105 超」では何も判断できません。"),
            .key("「離脱」キーから SBT を開始してください。",
                 hint: "条件リストの下に「SBT を開始（30分）」があります。",
                 event: .startSBT,
                 why: "PEEP 5 とチューブ抵抗ぶんの PS に切り替わり、30 分の計測が始まりました。")
                .spotting(["hard:kWean"]),
            .talk(.doctor, "30 分、そばで見ます。最初の 5 分ではなく、後半で崩れる子がいます。"),
            .step("30 分の SBT を最後まで見てください。f/VT と呼吸回数の動きに注目します。",
                  hint: "「× 10」または「× 60」で早送りできます。異常が出ると自動的に等速に戻ります。",
                  check: { $0.sbt.finished })
                .explaining { c in
                    if c.sbt.passed { return "30 分、呼吸回数も酸素化も循環も保てました。抜管を検討できます。" }
                    let minutes = Int((c.sbt.elapsed / 60).rounded())
                    return "開始から \(minutes) 分で中止になりました。理由：" + (c.sbt.failureReason ?? "―")
                        + "。最初は保てていたのに、後半で浅く速くなりました。元の設定に戻っています。"
                }
                .spotting(["val:f/VT"]).watching(["f/VT", "RR tot", "Vte", "SpO₂"]),
            .quiz("SBT 開始から十数分かけて、じわじわ RR が上がり Vte が落ちてきました。これは何ですか。",
                  ["正常な適応",
                   "呼吸筋疲労のサイン",
                   "鎮静が効いてきた",
                   "回路のリーク"], answer: 1,
                  miss: ["適応なら落ち着いていくはずです。じわじわ悪くなるのは別のもの。", nil,
                         "鎮静なら回数は下がります。", "リークなら Vte は急に減り、RR は上がりません。"],
                  why: "rapid shallow breathing です。SBT の失敗はこの形がいちばん多く、最初ではなく後半に出ます。小児では数字より先に、陥没呼吸・鼻翼呼吸・シーソー呼吸が出ます。"),
            .quiz("SBT に失敗しました。次に何をしますか。",
                  ["すぐにもう一度 SBT をやる",
                   "元の設定に戻して呼吸筋を休ませ、失敗の原因を探して翌日また試す",
                   "鎮静を深くして様子を見る",
                   "気管切開を即決する"], answer: 1,
                  miss: ["疲れた筋肉にすぐまた負荷をかけると、同じように崩れます。", nil,
                         "鎮静は原因の解決になりません。", "1 回の失敗で決めるのは早すぎます。"],
                  why: "疲れた呼吸筋は 24 時間休ませ、そのあいだに原因（心不全、感染、栄養、電解質、せん妄、過鎮静）を探します。小児では上気道の問題や神経筋疾患の進行も原因になります。")
        ])

    static let lesson6_3 = Lesson(
        id: "6-3", title: "抜管、そしてそのあと", minutes: 7, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 18; s.peep = 5; s.fio2 = 0.35
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        sedation: 0.15,
        brief: [
            "呼吸が保てることと、気道が守れることは別。意識・咳嗽力・分泌物の量の 3 つを見る。",
            "小児は上気道浮腫が重い。同じ 1 mm の浮腫でも、細い気道では断面積が半分以下になる。",
            "だから抜管前にカフリークテスト。漏れなければステロイドを考える。迷えば高流量鼻カニュラや NPPV。"
        ],
        points: ["呼吸が保てること と 気道が守れること は別",
                 "意識・咳嗽力・分泌物の 3 つを見る",
                 "小児は上気道浮腫の影響が大きい。カフリークテストを忘れない"],
        tasks: [
            .talk(.scene, "昼。ハルト君の鎮静は朝のうちに切ってある。しっかり目を開け、自分で呼吸している。今日のうちに抜管を目指す。"),
            .talk(.doctor, "最後の関門です。呼吸の力だけでなく、気道を自分で守れるかを見ます。"),
            .step("「離脱」キーから SBT を開始し、最後まで完走させてください。",
                  hint: "早送りを使ってください。",
                  why: "SBT に通りました。",
                  check: { $0.sbt.finished && $0.sbt.passed })
                .spotting(["hard:kWean"]).watching(["f/VT", "RR tot", "SpO₂"]),
            .quiz("SBT に通りましたが、呼びかけに反応せず、吸引しても咳をしません。抜管しますか。",
                  ["する（SBT に通ったから）",
                   "しない（気道が守れない）",
                   "鎮静を足してから抜管する",
                   "PS を上げて再評価"], answer: 1,
                  miss: ["SBT は呼吸の力の試験です。気道を守れるかは別に見ます。", nil,
                         "意識がさらに下がり、気道はもっと守れなくなります。", "呼吸の力は十分でした。足りないのは咳と意識です。"],
                  why: "咳ができなければ痰を出せず、意識がなければ誤嚥します。抜管しても結局戻ってきます。小児は気道が細いので、出せなかった痰がそのまま無気肺や再挿管につながります。"),
            .talk(.doctor, "抜いたあとの 1 時間が、いちばん気が抜けません。"),
            .quiz("抜管 1 時間後、吸気時に高い「ヒューヒュー」音と陥没呼吸が出ました。何を考えますか。",
                  ["気管支喘息",
                   "上気道（声門下）の浮腫",
                   "肺水腫",
                   "正常な経過"], answer: 1,
                  miss: ["喘息の音は呼気で目立ちます。吸気の音は上気道です。", nil,
                         "肺水腫では吸気の高い音は出ません。", "陥没呼吸は正常ではありません。"],
                  why: "吸気性の stridor は上気道の狭窄で、小児では声門下がいちばん細く、ここが腫れます。アドレナリン吸入とステロイドで対応し、改善しなければ再挿管を早めに決めます。"),
            .talk(.puku, "…だいじょうぶかな。"),
            .talk(.doctor, "条件はそろいました。抜きましょう。"),
            .key("「離脱」キーから抜管してください。", event: .extubate)
                .spotting(["hard:kWean"]),
            .step("結果を確認してください。",
                  why: "一通り終わりました。振り返り画面に、目標域にいた時間・肺保護の逸脱・有害事象が出ます。症例一覧には早産児 RDS・細気管支炎・小児 ARDS・喘息重積もあります。体重 1.1 kg から 35 kg まで、同じ考え方が桁の違う数字にどう化けるかを試してみてください。",
                  check: { $0.extubated })
                .watching(["SpO₂", "RR tot"])
        ])
}
