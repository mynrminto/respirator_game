import Foundation

/* 第4〜6章。血液ガス、トラブル対応、離脱まで。 */

extension LessonLibrary {

    // MARK: - 第4章　血液ガスを読む

    static let lesson4_1 = Lesson(
        id: "4-1", title: "4 ステップで読む", minutes: 8, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        brief: [
            "血液ガスは、いつも同じ順番で読むと迷いません。",
            "① pH を見る。7.35 未満ならアシデミア、7.45 超ならアルカレミア。まず体が酸性か塩基性かだけを決めます。（新生児だけは生後数日まで pH 7.25〜7.40、PaCO₂ 40〜55 が許容範囲です）",
            "② PaCO₂ を見る。pH のずれを PaCO₂ で説明できるなら呼吸性です。（アシデミアで PaCO₂ が高い、アルカレミアで PaCO₂ が低い）",
            "③ HCO₃⁻ と BE を見る。pH のずれを HCO₃⁻ で説明できるなら代謝性です。",
            "④ 代償が予想どおりか確かめる。予想とずれていれば、もう 1 つ別の異常が隠れています。急性の呼吸性アシドーシスでは、PaCO₂ が 10 mmHg 上がるごとに HCO₃⁻ は約 1 mEq/L しか上がりません。慢性（腎臓が代償する時間があった場合）なら約 3.5 mEq/L 上がります。",
            "小児では HCO₃⁻ の正常値も年齢で違います。新生児 18〜24、乳児 19〜24、幼児以降 21〜26 mEq/L。成人の「22〜26」をそのまま当てると、健康な乳児を代謝性アシドーシスと読んでしまいます。このアプリでは症例の年齢に合わせた正常域を血液ガスの画面に出してあります。",
            "酸素化はこの 4 ステップとは別枠で、PaO₂ と FiO₂ をセットにした P/F 比で評価します。小児 ARDS の重症度分類（PALICC）では、動脈ラインがない子が多いことからOI（酸素化指数 ＝ FiO₂ × 平均気道内圧 × 100 ÷ PaO₂）を主に使います。OI 4 以上で軽症、8 以上で中等症、16 以上で重症。数字が大きいほど悪い、と向きが逆なので注意してください。",
            "このアプリでは採血してから結果が返るまで約 2 分かかります。実際の臨床と同じで、「採ってすぐ設定を変える」と、何が効いたのか分からなくなります。"
        ],
        points: ["pH → PaCO₂ → HCO₃⁻ → 代償の順で読む",
                 "急性は PaCO₂ +10 で HCO₃⁻ +1、慢性は +3.5",
                 "正常値は年齢で違う。酸素化は P/F と OI で別に評価する"],
        tasks: [
            .key("ハードキーの「血液ガス」を押して採血してください。", event: .orderBloodGas,
                 why: "採血しました。結果が出るまで約 2 分かかります。急ぐときは「× 10」で早送りできます。"),
            .step("結果が返ってくるまで待ちます。",
                  why: "結果が出ました。この画面はハードキーからいつでも開き直せます。",
                  check: { !$0.bloodGases.isEmpty }),
            .quiz("pH 7.28 / PaCO₂ 58 / HCO₃⁻ 26。これは何ですか。",
                  ["代謝性アシドーシス",
                   "急性の呼吸性アシドーシス",
                   "慢性の呼吸性アシドーシス",
                   "呼吸性アルカローシス"], answer: 1,
                  why: "アシデミアで PaCO₂ が高い → 呼吸性アシドーシス。PaCO₂ が 40 → 58（+18）に対し HCO₃⁻ は 24 → 26（+2）と、急性の予想どおりです。腎臓が代償する前、つまり急性の変化です。"),
            .quiz("pH 7.36 / PaCO₂ 62 / HCO₃⁻ 35。これは何ですか。",
                  ["急性の呼吸性アシドーシス",
                   "慢性の呼吸性アシドーシス（代償されている）",
                   "代謝性アルカローシス",
                   "正常"], answer: 1,
                  why: "PaCO₂ が +22 に対して HCO₃⁻ が +11 と大きく上がり、pH がほぼ正常域まで戻っています。腎性代償が完成した慢性の高 CO₂ 血症です。小児では気管支肺異形成症（早産児が長く人工呼吸を受けたあとに残る慢性肺疾患）や、神経筋疾患で慢性的に低換気の子で見る形です。ここで PaCO₂ を 40 に戻すと、今度はアルカローシスになります。"),
            .quiz("pH 7.22 / PaCO₂ 30 / HCO₃⁻ 12。これは何ですか。",
                  ["呼吸性アシドーシス",
                   "代謝性アシドーシスと呼吸性代償",
                   "呼吸性アルカローシス",
                   "混合性アルカローシス"], answer: 1,
                  why: "アシデミアなのに PaCO₂ は低い → 呼吸性では説明できません。HCO₃⁻ 12 が主犯です。低い PaCO₂ は、その子が過換気で必死に代償している姿。小児では脱水・胃腸炎・糖尿病性ケトアシドーシス・先天代謝異常がよくある原因です。ここで鎮静をかけて呼吸を抑えると、pH は一気に落ちます。"),
            .quiz("PaO₂ 70 mmHg、FiO₂ 0.8 のときの P/F 比は？",
                  ["56",
                   "88",
                   "140",
                   "判定できない"], answer: 1,
                  why: "70 ÷ 0.8 ＝ 88。300 以下で軽症、200 以下で中等症、100 以下で重症の酸素化障害です。小児では動脈ラインを入れないことも多く、そのときは SpO₂ ÷ FiO₂（S/F 比）や OI で代用します。PaO₂ だけを見ても、FiO₂ が分からなければ良し悪しは判断できません。")
        ])

