// このファイルは web/tools/story-swift.js が web/story.js から書き出したもの。手で直さないこと。
// 台本を直すときは story.js を直し、node web/tools/story-swift.js > このファイル で書き出し直す。

extension StoryLibrary {
    public static let scenes: [StoryScene] = [
        StoryScene(id: "prologue", kind: "prologue", chapter: nil,
                   title: "プロローグ　はじめての小児科",
                   card: StoryCard(kicker: "プロローグ", title: "はじめての小児科", sub: "ローテーション初日　朝 8 時"),
                   bg: "corridor", time: "day", end: nil, lines: [
            StoryLine(.scene, "初期研修の小児科ローテーション、初日。朝の病棟は、思っていたよりずっと静かだった。"),
            StoryLine(.scene, "廊下の突き当たりに「PICU・NICU」の自動ドア。中から、規則正しい機械の音が聞こえてくる。"),
            StoryLine(.doc, "おはようございます。今日から小児科を回る研修医の先生ですね。", mood: "happy"),
            StoryLine(.doc, "小児科と小児集中治療を担当している、いぶきです。このローテのあいだ、あなたの指導医になります。"),
            StoryLine(.doc, "まず、呼び方を決めさせてください。お名前は？", asksName: true),
            StoryLine(.doc, "{名前}先生。よろしくお願いします。", mood: "happy"),
            StoryLine(.me, "よろしくお願いします。…正直、子どもの呼吸器はまったく触ったことがなくて。"),
            StoryLine(.doc, "最初はみんなそうです。「大人の呼吸器を小さくしたもの」と思っていると、転びます。"),
            StoryLine(.scene, "いぶき先生の白衣のポケットから、白くて丸いものが、ふわりと浮かび上がった。"),
            StoryLine(.puku, "ねえねえ、この人が新しい先生？", mood: "excited"),
            StoryLine(.doc, "ぷくぷくです。ここの子たちの「息」から生まれた…ということに、なっています。", mood: "happy"),
            StoryLine(.puku, "ぼく、分からないことがあったら「なんで？」って聞く係なんだ。先生の代わりに聞いてあげる！", mood: "happy"),
            StoryLine(.doc, "{名前}先生、緊張していますか？", mood: "think", choices: [
                StoryChoice(label: "正直、かなり", reply: "いい緊張です。ここでは、こわいと思える人のほうが子どもを守れます。"),
                StoryChoice(label: "楽しみです", reply: "頼もしい。その気持ちのまま、手順だけは守りましょう。")
            ]),
            StoryLine(.scene, "自動ドアが開く。モニターの音、輸液ポンプの音、呼吸器の送気の音。ベッドの並ぶ PICU と、保育器の並ぶ NICU。", bg: "picu"),
            StoryLine(.doc, "ここの子たちは、体重 1 kg から 35 kg まで。呼吸を機械に預けている子もいます。"),
            StoryLine(.scene, "保育器の中で、在胎 28 週で生まれた赤ちゃんが、手のひらほどの胸を小さく上下させている。", bg: "nicu"),
            StoryLine(.puku, "ちっちゃい…。この子にも、同じ機械を使うの？", mood: "sad"),
            StoryLine(.doc, "同じ考え方で、ずっと細かく。この子に 1 回で送る空気は、小さじ 1 杯ほどです。"),
            StoryLine(.scene, "奥のベッドには、インフルエンザ肺炎で両肺が真っ白になった 3 歳の女の子。呼吸器につながって 2 日目だ。", bg: "picu"),
            StoryLine(.scene, "隣には、RSV で入院した生後 4 か月の男の子。鼻のカニュラから高流量の酸素を受け、速い息をしている。"),
            StoryLine(.scene, "窓際の 7 歳の女の子は、ギラン・バレー症候群。呼吸の筋肉まで力が抜け、呼吸器につながって 2 週間になる。"),
            StoryLine(.doc, "覚えることは多いけれど、根っこは 1 つ。この機械が何を保証して、何をこの子に預けているか。"),
            StoryLine(.nurse, "いぶき先生、救急外来から電話です。"),
            StoryLine(.doc, "…はい。…分かりました。ベッドを空けて待っています。", mood: "think"),
            StoryLine(.doc, "8 歳の男の子。虫垂炎が破れて、お腹じゅうに膿が広がっています。血圧が保てない、ショックです。"),
            StoryLine(.doc, "昼から緊急手術。終わったら、挿管のままここへ来ます。ハルト君です。"),
            StoryLine(.puku, "手術が終わっても、チューブは抜かないの？", mood: "sad"),
            StoryLine(.doc, "ショックのあいだは、息をする仕事まで体にさせたくない。循環が落ち着くまで、呼吸は機械に預けます。"),
            StoryLine(.doc, "{名前}先生、今夜は一緒に残ってください。あなたの最初の受け持ちです。"),
            StoryLine(.puku, "いきなり!? だ、だいじょうぶかな…", mood: "alert"),
            StoryLine(.doc, "だいじょうぶ。わたしが隣にいます。まずは、機械の言葉を読めるようになりましょう。", mood: "happy")
        ]),
        StoryScene(id: "ch1-open", kind: "open", chapter: "ch1",
                   title: "第1章　扉　初日の夜",
                   card: StoryCard(kicker: "第1章", title: "機械を読む", sub: "初日の夜　PICU"),
                   bg: "night", time: "night", end: nil, lines: [
            StoryLine(.scene, "午後 8 時。手術室から、ハルト君のベッドが運ばれてきた。麻酔科医が、手際よく呼吸器につなぎ替えていく。"),
            StoryLine(.nurse, "呼吸器、つながりました。ノルアドレナリンは 0.1 で続いています。設定は麻酔科の先生が入れてくれています。"),
            StoryLine(.puku, "画面に線と数字がいっぱい…。どこから見ればいいの？", mood: "sad"),
            StoryLine(.doc, "全部を一度に見なくていい。{名前}先生、今夜は「読む」ことだけに集中しましょう。")
        ]),
        StoryScene(id: "ch1-close", kind: "close", chapter: "ch1",
                   title: "第1章　幕　午前 0 時",
                   card: nil,
                   bg: "station", time: "night", end: nil, lines: [
            StoryLine(.scene, "午前 0 時。ハルト君の数字は落ち着いている。ナースステーションには、モニターの音だけが続いている。"),
            StoryLine(.doc, "今夜、{名前}先生は 3 つ覚えました。波形の読み方。圧が 2 つあること。肺の柔らかさと、気道の通りにくさ。", mood: "happy"),
            StoryLine(.me, "読めるようにはなりました。でも、どう設定すればいいのかは、まだ…。"),
            StoryLine(.doc, "それは明日。朝の回診で、ハルト君の設定を一から見直します。"),
            StoryLine(.puku, "（あくびをして）ぷく…。明日も、ぼくついていくね。", mood: "happy")
        ]),
        StoryScene(id: "ch2-open", kind: "open", chapter: "ch2",
                   title: "第2章　扉　2 日目の朝",
                   card: StoryCard(kicker: "第2章", title: "挿管直後の初期設定", sub: "2 日目の朝　回診"),
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "翌朝 8 時。ハルト君の昇圧薬は、夜のうちに半分まで減った。回診の前に、夜勤の看護師から申し送りを受ける。"),
            StoryLine(.nurse, "夜中に何度か換気量のアラームが鳴って、当直の先生が一回換気量を上げていきました。"),
            StoryLine(.doc, "鳴ったから上げる。いちばん多い落とし穴です。{名前}先生、今日は設定を「決める」側に回ってもらいます。", mood: "think"),
            StoryLine(.puku, "決めるって、何から？"),
            StoryLine(.doc, "量、回数、酸素。順番に。全部、目の前の子の体重から始まります。")
        ]),
        StoryScene(id: "ch2-close", kind: "close", chapter: "ch2",
                   title: "第2章　幕　昼すぎ",
                   card: nil,
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "昼すぎ。ハルト君の指示票に、{名前}先生の字で書いた設定が並んでいる。"),
            StoryLine(.doc, "体重から量を、量から回数を。酸素は下げられるだけ下げる。いい初期設定です。", mood: "happy"),
            StoryLine(.me, "設定の 1 つ 1 つに、こんなに理由があるんですね。"),
            StoryLine(.nurse, "いぶき先生、3 番ベッドのミオちゃん、また酸素化が悪くなってきています。"),
            StoryLine(.doc, "行きましょう。同じ理屈が、硬い肺ではまったく違う顔を見せます。", mood: "alert")
        ]),
        StoryScene(id: "ch3-open", kind: "open", chapter: "ch3",
                   title: "第3章　扉　3 番ベッド",
                   card: StoryCard(kicker: "第3章", title: "モードの違い", sub: "2 日目の午後　PICU 3 番ベッド"),
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "インフルエンザ肺炎から ARDS になったミオちゃん（3歳）。お母さんが、ベッドの横で小さな手を握っている。"),
            StoryLine(.fam, "先生、この子、ずっとこのままなんでしょうか…。", name: "ミオちゃんのお母さん"),
            StoryLine(.doc, "肺を休ませながら、治るのを待っているところです。いまは、その待ち方をいちばん安全にします。"),
            StoryLine(.puku, "待ち方？"),
            StoryLine(.doc, "機械に何を任せて、何をこの子に預けるか。それを選ぶのが「モード」です。")
        ]),
        StoryScene(id: "ch3-close", kind: "close", chapter: "ch3",
                   title: "第3章　幕　夕方",
                   card: nil,
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "夕方。ハルト君はうとうとしながら、自分のペースで息をしている。"),
            StoryLine(.pt, "（チューブがあって話せない。かわりに指で、小さな OK をつくってみせる）", name: "ハルト君", caseID: "postop"),
            StoryLine(.puku, "いま、ハルト君が OK って！", mood: "excited"),
            StoryLine(.doc, "自分で息をする力が戻ってきた証拠です。{名前}先生、手伝い方を選べるようになりましたね。", mood: "happy"),
            StoryLine(.puku, "じゃあ、もうチューブ抜けるね！", mood: "excited"),
            StoryLine(.doc, "まだです。昇圧薬が少し残っていて、お腹も張っています。明日の朝の数字を見てから決めましょう。"),
            StoryLine(.doc, "明日は、機械の外から答え合わせをします。血液ガスです。")
        ]),
        StoryScene(id: "ch4-open", kind: "open", chapter: "ch4",
                   title: "第4章　扉　3 日目の朝",
                   card: StoryCard(kicker: "第4章", title: "血液ガスを読む", sub: "3 日目の朝　回診前"),
                   bg: "station", time: "day", end: nil, lines: [
            StoryLine(.scene, "3 日目の朝。回診の前に、ナースステーションに夜のあいだの採血の結果が並んでいる。"),
            StoryLine(.me, "数字が多すぎて、どれから見ればいいのか…。"),
            StoryLine(.doc, "呼吸器の画面は「送ったもの」。血液ガスは「体に届いたもの」。両方を見て、はじめて答え合わせになります。"),
            StoryLine(.puku, "答え合わせ、ぼく得意！ …たぶん。", mood: "happy")
        ]),
        StoryScene(id: "ch4-close", kind: "close", chapter: "ch4",
                   title: "第4章　幕　夕方",
                   card: nil,
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "夕方。ミオちゃんの pH は低めのまま。それでも、肺にかかる圧は上限の下に収まった。"),
            StoryLine(.me, "CO₂ が高いままでいいのか、まだ少し怖いです。"),
            StoryLine(.doc, "その怖さは大事にしてください。許すのは、肺を守るという目的があるときだけです。"),
            StoryLine(.fam, "先生たち、今日は何度も見に来てくださったんですね。", name: "ミオちゃんのお母さん"),
            StoryLine(.doc, "今夜はわたしの当直です。{名前}先生も一緒に。鳴ってからの動き方を体に入れます。", mood: "think")
        ]),
        StoryScene(id: "ch5-open", kind: "open", chapter: "ch5",
                   title: "第5章　扉　2 回目の当直",
                   card: StoryCard(kicker: "第5章", title: "アラームとトラブル", sub: "3 日目の夜　当直"),
                   bg: "station", time: "night", end: nil, lines: [
            StoryLine(.scene, "2 回目の当直。ナースステーションで、ななみさんが {名前}先生に声をかけた。"),
            StoryLine(.nurse, "ハルト君、夕方に点滴の管が詰まって、左の鎖骨の下から入れ直しています。昇圧薬は、もう切れました。"),
            StoryLine(.nurse, "今夜は静かだといいですね。…って言うと、たいてい鳴るんですけど。"),
            StoryLine(.puku, "ぼく、アラームが鳴ると頭が真っ白になっちゃうんだ。", mood: "sad"),
            StoryLine(.doc, "だから順番を決めておきます。頭が真っ白になっても、手が先に動くように。")
        ]),
        StoryScene(id: "ch5-close", kind: "close", chapter: "ch5",
                   title: "第5章　幕　夜明け",
                   card: nil,
                   bg: "dawn", time: "day", end: nil, lines: [
            StoryLine(.scene, "夜明け。ハルト君の胸には細いドレーンが入り、モニターの音はまた高く澄んだ音に戻っている。"),
            StoryLine(.me, "手が震えていました。でも、酸素を上げるところまでは、考える前にできました。"),
            StoryLine(.doc, "それで十分です。今夜ハルト君を守ったのは、{名前}先生の最初の一手です。", mood: "happy"),
            StoryLine(.doc, "夕方の管の針が、肺の表面をかすめたのかもしれません。そこから、機械の圧で空気が漏れました。", mood: "think"),
            StoryLine(.puku, "ぼく、ずっとポケットの中で震えてた…。", mood: "sad"),
            StoryLine(.doc, "ここから先は、外す話です。つけるより、外すほうが難しい。")
        ]),
        StoryScene(id: "ch6-open", kind: "open", chapter: "ch6",
                   title: "第6章　扉　4 日目の朝",
                   card: StoryCard(kicker: "第6章", title: "離脱と抜管", sub: "4 日目の朝　PICU"),
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "翌朝。ハルト君の熱は下がり、お腹の張りも引いた。ドレーンからの空気漏れも止まっている。お母さんが面会に来ている。"),
            StoryLine(.fam, "先生、この管はいつ抜けるんでしょう。あの子、しゃべりたがっていて。", name: "ハルト君のお母さん"),
            StoryLine(.doc, "今日から、それを確かめていきます。{名前}先生、条件を一緒に見ましょう。"),
            StoryLine(.puku, "抜けたら、ハルト君とおしゃべりできる？", mood: "excited"),
            StoryLine(.doc, "できます。そのためにも、焦らないことです。", mood: "happy")
        ]),
        StoryScene(id: "ch6-close", kind: "close", chapter: "ch6",
                   title: "第6章　幕　抜管のあと",
                   card: nil,
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "抜管から 1 時間。ハルト君は酸素マスクをつけて、自分でしっかり咳をしている。"),
            StoryLine(.pt, "…せんせい。のど、いたい。", name: "ハルト君"),
            StoryLine(.puku, "しゃべった！", mood: "excited"),
            StoryLine(.fam, "ハルト…！ 先生、ほんとうにありがとうございました。", name: "ハルト君のお母さん"),
            StoryLine(.doc, "お礼は、こちらの先生に。最初の夜から、ずっとハルト君の担当でした。", mood: "happy"),
            StoryLine(.me, "ハルト君、よくがんばったね。")
        ]),
        StoryScene(id: "ch7-open", kind: "open", chapter: "ch7",
                   title: "第7章　扉　5 日目の朝",
                   card: StoryCard(kicker: "第7章", title: "細い気道", sub: "5 日目の朝　PICU 5 番ベッド"),
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "ハルト君が抜管された翌朝。空いたベッドに、朝の光が差している。"),
            StoryLine(.nurse, "{名前}先生、5 番ベッドのそうた君、夜のあいだに呼吸回数を 40 まで上げています。"),
            StoryLine(.doc, "そうた君は、今日から{名前}先生の受け持ちです。挿管した夜のこと、覚えていますか。", mood: "think"),
            StoryLine(.me, "はい。吐ききれずに、血圧が下がって…。"),
            StoryLine(.puku, "また回数が上がってる！", mood: "alert"),
            StoryLine(.doc, "あの夜と同じ落とし穴です。今度は、{名前}先生が組み直してください。")
        ]),
        StoryScene(id: "ch7-close", kind: "close", chapter: "ch7",
                   title: "第7章　幕　8 日目の昼前",
                   card: nil,
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "8 日目の昼前。そうた君は鼻のカニュラで、ゆっくりと息をしている。"),
            StoryLine(.scene, "お母さんが差し出した指を、小さな手がぎゅっと握った。"),
            StoryLine(.fam, "先生、この子、握り返してくれました…！", name: "そうた君のお母さん"),
            StoryLine(.doc, "回数より量、吐かせて待つ。{名前}先生の設定で、そうた君は乗りきりました。", mood: "happy"),
            StoryLine(.puku, "ぼく、吐く時間のこと、もう忘れないよ。", mood: "happy"),
            StoryLine(.doc, "ミオちゃんの回診に行きましょう。あの子も、良くなってきています。")
        ]),
        StoryScene(id: "ch8-open", kind: "open", chapter: "ch8",
                   title: "第8章　扉　3 番ベッド、ふたたび",
                   card: StoryCard(kicker: "第8章", title: "硬い肺をもう一度", sub: "8 日目の昼　PICU 3 番ベッド"),
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "3 番ベッドのミオちゃんは、呼吸器につながって 9 日目。酸素の量が減り、熱も下がりはじめた。"),
            StoryLine(.fam, "先生、昨日より顔色がいいって、看護師さんが。", name: "ミオちゃんのお母さん"),
            StoryLine(.doc, "はい。肺が少しずつ戻ってきています。ここからは、良くなるほうの話をしましょう。", mood: "happy"),
            StoryLine(.nurse, "では、床ずれ予防の体位変換をしますね。{名前}先生、チューブを見ていてください。"),
            StoryLine(.puku, "ぼくも見張ってる！", mood: "excited")
        ]),
        StoryScene(id: "ch8-close", kind: "close", chapter: "ch8",
                   title: "第8章　幕　12 日目の夕方",
                   card: nil,
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "12 日目の夕方。ミオちゃんは HFNC をつけたまま、お母さんの膝で絵本を見ている。"),
            StoryLine(.fam, "チューブが抜けた日は、心臓が止まるかと思いました。", name: "ミオちゃんのお母さん"),
            StoryLine(.doc, "わたしもです。でも、{名前}先生が設定を一から組み直してくれました。"),
            StoryLine(.me, "量、PEEP、酸素、回数。順番を覚えていたから、手が動きました。"),
            StoryLine(.doc, "それが「覚えた」ということです。来週から、{名前}先生は NICU に入ります。", mood: "happy"),
            StoryLine(.puku, "NICU って、あのちっちゃい子たちのところ？", mood: "excited")
        ]),
        StoryScene(id: "ch9-open", kind: "open", chapter: "ch9",
                   title: "第9章　扉　NICU の夜",
                   card: StoryCard(kicker: "第9章", title: "手のひらの肺", sub: "2 週目の夜　NICU"),
                   bg: "nicu", time: "night", end: nil, lines: [
            StoryLine(.scene, "2 週目。NICU の夜は、PICU よりさらに静かだ。保育器のファンの音だけが続いている。"),
            StoryLine(.nurse, "{名前}先生、産科から連絡です。在胎 28 週、もうすぐ生まれます。"),
            StoryLine(.doc, "ローテの初日に見た、保育器の子と同じ週数です。分娩室へ行きましょう。"),
            StoryLine(.puku, "28 週って、本当なら、まだお母さんのお腹の中にいる時期だよね…", mood: "sad"),
            StoryLine(.doc, "あと 3 か月、お腹の中で肺を育てるはずだった子です。その続きを、外で手伝います。")
        ]),
        StoryScene(id: "ch9-close", kind: "close", chapter: "ch9",
                   title: "第9章　幕　生まれて 4 日目",
                   card: nil,
                   bg: "nicu", time: "day", end: nil, lines: [
            StoryLine(.scene, "生まれて 4 日目。あおい君は nCPAP のまま、保育器の中で手足を伸ばしている。"),
            StoryLine(.fam, "小さすぎて、触ったら壊れてしまいそうで…。", name: "あおい君のお父さん"),
            StoryLine(.nurse, "大丈夫ですよ。手のひらで、そっと包んであげてください。"),
            StoryLine(.doc, "桁が変わっても、考え方は同じでした。{名前}先生、もう NICU の数字も読めますね。", mood: "happy"),
            StoryLine(.me, "小さじ 1 杯の空気が、こんなに重いとは思いませんでした。")
        ]),
        StoryScene(id: "ch10-open", kind: "open", chapter: "ch10",
                   title: "第10章　扉　救急外来からの電話",
                   card: StoryCard(kicker: "第10章", title: "吐けない息", sub: "3 週目の夕方　救急外来"),
                   bg: "station", time: "night", end: nil, lines: [
            StoryLine(.scene, "3 週目、PICU に戻って最初の当直。夕方、救急外来から電話が鳴った。"),
            StoryLine(.nurse, "11 歳の男の子、喘息の発作です。吸入が効かなくて、いま挿管しています！"),
            StoryLine(.doc, "{名前}先生、行きましょう。喘息の子の呼吸器は、ほかのどの子とも違います。", mood: "alert"),
            StoryLine(.puku, "違うって、どこが？", mood: "alert"),
            StoryLine(.doc, "吸わせることより、吐かせることがすべて。今夜は、それだけ覚えてください。")
        ]),
        StoryScene(id: "ch10-close", kind: "close", chapter: "ch10",
                   title: "第10章　幕　病棟へ移る日",
                   card: nil,
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "抜管の翌日。レン君は一般病棟へ移る前に、吸入器の使い方をもう一度教わっている。"),
            StoryLine(.pt, "…ちゃんと毎日やります。あんなに苦しいのは、もう嫌だ。", name: "レン君", caseID: "asthma"),
            StoryLine(.doc, "吸入ステロイドは、発作のない日のための薬です。続けた日の分だけ、発作が遠くなります。"),
            StoryLine(.me, "呼吸器を外すまでが治療じゃないんですね。"),
            StoryLine(.doc, "そうです。次の発作を起こさないところまでが、わたしたちの仕事です。", mood: "happy")
        ]),
        StoryScene(id: "ch11-open", kind: "open", chapter: "ch11",
                   title: "第11章　扉　窓際のベッド",
                   card: StoryCard(kicker: "第11章", title: "力を取り戻す", sub: "3 週目　PICU 窓際のベッド"),
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "窓際のベッドのあかりちゃん。挿管から 4 週間。初日より、指先がよく動くようになった。"),
            StoryLine(.pt, "（文字盤を指でたどる。「いつ、しゃべれる？」）", name: "あかりちゃん", caseID: "gbs"),
            StoryLine(.puku, "この前の SBT、18 分でだめだったんだよね…", mood: "sad"),
            StoryLine(.doc, "あの日から、毎日少しずつ練習してきました。{名前}先生、仕上げを一緒にやりましょう。"),
            StoryLine(.me, "あかりちゃん、もうすぐだよ。")
        ]),
        StoryScene(id: "ch11-close", kind: "close", chapter: "ch11",
                   title: "第11章　幕　4 週間ぶりの声",
                   card: nil,
                   bg: "picu", time: "day", end: nil, lines: [
            StoryLine(.scene, "抜管の翌日。あかりちゃんは NPPV のマスクを外して、窓の外を見ている。"),
            StoryLine(.pt, "…せんせい。こえ、でた。", name: "あかりちゃん", caseID: "gbs"),
            StoryLine(.puku, "しゃべった！ 4 週間ぶりだよ！", mood: "excited"),
            StoryLine(.fam, "先生方、本当に、本当にありがとうございました。", name: "あかりちゃんのお母さん"),
            StoryLine(.doc, "{名前}先生。ローテが終わるまで、あと 1 週間です。", mood: "happy")
        ]),
        StoryScene(id: "epilogue", kind: "epilogue", chapter: nil,
                   title: "エピローグ　ローテーション最終日",
                   card: StoryCard(kicker: "エピローグ", title: "ローテーション最終日", sub: "夕方　PICU"),
                   bg: "dawn", time: "day", end: StoryEnd(label: "症例で練習する", action: "cases", say: "おつかれさまでした。6 人の子どもたちを、今度はひとりで受け持ってみましょう。"), lines: [
            StoryLine(.scene, "4 週間のローテーション、最終日。夕方の PICU で、また新しい入院の電話が鳴っている。"),
            StoryLine(.scene, "ベッドの顔ぶれは入れ替わった。ミオちゃんは一般病棟へ移り、そうた君はとうに家へ帰った。"),
            StoryLine(.scene, "あかりちゃんはリハビリで車いすに乗れるようになり、レン君は吸入を続けると約束して退院した。"),
            StoryLine(.scene, "NICU のあおい君は 1,400 g を超えた。退院したハルト君からは、手紙が届いている。"),
            StoryLine(.doc, "{名前}先生。初日に、子どもの呼吸器は触ったことがないと言っていましたね。"),
            StoryLine(.me, "…はい。いまも、全部分かったとは思えません。"),
            StoryLine(.doc, "それでいいんです。分からないと思える人は、確かめに戻ってこられます。", mood: "happy"),
            StoryLine(.puku, "{名前}先生、ぼくのこと、忘れないでね。", mood: "sad"),
            StoryLine(.doc, "忘れませんよ。呼吸器の前に立つたびに、「なんで？」と聞く声がするはずです。", mood: "happy"),
            StoryLine(.doc, "最後に、ひとりで受け持ってみてください。症例は 6 人。わたしは、呼ばれたら行きます。")
        ])
    ]
}
