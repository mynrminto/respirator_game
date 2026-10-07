/* VentSim — ゲーム全体を貫く物語。
 * 主人公は、初期研修で小児科を回りはじめた研修医（プレイヤー）。いぶき先生が指導医、
 * ぷくぷくは「息」から生まれた精で、主人公の代わりに「なんで？」と聞く。
 * 縦糸は、ローテ初日の夜に受け持つ術後のハルト君（8歳）が抜管するまで（第1〜6章）。
 * 第7〜11章はローテの 2〜4 週目で、ほかの 5 人を 1 人ずつ、設定から抜管まで受け持つ。
 *
 * レッスンの中の会話（lessons.js の talk）とは別に、ここには「幕」を置く。
 *   prologue   … いちばん最初にコースへ入るとき（名前を決める）
 *   chN-open   … その章のレッスンを初めて始めるとき（章の扉）
 *   chN-close  … その章の最後のレッスンを初めて終えたとき
 *   epilogue   … 最後の章（第11章）の幕のあと
 * 幕ごとに time（'day' / 'night'）を持ち、BGM の昼の曲・夜の曲をこれで選ぶ。
 * レッスンの最中は章の時刻（CHAPTER_TIME）で選ぶ。
 * bgm を持つ幕は、その曲を流す（'breath' 抜管・最初の声 ／ 'nicu' NICU）。章の曲は CHAPTER_BGM。
 * 録音した曲が無いときは bgm.js が time の曲に落とす。
 * 行にも bgm を書ける。その行から幕の終わりまで、その曲に替わる（'memory' 先生の打ち明け話など）。
 * 一度見た幕はメニューの「物語を読み返す」から何度でも読める。
 *
 * 行（line）の書き方
 *   { who, say }        who: 'scene'（ト書き）/ 'doc' / 'puku' / 'me'（主人公）/ 'nurse'（看護師）
 *                       / 'pt'（患者。case に症例 ID、name に呼び名）/ 'fam'（家族。name に呼び名）
 *   mood                … doc は normal / happy / think / alert、puku は happy / excited / sad / alert
 *   bg                  … この行から背景を替える（BG の名前）
 *   input: 'name'       … 主人公の名前を入れてもらう行
 *   choose: [{ label, reply }] … 主人公の返事を選ぶ。reply は返し（1 行）。返すのはいぶき先生、
 *                       ただし who / name / mood / case を書けばその人（家族・患者・ぷくぷく）が返す
 *   pick: 'key'         … 選んだ番号を key の名前で覚えておく（主人公の選んだ言葉が、あとの幕に響く）
 *   when: 'key:n'       … key で n 番を選んだときだけ出す行。選ばずに飛ばしたときは 0 番を選んだものとする
 * {名前} は主人公の名前に置き換える（fill）。数値の差し込みはここでは使わない。
 * ここはデータだけを持ち、描画は app.js（iPhone 版は StoryView.swift）が行う。
 */