    static let lesson4_2 = Lesson(
        id: "4-2", title: "CO₂ を換気量で動かす", minutes: 9, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 120; s.respiratoryRate = 14; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 16; s.inspiratoryPause = 0.3
        },
        brief: [
            "PaCO₂ は「体が作る CO₂ ÷ 肺胞換気量」でほぼ決まります。感染や発熱で CO₂ の産生が増えれば上がり、換気を増やせば下がります。",
            "肺胞換気量 ＝（一回換気量 − 死腔）× 呼吸回数。死腔は 1 回ごとに引かれるので、同じ分時換気量なら一回換気量を増やすほうがよく効きます。",
            "例：体重 25 kg の児で Vt 120・RR 24（MV 2.9）と Vt 180・RR 16（MV 2.9）。死腔を 60 mL（気道 50 ＋ 回路 10）とすると、前者の肺胞換気は（120−60）×24 ＝ 1.44 L/分、後者は（180−60）×16 ＝ 1.92 L/分。同じ MV でも 33% 違います。成人の同じ計算だと差は 25% でした。体が小さいほど死腔の割合が大きく、差が開きます。",
            "ただし CO₂ の動きは遅く、設定を変えてから落ち着くまで数分かかります。変えた直後に採血しても、まだ動いていません。",
            "もう 1 つ小児で大きいのが、CO₂ の産生量そのものです。体重あたりの代謝は年齢が下がるほど大きく、新生児は成人の倍近く CO₂ を作ります。発熱すると 1℃ につき 10〜13% 増えるので、熱が出ただけで換気設定が足りなくなります。",
            "いまは意図的に低換気（Vt 120・RR 14）にしてあります。"
        ],
        points: ["PaCO₂ ∝ CO₂産生 ÷ 肺胞換気量",
                 "小児ほど死腔の割合が大きく、Vt を増やすほうが効く",
                 "発熱で CO₂ 産生が増える。効き始めるまで数分かかる"],
        tasks: [
            .key("まず採血して、いまの PaCO₂ を確かめてください。", event: .orderBloodGas),
            .step("結果が返ってくるまで待ちます。",
                  check: { !$0.bloodGases.isEmpty })
                .passing { c in if let g = c.lastBloodGas { c.memory.gases["first"] = g } }
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "PaCO₂ %.0f mmHg、pH %.2f。換気が足りていません。", g.paco2, g.pH)
                },
            .quiz("この呼吸性アシドーシスを直すために、まず動かすのはどれですか。",
                  ["FiO₂ を上げる",
                   "PEEP を上げる",
                   "分時換気量を増やす",
                   "鎮静を深くする"], answer: 2,
                  why: "CO₂ を下げる方法は換気を増やすことだけです。FiO₂ も PEEP も酸素化のつまみで、CO₂ には効きません。"),
            .step("一回換気量と呼吸回数を上げて、分時換気量を 3.2 L/分 以上にしてください。",
                  hold: 15,
                  why: "換気量を増やしました。CO₂ が動くまで数分かかります。",
                  check: { $0.measured.minuteVolume >= 3.2 })
                .hinting { c in
                    String(format: "体重 %.0f kg。Vt は 8 mL/kg（約 %@ mL）までは安全に上げられます。",
                           c.pbw, LessonLibrary.mlkg(c.pbw, 8))
                },
            .step("もう一度採血して、PaCO₂ が 35〜48 mmHg に入ったことを確かめてください。",
                  hint: "設定を変えてすぐでは動いていません。「× 10」で 5 分ほど進めてから採血します。",
                  check: { c in
                      guard c.bloodGases.count >= 2, let g = c.lastBloodGas else { return false }
                      return g.paco2 >= 33 && g.paco2 <= 48
                  })
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "PaCO₂ %.0f mmHg、pH %.2f。換気量を増やしたぶんだけ CO₂ が抜けました。",
                                  g.paco2, g.pH)
                },
            .quiz("PaCO₂ をもっと下げたい。Vt 120→160 と RR 20→26、どちらがよく効きますか（MV の増分はほぼ同じ）。",
                  ["Vt を増やすほう",
                   "RR を上げるほう",
                   "同じ",
                   "場合による"], answer: 0,
                  why: "死腔は 1 回の呼吸ごとに引かれるので、回数を増やすと死腔換気も一緒に増えます。Vt を増やすほうが肺胞に届く割合が高くなります。ただし Pplat と ΔP が上がるので、そちらの上限が先に来ます。小児 ARDS のように Vt を増やせない場面では、やむをえず RR で押すことになります。"),
            .quiz("RR を上げすぎたときに起きることはどれですか。",
                  ["auto-PEEP",
                   "高 FiO₂ による酸素毒性",
                   "リーク",
                   "カフ圧の上昇"], answer: 0,
                  why: "呼気時間が足りなくなり、吐ききる前に次の吸気が来ます。空気が残って胸腔内圧が上がり、血圧が下がってトリガもできなくなります。第5章で扱います。")
        ])

    static let lesson4_3 = Lesson(
        id: "4-3", title: "酸素化を読む ─ P/F 比と PEEP", minutes: 9, scenarioID: "ards",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 85; s.respiratoryRate = 30; s.peep = 5; s.fio2 = 0.8
            s.inspiratoryFlow = 12; s.inspiratoryPause = 0.3
        },
        brief: [
            "酸素化が悪い理由はいくつかありますが、人工呼吸中にいちばん問題になるのはシャントです。潰れた肺胞や水で埋まった肺胞を血液が素通りし、酸素を受け取らないまま動脈に戻ってきます。",
            "シャントの厄介なところは、FiO₂ を上げてもほとんど改善しないことです。素通りする血液は、どれだけ濃い酸素を吸わせても素通りするからです。",
            "だから ARDS では、FiO₂ を上げるより先に PEEP で肺胞を開きます。開いた肺胞が増えればシャントが減り、同じ FiO₂ でも PaO₂ が上がります。",
            "ただし PEEP を上げすぎると、開く肺よりも「すでに開いている肺を過膨張させる」ほうが勝ちます。そうなると酸素化は改善せず、血圧だけが下がります。",
            "PEEP を上げたあとに見るのは 3 つ。P/F 比（改善したか）、Pplat と ΔP（過膨張していないか）、血圧（循環が保てるか）。",
            "小児 ARDS（PARDS）でも考え方は同じですが、胸郭がやわらかいので圧が胸壁に逃げやすく、成人と同じ Pplat でも肺にかかる力は小さくなります。それでも PEEP 15 を超えて上げるときは、酸素化が本当に改善しているかを 1 段ごとに確かめます。",
            "いまは PEEP 5・FiO₂ 80% という、この児には足りない設定から始まっています。"
        ],
        points: ["シャントには FiO₂ が効かない",
                 "PEEP で肺胞を開いてから FiO₂ を下げる",
                 "PEEP を上げたら P/F・Pplat・血圧の 3 つを見る"],
        tasks: [
            .key("まず採血して、いまの P/F 比を確かめてください。", event: .orderBloodGas),
            .step("結果が返ってくるまで待ちます。",
                  check: { !$0.bloodGases.isEmpty })
                .passing { c in if let g = c.lastBloodGas { c.memory["pf0"] = g.pfRatio } }
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    let r = g.pfRatio
                    return String(format: "P/F 比 %.0f。", r)
                        + (r < 100 ? "100 を切る重症の酸素化障害です。" : "200 を切る中等症の酸素化障害です。")
                        + " FiO₂ 80% を吸わせてもこれだけしか上がらないのは、シャントが大きいからです。"
                },
            .step("PEEP を 14 cmH₂O まで上げて確定してください。",
                  hint: "一気に上げず、2 cmH₂O ずつ上げて Pplat と血圧を見るのが実際のやり方です。",
                  check: { $0.settings.peep >= 14 }),
            .step("そのまま 60 秒待ちます。SpO₂ と Pplat、ABP mean の変化を見てください。",
                  hold: 60,
                  check: { $0.settings.peep >= 14 })
                .explaining { c in
                    let plat = c.measured.plateauPressure.map { String(format: "%.0f", $0) } ?? "––"
                    let spo2 = String(format: "%.0f", c.engine.spo2)
                    let map = String(format: "%.0f", c.engine.meanArterialPressure)
                    return "SpO₂ \(spo2)%、Pplat \(plat)、平均動脈圧 \(map) mmHg。"
                        + "ARDS の肺にはリクルートできる部分が多いので、酸素化が改善します。"
                },
            .step("もう一度採血して、P/F 比が上がったことを確かめてください。",
                  hint: "「× 10」で早送りすると待ち時間が縮みます。",
                  check: { c in
                      guard c.bloodGases.count >= 2, let g = c.lastBloodGas,
                            let base = c.memory["pf0"] else { return false }
                      return g.pfRatio > base + 20
                  })
                .explaining { c in
                    guard let g = c.lastBloodGas, let base = c.memory["pf0"] else { return "" }
                    return String(format: "P/F 比が %.0f → %.0f に改善しました。FiO₂ は一切触っていません。開いた肺が増えた分です。",
                                  base, g.pfRatio)
                },
            .step("酸素化に余裕ができたので、SpO₂ 92% 以上を保ったまま FiO₂ を 60% 以下に下げてください。",
                  hold: 30,
                  why: "「PEEP で開いてから FiO₂ を下げる」という順番が身につきました。逆の順番だと、FiO₂ だけが高いまま肺は潰れたまま、という状態が続きます。",
                  check: { $0.settings.fio2 <= 0.61 && $0.engine.spo2 >= 92 }),
            .quiz("別の児で PEEP を 10 → 16 に上げたら、P/F は変わらず平均血圧だけ 62 → 44 に下がりました。これは何を意味しますか。",
                  ["まだ PEEP が足りない",
                   "開く肺がもう残っておらず、過膨張と循環抑制だけが起きている",
                   "FiO₂ を上げれば解決する",
                   "測定の誤差"], answer: 1,
                  why: "リクルートできる肺が乏しい状態です。PEEP を戻し、腹臥位や別の手段を考えます。「PEEP を上げて酸素化が改善しない」こと自体が、その肺についての重要な情報です。小児は循環の予備が少なく、前負荷が減るとすぐ心拍出量が落ちます。PEEP を上げる前に、輸液が足りているかを確かめておくのが実際的です。")
        ])

    static let lesson4_4 = Lesson(
        id: "4-4", title: "permissive hypercapnia ─ CO₂ を許す", minutes: 8, scenarioID: "ards",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 130; s.respiratoryRate = 26; s.peep = 12; s.fio2 = 0.6
            s.inspiratoryFlow = 14; s.inspiratoryPause = 0.3
        },
        brief: [
            "ここまでは「CO₂ が高ければ換気を増やす」でやってきました。ARDS ではその原則を曲げます。",
            "ARDS の肺は硬く、動員できる肺胞が少なくなっています。正常な CO₂ を目指して換気量を増やすと、わずかに残った健常な肺胞だけが繰り返し引き伸ばされ、そこが壊れます。",
            "そこで優先順位を入れ替えます。一回換気量 5〜6 mL/kg、Pplat 28 cmH₂O 以下、ΔP 14 cmH₂O 以下を守り、その結果 PaCO₂ が上がっても、pH が 7.20〜7.25 以上に保たれていれば許容します。これを permissive hypercapnia（許容的高炭酸ガス血症）といいます。小児 ARDS の指針（PALICC）では pH 7.15〜7.30 を許容範囲としています。",
            "pH が足りないときに上げるのは、Vt ではなく呼吸回数です。ただし回数を上げれば呼気時間が減るので、auto-PEEP が出ていないか確認します。",
            "例外が 3 つあります。頭蓋内圧が上がっている子では、高 CO₂ が脳血管を拡張させて頭蓋内圧をさらに上げます。肺高血圧のある子では、高 CO₂ とアシドーシスが肺血管を収縮させて右心不全を悪化させます。そして重症の心機能低下がある子。いずれも permissive hypercapnia は使えません。",
            "いまは Vt 130 mL（体重 14 kg なので 9 mL/kg。この児には大きすぎる）から始まっています。"
        ],
        points: ["Vt 5〜6 mL/kg・Pplat ≤28・ΔP ≤14 を CO₂ より優先",
                 "pH 7.20〜7.25 以上なら高 CO₂ を許す（PALICC は 7.15〜7.30）",
                 "頭蓋内圧上昇・肺高血圧・心不全では使えない"],
        tasks: [
            .step("いまの Vte（mL/kg 表示）と Pplat を確かめてください。",
                  check: { $0.measured.plateauPressure != nil && $0.measured.tidalVolumeExp > 100 })
                .explaining { c in
                    let plat = c.measured.plateauPressure ?? 0
                    return String(format: "Vte %.1f mL/kg、Pplat %.0f cmH₂O。肺保護の枠をはみ出しています。",
                                  c.tidalPerKg, plat)
                },
            .step("一回換気量を 6 mL/kg に下げ、Pplat と ΔP をこの年齢の上限以下にしてください。",
                  hold: 15,
                  why: "肺保護の条件を満たしました。当然、CO₂ は上がります。",
                  check: { c in
                      guard let plat = c.measured.plateauPressure,
                            let dp = c.measured.drivingPressure else { return false }
                      return c.tidalPerKg <= 6.6 && plat <= c.engine.norms.plateauMax
                          && dp <= c.engine.norms.drivingPressureMax
                  })
                .hinting { c in
                    String(format: "体重 %.0f kg なので目標 Vt は約 %@ mL、Pplat は %.0f 以下、ΔP は %.0f 以下です。",
                           c.pbw, LessonLibrary.mlkg(c.pbw, 6),
                           c.engine.norms.plateauMax, c.engine.norms.drivingPressureMax)
                },
            .step("採血して、CO₂ と pH がどうなったか確かめてください。",
                  hint: "「× 10」で 5 分ほど進めてから採血すると、変化がはっきりします。",
                  check: { !$0.bloodGases.isEmpty })
                .explaining { c in
                    guard let g = c.lastBloodGas else { return "" }
                    return String(format: "PaCO₂ %.0f mmHg、pH %.2f。", g.paco2, g.pH)
                },
            .quiz("3歳、pH 7.26 / PaCO₂ 58、Pplat 27、Vt は 6 mL/kg。どうしますか。",
                  ["Vt を増やして CO₂ を下げる",
                   "このままでよい（必要なら RR を少し上げる）",
                   "PEEP を下げる",
                   "鎮静を深くする"], answer: 1,
                  why: "pH 7.25 以上なら許容範囲です。ここで Vt を増やすのは、数字を良くするために肺を傷めることになります。もう少し上げたいなら RR です。ただし小児 ARDS は時定数が短いぶん RR を上げられる余地が大きく、この年齢なら 40〜50 /分 まで使えることもあります。"),
            .step("この児は pH が 7.25 を下回っています。一回換気量は触らず、呼吸回数だけを上げて pH を 7.25 以上にしてください。",
                  hint: "4〜6 回/分 ずつ上げます。効くまで数分かかるので「× 10」で進めてください。",
                  hold: 20,
                  why: "Vt を触らずに pH を上げられました。小児 ARDS ではこれが正しい順番です。",
                  check: { $0.engine.pH >= 7.25 }),
            .key("「呼気ポーズ」で、呼吸回数を上げた副作用が出ていないか確かめてください。", event: .expiratoryHold),
            .step("測定が終わるまで待ちます。",
                  check: { $0.holdSettled && $0.measured.totalPEEP > 0 })
                .explaining { c in
                    let ap = c.measured.autoPEEP
                    return String(format: "auto-PEEP %.1f cmH₂O。", ap)
                        + (ap < 3 ? "まだ余裕があります。" : "出始めています。ここが呼吸回数の上限です。")
                        + " ARDS の肺は時定数が短い（硬いぶん早く吐ける）ので、高めの RR に耐えられます。次の章で扱う細気管支炎の乳児では、まったく逆になります。"
                }
        ])

    // MARK: - 第5章　アラームとトラブル

    static let lesson5_1 = Lesson(
        id: "5-1", title: "気道内圧が上がった", minutes: 7, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        brief: [
            "気道内圧上限アラームは、人工呼吸中にいちばんよく鳴るアラームです。原因は大きく 2 つに分かれ、分け方は第1章でやった PIP と Pplat の比較です。",
            "PIP ↑・Pplat → （差が開いた）＝ 気道抵抗の問題。痰づまり、気管チューブの屈曲・閉塞・咬み込み、気管支攣縮、カフヘルニア。",
            "PIP ↑・Pplat ↑（差は同じ）＝ コンプライアンスの問題。無気肺、気胸、肺水腫、肺炎の悪化、腹部膨満、患者の咳き込みやファイティング。",
            "いきなり設定を変えたり鎮静を足したりする前に、吸気ポーズを 1 回押す。それだけで原因が半分に絞れます。",
            "小児では抵抗側のトラブルが成人よりずっと起こりやすくなります。気管チューブが細く、抵抗は内径の 4〜5 乗に反比例するからです。内径 4.0 mm のチューブの内側に 0.5 mm の分泌物が張りつくだけで、抵抗は 2 倍以上になります。加温加湿が不十分だと痰が固まり、一気に詰まります。",
            "このレッスンでは実際にトラブルを起こします。"
        ],
        points: ["まず吸気ポーズで Pplat を測る",
                 "PIP だけ上がる＝抵抗",
                 "PIP も Pplat も上がる＝コンプライアンス低下"],
        tasks: [
            .step("いまの PIP と Pplat を覚えておいてください。落ち着いたら次へ進みます。",
                  check: { $0.measured.plateauPressure != nil && $0.measured.staticCompliance != nil })
                .passing { c in
                    c.memory["pip0"] = c.measured.peakPressure
                    c.memory["plat0"] = c.measured.plateauPressure ?? 0
                }
                .explaining { c in
                    String(format: "PIP %.0f、Pplat %.0f cmH₂O。これが平常時です。",
                           c.memory["pip0"] ?? 0, c.memory["plat0"] ?? 0)
                },
            .key("患者が痰を貯めました。気道内圧アラームが鳴ります。まず何をしますか。",
                 hint: "設定を変える前に、原因を切り分けます。",
                 event: .inspiratoryHold,
                 why: "正解です。吸気ポーズで Pplat を測ります。")
                .starting { c in
                    let r = c.engine.airwayResistance
                    c.memory["rInsp0"] = r.inspiratory
                    c.memory["rExp0"] = r.expiratory
                    c.engine.setAirwayResistance(inspiratory: r.inspiratory * 7.0,
                                                 expiratory: r.expiratory * 3.5)
                },
            .step("測定が終わるまで待ちます。さっきの値と比べてください。",
                  check: { $0.measured.plateauPressure != nil && $0.engine.activeHold == nil })
                .explaining { c in
                    String(format: "PIP は %.0f → %.0f と上がったのに、Pplat は %.0f → %.0f とほとんど変わっていません。",
                           c.memory["pip0"] ?? 0, c.measured.peakPressure,
                           c.memory["plat0"] ?? 0, c.measured.plateauPressure ?? 0)
                },
            .quiz("この所見から考えられるのはどれですか。",
                  ["肺が硬くなった",
                   "気道抵抗が上がった",
                   "PEEP が高すぎる",
                   "回路のリーク"], answer: 1,
                  why: "差が開いた＝抵抗成分の増加です。Raw の値も上がっているはずです。痰、チューブの屈曲や咬み込み、気管支攣縮を順に確認します。小児では体位を変えただけでチューブが折れたり深く入ったりするので、「直前に何をしたか」を必ず確かめます。"),
            .quiz("吸引する前にやっておいたほうがよいことは？",
                  ["鎮静を深くする",
                   "FiO₂ を一時的に 100% にする",
                   "PEEP を下げる",
                   "呼吸回数を上げる"], answer: 1,
                  why: "吸引中は換気が止まり、陰圧で肺胞が潰れるため酸素化が必ず落ちます。前もって酸素を入れておきます（ハードキーの「100% O₂」がそれです）。小児は機能的残気量が小さく酸素の蓄えが少ないので、成人よりはるかに速く SpO₂ が落ちます。吸引カテーテルはチューブ内径の半分以下の太さを選び、10〜15 秒以内で終えます。"),
            .key("「100% O₂」を押してから「気管吸引」を押してください。", event: .suction,
                 why: "痰が取れました。抵抗が戻り、PIP が下がります。")
                .passing { c in
                    if let ri = c.memory["rInsp0"], let re = c.memory["rExp0"] {
                        c.engine.setAirwayResistance(inspiratory: ri, expiratory: re)
                    }
                },
            .step("SpO₂ の動きを 30 秒見てください。", hold: 30,
                  why: "吸引の直後は SpO₂ が一時的に下がります。陰圧で肺胞が虚脱するためで、数分で戻ります。ここで慌てて FiO₂ を上げたままにしないことが大事です。新生児では吸引による徐脈も起こります（迷走神経反射）。心拍も一緒に見ておきます。",
                  check: { _ in true })
        ])

    static let lesson5_2 = Lesson(
        id: "5-2", title: "auto-PEEP ─ 吐ききれていない", minutes: 8, scenarioID: "bronchiolitis",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 45; s.respiratoryRate = 45; s.peep = 6; s.fio2 = 0.5
            s.inspiratoryFlow = 5; s.inspiratoryPause = 0.3
        },
        brief: [
            "呼気が終わりきる前に次の吸気が来ると、吐き残しが肺にたまっていきます。その結果として肺に残る余分な圧が auto-PEEP（内因性 PEEP）です。",
            "気道抵抗が高い患者で起こります。小児で代表的なのは細気管支炎の乳児と、喘息重積の学童です。時定数 τ ＝ 気道抵抗 × コンプライアンス が大きく、吐くのに時間がかかるからです。",
            "乳児ではもともとの呼吸数が速い（30〜50 /分）ぶん、成人より簡単にこの状態に入ります。「苦しそうだから呼吸数を上げる」が、いちばんやってはいけない対応になります。",
            "困るのは 3 つ。①肺が過膨張して胸腔内圧が上がり、静脈還流が減って血圧が下がる。②肺胞が余分に引き伸ばされる。③患者が吸おうとしても、まず auto-PEEP の分だけ吸わないとトリガできない（ミストリガの原因）。",
            "見つけ方は 2 つ。流量波形の呼気がゼロに戻る前に次の吸気が始まっていること。そして呼気ポーズで測った総 PEEP と設定 PEEP の差です。",
            "対策は「吐く時間を作る」こと。呼吸回数を下げるのがいちばん効きます。次に吸気時間を短くする（＝吸気流量を上げる）。これは PIP を上げますが、Pplat は上げないので問題になりません。",
            "いまは生後 4か月・体重 6 kg の細気管支炎の乳児に RR 45 という、吐ききれない設定にしてあります。"
        ],
        points: ["auto-PEEP は吐き残しの圧",
                 "呼気ポーズ（総 PEEP − 設定 PEEP）で測る",
                 "対策の第一は呼吸回数を下げること"],
        tasks: [
            .step("流量波形（真ん中、緑）を 20 秒見てください。呼気の波がゼロに戻りきっているか確かめます。",
                  hold: 20,
                  why: "呼気が底からゼロに戻る前に、次の吸気で断ち切られています。これが吐き残しの形です。",
                  check: { _ in true }),
            .key("「呼気ポーズ」を押して、実際に測ってください。", event: .expiratoryHold),
            .step("測定が終わるまで待ちます。",
                  check: { $0.holdSettled && $0.measured.autoPEEP > 0 })
                .passing { c in c.memory["ap0"] = c.measured.autoPEEP }
                .explaining { c in
                    String(format: "総 PEEP %.1f に対して設定 PEEP は %.0f。差の %.1f cmH₂O が auto-PEEP です。",
                           c.measured.totalPEEP, c.settings.peep, c.memory["ap0"] ?? 0)
                },
            .quiz("auto-PEEP をいちばん確実に減らすのはどれですか。",
                  ["呼吸回数を下げる",
                   "一回換気量を上げる",
                   "吸気時間を延ばす",
                   "PEEP を上げる"], answer: 0,
                  why: "呼吸回数を下げると 1 呼吸の時間が伸び、その分がそのまま呼気時間になります。一回換気量を上げると吐く量が増えて逆効果、吸気時間を延ばすと呼気時間が削られます。"),
            .step("呼吸回数を下げてから、もう一度「呼気ポーズ」で auto-PEEP を 3 cmH₂O 未満にしてください。",
                  hint: "この乳児は τ が 0.7 秒前後。3τ ＝ 2 秒の呼気時間が要り、吸気 0.5 秒を足すと1 呼吸 2.5 秒。RR 20〜25 が目安です。",
                  check: { c in
                      c.measured.autoPEEP < 3 && c.settings.respiratoryRate < 30 && c.holdSettled
                  })
                .explaining { c in
                    String(format: "auto-PEEP が %.1f → %.1f cmH₂O に減りました。",
                           c.memory["ap0"] ?? 0, c.measured.autoPEEP)
                        + "呼吸回数を下げると CO₂ は上がりますが、細気管支炎では PaCO₂ 60〜70、pH 7.20 台までは許容します。"
                        + "無理に正常化しようとして呼吸数を上げると、空気が溜まって血圧が下がります。"
                },
            .quiz("喘息重積の学童で、吸気流量を 30 → 50 L/分 に上げました。PIP は上がりましたが Pplat は変わりません。これは？",
                  ["危険なのですぐ戻すべき",
                   "吸気時間が短くなり呼気時間が伸びるので、この患者には有利",
                   "換気量が増えすぎている",
                   "意味がない操作"], answer: 1,
                  why: "上がった PIP は抵抗のぶんで、肺胞にはかかっていません。一方で吸気が早く終わるぶん呼気に使える時間が増えます。「高い気道抵抗の患者では PIP ではなく Pplat を見る」のが実践的な理由です。この症例集では「喘息重積発作」で同じことを試せます。"),
            .quiz("auto-PEEP が 8 cmH₂O ある患者が、吸っても機械が反応しません。なぜですか。",
                  ["トリガ感度の設定ミス",
                   "まず auto-PEEP の 8 cmH₂O 分を吸い下げないと、回路に流れが生まれないから",
                   "鎮静が深いから",
                   "リークがあるから"], answer: 1,
                  why: "その子は毎回、余分な仕事を強いられています。対策として外から PEEP をかけて差を埋める方法（設定 PEEP を auto-PEEP の 8 割程度まで上げる）がありますが、まず吐かせることが先です。小児では「人工呼吸器と合わないから鎮静を足す」の前に、ここを疑ってください。")
        ])

    static let lesson5_3 = Lesson(
        id: "5-3", title: "SpO₂ が下がった ─ 順番を決めておく", minutes: 6, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        brief: [
            "人工呼吸中に急に SpO₂ が下がったときの合言葉が DOPE です。",
            "D — Displacement：チューブがずれた（片肺挿管、抜けかけ、食道挿管）",
            "O — Obstruction：チューブや気道が詰まった（痰、屈曲、咬み込み）",
            "P — Pneumothorax：気胸",
            "E — Equipment：機器や回路の問題（外れ、酸素供給、加温加湿器）",
            "小児では D と O がとくに多くなります。気管が短いので、頭を動かしただけでチューブが片肺に入ったり抜けかけたりします（新生児では首を曲げ伸ばしするだけで 1 cm 動きます）。チューブが細いので詰まりも早い。固定の位置（口角何 cm か）を毎回確認する習慣が要ります。",
            "そして小児は酸素の蓄えが少なく、代謝は大きい。同じ「換気が止まった」でも、SpO₂ が落ちるまでの時間が成人よりずっと短いことを前提に動きます。",
            "やる順番も決めておきます。①まず FiO₂ を 100% に。②胸の上がりと呼吸音を左右で聴く。③気道内圧の変化を見る（PIP と Pplat）。④原因が分からなければ回路を外してバッグで用手換気に切り替え、機械の問題か患者の問題かを分ける。",
            "「モニタだけ見て設定をいじる」のがいちばん危険です。SpO₂ が下がったら、まず子どもを見にいきます。"
        ],
        points: ["DOPE の 4 つを順に確認",
                 "まず FiO₂ 100%、次に患者を見る",
                 "分からなければ用手換気で切り分ける"],
        tasks: [
            .key("ハードキーの「100% O₂」を押してください。これが最初の一手です。", event: .oxygenFlush,
                 why: "2 分間だけ FiO₂ 100% になり、そのあと元の値に自動で戻ります（実機の一時的酸素化ボタンと同じ）。時間を稼いでいるあいだに原因を探します。"),
            .quiz("SpO₂ 低下と同時に PIP も Pplat も上がり、左の呼吸音が聞こえません。何を疑いますか。",
                  ["右片肺挿管または気胸",
                   "痰づまり",
                   "回路のリーク",
                   "鎮静が浅い"], answer: 0,
                  why: "コンプライアンスの低下（PIP も Pplat も上がる）＋片側の呼吸音消失です。チューブは右主気管支に入りやすいので、聞こえなくなるのは左が多くなります。小児では体位変換やケアのあとに起こりやすく、チューブを 0.5〜1 cm 引き抜けば戻ります。緊張性気胸なら血圧も下がります。どちらも「見て聴けば」分かるので、モニタだけ見ていると気づけません。"),
            .quiz("SpO₂ が下がり、PIP だけが上がって Pplat は変わりません。まず何をしますか。",
                  ["PEEP を上げる",
                   "吸引する",
                   "一回換気量を増やす",
                   "鎮静を深くする"], answer: 1,
                  why: "抵抗の上昇なので、痰やチューブの閉塞が第一候補です。吸引してみます。改善しなければ、チューブが折れていないか、患者が咬んでいないかを見ます。"),
            .quiz("SpO₂ が下がり、PIP も Pplat も下がり、Vte が急に減りました。何が起きていますか。",
                  ["気胸",
                   "痰づまり",
                   "回路が外れた・大きなリーク",
                   "肺水腫"], answer: 2,
                  why: "圧も量も同時に下がるのはリークの形です。回路の接続、カフ、加温加湿器を確認します。小児では抜管（自己抜去を含む）もこの形になります。回路が小さく軽いぶん、抜けても目立ちません。「圧が上がった／下がった」と「量が保たれている／減った」の組み合わせで、たいていの急変は切り分けられます。")
        ])

    // MARK: - 第6章　離脱と抜管

    static let lesson6_1 = Lesson(
        id: "6-1", title: "離脱できる条件を確かめる", minutes: 7, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 18; s.peep = 10; s.fio2 = 0.6
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        sedation: 0.7,
        brief: [
            "人工呼吸は長くつけるほど、肺炎・せん妄・筋力低下のリスクが積み上がります。だから「外せるか」を毎日確かめるのが原則です。",
            "小児で確かめる項目（readiness criteria）はおおよそ次のとおり。",
            "① 挿管の原因が改善に向かっている　② FiO₂ 0.4 以下　③ PEEP 7 cmH₂O 以下　④ P/F 比 200 以上　⑤ pH 7.30 以上　⑥ 昇圧剤が少量以下で循環が安定（平均動脈圧の下限は年齢で違う）　⑦ 覚醒している　⑧ 自発呼吸がある",
            "成人の項目と数字が少し違います。小児では PEEP 7 以下、P/F 200 以上と、やや厳しめに置きます。気管チューブが細いぶん再挿管の負担が大きく、抜管後に上気道浮腫で戻ってくる率も高いからです。",
            "「指示に従える」は乳児には使えません。代わりに「目を開けて追視する」「刺激に反応する」といった、年齢相応の覚醒の指標で見ます。",
            "いまは条件をわざと満たしていない設定（PEEP 10・FiO₂ 60%・深めの鎮静）から始まっています。"
        ],
        points: ["毎日「外せるか」を確かめる",
                 "小児は PEEP 7 以下・P/F 200 以上とやや厳しめ",
                 "抜管の可否は SBT の結果で決める"],
        tasks: [
            .key("ハードキーの「離脱」を押して、条件のリストを見てください。", event: .openWeaning,
                 why: "× がついている項目が、いま足りていないものです。"),
            .step("設定と鎮静を調整して、リストの項目をすべて ✓ にしてください。",
                  hint: "FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅くして自発呼吸を出します。「離脱」キーでいつでもリストを開き直せます。",
                  why: "条件が揃いました。ここで初めて SBT に進めます。",
                  check: { c in Weaning.readiness(for: c.engine).allSatisfy(\.met) }),
            .quiz("条件を全部満たしていれば、そのまま抜管してよいですか。",
                  ["よい",
                   "よくない。SBT で実際に耐えられるか確かめる",
                   "半分でよい",
                   "医師の判断次第"], answer: 1,
                  why: "条件は「試してよい」という意味であって、「外せる」という意味ではありません。呼吸筋の持久力は、この項目のどれにも表れないからです。"),
            .quiz("鎮静を浅くしないまま離脱を進めようとすると、何が困りますか。",
                  ["自発呼吸が出ないので、呼吸筋が持つかどうか評価できない",
                   "血圧が上がる",
                   "FiO₂ が下げられない",
                   "特に困らない"], answer: 0,
                  why: "評価そのものが成り立ちません。毎日の鎮静中断と SBT をセットで行うと、人工呼吸の日数が短くなることが知られています。一方で小児は鎮静を切ると自己抜去の危険があるので、評価のあいだは人手を確保して行うのが現実的です。")
        ])

    static let lesson6_2 = Lesson(
        id: "6-2", title: "SBT ─ 自発呼吸トライアル", minutes: 10, scenarioID: "gbs",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 160; s.respiratoryRate = 16; s.peep = 5; s.fio2 = 0.35
            s.inspiratoryFlow = 16; s.inspiratoryPause = 0.3
        },
        sedation: 0.2,
        brief: [
            "SBT（自発呼吸トライアル）は、機械の手伝いをほとんど外した状態で 30 分間耐えられるかを見る試験です。PEEP 5 cmH₂O に、気管チューブの抵抗を打ち消すぶんだけ PS を足します。チューブが細いほど抵抗が大きいので、PS は成人の 5 に対し、学童で 5〜6、乳児では 8〜10 にします。",
            "中止する基準を先に決めておきます。小児ではどれも年齢相応の値で置きます。呼吸回数がその年齢の正常上限の 1.5 倍を超える、SpO₂ がその子の目標域を下回る、心拍が普段より 25% 以上増える、血圧の大きな変動、不穏や発汗、陥没呼吸や鼻翼呼吸（成人にはない、小児で重要な所見）。",
            "浅く速い呼吸を数字にするのが f/VT です。成人の RSBI（＝ 呼吸回数 ÷ 一回換気量 L、105 超で失敗しやすい）は小児には使えません。同じ呼吸でも体重が軽いほど大きく出てしまうからです。小児では 呼吸回数 ÷ 一回換気量(mL/kg) で見て、8 を超えると失敗しやすいとされます。この画面でも「f/VT」として出しています。",
            "この症例は 7歳のギラン・バレー症候群で、肺そのものは正常です。酸素化も換気も問題ないのに離脱できない子がいるということを体験してください。"
        ],
        points: ["PEEP 5 ＋ チューブ抵抗ぶんの PS で 30 分（小児ほど PS は高め）",
                 "f/VT = RR ÷ Vt(mL/kg)、8 超で失敗しやすい",
                 "肺が正常でも呼吸筋が弱ければ離脱できない"],
        tasks: [
            .quiz("体重 22 kg の児の SBT 中、呼吸回数 40 回/分、一回換気量 110 mL でした。f/VT はいくつですか。",
                  ["1.8",
                   "8",
                   "40",
                   "判定できない"], answer: 2,
                  why: "一回換気量は 110 ÷ 22 ＝ 5 mL/kg。40 ÷ 5 ＝ 8 です。目安の 8 に達しており、このまま抜管すると再挿管になりやすい状態です。ちなみに成人式の RSBI なら 40 ÷ 0.11 L ＝ 364 となり、「105 超」という基準では何も判断できないことが分かります。"),
            .key("「離脱」キーから SBT を開始してください。",
                 hint: "条件リストの下に「SBT を開始（30分）」があります。",
                 event: .startSBT,
                 why: "PEEP 5 とチューブ抵抗ぶんの PS に切り替わり、30 分の計測が始まりました。早送りを使って構いません。"),
            .step("30 分の SBT を最後まで見てください。f/VT と呼吸回数の動きに注目します。",
                  hint: "「× 10」または「× 60」で早送りできます。異常が出ると自動的に等速に戻ります。",
                  check: { $0.sbt.finished })
                .explaining { c in
                    c.sbt.passed
                        ? "30 分間、呼吸回数も酸素化も循環も保てました。抜管を検討できます。"
                        : "途中で中止になりました。理由：" + (c.sbt.failureReason ?? "―")
                },
            .quiz("SBT 開始から 20 分かけて、じわじわ呼吸回数が上がり一回換気量が落ちてきました。これは何ですか。",
                  ["正常な適応",
                   "呼吸筋疲労のサイン",
                   "鎮静が効いてきた",
                   "回路のリーク"], answer: 1,
                  why: "呼吸筋が持たなくなってきた形（rapid shallow breathing）です。SBT の失敗はこのパターンがいちばん多く、最初の数分ではなく後半に出ます。だから「5 分見て大丈夫だった」では足りません。小児では数字より先に、陥没呼吸・鼻翼呼吸・シーソー呼吸といった見た目の所見が出ます。"),
            .quiz("SBT に失敗しました。次に何をしますか。",
                  ["すぐにもう一度 SBT をやる",
                   "元の設定に戻して呼吸筋を休ませ、失敗の原因を探して翌日また試す",
                   "鎮静を深くして様子を見る",
                   "気管切開を即決する"], answer: 1,
                  why: "疲れた呼吸筋は休ませます（通常 24 時間）。そのあいだに原因（心不全、感染、栄養、電解質、せん妄、過鎮静）を探します。小児では上気道の問題（喉頭軟化症、声門下狭窄）や、神経筋疾患そのものの進行も原因になります。失敗を繰り返すだけでは前に進みません。")
        ])

    static let lesson6_3 = Lesson(
        id: "6-3", title: "抜管、そしてそのあと", minutes: 8, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 18; s.peep = 5; s.fio2 = 0.35
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        sedation: 0.15,
        brief: [
            "SBT に通っても、抜管はもう一段別の判断です。呼吸が保てるかどうかに加えて、「気道が守れるか」を見ます。",
            "確かめるのは 3 つ。① 意識：年齢相応に覚醒しているか（学童なら指示に従える、乳児なら目を開けて反応する）② 咳嗽力：吸引時にしっかり咳ができるか③ 分泌物の量：2 時間に 1 回以上の吸引が要るなら危ない",
            "小児でとくに重いのが上気道浮腫です。気道抵抗は内径の 4 乗に反比例するので、同じ 1 mm の浮腫でも、内径 4 mm の乳児の気道では断面積が半分以下になります。成人では「声がかすれる」で済むことが、乳児では再挿管になります。",
            "だから抜管前にカフリークテストをします。カフを抜いた（あるいはカフなしチューブの）状態で、チューブの周りから空気が漏れる音が聞こえるか、リーク量が十分かを見ます。漏れないときは浮腫を疑い、抜管の数時間前からステロイドを入れることがあります。",
            "抜管後 48 時間以内の再挿管は予後を悪くします。迷ったら、抜管後に高流量鼻カニュラや NPPV を予防的に使う手があります。小児ではこれがよく効きます。",
            "このレッスンでは、最後まで通して抜管します。"
        ],
        points: ["呼吸が保てること と 気道が守れること は別",
                 "意識・咳嗽力・分泌物の 3 つを見る",
                 "小児は上気道浮腫の影響が大きい。カフリークテストを忘れない"],
        tasks: [
            .step("「離脱」キーから SBT を開始し、最後まで完走させてください。",
                  hint: "早送りを使ってください。",
                  why: "SBT に通りました。",
                  check: { $0.sbt.finished && $0.sbt.passed }),
            .quiz("SBT に通りましたが、その子は呼びかけに反応せず、吸引しても咳をしません。抜管しますか。",
                  ["する（SBT に通ったから）",
                   "しない（気道が守れない）",
                   "鎮静を足してから抜管する",
                   "PS を上げて再評価"], answer: 1,
                  why: "呼吸が保てることと、気道が守れることは別です。咳ができなければ痰を出せず、意識がなければ誤嚥します。抜管しても結局戻ってきます。小児は気道が細いので、出せなかった痰がそのまま無気肺や再挿管につながります。"),
            .quiz("抜管後 1 時間で、吸気時に「ヒューヒュー」という高い音（stridor）と陥没呼吸が出てきました。何を考えますか。",
                  ["気管支喘息",
                   "上気道（声門下）の浮腫",
                   "肺水腫",
                   "正常な経過"], answer: 1,
                  why: "吸気性の stridor は上気道の狭窄です。小児では声門下がいちばん細いので、ここが腫れます。アドレナリン吸入とステロイドで対応し、改善しなければ再挿管を早めに決めます。粘り強く待つほど疲れて悪化するので、決断を遅らせないことが大事です。"),
            .key("「離脱」キーから抜管してください。", event: .extubate),
            .step("結果を確認してください。",
                  why: "一通り終わりました。振り返り画面では、目標域にいた時間・肺保護の逸脱・有害事象が点数として出ます。症例一覧には早産児 RDS・細気管支炎・小児 ARDS・喘息重積もあります。体重 1.1 kg から 35 kg まで、同じ考え方が桁の違う数字にどう化けるかをフリー操作モードで確かめてみてください。",
                  check: { $0.extubated })
        ])
}
