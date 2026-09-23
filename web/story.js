/* VentSim — ゲーム全体を貫く物語。
 * 主人公は、初期研修で小児科を回りはじめた研修医（プレイヤー）。いぶき先生が指導医、
 * ぷくぷくは「息」から生まれた精で、主人公の代わりに「なんで？」と聞く。
 * 縦糸は、ローテ初日の夜に受け持つ術後のハルト君（8歳）が抜管するまで。
 *
 * レッスンの中の会話（lessons.js の talk）とは別に、ここには「幕」を置く。
 *   prologue   … いちばん最初にコースへ入るとき（名前を決める）
 *   chN-open   … その章のレッスンを初めて始めるとき（章の扉）
 *   chN-close  … その章の最後のレッスンを初めて終えたとき
 *   epilogue   … 第6章の幕のあと
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

  /* 背景。左から順に、届いている画像を使う（新しい絵が届くまでは今ある絵で代える）。 */
  var BG = {
    corridor: ['bg_story_corridor', 'bg_title_day'],
    picu: ['bg_title_day'],
    nicu: ['bg_story_nicu', 'bg_title_day'],
    night: ['bg_title_night'],
    station: ['bg_story_station', 'bg_title_night'],
    dawn: ['bg_story_dawn', 'bg_title_day']
  };

  var SCENES = [

    /* ===================== プロローグ ===================== */
    {
      id: 'prologue', kind: 'prologue', title: 'プロローグ　はじめての小児科',
      card: { kicker: 'プロローグ', title: 'はじめての小児科', sub: 'ローテーション初日　朝 8 時' },
      bg: 'corridor',
      lines: [
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
          who: 'doc', mood: 'think', say: '{名前}先生、緊張していますか？',
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
      bg: 'night',
      lines: [
        { who: 'scene', say: '午後 8 時。手術室から、ハルト君のベッドが運ばれてきた。麻酔科医が、手際よく呼吸器につなぎ替えていく。' },
        { who: 'nurse', say: '呼吸器、つながりました。ノルアドレナリンは 0.1 で続いています。設定は麻酔科の先生が入れてくれています。' },
        { who: 'puku', mood: 'sad', say: '画面に線と数字がいっぱい…。どこから見ればいいの？' },
        { who: 'doc', say: '全部を一度に見なくていい。{名前}先生、今夜は「読む」ことだけに集中しましょう。' }
      ]
    },
    {
      id: 'ch1-close', kind: 'close', chapter: 'ch1', title: '第1章　幕　午前 0 時',
      bg: 'station',
      lines: [
        { who: 'scene', say: '午前 0 時。ハルト君の数字は落ち着いている。ナースステーションには、モニターの音だけが続いている。' },
        { who: 'doc', mood: 'happy', say: '今夜、{名前}先生は 3 つ覚えました。波形の読み方。圧が 2 つあること。肺の柔らかさと、気道の通りにくさ。' },
        { who: 'me', say: '読めるようにはなりました。でも、どう設定すればいいのかは、まだ…。' },
        { who: 'doc', say: 'それは明日。朝の回診で、ハルト君の設定を一から見直します。' },
        { who: 'puku', mood: 'happy', say: '（あくびをして）ぷく…。明日も、ぼくついていくね。' }
      ]
    },

    /* ===================== 第2章 ===================== */
    {
      id: 'ch2-open', kind: 'open', chapter: 'ch2', title: '第2章　扉　2 日目の朝',
      card: { kicker: '第2章', title: '挿管直後の初期設定', sub: '2 日目の朝　回診' },
      bg: 'picu',
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
      bg: 'picu',
      lines: [
        { who: 'scene', say: '昼すぎ。ハルト君の指示票に、{名前}先生の字で書いた設定が並んでいる。' },
        { who: 'doc', mood: 'happy', say: '体重から量を、量から回数を。酸素は下げられるだけ下げる。いい初期設定です。' },
        { who: 'me', say: '設定の 1 つ 1 つに、こんなに理由があるんですね。' },
        { who: 'nurse', say: 'いぶき先生、3 番ベッドのミオちゃん、また酸素化が悪くなってきています。' },
        { who: 'doc', mood: 'alert', say: '行きましょう。同じ理屈が、硬い肺ではまったく違う顔を見せます。' }
      ]
    },

    /* ===================== 第3章 ===================== */
    {
      id: 'ch3-open', kind: 'open', chapter: 'ch3', title: '第3章　扉　3 番ベッド',
      card: { kicker: '第3章', title: 'モードの違い', sub: '2 日目の午後　PICU 3 番ベッド' },
      bg: 'picu',
      lines: [
        { who: 'scene', say: 'インフルエンザ肺炎から ARDS になったミオちゃん（3歳）。お母さんが、ベッドの横で小さな手を握っている。' },
        { who: 'fam', name: 'ミオちゃんのお母さん', say: '先生、この子、ずっとこのままなんでしょうか…。' },
        { who: 'doc', say: '肺を休ませながら、治るのを待っているところです。いまは、その待ち方をいちばん安全にします。' },
        { who: 'puku', say: '待ち方？' },
        { who: 'doc', say: '機械に何を任せて、何をこの子に預けるか。それを選ぶのが「モード」です。' }
      ]
    },
    {
      id: 'ch3-close', kind: 'close', chapter: 'ch3', title: '第3章　幕　夕方',
      bg: 'picu',
      lines: [
        { who: 'scene', say: '夕方。ハルト君はうとうとしながら、自分のペースで息をしている。' },
        { who: 'pt', case: 'postop', name: 'ハルト君', say: '（チューブがあって話せない。かわりに指で、小さな OK をつくってみせる）' },
        { who: 'puku', mood: 'excited', say: 'いま、ハルト君が OK って！' },
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
      bg: 'station',
      lines: [
        { who: 'scene', say: '3 日目の朝。回診の前に、ナースステーションに夜のあいだの採血の結果が並んでいる。' },
        { who: 'me', say: '数字が多すぎて、どれから見ればいいのか…。' },
        { who: 'doc', say: '呼吸器の画面は「送ったもの」。血液ガスは「体に届いたもの」。両方を見て、はじめて答え合わせになります。' },
        { who: 'puku', mood: 'happy', say: '答え合わせ、ぼく得意！ …たぶん。' }
      ]
    },
    {
      id: 'ch4-close', kind: 'close', chapter: 'ch4', title: '第4章　幕　夕方',
      bg: 'picu',
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
      bg: 'station',
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
      bg: 'dawn',
      lines: [
        { who: 'scene', say: '夜明け。ハルト君の胸には細いドレーンが入り、モニターの音はまた高く澄んだ音に戻っている。' },
        { who: 'me', say: '手が震えていました。でも、酸素を上げるところまでは、考える前にできました。' },
        { who: 'doc', mood: 'happy', say: 'それで十分です。今夜ハルト君を守ったのは、{名前}先生の最初の一手です。' },
        { who: 'doc', mood: 'think', say: '夕方の管の針が、肺の表面をかすめたのかもしれません。そこから、機械の圧で空気が漏れました。' },
        { who: 'puku', mood: 'sad', say: 'ぼく、ずっとポケットの中で震えてた…。' },
        { who: 'doc', say: 'ここから先は、外す話です。つけるより、外すほうが難しい。' }
      ]
    },

    /* ===================== 第6章 ===================== */
    {
      id: 'ch6-open', kind: 'open', chapter: 'ch6', title: '第6章　扉　4 日目の朝',
      card: { kicker: '第6章', title: '離脱と抜管', sub: '4 日目の朝　PICU' },
      bg: 'picu',
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
      bg: 'picu',
      lines: [
        { who: 'scene', say: '抜管から 1 時間。ハルト君は酸素マスクをつけて、自分でしっかり咳をしている。' },
        { who: 'pt', name: 'ハルト君', say: '…せんせい。のど、いたい。' },
        { who: 'puku', mood: 'excited', say: 'しゃべった！' },
        { who: 'fam', name: 'ハルト君のお母さん', say: 'ハルト…！ 先生、ほんとうにありがとうございました。' },
        { who: 'doc', mood: 'happy', say: 'お礼は、こちらの先生に。最初の夜から、ずっとハルト君の担当でした。' },
        { who: 'me', say: 'ハルト君、よくがんばったね。' }
      ]
    },

    /* ===================== エピローグ ===================== */
    {
      id: 'epilogue', kind: 'epilogue', title: 'エピローグ　ローテーション最終日',
      card: { kicker: 'エピローグ', title: 'ローテーション最終日', sub: '夕方　PICU' },
      bg: 'dawn',
      end: { label: '症例で練習する', action: 'cases', say: 'おつかれさまでした。コースの物語はここまでです。6 人の症例を、今度はひとりで受け持ってみましょう。' },
      lines: [
        { who: 'scene', say: '4 週間のローテーション、最終日。夕方の PICU で、また新しい入院の電話が鳴っている。' },
        { who: 'scene', say: 'ベッドの顔ぶれは入れ替わった。ミオちゃんは一般病棟へ移り、そうた君はとうに家へ帰った。' },
        { who: 'scene', say: 'あかりちゃんも先週抜管され、リハビリで車いすに乗れるようになった。退院したハルト君からは、手紙が届いている。' },
        { who: 'doc', say: '{名前}先生。初日に、子どもの呼吸器は触ったことがないと言っていましたね。' },
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
    if (chapter.id === 'ch6' && seen.indexOf('epilogue') < 0) out.push('epilogue');
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
    SCENES: SCENES, SPEAKER: SPEAKER, BG: BG,
    DEFAULT_NAME: DEFAULT_NAME, NAME_MAX: NAME_MAX,
    sceneById: sceneById, cleanName: cleanName, fill: fill, speakerName: speakerName,
    before: before, after: after, Run: Run
  };
  root.VentStory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
