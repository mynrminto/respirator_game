import Foundation

/* 第1〜3章の中身。1 ファイルにまとめると型検査が重くなるので章ごとに分けてある。
 * 文面・課題・判定はすべて web/lessons.js と同じ。片方だけ直さないこと。 */

extension LessonLibrary {

    // MARK: - 第1章　機械を読む

    static let lesson1_1 = Lesson(
        id: "1-1", title: "画面には何が出ているのか", minutes: 3, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 150; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 18; s.inspiratoryPause = 0
        },
        brief: [
            "波形は上から 気道内圧 Paw（黄）／ 流量 Flow（緑）／ 換気量 Volume（青）。1 画面で約 8 秒。",
            "流量だけがゼロ線をまたぐ。上が吸気、下が呼気。",
            "設定の Vt は人が決めた量、Vte は実際に戻ってきた量。小児では mL/kg で読む。"
        ],
        points: ["波形は上から Paw / Flow / Volume",
                 "流量波形は上が吸気・下が呼気",
                 "設定の Vt と実測の Vte は別物"],
        tasks: [
            .talk(.scene, "午後 8 時、PICU。虫垂炎の手術を終えたハルト君（8歳）が、挿管されたまま運ばれてきた。"),
            .talk(.doctor, "今夜の担当はあなたです。まずは、この機械が何を言っているのかを読めるようにしましょう。"),
            .talk(.puku, "うわ、波形が 3 つもある…。どれが何なの？"),
            .talk(.doctor, "上から 気道内圧、流量、換気量。どれがどれかは、動き方で見分けられます。"),
            .quiz("真ん中の緑の波形だけがゼロ線をまたいで上下しています。これは何ですか。",
                  ["気道内圧",
                   "流量",
                   "換気量",
                   "二酸化炭素濃度"], answer: 1,
                  why: "流量です。上が吸気、下が呼気。上下するのは流量だけなので、これが見分けの目印になります。")
                .spotting(["wave"]),
            .talk(.doctor, "読めましたね。次は触ってみましょう。実機は 3 段階です。キーを押す、ダイヤルを回す、確定。"),
            .step("Vt を 180 mL にして確定してください。",
                  hint: "キーを押す → ダイヤルを回す → 確定。この 3 段階が実機の操作です。",
                  why: "確定を押すまで患者には反映されません。実機の誤操作防止と同じです。",
                  check: { abs($0.settings.tidalVolume - 180) < 1 })
                .spotting(["key:vt"]).watching(["Vte"]),
            .step("Vte が設定に追いつくまで待ちます。",
                  why: "VC は入れる量を機械が保証するので、Vte はほぼ設定どおりに返ってきます。",
                  check: { $0.measured.tidalVolumeExp > 160 })
                .spotting(["val:Vte"]).watching(["Vte", "MV"]),
            .talk(.puku, "入れた量と、戻ってくる量って、ちがうことあるの？"),
            .talk(.doctor, "あります。しかもそれが、いちばん最初に気づくべき異常です。"),
            .quiz("設定 180 mL に対して Vte が 120 mL しか戻りません。まず疑うのは何ですか。",
                  ["正常。気にしなくてよい",
                   "気管チューブ周囲のリーク",
                   "鎮静が浅い",
                   "FiO₂ が低い"], answer: 1,
                  why: "入れた量より戻る量が少なければリークです。カフなしチューブの年齢では日常的に起こります。カフ圧・回路の接続・チューブの深さを確認し、20% を超えるなら 1 サイズ太いチューブを考えます。")
        ])

    static let lesson1_2 = Lesson(
        id: "1-2", title: "PIP と Pplat ─ 圧は 2 つある", minutes: 5, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 30; s.inspiratoryPause = 0
        },
        brief: [
            "PIP ＝ ガスを気道に押し流す圧（流量 × 抵抗）＋ 肺を膨らませる圧（換気量 ÷ コンプライアンス）。",
            "吸気の終わりに流れを止めると前者が消え、残るのが Pplat。肺胞が受けている圧に近い。",
            "肺を傷めるのは PIP ではなく Pplat と ΔP（＝ Pplat − PEEP）。上限は年齢が下がるほど低い。"
        ],
        points: ["PIP = 抵抗の分 + 肺を膨らませる分",
                 "Pplat は吸気ポーズで測る",
                 "上限は年齢で変わる（タイルの下に出ている）"],
        tasks: [
            .talk(.scene, "ハルト君の設定はひとまず落ち着いた。みどり先生が、画面の圧の数字を指さす。"),
            .talk(.doctor, "PIP は 22。でもこの数字だけでは、肺に何がかかっているかは分かりません。"),
            .talk(.puku, "え、圧は圧じゃないの？"),
            .talk(.doctor, "圧は 2 つあるんです。流れを押す分と、肺を膨らませる分。分けて測ってみましょう。"),
            .key("「吸気ポーズ」を押してください。",
                 event: .inspiratoryHold,
                 why: "次の吸気の終わりで弁が閉じ、圧が平らになります。")
                .spotting(["hard:kInsp"]),
            .step("測り終わるのを待ちます。",
                  why: "平らになったところが Pplat。流れが止まったあとに残っている、肺胞の圧です。",
                  check: { $0.measured.plateauPressure != nil && $0.measured.drivingPressure != nil })
                .spotting(["val:Pplat"]).watching(["PIP", "Pplat", "ΔP"]),
            .talk(.doctor, "2 つに分かれました。どちらが何なのか、ここで確かめておきましょう。"),
            .quiz("出ている 3 つの数字のうち、気道抵抗にとられている分はどれですか。",
                  ["PIP − Pplat",
                   "Pplat − PEEP",
                   "PIP − PEEP",
                   "PEEP そのもの"], answer: 0,
                  why: "PIP と Pplat の差が抵抗成分です。ここが大きいときは痰・チューブの屈曲・気管支攣縮を考えます。")
                .watching(["PIP", "Pplat", "PEEP tot"]),
            .quiz("では、肺胞が 1 回の呼吸で引き伸ばされる圧（ΔP）はどれですか。",
                  ["PIP − Pplat",
                   "Pplat − PEEP",
                   "PIP − PEEP",
                   "Vte ÷ Pplat"], answer: 1,
                  why: "ΔP ＝ Pplat − PEEP。予後との関連がいちばん強い圧で、画面にもタイルで出ています。")
                .watching(["Pplat", "PEEP tot", "ΔP"]),
            .talk(.puku, "じゃあ PIP が高いとき、どうすれば下げられるの？"),
            .talk(.doctor, "流れを押す分を減らせばいい。速さを落としてみましょう。"),
            .step("吸気流量を 15 L/分 に下げて確定してください。",
                  hint: "この 8歳の児で 15〜30 L/分、乳児なら 5〜10 L/分が目安です。",
                  why: "ゆっくり押し込むぶん、抵抗にとられる圧が減ります。",
                  check: { $0.settings.inspiratoryFlow <= 15 })
                .spotting(["key:flow"]).watching(["PIP", "Pplat"]),
            .key("もう一度「吸気ポーズ」を押して測り直してください。", event: .inspiratoryHold)
                .spotting(["hard:kInsp"]),
            .step("測り終わるのを待ちます。PIP と Pplat を見比べてください。",
                  why: "PIP は下がったのに、Pplat はほとんど動いていません。流量を変えても肺の硬さは変わらないからです。",
                  check: { $0.measured.plateauPressure != nil && $0.holdSettled })
                .watching(["PIP", "Pplat", "ΔP"]),
            .quiz("この結果から言えることは何ですか。",
                  ["PIP が高い＝肺を傷めている、とは限らない",
                   "流量を下げれば肺は守られる",
                   "PIP と Pplat は同じものである",
                   "流量を下げると換気量も減る"], answer: 0,
                  why: "PIP が高くても Pplat が正常なら、高いのは抵抗の分だけです。「圧アラームが鳴ったら、まず吸気ポーズで Pplat を測る」のはこのためです。")
        ])

    static let lesson1_3 = Lesson(
        id: "1-3", title: "コンプライアンスと気道抵抗", minutes: 5, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        brief: [
            "Cstat ＝ Vte ÷ ΔP。肺の膨らみやすさ。小児は体重で割って読む（正常 0.9〜1.1 mL/cmH₂O/kg）。",
            "Raw ＝（PIP − Pplat）÷ 流量。空気の通りにくさ。細いチューブほど大きい。",
            "同じ「圧が上がった」でも、上がったのがどちらかで探すものが変わる。"
        ],
        points: ["Cstat = Vte ÷ ΔP（正常 0.9〜1.1 mL/cmH₂O/kg）",
                 "Raw =（PIP − Pplat）÷ 流量。チューブが細いほど大きい",
                 "上がったのがどちらかで原因が違う"],
        tasks: [
            .talk(.doctor, "いまの 2 つの圧を、機械が勝手に割り算してくれています。それが Cstat と Raw。"),
            .talk(.puku, "割り算？"),
            .talk(.doctor, "肺の柔らかさと、気道の通りにくさです。夜中のアラームは、ほとんどこの 2 つで説明がつきます。"),
            .step("Cstat と Raw に数字が入るまで待ちます。",
                  hint: "吸気ポーズを 0.3 秒に設定してあるので、毎回の呼吸で自動的に測られます。",
                  check: { $0.measured.staticCompliance != nil && $0.measured.airwayResistance != nil })
                .explaining { c in
                    String(format: "Cstat %.1f mL/cmH₂O/kg。術後の肺なので、どちらもほぼ正常です。これを基準にして異常を覚えます。",
                           (c.measured.staticCompliance ?? 0) / c.pbw)
                }
                .spotting(["val:Cstat", "val:Raw"]).watching(["Cstat", "Raw"]),
            .step("一回換気量を 120 mL に下げて確定し、3 つの数字を見比べてください。",
                  why: "Vte と ΔP は一緒に減り、Cstat はほとんど動きません。Cstat は設定ではなく肺そのものの性質だからです。",
                  check: { $0.settings.tidalVolume <= 120 })
                .spotting(["key:vt"]).watching(["Vte", "ΔP", "Cstat"]),
            .talk(.doctor, "数字が動いたとき、どちらが犯人か。言い当てられるようにしておきましょう。"),
            .quiz("体重 25 kg の児で Cstat が 24 → 10 mL/cmH₂O に下がりました。何が起きていますか。",
                  ["気道が細くなった",
                   "肺が硬くなった",
                   "鎮静が深くなった",
                   "回路がリークしている"], answer: 1,
                  why: "肺が硬くなっています。無気肺、肺水腫、肺炎、気胸。小児で見落としやすいのが腹部膨満で、乳児は腹式呼吸なので胃の空気だけでも換気が悪くなります。"),
            .quiz("別の児で PIP だけが 25 → 38 に上がり、Pplat は 18 のままです。原因は？",
                  ["肺が硬くなった",
                   "気道抵抗が上がった",
                   "PEEP が高すぎる",
                   "一回換気量が大きすぎる"], answer: 1,
                  why: "差が開いた＝抵抗の増加です。痰、チューブの屈曲や閉塞、気管支攣縮を探します。小児はチューブが細いぶん、わずかな分泌物でも抵抗がはっきり上がります。"),
            .talk(.puku, "吸気ポーズがあるなら、呼気ポーズもあるの？"),
            .talk(.doctor, "あります。こちらは吐ききれているかを見るためのもの。第 5 章で主役になります。"),
            .key("「呼気ポーズ」を押して、総 PEEP を測ってください。", event: .expiratoryHold)
                .spotting(["hard:kExp"]),
            .step("測り終わるのを待ちます。",
                  why: "総 PEEP と設定 PEEP の差が auto-PEEP（吐ききれずに残った圧）です。この児ではほぼゼロ。第5章で、これが問題になる乳児を扱います。",
                  check: { $0.measured.totalPEEP > 0 && $0.holdSettled })
                .watching(["PEEP tot", "auto-PEEP"])
        ])

    // MARK: - 第2章　挿管直後の初期設定

    static let lesson2_1 = Lesson(
        id: "2-1", title: "一回換気量は体重で決める", minutes: 4, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 300; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.inspiratoryPause = 0.3
        },
        brief: [
            "小児は実体重で決める。成人の予測体重式は使わない。",
            "目安は 6〜8 mL/kg。ARDS では 5〜6、新生児では 4〜6 mL/kg。",
            "例外は肥満児だけで、身長相当の標準体重で計算する（脂肪がついても肺は大きくならない）。"
        ],
        points: ["小児は実体重で決める（成人の予測体重式は使わない）",
                 "6〜8 mL/kg、ARDS では 5〜6、新生児は 4〜6",
                 "肥満児だけは身長相当の標準体重で"],
        tasks: [
            .talk(.scene, "朝の回診。ハルト君の設定は、手術室から運ばれてきたときのままだった。"),
            .talk(.doctor, "ここからは自分で決めます。最初に決めるのは一回換気量。基準は体重です。"),
            .talk(.puku, "体重？ 身長じゃなくて？"),
            .talk(.doctor, "小児では体重 1 kg あたり 6〜8 mL。まず、いまの値がいくつなのか確かめましょう。"),
            .step("いまの Vte を mL/kg で確かめてください。",
                  hint: "タイルの下に mL/kg が出ています。",
                  check: { $0.measured.tidalVolumeExp > 260 })
                .explaining { c in
                    String(format: "約 %.1f mL/kg。体重 %.0f kg に対して明らかに入れすぎです。",
                           c.tidalPerKg, c.pbw)
                }
                .spotting(["val:Vte"]).watching(["Vte", "Pplat", "ΔP"]),
            .step("一回換気量を 6 mL/kg に合わせて確定してください。",
                  why: "肺保護の基本設定になりました。圧も一緒に下がっています。",
                  check: { abs($0.settings.tidalVolume - $0.pbw * 6) <= 25 })
                .hinting { c in
                    String(format: "体重 %.1f kg × 6 ＝ 約 %@ mL です。", c.pbw, LessonLibrary.mlkg(c.pbw, 6))
                }
                .spotting(["key:vt"]).watching(["Vte", "Pplat", "ΔP"]),
            .talk(.puku, "大人みたいに「だいたい 500 mL」じゃダメなの？"),
            .talk(.doctor, "小児は 1 kg から 35 kg まで動きます。暗記では届きません。毎回かけ算します。"),
            .quiz("体重 6 kg の乳児に 6 mL/kg。一回換気量は何 mL ですか。",
                  ["16 mL",
                   "36 mL",
                   "60 mL",
                   "体重では決められない"], answer: 1,
                  why: "36 mL です。成人の感覚で「少なすぎる」と増やしてしまうのが、小児でいちばん多い間違い。回路の伸びやリークで実測がぶれるので、Vte は必ず mL/kg で読みます。"),
            .quiz("10歳、身長 138 cm（標準体重 32 kg）、実体重 58 kg の肥満児。基準はどれですか。",
                  ["実体重 58 kg",
                   "身長相当の標準体重 32 kg",
                   "2 つの平均",
                   "身長だけで決める"], answer: 1,
                  why: "標準体重 32 kg で計算します。ただし腹圧で横隔膜が押し上げられるため、PEEP は高めが要ることがあります。")
        ])

    static let lesson2_2 = Lesson(
        id: "2-2", title: "呼吸回数と分時換気量", minutes: 5, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 150; s.respiratoryRate = 10; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 20; s.inspiratoryPause = 0.3
        },
        brief: [
            "MV ＝ Vt × RR。ただし効くのは、死腔を引いた肺胞換気量。",
            "死腔は 1 呼吸ごとに引かれる。小児ほどその割合が大きく、浅く速い換気は効率が悪い。",
            "吐ききるには 3τ（τ ＝ Raw × Cstat）の呼気時間が要る。足りなければ auto-PEEP。"
        ],
        points: ["MV = Vt × RR、効くのは死腔を引いた肺胞換気量",
                 "小児ほど死腔の割合が大きく、浅く速い換気は効率が悪い",
                 "吐ききるには 3τ の呼気時間が必要"],
        tasks: [
            .talk(.doctor, "量が決まったら、次は回数。かけ算した分時換気量が、そのまま CO₂ を決めます。"),
            .talk(.puku, "じゃあ回数は、多いほどいいの？"),
            .talk(.doctor, "そこが落とし穴です。まず上げてみて、そのあと確かめましょう。"),
            .step("呼吸回数を上げて MV を 3.0〜4.2 L/分 に入れ、30 秒保ってください。",
                  hint: "Vt 150 mL なら RR 20〜28 のあたりです。", hold: 30,
                  why: "体重 25 kg では 120〜170 mL/kg/分 が安静時の目安です。乳児はもっと多く要ります（200 mL/kg/分 前後）。代謝が体重あたりで大きいからです。",
                  check: { $0.measured.minuteVolume >= 3.0 && $0.measured.minuteVolume <= 4.2 })
                .spotting(["key:rr"]).watching(["MV", "RR tot"]),
            .quiz("RR を 20 から 30 に上げました。1 回の呼吸に使える時間はどうなりますか。",
                  ["3.0 秒 → 2.0 秒に短くなる",
                   "変わらない",
                   "2.0 秒 → 3.0 秒に長くなる",
                   "吸気時間だけが伸びる"], answer: 0,
                  why: "60 ÷ RR が 1 呼吸の長さです。吸気時間が同じなら、短くなった分はすべて呼気時間から削られます。"),
            .quiz("τ が 0.7 秒の乳児。吐ききるのに必要な呼気時間はおよそ何秒ですか。",
                  ["0.2 秒",
                   "2 秒",
                   "6 秒",
                   "10 秒"], answer: 1,
                  why: "3τ ＝ 約 2 秒。吸気 0.5 秒を足すと 1 呼吸 2.5 秒、つまり RR 24 が上限です。細気管支炎で「呼吸数を上げたのに CO₂ が下がらない」のはこれが理由です。"),
            .talk(.doctor, "いま上げた回数で、この子が吐ききれているかどうか。測れば分かります。"),
            .key("「呼気ポーズ」で、空気が残っていないか確かめてください。", event: .expiratoryHold)
                .spotting(["hard:kExp"]),
            .step("測り終わるのを待ちます。",
                  check: { $0.holdSettled && $0.measured.totalPEEP > 0 })
                .explaining { c in
                    c.measured.autoPEEP < 2 ? "肺が正常でこの回数なら、十分に吐ききれています。"
                                            : "残り始めています。呼吸回数を下げる余地があります。"
                }
                .watching(["auto-PEEP", "PEEP tot"])
        ])

    static let lesson2_3 = Lesson(
        id: "2-3", title: "PEEP と FiO₂ ─ 酸素化の 2 つのつまみ", minutes: 6, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 150; s.respiratoryRate = 20; s.peep = 5; s.fio2 = 1.0
            s.inspiratoryFlow = 20; s.inspiratoryPause = 0.3
        },
        brief: [
            "SpO₂ の目標は年齢で違う（早産児 90〜95%、乳幼児 92〜97%、学童 94〜98%）。狙うのは目標を保てる最小の FiO₂。",
            "PEEP は潰れた肺胞を開いてシャントを減らす。効きは遅く、そのかわり FiO₂ を下げられる。",
            "PEEP は胸腔内圧を上げるので、上げたら血圧を見る。血圧の下限も年齢で違う。"
        ],
        points: ["SpO₂ の目標は年齢で違う（早産児 90〜95%、学童 94〜98%）",
                 "PEEP は肺胞を開く、効き方は遅い",
                 "PEEP を上げたら血圧を見る。血圧の下限も年齢で違う"],
        tasks: [
            .talk(.doctor, "酸素化のつまみは 2 つだけ。FiO₂ と PEEP です。役割がまったく違います。"),
            .talk(.puku, "SpO₂ が低かったら、とりあえず酸素を上げればいいんじゃないの？"),
            .talk(.doctor, "とりあえずはそれで正解。ただ、下げ忘れないこと。まず下げるほうからやります。"),
            .step("SpO₂ 94% 以上のまま、FiO₂ を 40% 以下に下げて 40 秒保ちます。",
                  hint: "5〜10% ずつ下げて SpO₂ を確かめます。急ぐときは「× 10」で早送りできます。", hold: 40,
                  why: "この児は肺がほぼ正常なので、FiO₂ は早く下げられます。術後に 100% のまま放置されている子は珍しくありません。",
                  check: { $0.settings.fio2 <= 0.41 && $0.engine.spo2 >= 94 })
                .spotting(["key:fio2"]).watching(["SpO₂"]),
            .quiz("SpO₂ が 100% で FiO₂ が 90% のまま。どうしますか。",
                  ["余裕があるのでそのまま",
                   "FiO₂ を下げる",
                   "PEEP を上げる",
                   "一回換気量を増やす"], answer: 1,
                  why: "SpO₂ 100% は「PaO₂ が 100 以上のどこか」という意味しかなく、余裕の量は見えません。高い FiO₂ を続ける理由がないので下げます。"),
            .talk(.doctor, "もう 1 つのつまみ、PEEP。上げると酸素化は良くなりますが、ただではありません。"),
            .step("PEEP を 12 cmH₂O まで上げて確定してください。",
                  check: { $0.settings.peep >= 12 })
                .spotting(["key:peep"]).watching(["ABP mean", "Pplat", "SpO₂"]),
            .step("そのまま 45 秒、平均動脈圧を見てください。", hold: 45,
                  check: { $0.settings.peep >= 12 })
                .explaining { c in
                    String(format: "平均動脈圧 %.0f mmHg（この年齢の下限は %.0f）。胸腔内圧が上がって静脈還流が減り、心拍出量が落ちました。",
                           c.engine.meanArterialPressure, c.engine.norms.meanArterialPressureMin)
                }
                .spotting(["val:ABP mean"]).watching(["ABP mean", "SpO₂", "Pplat"]),
            .step("PEEP を 5 cmH₂O に戻してください。",
                  why: "PEEP は高いほど良いものではなく、開ける肺が残っているときに効くものです。第4章で、本当に効く小児 ARDS の肺を扱います。",
                  check: { $0.settings.peep <= 5 })
                .spotting(["key:peep"]).watching(["ABP mean", "SpO₂"])
        ])

    // MARK: - 第3章　モードの違い

    static let lesson3_1 = Lesson(
        id: "3-1", title: "量を決めるか、圧を決めるか", minutes: 6, scenarioID: "ards",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 85; s.respiratoryRate = 30; s.peep = 10; s.fio2 = 0.6
            s.inspiratoryFlow = 12; s.inspiratoryPause = 0.3
        },
        brief: [
            "量規定（VC）＝ 入れる量を約束する。肺が硬くなれば圧が上がる。見張るのは Pplat。",
            "圧規定（PC）＝ かける圧を約束する。肺が硬くなれば量が減る。見張るのは Vte。",
            "新生児・小さな乳児では伝統的に PC。カフなしチューブから漏れるので、量を保証しても意味がないため。"
        ],
        points: ["VC は量を保証し圧が動く",
                 "PC は圧を保証し量が動く",
                 "VC では Pplat、PC では Vte を見張る"],
        tasks: [
            .talk(.scene, "別のベッドから呼ばれた。インフルエンザ肺炎のミオちゃん（3歳）。両肺が真っ白だ。"),
            .talk(.doctor, "同じ肺でも、量を決めるか圧を決めるかで、この子の安全域が変わります。"),
            .step("圧波形（上、黄色）の形を見てください。斜めに立ち上がっています。",
                  why: "VC では流量が先に決まっているので、圧はその結果として出てきます。だから角が立ちます。",
                  check: { $0.measured.plateauPressure != nil })
                .spotting(["wave"]).watching(["PIP", "Pplat", "Vte"]),
            .talk(.puku, "モードって、いっぱいあって覚えられない…"),
            .talk(.doctor, "覚えるのは 1 つだけ。何を機械が保証して、何を患者に預けるか。切り替えて見比べましょう。"),
            .key("上のタブで「PC-AC」に切り替えてください。", event: .modePressureAC,
                 why: "圧波形が四角い台形になりました。設定した圧まで一気に上げ、吸気のあいだ保っています。")
                .spotting(["mode:A/C PC"]),
            .step("P insp を動かして Vte を 6 mL/kg 前後にし、20 秒保ってください。", hold: 20,
                  why: "同じ換気量を、今度は圧で作りました。VC と PC はゴールが同じで、道順が違うだけです。",
                  check: { abs($0.tidalPerKg - 6) <= 1 })
                .hinting { c in
                    "体重 \(Int(c.pbw)) kg なので目標は \(LessonLibrary.mlkg(c.pbw, 6)) mL 前後です。"
                }
                .spotting(["key:pinsp"]).watching(["Vte", "PIP", "Pplat"]),
            .talk(.doctor, "では、この子の肺がもっと硬くなったとき。どちらが危ないでしょうか。"),
            .quiz("PC で換気中、無気肺が広がって肺が硬くなりました。何が起きますか。",
                  ["気道内圧が上がる",
                   "一回換気量が減る",
                   "呼吸回数が上がる",
                   "何も変わらない"], answer: 1,
                  why: "圧は設定どおりなので、そのかわり入る量が減ります。PC は「静かに換気量が減っていく」のが危険な形で、Vte と MV のアラームが命綱になります。"),
            .quiz("同じことが VC で起きたら何が起きますか。",
                  ["気道内圧が上がる",
                   "一回換気量が減る",
                   "呼吸回数が上がる",
                   "何も変わらない"], answer: 0,
                  why: "量は守られ、そのぶん圧が上がります。上限圧に当たると吸気が途中で切られ、結局は換気量も落ちます。")
        ])

    static let lesson3_2 = Lesson(
        id: "3-2", title: "患者が自分で吸うとき ─ トリガ", minutes: 6, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 18; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.triggerFlow = 1.0; s.inspiratoryPause = 0.3
        },
        sedation: 0.85,
        brief: [
            "トリガ感度は「これだけ流れたら吸ったと見なす」しきい値。数字が小さいほど敏感。",
            "小児ほど吸気の流れが小さいので敏感にする。学童 0.5〜2、乳児 0.3〜1、新生児 0.2 L/分。",
            "鈍い＝ミストリガ（吸っても空気が来ず苦しい）。敏感すぎ・リーク＝オートトリガ。"
        ],
        points: ["トリガ感度は「吸ったと見なす」しきい値。小児ほど敏感に",
                 "鈍い＝ミストリガ（子どもが苦しい）",
                 "敏感すぎ・リーク＝オートトリガ"],
        tasks: [
            .talk(.scene, "ハルト君の麻酔が覚めてきた。胸が、機械より先に動きはじめている。"),
            .talk(.doctor, "ここから患者が呼吸に参加します。その「吸いたい」を機械がどう受け取るかが、トリガです。"),
            .step("「鎮静」を 20% まで下げて確定してください。",
                  hint: "鎮静はシミュレーター側の操作なので、キーの色が違います。",
                  why: "呼吸中枢が働きはじめます。",
                  check: { $0.engine.sedation <= 0.22 })
                .spotting(["key:sed"]).watching(["RR tot"]),
            .step("自発呼吸が 4 回/分 以上になるまで待ちます。",
                  hint: "「× 10」で早送りできます。",
                  why: "A/C なので、患者が吸うたびに設定どおりの換気が 1 回送られます。",
                  check: { $0.measured.respiratoryRateSpontaneous >= 4 })
                .spotting(["val:RR tot"]).watching(["RR tot"]),
            .talk(.puku, "感度を鈍くしたら、どうなるの？"),
            .talk(.doctor, "やってみましょう。数字ではなく、圧波形に出ます。"),
            .step("トリガ感度を 5 L/分 にして確定し、圧波形を 25 秒見てください。", hold: 25,
                  why: "立ち上がりの前に、小さな下向きの切れ込みが出ています。この児は吸っているのに、機械が応えていません。",
                  check: { $0.settings.triggerFlow >= 4.5 })
                .spotting(["key:trig", "wave"]).watching(["RR tot"]),
            .quiz("この状態の子どもは、どう感じていますか。",
                  ["楽になっている（呼吸の手間が減る）",
                   "吸っても空気が来ず、苦しい",
                   "何も感じない",
                   "過換気になる"], answer: 1,
                  why: "呼吸仕事量が増え、不穏の原因になります。「人工呼吸器と合わない」ときに鎮静を足す前に、トリガと auto-PEEP を疑うのが順序です。"),
            .talk(.patient, "（ハルト君が顔をしかめ、胸だけが大きく動いている）"),
            .talk(.doctor, "吸おうとしても機械が来ない。患者にとっていちばん苦しい設定です。戻しましょう。"),
            .step("トリガ感度を 1 L/分 に戻してください。",
                  why: "切れ込みが消え、この児の吸気に機械がついてくるようになりました。",
                  check: { $0.settings.triggerFlow <= 1.5 })
                .spotting(["key:trig"]).watching(["RR tot"]),
            .quiz("逆に敏感にしすぎたり、チューブ周囲のリークが大きいと何が起こりますか。",
                  ["何も起こらない",
                   "換気量が減る",
                   "患者が吸っていないのに送気される",
                   "呼気時間が伸びる"], answer: 2,
                  why: "オートトリガです。心拍の振動、回路の水の揺れ、小児ではリークを吸気と誤認します。リークが原因のときは、感度をいじるよりチューブのサイズや位置を見直すのが本筋です。")
        ])

    static let lesson3_3 = Lesson(
        id: "3-3", title: "SIMV と PSV ─ 手伝い方を選ぶ", minutes: 6, scenarioID: "postop",
        prepare: { s in
            s.mode = .volumeAssistControl
            s.tidalVolume = 180; s.respiratoryRate = 16; s.peep = 5; s.fio2 = 0.4
            s.inspiratoryFlow = 24; s.pressureSupport = 10; s.inspiratoryPause = 0.3
        },
        sedation: 0.2,
        brief: [
            "A/C ＝ 患者が吸ってもタイマーで来ても、送られるのは必ず同じ完全な 1 回換気。",
            "SIMV ＝ 決めた回数だけ強制換気、その合間の自発呼吸は PS で少し手伝う。",
            "PSV ＝ 強制換気なし。始めるのも止めるのも患者。離脱の評価に向くが、止まれば何も起きない。"
        ],
        points: ["A/C は全部が完全な換気",
                 "SIMV は決めた回数だけ強制、残りは自発",
                 "PSV は始めるのも止めるのも患者"],
        tasks: [
            .talk(.doctor, "手伝い方には段階があります。全部やるか、足りない分だけ足すか、本人にまかせるか。"),
            .key("上のタブで「SIMV」に切り替えてください。", event: .modeSIMV,
                 why: "強制換気は設定 RR の回数だけになり、その合間の自発呼吸は PS で手伝われます。")
                .spotting(["mode:SIMV+PS"]),
            .step("30 秒待って、実測の呼吸回数と自発の回数を見比べてください。", hold: 30,
                  check: { _ in true })
                .explaining { c in
                    String(format: "実測 %.0f 回/分、うち自発 %.0f 回/分。差の分だけ患者が自分で呼吸しています。",
                           c.measured.respiratoryRateTotal, c.measured.respiratoryRateSpontaneous)
                }
                .spotting(["val:RR tot"]).watching(["RR tot", "Vte", "MV"]),
            .quiz("SIMV で設定 RR 10、実測 RR 18 でした。差の 8 回は何ですか。",
                  ["機械の誤作動",
                   "患者自身の自発呼吸",
                   "オートトリガ",
                   "無呼吸バックアップ"], answer: 1,
                  why: "患者の自発呼吸です。2 種類の呼吸が混ざるので、波形も大きい山と小さい山が交互に出ます。"),
            .talk(.puku, "SIMV と PSV って、どう違うの？"),
            .talk(.doctor, "SIMV は決めた回数だけ必ず送ります。PSV は 1 回も送りません。押せば分かります。"),
            .key("今度は「PSV」に切り替えてください。", event: .modePSV,
                 why: "強制換気がなくなりました。すべての呼吸を患者が始めています。")
                .spotting(["mode:PSV"]),
            .step("PS を調整して Vte を 6〜8 mL/kg に入れ、20 秒保ってください。", hold: 20,
                  why: "PS は「その子が楽に目標の換気量を出せる最小の圧」で決めます。小児はチューブが細いぶん、同じ「ほとんど手伝わない」でも乳児 PS 8、学童 PS 5 と差がつきます。",
                  check: { $0.tidalPerKg >= 5.5 && $0.tidalPerKg <= 8.5 })
                .hinting { c in
                    "体重 \(Int(c.pbw)) kg なので目標は \(LessonLibrary.mlkg(c.pbw, 6))〜\(LessonLibrary.mlkg(c.pbw, 8)) mL です。"
                }
                .spotting(["key:ps"]).watching(["Vte", "RR tot"]),
            .talk(.doctor, "では、その「1 回も送らない」の怖いところを。"),
            .quiz("PSV 中に患者が鎮静で呼吸を止めたらどうなりますか。",
                  ["設定 RR で換気が続く",
                   "何も起こらず、無呼吸アラームとバックアップ換気が作動する",
                   "自動的に A/C に切り替わって終わり",
                   "PS が自動で上がる"], answer: 1,
                  why: "PSV には自前の換気回数がありません。深い鎮静や意識障害の患者には使えず、使うなら無呼吸バックアップの設定を必ず確認します（新生児 10 秒、乳児 15 秒が目安）。")
        ])
}
