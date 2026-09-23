/* VentSim — 学習コース。
 * 方針は「読んで覚える」ではなく「まず触る → 結果を見る → 一言で意味を添える」。
 * だから say は一息で読める指示だけにし、理屈は操作が終わったあとの why に回す。
 * 背景の解説（brief）は帯の「解説」ボタンからいつでも読めるが、読まなくても先に進める。
 * ここはデータと判定ロジックだけを持ち、描画は app.js が行う。node からも読み込めるようにしてある。
 *
 * 課題 (task) は次のどれかで先に進む。
 *   talk: true    … 会話・ト書きの場面。「続ける」を押すと進む。who で話し手を決める。
 *                   who: 'scene'（ト書き）/ 'doc'（いぶき先生）/ 'puku'（ぷくぷく）/ 'pt'（患者・家族）。
 *   check(c)      … 毎フレーム判定する。hold を付けるとその秒数（シミュレーション内）満たし続ける必要がある。
 *   event: 'name' … 機器のキーが押されたなどの出来事で進む。
 *   quiz          … 選択肢に答えると進む。q は文字列でも関数（実測値から作る）でもよい。
 * 課題には表示の指定も付けられる。
 *   watch: ['Pplat', …] … その計測値を帯の中にも出す。課題に入った時点の値を控え、あとで「前 → 後」で見せる。
 *   spot:  'key:vt'     … いま押す／見るところを光らせる。文章で場所を説明しないための仕掛け。
 *                         'key:<設定キー>' / 'val:<計測値>' / 'hard:<ハードキーの id>' /
 *                         'mode:<モード>' / 'screen:<画面>' / 'dial' / 'wave'。配列も可。
 * c は { e, s, m, pbw, abgs, lastAbg, sbt, mem } を持つ判定用コンテキスト。
 */
