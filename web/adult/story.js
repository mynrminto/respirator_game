/* VentSim 成人版 — ゲーム全体を貫く物語（小児版 ../story.js と同じ形・同じ API）。
 * 主人公は、初期研修で大学病院の ICU（集中治療部）を 1 か月回る研修医（プレイヤー）。
 * いぶき先生は集中治療科の指導医、ぷくぷくは「息」から生まれた精で、主人公の代わりに「なんで？」と聞く。
 * 縦糸は、ローテ初日の夜に受け持つ腹膜炎術後の佐藤さん（68歳）が 4 日目に抜管するまで（第1〜6章）。
 * 第7〜11章はローテの 2〜4 週目で、ほかの 5 人を 1 人ずつ、設定から抜管まで受け持つ。
 *
 * レッスンの中の会話（lessons.js の talk）とは別に、ここには「幕」を置く。
 *   prologue   … いちばん最初にコースへ入るとき（名前を決める）
 *   chN-open   … その章のレッスンを初めて始めるとき（章の扉）
 *   chN-close  … その章の最後のレッスンを初めて終えたとき
 *   epilogue   … 最後の章（第11章）の幕のあと
 * 幕ごとに time（'day' / 'night'）を持ち、BGM の昼の曲・夜の曲をこれで選ぶ。
 * レッスンの最中は章の時刻（CHAPTER_TIME）で選ぶ。
 * 一度見た幕はメニューの「物語を読み返す」から何度でも読める。
 *
 * 行（line）の書き方
 *   { who, say }        who: 'scene'（ト書き）/ 'doc' / 'puku' / 'me'（主人公）/ 'nurse'（看護師）
 *                       / 'pt'（患者。case に症例 ID、name に呼び名）/ 'fam'（家族。name に呼び名）
 *   mood                … doc は normal / happy / think / alert、puku は happy / excited / sad / alert
 *   bg                  … この行から背景を替える（BG の名前）
 *   input: 'name'       … 主人公の名前を入れてもらう行
 *   choose: [{ label, reply }] … 主人公の返事を選ぶ。reply はいぶき先生の返し（1 行）
 * {名前} は主人公の名前に置き換える（fill）。数値の差し込みはここでは使わない。
 * ここはデータだけを持ち、描画は app.js（iPhone 版は StoryView.swift）が行う。
 */
