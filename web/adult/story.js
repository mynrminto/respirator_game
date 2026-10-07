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
        { who: 'doc', mood: 'happy', say: 'ぷくぷくです。ここの患者さんたちの「息」から生まれた…ということに、なっています。' },
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
        { who: 'me', say: '佐藤さん、よくがんばりましたね。' }
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
        { who: 'me', say: '呼吸器の設定が、心臓の薬みたいに効くとは思いませんでした。' }
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
        { who: 'doc', mood: 'happy', say: '忘れませんよ。呼吸器の前に立つたびに、「なんで？」と聞く声がするはずです。' },
        { who: 'doc', say: '最後に、ひとりで受け持ってみてください。症例は 6 人。わたしは、呼ばれたら行きます。' }
      ]
    }
  ];

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
    before: before, after: after, Run: Run
  };
  root.VentStory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