(function (root) {
  'use strict';

  var DEFAULT_NAME = '春野';
  var NAME_MAX = 8;

  /* 名札。{名前} は主人公の名前、pt / fam は行の name を使う。 */
  var SPEAKER = { scene: '', doc: 'いぶき先生', puku: 'ぷくぷく', me: '{名前}', nurse: '看護師 ななみ' };

  /* 背景。左から順に、届いている画像を使う（新しい絵が届くまでは今ある絵で代える）。 */
  var BG = {
    corridor: ['bg_story_corridor', 'bg_title_day'],
    picu: ['bg_title_day'],
    nicu: ['bg_story_nicu', 'bg_title_day'],
    night: ['bg_title_night'],
    station: ['bg_story_station', 'bg_title_night'],
    dawn: ['bg_story_dawn', 'bg_title_day']
  };

  /* レッスンの最中に流す曲。章の舞台の時刻：第1章は初日の夜、第5章は当直の夜、
   * 第9章は NICU の夜、第10章は救急外来からの当直の夜、ほかは日中。 */
  var CHAPTER_TIME = { ch1: 'night', ch2: 'day', ch3: 'day', ch4: 'day', ch5: 'night', ch6: 'day',
    ch7: 'day', ch8: 'day', ch9: 'night', ch10: 'night', ch11: 'day' };
  /* 章の時刻より優先して流す曲（NICU の章は NICU の曲）。 */
  var CHAPTER_BGM = { ch9: 'nicu' };

  /* エピローグは最後の章の幕のあとに流す。 */
  var LAST_CHAPTER = 'ch11';

  var SCENES = [

    /* ===================== プロローグ ===================== */
    {
      id: 'prologue', kind: 'prologue', title: 'プロローグ　はじめての小児科',
      card: { kicker: 'プロローグ', title: 'はじめての小児科', sub: 'ローテーション初日　朝 8 時' },
      bg: 'corridor', time: 'day',
      lines: [
        { who: 'scene', say: 'Dum spiro, spero.　―― 息をするかぎり、希望はある。（ラテン語の格言）' },
        { who: 'scene', say: '初期研修の小児科ローテーション、初日。朝の病棟は、思っていたよりずっと静かだった。' },
        { who: 'scene', say: '廊下の突き当たりに「PICU・NICU」の自動ドア。中から、規則正しい機械の音が聞こえてくる。' },
        { who: 'doc', mood: 'happy', say: 'おはようございます。今日から小児科を回る研修医の先生ですね。' },
        { who: 'doc', say: '小児科と小児集中治療を担当している、いぶきです。このローテのあいだ、あなたの指導医になります。' },
        { who: 'doc', say: 'まず、呼び方を決めさせてください。お名前は？', input: 'name' },
        { who: 'doc', mood: 'happy', say: '{名前}先生。よろしくお願いします。' },
        { who: 'me', say: 'よろしくお願いします。…正直、子どもの呼吸器はまったく触ったことがなくて。' },
        { who: 'doc', say: '最初はみんなそうです。「大人の呼吸器を小さくしたもの」と思っていると、転びます。' },
        { who: 'scene', say: 'いぶき先生の白衣のポケットから、白くて丸いものが、ふわりと浮かび上がった。' },
        { who: 'puku', mood: 'excited', say: 'ねえねえ、この人が新しい先生？' },
        { who: 'doc', mood: 'happy', say: 'ぷくぷくです。ここの子たちの「息」から生まれた…ということに、なっています。' },
        { who: 'puku', mood: 'happy', say: 'ぼく、分からないことがあったら「なんで？」って聞く係なんだ。先生の代わりに聞いてあげる！' },
        {
          who: 'puku', mood: 'excited', say: 'じゃあさっそく。{名前}先生は、将来なに科になるの？', pick: 'path',
          choose: [
            { label: '小児科を考えています', reply: 'それなら、この 4 週間はあなたの最初の一歩ですね。' },
            { label: 'まだ決めていません', reply: '決めていない人ほど、よく見えるものがあります。' },
            { label: 'ほかの科です', reply: 'どの科に進んでも、子どもはいつか目の前に来ます。そのときのために。' }
          ]
        },
        { who: 'puku', mood: 'happy', say: 'ふーん。ぼく、ちゃんと覚えておくからね！' },
        {
          who: 'doc', mood: 'think', say: '{名前}先生、緊張していますか？', pick: 'nerves',
          choose: [
            { label: '正直、かなり', reply: 'いい緊張です。ここでは、こわいと思える人のほうが子どもを守れます。' },
            { label: '楽しみです', reply: '頼もしい。その気持ちのまま、手順だけは守りましょう。' }
          ]
        },
        { who: 'scene', bg: 'picu', say: '自動ドアが開く。モニターの音、輸液ポンプの音、呼吸器の送気の音。ベッドの並ぶ PICU と、保育器の並ぶ NICU。' },
        { who: 'doc', say: 'ここの子たちは、体重 1 kg から 35 kg まで。呼吸を機械に預けている子もいます。' },
        { who: 'scene', bg: 'nicu', say: '保育器の中で、在胎 28 週で生まれた赤ちゃんが、手のひらほどの胸を小さく上下させている。' },
        { who: 'puku', mood: 'sad', say: 'ちっちゃい…。この子にも、同じ機械を使うの？' },
        { who: 'doc', say: '同じ考え方で、ずっと細かく。この子に 1 回で送る空気は、小さじ 1 杯ほどです。' },
        { who: 'scene', say: 'いぶき先生は保育器の前で、ほんの少しだけ長く立ち止まっていた。' },
        { who: 'scene', bg: 'picu', say: '奥のベッドには、インフルエンザ肺炎で両肺が真っ白になった 3 歳の女の子。呼吸器につながって 2 日目だ。' },
        { who: 'scene', say: '隣には、RSV で入院した生後 4 か月の男の子。鼻のカニュラから高流量の酸素を受け、速い息をしている。' },
        { who: 'scene', say: '窓際の 7 歳の女の子は、ギラン・バレー症候群。呼吸の筋肉まで力が抜け、呼吸器につながって 2 週間になる。' },
        { who: 'doc', say: '覚えることは多いけれど、根っこは 1 つ。この機械が何を保証して、何をこの子に預けているか。' },
        { who: 'nurse', say: 'いぶき先生、救急外来から電話です。' },
        { who: 'doc', mood: 'think', say: '…はい。…分かりました。ベッドを空けて待っています。' },
        { who: 'doc', say: '8 歳の男の子。虫垂炎が破れて、お腹じゅうに膿が広がっています。血圧が保てない、ショックです。' },
        { who: 'doc', say: '昼から緊急手術。終わったら、挿管のままここへ来ます。ハルト君です。' },
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
      card: { kicker: '第1章', title: '機械を読む', sub: '初日の夜　PICU' },
      bg: 'night', time: 'night',
      lines: [
        { who: 'scene', say: '午後 8 時。手術室から、ハルト君のベッドが運ばれてきた。麻酔科医が、手際よく呼吸器につなぎ替えていく。' },
        { who: 'nurse', say: '呼吸器、つながりました。ノルアドレナリンは 0.1 で続いています。設定は麻酔科の先生が入れてくれています。' },
        { who: 'puku', mood: 'sad', say: '画面に線と数字がいっぱい…。どこから見ればいいの？' },
        { who: 'doc', say: '全部を一度に見なくていい。{名前}先生、今夜は「読む」ことだけに集中しましょう。' }
      ]
    },
    {
      id: 'ch1-close', kind: 'close', chapter: 'ch1', title: '第1章　幕　午前 0 時',
      bg: 'station', time: 'night',
      lines: [
        { who: 'scene', say: '午前 0 時。ハルト君の数字は落ち着いている。ナースステーションには、モニターの音だけが続いている。' },
        { who: 'doc', mood: 'happy', say: '今夜、{名前}先生は 3 つ覚えました。波形の読み方。圧が 2 つあること。肺の柔らかさと、気道の通りにくさ。' },
        { who: 'me', say: '読めるようにはなりました。でも、どう設定すればいいのかは、まだ…。' },
        { who: 'doc', say: 'それは明日。朝の回診で、ハルト君の設定を一から見直します。' },
        { who: 'puku', say: 'ねえ、息を機械で送るのって、いつからやってるの？' },
        { who: 'doc', say: '記録に残るはじまりは 1543 年。解剖学者ヴェサリウスが、動物の気管に葦の管を入れて息を吹き込みました。' },
        { who: 'doc', say: '肺がふくらむと、弱っていた心臓の動きが戻ったと書いています。人工呼吸は、1 本の管から始まったんです。' },
        { who: 'puku', mood: 'happy', say: '（あくびをして）ぷく…。明日も、ぼくついていくね。' }
      ]
    },

    /* ===================== 第2章 ===================== */
    {
      id: 'ch2-open', kind: 'open', chapter: 'ch2', title: '第2章　扉　2 日目の朝',
      card: { kicker: '第2章', title: '挿管直後の初期設定', sub: '2 日目の朝　回診' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '翌朝 8 時。ハルト君の昇圧薬は、夜のうちに半分まで減った。回診の前に、夜勤の看護師から申し送りを受ける。' },
        { who: 'nurse', say: '夜中に何度か換気量のアラームが鳴って、当直の先生が一回換気量を上げていきました。' },
        { who: 'doc', mood: 'think', say: '鳴ったから上げる。いちばん多い落とし穴です。{名前}先生、今日は設定を「決める」側に回ってもらいます。' },
        { who: 'puku', say: '決めるって、何から？' },
        { who: 'doc', say: '量、回数、酸素。順番に。全部、目の前の子の体重から始まります。' }
      ]
    },
    {
      id: 'ch2-close', kind: 'close', chapter: 'ch2', title: '第2章　幕　昼すぎ',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '昼すぎ。ハルト君の指示票に、{名前}先生の字で書いた設定が並んでいる。' },
        { who: 'doc', mood: 'happy', say: '体重から量を、量から回数を。酸素は下げられるだけ下げる。いい初期設定です。' },
        { who: 'me', say: '設定の 1 つ 1 つに、こんなに理由があるんですね。' },
        { who: 'puku', say: 'ねえねえ、吸う息って英語でなんていうの？' },
        { who: 'doc', say: 'インスピレーション。ラテン語の spirare、「息をする」から来ています。吐く息はエクスピレーション。' },
        { who: 'doc', say: 'spirit（魂）も同じ根です。息を吹き込まれることが、昔は「ひらめき」や「命」そのものでした。' },
        { who: 'me', say: 'そういえば、「いぶき」って珍しいお名前ですね。' },
        { who: 'doc', say: '息を吹く、と書いて息吹です。親がつけました。' },
        { who: 'puku', mood: 'excited', say: 'ぼく、理由しってる！ あのね…' },
        { who: 'doc', mood: 'think', say: 'ぷくぷく。…それは、別の機会にしましょう。' },
        { who: 'nurse', say: 'いぶき先生、3 番ベッドのミオちゃん、また酸素化が悪くなってきています。' },
        { who: 'doc', mood: 'alert', say: '行きましょう。同じ理屈が、硬い肺ではまったく違う顔を見せます。' }
      ]
    },

    /* ===================== 第3章 ===================== */
    {
      id: 'ch3-open', kind: 'open', chapter: 'ch3', title: '第3章　扉　3 番ベッド',
      card: { kicker: '第3章', title: 'モードの違い', sub: '2 日目の午後　PICU 3 番ベッド' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: 'インフルエンザ肺炎から ARDS になったミオちゃん（3歳）。お母さんが、ベッドの横で小さな手を握っている。' },
        { who: 'fam', name: 'ミオちゃんのお母さん', say: '先生、この子、ずっとこのままなんでしょうか…。' },
        { who: 'doc', say: '{名前}先生。お母さんに、いまの状態を伝えてみてください。' },
        {
          who: 'me', say: '（お母さんの目を見て、言葉を選ぶ）', pick: 'mioMom',
          choose: [
            { label: '肺を休ませて、治るのを待っています', who: 'fam', name: 'ミオちゃんのお母さん',
              reply: '休ませて…。この機械は、休ませるためのものなんですね。' },
            { label: '正直、まだ分かりません', who: 'doc', mood: 'think',
              reply: '分からないことは、分からないと言っていい。ただ、いま何をしているかは伝えましょう。' },
            { label: '大丈夫です、きっと治ります', who: 'doc', mood: 'think',
              reply: '約束はしない。でも、希望は渡す。その間を探すのが、わたしたちの言葉です。' }
          ]
        },
        { who: 'doc', say: 'いまは肺を休ませながら、治るのを待っています。その待ち方を、いちばん安全にします。' },
        { who: 'puku', say: '待ち方？' },
        { who: 'doc', say: '機械に何を任せて、何をこの子に預けるか。それを選ぶのが「モード」です。' }
      ]
    },
    {
      id: 'ch3-close', kind: 'close', chapter: 'ch3', title: '第3章　幕　夕方',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '夕方。ハルト君はうとうとしながら、自分のペースで息をしている。' },
        { who: 'pt', case: 'postop', name: 'ハルト君', say: '（チューブがあって話せない。かわりに指で、小さな OK をつくってみせる）' },
        { who: 'puku', mood: 'excited', say: 'いま、ハルト君が OK って！' },
        { who: 'doc', mood: 'happy', say: '自分で息をする力が戻ってきた証拠です。{名前}先生、手伝い方を選べるようになりましたね。' },
        { who: 'me', say: '自分のペースの息、ですね。' },
        { who: 'doc', say: '「息」という字は、「自」と「心」。「自」は、もとは鼻をかたどった字だといわれます。' },
        { who: 'doc', say: '鼻と、胸の奥の心。休息の「息」でもあります。ハルト君の息も、少し休めるようになりました。' },
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
        { who: 'puku', say: '体に届いた酸素は、そのあとどうなるの？' },
        { who: 'doc', say: '燃えます、ゆっくりと。18 世紀にラボアジエが、呼吸は炭が燃えるのと同じ燃焼だと示しました。' },
        { who: 'doc', say: '酸素を使って、二酸化炭素を出す。「酸素」という日本語は、江戸の蘭学者・宇田川榕菴の訳語です。' },
        { who: 'puku', mood: 'happy', say: '答え合わせ、ぼく得意！ …たぶん。' }
      ]
    },
    {
      id: 'ch4-close', kind: 'close', chapter: 'ch4', title: '第4章　幕　夕方',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '夕方。ミオちゃんの pH は低めのまま。それでも、肺にかかる圧は上限の下に収まった。' },
        { who: 'me', say: 'CO₂ が高いままでいいのか、まだ少し怖いです。' },
        { who: 'doc', say: 'その怖さは大事にしてください。許すのは、肺を守るという目的があるときだけです。' },
        { who: 'fam', name: 'ミオちゃんのお母さん', say: '先生たち、今日は何度も見に来てくださったんですね。' },
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
        { who: 'nurse', say: 'ハルト君、夕方に点滴の管が詰まって、左の鎖骨の下から入れ直しています。昇圧薬は、もう切れました。' },
        { who: 'nurse', say: '今夜は静かだといいですね。…って言うと、たいてい鳴るんですけど。' },
        { who: 'puku', mood: 'sad', say: 'ぼく、アラームが鳴ると頭が真っ白になっちゃうんだ。' },
        { who: 'doc', say: 'だから順番を決めておきます。頭が真っ白になっても、手が先に動くように。' }
      ]
    },
    {
      id: 'ch5-close', kind: 'close', chapter: 'ch5', title: '第5章　幕　夜明け',
      bg: 'dawn', time: 'day',
      lines: [
        { who: 'scene', say: '夜明け。ハルト君の胸には細いドレーンが入り、モニターの音はまた高く澄んだ音に戻っている。' },
        { who: 'me', say: '手が震えていました。でも、酸素を上げるところまでは、考える前にできました。' },
        { who: 'doc', mood: 'happy', say: 'それで十分です。今夜ハルト君を守ったのは、{名前}先生の最初の一手です。' },
        { who: 'doc', mood: 'think', say: '夕方の管の針が、肺の表面をかすめたのかもしれません。そこから、機械の圧で空気が漏れました。' },
        { who: 'puku', say: '気胸って、英語だとなんていうの？' },
        { who: 'doc', say: 'ニューモソラックス。ギリシャ語のプネウマ「息・風・霊」に、胸を意味するソラックスです。' },
        { who: 'doc', say: '古代の医師は、体をめぐる生命の息をプネウマと呼びました。肺炎のニューモニアも同じ仲間の言葉です。' },
        { who: 'puku', mood: 'sad', say: 'ぼく、ずっとポケットの中で震えてた…。' },
        { who: 'doc', mood: 'happy', say: '知っています。わたしの最初の当直の夜も、そうでしたね。' },
        { who: 'me', say: '…先生の、最初の当直の夜も？' },
        { who: 'scene', say: 'いぶき先生は答えずに、白んでいく窓の外を見ていた。' },
        { who: 'doc', say: 'ここから先は、外す話です。つけるより、外すほうが難しい。' }
      ]
    },

    /* ===================== 第6章 ===================== */
    {
      id: 'ch6-open', kind: 'open', chapter: 'ch6', title: '第6章　扉　4 日目の朝',
      card: { kicker: '第6章', title: '離脱と抜管', sub: '4 日目の朝　PICU' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '翌朝。ハルト君の熱は下がり、お腹の張りも引いた。ドレーンからの空気漏れも止まっている。お母さんが面会に来ている。' },
        { who: 'fam', name: 'ハルト君のお母さん', say: '先生、この管はいつ抜けるんでしょう。あの子、しゃべりたがっていて。' },
        { who: 'doc', say: '今日から、それを確かめていきます。{名前}先生、条件を一緒に見ましょう。' },
        { who: 'puku', mood: 'excited', say: '抜けたら、ハルト君とおしゃべりできる？' },
        { who: 'doc', mood: 'happy', say: 'できます。そのためにも、焦らないことです。' }
      ]
    },
    {
      id: 'ch6-close', kind: 'close', chapter: 'ch6', title: '第6章　幕　抜管のあと',
      bg: 'picu', time: 'day', bgm: 'breath',
      lines: [
        { who: 'scene', say: '抜管から 1 時間。ハルト君は酸素マスクをつけて、自分でしっかり咳をしている。' },
        { who: 'pt', name: 'ハルト君', say: '…せんせい。のど、いたい。' },
        { who: 'puku', mood: 'excited', say: 'しゃべった！' },
        { who: 'fam', name: 'ハルト君のお母さん', say: 'ハルト…！ 先生、ほんとうにありがとうございました。' },
        { who: 'doc', mood: 'happy', say: 'お礼は、こちらの先生に。最初の夜から、ずっとハルト君の担当でした。' },
        { who: 'me', say: 'ハルト君、よくがんばったね。' },
        { who: 'pt', case: 'postop', name: 'ハルト君', say: '…せんせいの、なまえ、なに？' },
        { who: 'me', say: '{名前}。{名前}先生だよ。' },
        { who: 'pt', case: 'postop', name: 'ハルト君', say: '…{名前}せんせい。ねてるとき、ずっと、こえ、きこえてた。' },
        { who: 'puku', say: 'チューブが入っていたときは、どうして声が出なかったの？' },
        { who: 'doc', say: '声は、吐く息が声帯を震わせて出るものです。チューブは、その声帯のあいだを通っていました。' },
        { who: 'doc', mood: 'happy', say: 'だから最初の声は、自分の息が戻ってきた合図なんです。' },
        { who: 'doc', mood: 'think', say: 'チューブが抜けた日のことを、子どもは覚えていません。でも、親は一生覚えています。' },
        { who: 'scene', say: 'そう言ういぶき先生は、ハルト君ではなく、どこか遠くを見ているようだった。' }
      ]
    },

    /* ===================== 第7章 ===================== */
    {
      id: 'ch7-open', kind: 'open', chapter: 'ch7', title: '第7章　扉　5 日目の朝',
      card: { kicker: '第7章', title: '細い気道', sub: '5 日目の朝　PICU 5 番ベッド' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: 'ハルト君が抜管された翌朝。空いたベッドに、朝の光が差している。' },
        { who: 'nurse', say: '{名前}先生、5 番ベッドのそうた君、夜のあいだに呼吸回数を 40 まで上げています。' },
        { who: 'doc', mood: 'think', say: 'そうた君は、今日から{名前}先生の受け持ちです。挿管した夜のこと、覚えていますか。' },
        { who: 'me', say: 'はい。吐ききれずに、血圧が下がって…。' },
        { who: 'puku', mood: 'alert', say: 'また回数が上がってる！' },
        { who: 'doc', say: 'あの夜と同じ落とし穴です。今度は、{名前}先生が組み直してください。' }
      ]
    },
    {
      id: 'ch7-close', kind: 'close', chapter: 'ch7', title: '第7章　幕　8 日目の昼前',
      bg: 'picu', time: 'day', bgm: 'breath',
      lines: [
        { who: 'scene', say: '8 日目の昼前。そうた君は鼻のカニュラで、ゆっくりと息をしている。' },
        { who: 'scene', say: 'お母さんが差し出した指を、小さな手がぎゅっと握った。' },
        { who: 'fam', name: 'そうた君のお母さん', say: '先生、この子、握り返してくれました…！' },
        { who: 'puku', say: '「息子」って、どうして「息」の字なの？' },
        { who: 'doc', say: '「息」には、生まれる、ふえるという意味もあります。利息の「息」も同じです。' },
        { who: 'doc', mood: 'happy', say: 'むすこの「むす」は、苔むすの「むす」。息をして、育っていく子です。' },
        { who: 'doc', mood: 'happy', say: '回数より量、吐かせて待つ。{名前}先生の設定で、そうた君は乗りきりました。' },
        { who: 'puku', mood: 'happy', say: 'ぼく、吐く時間のこと、もう忘れないよ。' },
        { who: 'doc', say: 'ミオちゃんの回診に行きましょう。あの子も、良くなってきています。' }
      ]
    },

    /* ===================== 第8章 ===================== */
    {
      id: 'ch8-open', kind: 'open', chapter: 'ch8', title: '第8章　扉　3 番ベッド、ふたたび',
      card: { kicker: '第8章', title: '硬い肺をもう一度', sub: '8 日目の昼　PICU 3 番ベッド' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '3 番ベッドのミオちゃんは、呼吸器につながって 9 日目。酸素の量が減り、熱も下がりはじめた。' },
        { who: 'fam', name: 'ミオちゃんのお母さん', say: '先生、昨日より顔色がいいって、看護師さんが。' },
        { who: 'fam', name: 'ミオちゃんのお母さん', say: '「休ませて、治るのを待っている」と聞いてから、待つのが少し楽になりました。', when: 'mioMom:0' },
        { who: 'fam', name: 'ミオちゃんのお母さん', say: '「まだ分からない」と正直に言ってもらえたから、いまの「良くなっている」を信じられます。', when: 'mioMom:1' },
        { who: 'fam', name: 'ミオちゃんのお母さん', say: '「きっと治る」と言ってもらえた日から、ずっとそれを支えにしていました。', when: 'mioMom:2' },
        { who: 'doc', mood: 'happy', say: 'はい。肺が少しずつ戻ってきています。ここからは、良くなるほうの話をしましょう。' },
        { who: 'nurse', say: 'では、床ずれ予防の体位変換をしますね。{名前}先生、チューブを見ていてください。' },
        { who: 'puku', mood: 'excited', say: 'ぼくも見張ってる！' }
      ]
    },
    {
      id: 'ch8-close', kind: 'close', chapter: 'ch8', title: '第8章　幕　12 日目の夕方',
      bg: 'picu', time: 'day', bgm: 'memory',
      lines: [
        { who: 'scene', say: '12 日目の夕方。ミオちゃんは HFNC をつけたまま、お母さんの膝で絵本を見ている。' },
        { who: 'fam', name: 'ミオちゃんのお母さん', say: 'チューブが抜けた日は、心臓が止まるかと思いました。' },
        { who: 'doc', say: 'わたしもです。でも、{名前}先生が設定を一から組み直してくれました。' },
        { who: 'puku', say: 'いぶき先生のお母さんも、前にそう言ってたよね。' },
        { who: 'doc', mood: 'think', say: 'ぷくぷく。' },
        { who: 'puku', mood: 'sad', say: '…ぷく。（ポケットにもぐる）' },
        { who: 'me', say: 'あの日、先生がバッグを押していた数分は、すごく長く感じました。' },
        { who: 'doc', say: '1952 年のコペンハーゲンでは、ポリオの子たちのために、医学生が交代で何週間もバッグを押し続けました。' },
        { who: 'doc', say: '千人を超える学生の手が、多くの命をつないだ。集中治療室は、そこから始まったといわれます。' },
        { who: 'me', say: '量、PEEP、酸素、回数。順番を覚えていたから、手が動きました。' },
        { who: 'doc', mood: 'happy', say: 'それが「覚えた」ということです。明日から、{名前}先生は NICU に入ります。' },
        { who: 'puku', mood: 'excited', say: 'NICU って、あのちっちゃい子たちのところ？' }
      ]
    },

    /* ===================== 第9章 ===================== */
    {
      id: 'ch9-open', kind: 'open', chapter: 'ch9', title: '第9章　扉　NICU の夜',
      card: { kicker: '第9章', title: '手のひらの肺', sub: '2 週目の夜　NICU' },
      bg: 'nicu', time: 'night', bgm: 'nicu',
      lines: [
        { who: 'scene', say: '2 週目。NICU の夜は、PICU よりさらに静かだ。保育器のファンの音だけが続いている。' },
        { who: 'nurse', say: '{名前}先生、産科から連絡です。在胎 28 週、もうすぐ生まれます。' },
        { who: 'doc', say: 'ローテの初日に見た、保育器の子と同じ週数です。分娩室へ行きましょう。' },
        { who: 'puku', mood: 'sad', say: '28 週って、本当なら、まだお母さんのお腹の中にいる時期だよね…' },
        { who: 'doc', say: 'あと 3 か月、お腹の中で肺を育てるはずだった子です。その続きを、外で手伝います。' },
        { who: 'doc', say: 'この週数では、肺胞をしぼませない物質、サーファクタントがまだ足りません。' },
        { who: 'doc', say: '人工のサーファクタントで赤ちゃんを初めて救ったのは、1980 年、日本の藤原哲郎先生たちです。' },
        { who: 'scene', say: 'いぶき先生の声は、いつもより少しだけ硬かった。' }
      ]
    },
    {
      id: 'ch9-close', kind: 'close', chapter: 'ch9', title: '第9章　幕　生まれて 4 日目',
      bg: 'nicu', time: 'day', bgm: 'nicu',
      lines: [
        { who: 'scene', say: '生まれて 4 日目。あおい君は nCPAP のまま、保育器の中で手足を伸ばしている。' },
        { who: 'fam', name: 'あおい君のお父さん', say: '小さすぎて、触ったら壊れてしまいそうで…。' },
        { who: 'doc', say: '{名前}先生、お父さんに声をかけてあげてください。' },
        {
          who: 'me', say: '（保育器の窓を、お父さんと一緒にのぞきこむ）', pick: 'aoiDad',
          choose: [
            { label: '一緒に、手を当ててみましょう', who: 'fam', name: 'あおい君のお父さん',
              reply: '…あったかい。こんなに小さいのに、ちゃんと息をしてる。' },
            { label: 'もう少し大きくなってから', who: 'doc', mood: 'think',
              reply: '触れることも治療のうちです。いまのふれあいは、親にも子にも力になります。' }
          ]
        },
        { who: 'nurse', say: '大丈夫ですよ。手のひらで、そっと包んであげてください。', when: 'aoiDad:1' },
        { who: 'doc', mood: 'happy', say: '桁が変わっても、考え方は同じでした。{名前}先生、もう NICU の数字も読めますね。' },
        { who: 'me', say: '小さじ 1 杯の空気が、こんなに重いとは思いませんでした。' },
        { who: 'puku', say: 'あおい君、生まれたとき泣いた？' },
        { who: 'doc', say: '小さな声で。産声は、水で満ちていた肺に初めて空気を入れて、それを吐きながら上げる声です。' },
        { who: 'scene', say: '保育器の向こうの壁に、NICU を巣立った子どもたちの写真が並んでいる。', bgm: 'memory' },
        { who: 'scene', say: '端の色あせた 1 枚に、手書きの文字。「いぶきちゃん　在胎 28 週　980 g」' },
        {
          who: 'me', say: '（色あせた写真から、目が離せない）', pick: 'photo',
          choose: [
            { label: '先生、これって…', who: 'puku', mood: 'alert', reply: 'あ…見つかっちゃった。' },
            { label: '（何も言わずに、先生を見る）', who: 'puku', mood: 'sad', reply: '…{名前}先生、気づいちゃった？' }
          ]
        },
        { who: 'doc', mood: 'happy', say: 'わたしも、ここの保育器で育ちました。小さじ 1 杯の空気から。' },
        { who: 'doc', say: '続きは、別の機会にしましょう。いまは、あおい君の番です。' }
      ]
    },

    /* ===================== 第10章 ===================== */
    {
      id: 'ch10-open', kind: 'open', chapter: 'ch10', title: '第10章　扉　救急外来からの電話',
      card: { kicker: '第10章', title: '吐けない息', sub: '3 週目の夕方　救急外来' },
      bg: 'station', time: 'night',
      lines: [
        { who: 'scene', say: '3 週目、PICU に戻って最初の当直。夕方、救急外来から電話が鳴った。' },
        { who: 'nurse', say: '11 歳の男の子、喘息の発作です。吸入が効かなくて、いま挿管しています！' },
        { who: 'doc', mood: 'alert', say: '{名前}先生、行きましょう。喘息の子の呼吸器は、ほかのどの子とも違います。' },
        { who: 'puku', mood: 'alert', say: '違うって、どこが？' },
        { who: 'doc', say: '吸わせることより、吐かせることがすべて。今夜は、それだけ覚えてください。' },
        { who: 'doc', say: '「呼吸」という言葉も、「呼」が吐く、「吸」が吸う。吐くほうが先に書いてあります。' },
        { who: 'puku', mood: 'excited', say: 'ほんとだ！ 吐かないと、吸えないんだね。' }
      ]
    },
    {
      id: 'ch10-close', kind: 'close', chapter: 'ch10', title: '第10章　幕　病棟へ移る日',
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '抜管の翌日。レン君は一般病棟へ移る前に、吸入器の使い方をもう一度教わっている。' },
        { who: 'pt', case: 'asthma', name: 'レン君', say: '…ちゃんと毎日やります。あんなに苦しいのは、もう嫌だ。' },
        { who: 'doc', say: '吸入ステロイドは、発作のない日のための薬です。続けた日の分だけ、発作が遠くなります。' },
        { who: 'me', say: '呼吸器を外すまでが治療じゃないんですね。' },
        { who: 'doc', mood: 'happy', say: 'そうです。次の発作を起こさないところまでが、わたしたちの仕事です。' },
        { who: 'doc', say: '喘息の英語アズマは、ギリシャ語の「あえぎ」。2000 年以上前の医師も、この苦しさを書き残しています。' },
        { who: 'doc', say: '{名前}先生。初日の夜は、画面の線と数字を前に、手が止まっていましたね。' },
        { who: 'doc', mood: 'happy', say: 'あの夜は、吐ききれているかを真っ先に見ていた。わたしが言う前に。' },
        { who: 'puku', mood: 'excited', say: 'ぼくが「なんで？」って聞く前に、もう答えてたよ！' }
      ]
    },

    /* ===================== 第11章 ===================== */
    {
      id: 'ch11-open', kind: 'open', chapter: 'ch11', title: '第11章　扉　窓際のベッド',
      card: { kicker: '第11章', title: '力を取り戻す', sub: '3 週目　PICU 窓際のベッド' },
      bg: 'picu', time: 'day',
      lines: [
        { who: 'scene', say: '窓際のベッドのあかりちゃん。挿管から 4 週間。初日より、指先がよく動くようになった。' },
        { who: 'pt', case: 'gbs', name: 'あかりちゃん', say: '（文字盤を指でたどる。「いつ、しゃべれる？」）' },
        {
          who: 'me', say: '（あかりちゃんの目の高さまで、しゃがむ）', pick: 'akari',
          choose: [
            { label: 'もうすぐ。一緒に練習しよう', who: 'pt', case: 'gbs', name: 'あかりちゃん',
              reply: '（文字盤をたどる。「やくそく」）' },
            { label: '息の力が戻ったらね', who: 'pt', case: 'gbs', name: 'あかりちゃん',
              reply: '（小さくうなずいて、文字盤をたどる。「がんばる」）' }
          ]
        },
        { who: 'puku', mood: 'sad', say: 'この前の SBT、18 分でだめだったんだよね…' },
        { who: 'doc', say: 'あの日から、毎日少しずつ練習してきました。{名前}先生、仕上げを一緒にやりましょう。' },
        { who: 'puku', say: '息の筋肉が動かない病気って、昔はどうしてたの？' },
        { who: 'doc', say: '1928 年、ボストンで「鉄の肺」が作られました。体ごと箱に入れ、外から胸を広げて息をさせる機械です。' },
        { who: 'doc', say: 'ポリオの子たちが、その中で何か月も力が戻るのを待ちました。あかりちゃんも、いま待っています。' },
        { who: 'me', say: 'あかりちゃん、仕上げだよ。' }
      ]
    },
    {
      id: 'ch11-close', kind: 'close', chapter: 'ch11', title: '第11章　幕　4 週間ぶりの声',
      bg: 'picu', time: 'day', bgm: 'breath',
      lines: [
        { who: 'scene', say: '抜管の翌日。あかりちゃんは NPPV のマスクを外して、窓の外を見ている。' },
        { who: 'pt', case: 'gbs', name: 'あかりちゃん', say: '…{名前}せんせい。こえ、でた。' },
        { who: 'pt', case: 'gbs', name: 'あかりちゃん', say: '…やくそく、まもったよ。', when: 'akari:0' },
        { who: 'puku', mood: 'excited', say: 'しゃべった！ 4 週間ぶりだよ！' },
        { who: 'fam', name: 'あかりちゃんのお母さん', say: '先生方、本当に、本当にありがとうございました。' },
        { who: 'doc', mood: 'happy', say: '{名前}先生。ローテが終わるまで、あと 1 週間です。' }
      ]
    },

    /* ===================== エピローグ ===================== */
    {
      id: 'epilogue', kind: 'epilogue', title: 'エピローグ　ローテーション最終日',
      card: { kicker: 'エピローグ', title: 'ローテーション最終日', sub: '夕方　PICU' },
      bg: 'dawn', time: 'day', bgm: 'epilogue',
      end: { label: '症例で練習する', action: 'cases', say: 'おつかれさまでした。6 人の子どもたちを、今度はひとりで受け持ってみましょう。' },
      lines: [
        { who: 'scene', say: '4 週間のローテーション、最終日。夕方の PICU で、また新しい入院の電話が鳴っている。' },
        { who: 'scene', say: 'ベッドの顔ぶれは入れ替わった。ミオちゃんは一般病棟へ移り、そうた君はとうに家へ帰った。' },
        { who: 'scene', say: 'あかりちゃんはリハビリで車いすに乗れるようになり、レン君は吸入を続けると約束して退院した。' },
        { who: 'scene', say: 'NICU のあおい君は 1,400 g を超えた。退院したハルト君からは、手紙が届いている。' },
        { who: 'scene', say: '封筒には、大きな字で「{名前}せんせいへ」。' },
        { who: 'pt', case: 'postop', name: 'ハルト君（手紙）', say: '「ぼくがねてるとき、ずっとそばにいてくれて、ありがとう。またサッカーできたよ。」' },
        { who: 'doc', say: '{名前}先生。初日に、子どもの呼吸器は触ったことがないと言っていましたね。' },
        { who: 'me', say: '…はい。いまも、全部分かったとは思えません。' },
        { who: 'doc', mood: 'happy', say: 'それでいいんです。分からないと思える人は、確かめに戻ってこられます。' },
        { who: 'doc', say: '初日、とても緊張していると言っていましたね。その緊張が、ずっと子どもたちを守っていました。', when: 'nerves:0' },
        { who: 'doc', say: '初日、楽しみだと言っていましたね。その顔のまま、最後まで来ました。', when: 'nerves:1' },
        { who: 'me', say: '先生。NICU の写真の続き、聞いてもいいですか。', bgm: 'memory' },
        { who: 'doc', mood: 'happy', say: '約束でしたね。', when: 'photo:0' },
        { who: 'doc', mood: 'happy', say: 'あの写真の前で、何も聞かずにいてくれましたね。…お話しします。', when: 'photo:1' },
        { who: 'doc', say: 'わたしは 28 週、980 g で生まれて、2 週間、呼吸器につながっていました。' },
        { who: 'doc', say: '管が抜けて、初めて自分で息をした日。両親は、この名前に決めたそうです。息吹。' },
        { who: 'puku', mood: 'excited', say: 'そのとき、ぼくが生まれたんだ！ 先生の、はじめての息から。' },
        { who: 'doc', say: '…ということに、なっています。研修医としてここへ戻った日、ポケットから出てきました。' },
        { who: 'doc', mood: 'think', say: '「息を引き取る」という言葉があります。始まりが息なら、終わりも息で言い表すんです。' },
        { who: 'doc', say: 'そのあいだを少しでも長く、楽にする。それが、わたしたちの仕事です。' },
        { who: 'puku', say: 'ねえ{名前}先生。初日に聞いたこと、覚えてる？ なに科になるの？', bgm: 'epilogue' },
        { who: 'me', say: '…やっぱり、小児科です。ここに戻ってきたいです。', when: 'path:0' },
        { who: 'doc', mood: 'happy', say: '待っています。わたしも、そうやってここへ戻ってきましたから。', when: 'path:0' },
        { who: 'me', say: 'まだ決めていません。でも、子どもの息の音は、たぶん一生忘れません。', when: 'path:1' },
        { who: 'doc', mood: 'happy', say: 'それで十分です。どの科にも、息をする子どもは来ます。', when: 'path:1' },
        { who: 'me', say: '進む科は変わりません。でも、子どもが来たら、逃げずに診ます。', when: 'path:2' },
        { who: 'doc', mood: 'happy', say: 'それが聞けたら、このローテは成功です。', when: 'path:2' },
        { who: 'puku', mood: 'sad', say: '{名前}先生、ぼくのこと、忘れないでね。' },
        { who: 'doc', mood: 'happy', say: '忘れませんよ。呼吸器の前に立つたびに、「なんで？」と聞く声がするはずです。' },
        { who: 'puku', mood: 'happy', say: '…ねえ、{名前}先生のポケット、ちょっとあったかそう。' },
        { who: 'doc', mood: 'happy', say: 'ふふ。そうかもしれませんね。' },
        { who: 'doc', say: '最後に、ひとりで受け持ってみてください。症例は 6 人。わたしは、呼ばれたら行きます。' },
        { who: 'scene', say: 'ベッドの横で、まだ誰にもつながっていない呼吸器が、起動を待っている。' },
        { who: 'doc', mood: 'think', say: '人形や物語に命を与えることを、「息を吹き込む」と言いますね。' },
        { who: 'doc', mood: 'happy', say: 'この機械がするのも、同じことです。吹き込むのは、{名前}先生の手です。' },
        { who: 'scene', say: '{名前}先生は、起動スイッチに指をかけた。' }
      ]
    }
  ];

  /* ===================== 研修手帳 =====================
   * 主人公が書き留めていく手帳。幕を見るたびに書き足され、メニューの「研修手帳」で読める。
   *   secret … いぶき先生のこと。幕の中の断片を、主人公の目で書き留めたもの。エピローグで回収する。
   *   lore   … 息のことば。呼吸を人がどう言い表し、どう扱ってきたか。出典を添える。
   *   growth … できるようになったこと。章の幕ごとに 1 つ。初日の自分（before）といま（now）。
   * scene はその幕を見たら書き足される幕の id。hint はまだ書いていない欄に出す時期。 */
  var NOTEBOOK = [
    /* ---- いぶき先生のこと ---- */
    { id: 'secret-1', kind: 'secret', scene: 'prologue', hint: 'ローテ初日の朝', title: '息から生まれた',
      text: 'ぷくぷくは、ここの子たちの「息」から生まれた…ということに、なっているらしい。いぶき先生は、28 週の赤ちゃんの保育器の前で、少しだけ長く立ち止まっていた。' },
    { id: 'secret-2', kind: 'secret', scene: 'ch2-close', hint: '2 日目の昼すぎ', title: '息吹という名前',
      text: '先生の名前は、息を吹くと書いて「息吹」。ご両親がつけたそうだ。理由を言いかけたぷくぷくを、先生は止めた。' },
    { id: 'secret-3', kind: 'secret', scene: 'ch5-close', hint: '2 回目の当直の明け方', title: '最初の当直の夜',
      text: '先生が研修医だったころの最初の当直の夜も、ぷくぷくはポケットで震えていたらしい。ぷくぷくは、そんなに前から先生と一緒にいる。' },
    { id: 'secret-4', kind: 'secret', scene: 'ch6-close', hint: 'ハルト君が抜管した日', title: '親は一生覚えている',
      text: '「チューブが抜けた日のことを、子どもは覚えていません。でも、親は一生覚えています」。そう言った先生は、どこか遠くを見ていた。' },
    { id: 'secret-5', kind: 'secret', scene: 'ch8-close', hint: 'ミオちゃんの 12 日目', title: '先生のお母さん',
      text: 'ぷくぷくは、いぶき先生のお母さんを知っているようだ。「前にそう言ってた」。先生は名前を呼んだだけで、その先を言わせなかった。' },
    { id: 'secret-6', kind: 'secret', scene: 'ch9-close', hint: 'NICU の 2 週目', title: '色あせた写真',
      text: 'NICU を巣立った子どもたちの写真の端に、「いぶきちゃん　在胎 28 週　980 g」。先生も、ここの保育器で育った。' },
    { id: 'secret-7', kind: 'secret', scene: 'epilogue', hint: 'ローテ最終日', title: 'はじめての息',
      text: '先生は 2 週間呼吸器につながり、初めて自分で息をした日に「息吹」と名づけられた。ぷくぷくはその息から生まれた…と、先生は思っている。研修医としてここへ戻った日、ポケットから出てきたそうだ。' },

    /* ---- 息のことば ---- */
    { id: 'lore-reed', kind: 'lore', scene: 'ch1-close', hint: '初日の夜', title: '葦の管',
      text: '1543 年、解剖学者ヴェサリウスは『人体の構造について（ファブリカ）』に、動物の気管に葦の管を入れて息を吹き込み、肺をふくらませ続ける方法を書いた。記録に残る人工呼吸のはじまりの 1 つとされる。',
      source: 'A. Vesalius『De humani corporis fabrica』1543 年' },
    { id: 'lore-spirit', kind: 'lore', scene: 'ch2-close', hint: '2 日目の昼すぎ', title: 'spirit と inspiration',
      text: '吸気 inspiration と呼気 expiration は、ラテン語 spirare（息をする）から。spirit（霊・精神）、inspiration（ひらめき＝息を吹き込まれること）、expire（息を吐ききる→命が尽きる、期限が切れる）、respiration（呼吸）も同じ根を持つ。',
      source: '英語の語源辞典（Online Etymology Dictionary など）' },
    { id: 'lore-kanji', kind: 'lore', scene: 'ch3-close', hint: '2 日目の夕方', title: '「息」という字',
      text: '「息」は「自」と「心」でできている。後漢の字書『説文解字』は「自」を鼻と説く。休息・安息のように、「やすむ」という意味も持つ。',
      source: '許慎『説文解字』' },
    { id: 'lore-fire', kind: 'lore', scene: 'ch4-open', hint: '3 日目の朝', title: '呼吸はゆっくりした燃焼',
      text: '18 世紀の終わり、ラボアジエはラプラスとともに、呼吸は炭が燃えるのと同じく酸素を使って二酸化炭素を出す、ゆっくりした燃焼だと示した。「酸素」という日本語は、蘭学者・宇田川榕菴が『舎密開宗』で用いた訳語。',
      source: 'Lavoisier & Laplace「熱についての論考」1783 年／宇田川榕菴『舎密開宗』' },
    { id: 'lore-pneuma', kind: 'lore', scene: 'ch5-close', hint: '2 回目の当直の明け方', title: 'プネウマ',
      text: 'ギリシャ語 pneuma は「息・風・霊」。気胸 pneumothorax は pneuma と胸 thorax から。肺炎 pneumonia は肺 pneumon からで、同じ「息をする」の語に連なる。古代ギリシャ・ローマの医学は、体をめぐる生命の息をプネウマと呼んだ。',
      source: '医学用語の語源（ギリシャ語）' },
    { id: 'lore-voice', kind: 'lore', scene: 'ch6-close', hint: 'ハルト君が抜管した日', title: '声は吐く息',
      text: '声は、吐く息が声帯を震わせて生まれる。挿管中はチューブが声帯のあいだを通るので、声が出ない。抜管のあとの最初の声は、自分の息が戻ってきた合図。',
      source: '発声の生理' },
    { id: 'lore-musuko', kind: 'lore', scene: 'ch7-close', hint: 'そうた君の 8 日目', title: '息子',
      text: '「息」には、生まれる・ふえるという意味もある（子息、利息）。「むすこ」の「むす」は「苔むす」の「むす」と同じで、生まれる・生じるという意味。',
      source: '国語辞典・漢和辞典' },
    { id: 'lore-copenhagen', kind: 'lore', scene: 'ch8-close', hint: 'ミオちゃんの 12 日目', title: 'コペンハーゲン 1952',
      text: '1952 年、コペンハーゲンでポリオが大流行した。麻酔科医イプセンの提案で、気管切開と手で押す陽圧換気が行われ、千人を超える医学生が交代でバッグを押し続けた。死亡率は大きく下がり、集中治療室のはじまりとされる。',
      source: 'B. Ibsen ほか、1952 年コペンハーゲンのポリオ流行の記録' },
    { id: 'lore-surfactant', kind: 'lore', scene: 'ch9-open', hint: 'NICU の 2 週目', title: '藤原哲郎とサーファクタント',
      text: '1980 年、岩手医科大学の藤原哲郎らは、人工サーファクタントで早産児の呼吸窮迫症候群（RDS）を治療した成果を Lancet に報告した。この治療は、のちに世界の標準になった。',
      source: 'Fujiwara T, et al. Lancet 1980;1:55–59' },
    { id: 'lore-ubugoe', kind: 'lore', scene: 'ch9-close', hint: 'あおい君の 4 日目', title: '産声',
      text: '生まれる前の肺は、水で満たされている。生まれてすぐの大きな息で肺に空気が入り、その息を吐きながら上げるのが産声。',
      source: '新生児の呼吸の生理' },
    { id: 'lore-kokyu', kind: 'lore', scene: 'ch10-open', hint: '3 週目の当直', title: '呼が先',
      text: '「呼吸」の「呼」は吐く、「吸」は吸う。呼気・吸気も同じ並び。吐ききらなければ、次の息は入らない。',
      source: '漢和辞典' },
    { id: 'lore-asthma', kind: 'lore', scene: 'ch10-close', hint: 'レン君が病棟へ移る日', title: 'アズマ',
      text: '喘息 asthma は、ギリシャ語の asthma（あえぎ・息切れ）から。ヒポクラテス派の医学書にも、すでにこの言葉が出てくる。',
      source: '医学用語の語源（ギリシャ語）' },
    { id: 'lore-ironlung', kind: 'lore', scene: 'ch11-open', hint: 'あかりちゃんの 4 週目', title: '鉄の肺',
      text: '1928 年、ボストンのドリンカーとショウは、首から下を密閉した箱に入れ、箱の中の圧を下げて胸を広げる「鉄の肺」を実用化した。ポリオで呼吸の筋肉がまひした多くの子どもが、その中で回復を待った。',
      source: 'Drinker P, Shaw LA. J Clin Invest 1929;7:229–247' },
    { id: 'lore-hikitoru', kind: 'lore', scene: 'epilogue', hint: 'ローテ最終日', title: '息を引き取る',
      text: '亡くなることを「息を引き取る」という。最期の息を体に引き入れて、それきり終わる、という見方がよく知られる（語源には諸説ある）。人の始まりも終わりも、息で言い表されてきた。',
      source: '国語辞典（語源は諸説）' },

    /* ---- できるようになったこと ---- */
    { id: 'growth-ch1', kind: 'growth', scene: 'ch1-close', hint: '初日の夜', title: '呼吸器の画面を読む',
      before: '線と数字が並ぶ画面の、どこから見ればいいか分からなかった。',
      now: '3 本の波形、PIP と Pplat、肺の硬さ（コンプライアンス）と気道の通りにくさ（抵抗）を読める。' },
    { id: 'growth-ch2', kind: 'growth', scene: 'ch2-close', hint: '2 日目の昼すぎ', title: '初期設定を決める',
      before: '設定は「誰かが入れてくれたもの」だった。',
      now: '体重から一回換気量を、そこから回数を決め、PEEP と FiO₂ で酸素化を合わせられる。' },
    { id: 'growth-ch3', kind: 'growth', scene: 'ch3-close', hint: '2 日目の夕方', title: 'モードを選ぶ',
      before: '量で決めるか圧で決めるか、何が違うのか分からなかった。',
      now: '量か圧か、トリガ、SIMV と PSV。機械に任せることと、子どもに預けることを選べる。' },
    { id: 'growth-ch4', kind: 'growth', scene: 'ch4-close', hint: '3 日目の夕方', title: '血液ガスで答え合わせ',
      before: '並んだ数字の、どれから見ればいいか分からなかった。',
      now: '4 つの手順で読み、CO₂ は換気量で、酸素化は PEEP と FiO₂ で動かせる。CO₂ を許す理由も言える。' },
    { id: 'growth-ch5', kind: 'growth', scene: 'ch5-close', hint: '2 回目の当直の明け方', title: 'アラームに順番で動く',
      before: 'アラームが鳴ると、頭が真っ白になった。',
      now: '圧の上昇、吐ききれない息、SpO₂ の低下を、決めた順番で切り分けられる。' },
    { id: 'growth-ch6', kind: 'growth', scene: 'ch6-close', hint: 'ハルト君が抜管した日', title: '外す',
      before: '「つける」ことしか考えていなかった。',
      now: '離脱の条件を確かめ、SBT で見極め、抜管したあとを見守れる。' },
    { id: 'growth-ch7', kind: 'growth', scene: 'ch7-close', hint: 'そうた君の 8 日目', title: '細い気道の乳児を受け持つ',
      before: '回数を上げれば CO₂ は下がる、と思っていた。',
      now: '吐ける回数で組み、痰づまりに手を打ち、高流量鼻カニュラへつなげられる。' },
    { id: 'growth-ch8', kind: 'growth', scene: 'ch8-close', hint: 'ミオちゃんの 12 日目', title: '一から組み直す',
      before: 'チューブが抜けたら、何から始めればいいか分からなかった。',
      now: '量、PEEP、酸素、回数の順に組み直し、良くなるにつれて酸素と PEEP を下げていける。' },
    { id: 'growth-ch9', kind: 'growth', scene: 'ch9-close', hint: 'あおい君の 4 日目', title: '手のひらの肺',
      before: '小さじ 1 杯の空気の世界は、見学するだけだった。',
      now: '1 kg の子の初期設定を決め、サーファクタントのあとに合わせ、CPAP へ抜管できる。' },
    { id: 'growth-ch10', kind: 'growth', scene: 'ch10-close', hint: 'レン君が病棟へ移る日', title: '吐かせる換気',
      before: '息は「吸わせるもの」だと思っていた。',
      now: '吐ききれているかを先に見て、回数を落とし、CO₂ を許しながら血圧を守れる。' },
    { id: 'growth-ch11', kind: 'growth', scene: 'ch11-close', hint: 'あかりちゃんの 4 週目', title: '休ませながら鍛える',
      before: '一度だめだった SBT は、失敗だと思っていた。',
      now: '弱った呼吸の筋肉を休ませながら鍛え、3 回目の SBT で抜管へつなげられる。' }
  ];

  var NOTE_KINDS = [
    { kind: 'secret', label: 'いぶき先生のこと', tab: '先生のこと' },
    { kind: 'lore', label: '息のことば', tab: '息のことば' },
    { kind: 'growth', label: 'できるようになったこと', tab: 'できること' }
  ];

  /* 書き足されている手帳の項目（見た幕で決まる）。 */
  function notesOpen(seen) {
    return NOTEBOOK.filter(function (n) { return seen.indexOf(n.scene) >= 0; });
  }

  /* 幕を見る前と後の既読から、新しく書き足された項目を返す。 */
  function notesAdded(seenBefore, seenAfter) {
    return NOTEBOOK.filter(function (n) { return seenBefore.indexOf(n.scene) < 0 && seenAfter.indexOf(n.scene) >= 0; });
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
  /* when: 'key:n' の行を出すかどうか。picks は { key: 選んだ番号 }。 */
  function shows(line, picks) {
    if (!line || !line.when) return true;
    var m = /^([\w-]+):(\d+)$/.exec(line.when);
    if (!m) return true;
    var got = picks && picks[m[1]] != null ? picks[m[1]] : 0;
    return got === Number(m[2]);
  }

  function Run(scene, picks) {
    this.scene = scene;
    this.picks = picks || {};
    this.index = 0;
    this.phase = scene.card ? 'card' : 'line';
    this.reply = null;       // 選択肢のあとの返し（1 行）
    this.picked = null;
    this.settle();
  }

  /* いまの行が出さない行なら、出す行まで進める。最後まで無ければ終わり。 */
  Run.prototype.settle = function () {
    var ls = this.scene.lines;
    while (this.index < ls.length && !shows(ls[this.index], this.picks)) this.index++;
    if (this.index >= ls.length && this.phase === 'line') this.phase = 'end';
  };

  /** いま流す曲。いまの行までで最後に bgm を書いた行の曲、無ければ幕の bgm、無ければ幕の時刻。 */
  Run.prototype.track = function () {
    var ls = this.scene.lines, i = Math.min(this.index, ls.length - 1);
    if (this.phase !== 'card') for (; i >= 0; i--) if (ls[i].bgm && shows(ls[i], this.picks)) return ls[i].bgm;
    return this.scene.bgm || this.scene.time || 'day';
  };

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
    if (this.phase === 'card') { this.phase = 'line'; this.settle(); return this.phase === 'end'; }
    if (this.waiting()) return false;
    if (this.reply) this.reply = null;
    this.index++;
    this.settle();
    if (this.index >= this.scene.lines.length) { this.phase = 'end'; return true; }
    return false;
  };

  /** 名前を入れた。次の行へ進む。 */
  Run.prototype.submit = function () {
    if (this.waiting() !== 'input') return false;
    this.index++;
    this.settle();
    if (this.index >= this.scene.lines.length) this.phase = 'end';
    return true;
  };

  Run.prototype.pick = function (i) {
    if (this.waiting() !== 'choose') return false;
    var c = this.line().choose[i];
    if (!c) return false;
    this.picked = i;
    if (this.line().pick) this.picks[this.line().pick] = i;
    this.reply = { who: c.who || 'doc', mood: c.mood || (c.who ? undefined : 'happy'), name: c.name, case: c.case,
      say: c.reply, isReply: true };
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
    SCENES: SCENES, SPEAKER: SPEAKER, BG: BG, CHAPTER_TIME: CHAPTER_TIME, CHAPTER_BGM: CHAPTER_BGM, LAST_CHAPTER: LAST_CHAPTER,
    DEFAULT_NAME: DEFAULT_NAME, NAME_MAX: NAME_MAX,
    sceneById: sceneById, cleanName: cleanName, fill: fill, speakerName: speakerName, shows: shows,
    before: before, after: after, Run: Run,
    NOTEBOOK: NOTEBOOK, NOTE_KINDS: NOTE_KINDS, notesOpen: notesOpen, notesAdded: notesAdded
  };
  root.VentStory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