(function (root) {
  'use strict';

  var DEFAULT_NAME = '春野';
  var NAME_MAX = 8;

  /* 名札。{名前} は主人公の名前、pt / fam は行の name を使う。 */
  var SPEAKER = { scene: '', doc: 'いぶき先生', puku: 'ぷくぷく', me: '{名前}', nurse: '看護師 ななみ' };

  /* 背景。左から順に、届いている画像を使う（新しい絵が届くまでは今ある絵で代える）。
   * キーは絵と iPhone 版に結びついているので小児版と同じ名前のまま使う。
   * 成人版では picu を ICU の昼のベッドサイドとして使い、nicu は使わない。 */
  var BG = {
    corridor: ['bg_story_corridor', 'bg_title_day'],
    picu: ['bg_title_day'],
    nicu: ['bg_story_nicu', 'bg_title_day'],
    night: ['bg_title_night'],
    station: ['bg_story_station', 'bg_title_night'],
    dawn: ['bg_story_dawn', 'bg_title_day']
  };

  /* レッスンの最中に流す曲。章の舞台の時刻：第1章は初日の夜、第5章は当直の夜、
   * 第9章は救急外来から入室する夜、第10章は当直の夜、ほかは日中。 */
  var CHAPTER_TIME = { ch1: 'night', ch2: 'day', ch3: 'day', ch4: 'day', ch5: 'night', ch6: 'day',
    ch7: 'day', ch8: 'day', ch9: 'night', ch10: 'night', ch11: 'day' };

  /* エピローグは最後の章の幕のあとに流す。 */
  var LAST_CHAPTER = 'ch11';

  var SCENES = [

    /* ===================== プロローグ ===================== */
    {
      id: 'prologue', kind: 'prologue', title: 'プロローグ　はじめての ICU',
      card: { kicker: 'プロローグ', title: 'はじめての ICU', sub: 'ローテーション初日　朝 8 時' },
      bg: 'corridor', time: 'day',
      lines: [
        { who: 'scene', say: '初期研修の集中治療部ローテーション、初日。大学病院の朝の廊下は、思っていたよりずっと静かだった。' },
        { who: 'scene', say: '廊下の突き当たりに「ICU」の自動ドア。中から、規則正しい機械の音が聞こえてくる。' },
        { who: 'doc', mood: 'happy', say: 'おはようございます。今日から ICU を回る研修医の先生ですね。' },
        { who: 'doc', say: '集中治療科の、いぶきです。この 1 か月、あなたの指導医になります。' },
        { who: 'doc', say: 'まず、呼び方を決めさせてください。お名前は？', input: 'name' },
        { who: 'doc', mood: 'happy', say: '{名前}先生。よろしくお願いします。' },
        { who: 'me', say: 'よろしくお願いします。…正直、呼吸器は麻酔科で少し触っただけで。' },
        { who: 'doc', say: '最初はみんなそうです。「手術室の設定のまま」と思っていると、転びます。' },
        { who: 'scene', say: 'いぶき先生の白衣のポケットから、白くて丸いものが、ふわりと浮かび上がった。' },
        { who: 'puku', mood: 'excited', say: 'ねえねえ、この人が新しい先生？' },
        { who: 'doc', mood: 'happy', say: 'ぷくぷくです。ここの患者さんたちの「息」から生まれた…ということに、なっています。', secret: 'born' },
        { who: 'puku', mood: 'happy', say: 'ぼく、分からないことがあったら「なんで？」って聞く係なんだ。先生の代わりに聞いてあげる！' },
        {
          who: 'doc', mood: 'think', say: '{名前}先生、緊張していますか？',
          choose: [
            { label: '正直、かなり', reply: 'いい緊張です。ここでは、こわいと思える人のほうが患者さんを守れます。' },
            { label: '楽しみです', reply: '頼もしい。その気持ちのまま、手順だけは守りましょう。' }
          ]
        },
        { who: 'scene', bg: 'picu', say: '自動ドアが開く。モニターの音、輸液ポンプの音、呼吸器の送気の音。ガラスで仕切られた個室が並んでいる。' },
        { who: 'doc', say: 'ここは 12 床。大きな手術のあとの人、重い肺炎の人。半分くらいの人が、呼吸を機械に預けています。' },
        { who: 'puku', say: 'みんな大人だね。じゃあ、設定もみんな同じ？' },
        { who: 'doc', say: '同じ機械で、人ごとに違う設定を。送る量を決めるのは、体重計ではなく身長です。' },
        { who: 'scene', say: '奥の個室には、インフルエンザ肺炎で両肺が真っ白になった 54 歳の女性。呼吸器につながって 2 日目だ。' },
        { who: 'scene', say: '隣では、COPD が悪化した 72 歳の男性が、NPPV のマスク越しに肩で息をしている。' },
        { who: 'scene', say: '窓際の 45 歳の男性は、ギラン・バレー症候群。呼吸の筋肉まで力が抜け、呼吸器につながって 2 週間になる。' },
        { who: 'doc', say: '覚えることは多いけれど、根っこは 1 つ。この機械が何を保証して、何を患者さんに預けているか。' },
        { who: 'nurse', say: 'いぶき先生、救急外来から電話です。' },
        { who: 'doc', mood: 'think', say: '…はい。…分かりました。ベッドを空けて待っています。' },
        { who: 'doc', say: '68 歳の男性。大腸に穴があいて、お腹じゅうに膿が広がっています。血圧が保てない、敗血症性ショックです。' },
        { who: 'doc', say: '昼から緊急手術。終わったら、挿管のままここへ来ます。佐藤さんです。' },
        { who: 'puku', mood: 'sad', say: '手術が終わっても、チューブは抜かないの？' },
        { who: 'doc', say: 'ショックのあいだは、息をする仕事まで体にさせたくない。循環が落ち着くまで、呼吸は機械に預けます。' },
        { who: 'doc', say: '{名前}先生、今夜は一緒に残ってください。あなたの最初の受け持ちです。' },
        { who: 'puku', mood: 'alert', say: 'いきなり!? だ、だいじょうぶかな…' },
        { who: 'doc', mood: 'happy', say: 'だいじょうぶ。わたしが隣にいます。まずは、機械の言葉を読めるようになりましょう。' }
      ]
    },

    /* ===================== 第1章 ===================== */
    {
      id: 'ch1-open', kind: 'open', chapter: 'ch1', title: '第1章　扉　初日の夜',
      card: { kicker: '第1章', title: '機械を読む', sub: '初日の夜　ICU' },
      bg: 'night', time: 'night',
      lines: [
        { who: 'scene', say: '午後 8 時。手術室から、佐藤さんのベッドが運ばれてきた。麻酔科医が、手際よく ICU の呼吸器につなぎ替えていく。' },
        { who: 'nurse', say: '呼吸器、つながりました。ノルアドレナリンは 0.1 で続いています。設定は麻酔科の先生が入れてくれています。' },
        { who: 'puku', mood: 'sad', say: '画面に線と数字がいっぱい…。どこから見ればいいの？' },
        { who: 'doc', say: '全部を一度に見なくていい。{名前}先生、今夜は「読む」ことだけに集中しましょう。' }
      ]
    },
    {
      id: 'ch1-close', kind: 'close', chapter: 'ch1', title: '第1章　幕　午前 0 時',
      bg: 'station', time: 'night',
      lines: [
        { who: 'scene', say: '午前 0 時。佐藤さんの数字は落ち着いている。ナースステーションには、モニターの音だけが続いている。' },
        { who: 'doc', mood: 'happy', say: '今夜、{名前}先生は 3 つ覚えました。波形の読み方。圧が 2 つあること。肺の柔らかさと、気道の通りにくさ。' },
        { who: 'me', say: '読めるようにはなりました。でも、どう設定すればいいのかは、まだ…。' },
        { who: 'doc', say: 'それは明日。朝の回診で、佐藤さんの設定を一から見直します。' },
        { who: 'puku', say: 'ねえ、「ベンチレーター」って、なんでそういう名前なの？' },
        { who: 'doc', say: 'ラテン語の ventus、「風」からです。呼吸器は、風を送る機械。', lore: 'wind' },
        { who: 'doc', say: '肺炎（pneumonia）の「ニューモ」は、ギリシャ語で「息をする」。同じ根から、息や風を表す pneuma も生まれました。' },
        { who: 'scene', say: '佐藤さんが、眠ったまま眉をしかめた。いぶき先生が、口の端のチューブ固定を少しゆるめる。' },
        { who: 'doc', mood: 'think', say: 'チューブが入っていると、のどの奥をずっと押されている感じがするんです。眠れる薬を、少しだけ足しましょう。' },
        { who: 'doc', say: '「チューブは、のどの奥をずっと押している。それを忘れるな」。わたしの先生の口ぐせでした。' },
        { who: 'puku', say: '…いぶき先生にも、先生がいたの？' },
        { who: 'doc', mood: 'happy', say: 'いましたよ。とてもこわくて、とてもやさしい人が。', secret: 'habit' },
        { who: 'puku', mood: 'happy', say: '（あくびをして）ぷく…。明日も、ぼくついていくね。' }
      ]
    },

    /* ===================== 第2章 ===================== */
    {
      id: 'ch2-open', kind: 'open', chapter: 'ch2', title: '第2章　扉　2 日目の朝',
      card: { kicker: '第2章', title: '挿管直後の初期設定', sub: '2 日目の朝　回診' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '翌朝 8 時。佐藤さんのノルアドレナリンは、夜のうちに半分まで減った。回診の前に、夜勤の看護師から申し送りを受ける。' },
        { who: 'nurse', say: '夜中に何度か換気量のアラームが鳴って、当直の先生が一回換気量を上げていきました。' },
        { who: 'doc', mood: 'think', say: '鳴ったから上げる。いちばん多い落とし穴です。{名前}先生、今日は設定を「決める」側に回ってもらいます。' },
        { who: 'puku', say: '決めるって、何から？' },
        { who: 'doc', say: '量、回数、酸素。順番に。全部、身長から出す「予測体重」から始まります。' }
      ]
    },
    {
      id: 'ch2-close', kind: 'close', chapter: 'ch2', title: '第2章　幕　昼すぎ',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '昼すぎ。佐藤さんの指示票に、{名前}先生の字で書いた設定が並んでいる。' },
        { who: 'doc', mood: 'happy', say: '予測体重から量を、量から回数を。酸素は下げられるだけ下げる。いい初期設定です。' },
        { who: 'me', say: '設定の 1 つ 1 つに、こんなに理由があるんですね。' },
        { who: 'puku', say: '人って、1 日に何回くらい息をするの？' },
        { who: 'doc', say: '大人で 1 日に 2 万回ほど。空気にすると 1 万リットル近くになります。その 1 回 1 回を、いま{名前}先生が決めたんです。', lore: 'count' },
        { who: 'nurse', say: 'いぶき先生、3 番ベッドの山本さん、また酸素化が悪くなってきています。' },
        { who: 'doc', mood: 'alert', say: '行きましょう。同じ理屈が、硬い肺ではまったく違う顔を見せます。' }
      ]
    },

    /* ===================== 第3章 ===================== */
    {
      id: 'ch3-open', kind: 'open', chapter: 'ch3', title: '第3章　扉　3 番ベッド',
      card: { kicker: '第3章', title: 'モードの違い', sub: '2 日目の午後　ICU 3 番ベッド' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: 'インフルエンザ肺炎から ARDS になった山本さん（54歳）。夫が、ベッドの横で手を握っている。' },
        { who: 'fam', name: '山本さんの夫', say: '先生、妻は、ずっとこのままなんでしょうか…。' },
        { who: 'doc', say: '肺を休ませながら、治るのを待っているところです。いまは、その待ち方をいちばん安全にします。' },
        { who: 'puku', say: '待ち方？' },
        { who: 'doc', say: '機械に何を任せて、何を患者さんに預けるか。それを選ぶのが「モード」です。' }
      ]
    },
    {
      id: 'ch3-close', kind: 'close', chapter: 'ch3', title: '第3章　幕　夕方',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '夕方。佐藤さんはうとうとしながら、自分のペースで息をしている。' },
        { who: 'pt', case: 'postop', name: '佐藤さん', say: '（チューブがあって話せない。かわりに小さくうなずいて、親指を立ててみせる）' },
        { who: 'puku', mood: 'excited', say: 'いま、佐藤さんがグッてした！' },
        { who: 'doc', mood: 'happy', say: '自分で息をする力が戻ってきた証拠です。{名前}先生、手伝い方を選べるようになりましたね。' },
        { who: 'puku', say: '吸うのは「インスピレーション」って言うんだよね。ひらめきと同じ言葉？' },
        { who: 'doc', mood: 'happy', say: '同じです。ラテン語の inspirare は「息を吹き込む」。昔の人は、ひらめきを神さまに息を吹き込まれることだと考えました。', lore: 'inspire' },
        { who: 'doc', say: 'spirit（魂）も、spiritus（息）から来ています。' },
        { who: 'puku', mood: 'excited', say: 'じゃあ、もうチューブ抜けるね！' },
        { who: 'doc', say: 'まだです。昇圧薬が少し残っていて、お腹も張っています。明日の朝の数字を見てから決めましょう。' },
        { who: 'doc', say: '明日は、機械の外から答え合わせをします。血液ガスです。' }
      ]
    },

    /* ===================== 第4章 ===================== */
    {
      id: 'ch4-open', kind: 'open', chapter: 'ch4', title: '第4章　扉　3 日目の朝',
      card: { kicker: '第4章', title: '血液ガスを読む', sub: '3 日目の朝　回診前' },
      bg: 'station', time: 'day',
      lines: [
        { who: 'scene', say: '3 日目の朝。回診の前に、ナースステーションに夜のあいだの採血の結果が並んでいる。' },
        { who: 'me', say: '数字が多すぎて、どれから見ればいいのか…。' },
        { who: 'doc', say: '呼吸器の画面は「送ったもの」。血液ガスは「体に届いたもの」。両方を見て、はじめて答え合わせになります。' },
        { who: 'puku', mood: 'happy', say: '答え合わせ、ぼく得意！ …たぶん。' }
      ]
    },
    {
      id: 'ch4-close', kind: 'close', chapter: 'ch4', title: '第4章　幕　夕方',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '夕方。山本さんの pH は低めのまま。それでも、肺にかかる圧は上限の下に収まった。' },
        { who: 'puku', say: '酸素って、だれが見つけたの？' },
        { who: 'doc', say: '1770 年代に、シェーレとプリーストリーがそれぞれ見つけました。名前をつけたのはラヴォアジエです。', lore: 'oxygen' },
        { who: 'doc', mood: 'happy', say: '酸のもとだと思って「酸をつくるもの」、oxygène と呼んだんです。少し勘違いが入った名前ですね。' },
        { who: 'me', say: 'CO₂ が高いままでいいのか、まだ少し怖いです。' },
        { who: 'doc', say: 'その怖さは大事にしてください。許すのは、肺を守るという目的があるときだけです。' },
        { who: 'fam', name: '山本さんの夫', say: '先生たち、今日は何度も見に来てくださったんですね。' },
        { who: 'doc', mood: 'think', say: '今夜はわたしの当直です。{名前}先生も一緒に。鳴ってからの動き方を体に入れます。' }
      ]
    },

    /* ===================== 第5章 ===================== */
    {
      id: 'ch5-open', kind: 'open', chapter: 'ch5', title: '第5章　扉　2 回目の当直',
      card: { kicker: '第5章', title: 'アラームとトラブル', sub: '3 日目の夜　当直' },
      bg: 'station', time: 'night',
      lines: [
        { who: 'scene', say: '2 回目の当直。ナースステーションで、ななみさんが {名前}先生に声をかけた。' },
        { who: 'nurse', say: '佐藤さん、夕方に中心静脈カテーテルが詰まって、左の鎖骨の下から入れ直しています。昇圧薬は、もう切れました。' },
        { who: 'nurse', say: '今夜は静かだといいですね。…って言うと、たいてい鳴るんですけど。' },
        { who: 'nurse', say: 'いぶき先生、さっきも窓際の伊藤さんのところにいましたね。先生って昔から、あのベッドだけは…' },
        { who: 'doc', mood: 'think', say: 'ななみさん、申し送りの続きをお願いします。', secret: 'window' },
        { who: 'puku', mood: 'sad', say: 'ぼく、アラームが鳴ると頭が真っ白になっちゃうんだ。' },
        { who: 'doc', say: 'だから順番を決めておきます。頭が真っ白になっても、手が先に動くように。' }
      ]
    },
    {
      id: 'ch5-close', kind: 'close', chapter: 'ch5', title: '第5章　幕　夜明け',
      bg: 'dawn', time: 'day',
      lines: [
        { who: 'scene', say: '夜明け。佐藤さんの胸には細いドレーンが入り、モニターの音はまた高く澄んだ音に戻っている。' },
        { who: 'me', say: '手が震えていました。でも、酸素を上げるところまでは、考える前にできました。' },
        { who: 'doc', mood: 'happy', say: 'それで十分です。今夜佐藤さんを守ったのは、{名前}先生の最初の一手です。' },
        { who: 'doc', mood: 'think', say: '夕方の穿刺の針が、肺の表面をかすめたのかもしれません。そこから、機械の圧で空気が漏れました。' },
        { who: 'puku', mood: 'sad', say: 'ぼく、ずっとポケットの中で震えてた…。' },
        { who: 'doc', mood: 'happy', say: '「息災」という言葉があります。もとは仏教の言葉で、災いを「息める（やめる）」こと。', lore: 'sokusai' },
        { who: 'doc', say: '息には「休む・止む」という意味もあるんです。休息の「息」ですね。' },
        { who: 'puku', mood: 'happy', say: 'じゃあ、今夜はみんな息災だった！' },
        { who: 'doc', say: 'ここから先は、外す話です。つけるより、外すほうが難しい。' }
      ]
    },

    /* ===================== 第6章 ===================== */
    {
      id: 'ch6-open', kind: 'open', chapter: 'ch6', title: '第6章　扉　4 日目の朝',
      card: { kicker: '第6章', title: '離脱と抜管', sub: '4 日目の朝　ICU' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '翌朝。佐藤さんの熱は下がり、お腹の張りも引いた。ドレーンからの空気漏れも止まっている。奥さんが面会に来ている。' },
        { who: 'fam', name: '佐藤さんの奥さん', say: '先生、この管はいつ抜けるんでしょう。主人、何か言いたそうにしていて。' },
        { who: 'doc', say: '今日から、それを確かめていきます。{名前}先生、条件を一緒に見ましょう。' },
        { who: 'puku', mood: 'excited', say: '抜けたら、佐藤さんとおしゃべりできる？' },
        { who: 'doc', mood: 'happy', say: 'できます。そのためにも、焦らないことです。' }
      ]
    },
    {
      id: 'ch6-close', kind: 'close', chapter: 'ch6', title: '第6章　幕　抜管のあと',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '抜管から 1 時間。佐藤さんは酸素マスクをつけて、自分でしっかり咳をしている。' },
        { who: 'pt', case: 'postop', name: '佐藤さん', say: '…先生。のどが、ひりひりするよ。' },
        { who: 'puku', mood: 'excited', say: 'しゃべった！' },
        { who: 'fam', name: '佐藤さんの奥さん', say: 'あなた…！ 先生、ほんとうにありがとうございました。' },
        { who: 'doc', mood: 'happy', say: 'お礼は、こちらの先生に。最初の夜から、ずっと佐藤さんの担当でした。' },
        { who: 'me', say: '佐藤さん、よくがんばりましたね。' },
        { who: 'doc', say: '「抜いたあとの最初の水は、びっくりするくらいうまい」。わたしの先生が、いつも言っていました。' },
        { who: 'puku', mood: 'alert', say: 'ねえ、先生の先生って、いまはどこにいるの？' },
        { who: 'doc', mood: 'happy', say: '…佐藤さん、ゆっくり、ひと口ずつですよ。', secret: 'where' },
        { who: 'puku', say: '死ぬことを「息を引き取る」って言うよね。英語だと？' },
        { who: 'doc', say: 'expire。ex-spirare、「息を吐き出す」です。日本語は最後に息を引き取り、英語は最後に吐き出す。', lore: 'expire' },
        { who: 'doc', mood: 'happy', say: 'そして今朝の佐藤さんは、どちらでもなく「息を吹き返した」んです。' }
      ]
    },

    /* ===================== 第7章 ===================== */
    {
      id: 'ch7-open', kind: 'open', chapter: 'ch7', title: '第7章　扉　5 日目の朝',
      card: { kicker: '第7章', title: '吐ききれない肺', sub: '5 日目の朝　ICU 5 番ベッド' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '佐藤さんが一般病棟へ移った朝。空いた個室に、朝の光が差している。' },
        { who: 'nurse', say: '{名前}先生、5 番ベッドの田中さん、夜のあいだに呼吸回数を 28 まで上げています。' },
        { who: 'doc', mood: 'think', say: '田中さんは、今日から{名前}先生の受け持ちです。挿管した夜のこと、覚えていますか。' },
        { who: 'me', say: 'はい。吐ききれずに、血圧が下がって…。' },
        { who: 'puku', mood: 'alert', say: 'また回数が上がってる！' },
        { who: 'doc', say: 'あの夜と同じ落とし穴です。今度は、{名前}先生が組み直してください。' }
      ]
    },
    {
      id: 'ch7-close', kind: 'close', chapter: 'ch7', title: '第7章　幕　8 日目の昼前',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '8 日目の昼前。田中さんは NPPV のマスクを外して、鼻のカニュラでゆっくりと息をしている。' },
        { who: 'pt', case: 'copd', name: '田中さん', say: '…先生、世話になったね。たばこは、もう 10 年吸ってないんだ。ほんとだよ。' },
        { who: 'fam', name: '田中さんの奥さん', say: 'この人、マスクの上からでも先生の名前を呼んでいたんですよ。' },
        { who: 'doc', mood: 'happy', say: '回数を落として、吐かせて待つ。CO₂ は普段の値まで。{名前}先生の設定で、田中さんは乗りきりました。' },
        { who: 'puku', mood: 'happy', say: 'ぼく、吐く時間のこと、もう忘れないよ。' },
        { who: 'doc', say: '「呼吸」という字を見てください。「呼」は吐く、「吸」は吸う。吐くほうが先に書いてあるんです。', lore: 'kokyu' },
        { who: 'doc', mood: 'happy', say: '吸うためには、まず吐ききること。田中さんの肺が教えてくれたとおりです。' },
        { who: 'doc', say: '山本さんの回診に行きましょう。あの人も、良くなってきています。' }
      ]
    },

    /* ===================== 第8章 ===================== */
    {
      id: 'ch8-open', kind: 'open', chapter: 'ch8', title: '第8章　扉　3 番ベッド、ふたたび',
      card: { kicker: '第8章', title: '硬い肺をもう一度', sub: '8 日目の昼　ICU 3 番ベッド' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '3 番ベッドの山本さんは、呼吸器につながって 9 日目。酸素の量が減り、熱も下がりはじめた。' },
        { who: 'fam', name: '山本さんの夫', say: '先生、昨日より顔色がいいって、看護師さんが。' },
        { who: 'doc', mood: 'happy', say: 'はい。肺が少しずつ戻ってきています。ここからは、良くなるほうの話をしましょう。' },
        { who: 'nurse', say: 'では、床ずれ予防の体位変換をしますね。{名前}先生、チューブを見ていてください。' },
        { who: 'puku', mood: 'excited', say: 'ぼくも見張ってる！' }
      ]
    },
    {
      id: 'ch8-close', kind: 'close', chapter: 'ch8', title: '第8章　幕　12 日目の夕方',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '12 日目の夕方。山本さんは高流量鼻カニュラをつけたまま、ベッドを起こして娘さんの写真を見ている。' },
        { who: 'fam', name: '山本さんの夫', say: 'チューブが抜けた日は、心臓が止まるかと思いました。' },
        { who: 'doc', say: 'わたしもです。でも、{名前}先生が設定を一から組み直してくれました。' },
        { who: 'me', say: '量、PEEP、酸素、回数。順番を覚えていたから、手が動きました。' },
        { who: 'puku', say: 'ICU って、いつからあるの？' },
        { who: 'doc', say: '1952 年のコペンハーゲン。ポリオの大流行で、息のできない人が病院にあふれました。', lore: 'copenhagen' },
        { who: 'doc', say: '麻酔科医イプセンの考えで気管を切開し、医学生たちが交代で、何週間も手で袋を押し続けたんです。' },
        { who: 'doc', mood: 'happy', say: 'それで死亡率が大きく下がった。ICU のはじまりです。' },
        { who: 'doc', mood: 'happy', say: 'それが「覚えた」ということです。{名前}先生、今夜の当直、よろしくお願いしますね。' },
        { who: 'puku', mood: 'excited', say: '夜って、救急外来から急に来る人もいるんだよね？' }
      ]
    },

    /* ===================== 第9章 ===================== */
    {
      id: 'ch9-open', kind: 'open', chapter: 'ch9', title: '第9章　扉　救急外来からの夜',
      card: { kicker: '第9章', title: '水に溺れる肺', sub: '2 週目の夜　救急外来' },
      bg: 'night', time: 'night',
      lines: [
        { who: 'scene', say: '2 週目の当直。午前 1 時、救急外来から電話が鳴った。' },
        { who: 'nurse', say: '78 歳の女性、急性心不全です。NPPV のマスクを外してしまって、いま挿管しています！' },
        { who: 'doc', mood: 'alert', say: 'ピンク色の泡の痰。肺が水であふれています。{名前}先生、ベッドを準備しましょう。' },
        { who: 'puku', mood: 'sad', say: '肺に水…。おぼれてるのと同じなの？' },
        { who: 'doc', say: '息の通り道の奥が、水で埋まっています。PEEP で押し戻しながら、心臓を楽にしてあげます。' }
      ]
    },
    {
      id: 'ch9-close', kind: 'close', chapter: 'ch9', title: '第9章　幕　抜管の翌朝',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '抜管の翌朝。鈴木さんは NPPV を外して、鼻のカニュラで朝ごはんを待っている。' },
        { who: 'pt', case: 'chf', name: '鈴木さん', say: 'あのマスク、ほんとうに嫌でねえ。でも、外したら息が楽で。' },
        { who: 'fam', name: '鈴木さんの娘さん', say: '母がマスクを嫌がるの、昔からなんです。今回はよく我慢してくれました。' },
        { who: 'doc', mood: 'happy', say: '陽圧を外すと、心臓の仕事は急に増えます。NPPV はその橋渡しでした。' },
        { who: 'me', say: '呼吸器の設定が、心臓の薬みたいに効くとは思いませんでした。' },
        { who: 'doc', say: '1543 年、解剖学者のヴェサリウスが書いています。動物の気管に葦の管を入れて息を吹き込むと、', lore: 'vesalius' },
        { who: 'doc', say: '胸が開いていても心臓が動き続けた、と。息を押し込むことが心臓を支える。いちばん古い陽圧換気の記録です。' }
      ]
    },

    /* ===================== 第10章 ===================== */
    {
      id: 'ch10-open', kind: 'open', chapter: 'ch10', title: '第10章　扉　当直の夜',
      card: { kicker: '第10章', title: '吐けない息', sub: '3 週目の夕方　救急外来' },
      bg: 'station', time: 'night',
      lines: [
        { who: 'scene', say: '3 週目の当直。夕方、救急外来から電話が鳴った。' },
        { who: 'nurse', say: '29 歳の女性、喘息の発作です。吸入も点滴も効かなくて、いま挿管しています！' },
        { who: 'doc', mood: 'alert', say: '{名前}先生、行きましょう。喘息の人の呼吸器は、ほかの誰とも違います。' },
        { who: 'puku', mood: 'alert', say: '違うって、どこが？' },
        { who: 'doc', say: '吸わせることより、吐かせることがすべて。今夜は、それだけ覚えてください。' }
      ]
    },
    {
      id: 'ch10-close', kind: 'close', chapter: 'ch10', title: '第10章　幕　病棟へ移る日',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '抜管の翌日。高橋さんは一般病棟へ移る前に、吸入器の使い方をもう一度教わっている。' },
        { who: 'pt', case: 'asthma', name: '高橋さん', say: '…調子がいいからって、吸入を自分でやめていたんです。もう、やめません。' },
        { who: 'doc', say: '吸入ステロイドは、発作のない日のための薬です。続けた日の分だけ、発作が遠くなります。' },
        { who: 'me', say: '呼吸器を外すまでが治療じゃないんですね。' },
        { who: 'puku', say: '「ぜんそく」って、英語だと asthma だよね。' },
        { who: 'doc', say: 'ギリシャ語で「あえぐ」「荒い息」という意味です。2000 年以上前から、人は吐けない苦しさに名前をつけてきました。', lore: 'asthma' },
        { who: 'doc', mood: 'happy', say: 'そうです。次の発作を起こさないところまでが、わたしたちの仕事です。' }
      ]
    },

    /* ===================== 第11章 ===================== */
    {
      id: 'ch11-open', kind: 'open', chapter: 'ch11', title: '第11章　扉　窓際のベッド',
      card: { kicker: '第11章', title: '力を取り戻す', sub: '3 週目　ICU 窓際のベッド' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '窓際のベッドの伊藤さん。挿管から 4 週間。初日より、手足がよく動くようになった。' },
        { who: 'pt', case: 'gbs', name: '伊藤さん', say: '（文字盤を指でたどる。「いつ、しゃべれる？」）' },
        { who: 'puku', mood: 'sad', say: 'この前の SBT、途中で息が浅く速くなって、だめだったんだよね…' },
        { who: 'scene', say: 'いぶき先生は伊藤さんの指先を見ながら、一文字ずつ、迷わずに読み上げていく。' },
        { who: 'puku', say: '…先生、文字盤を読むの、すごく速いね。' },
        { who: 'doc', say: '毎日、読んでいた人がいましたから。', secret: 'board' },
        { who: 'doc', say: 'あの日から、毎日少しずつ練習してきました。{名前}先生、仕上げを一緒にやりましょう。' },
        { who: 'me', say: '伊藤さん、もうすぐですよ。' }
      ]
    },
    {
      id: 'ch11-close', kind: 'close', chapter: 'ch11', title: '第11章　幕　4 週間ぶりの声',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '抜管の翌日。伊藤さんはベッドを起こして、窓の外を見ている。' },
        { who: 'pt', case: 'gbs', name: '伊藤さん', say: '…先生。声、出ました。' },
        { who: 'puku', mood: 'excited', say: 'しゃべった！ 4 週間ぶりだよ！' },
        { who: 'fam', name: '伊藤さんの奥さん', say: '先生方、本当に、本当にありがとうございました。' },
        { who: 'scene', bg: 'night', say: 'その夜。伊藤さんの寝息を確かめたあと、いぶき先生は窓際のいすに腰をおろした。' },
        { who: 'doc', mood: 'think', say: '{名前}先生、少しだけ昔の話をさせてください。' },
        { who: 'doc', say: 'わたしが研修医だったころ、ここの指導医は朝比奈先生でした。チューブの口ぐせも、先生のものです。' },
        { who: 'doc', say: 'その先生が、間質性肺炎の急な悪化で、このベッドに入りました。受け持ちは、わたしでした。' },
        { who: 'doc', say: '呼吸器につながっても、先生は文字盤で回診の指導を続けました。冬の終わりに、ここで亡くなりました。' },
        { who: 'doc', mood: 'think', say: '最後の息が抜けたとき、白くて丸いものがふわっと出てきて、わたしの手に乗ったんです。' },
        { who: 'puku', mood: 'sad', say: '…ぼく、朝比奈先生の最後の息だったんだ。患者さんたちの息からって、ごまかしてたんだね。' },
        { who: 'doc', mood: 'happy', say: 'ごまかしたわけじゃありません。先生の息が、いまもここの患者さんのそばにいる。そう思いたかったんです。', secret: 'reveal',
          choose: [
            { label: 'だから窓際のベッドを', reply: 'ええ。あそこに入る人を見ると、どうしても足が向いてしまうんです。' },
            { label: 'だから文字盤があんなに', reply: '最後の 2 週間、先生の言葉はぜんぶ文字盤からでした。読む側は、急がずに待つことです。' }
          ] },
        { who: 'puku', say: 'ねえ、伊藤さんの病気って、昔はどうやって息をさせてたの？' },
        { who: 'doc', say: '1928 年、ドリンカーたちが「鉄の肺」を作りました。体を鉄の箱に入れ、箱の中の空気を抜いて、外から胸をふくらませる。', lore: 'ironlung' },
        { who: 'doc', say: '息の筋肉が動かない人のための、最初の機械でした。' },
        { who: 'doc', mood: 'happy', say: '{名前}先生。ローテが終わるまで、あと 1 週間です。' }
      ]
    },

    /* ===================== エピローグ ===================== */
    {
      id: 'epilogue', kind: 'epilogue', title: 'エピローグ　ローテーション最終日',
      card: { kicker: 'エピローグ', title: 'ローテーション最終日', sub: '夕方　ICU' },
      bg: 'dawn', time: 'day',
      end: { label: '症例で練習する', action: 'cases', say: 'おつかれさまでした。6 人の患者さんを、今度はひとりで受け持ってみましょう。' },
      lines: [
        { who: 'scene', say: '1 か月のローテーション、最終日。夕方の ICU で、また新しい入室の電話が鳴っている。' },
        { who: 'scene', say: 'ベッドの顔ぶれは入れ替わった。山本さんは一般病棟へ移り、田中さんは在宅酸素を続けながら家に帰った。' },
        { who: 'scene', say: '伊藤さんはリハビリ病院へ移り、高橋さんは吸入を続けると約束して退院した。' },
        { who: 'scene', say: '鈴木さんは循環器内科の病棟で歩く練習を始めた。退院した佐藤さんからは、手紙が届いている。' },
        { who: 'doc', say: '{名前}先生。初日に、呼吸器はほとんど触ったことがないと言っていましたね。' },
        { who: 'me', say: '…はい。いまも、全部分かったとは思えません。' },
        { who: 'doc', mood: 'happy', say: 'それでいいんです。分からないと思える人は、確かめに戻ってこられます。' },
        { who: 'puku', mood: 'sad', say: '{名前}先生、ぼくのこと、忘れないでね。' },
        { who: 'doc', mood: 'happy', say: '忘れるもなにも。ぷくぷく、次は{名前}先生のポケットに入りなさい。' },
        { who: 'puku', mood: 'alert', say: 'えっ、いいの!? 先生は？' },
        { who: 'doc', say: '息は、受け渡していくものです。朝比奈先生が、最後に文字盤で教えてくれました。', secret: 'pass' },
        { who: 'doc', say: 'ギリシャ語のプネウマ、ラテン語のスピリトゥス、ヘブライ語のルーアハ、サンスクリットのプラーナ。', lore: 'soul' },
        { who: 'doc', mood: 'happy', say: 'どれも「息」で、どれも「魂」のことでもあります。人はずっと、息の中に命を見てきたんです。' },
        { who: 'scene', say: 'ぷくぷくが、{名前}先生の白衣のポケットに、そっともぐりこんだ。' },
        { who: 'puku', mood: 'happy', say: '{名前}先生、これからも「なんで？」って聞くからね。' },
        { who: 'doc', say: '最後に、ひとりで受け持ってみてください。症例は 6 人。わたしは、呼ばれたら行きます。' }
      ]
    }
  ];


  /* ===================== やる気の仕掛け（成人版だけ） =====================
   * 幕の行に lore（息のことば）や secret（いぶき先生の秘密）を付けておくと、その幕を見たときに
   * 研修手帳（メニュー）に開く。技能の星と称号は、終えたレッスンと「一度も間違えずに終えた」レッスンから出す。 */

  /* 息のことば。呼吸を人がどう呼び、どう扱ってきたか。scene はそれが出てくる幕（開く条件と「第N章で」の表示）。 */
  var LORE = [
    { id: 'wind', scene: 'ch1-close', word: 'ventilator と pneuma', text: 'ventilator はラテン語の ventus（風）から。肺炎 pneumonia はギリシャ語の「息をする」から来ていて、同じ根から息や風を表す pneuma が生まれた。' },
    { id: 'count', scene: 'ch2-close', word: '1 日 2 万回', text: '大人は 1 日に 2 万回ほど息をする。空気にすると 1 万リットル近い。' },
    { id: 'inspire', scene: 'ch3-close', word: 'inspiration と spirit', text: 'inspiration はラテン語 inspirare「息を吹き込む」。ひらめきは神に息を吹き込まれることだった。spirit（魂）は spiritus（息）から。' },
    { id: 'oxygen', scene: 'ch4-close', word: 'oxygène', text: '1770 年代にシェーレとプリーストリーが見つけ、ラヴォアジエが「酸をつくるもの」oxygène と名づけた。酸のもとだという考えは、のちに誤りと分かる。' },
    { id: 'sokusai', scene: 'ch5-close', word: '息災', text: '仏教の言葉で、災いを「息める（やめる）」こと。「息」には休む・止むの意味もあり、休息の「息」も同じ。' },
    { id: 'expire', scene: 'ch6-close', word: '息を引き取る と expire', text: '日本語は最後に息を「引き取り」、英語は ex-spirare、息を「吐き出す」。助かった人は、息を「吹き返す」。' },
    { id: 'kokyu', scene: 'ch7-close', word: '呼吸', text: '「呼」は吐く、「吸」は吸う。吐くほうが先に書かれている。' },
    { id: 'copenhagen', scene: 'ch8-close', word: '1952 年 コペンハーゲン', text: 'ポリオの大流行で、麻酔科医イプセンの提案により気管切開と手もみの換気が行われた。医学生が交代で袋を押し続け、死亡率は大きく下がった。ICU のはじまり。' },
    { id: 'vesalius', scene: 'ch9-close', word: 'ヴェサリウス 1543 年', text: '動物の気管に葦の管を入れて息を吹き込むと、胸を開いても心臓が動き続けた。いちばん古い陽圧換気の記録。' },
    { id: 'asthma', scene: 'ch10-close', word: 'asthma', text: 'ギリシャ語で「あえぐ」「荒い息」。2000 年以上前から、人は吐けない苦しさに名前をつけてきた。' },
    { id: 'ironlung', scene: 'ch11-close', word: '鉄の肺', text: '1928 年、ドリンカーらが作った陰圧式の人工呼吸器。体を鉄の箱に入れ、箱の空気を抜いて外から胸をふくらませた。' },
    { id: 'soul', scene: 'epilogue', word: '息と魂', text: 'ギリシャ語 pneuma、ラテン語 spiritus、ヘブライ語 ruach、サンスクリット prana。どれも「息」であり「魂」でもある。' }
  ];

  /* いぶき先生の秘密。物語を進めると 1 つずつ開き、第11章の幕で明かされる。 */
  var SECRETS = [
    { id: 'born', scene: 'prologue', title: 'ぷくぷくの生まれ', text: '患者さんたちの息から生まれた「ということに、なっています」。先生は、なぜか言い切らなかった。' },
    { id: 'habit', scene: 'ch1-close', title: '先生の口ぐせ', text: '「チューブは、のどの奥をずっと押している」。いぶき先生にも、こわくてやさしい先生がいた。' },
    { id: 'window', scene: 'ch5-open', title: '窓際のベッド', text: '「先生って昔から、あのベッドだけは…」。ななみさんの言葉は、途中でさえぎられた。' },
    { id: 'where', scene: 'ch6-close', title: '先生の先生は', text: '「先生の先生、いまはどこにいるの？」。いぶき先生は答えずに、佐藤さんへ向き直った。' },
    { id: 'board', scene: 'ch11-open', title: '文字盤', text: '文字盤を、迷わずに速く読む。「毎日、読んでいた人がいましたから」。' },
    { id: 'reveal', scene: 'ch11-close', title: '冬の終わりの窓際', text: '研修医のころの指導医・朝比奈先生は、窓際のベッドで亡くなった。ぷくぷくは、その最後の息から生まれた。' },
    { id: 'pass', scene: 'epilogue', title: '受け渡す息', text: '「息は、受け渡していくものです」。朝比奈先生からいぶき先生へ、そして{名前}先生のポケットへ。' }
  ];

  /* 技能。章ごとに、どの力が伸びるか。 */
  var SKILLS = [
    { id: 'read', name: '読む', chapters: ['ch1'], desc: '波形と数字から、いま起きていることを読む' },
    { id: 'build', name: '組み立てる', chapters: ['ch2', 'ch8'], desc: '予測体重から設定を一から組む' },
    { id: 'mode', name: '選ぶ', chapters: ['ch3'], desc: '機械に任せることと、患者さんに預けることを選ぶ' },
    { id: 'gas', name: '答え合わせ', chapters: ['ch4'], desc: '血液ガスで、届いたものを確かめる' },
    { id: 'guard', name: '守る', chapters: ['ch5'], desc: 'アラームで、考える前に正しい手が動く' },
    { id: 'wean', name: '外す', chapters: ['ch6', 'ch11'], desc: '外せるかを見きわめ、抜管まで運ぶ' },
    { id: 'disease', name: '見抜く', chapters: ['ch7', 'ch9', 'ch10'], desc: '病気ごとの肺の癖を見抜いて合わせる' }
  ];
  var STARS = 5;

  /* 称号。星の合計（最大 35）で上がる。say はいぶき先生のひとこと。 */
  var RANKS = [
    { at: 0, title: '見学の研修医', say: 'まずは、機械の言葉を読めるようになりましょう。' },
    { at: 2, title: '夜を越えた研修医', say: '最初の夜を越えましたね。数字が少し、話しかけてくるようになったはずです。' },
    { at: 8, title: '設定を任せられる研修医', say: '指示票の設定、安心して読めるようになりました。' },
    { at: 15, title: '当直を任せられる研修医', say: '鳴ったときに、手が先に動く。もう当直を任せられます。' },
    { at: 22, title: '受け持ちを任せられる研修医', say: '受け持ちを、ひとりで任せられます。困ったら、呼んでください。' },
    { at: 30, title: 'ICU の頼れる研修医', say: '{名前}先生がいると、夜が少し静かになります。' }
  ];

  /* 星の数。done は終えたレッスン、clean は一度も間違えずに終えたレッスン（どちらも id の配列）。
   * 終えるだけで半分、間違えずに終えると残り半分。やり直して満点を取りにいける。 */
  function skillStars(skill, chapters, done, clean) {
    var total = 0, got = 0;
    chapters.forEach(function (ch) {
      if (skill.chapters.indexOf(ch.id) < 0) return;
      ch.lessons.forEach(function (l) {
        total += 2;
        if (done.indexOf(l.id) >= 0) got++;
        if (clean.indexOf(l.id) >= 0) got++;
      });
    });
    return total ? Math.floor(got / total * STARS + 1e-9) : 0;
  }

  function growth(chapters, done, clean) {
    var list = SKILLS.map(function (sk) {
      return { id: sk.id, name: sk.name, desc: sk.desc, stars: skillStars(sk, chapters, done, clean) };
    });
    var sum = list.reduce(function (a, s) { return a + s.stars; }, 0);
    var rank = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (sum >= RANKS[i].at) rank = RANKS[i];
      else { next = RANKS[i]; break; }
    }
    return { skills: list, sum: sum, max: SKILLS.length * STARS, rank: rank, next: next };
  }

  function unlocked(list, seen) {
    return list.filter(function (x) { return x.scene === 'prologue' || seen.indexOf(x.scene) >= 0; })
      .map(function (x) { return x.id; });
  }

  function sceneById(id) {
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return SCENES[i];
    return null;
  }

  /* 名前を整える。空なら既定の名前。前後の空白と「先生」は落とす（「{名前}先生」と呼ぶため）。 */
  function cleanName(s) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/(先生|せんせい)$/, '').trim();
    if (s.length > NAME_MAX) s = s.slice(0, NAME_MAX);
    return s || DEFAULT_NAME;
  }

  function fill(text, name) {
    return String(text || '').replace(/\{名前\}/g, cleanName(name));
  }

  function speakerName(line, name) {
    if (line.who === 'pt' || line.who === 'fam') return line.name || '';
    return fill(SPEAKER[line.who] || '', name);
  }

  /* レッスンを始める前に流す幕。見ていないものだけを、物語の順に返す。
   * seen は見た幕の id の配列。 */
  function before(lessonId, chapterId, seen) {
    var out = [];
    if (seen.indexOf('prologue') < 0) out.push('prologue');
    var open = chapterId + '-open';
    if (sceneById(open) && seen.indexOf(open) < 0) out.push(open);
    return out;
  }

  /* レッスンを終えたあとに流す幕。章の最後のレッスンだけが幕を持つ。 */
  function after(lessonId, chapter, seen) {
    var out = [];
    if (!chapter || !chapter.lessons.length) return out;
    if (chapter.lessons[chapter.lessons.length - 1].id !== lessonId) return out;
    var close = chapter.id + '-close';
    if (sceneById(close) && seen.indexOf(close) < 0) out.push(close);
    if (chapter.id === LAST_CHAPTER && seen.indexOf('epilogue') < 0) out.push('epilogue');
    return out;
  }

  /* ===================== 進行 ===================== */
  /* 1 つの幕を 1 行ずつ進める。描画は持たない。
   *   phase: 'card'（章の扉の文字）→ 'line' → 'end'
   *   選択肢の行では pick(i) で返事を選ぶと、いぶき先生の返しが 1 行はさまる。 */
  function Run(scene) {
    this.scene = scene;
    this.index = 0;
    this.phase = scene.card ? 'card' : 'line';
    this.reply = null;       // 選択肢のあとの返し（1 行）
    this.picked = null;
  }

  Run.prototype.line = function () {
    if (this.phase !== 'line') return null;
    if (this.reply) return this.reply;
    return this.scene.lines[this.index] || null;
  };

  /** いまの行で止まって待つもの。'input' / 'choose' / null（押せば進む）。 */
  Run.prototype.waiting = function () {
    if (this.phase !== 'line' || this.reply) return null;
    var l = this.line();
    if (!l) return null;
    if (l.input) return 'input';
    if (l.choose) return 'choose';
    return null;
  };

  /** 押して進める。入力や選択を待っている行では進まない。終わったら true。 */
  Run.prototype.next = function () {
    if (this.phase === 'end') return true;
    if (this.phase === 'card') { this.phase = 'line'; return false; }
    if (this.waiting()) return false;
    if (this.reply) this.reply = null;
    this.index++;
    if (this.index >= this.scene.lines.length) { this.phase = 'end'; return true; }
    return false;
  };

  /** 名前を入れた。次の行へ進む。 */
  Run.prototype.submit = function () {
    if (this.waiting() !== 'input') return false;
    this.index++;
    if (this.index >= this.scene.lines.length) this.phase = 'end';
    return true;
  };

  Run.prototype.pick = function (i) {
    if (this.waiting() !== 'choose') return false;
    var c = this.line().choose[i];
    if (!c) return false;
    this.picked = i;
    this.reply = { who: 'doc', mood: 'happy', say: c.reply, isReply: true };
    return true;
  };

  /** 残りを飛ばす。名前がまだ決まっていなければ、名前の行で止まる（既定の名前で先へ行かせない）。 */
  Run.prototype.skip = function (hasName) {
    if (this.phase === 'card') this.phase = 'line';
    this.reply = null;
    var ls = this.scene.lines;
    for (var i = this.index; i < ls.length; i++) {
      if (ls[i].input && !hasName) { this.index = i; return false; }
    }
    this.phase = 'end';
    return true;
  };

  var api = {
    SCENES: SCENES, SPEAKER: SPEAKER, BG: BG, CHAPTER_TIME: CHAPTER_TIME, LAST_CHAPTER: LAST_CHAPTER,
    DEFAULT_NAME: DEFAULT_NAME, NAME_MAX: NAME_MAX,
    sceneById: sceneById, cleanName: cleanName, fill: fill, speakerName: speakerName,
    before: before, after: after, Run: Run,
    LORE: LORE, SECRETS: SECRETS, SKILLS: SKILLS, RANKS: RANKS, STARS: STARS,
    growth: growth, unlocked: unlocked
  };
  root.VentStory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