(function (root) {
  'use strict';

  function pf(g) { return g.pao2 / g.fio2; }
  function vtPerKg(c) { return c.m.vte / c.pbw; }
  /* 体重が 1 kg から 35 kg まで動くので、目標値は必ず体重から作る。 */
  function mlkg(c, x) { var v = c.pbw * x; return c.pbw < 6 ? v.toFixed(1) : String(Math.round(v)); }
  /* ポーズの測定が終わったかどうか。押した直後に次へ進んでしまわないように使う。 */
  function paused(c) { return c.e.hold == null && c.e.holdPending == null; }

  /* ===================== 第1章 機械を読む ===================== */

  var CH1 = {
    id: 'ch1', title: '第1章　機械を読む', tag: '基礎',
    sub: '波形と数字が何を言っているのかを、まず読めるようにする。',
    lessons: [

      {
        id: '1-1', title: '画面には何が出ているのか', minutes: 3,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 150, rr: 20, peep: 5, fio2: 0.4, flow: 18, pause: 0 },
        brief: [
          '波形は上から 気道内圧 Paw（黄）／ 流量 Flow（緑）／ 換気量 Volume（青）。1 画面で約 8 秒。',
          '流量だけがゼロ線をまたぐ。上が吸気、下が呼気。',
          '設定の Vt は人が決めた量、Vte は実際に戻ってきた量。小児では mL/kg で読む。'
        ],
        points: ['波形は上から Paw / Flow / Volume', '流量波形は上が吸気・下が呼気',
          '設定の Vt と実測の Vte は別物'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '午後 8 時、PICU。虫垂炎の手術を終えたハルト君（8歳）が、挿管されたまま運ばれてきた。'
          },
          {
            talk: true, who: 'doc',
            say: '今夜の担当はあなたです。まずは、この機械が何を言っているのかを読めるようにしましょう。'
          },
          {
            talk: true, who: 'puku',
            say: 'うわ、波形が 3 つもある…。どれが何なの？'
          },
          {
            talk: true, who: 'doc',
            say: '上から 気道内圧、流量、換気量。どれがどれかは、動き方で見分けられます。'
          },
          {
            spot: 'wave',
            quiz: {
              q: '真ん中の緑の波形だけがゼロ線をまたいで上下しています。これは何ですか。',
              choices: ['気道内圧', '流量', '換気量', '二酸化炭素濃度'],
              answer: 1,
              why: '流量です。上が吸気、下が呼気。上下するのは流量だけなので、これが見分けの目印になります。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '読めましたね。次は触ってみましょう。実機は 3 段階です。キーを押す、ダイヤルを回す、確定。'
          },
          {
            say: 'Vt を 180 mL にして確定してください。',
            hint: 'キーを押す → ダイヤルを回す → 確定。この 3 段階が実機の操作です。',
            spot: 'key:vt', watch: ['Vte'],
            check: function (c) { return c.s.vt === 180; },
            why: '確定を押すまで患者には反映されません。実機の誤操作防止と同じです。'
          },
          {
            say: 'Vte が設定に追いつくまで待ちます。',
            spot: 'val:Vte', watch: ['Vte', 'MV'],
            check: function (c) { return c.m.vte > 160; },
            why: 'VC は入れる量を機械が保証するので、Vte はほぼ設定どおりに返ってきます。'
          },
          {
            talk: true, who: 'puku',
            say: '入れた量と、戻ってくる量って、ちがうことあるの？'
          },
          {
            talk: true, who: 'doc',
            say: 'あります。しかもそれが、いちばん最初に気づくべき異常です。'
          },
          {
            quiz: {
              q: '設定 180 mL に対して Vte が 120 mL しか戻りません。まず疑うのは何ですか。',
              choices: ['正常。気にしなくてよい', '気管チューブ周囲のリーク', '鎮静が浅い', 'FiO₂ が低い'],
              answer: 1,
              why: '入れた量より戻る量が少なければリークです。カフなしチューブの年齢では日常的に起こります。'
                + 'カフ圧・回路の接続・チューブの深さを確認し、20% を超えるなら 1 サイズ太いチューブを考えます。'
            }
          }
        ]
      },

      {
        id: '1-2', title: 'PIP と Pplat ─ 圧は 2 つある', minutes: 5,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4, flow: 30, pause: 0 },
        brief: [
          'PIP ＝ ガスを気道に押し流す圧（流量 × 抵抗）＋ 肺を膨らませる圧（換気量 ÷ コンプライアンス）。',
          '吸気の終わりに流れを止めると前者が消え、残るのが Pplat。肺胞が受けている圧に近い。',
          '肺を傷めるのは PIP ではなく Pplat と ΔP（＝ Pplat − PEEP）。上限は年齢が下がるほど低い。'
        ],
        points: ['PIP = 抵抗の分 + 肺を膨らませる分', 'Pplat は吸気ポーズで測る',
          '上限は年齢で変わる（タイルの下に出ている）'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'ハルト君の設定はひとまず落ち着いた。いぶき先生が、画面の圧の数字を指さす。'
          },
          {
            talk: true, who: 'doc',
            say: 'PIP は {PIP}。でもこの数字だけでは、肺に何がかかっているかは分かりません。'
          },
          {
            talk: true, who: 'puku',
            say: 'え、圧は圧じゃないの？'
          },
          {
            talk: true, who: 'doc',
            say: '圧は 2 つあるんです。流れを押す分と、肺を膨らませる分。分けて測ってみましょう。'
          },
          {
            say: '「吸気ポーズ」を押してください。',
            spot: 'hard:kInsp',
            event: 'hold:insp',
            why: '次の吸気の終わりで弁が閉じ、圧が平らになります。'
          },
          {
            say: '測り終わるのを待ちます。',
            spot: 'val:Pplat', watch: ['PIP', 'Pplat', 'ΔP'],
            check: function (c) { return c.m.pplat != null && c.m.dp != null; },
            why: '平らになったところが Pplat。流れが止まったあとに残っている、肺胞の圧です。'
          },
          {
            talk: true, who: 'doc',
            say: '2 つに分かれました。どちらが何なのか、ここで確かめておきましょう。'
          },
          {
            watch: ['PIP', 'Pplat', 'PEEP tot'],
            quiz: {
              q: '出ている 3 つの数字のうち、気道抵抗にとられている分はどれですか。',
              choices: ['PIP − Pplat', 'Pplat − PEEP', 'PIP − PEEP', 'PEEP そのもの'],
              answer: 0,
              why: 'PIP と Pplat の差が抵抗成分です。ここが大きいときは痰・チューブの屈曲・気管支攣縮を考えます。'
            }
          },
          {
            watch: ['Pplat', 'PEEP tot', 'ΔP'],
            quiz: {
              q: 'では、肺胞が 1 回の呼吸で引き伸ばされる圧（ΔP）はどれですか。',
              choices: ['PIP − Pplat', 'Pplat − PEEP', 'PIP − PEEP', 'Vte ÷ Pplat'],
              answer: 1,
              why: 'ΔP ＝ Pplat − PEEP。予後との関連がいちばん強い圧で、画面にもタイルで出ています。'
            }
          },
          {
            talk: true, who: 'puku',
            say: 'じゃあ PIP が高いとき、どうすれば下げられるの？'
          },
          {
            talk: true, who: 'doc',
            say: '流れを押す分を減らせばいい。速さを落としてみましょう。'
          },
          {
            say: '吸気流量を 15 L/分 に下げて確定してください。',
            hint: 'この 8歳の児で 15〜30 L/分、乳児なら 5〜10 L/分が目安です。',
            spot: 'key:flow', watch: ['PIP', 'Pplat'],
            check: function (c) { return c.s.flow <= 15; },
            why: 'ゆっくり押し込むぶん、抵抗にとられる圧が減ります。'
          },
          {
            say: 'もう一度「吸気ポーズ」を押して測り直してください。',
            spot: 'hard:kInsp',
            event: 'hold:insp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。PIP と Pplat を見比べてください。',
            watch: ['PIP', 'Pplat', 'ΔP'],
            check: function (c) { return c.m.pplat != null && paused(c); },
            why: 'PIP は下がったのに、Pplat はほとんど動いていません。流量を変えても肺の硬さは変わらないからです。'
          },
          {
            quiz: {
              q: 'この結果から言えることは何ですか。',
              choices: [
                'PIP が高い＝肺を傷めている、とは限らない',
                '流量を下げれば肺は守られる',
                'PIP と Pplat は同じものである',
                '流量を下げると換気量も減る'
              ],
              answer: 0,
              why: 'PIP が高くても Pplat が正常なら、高いのは抵抗の分だけです。'
                + '「圧アラームが鳴ったら、まず吸気ポーズで Pplat を測る」のはこのためです。'
            }
          }
        ]
      },

      {
        id: '1-3', title: 'コンプライアンスと気道抵抗', minutes: 5,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4, flow: 24, pause: 0.3 },
        brief: [
          'Cstat ＝ Vte ÷ ΔP。肺の膨らみやすさ。小児は体重で割って読む（正常 0.9〜1.1 mL/cmH₂O/kg）。',
          'Raw ＝（PIP − Pplat）÷ 流量。空気の通りにくさ。細いチューブほど大きい。',
          '同じ「圧が上がった」でも、上がったのがどちらかで探すものが変わる。'
        ],
        points: ['Cstat = Vte ÷ ΔP（正常 0.9〜1.1 mL/cmH₂O/kg）',
          'Raw =（PIP − Pplat）÷ 流量。チューブが細いほど大きい',
          '上がったのがどちらかで原因が違う'],
        tasks: [
          {
            talk: true, who: 'doc',
            say: 'いまの 2 つの圧を、機械が勝手に割り算してくれています。それが Cstat と Raw。'
          },
          {
            talk: true, who: 'puku',
            say: '割り算？'
          },
          {
            talk: true, who: 'doc',
            say: '肺の柔らかさと、気道の通りにくさです。夜中のアラームは、ほとんどこの 2 つで説明がつきます。'
          },
          {
            say: 'Cstat と Raw に数字が入るまで待ちます。',
            hint: '吸気ポーズを 0.3 秒に設定してあるので、毎回の呼吸で自動的に測られます。',
            spot: ['val:Cstat', 'val:Raw'], watch: ['Cstat', 'Raw'],
            check: function (c) { return c.m.cstat != null && c.m.raw != null; },
            why: function (c) {
              return 'Cstat ' + (c.m.cstat / c.pbw).toFixed(1) + ' mL/cmH₂O/kg。'
                + '術後の肺なので、どちらもほぼ正常です。これを基準にして異常を覚えます。';
            }
          },
          {
            say: '一回換気量を 120 mL に下げて確定し、3 つの数字を見比べてください。',
            spot: 'key:vt', watch: ['Vte', 'ΔP', 'Cstat'],
            check: function (c) { return c.s.vt <= 120; },
            why: 'Vte と ΔP は一緒に減り、Cstat はほとんど動きません。'
              + 'Cstat は設定ではなく肺そのものの性質だからです。'
          },
          {
            talk: true, who: 'doc',
            say: '数字が動いたとき、どちらが犯人か。言い当てられるようにしておきましょう。'
          },
          {
            quiz: {
              q: '体重 25 kg の児で Cstat が 24 → 10 mL/cmH₂O に下がりました。何が起きていますか。',
              choices: ['気道が細くなった', '肺が硬くなった', '鎮静が深くなった', '回路がリークしている'],
              answer: 1,
              why: '肺が硬くなっています。無気肺、肺水腫、肺炎、気胸。'
                + '小児で見落としやすいのが腹部膨満で、乳児は腹式呼吸なので胃の空気だけでも換気が悪くなります。'
            }
          },
          {
            quiz: {
              q: '別の児で PIP だけが 25 → 38 に上がり、Pplat は 18 のままです。原因は？',
              choices: ['肺が硬くなった', '気道抵抗が上がった', 'PEEP が高すぎる', '一回換気量が大きすぎる'],
              answer: 1,
              why: '差が開いた＝抵抗の増加です。痰、チューブの屈曲や閉塞、気管支攣縮を探します。'
                + '小児はチューブが細いぶん、わずかな分泌物でも抵抗がはっきり上がります。'
            }
          },
          {
            talk: true, who: 'puku',
            say: '吸気ポーズがあるなら、呼気ポーズもあるの？'
          },
          {
            talk: true, who: 'doc',
            say: 'あります。こちらは吐ききれているかを見るためのもの。第 5 章で主役になります。'
          },
          {
            say: '「呼気ポーズ」を押して、総 PEEP を測ってください。',
            spot: 'hard:kExp',
            event: 'hold:exp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。',
            watch: ['PEEP tot', 'auto-PEEP'],
            check: function (c) { return c.m.peepTot > 0 && paused(c); },
            why: '総 PEEP と設定 PEEP の差が auto-PEEP（吐ききれずに残った圧）です。この児ではほぼゼロ。'
              + '第5章で、これが問題になる乳児を扱います。'
          }
        ]
      }
    ]
  };

  /* ===================== 第2章 初期設定 ===================== */

  var CH2 = {
    id: 'ch2', title: '第2章　挿管直後の初期設定', tag: '初期設定',
    sub: '目の前の患者に、最初の 5 分で何を決めるか。',
    lessons: [

      {
        id: '2-1', title: '一回換気量は体重で決める', minutes: 4,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 300, rr: 20, peep: 5, fio2: 0.4, flow: 24, pause: 0.3 },
        brief: [
          '小児は実体重で決める。成人の予測体重式は使わない。',
          '目安は 6〜8 mL/kg。ARDS では 5〜6、新生児では 4〜6 mL/kg。',
          '例外は肥満児だけで、身長相当の標準体重で計算する（脂肪がついても肺は大きくならない）。'
        ],
        points: ['小児は実体重で決める（成人の予測体重式は使わない）', '6〜8 mL/kg、ARDS では 5〜6、新生児は 4〜6',
          '肥満児だけは身長相当の標準体重で'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '朝の回診。ハルト君の設定は、手術室から運ばれてきたときのままだった。'
          },
          {
            talk: true, who: 'doc',
            say: 'ここからは自分で決めます。最初に決めるのは一回換気量。基準は体重です。'
          },
          {
            talk: true, who: 'puku',
            say: '体重？ 身長じゃなくて？'
          },
          {
            talk: true, who: 'doc',
            say: '小児では体重 1 kg あたり 6〜8 mL。まず、いまの値がいくつなのか確かめましょう。'
          },
          {
            say: 'いまの Vte を mL/kg で確かめてください。',
            hint: 'タイルの下に mL/kg が出ています。',
            spot: 'val:Vte', watch: ['Vte', 'Pplat', 'ΔP'],
            check: function (c) { return c.m.vte > 260; },
            why: function (c) {
              return '約 ' + (c.m.vte / c.pbw).toFixed(1) + ' mL/kg。体重 '
                + c.pbw.toFixed(0) + ' kg に対して明らかに入れすぎです。';
            }
          },
          {
            say: '一回換気量を 6 mL/kg に合わせて確定してください。',
            hint: function (c) { return '体重 ' + c.pbw.toFixed(1) + ' kg × 6 ＝ 約 ' + mlkg(c, 6) + ' mL です。'; },
            spot: 'key:vt', watch: ['Vte', 'Pplat', 'ΔP'],
            check: function (c) { return Math.abs(c.s.vt - c.pbw * 6) <= 25; },
            why: '肺保護の基本設定になりました。圧も一緒に下がっています。'
          },
          {
            talk: true, who: 'puku',
            say: '大人みたいに「だいたい 500 mL」じゃダメなの？'
          },
          {
            talk: true, who: 'doc',
            say: '小児は 1 kg から 35 kg まで動きます。暗記では届きません。毎回かけ算します。'
          },
          {
            quiz: {
              q: '体重 6 kg の乳児に 6 mL/kg。一回換気量は何 mL ですか。',
              choices: ['16 mL', '36 mL', '60 mL', '体重では決められない'],
              answer: 1,
              why: '36 mL です。成人の感覚で「少なすぎる」と増やしてしまうのが、小児でいちばん多い間違い。'
                + '回路の伸びやリークで実測がぶれるので、Vte は必ず mL/kg で読みます。'
            }
          },
          {
            quiz: {
              q: '10歳、身長 138 cm（標準体重 32 kg）、実体重 58 kg の肥満児。基準はどれですか。',
              choices: ['実体重 58 kg', '身長相当の標準体重 32 kg', '2 つの平均', '身長だけで決める'],
              answer: 1,
              why: '標準体重 32 kg で計算します。ただし腹圧で横隔膜が押し上げられるため、PEEP は高めが要ることがあります。'
            }
          }
        ]
      },

      {
        id: '2-2', title: '呼吸回数と分時換気量', minutes: 5,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 150, rr: 10, peep: 5, fio2: 0.4, flow: 20, pause: 0.3 },
        brief: [
          'MV ＝ Vt × RR。ただし効くのは、死腔を引いた肺胞換気量。',
          '死腔は 1 呼吸ごとに引かれる。小児ほどその割合が大きく、浅く速い換気は効率が悪い。',
          '吐ききるには 3τ（τ ＝ Raw × Cstat）の呼気時間が要る。足りなければ auto-PEEP。'
        ],
        points: ['MV = Vt × RR、効くのは死腔を引いた肺胞換気量',
          '小児ほど死腔の割合が大きく、浅く速い換気は効率が悪い',
          '吐ききるには 3τ の呼気時間が必要'],
        tasks: [
          {
            talk: true, who: 'doc',
            say: '量が決まったら、次は回数。かけ算した分時換気量が、そのまま CO₂ を決めます。'
          },
          {
            talk: true, who: 'puku',
            say: 'じゃあ回数は、多いほどいいの？'
          },
          {
            talk: true, who: 'doc',
            say: 'そこが落とし穴です。まず上げてみて、そのあと確かめましょう。'
          },
          {
            say: '呼吸回数を上げて MV を 3.0〜4.2 L/分 に入れ、30 秒保ってください。',
            hint: 'Vt 150 mL なら RR 20〜28 のあたりです。',
            spot: 'key:rr', watch: ['MV', 'RR tot'],
            check: function (c) { return c.m.mv >= 3.0 && c.m.mv <= 4.2; },
            hold: 30,
            why: '体重 25 kg では 120〜170 mL/kg/分 が安静時の目安です。'
              + '乳児はもっと多く要ります（200 mL/kg/分 前後）。代謝が体重あたりで大きいからです。'
          },
          {
            quiz: {
              q: 'RR を 20 から 30 に上げました。1 回の呼吸に使える時間はどうなりますか。',
              choices: ['3.0 秒 → 2.0 秒に短くなる', '変わらない', '2.0 秒 → 3.0 秒に長くなる', '吸気時間だけが伸びる'],
              answer: 0,
              why: '60 ÷ RR が 1 呼吸の長さです。吸気時間が同じなら、短くなった分はすべて呼気時間から削られます。'
            }
          },
          {
            quiz: {
              q: 'τ が 0.7 秒の乳児。吐ききるのに必要な呼気時間はおよそ何秒ですか。',
              choices: ['0.2 秒', '2 秒', '6 秒', '10 秒'],
              answer: 1,
              why: '3τ ＝ 約 2 秒。吸気 0.5 秒を足すと 1 呼吸 2.5 秒、つまり RR 24 が上限です。'
                + '細気管支炎で「呼吸数を上げたのに CO₂ が下がらない」のはこれが理由です。'
            }
          },
          {
            talk: true, who: 'doc',
            say: 'いま上げた回数で、この子が吐ききれているかどうか。測れば分かります。'
          },
          {
            say: '「呼気ポーズ」で、空気が残っていないか確かめてください。',
            spot: 'hard:kExp',
            event: 'hold:exp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。',
            watch: ['auto-PEEP', 'PEEP tot'],
            check: function (c) { return paused(c) && c.m.peepTot > 0; },
            why: function (c) {
              return c.m.autoPeep < 2 ? '肺が正常でこの回数なら、十分に吐ききれています。'
                : '残り始めています。呼吸回数を下げる余地があります。';
            }
          }
        ]
      },

      {
        id: '2-3', title: 'PEEP と FiO₂ ─ 酸素化の 2 つのつまみ', minutes: 6,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 150, rr: 20, peep: 5, fio2: 1.0, flow: 20, pause: 0.3 },
        brief: [
          'SpO₂ の目標は年齢で違う（早産児 90〜95%、乳幼児 92〜97%、学童 94〜98%）。狙うのは目標を保てる最小の FiO₂。',
          'PEEP は潰れた肺胞を開いてシャントを減らす。効きは遅く、そのかわり FiO₂ を下げられる。',
          'PEEP は胸腔内圧を上げるので、上げたら血圧を見る。血圧の下限も年齢で違う。'
        ],
        points: ['SpO₂ の目標は年齢で違う（早産児 90〜95%、学童 94〜98%）',
          'PEEP は肺胞を開く、効き方は遅い',
          'PEEP を上げたら血圧を見る。血圧の下限も年齢で違う'],
        tasks: [
          {
            talk: true, who: 'doc',
            say: '酸素化のつまみは 2 つだけ。FiO₂ と PEEP です。役割がまったく違います。'
          },
          {
            talk: true, who: 'puku',
            say: 'SpO₂ が低かったら、とりあえず酸素を上げればいいんじゃないの？'
          },
          {
            talk: true, who: 'doc',
            say: 'とりあえずはそれで正解。ただ、下げ忘れないこと。まず下げるほうからやります。'
          },
          {
            say: 'SpO₂ 94% 以上のまま、FiO₂ を 40% 以下に下げて 40 秒保ちます。',
            hint: '5〜10% ずつ下げて SpO₂ を確かめます。急ぐときは「× 10」で早送りできます。',
            spot: 'key:fio2', watch: ['SpO₂'],
            check: function (c) { return c.s.fio2 <= 0.41 && c.e.spo2 >= 94; },
            hold: 40,
            why: 'この児は肺がほぼ正常なので、FiO₂ は早く下げられます。'
              + '術後に 100% のまま放置されている子は珍しくありません。'
          },
          {
            quiz: {
              q: 'SpO₂ が 100% で FiO₂ が 90% のまま。どうしますか。',
              choices: ['余裕があるのでそのまま', 'FiO₂ を下げる', 'PEEP を上げる', '一回換気量を増やす'],
              answer: 1,
              why: 'SpO₂ 100% は「PaO₂ が 100 以上のどこか」という意味しかなく、余裕の量は見えません。'
                + '高い FiO₂ を続ける理由がないので下げます。'
            }
          },
          {
            talk: true, who: 'doc',
            say: 'もう 1 つのつまみ、PEEP。上げると酸素化は良くなりますが、ただではありません。'
          },
          {
            say: 'PEEP を 12 cmH₂O まで上げて確定してください。',
            spot: 'key:peep', watch: ['ABP mean', 'Pplat', 'SpO₂'],
            check: function (c) { return c.s.peep >= 12; },
            why: ''
          },
          {
            say: 'そのまま 45 秒、平均動脈圧を見てください。',
            spot: 'val:ABP mean', watch: ['ABP mean', 'SpO₂', 'Pplat'],
            check: function (c) { return c.s.peep >= 12; },
            hold: 45,
            why: function (c) {
              return '平均動脈圧 ' + Math.round(c.e.map) + ' mmHg（この年齢の下限は ' + c.e.nm.mapMin + '）。'
                + '胸腔内圧が上がって静脈還流が減り、心拍出量が落ちました。';
            }
          },
          {
            say: 'PEEP を 5 cmH₂O に戻してください。',
            spot: 'key:peep', watch: ['ABP mean', 'SpO₂'],
            check: function (c) { return c.s.peep <= 5; },
            why: 'PEEP は高いほど良いものではなく、開ける肺が残っているときに効くものです。'
              + '第4章で、本当に効く小児 ARDS の肺を扱います。'
          }
        ]
      }
    ]
  };

  /* ===================== 第3章 モード ===================== */

  var CH3 = {
    id: 'ch3', title: '第3章　モードの違い', tag: 'モード',
    sub: '何を保証して、何を患者に委ねるのか。',
    lessons: [

      {
        id: '3-1', title: '量を決めるか、圧を決めるか', minutes: 6,
        scenario: 'ards',
        settings: { mode: 'VC-AC', vt: 85, rr: 30, peep: 10, fio2: 0.6, flow: 12, pause: 0.3 },
        brief: [
          '量規定（VC）＝ 入れる量を約束する。肺が硬くなれば圧が上がる。見張るのは Pplat。',
          '圧規定（PC）＝ かける圧を約束する。肺が硬くなれば量が減る。見張るのは Vte。',
          '新生児・小さな乳児では伝統的に PC。カフなしチューブから漏れるので、量を保証しても意味がないため。'
        ],
        points: ['VC は量を保証し圧が動く', 'PC は圧を保証し量が動く',
          'VC では Pplat、PC では Vte を見張る'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '別のベッドから呼ばれた。インフルエンザ肺炎のミオちゃん（3歳）。両肺が真っ白だ。'
          },
          {
            talk: true, who: 'doc',
            say: '同じ肺でも、量を決めるか圧を決めるかで、この子の安全域が変わります。'
          },
          {
            say: '圧波形（上、黄色）の形を見てください。斜めに立ち上がっています。',
            spot: 'wave', watch: ['PIP', 'Pplat', 'Vte'],
            check: function (c) { return c.m.pplat != null; },
            why: 'VC では流量が先に決まっているので、圧はその結果として出てきます。だから角が立ちます。'
          },
          {
            talk: true, who: 'puku',
            say: 'モードって、いっぱいあって覚えられない…'
          },
          {
            talk: true, who: 'doc',
            say: '覚えるのは 1 つだけ。何を機械が保証して、何を患者に預けるか。切り替えて見比べましょう。'
          },
          {
            say: '上のタブで「PC-AC」に切り替えてください。',
            spot: 'mode:PC-AC',
            event: 'mode:PC-AC',
            why: '圧波形が四角い台形になりました。設定した圧まで一気に上げ、吸気のあいだ保っています。'
          },
          {
            say: 'P insp を動かして Vte を 6 mL/kg 前後にし、20 秒保ってください。',
            hint: function (c) { return '体重 ' + c.pbw + ' kg なので目標は ' + mlkg(c, 6) + ' mL 前後です。'; },
            spot: 'key:pinsp', watch: ['Vte', 'PIP', 'Pplat'],
            check: function (c) { return Math.abs(vtPerKg(c) - 6) <= 1; },
            hold: 20,
            why: '同じ換気量を、今度は圧で作りました。VC と PC はゴールが同じで、道順が違うだけです。'
          },
          {
            talk: true, who: 'doc',
            say: 'では、この子の肺がもっと硬くなったとき。どちらが危ないでしょうか。'
          },
          {
            quiz: {
              q: 'PC で換気中、無気肺が広がって肺が硬くなりました。何が起きますか。',
              choices: ['気道内圧が上がる', '一回換気量が減る', '呼吸回数が上がる', '何も変わらない'],
              answer: 1,
              why: '圧は設定どおりなので、そのかわり入る量が減ります。'
                + 'PC は「静かに換気量が減っていく」のが危険な形で、Vte と MV のアラームが命綱になります。'
            }
          },
          {
            quiz: {
              q: '同じことが VC で起きたら何が起きますか。',
              choices: ['気道内圧が上がる', '一回換気量が減る', '呼吸回数が上がる', '何も変わらない'],
              answer: 0,
              why: '量は守られ、そのぶん圧が上がります。上限圧に当たると吸気が途中で切られ、結局は換気量も落ちます。'
            }
          }
        ]
      },

      {
        id: '3-2', title: '患者が自分で吸うとき ─ トリガ', minutes: 6,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 18, peep: 5, fio2: 0.4, flow: 24, trigFlow: 1.0, pause: 0.3 },
        sedation: 0.85,
        brief: [
          'トリガ感度は「これだけ流れたら吸ったと見なす」しきい値。数字が小さいほど敏感。',
          '小児ほど吸気の流れが小さいので敏感にする。学童 0.5〜2、乳児 0.3〜1、新生児 0.2 L/分。',
          '鈍い＝ミストリガ（吸っても空気が来ず苦しい）。敏感すぎ・リーク＝オートトリガ。'
        ],
        points: ['トリガ感度は「吸ったと見なす」しきい値。小児ほど敏感に',
          '鈍い＝ミストリガ（子どもが苦しい）',
          '敏感すぎ・リーク＝オートトリガ'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'ハルト君の麻酔が覚めてきた。胸が、機械より先に動きはじめている。'
          },
          {
            talk: true, who: 'doc',
            say: 'ここから患者が呼吸に参加します。その「吸いたい」を機械がどう受け取るかが、トリガです。'
          },
          {
            say: '「鎮静」を 20% まで下げて確定してください。',
            hint: '鎮静はシミュレーター側の操作なので、キーの色が違います。',
            spot: 'key:sed', watch: ['RR tot'],
            check: function (c) { return c.e.sedation <= 0.22; },
            why: '呼吸中枢が働きはじめます。'
          },
          {
            say: '自発呼吸が 4 回/分 以上になるまで待ちます。',
            hint: '「× 10」で早送りできます。',
            spot: 'val:RR tot', watch: ['RR tot'],
            check: function (c) { return c.m.rrSpont >= 4; },
            why: 'A/C なので、患者が吸うたびに設定どおりの換気が 1 回送られます。'
          },
          {
            talk: true, who: 'puku',
            say: '感度を鈍くしたら、どうなるの？'
          },
          {
            talk: true, who: 'doc',
            say: 'やってみましょう。数字ではなく、圧波形に出ます。'
          },
          {
            say: 'トリガ感度を 5 L/分 にして確定し、圧波形を 25 秒見てください。',
            spot: ['key:trig', 'wave'], watch: ['RR tot'],
            check: function (c) { return c.s.trigFlow >= 4.5; },
            hold: 25,
            why: '立ち上がりの前に、小さな下向きの切れ込みが出ています。'
              + 'この児は吸っているのに、機械が応えていません。'
          },
          {
            quiz: {
              q: 'この状態の子どもは、どう感じていますか。',
              choices: [
                '楽になっている（呼吸の手間が減る）',
                '吸っても空気が来ず、苦しい',
                '何も感じない',
                '過換気になる'
              ],
              answer: 1,
              why: '呼吸仕事量が増え、不穏の原因になります。'
                + '「人工呼吸器と合わない」ときに鎮静を足す前に、トリガと auto-PEEP を疑うのが順序です。'
            }
          },
          {
            talk: true, who: 'pt',
            say: '（ハルト君が顔をしかめ、胸だけが大きく動いている）'
          },
          {
            talk: true, who: 'doc',
            say: '吸おうとしても機械が来ない。患者にとっていちばん苦しい設定です。戻しましょう。'
          },
          {
            say: 'トリガ感度を 1 L/分 に戻してください。',
            spot: 'key:trig', watch: ['RR tot'],
            check: function (c) { return c.s.trigFlow <= 1.5; },
            why: '切れ込みが消え、この児の吸気に機械がついてくるようになりました。'
          },
          {
            quiz: {
              q: '逆に敏感にしすぎたり、チューブ周囲のリークが大きいと何が起こりますか。',
              choices: ['何も起こらない', '換気量が減る', '患者が吸っていないのに送気される', '呼気時間が伸びる'],
              answer: 2,
              why: 'オートトリガです。心拍の振動、回路の水の揺れ、小児ではリークを吸気と誤認します。'
                + 'リークが原因のときは、感度をいじるよりチューブのサイズや位置を見直すのが本筋です。'
            }
          }
        ]
      },

      {
        id: '3-3', title: 'SIMV と PSV ─ 手伝い方を選ぶ', minutes: 6,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 16, peep: 5, fio2: 0.4, flow: 24, ps: 10, pause: 0.3 },
        sedation: 0.2,
        brief: [
          'A/C ＝ 患者が吸ってもタイマーで来ても、送られるのは必ず同じ完全な 1 回換気。',
          'SIMV ＝ 決めた回数だけ強制換気、その合間の自発呼吸は PS で少し手伝う。',
          'PSV ＝ 強制換気なし。始めるのも止めるのも患者。離脱の評価に向くが、止まれば何も起きない。'
        ],
        points: ['A/C は全部が完全な換気', 'SIMV は決めた回数だけ強制、残りは自発',
          'PSV は始めるのも止めるのも患者'],
        tasks: [
          {
            talk: true, who: 'doc',
            say: '手伝い方には段階があります。全部やるか、足りない分だけ足すか、本人にまかせるか。'
          },
          {
            say: '上のタブで「SIMV」に切り替えてください。',
            spot: 'mode:SIMV-VC',
            event: 'mode:SIMV-VC',
            why: '強制換気は設定 RR の回数だけになり、その合間の自発呼吸は PS で手伝われます。'
          },
          {
            say: '30 秒待って、実測の呼吸回数と自発の回数を見比べてください。',
            spot: 'val:RR tot', watch: ['RR tot', 'Vte', 'MV'],
            check: function (c) { return true; },
            hold: 30,
            why: function (c) {
              return '実測 ' + Math.round(c.m.rrTotal) + ' 回/分、うち自発 ' + Math.round(c.m.rrSpont)
                + ' 回/分。差の分だけ患者が自分で呼吸しています。';
            }
          },
          {
            quiz: {
              q: 'SIMV で設定 RR 10、実測 RR 18 でした。差の 8 回は何ですか。',
              choices: ['機械の誤作動', '患者自身の自発呼吸', 'オートトリガ', '無呼吸バックアップ'],
              answer: 1,
              why: '患者の自発呼吸です。2 種類の呼吸が混ざるので、波形も大きい山と小さい山が交互に出ます。'
            }
          },
          {
            talk: true, who: 'puku',
            say: 'SIMV と PSV って、どう違うの？'
          },
          {
            talk: true, who: 'doc',
            say: 'SIMV は決めた回数だけ必ず送ります。PSV は 1 回も送りません。押せば分かります。'
          },
          {
            say: '今度は「PSV」に切り替えてください。',
            spot: 'mode:PSV',
            event: 'mode:PSV',
            why: '強制換気がなくなりました。すべての呼吸を患者が始めています。'
          },
          {
            say: 'PS を調整して Vte を 6〜8 mL/kg に入れ、20 秒保ってください。',
            hint: function (c) { return '体重 ' + c.pbw + ' kg なので目標は ' + mlkg(c, 6) + '〜' + mlkg(c, 8) + ' mL です。'; },
            spot: 'key:ps', watch: ['Vte', 'RR tot'],
            check: function (c) { var x = vtPerKg(c); return x >= 5.5 && x <= 8.5; },
            hold: 20,
            why: 'PS は「その子が楽に目標の換気量を出せる最小の圧」で決めます。'
              + '小児はチューブが細いぶん、同じ「ほとんど手伝わない」でも乳児 PS 8、学童 PS 5 と差がつきます。'
          },
          {
            talk: true, who: 'doc',
            say: 'では、その「1 回も送らない」の怖いところを。'
          },
          {
            quiz: {
              q: 'PSV 中に患者が鎮静で呼吸を止めたらどうなりますか。',
              choices: [
                '設定 RR で換気が続く',
                '何も起こらず、無呼吸アラームとバックアップ換気が作動する',
                '自動的に A/C に切り替わって終わり',
                'PS が自動で上がる'
              ],
              answer: 1,
              why: 'PSV には自前の換気回数がありません。深い鎮静や意識障害の患者には使えず、'
                + '使うなら無呼吸バックアップの設定を必ず確認します（新生児 10 秒、乳児 15 秒が目安）。'
            }
          }
        ]
      }
    ]
  };

  /* ===================== 第4章 血液ガス ===================== */

  var CH4 = {
    id: 'ch4', title: '第4章　血液ガスを読む', tag: '血液ガス',
    sub: '数字から、次に回すつまみを決められるようにする。',
    lessons: [

      {
        id: '4-1', title: '4 ステップで読む', minutes: 6,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4, flow: 24, pause: 0.3 },
        brief: [
          '① pH → ② PaCO₂（呼吸性か）→ ③ HCO₃⁻（代謝性か）→ ④ 代償が予想どおりか、の順に読む。',
          '急性の呼吸性アシドーシスは PaCO₂ +10 で HCO₃⁻ +1、慢性なら +3.5。ずれていれば別の異常が隠れている。',
          '正常値は年齢で違う（HCO₃⁻ は新生児 18〜24、幼児以降 21〜26）。酸素化は P/F と OI で別枠。'
        ],
        points: ['pH → PaCO₂ → HCO₃⁻ → 代償の順で読む',
          '急性は PaCO₂ +10 で HCO₃⁻ +1、慢性は +3.5',
          '正常値は年齢で違う。酸素化は P/F と OI で別に評価する'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '深夜 1 時。ハルト君の呼吸が少し浅い。いぶき先生が採血の指示を出した。'
          },
          {
            talk: true, who: 'doc',
            say: '血液ガスは 4 ステップで読みます。順番さえ守れば、迷いません。'
          },
          {
            talk: true, who: 'puku',
            say: '4 つも覚えるの？'
          },
          {
            talk: true, who: 'doc',
            say: 'pH → PaCO₂ → HCO₃⁻ → 代償。それだけです。まず採ってみましょう。'
          },
          {
            say: '「血液ガス」を押して採血してください。',
            spot: 'hard:kAbg',
            event: 'abg:order',
            why: '結果が出るまで約 2 分かかります。急ぐときは「× 10」で早送りできます。'
          },
          {
            say: '結果が返るまで待ちます。',
            watch: ['etCO₂', 'SpO₂'],
            check: function (c) { return c.abgs.length >= 1; },
            why: function (c) {
              return 'pH ' + c.lastAbg.ph.toFixed(2) + ' / PaCO₂ ' + c.lastAbg.paco2.toFixed(0)
                + ' / PaO₂ ' + c.lastAbg.pao2.toFixed(0) + '。この画面はハードキーからいつでも開き直せます。';
            }
          },
          {
            talk: true, who: 'doc',
            say: '返ってきましたね。では、その順番どおりに読む練習を 3 問。'
          },
          {
            quiz: {
              q: 'pH 7.28 / PaCO₂ 58 / HCO₃⁻ 26。これは何ですか。',
              choices: ['代謝性アシドーシス', '急性の呼吸性アシドーシス', '慢性の呼吸性アシドーシス', '呼吸性アルカローシス'],
              answer: 1,
              why: 'PaCO₂ +18 に対し HCO₃⁻ は +2 と、急性の予想どおりです。'
                + 'これが HCO₃⁻ 35・pH 7.36 なら腎性代償が完成した慢性型で、気管支肺異形成症や神経筋疾患で見ます。'
            }
          },
          {
            quiz: {
              q: 'pH 7.22 / PaCO₂ 30 / HCO₃⁻ 12。これは何ですか。',
              choices: ['呼吸性アシドーシス', '代謝性アシドーシスと呼吸性代償', '呼吸性アルカローシス', '混合性アルカローシス'],
              answer: 1,
              why: 'アシデミアなのに PaCO₂ は低い。主犯は HCO₃⁻ 12 で、低い PaCO₂ は過換気で代償している姿です。'
                + 'ここで鎮静をかけて呼吸を抑えると、pH は一気に落ちます。'
            }
          },
          {
            quiz: {
              q: 'PaO₂ 70 mmHg、FiO₂ 0.8 のときの P/F 比は？',
              choices: ['56', '88', '140', '判定できない'],
              answer: 1,
              why: '70 ÷ 0.8 ＝ 88。300 以下で軽症、200 以下で中等症、100 以下で重症です。'
                + '動脈ラインがない小児では S/F 比や OI（4 以上で軽症、16 以上で重症）で代用します。'
            }
          }
        ]
      },

      {
        id: '4-2', title: 'CO₂ を換気量で動かす', minutes: 7,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 120, rr: 14, peep: 5, fio2: 0.4, flow: 16, pause: 0.3 },
        brief: [
          'PaCO₂ ＝ CO₂ の産生 ÷ 肺胞換気量。肺胞換気量 ＝（Vt − 死腔）× RR。',
          '死腔は 1 呼吸ごとに引かれるので、同じ MV なら Vt を増やすほうがよく効く。',
          '新生児は成人の倍近く CO₂ を作り、発熱でも 1℃ あたり 10〜13% 増える。効き始めるまで数分。'
        ],
        points: ['PaCO₂ ∝ CO₂産生 ÷ 肺胞換気量', '小児ほど死腔の割合が大きく、Vt を増やすほうが効く',
          '発熱で CO₂ 産生が増える。効き始めるまで数分かかる'],
        tasks: [
          {
            talk: true, who: 'doc',
            say: 'CO₂ を下げる方法は、実は 1 つしかありません。何だと思いますか。'
          },
          {
            talk: true, who: 'puku',
            say: '酸素を増やす…？'
          },
          {
            talk: true, who: 'doc',
            say: '違います。触ってみれば、身体で覚えられます。まず採血から。'
          },
          {
            say: 'まず採血して、いまの PaCO₂ を確かめてください。',
            spot: 'hard:kAbg',
            event: 'abg:order',
            why: ''
          },
          {
            say: '結果が返るまで待ちます。',
            watch: ['MV', 'etCO₂'],
            check: function (c) { return c.abgs.length >= 1; },
            onPass: function (c) { c.mem.first = c.lastAbg; },
            why: function (c) {
              return 'PaCO₂ ' + c.lastAbg.paco2.toFixed(0) + ' mmHg、pH ' + c.lastAbg.ph.toFixed(2)
                + '。換気が足りていません。';
            }
          },
          {
            quiz: {
              q: 'この呼吸性アシドーシスを直すために、まず動かすのはどれですか。',
              choices: ['FiO₂ を上げる', 'PEEP を上げる', '分時換気量を増やす', '鎮静を深くする'],
              answer: 2,
              why: 'CO₂ を下げる方法は換気を増やすことだけです。FiO₂ も PEEP も酸素化のつまみで、CO₂ には効きません。'
            }
          },
          {
            talk: true, who: 'doc',
            say: 'では動かします。効きはじめるまで数分かかることも、いっしょに覚えてください。'
          },
          {
            say: '一回換気量と呼吸回数を上げて、MV を 3.2 L/分 以上にしてください。',
            hint: function (c) { return '体重 ' + c.pbw.toFixed(0) + ' kg。Vt は 8 mL/kg（約 '
              + mlkg(c, 8) + ' mL）まで安全に上げられます。'; },
            spot: ['key:vt', 'key:rr'], watch: ['MV', 'Pplat', 'etCO₂'],
            check: function (c) { return c.m.mv >= 3.2; },
            hold: 15,
            why: 'CO₂ が動くまで数分かかります。変えた直後に採血しても、まだ動いていません。'
          },
          {
            say: 'もう一度採血して、PaCO₂ が 35〜48 mmHg に入ったことを確かめてください。',
            hint: '「× 10」で 5 分ほど進めてから採血します。',
            spot: 'hard:kAbg', watch: ['MV', 'etCO₂'],
            check: function (c) {
              return c.abgs.length >= 2 && c.lastAbg.paco2 >= 33 && c.lastAbg.paco2 <= 48;
            },
            why: function (c) {
              return 'PaCO₂ ' + c.lastAbg.paco2.toFixed(0) + ' mmHg、pH ' + c.lastAbg.ph.toFixed(2)
                + '。換気量を増やしたぶんだけ CO₂ が抜けました。';
            }
          },
          {
            talk: true, who: 'puku',
            say: '量と回数、どっちを上げても同じじゃないの？'
          },
          {
            quiz: {
              q: 'もっと下げたい。Vt 120→160 と RR 20→26、どちらがよく効きますか（MV の増分は同じ）。',
              choices: ['Vt を増やすほう', 'RR を上げるほう', '同じ', '場合による'],
              answer: 0,
              why: '回数を増やすと死腔換気も一緒に増えます。ただし Pplat と ΔP の上限が先に来ます。'
                + '小児 ARDS のように Vt を増やせない場面では、やむをえず RR で押します。'
            }
          },
          {
            quiz: {
              q: 'RR を上げすぎたときに起きることはどれですか。',
              choices: ['auto-PEEP', '高 FiO₂ による酸素毒性', 'リーク', 'カフ圧の上昇'],
              answer: 0,
              why: '呼気時間が足りず、吐ききる前に次の吸気が来ます。空気が残って血圧が下がり、トリガもできなくなります。'
            }
          }
        ]
      },

      {
        id: '4-3', title: '酸素化を読む ─ P/F 比と PEEP', minutes: 8,
        scenario: 'ards',
        settings: { mode: 'VC-AC', vt: 85, rr: 30, peep: 5, fio2: 0.8, flow: 12, pause: 0.3 },
        brief: [
          'シャント（潰れた肺胞を血が素通りすること）には FiO₂ が効かない。素通りする血はどれだけ濃い酸素でも素通りする。',
          'だから ARDS では FiO₂ より先に PEEP で肺胞を開き、そのあと FiO₂ を下げる。',
          'PEEP を上げたら 3 つ見る。P/F（改善したか）、Pplat と ΔP（過膨張していないか）、血圧（循環が保てるか）。'
        ],
        points: ['シャントには FiO₂ が効かない', 'PEEP で肺胞を開いてから FiO₂ を下げる',
          'PEEP を上げたら P/F・Pplat・血圧の 3 つを見る'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'ミオちゃんの FiO₂ は {FiO₂}%。それでも SpO₂ は {SpO₂}% までしか上がらない。'
          },
          {
            talk: true, who: 'puku',
            say: '酸素をこんなに吸わせてるのに、どうして上がらないの？'
          },
          {
            talk: true, who: 'doc',
            say: '潰れた肺胞を、血が素通りしているからです。素通りする血には、濃い酸素は届きません。'
          },
          {
            say: 'まず採血して、いまの P/F 比を確かめてください。',
            spot: 'hard:kAbg',
            event: 'abg:order',
            why: ''
          },
          {
            say: '結果が返るまで待ちます。',
            watch: ['SpO₂', 'Pplat'],
            check: function (c) { return c.abgs.length >= 1; },
            onPass: function (c) { c.mem.pf0 = pf(c.lastAbg); },
            why: function (c) {
              var r = pf(c.lastAbg);
              return 'P/F 比 ' + Math.round(r) + '。'
                + 'FiO₂ 80% を吸わせてもこれだけしか上がらないのは、シャントが大きいからです。';
            }
          },
          {
            talk: true, who: 'doc',
            say: 'だから先に肺胞を開きます。ここが PEEP の出番です。'
          },
          {
            say: 'PEEP を 14 cmH₂O まで上げて確定してください。',
            hint: '実際は 2 cmH₂O ずつ上げて、Pplat と血圧を見ながら進めます。',
            spot: 'key:peep', watch: ['SpO₂', 'Pplat', 'ABP mean'],
            check: function (c) { return c.s.peep >= 14; },
            why: ''
          },
          {
            say: 'そのまま 60 秒、SpO₂ と Pplat と平均動脈圧を見てください。',
            watch: ['SpO₂', 'Pplat', 'ABP mean'],
            check: function (c) { return c.s.peep >= 14; },
            hold: 60,
            why: 'ARDS の肺にはリクルートできる部分が多いので、酸素化が改善します。'
          },
          {
            say: 'もう一度採血して、P/F 比が上がったことを確かめてください。',
            hint: '「× 10」で早送りすると待ち時間が縮みます。',
            spot: 'hard:kAbg', watch: ['SpO₂'],
            check: function (c) {
              return c.abgs.length >= 2 && c.mem.pf0 != null && pf(c.lastAbg) > c.mem.pf0 + 20;
            },
            why: function (c) {
              return 'P/F 比 ' + Math.round(c.mem.pf0) + ' → ' + Math.round(pf(c.lastAbg))
                + '。FiO₂ は一切触っていません。開いた肺が増えた分です。';
            }
          },
          {
            talk: true, who: 'doc',
            say: '開いたら、酸素は下げる。この順番が大事です。'
          },
          {
            say: 'SpO₂ 92% 以上を保ったまま、FiO₂ を 60% 以下に下げてください。',
            spot: 'key:fio2', watch: ['SpO₂'],
            check: function (c) { return c.s.fio2 <= 0.61 && c.e.spo2 >= 92; },
            hold: 30,
            why: '「PEEP で開いてから FiO₂ を下げる」という順番です。'
              + '逆だと、FiO₂ だけが高いまま肺は潰れたまま、という状態が続きます。'
          },
          {
            quiz: {
              q: 'PEEP を 10 → 16 にしたら、P/F は変わらず平均血圧だけ 62 → 44 に下がりました。これは？',
              choices: [
                'まだ PEEP が足りない',
                '開く肺がもう残っておらず、過膨張と循環抑制だけが起きている',
                'FiO₂ を上げれば解決する',
                '測定の誤差'
              ],
              answer: 1,
              why: 'PEEP を戻し、腹臥位など別の手段を考えます。「上げても改善しない」こと自体が肺についての情報です。'
                + '小児は循環の予備が少ないので、上げる前に輸液が足りているかを確かめておきます。'
            }
          }
        ]
      },

      {
        id: '4-4', title: 'permissive hypercapnia ─ CO₂ を許す', minutes: 7,
        scenario: 'ards',
        settings: { mode: 'VC-AC', vt: 130, rr: 26, peep: 12, fio2: 0.6, flow: 14, pause: 0.3 },
        brief: [
          'ARDS では優先順位が入れ替わる。Vt 5〜6 mL/kg・Pplat ≤28・ΔP ≤14 を CO₂ より優先する。',
          'その結果 PaCO₂ が上がっても、pH が保たれていれば許す（PALICC は pH 7.15〜7.30）。',
          '例外は 3 つ。頭蓋内圧上昇、肺高血圧、重症の心機能低下。いずれも高 CO₂ は使えない。'
        ],
        points: ['Vt 5〜6 mL/kg・Pplat ≤28・ΔP ≤14 を CO₂ より優先',
          'pH 7.20〜7.25 以上なら高 CO₂ を許す（PALICC は 7.15〜7.30）',
          '頭蓋内圧上昇・肺高血圧・心不全では使えない'],
        tasks: [
          {
            talk: true, who: 'doc',
            say: 'P/F は良くなりました。でも今度は Pplat が高い。ここからは、何かを諦める相談です。'
          },
          {
            talk: true, who: 'puku',
            say: '諦める？'
          },
          {
            talk: true, who: 'doc',
            say: 'CO₂ を下げきることを諦めます。そのぶん肺を守る、という考え方です。'
          },
          {
            say: 'いまの Vte（mL/kg）と Pplat を確かめてください。',
            spot: ['val:Vte', 'val:Pplat'], watch: ['Vte', 'Pplat', 'ΔP'],
            check: function (c) { return c.m.pplat != null && c.m.vte > 100; },
            why: function (c) {
              return 'Vte ' + (vtPerKg(c)).toFixed(1) + ' mL/kg。肺保護の枠をはみ出しています。';
            }
          },
          {
            say: '一回換気量を 6 mL/kg に下げ、Pplat と ΔP を上限以下にしてください。',
            hint: function (c) { return '目標 Vt は約 ' + mlkg(c, 6) + ' mL、Pplat は '
              + c.e.nm.platMax + ' 以下、ΔP は ' + c.e.nm.dpMax + ' 以下です。'; },
            spot: 'key:vt', watch: ['Vte', 'Pplat', 'ΔP'],
            check: function (c) {
              return vtPerKg(c) <= 6.6 && c.m.pplat != null && c.m.pplat <= c.e.nm.platMax
                && c.m.dp != null && c.m.dp <= c.e.nm.dpMax;
            },
            hold: 15,
            why: '肺保護の条件を満たしました。当然、CO₂ は上がります。'
          },
          {
            say: '採血して、CO₂ と pH がどうなったか確かめてください。',
            hint: '「× 10」で 5 分ほど進めてから採血すると、変化がはっきりします。',
            spot: 'hard:kAbg', watch: ['etCO₂'],
            check: function (c) { return c.abgs.length >= 1; },
            why: function (c) {
              return 'PaCO₂ ' + c.lastAbg.paco2.toFixed(0) + ' mmHg、pH ' + c.lastAbg.ph.toFixed(2) + '。';
            }
          },
          {
            talk: true, who: 'doc',
            say: 'どこまで許すのか。線を引いておきましょう。'
          },
          {
            quiz: {
              q: '3歳、pH 7.26 / PaCO₂ 58、Pplat 27、Vt は 6 mL/kg。どうしますか。',
              choices: [
                'Vt を増やして CO₂ を下げる',
                'このままでよい（必要なら RR を少し上げる）',
                'PEEP を下げる',
                '鎮静を深くする'
              ],
              answer: 1,
              why: 'pH 7.25 以上なら許容範囲です。ここで Vt を増やすのは、数字を良くするために肺を傷めること。'
                + 'もう少し上げたいなら RR で、この年齢なら 40〜50 /分 まで使えることもあります。'
            }
          },
          {
            say: 'Vt は触らず、呼吸回数だけで pH を 7.25 以上にしてください。',
            hint: 'この児は pH が足りません。4〜6 回/分 ずつ上げ、効くまで「× 10」で進めます。',
            spot: 'key:rr', watch: ['Vte', 'MV', 'auto-PEEP'],
            check: function (c) { return c.e.ph >= 7.25; },
            hold: 20,
            why: 'Vt を触らずに pH を上げられました。小児 ARDS ではこれが正しい順番です。'
          },
          {
            say: '「呼気ポーズ」で、回数を上げた副作用が出ていないか確かめてください。',
            spot: 'hard:kExp',
            event: 'hold:exp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。',
            watch: ['auto-PEEP', 'PEEP tot'],
            check: function (c) { return paused(c) && c.m.peepTot > 0; },
            why: function (c) {
              return (c.m.autoPeep < 3 ? 'まだ余裕があります。' : '出始めています。ここが呼吸回数の上限です。')
                + ' ARDS の肺は硬いぶん早く吐けるので高い RR に耐えますが、次章の細気管支炎では逆になります。';
            }
          }
        ]
      }
    ]
  };

  /* ===================== 第5章 アラームとトラブル ===================== */

  var CH5 = {
    id: 'ch5', title: '第5章　アラームとトラブル', tag: 'トラブル',
    sub: '鳴ってから考えるのではなく、順番を決めておく。',
    lessons: [

      {
        id: '5-1', title: '気道内圧が上がった', minutes: 6,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4, flow: 24, pause: 0.3 },
        brief: [
          'PIP ↑・Pplat → （差が開いた）＝ 抵抗の問題。痰、チューブの屈曲・閉塞・咬み込み、気管支攣縮。',
          'PIP ↑・Pplat ↑（差は同じ）＝ コンプライアンスの問題。無気肺、気胸、肺水腫、腹部膨満。',
          '設定を変える前に吸気ポーズを 1 回。それだけで原因が半分に絞れる。'
        ],
        points: ['まず吸気ポーズで Pplat を測る', 'PIP だけ上がる＝抵抗',
          'PIP も Pplat も上がる＝コンプライアンス低下'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '午前 3 時。ハルト君のベッドでアラームが鳴った。気道内圧上限。'
          },
          {
            talk: true, who: 'doc',
            say: '鳴ってから考えると遅い。順番を決めておきます。まず、いまの数字を控えます。'
          },
          {
            say: 'いまの PIP と Pplat を覚えておいてください。',
            spot: ['val:PIP', 'val:Pplat'], watch: ['PIP', 'Pplat', 'Raw'],
            check: function (c) { return c.m.pplat != null && c.m.cstat != null; },
            onPass: function (c) { c.mem.pip0 = c.m.pip; c.mem.plat0 = c.m.pplat; },
            why: 'これが平常時の値です。'
          },
          {
            say: '患者が痰を貯めました。設定を変える前に、何をしますか。',
            onStart: function (c) {
              c.mem.rInsp0 = c.e.p.Rinsp; c.mem.rExp0 = c.e.p.Rexp;
              c.e.p.Rinsp = c.mem.rInsp0 * 7.0;
              c.e.p.Rexp = c.mem.rExp0 * 3.5;
              c.e._raise('気道内圧が上昇しています');
            },
            hint: '原因を切り分けるキーがハードキーにあります。',
            spot: 'hard:kInsp', watch: ['PIP', 'Pplat', 'Raw'],
            event: 'hold:insp',
            why: '正解です。吸気ポーズで Pplat を測ります。'
          },
          {
            say: '測り終わるのを待ち、さっきの値と比べてください。',
            watch: ['PIP', 'Pplat', 'Raw'],
            check: function (c) { return c.m.pplat != null && paused(c); },
            why: function (c) {
              return 'PIP は ' + Math.round(c.mem.pip0) + ' → ' + Math.round(c.m.pip)
                + ' と上がったのに、Pplat は ' + Math.round(c.mem.plat0) + ' → '
                + Math.round(c.m.pplat) + ' とほとんど変わっていません。';
            }
          },
          {
            talk: true, who: 'doc',
            say: 'PIP と Pplat、どちらが上がったか。それだけで犯人が絞れます。'
          },
          {
            quiz: {
              q: 'この所見から考えられるのはどれですか。',
              choices: ['肺が硬くなった', '気道抵抗が上がった', 'PEEP が高すぎる', '回路のリーク'],
              answer: 1,
              why: '差が開いた＝抵抗の増加で、Raw も上がっています。痰、屈曲、咬み込み、気管支攣縮を順に確認。'
                + '小児は体位を変えただけでチューブが折れたり深く入ったりするので、直前に何をしたかを必ず確かめます。'
            }
          },
          {
            quiz: {
              q: '吸引する前にやっておいたほうがよいことは？',
              choices: ['鎮静を深くする', 'FiO₂ を一時的に 100% にする', 'PEEP を下げる', '呼吸回数を上げる'],
              answer: 1,
              why: '吸引中は換気が止まり、陰圧で肺胞が潰れます。小児は酸素の蓄えが少なく、成人よりはるかに速く落ちます。'
                + 'カテーテルはチューブ内径の半分以下を選び、10〜15 秒以内で終えます。'
            }
          },
          {
            talk: true, who: 'puku',
            say: '痰なら、すぐ吸っちゃえばいいんじゃないの？'
          },
          {
            talk: true, who: 'doc',
            say: '吸引は酸素も一緒に持っていきます。先に貯金してから吸う。順番を守りましょう。'
          },
          {
            say: '「100% O₂」を押してから「気管吸引」を押してください。',
            spot: ['hard:kO2', 'hard:kSuc'], watch: ['PIP', 'SpO₂'],
            event: 'suction',
            onPass: function (c) {
              if (c.mem.rInsp0) { c.e.p.Rinsp = c.mem.rInsp0; c.e.p.Rexp = c.mem.rExp0; }
            },
            why: '痰が取れました。抵抗が戻り、PIP が下がります。'
          },
          {
            say: 'SpO₂ の動きを 30 秒見てください。',
            spot: 'val:SpO₂', watch: ['SpO₂', 'HR', 'PIP'],
            check: function (c) { return true; },
            hold: 30,
            why: '吸引の直後は陰圧で肺胞が虚脱するため、SpO₂ が一時的に下がって数分で戻ります。'
              + '慌てて FiO₂ を上げたままにしないこと。新生児では徐脈も起こるので心拍も一緒に見ます。'
          }
        ]
      },

      {
        id: '5-2', title: 'auto-PEEP ─ 吐ききれていない', minutes: 7,
        scenario: 'bronchiolitis',
        settings: { mode: 'VC-AC', vt: 45, rr: 45, peep: 6, fio2: 0.5, flow: 5, pause: 0.3 },
        brief: [
          '呼気が終わる前に次の吸気が来ると吐き残しがたまる。その圧が auto-PEEP。',
          '困るのは 3 つ。血圧が下がる、肺胞が余分に伸ばされる、吸っても auto-PEEP の分を吸い下げるまでトリガできない。',
          '対策はまず呼吸回数を下げること。次に吸気流量を上げて吸気時間を短くする。'
        ],
        points: ['auto-PEEP は吐き残しの圧', '呼気ポーズ（総 PEEP − 設定 PEEP）で測る',
          '対策の第一は呼吸回数を下げること'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'RSV のそうた君（生後 4 か月）。呼吸回数を上げたのに、血圧が下がってきた。'
          },
          {
            talk: true, who: 'doc',
            say: '入れることばかり見ていると、これを見落とします。吐けているかどうか。'
          },
          {
            talk: true, who: 'puku',
            say: '吐くのって、放っておけば出ていくんじゃないの？'
          },
          {
            talk: true, who: 'doc',
            say: '細い気道では、出ていく時間が足りません。波形に出ます。見てください。'
          },
          {
            say: '流量波形（真ん中、緑）を 20 秒見てください。呼気がゼロに戻りきっていますか。',
            spot: 'wave', watch: ['RR tot', 'I:E'],
            check: function (c) { return true; },
            hold: 20,
            why: '呼気が底からゼロに戻る前に、次の吸気で断ち切られています。これが吐き残しの形です。'
          },
          {
            say: '「呼気ポーズ」を押して、実際に測ってください。',
            spot: 'hard:kExp',
            event: 'hold:exp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。',
            spot: 'val:auto-PEEP', watch: ['auto-PEEP', 'PEEP tot', 'ABP mean'],
            check: function (c) { return paused(c) && c.m.autoPeep > 0; },
            onPass: function (c) { c.mem.ap0 = c.m.autoPeep; },
            why: function (c) {
              return '総 PEEP ' + c.m.peepTot.toFixed(1) + ' に対して設定 PEEP は ' + c.s.peep
                + '。差の ' + c.mem.ap0.toFixed(1) + ' cmH₂O が auto-PEEP です。';
            }
          },
          {
            talk: true, who: 'doc',
            say: '測れました。では、これを減らすにはどうするか。'
          },
          {
            quiz: {
              q: 'auto-PEEP をいちばん確実に減らすのはどれですか。',
              choices: ['呼吸回数を下げる', '一回換気量を上げる', '吸気時間を延ばす', 'PEEP を上げる'],
              answer: 0,
              why: '1 呼吸の時間が伸び、その分がそのまま呼気時間になります。'
                + '換気量を上げると吐く量が増えて逆効果、吸気時間を延ばすと呼気時間が削られます。'
            }
          },
          {
            say: '呼吸回数を下げ、auto-PEEP を 3 cmH₂O 未満にしてください。',
            hint: 'もう一度「呼気ポーズ」で測り直します。この乳児は呼気に 2 秒要るので RR 20〜25 が目安。',
            spot: ['key:rr', 'hard:kExp'], watch: ['auto-PEEP', 'ABP mean', 'MV'],
            check: function (c) {
              return c.m.autoPeep < 3 && c.s.rr < 30 && paused(c);
            },
            why: '呼吸回数を下げると CO₂ は上がりますが、細気管支炎では PaCO₂ 60〜70、pH 7.20 台までは許容します。'
              + '無理に正常化しようと回数を上げると、空気が溜まって血圧が下がります。'
          },
          {
            quiz: {
              q: '喘息重積の学童で吸気流量を 30 → 50 L/分 に上げたら、PIP は上がり Pplat は変わりません。これは？',
              choices: [
                '危険なのですぐ戻すべき',
                '吸気時間が短くなり呼気時間が伸びるので、この患者には有利',
                '換気量が増えすぎている',
                '意味がない操作'
              ],
              answer: 1,
              why: '上がった PIP は抵抗の分で、肺胞にはかかっていません。吸気が早く終わるぶん呼気に使える時間が増えます。'
                + '症例一覧の「喘息重積発作」で同じことを試せます。'
            }
          },
          {
            quiz: {
              q: 'auto-PEEP が 8 cmH₂O ある患者が、吸っても機械が反応しません。なぜですか。',
              choices: [
                'トリガ感度の設定ミス',
                'まず auto-PEEP の 8 cmH₂O 分を吸い下げないと、回路に流れが生まれないから',
                '鎮静が深いから',
                'リークがあるから'
              ],
              answer: 1,
              why: 'その子は毎回、余分な仕事を強いられています。外から PEEP をかけて差を埋める方法もありますが、'
                + 'まず吐かせるのが先。「合わないから鎮静を足す」の前に、ここを疑ってください。'
            }
          }
        ]
      },

      {
        id: '5-3', title: 'SpO₂ が下がった ─ DOPE で切り分ける', minutes: 7,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4, flow: 24, pause: 0.3 },
        brief: [
          'D 位置（片肺挿管・抜けかけ）／ O 閉塞（痰・屈曲・咬み込み）／ P 気胸 ／ E 機器と回路。',
          '小児は D と O が多い。気管が短くチューブが細く、首を動かすだけで位置が変わる。',
          '順番は ①FiO₂ 100% ②胸の上がりと呼吸音 ③PIP と Pplat ④分からなければ用手換気で切り分ける。'
        ],
        points: ['DOPE の 4 つを順に確認', 'まず FiO₂ 100%、次に患者を見る',
          '圧と量の動き方の組み合わせで切り分ける'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'モニタの音が高くなった。ハルト君の SpO₂ は {SpO₂}%。まだ下がっていく。',
            /* 病態はここで起こす。語っている最中に画面の数字が実際に落ちていくようにするため。 */
            onStart: function (c) {
              c.mem.c0 = c.e.C;
              c.mem.sh0 = c.e.p.shunt0; c.mem.shMin0 = c.e.p.shuntMin;
              c.e.C = c.mem.c0 * 0.42;
              c.e.p.shunt0 = 0.30; c.e.p.shuntMin = 0.30;
              c.e._raise('SpO₂ が低下しています');
            }
          },
          {
            talk: true, who: 'doc',
            say: 'DOPE。チューブのずれ、詰まり、気胸、機械の不具合。この 4 つを順に切ります。'
          },
          {
            talk: true, who: 'puku',
            say: '4 つも、あわてて思い出せないよ…'
          },
          {
            talk: true, who: 'doc',
            say: 'だから手が先です。まず酸素。考えるのはそのあとで間に合います。'
          },
          {
            say: 'SpO₂ が下がりはじめました。最初の一手を打ってください。',
            hint: '時間を稼いでから原因を探します。',
            spot: 'hard:kO2', watch: ['SpO₂', 'PIP', 'Pplat'],
            event: 'o2100',
            why: '2 分間だけ FiO₂ 100% になり、そのあと自動で元に戻ります。そのあいだに原因を探します。'
          },
          {
            say: '「吸気ポーズ」で、圧がどちらの型かを確かめてください。',
            spot: 'hard:kInsp', watch: ['PIP', 'Pplat', 'Vte'],
            event: 'hold:insp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。PIP・Pplat・Vte の 3 つを見てください。',
            watch: ['PIP', 'Pplat', 'Vte'],
            check: function (c) { return c.m.pplat != null && paused(c); },
            why: 'PIP も Pplat も上がり、Vte は設定どおり返っています。'
              + 'つまりリークでも抵抗でもなく、肺が硬くなった形です。'
          },
          {
            talk: true, who: 'doc',
            say: '圧の形と、聴診。2 つ合わせると 1 つに絞れます。'
          },
          {
            quiz: {
              q: 'この所見に加えて、左の呼吸音が聞こえません。何を疑いますか。',
              choices: ['右片肺挿管または気胸', '痰づまり', '回路のリーク', '鎮静が浅い'],
              answer: 0,
              why: 'チューブは右主気管支に入りやすいので、消えるのは左が多くなります。'
                + '小児では体位変換やケアのあとに起こり、0.5〜1 cm 引き抜けば戻ります。緊張性気胸なら血圧も下がります。'
            }
          },
          {
            say: '胸腔ドレーンが入りました。SpO₂ と圧が戻るのを 40 秒見てください。',
            onStart: function (c) {
              if (c.mem.c0) { c.e.C = c.mem.c0; }
              if (c.mem.sh0 != null) { c.e.p.shunt0 = c.mem.sh0; c.e.p.shuntMin = c.mem.shMin0; }
            },
            spot: 'val:SpO₂', watch: ['SpO₂', 'PIP', 'Pplat'],
            check: function (c) { return true; },
            hold: 40,
            why: '肺が戻れば圧も酸素化も戻ります。人工呼吸器の設定をいじっても直らない原因があることが分かります。'
          },
          {
            quiz: {
              q: 'では、SpO₂ が下がり PIP も Pplat も下がって Vte が急に減ったら？',
              choices: ['気胸', '痰づまり', '回路が外れた・大きなリーク', '肺水腫'],
              answer: 2,
              why: '圧も量も同時に下がるのはリークの形です。接続・カフ・加温加湿器を確認します。'
                + '小児では自己抜去もこの形になり、回路が小さく軽いぶん目立ちません。'
            }
          }
        ]
      }
    ]
  };

  /* ===================== 第6章 離脱と抜管 ===================== */

  var CH6 = {
    id: 'ch6', title: '第6章　離脱と抜管', tag: '離脱',
    sub: 'つけるより、外すほうが難しい。',
    lessons: [

      {
        id: '6-1', title: '離脱できる条件を確かめる', minutes: 6,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 18, peep: 10, fio2: 0.6, flow: 24, pause: 0.3 },
        sedation: 0.7,
        brief: [
          '毎日「外せるか」を確かめる。長くつけるほど肺炎・せん妄・筋力低下が積み上がるから。',
          '小児の条件：原因が改善、FiO₂ ≤0.4、PEEP ≤7、P/F ≥200、pH ≥7.30、循環が安定、覚醒、自発呼吸あり。',
          '成人よりやや厳しめに置く。チューブが細く、抜管後に上気道浮腫で戻ってくる率が高いため。'
        ],
        points: ['毎日「外せるか」を確かめる', '小児は PEEP 7 以下・P/F 200 以上とやや厳しめ',
          '抜管の可否は SBT の結果で決める'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '朝。ハルト君が目を開けて、チューブを気にして手を動かしている。'
          },
          {
            talk: true, who: 'puku',
            say: '元気そうだし、もう抜いちゃえば？'
          },
          {
            talk: true, who: 'doc',
            say: 'その「元気そう」を数字にして確かめるのが、この章です。'
          },
          {
            say: '「離脱」キーを押して、条件のリストを見てください。',
            spot: 'hard:kWean',
            event: 'weaning:open',
            why: '× がついている項目が、いま足りていないものです。'
          },
          {
            say: '設定と鎮静を調整して、リストの項目をすべて ✓ にしてください。',
            hint: 'FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅くして自発呼吸を出します。'
              + '「離脱」キーでいつでもリストを開き直せます。',
            spot: ['key:fio2', 'key:peep', 'key:sed'], watch: ['SpO₂', 'RR tot', 'ABP mean'],
            check: function (c) {
              return c.s.fio2 <= 0.41 && c.s.peep <= 7 && (c.e.pao2 / c.s.fio2) >= 200
                && c.e.ph >= 7.30 && c.e.map >= c.e.nm.mapMin && c.e.sedation <= 0.4
                && (c.m.rrSpont >= 4 || c.e.pmusAmp > 2);
            },
            why: '条件が揃いました。ここで初めて SBT に進めます。'
          },
          {
            talk: true, who: 'doc',
            say: '全部 ✓ になりました。では、このまま抜いていいでしょうか。'
          },
          {
            quiz: {
              q: '条件を全部満たしていれば、そのまま抜管してよいですか。',
              choices: ['よい', 'よくない。SBT で実際に耐えられるか確かめる', '半分でよい', '医師の判断次第'],
              answer: 1,
              why: '条件は「試してよい」という意味で、「外せる」ではありません。'
                + '呼吸筋の持久力は、この項目のどれにも表れないからです。'
            }
          },
          {
            quiz: {
              q: '鎮静を浅くしないまま離脱を進めると、何が困りますか。',
              choices: [
                '自発呼吸が出ないので、呼吸筋が持つかどうか評価できない',
                '血圧が上がる',
                'FiO₂ が下げられない',
                '特に困らない'
              ],
              answer: 0,
              why: '評価そのものが成り立ちません。毎日の鎮静中断と SBT をセットで行うと人工呼吸の日数が短くなります。'
                + 'ただし小児は自己抜去の危険があるので、評価のあいだは人手を確保します。'
            }
          }
        ]
      },

      {
        id: '6-2', title: 'SBT ─ 自発呼吸トライアル', minutes: 9,
        scenario: 'gbs',
        settings: { mode: 'VC-AC', vt: 160, rr: 16, peep: 5, fio2: 0.35, flow: 16, ps: 8, pause: 0.3 },
        sedation: 0.2,
        brief: [
          'SBT ＝ 手伝いをほとんど外した状態で 30 分耐えられるかを見る試験。PEEP 5 ＋ チューブ抵抗ぶんの PS。',
          '中止基準は年齢相応で置く。呼吸回数が正常上限の 1.5 倍、SpO₂ が目標を下回る、心拍 +25%、陥没呼吸や鼻翼呼吸。',
          '成人の RSBI は小児に使えない。f/VT ＝ RR ÷ Vt(mL/kg) で見て、8 超で失敗しやすい。'
        ],
        points: ['PEEP 5 ＋ チューブ抵抗ぶんの PS で 30 分（小児ほど PS は高め）',
          'f/VT = RR ÷ Vt(mL/kg)、8 超で失敗しやすい',
          '肺が正常でも呼吸筋が弱ければ離脱できない'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'ギラン・バレーのあかりちゃん（7歳）。肺はきれい。でも、力が入らない。'
          },
          {
            talk: true, who: 'doc',
            say: '肺が良くても外せないことがあります。この子で見るのは、肺ではなく筋力です。'
          },
          {
            talk: true, who: 'puku',
            say: '筋力って、どうやって測るの？'
          },
          {
            talk: true, who: 'doc',
            say: '浅くて速い呼吸になるかどうかで分かります。f/VT という数字にします。'
          },
          {
            quiz: {
              q: '体重 22 kg の児が RR 40、一回換気量 110 mL。f/VT はいくつですか。',
              choices: ['1.8', '8', '40', '判定できない'],
              answer: 1,
              why: '110 ÷ 22 ＝ 5 mL/kg、40 ÷ 5 ＝ 8。目安に達しており、抜管すると再挿管になりやすい状態です。'
                + '成人式の RSBI なら 364 となり、「105 超」では何も判断できません。'
            }
          },
          {
            say: '「離脱」キーから SBT を開始してください。',
            hint: '条件リストの下に「SBT を開始（30分）」があります。',
            spot: 'hard:kWean',
            event: 'sbt:start',
            why: 'PEEP 5 とチューブ抵抗ぶんの PS に切り替わり、30 分の計測が始まりました。'
          },
          {
            talk: true, who: 'doc',
            say: '30 分、そばで見ます。最初の 5 分ではなく、後半で崩れる子がいます。'
          },
          {
            say: '30 分の SBT を最後まで見てください。f/VT と呼吸回数の動きに注目します。',
            hint: '「× 10」または「× 60」で早送りできます。異常が出ると自動的に等速に戻ります。',
            spot: 'val:f/VT', watch: ['f/VT', 'RR tot', 'Vte', 'SpO₂'],
            check: function (c) { return c.sbt != null && c.sbt.done != null; },
            why: function (c) {
              return c.sbt.done === 'pass'
                ? '30 分、呼吸回数も酸素化も循環も保てました。抜管を検討できます。'
                : '途中で中止になりました。理由：' + c.sbt.failMsg;
            }
          },
          {
            quiz: {
              q: 'SBT 開始から 20 分かけて、じわじわ RR が上がり Vte が落ちてきました。これは何ですか。',
              choices: ['正常な適応', '呼吸筋疲労のサイン', '鎮静が効いてきた', '回路のリーク'],
              answer: 1,
              why: 'rapid shallow breathing です。SBT の失敗はこの形がいちばん多く、最初ではなく後半に出ます。'
                + '小児では数字より先に、陥没呼吸・鼻翼呼吸・シーソー呼吸が出ます。'
            }
          },
          {
            quiz: {
              q: 'SBT に失敗しました。次に何をしますか。',
              choices: [
                'すぐにもう一度 SBT をやる',
                '元の設定に戻して呼吸筋を休ませ、失敗の原因を探して翌日また試す',
                '鎮静を深くして様子を見る',
                '気管切開を即決する'
              ],
              answer: 1,
              why: '疲れた呼吸筋は 24 時間休ませ、そのあいだに原因（心不全、感染、栄養、電解質、せん妄、過鎮静）を探します。'
                + '小児では上気道の問題や神経筋疾患の進行も原因になります。'
            }
          }
        ]
      },

      {
        id: '6-3', title: '抜管、そしてそのあと', minutes: 7,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 18, peep: 5, fio2: 0.35, flow: 24, pause: 0.3 },
        sedation: 0.15,
        brief: [
          '呼吸が保てることと、気道が守れることは別。意識・咳嗽力・分泌物の量の 3 つを見る。',
          '小児は上気道浮腫が重い。同じ 1 mm の浮腫でも、細い気道では断面積が半分以下になる。',
          'だから抜管前にカフリークテスト。漏れなければステロイドを考える。迷えば高流量鼻カニュラや NPPV。'
        ],
        points: ['呼吸が保てること と 気道が守れること は別', '意識・咳嗽力・分泌物の 3 つを見る',
          '小児は上気道浮腫の影響が大きい。カフリークテストを忘れない'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'ハルト君の SBT、2 回目。今日は最後まで持ちそうだ。'
          },
          {
            talk: true, who: 'doc',
            say: '最後の関門です。呼吸の力だけでなく、気道を自分で守れるかを見ます。'
          },
          {
            say: '「離脱」キーから SBT を開始し、最後まで完走させてください。',
            hint: '早送りを使ってください。',
            spot: 'hard:kWean', watch: ['f/VT', 'RR tot', 'SpO₂'],
            check: function (c) { return c.sbt != null && c.sbt.done === 'pass'; },
            why: 'SBT に通りました。'
          },
          {
            quiz: {
              q: 'SBT に通りましたが、呼びかけに反応せず、吸引しても咳をしません。抜管しますか。',
              choices: ['する（SBT に通ったから）', 'しない（気道が守れない）', '鎮静を足してから抜管する', 'PS を上げて再評価'],
              answer: 1,
              why: '咳ができなければ痰を出せず、意識がなければ誤嚥します。抜管しても結局戻ってきます。'
                + '小児は気道が細いので、出せなかった痰がそのまま無気肺や再挿管につながります。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '抜いたあとの 1 時間が、いちばん気が抜けません。'
          },
          {
            quiz: {
              q: '抜管 1 時間後、吸気時に高い「ヒューヒュー」音と陥没呼吸が出ました。何を考えますか。',
              choices: ['気管支喘息', '上気道（声門下）の浮腫', '肺水腫', '正常な経過'],
              answer: 1,
              why: '吸気性の stridor は上気道の狭窄で、小児では声門下がいちばん細く、ここが腫れます。'
                + 'アドレナリン吸入とステロイドで対応し、改善しなければ再挿管を早めに決めます。'
            }
          },
          {
            talk: true, who: 'puku',
            say: '…だいじょうぶかな。'
          },
          {
            talk: true, who: 'doc',
            say: '条件はそろいました。抜きましょう。'
          },
          {
            say: '「離脱」キーから抜管してください。',
            spot: 'hard:kWean',
            event: 'extubate',
            why: ''
          },
          {
            say: '結果を確認してください。',
            watch: ['SpO₂', 'RR tot'],
            check: function (c) { return c.e.extubated === true; },
            why: '一通り終わりました。振り返り画面に、目標域にいた時間・肺保護の逸脱・有害事象が出ます。'
              + '症例一覧には早産児 RDS・細気管支炎・小児 ARDS・喘息重積もあります。'
              + '体重 1.1 kg から 35 kg まで、同じ考え方が桁の違う数字にどう化けるかを試してみてください。'
          }
        ]
      }
    ]
  };

  var CHAPTERS = [CH1, CH2, CH3, CH4, CH5, CH6];

  function allLessons() {
    var out = [];
    CHAPTERS.forEach(function (ch) {
      ch.lessons.forEach(function (l) { out.push({ chapter: ch, lesson: l }); });
    });
    return out;
  }

  function lessonById(id) {
    var f = allLessons().filter(function (x) { return x.lesson.id === id; })[0];
    return f ? f.lesson : null;
  }

  function chapterOf(id) {
    var f = allLessons().filter(function (x) { return x.lesson.id === id; })[0];
    return f ? f.chapter : null;
  }

  function nextLessonId(id) {
    var list = allLessons();
    for (var i = 0; i < list.length; i++) {
      if (list[i].lesson.id === id) return i + 1 < list.length ? list[i + 1].lesson.id : null;
    }
    return null;
  }

  /* ===================== 進行 ===================== */

  function Runtime(lesson) {
    this.lesson = lesson;
    this.index = 0;
    this.held = 0;
    this.finished = false;
    this.mem = {};
    this.wrong = 0;
    this.answered = null;     // クイズで選んだ番号（解説表示のあいだ保持する）
    this.feedback = null;     // { text, ok } 直前の結果
  }

  Runtime.prototype.task = function () {
    return this.finished ? null : this.lesson.tasks[this.index];
  };

  /* 進み具合は「やること」の数で数える。会話の場面まで数えると、
   * 読んだだけで進んだように見えてしまう。 */
  Runtime.prototype.progress = function () {
    var t = this.lesson.tasks, done = 0, total = 0;
    for (var i = 0; i < t.length; i++) {
      if (t[i].talk) continue;
      total++;
      if (i < this.index) done++;
    }
    return { done: done, total: total };
  };

  /** いま向かっている「やること」の番号。会話の場面は飛ばす。無ければ -1。 */
  Runtime.prototype.actionIndex = function () {
    var t = this.lesson.tasks;
    for (var i = this.index; i < t.length; i++) if (!t[i].talk) return i;
    return -1;
  };

  /** 課題に入るときの副作用（病態を起こすなど）を 1 回だけ実行する。 */
  Runtime.prototype.enter = function (c) {
    var t = this.task();
    if (!t || t._entered === this) return;
    t._entered = this;
    this.held = 0;
    this.answered = null;
    this.feedback = null;
    if (t.onStart) t.onStart(this.bind(c));
  };

  Runtime.prototype.bind = function (c) {
    c.mem = this.mem;
    return c;
  };

  /** dt はシミュレーション内の経過秒。進んだときだけ結果を返す。 */
  Runtime.prototype.poll = function (c, dt) {
    var t = this.task();
    if (!t) return null;
    this.enter(c);
    if (t.quiz || t.event || !t.check) return null;
    if (t.check(this.bind(c))) {
      this.held += dt;
      if (this.held >= (t.hold || 0)) return this.advance(c);
    } else {
      this.held = 0;
    }
    return null;
  };

  /** 機器の出来事を伝える。'hold:insp' など。 */
  Runtime.prototype.fire = function (name, c) {
    var t = this.task();
    if (!t || t.event !== name) return null;
    return this.advance(c);
  };

  /** クイズの答え。正解なら進み、誤答なら false を返して解説は出さない。 */
  Runtime.prototype.answer = function (choice, c) {
    var t = this.task();
    if (!t || !t.quiz) return null;
    this.answered = choice;
    if (choice !== t.quiz.answer) {
      this.wrong++;
      this.feedback = { ok: false, text: 'もう一度考えてみてください。' };
      return { ok: false };
    }
    var r = this.advance(c);
    r.ok = true;
    return r;
  };

  /** 会話の場面。「続ける」を押すと次へ進む。物語を読者の速さで進めるための入り口。 */
  Runtime.prototype.tap = function (c) {
    var t = this.task();
    if (!t || !t.talk) return null;
    return this.advance(c);
  };

  Runtime.prototype.holdRatio = function () {
    var t = this.task();
    if (!t || !t.hold) return 0;
    return Math.max(0, Math.min(1, this.held / t.hold));
  };

  Runtime.prototype.advance = function (c) {
    var t = this.task();
    var ctx = this.bind(c);
    if (t.onPass) t.onPass(ctx);
    var why = t.quiz ? t.quiz.why : t.why;
    if (typeof why === 'function') why = why(ctx);
    this.index++;
    this.held = 0;
    if (this.index >= this.lesson.tasks.length) this.finished = true;
    this.feedback = { ok: true, text: why || '' };
    return { advanced: true, why: why || '', finished: this.finished };
  };

  var api = {
    CHAPTERS: CHAPTERS,
    allLessons: allLessons,
    lessonById: lessonById,
    chapterOf: chapterOf,
    nextLessonId: nextLessonId,
    Runtime: Runtime
  };
  root.VentLessons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
