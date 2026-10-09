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
 *                   miss: [...] で選択肢ごとに「なぜ違うか」を一言返せる（正解の位置は null）。
 *   event の課題は missEvents: { 'suction': '…' } で、違うキーを押したときの一言を返せる。
 * 課題には表示の指定も付けられる。
 *   watch: ['Pplat', …] … その計測値を帯の中にも出す。課題に入った時点の値を控え、あとで「前 → 後」で見せる。
 *   spot:  'key:vt'     … いま押す／見るところを光らせる。文章で場所を説明しないための仕掛け。
 *                         'key:<設定キー>' / 'val:<計測値>' / 'hard:<ハードキーの id>' /
 *                         'mode:<モード>' / 'screen:<画面>' / 'dial' / 'wave' / 'lane:paw|flow|vol'。配列も可。
 *   look:  ['val:PIP']  … 会話・クイズで光らせるモニターの場所。書かなければ文から拾う（monitorSpots）。
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
  /* 離脱の条件（scenarios.js の weaningReadiness と同じ 7 項目）がすべてそろったか。 */
  function readyAll(c) {
    return c.s.fio2 <= 0.41 && c.s.peep <= 7 && (c.e.pao2 / c.s.fio2) >= 200
      && c.e.ph >= 7.30 && c.e.map >= c.e.nm.mapMin && c.e.sedation <= 0.4
      && (c.m.rrSpont >= 4 || (c.m.rrTrig || 0) >= 4 || c.e.pmusAmp > 2);
  }

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
          '設定の Vt は人が決めた量、Vte は実際に戻ってきた量。小児では mL/kg で読む。',
          '設定の略語：RR ＝ 1 分間の呼吸回数、PEEP ＝ 吐き終わっても残す圧、FiO₂ ＝ 吸わせる酸素の濃さ（空気は 21%）。'
        ],
        points: ['波形は上から Paw / Flow / Volume', '流量波形は上が吸気・下が呼気',
          '設定の Vt と実測の Vte は別物'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'ハルト君（8歳）が PICU のベッドに落ち着いた。虫垂炎の手術は終わったが、ショックが続くあいだは挿管のままだ。'
          },
          {
            talk: true, who: 'doc',
            say: '今夜の担当は{名前}先生です。まずは、この機械が何を言っているのかを読めるようにしましょう。'
          },
          {
            talk: true, who: 'puku',
            say: 'うわ、波形が 3 つもある…。どれが何なの？'
          },
          {
            talk: true, who: 'doc',
            say: '上から順に名前を言います。いちばん上は気道内圧（Paw）。気道の中の圧で、機械が空気を押し込むと高くなります。'
          },
          {
            talk: true, who: 'puku',
            say: '圧の単位の cmH₂O って、なに？'
          },
          {
            talk: true, who: 'doc',
            say: '水を何 cm 押し上げられるか、で表した圧です。呼吸器で扱う圧はとても小さいので、この単位を使います。'
          },
          {
            talk: true, who: 'doc',
            say: '真ん中は流量（Flow）。空気が流れる速さと向きです。1 分あたり何 L の勢いか（L/分）で表します。'
          },
          {
            talk: true, who: 'doc',
            say: 'いちばん下は換気量の波形（Volume）。その呼吸で肺に入った空気の量（mL）です。'
          },
          {
            look: ['wave'],
            talk: true, who: 'doc',
            say: '3 つとも呼吸に合わせて動きますが、1 つだけ動き方が違います。名前の意味を思い出しながら見てください。'
          },
          {
            spot: 'wave',
            quiz: {
              q: '3 つのうち、ゼロ線をまたいで上にも下にも振れるのはどれですか。',
              choices: ['気道内圧', '流量', '換気量', '二酸化炭素濃度'],
              answer: 1,
              miss: ['気道内圧は、吐き終わっても残しておく圧（PEEP）より下がりません。ずっとゼロより上です。', null,
                '換気量は吸うと増え、吐くと 0 に戻るだけ。マイナスにはなりません。',
                'CO₂ はこの画面の波形にはありません。'],
              why: '流量です。上が吸気、下が呼気。上下するのは流量だけなので、これが見分けの目印になります。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '読めましたね。次は触ってみましょう。実機は 3 段階です。キーを押す、ダイヤルを回す、確定。'
          },
          {
            talk: true, who: 'doc',
            say: '触るのは一回換気量（Vt）。1 回の呼吸で送り込む空気の量で、人が決める設定値です。'
          },
          {
            say: 'Vt を 180 mL にして確定してください。',
            hint: 'キーを押す → ダイヤルを回す → 確定。この 3 段階が実機の操作です。',
            spot: 'key:vt', watch: ['Vte'],
            check: function (c) { return c.s.vt === 180; },
            why: '確定を押すまで患者には反映されません。実機の誤操作防止と同じです。'
              + ' VC-AC は「量（Volume）を決めて（Control）、毎回すべて機械が送る（Assist/Control）」モードです。'
          },
          {
            talk: true, who: 'doc',
            say: '次は Vte を見ます。吐いて戻ってきた空気を、機械が測った量です。e は呼気（expiratory）の e。'
          },
          {
            talk: true, who: 'doc',
            say: 'Vt は「送って」と頼んだ量、Vte は実際に返ってきた量。この 2 つを見比べるのが、呼吸器を読む第一歩です。'
          },
          {
            say: 'Vte が設定に追いつくまで待ちます。',
            spot: 'val:Vte', watch: ['Vte', 'MV'],
            check: function (c) { return c.m.vte > 160; },
            why: 'VC は入れる量を機械が保証するので、Vte はほぼ設定どおりに返ってきます。'
          },
          {
            talk: true, who: 'doc',
            say: 'ほかの設定も、名前だけ先に。RR は 1 分間の呼吸回数、PEEP は吐き終わっても残しておく圧、FiO₂ は吸わせる酸素の濃さです。'
          },
          {
            look: ['val:Vte'],
            talk: true, who: 'puku',
            say: '入れた量と、戻ってくる量って、ちがうことあるの？'
          },
          {
            talk: true, who: 'doc',
            say: 'あります。しかもそれが、いちばん最初に気づくべき異常です。'
          },
          {
            talk: true, who: 'doc',
            say: '子どもの気管チューブには、すき間をふさぐ風船（カフ）が付いていないものもあります。それを頭に置いて考えてください。'
          },
          {
            quiz: {
              q: '設定 180 mL に対して Vte が 120 mL しか戻りません。まず疑うのは何ですか。',
              choices: ['正常。気にしなくてよい', '気管チューブ周囲のリーク', '鎮静が浅い', 'FiO₂ が低い'],
              answer: 1,
              miss: ['3 割も減るのは正常ではありません。入れた量がどこかへ逃げています。', null,
                '鎮静は吸う力に効きますが、機械が入れた量は減らしません。',
                'FiO₂ は酸素の濃さで、量には関係しません。'],
              why: '入れた量より戻る量が少なければリークです。カフなしチューブの年齢では日常的に起こります。'
                + 'カフ圧・回路の接続・チューブの深さを確認し、20% を超えるなら 1 サイズ太いチューブを考えます。'
            }
          }
        ]
      },

      {
        id: '1-2', title: 'PIP と Pplat ─ 圧は 2 つある', minutes: 5,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 180, rr: 20, peep: 5, fio2: 0.4, flow: 30, flowPattern: 'square', pause: 0 },
        brief: [
          'PIP ＝ ガスを気道に押し流す圧（流量 × 抵抗）＋ 肺を膨らませる圧（換気量 ÷ コンプライアンス）。',
          '吸気の終わりに流れを止めると前者が消え、残るのが Pplat。肺胞が受けている圧に近い。',
          '肺を傷めるのは PIP ではなく Pplat と ΔP（＝ Pplat − PEEP）。上限は年齢が下がるほど低い。'
        ],
        points: ['PIP = 抵抗の分 + 肺を膨らませる分', 'Pplat は吸気ポーズで測る',
          '上限は年齢で変わる（タイルの下に出ている）'],
        tasks: [
          {
            look: ['val:PIP'],
            talk: true, who: 'scene',
            say: 'ハルト君の設定はひとまず落ち着いた。いぶき先生が、画面の圧の数字を指さす。'
          },
          {
            talk: true, who: 'doc',
            say: '画面の PIP は最高気道内圧。1 回の呼吸のあいだで、気道内圧がいちばん高くなった瞬間の値です。'
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
            talk: true, who: 'doc',
            say: '空気を送るには、細い管の中を押し流す圧と、肺をふくらませる圧が要ります。管の通りにくさを気道抵抗と言います。'
          },
          {
            talk: true, who: 'doc',
            say: '吸気ポーズは、吸い終わった瞬間に弁を閉じ、空気の流れを一瞬止める操作です。流れが止まれば、押し流す分の圧は消えます。'
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
            say: '平らになったところが Pplat（プラトー圧）。流れが止まっても残っている、肺胞そのものにかかっている圧です。'
          },
          {
            look: ['val:PIP', 'val:Pplat'],
            talk: true, who: 'doc',
            say: '2 つに分かれました。どちらが何なのか、ここで確かめておきましょう。'
          },
          {
            watch: ['PIP', 'Pplat', 'PEEP tot'],
            quiz: {
              q: '出ている 3 つの数字のうち、気道抵抗にとられている分はどれですか。',
              choices: ['PIP − Pplat', 'Pplat − PEEP', 'PIP − PEEP', 'PEEP そのもの'],
              answer: 0,
              miss: [null, 'それは流れが止まったあとに肺胞にかかる圧（ΔP）です。',
                'それは抵抗の分と肺の分を合わせた全部です。', 'PEEP は呼気のあいだも保っている土台の圧です。'],
              why: 'PIP と Pplat の差が抵抗成分です。ここが大きいときは痰・チューブの屈曲・気管支攣縮を考えます。'
            }
          },
          {
            watch: ['Pplat', 'PEEP tot', 'ΔP'],
            quiz: {
              q: 'では、肺胞が 1 回の呼吸で引き伸ばされる圧（ΔP）はどれですか。',
              choices: ['PIP − Pplat', 'Pplat − PEEP', 'PIP − PEEP', 'Vte ÷ Pplat'],
              answer: 1,
              miss: ['それはさっきの抵抗の分です。流れが止まれば消えます。', null,
                'PIP には抵抗の分が混ざっています。肺胞の伸びだけを見たいのです。',
                '割り算は Cstat の考え方に近く、圧ではありません。'],
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
            talk: true, who: 'doc',
            say: '吸気流量は、吸気のときに機械が空気を送り込む速さ（L/分）。VC では、この速さも人が決める設定です。'
          },
          {
            say: '吸気流量を 15 L/分 に下げて確定してください。',
            hint: 'この 8歳の児で 15〜30 L/分、乳児なら 5〜10 L/分が目安です。',
            spot: 'key:flow', watch: ['PIP', 'Pplat'],
            onStart: function (c) { c.mem.pip30 = c.m.pip; },
            check: function (c) { return c.s.flow <= 15; },
            hold: 4,
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
            watch: ['Pplat', 'ΔP'],
            check: function (c) { return c.m.pplat != null && paused(c); },
            why: function (c) {
              return 'PIP は ' + Math.round(c.mem.pip30) + ' → {PIP} と下がったのに、Pplat は {Pplat} とほとんど動いていません。'
                + '流量を変えても肺の硬さは変わらないからです。';
            }
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
              miss: [null, '肺胞にかかる Pplat は変わっていません。守られたのは数字の見た目だけです。',
                '流量で PIP だけが動きました。同じものなら一緒に動くはずです。',
                'VC なので量は設定どおり。ゆっくり入れても同じ量が入ります。'],
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
            look: ['val:Cstat', 'val:Raw'],
            talk: true, who: 'doc',
            say: '肺の柔らかさと、気道の通りにくさです。夜中のアラームは、ほとんどこの 2 つで説明がつきます。'
          },
          {
            talk: true, who: 'doc',
            say: 'Cstat（静的コンプライアンス）は、圧を 1 cmH₂O かけたとき肺が何 mL ふくらむか。大きいほど柔らかい肺です。'
          },
          {
            talk: true, who: 'doc',
            say: 'Raw（気道抵抗）は、空気を流すのにどれだけ圧が要るか。大きいほど通りにくい。痰やチューブの細さで大きくなります。'
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
            hold: 6,
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
              miss: ['気道が細くなると上がるのは Raw です。Cstat は肺そのものの値です。', null,
                '鎮静は肺の柔らかさを変えません。', 'リークなら Vte が減りますが、Cstat の低下とは形が違います。'],
              why: '肺が硬くなっています。無気肺、肺水腫、肺炎、気胸。'
                + '小児で見落としやすいのが腹部膨満で、乳児は腹式呼吸なので胃の空気だけでも換気が悪くなります。'
            }
          },
          {
            quiz: {
              q: '別の児で PIP だけが 25 → 38 に上がり、Pplat は 18 のままです。原因は？',
              choices: ['肺が硬くなった', '気道抵抗が上がった', 'PEEP が高すぎる', '一回換気量が大きすぎる'],
              answer: 1,
              miss: ['肺が硬くなれば Pplat も上がるはずです。Pplat は動いていません。', null,
                'PEEP が高ければ Pplat も一緒に上がります。', '量が多ければ Pplat も上がります。'],
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
            say: 'あります。こちらは吐ききれているかを見るためのもの。これが大事になる子もいますが、それは別の機会にしましょう。'
          },
          {
            talk: true, who: 'doc',
            say: '呼気ポーズは、吐き終わりで弁を閉じ、肺の中に残った圧を測ります。これが総 PEEP。設定の PEEP より高ければ吐き残しがあります。'
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
              + '気道の細い乳児では、ここが問題になることがあります。'
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
            say: '朝の回診。申し送りのとおり、ハルト君の一回換気量は 300 mL に上げられていた。'
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
            say: '小児では体重 1 kg あたり 6〜8 mL。体重はカルテにあります。'
          },
          {
            talk: true, who: 'doc',
            say: '入れすぎると肺胞が伸ばされすぎて傷みます（人工呼吸器による肺傷害）。これを避けることを「肺保護」と言います。'
          },
          {
            say: '「患者情報」キーを押して、ハルト君の体重を確かめてください。',
            hint: '閉じるときは「呼吸器に戻る」。',
            spot: 'hard:kPt',
            event: 'patient',
            why: function (c) { return '体重 ' + c.pbw.toFixed(0) + ' kg。この数字に 6〜8 を掛けたものが目安です。まず、いまの値がいくつなのか確かめましょう。'; }
          },
          {
            talk: true, who: 'puku',
            say: 'mL/kg って、どうやって出すの？'
          },
          {
            talk: true, who: 'doc',
            say: 'Vte を体重で割るだけです。体重 1 kg あたり何 mL 入っているか、という意味になります。'
          },
          {
            spot: 'val:Vte', watch: ['Vte', 'Pplat', 'ΔP'],
            quiz: {
              q: 'いまの Vte は体重 1 kg あたり何 mL ですか。Vte のタイルで確かめてください。',
              choices: ['約 6 mL/kg', '約 8 mL/kg', '約 12 mL/kg', '約 20 mL/kg'],
              answer: 2,
              miss: ['6 mL/kg なら約 150 mL のはず。タイルの右上の数字を見てください。',
                '8 mL/kg なら約 200 mL のはず。タイルの右上の数字を見てください。', null,
                '20 mL/kg なら 500 mL。そこまでは入っていません。'],
              why: function (c) {
                return '約 ' + (c.m.vte / c.pbw).toFixed(1) + ' mL/kg。体重 '
                  + c.pbw.toFixed(0) + ' kg に対して明らかに入れすぎです。';
              }
            }
          },
          {
            say: '一回換気量を 6 mL/kg に合わせて確定してください。',
            hint: function (c) { return '体重 ' + c.pbw.toFixed(1) + ' kg × 6 ＝ 約 ' + mlkg(c, 6) + ' mL です。'; },
            spot: 'key:vt', watch: ['Vte', 'Pplat', 'ΔP'],
            check: function (c) { return Math.abs(c.s.vt - c.pbw * 6) <= 25; },
            hold: 6,
            why: '肺保護の基本設定になりました。Pplat と ΔP も一緒に下がっています。'
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
              miss: ['6 × 6 を計算し直してください。', null, 'それは 10 mL/kg。入れすぎです。',
                '小児こそ体重で決めます。1 kg から 35 kg まで幅があるからです。'],
              why: '36 mL です。成人の感覚で「少なすぎる」と増やしてしまうのが、小児でいちばん多い間違い。'
                + '回路の伸びやリークで実測がぶれるので、Vte は必ず mL/kg で読みます。'
            }
          },
          {
            quiz: {
              q: '10歳、身長 138 cm（標準体重 32 kg）、実体重 58 kg の肥満児。基準はどれですか。',
              choices: ['実体重 58 kg', '身長相当の標準体重 32 kg', '2 つの平均', '身長だけで決める'],
              answer: 1,
              miss: ['脂肪がついても肺は大きくなりません。実体重では入れすぎです。', null,
                '平均でも入れすぎです。肺の大きさは身長で決まります。',
                '身長から出した標準体重を使う、が正確な言い方です。'],
              why: '標準体重 32 kg で計算します。ただし腹圧で横隔膜が押し上げられるため、PEEP は高めが要ることがあります。'
            }
          }
        ]
      },

      {
        id: '2-2', title: '呼吸回数と分時換気量', minutes: 5,
        scenario: 'postop',
        settings: { mode: 'VC-AC', vt: 150, rr: 10, peep: 5, fio2: 0.4, flow: 20, pause: 0.3 },
        sedation: 0.95,                  // 自発を止めておき、RR tot が設定 RR どおりに動くのを見せる
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
            say: 'ぶんじかんきりょう？'
          },
          {
            talk: true, who: 'doc',
            say: '分時換気量（MV）は、1 分間に肺を出入りする空気の総量。一回換気量 × 呼吸回数（RR）で出ます。'
          },
          {
            talk: true, who: 'doc',
            say: '体の CO₂ は、吐く息でしか外に出られません。だから MV が増えれば CO₂ は下がり、減れば上がります。'
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
            check: function (c) { return c.s.rr > 10 && c.m.mv >= 3.0 && c.m.mv <= 4.2; },
            hold: 30,
            why: '体重 25 kg では 120〜170 mL/kg/分 が安静時の目安です。'
              + '乳児はもっと多く要ります（200 mL/kg/分 前後）。代謝が体重あたりで大きいからです。'
          },
          {
            talk: true, who: 'doc',
            say: '1 回の呼吸は、吸う時間（吸気時間）と吐く時間（呼気時間）の 2 つでできています。吸気時間は設定でほぼ決まっています。'
          },
          {
            quiz: {
              q: 'RR を 20 から 30 に上げました。1 回の呼吸に使える時間はどうなりますか。',
              choices: ['3.0 秒 → 2.0 秒に短くなる', '変わらない', '2.0 秒 → 3.0 秒に長くなる', '吸気時間だけが伸びる'],
              answer: 0,
              miss: [null, '1 分は 60 秒のまま。回数が増えれば 1 回に使える時間は減ります。',
                '逆です。60 ÷ 20 ＝ 3 秒、60 ÷ 30 ＝ 2 秒。', '吸気時間は設定で決まっていて、削られるのは呼気のほうです。'],
              why: '60 ÷ RR が 1 呼吸の長さです。吸気時間が同じなら、短くなった分はすべて呼気時間から削られます。'
            }
          },
          {
            talk: true, who: 'puku',
            say: 'タウ（τ）って何？'
          },
          {
            talk: true, who: 'doc',
            say: '吐くときの速さの目安です。τ ＝ Raw × Cstat。1τ で 6 割、3τ でほぼ全部（95%）吐き出せます。'
          },
          {
            quiz: {
              q: 'τ が 0.7 秒の乳児。吐ききるのに必要な呼気時間はおよそ何秒ですか。',
              choices: ['0.2 秒', '2 秒', '6 秒', '10 秒'],
              answer: 1,
              miss: ['1τ にも足りません。3 割も吐けないうちに次が来ます。', null,
                '3τ で 95% 出ます。9τ 近くも待つ必要はありません。', '長すぎます。3τ で考えます。'],
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
            talk: true, who: 'doc',
            say: 'FiO₂ は吸わせる酸素の濃さ。部屋の空気は 21%、最大は 100% です。濃い酸素を長く吸わせると、それ自体が肺を傷めます。'
          },
          {
            talk: true, who: 'doc',
            say: 'SpO₂ は指先のセンサーで測る、血液が運んでいる酸素の割合です。この年齢の子の目標は 94〜98%。'
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
              miss: ['100% は余裕の量を教えてくれません。高い酸素そのものが害になります。', null,
                '酸素化は足りています。PEEP を上げる理由がありません。', '換気量は CO₂ のつまみです。'],
              why: 'SpO₂ 100% は「PaO₂ が 100 以上のどこか」という意味しかなく、余裕の量は見えません。'
                + '高い FiO₂ を続ける理由がないので下げます。'
            }
          },
          {
            talk: true, who: 'doc',
            say: 'もう 1 つのつまみ、PEEP。この子の肺はほぼ正常なので、上げても酸素化はほとんど変わりません。見るのは別のところです。'
          },
          {
            talk: true, who: 'doc',
            say: 'PEEP は、吐き終わっても気道に残しておく圧。肺胞がしぼみきって潰れないように、内側から支えます。'
          },
          {
            say: 'PEEP を 12 cmH₂O まで上げて確定してください。',
            spot: 'key:peep', watch: ['ABP mean', 'Pplat', 'SpO₂'],
            check: function (c) { return c.s.peep >= 12; },
            why: ''
          },
          {
            talk: true, who: 'doc',
            say: '平均動脈圧（ABP mean）は、1 拍を通した血圧の平均。臓器に血液が届いているかの目安です。'
          },
          {
            say: 'そのまま 45 秒、平均動脈圧を見てください。',
            spot: 'val:ABP mean', watch: ['ABP mean', 'SpO₂', 'Pplat'],
            check: function (c) { return c.s.peep >= 12; },
            hold: 45,
            why: function (c) {
              return '平均動脈圧 {ABP mean} mmHg（この年齢の下限は ' + c.e.nm.mapMin + '）。SpO₂ はほとんど変わっていません。'
                + '胸腔内圧が上がって静脈還流が減り、心拍出量が落ちました。';
            }
          },
          {
            say: 'PEEP を 5 cmH₂O に戻してください。',
            spot: 'key:peep', watch: ['ABP mean', 'SpO₂'],
            check: function (c) { return c.s.peep <= 5; },
            why: 'PEEP は高いほど良いものではなく、開ける肺が残っているときに効くものです。'
              + '本当に効くのは、ARDS のように潰れた肺胞が多い肺です。'
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
            say: '3 番ベッドのミオちゃん（3歳）。インフルエンザ肺炎で、胸の X 線は両肺が真っ白だ。'
          },
          {
            talk: true, who: 'doc',
            say: '同じ肺でも、量を決めるか圧を決めるかで、この子の安全域が変わります。'
          },
          {
            talk: true, who: 'doc',
            say: 'ミオちゃんは小児 ARDS。肺全体に炎症が起き、肺胞が水びたしになって潰れ、肺が硬くなっている状態です。'
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
            talk: true, who: 'doc',
            say: 'VC（量規定）は、毎回決まった量を送るやり方。PC（圧規定）は、決まった圧までふくらませ、その圧を保つやり方です。'
          },
          {
            talk: true, who: 'doc',
            say: '後ろの AC は、すべての呼吸を機械が同じ形で送るという意味。いまの VC-AC を PC-AC に変えます。'
          },
          {
            say: 'モードを「PC-AC」に切り替えてください。',
            spot: 'mode:PC-AC',
            event: 'mode:PC-AC',
            why: '次の呼吸から、圧波形が四角い台形に変わります。設定した圧まで一気に上げ、吸気のあいだ保つからです。'
          },
          {
            talk: true, who: 'doc',
            say: 'P insp は、PC で決める吸気の圧。PEEP にどれだけ上乗せするかの値です。上げるほど、入る量が増えます。'
          },
          {
            say: 'P insp を動かして Vte を 6 mL/kg 前後にし、20 秒保ってください。',
            hint: function (c) { return '体重 ' + c.pbw + ' kg なので目標は ' + mlkg(c, 6) + ' mL 前後です。'
              + 'P insp は PEEP への上乗せで、PIP ≒ PEEP ＋ P insp になります。'; },
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
              miss: ['PC では圧は設定どおりに保たれます。動くのは別のものです。', null,
                '回数は設定で決まっていて、肺の硬さでは変わりません。', '圧が同じで肺が硬ければ、入る量が変わります。'],
              why: '圧は設定どおりなので、そのかわり入る量が減ります。'
                + 'PC は「静かに換気量が減っていく」のが危険な形で、Vte と MV のアラームが命綱になります。'
            }
          },
          {
            quiz: {
              q: '同じことが VC で起きたら何が起きますか。',
              choices: ['気道内圧が上がる', '一回換気量が減る', '呼吸回数が上がる', '何も変わらない'],
              answer: 0,
              miss: [null, 'VC は量を約束するモードです。量は守られます。',
                '回数は設定で決まっていて、肺の硬さでは変わりません。', '同じ量を硬い肺に入れれば、何かが変わります。'],
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
            say: '昇圧薬が減り、ハルト君の鎮静を浅くしはじめた。胸が、機械より先に動きはじめている。'
          },
          {
            talk: true, who: 'doc',
            say: 'ここから患者が呼吸に参加します。その「吸いたい」を機械がどう受け取るかが、トリガです。'
          },
          {
            talk: true, who: 'doc',
            say: 'トリガは「引き金」のこと。患者が吸おうとした瞬間を機械が見つけて、送気を始める仕組みです。'
          },
          {
            say: '「鎮静」を 40% まで下げて確定してください。',
            hint: '鎮静は人工呼吸器ではなくシミュレーターの操作なので、キーが点線で囲まれています。',
            spot: 'key:sed', watch: ['RR tot'],
            check: function (c) { return c.e.sedation <= 0.42; },
            why: '呼吸中枢が働きはじめます。'
          },
          {
            talk: true, who: 'doc',
            say: 'RR tot は実際の呼吸回数。設定した回数に、この子が自分で吸った回数が上乗せされます。'
          },
          {
            say: '患者が吸った回数（トリガ）が 4 回/分 以上になるまで待ちます。',
            hint: 'RR tot のタイルの下に「トリガ」の回数が出ます。「× 10」で早送りもできます。',
            spot: 'val:RR tot', watch: ['RR tot'],
            check: function (c) { return (c.m.rrTrig || 0) >= 4; },
            why: 'A/C なので、患者が吸うたびに設定どおりの換気が 1 回送られます。'
              + 'だから RR tot は設定 RR より多くなり、その差が患者のトリガです。'
          },
          {
            talk: true, who: 'doc',
            say: 'トリガ感度は、回路にこれだけの流れ（L/分）が生まれたら「吸った」と見なす、というしきい値。数字が大きいほど鈍くなります。'
          },
          {
            talk: true, who: 'puku',
            say: '感度を鈍くしたら、どうなるの？'
          },
          {
            talk: true, who: 'doc',
            say: 'やってみましょう。いちばん鈍くします。見るのは数字より圧波形です。'
          },
          {
            say: 'トリガ感度を 8 L/分 にして確定し、圧波形を 25 秒見てください。',
            spot: ['key:trig', 'wave'], watch: ['RR tot'],
            check: function (c) { return c.s.trigFlow >= 7.5; },
            hold: 25,
            why: '送気の合間に、圧波形が小さく下へ沈んでいます（流量にも小さな山）。'
              + 'この子は吸おうとしているのに、機械が応えていません。'
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
              miss: ['手間は減っていません。吸っても空気が来ないので、むしろ増えています。', null,
                '覚醒してきた子です。吸おうとして来ないのは、はっきり苦しい。',
                '機械は応えていないので、換気はむしろ足りなくなります。'],
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
            hold: 4,
            why: '沈み込むたびに送気が始まるようになりました。この子の吸気に、機械がついてきています。'
          },
          {
            quiz: {
              q: '逆に敏感にしすぎたり、チューブ周囲のリークが大きいと何が起こりますか。',
              choices: ['何も起こらない', '換気量が減る', '患者が吸っていないのに送気される', '呼気時間が伸びる'],
              answer: 2,
              miss: ['敏感すぎると、吸っていない揺れまで「吸った」と数えます。',
                '送気はむしろ増えます。', null, '送気が増えるぶん、呼気時間は短くなります。'],
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
            talk: true, who: 'doc',
            say: '全部やるのが A/C。すべての呼吸を機械が同じだけ送ります。いまのハルト君も、これです。'
          },
          {
            talk: true, who: 'doc',
            say: 'SIMV は、決めた回数だけ機械が送り（強制換気）、そのあいだは患者が自分で吸います。PSV は、患者が吸うたびに圧で後押しするだけです。'
          },
          {
            talk: true, who: 'doc',
            say: 'その後押しを PS（プレッシャーサポート）と言います。患者が吸いはじめたら、決めた圧まで機械が手伝います。'
          },
          {
            say: 'モードを「SIMV」に切り替えてください。',
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
              var mand = Math.max(0, Math.round(c.m.rrTotal) - Math.round(c.m.rrSpont));
              return '実測 ' + Math.round(c.m.rrTotal) + ' 回/分のうち、強制換気が ' + mand
                + '（設定 RR ' + c.s.rr + '）、自発が ' + Math.round(c.m.rrSpont)
                + '。設定を超えた分だけ、患者が自分で呼吸しています。';
            }
          },
          {
            look: ['val:RR tot'],
            quiz: {
              q: 'SIMV で設定 RR 10、実測 RR 18 でした。差の 8 回は何ですか。',
              choices: ['機械の誤作動', '患者自身の自発呼吸', 'オートトリガ', '無呼吸バックアップ'],
              answer: 1,
              miss: ['SIMV では設定を超える分があるのが普通です。', null,
                'オートトリガもありえますが、まず考えるのは患者の呼吸です。',
                'バックアップは呼吸が止まったときの仕組みです。'],
              why: '患者の自発呼吸です。2 種類の呼吸が混ざるので、波形も大きい山と小さい山が交互に出ます。'
            }
          },
          {
            talk: true, who: 'puku',
            say: 'SIMV と PSV、聞いただけだと、まだピンとこない…'
          },
          {
            talk: true, who: 'doc',
            say: 'SIMV は決めた回数だけ必ず送ります。PSV は機械からは 1 回も送りません。切り替えれば分かります。'
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
                '機械からは送られず、無呼吸アラームが鳴ってバックアップ換気が始まる',
                '自動的に A/C に切り替わって終わり',
                'PS が自動で上がる'
              ],
              answer: 1,
              miss: ['PSV には設定 RR がありません。患者が吸わなければ送りません。', null,
                'モードが勝手に変わって終わり、にはなりません。一時的な救済だけです。',
                'PS は吸ったときに手伝う圧で、吸わなければ出番がありません。'],
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
            say: '朝 6 時。ハルト君の定時の採血。いぶき先生が、結果の読み方を教えてくれるという。'
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
            say: '返ってきましたね。まず、いまの結果を順番どおりに読んでみましょう。'
          },
          {
            talk: true, who: 'doc',
            say: 'pH は血液の酸性・アルカリ性の度合い。正常は 7.35〜7.45。低ければ酸性に傾いた状態（アシデミア）、高ければアルカレミアです。'
          },
          {
            talk: true, who: 'doc',
            say: 'PaCO₂ は動脈血の二酸化炭素の圧。呼吸で決まり、正常は 35〜45 mmHg。上がるほど血液は酸性に傾きます。'
          },
          {
            talk: true, who: 'doc',
            say: 'HCO₃⁻ は重炭酸イオン。血液のアルカリ役で、腎臓が調節します。正常は 21〜26。下がるほど酸性に傾きます。'
          },
          {
            talk: true, who: 'puku',
            say: 'アシドーシスとか、呼吸性とか代謝性とか、よく聞くけど…'
          },
          {
            talk: true, who: 'doc',
            say: 'pH を下げる向きの異常がアシドーシス、上げる向きがアルカローシス。原因が CO₂ なら呼吸性、HCO₃⁻ なら代謝性です。'
          },
          {
            quiz: {
              q: function (c) {
                var g = c.lastAbg;
                return 'いまの結果は pH ' + g.ph.toFixed(2) + ' / PaCO₂ ' + g.paco2.toFixed(0)
                  + ' / HCO₃⁻ ' + g.hco3.toFixed(0) + '。どう読みますか。';
              },
              choices: ['ほぼ正常範囲', '呼吸性アシドーシス', '代謝性アシドーシス', '呼吸性アルカローシス'],
              answer: 0,
              miss: [null, 'pH と PaCO₂ を基準値と比べてください。どちらも範囲に入っています。',
                'HCO₃⁻ は下がっていません。', 'PaCO₂ は下がっていません。'],
              why: '① pH は正常、② PaCO₂ も正常、③ HCO₃⁻ も正常。いまの設定で換気は足りています。'
                + '正常を一度読んでおくと、崩れたときの違いに気づけます。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '代償は、片方が崩れたとき、もう片方が pH を戻そうと動くこと。CO₂ が上がれば、腎臓が HCO₃⁻ を増やして釣り合わせます。'
          },
          {
            talk: true, who: 'doc',
            say: '代償の目安を 1 つだけ。PaCO₂ が 10 上がると、HCO₃⁻ は急性なら +1、数日たった慢性なら +3.5。'
          },
          {
            quiz: {
              q: 'pH 7.28 / PaCO₂ 58 / HCO₃⁻ 26。これは何ですか。',
              choices: ['代謝性アシドーシス', '急性の呼吸性アシドーシス', '慢性の呼吸性アシドーシス', '呼吸性アルカローシス'],
              answer: 1,
              miss: ['HCO₃⁻ は下がっていません。主犯は PaCO₂ です。', null,
                '慢性なら HCO₃⁻ は +6 前後（約 30）まで上がっているはず。+2 は急性の予想です。',
                'pH 7.28 はアシデミアです。'],
              why: 'PaCO₂ +18 に対し HCO₃⁻ は +2 と、急性の予想どおりです。'
                + 'これが HCO₃⁻ 35・pH 7.36 なら腎性代償が完成した慢性型で、気管支肺異形成症や神経筋疾患で見ます。'
            }
          },
          {
            quiz: {
              q: 'pH 7.22 / PaCO₂ 30 / HCO₃⁻ 12。これは何ですか。',
              choices: ['呼吸性アシドーシス', '代謝性アシドーシスと呼吸性代償', '呼吸性アルカローシス', '混合性アルカローシス'],
              answer: 1,
              miss: ['PaCO₂ は 30 と低い。呼吸はむしろ CO₂ を吐き出しています。', null,
                'pH 7.22 なのでアルカローシスではありません。', 'pH 7.22 なのでアルカローシスではありません。'],
              why: 'アシデミアなのに PaCO₂ は低い。主犯は HCO₃⁻ 12 で、低い PaCO₂ は過換気で代償している姿です。'
                + 'ここで鎮静をかけて呼吸を抑えると、pH は一気に落ちます。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '酸素化は別枠で P/F 比を見ます。PaO₂ を FiO₂（小数。40% なら 0.4）で割った値。正常は 400 以上で、低いほど悪い。'
          },
          {
            quiz: {
              q: 'PaO₂ 70 mmHg、FiO₂ 0.8 のときの P/F 比は？',
              choices: ['56', '88', '140', '判定できない'],
              answer: 1,
              miss: ['掛け算になっています。PaO₂ を FiO₂ で割ります。', null,
                'FiO₂ を 0.5 で割っています。0.8 で割ります。', 'PaO₂ と FiO₂ があれば計算できます。'],
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
              miss: ['FiO₂ は酸素のつまみ。CO₂ には効きません。', 'PEEP は酸素化のつまみ。CO₂ には効きません。', null,
                '呼吸が弱くなり、CO₂ はむしろ上がります。'],
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
            talk: true, who: 'doc',
            say: 'ヒントは死腔。口から気管支までの通り道にある空気は、肺胞まで届かず、ガス交換に使われません。1 回の呼吸ごとに、その分が無駄になります。'
          },
          {
            quiz: {
              q: 'Vt 120→160 と RR 20→27、どちらがよく効きますか（MV の増分はほぼ同じ）。',
              choices: ['Vt を増やすほう', 'RR を上げるほう', '同じ', '場合による'],
              answer: 0,
              miss: [null, '回数を増やすと、そのたびに死腔の分も一緒に増えます。',
                'MV は同じでも、死腔を引いた残り（肺胞換気量）が違います。',
                '肺が正常なら答えは決まります。例外は Pplat の上限に当たるときです。'],
              why: '回数を増やすと死腔換気も一緒に増えます。ただし Pplat と ΔP の上限が先に来ます。'
                + '小児 ARDS のように Vt を増やせない場面では、やむをえず RR で押します。'
            }
          },
          {
            quiz: {
              q: 'RR を上げすぎたときに起きることはどれですか。',
              choices: ['auto-PEEP', '高 FiO₂ による酸素毒性', 'リーク', 'カフ圧の上昇'],
              answer: 0,
              miss: [null, 'FiO₂ は回数とは関係ありません。', 'リークは回数では起きません。', 'カフ圧は回数では変わりません。'],
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
            say: '夜中に血圧が下がり、ミオちゃんの PEEP は 5 まで下げられていた。輸液で血圧は戻ったが、FiO₂ {FiO₂}% でも SpO₂ は {SpO₂}% までしか上がらない。'
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
            talk: true, who: 'doc',
            say: 'PEEP で吐き終わりにも圧を残すと、潰れていた肺胞が開いたまま保たれます。潰れた肺胞を開き直すことを、リクルートと言います。'
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
            why: function (c) {
              return 'ARDS の肺にはリクルートできる部分が多いので、酸素化が改善します。'
                + (c.e.map < c.e.nm.mapMin
                  ? 'ただし平均動脈圧 {ABP mean} は下限 ' + c.e.nm.mapMin + ' を割りました。輸液が足りているか、PEEP を 2 下げるかを考えます。'
                  : '');
            }
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
              miss: ['上げても P/F が動かないなら、足りないのではなく開く肺がないのです。', null,
                'シャントには FiO₂ は効きにくく、血圧の問題も残ります。',
                '血圧が 18 も下がるのは誤差ではありません。'],
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
            talk: true, who: 'scene',
            say: '昼。ミオちゃんの CO₂ が上がってきたため、一回換気量が 130 mL（9 mL/kg）に増やされていた。'
          },
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
            talk: true, who: 'doc',
            say: 'これを permissive hypercapnia（許容的高二酸化炭素血症）と言います。肺を守るために、CO₂ が高いのを承知で許す方針です。'
          },
          {
            talk: true, who: 'doc',
            say: '肺保護の目安は、一回換気量 5〜6 mL/kg、Pplat と ΔP は上限以下。上限は年齢で違い、それぞれのタイルの下に出ています。'
          },
          {
            spot: ['val:Vte', 'val:Pplat'], watch: ['Vte', 'Pplat', 'ΔP'],
            quiz: {
              q: 'いまの Vte は何 mL/kg ですか。Vte のタイルで確かめてください。',
              choices: ['約 5 mL/kg', '約 7 mL/kg', '約 9 mL/kg', '約 12 mL/kg'],
              answer: 2,
              miss: ['タイルの右上をもう一度。5 mL/kg なら 70 mL ほどのはずです。',
                'タイルの右上をもう一度。7 mL/kg なら 100 mL ほどのはずです。', null,
                'タイルの右上をもう一度。そこまでは入っていません。'],
              why: function (c) {
                return 'Vte ' + (vtPerKg(c)).toFixed(1) + ' mL/kg、Pplat {Pplat}。肺保護の枠をはみ出しています。';
              }
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
              miss: ['数字を良くするために肺を傷めることになります。', null,
                'PEEP は酸素化のつまみで、CO₂ は下がりません。', '呼吸が抑えられ、CO₂ はむしろ上がります。'],
              why: 'pH 7.25 以上なら許容範囲です。ここで Vt を増やすのは、数字を良くするために肺を傷めること。'
                + 'もう少し上げたいなら RR で、この年齢なら 40〜50 /分 まで使えることもあります。'
            }
          },
          {
            say: 'Vt は触らず RR だけを上げ、採血で pH 7.25 以上を確かめてください。',
            hint: 'RR を 4〜6 回/分 ずつ上げ、「× 10」で数分進めてから採血します。',
            spot: ['key:rr', 'hard:kAbg'], watch: ['Vte', 'MV', 'auto-PEEP'],
            onStart: function (c) { c.mem.nAbg = c.abgs.length; c.mem.vt44 = c.s.vt; },
            check: function (c) {
              return c.abgs.length > c.mem.nAbg && c.lastAbg.ph >= 7.25 && c.s.vt <= c.mem.vt44;
            },
            why: function (c) {
              return 'pH ' + c.lastAbg.ph.toFixed(2) + '、PaCO₂ ' + c.lastAbg.paco2.toFixed(0)
                + '。Vt を触らずに pH を戻せました。小児 ARDS ではこれが正しい順番です。';
            }
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
                + ' ARDS の肺は硬いぶん早く吐けるので高い RR に耐えますが、細気管支炎のように気道が細い肺では逆になります。';
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
            say: '午前 3 時。ハルト君のベッドサイドで、いぶき先生が夜の回診をしている。'
          },
          {
            talk: true, who: 'doc',
            say: 'アラームは鳴ってから考えると遅い。順番を決めておきます。まず、落ち着いているいまの数字を控えます。'
          },
          {
            say: 'いまの PIP と Pplat を覚えておいてください。',
            spot: ['val:PIP', 'val:Pplat'], watch: ['PIP', 'Pplat', 'Raw'],
            check: function (c) { return c.m.pplat != null && c.m.cstat != null; },
            onPass: function (c) { c.mem.pip0 = c.m.pip; c.mem.plat0 = c.m.pplat; },
            why: 'これが平常時の値です。'
          },
          {
            talk: true, who: 'scene',
            say: 'そのとき、アラームが鳴った。気道内圧上限。ハルト君がむせている。',
            onStart: function (c) {
              c.mem.rInsp0 = c.e.p.Rinsp; c.mem.rExp0 = c.e.p.Rexp;
              c.e.p.Rinsp = c.mem.rInsp0 * 7.0;
              c.e.p.Rexp = c.mem.rExp0 * 3.5;
              c.e._raise('気道内圧が上昇しています');
            }
          },
          {
            talk: true, who: 'doc',
            say: '気道内圧上限のアラームは、PIP が設定した上限に届くと鳴ります。その呼吸は途中で打ち切られ、送れる量も減ります。'
          },
          {
            say: 'PIP が急に上がりました。設定を変える前に、何をしますか。',
            hint: '原因を切り分けるキーがハードキーにあります。',
            spot: 'hard:kInsp', watch: ['PIP', 'Pplat', 'Raw'],
            event: 'hold:insp',
            missEvents: {
              'suction': 'まだ原因が分かっていません。痰なのか、肺が硬くなったのか、先に切り分けます。',
              'o2100': '酸素化は保たれています。いま知りたいのは、圧が上がった理由です。',
              'hold:exp': '呼気ポーズは吐き残しを見るもの。上がった PIP の中身を分けるのは別のキーです。'
            },
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
              miss: ['肺が硬くなれば Pplat も上がります。Pplat は動いていません。', null,
                'PEEP は触っていません。', 'リークなら圧も量も下がります。'],
              why: '差が開いた＝抵抗の増加で、Raw も上がっています。聴診すると痰の音。ハルト君は痰でした。'
                + '痰、屈曲、咬み込み、気管支攣縮を順に確認します。'
                + '小児は体位を変えただけでチューブが折れたり深く入ったりするので、直前に何をしたかを必ず確かめます。'
            }
          },
          {
            quiz: {
              q: '吸引する前にやっておいたほうがよいことは？',
              choices: ['鎮静を深くする', 'FiO₂ を一時的に 100% にする', 'PEEP を下げる', '呼吸回数を上げる'],
              answer: 1,
              miss: ['鎮静は咳を止めるだけで、痰は減りません。', null,
                '吸引で肺胞は潰れやすくなります。PEEP を下げるのは逆です。', '回数では吸引中の酸素の落ち込みは防げません。'],
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
            say: 'SpO₂ の動きを 1 分見てください。',
            spot: 'val:SpO₂', watch: ['SpO₂', 'HR', 'PIP'],
            check: function (c) { return true; },
            hold: 60,
            why: '吸引のあいだは換気が止まり、陰圧で肺胞も潰れるので、SpO₂ が一時的に下がりました。'
              + '押した瞬間ではなく、肺から指先のセンサーに届くまでの遅れのあとで底をつけます。先に 100% で貯金しておいたぶん、落ち込みは小さく、1〜2 分で戻ります。新生児では徐脈も起こるので心拍も一緒に見ます。'
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
            say: 'RSV のそうた君（生後 4 か月）。鼻カニュラで持ちこたえられず、夕方に挿管された。CO₂ が高くて呼吸回数を上げたら、血圧が下がってきた。'
          },
          {
            look: ['lane:flow'],
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
            talk: true, who: 'doc',
            say: '吐ききる前に次の吸気が来ると、肺に空気が残ります。残った空気が作る圧が auto-PEEP。設定の PEEP に上乗せされます。'
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
              miss: [null, '入れる量が増えれば、吐く量も増えます。逆効果です。',
                '吸気が伸びれば、そのぶん呼気が削られます。', 'PEEP を足しても吐き残しは減りません。'],
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
            say: '平均動脈圧が下限まで戻るのを見届けてください。',
            spot: 'val:ABP mean', watch: ['ABP mean', 'SpO₂', 'auto-PEEP'],
            onStart: function (c) { c.mem.map0 = c.e.map; },
            check: function (c) { return c.e.map >= c.e.nm.mapMin; },
            hold: 10,
            why: function (c) {
              return '平均動脈圧 ' + Math.round(c.mem.map0) + ' → {ABP mean}。たまっていた空気が抜けて胸腔内圧が下がり、'
                + '静脈還流が戻りました。auto-PEEP は、肺だけでなく循環の問題でもあります。';
            }
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
              miss: ['上がったのは抵抗の分だけで、肺胞にかかる Pplat は同じです。', null,
                'VC なので量は設定どおりです。', '吸気が短くなるぶん、呼気の時間が増えます。'],
              why: '上がった PIP は抵抗の分で、肺胞にはかかっていません。吸気が早く終わるぶん呼気に使える時間が増えます。'
                + '喘息の子を受け持ったときに、思い出してください。'
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
              miss: ['感度を上げても、回路に流れが生まれなければ反応しません。', null,
                '吸おうとしているので鎮静のせいではありません。', 'リークはむしろ誤って反応させる方向です。'],
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
            say: 'モニタの音が低くなった。ハルト君の SpO₂ は {SpO₂}%。まだ下がっていく。',
            /* 病態はここで起こす。語っている最中に画面の数字が実際に落ちていくようにするため。
             * 気づいた時点ではもう下がりはじめているので、SpO₂ は 93% から始める。 */
            onStart: function (c) {
              c.mem.c0 = c.e.C;
              c.mem.sh0 = c.e.p.shunt0; c.mem.shMin0 = c.e.p.shuntMin;
              c.e.C = c.mem.c0 * 0.42;
              c.e.p.shunt0 = 0.40; c.e.p.shuntMin = 0.40;
              if (c.e.spo2 > 93) { c.e.spo2 = 93; c.e.pao2 = Math.min(c.e.pao2, 68); }
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
            look: ['lane:paw'],
            talk: true, who: 'doc',
            say: '圧の形と、聴診。2 つ合わせると 1 つに絞れます。'
          },
          {
            talk: true, who: 'doc',
            say: '片肺挿管は、チューブが深く入りすぎて、片方の気管支だけに入ってしまうこと。反対側の肺には空気が届きません。'
          },
          {
            quiz: {
              q: 'この所見に加えて、左の呼吸音が聞こえません。何を疑いますか。',
              choices: ['右片肺挿管または気胸', '痰づまり', '回路のリーク', '鎮静が浅い'],
              answer: 0,
              miss: [null, '痰なら差（PIP − Pplat）が開きます。今回は Pplat も上がっています。',
                'リークなら Vte が減ります。Vte は保たれています。', '鎮静では片側の呼吸音は消えません。'],
              why: '片肺挿管なら、チューブは右主気管支に入りやすいので消えるのは左。0.5〜1 cm 引き抜けば戻ります。'
                + 'チューブの深さが変わっていなければ、次に疑うのは気胸です。'
            }
          },
          {
            talk: true, who: 'scene',
            say: 'チューブの深さは変わっていない。胸の X 線を撮ると、左に気胸があった。すぐに胸腔ドレーンが入る。'
          },
          {
            say: 'SpO₂ と圧が戻るのを 40 秒見てください。',
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
              miss: ['気胸なら圧は上がります。', '痰なら PIP は上がります。', null, '肺水腫なら圧は上がります。'],
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
            say: 'その「元気そう」を、数字にして確かめましょう。'
          },
          {
            talk: true, who: 'doc',
            say: '呼吸器の手伝いを少しずつ減らしていくことを離脱（ウィーニング）、最後に気管チューブを抜くことを抜管と言います。'
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
                && (c.m.rrSpont >= 4 || (c.m.rrTrig || 0) >= 4 || c.e.pmusAmp > 2);
            },
            why: '条件が揃いました。ここで初めて SBT に進めます。'
          },
          {
            talk: true, who: 'doc',
            say: '✓ がそろったら、次は SBT（自発呼吸トライアル）。手伝いをほとんど外して、自分の力で 30 分呼吸できるか試す検査です。'
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
              miss: ['条件は「試してよい」の意味です。耐えられるかは別に確かめます。', null,
                '半分では足りません。そして全部そろっても、まだ試験が要ります。',
                '判断の材料を作るのが、次の試験です。'],
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
              miss: [null, '血圧はむしろ鎮静を浅くしたときに上がりやすいものです。',
                'FiO₂ は鎮静とは関係なく下げられます。', '困ります。評価ができません。'],
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
            say: 'ギラン・バレーのあかりちゃん（7歳）。挿管から 16 日目。手足は動きはじめた。肺はきれい。でも、呼吸の筋肉はまだ弱い。'
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
            say: '浅くて速い呼吸になるかどうかで分かります。f/VT ＝ 呼吸回数 ÷ 一回換気量（mL/kg）。8 を超えると危ない。'
          },
          {
            quiz: {
              q: '体重 22 kg の児が RR 40、一回換気量 110 mL。f/VT はいくつですか。',
              choices: ['1.8', '8', '40', '判定できない'],
              answer: 1,
              miss: ['一回換気量を mL/kg にしてから割ります。110 ÷ 22 ＝ 5。', null,
                'RR をそのまま答えています。5 mL/kg で割ります。', '体重と RR と Vt があれば計算できます。'],
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
              if (c.sbt.done === 'pass') return '30 分、呼吸回数も酸素化も循環も保てました。抜管を検討できます。';
              var min = Math.round(((c.sbt.tEnd != null ? c.sbt.tEnd : c.e.clock) - c.sbt.t0) / 60);
              return '開始から ' + min + ' 分で中止になりました。理由：' + c.sbt.failMsg
                + '。最初は保てていたのに、後半で浅く速くなりました。元の設定に戻っています。';
            }
          },
          {
            quiz: {
              q: 'SBT 開始から十数分かけて、じわじわ RR が上がり Vte が落ちてきました。これは何ですか。',
              choices: ['正常な適応', '呼吸筋疲労のサイン', '鎮静が効いてきた', '回路のリーク'],
              answer: 1,
              miss: ['適応なら落ち着いていくはずです。じわじわ悪くなるのは別のもの。', null,
                '鎮静なら回数は下がります。', 'リークなら Vte は急に減り、RR は上がりません。'],
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
              miss: ['疲れた筋肉にすぐまた負荷をかけると、同じように崩れます。', null,
                '鎮静は原因の解決になりません。', '1 回の失敗で決めるのは早すぎます。'],
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
            say: '昼。ハルト君の鎮静は朝のうちに切ってある。しっかり目を開け、自分で呼吸している。今日のうちに抜管を目指す。'
          },
          {
            talk: true, who: 'doc',
            say: '最後の関門です。呼吸の力だけでなく、気道を自分で守れるかを見ます。'
          },
          {
            talk: true, who: 'doc',
            say: '気道を守るとは、痰を咳で出せること、つばや吐いたものを気管に入れないこと。そのために、意識と咳の力を見ます。'
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
              miss: ['SBT は呼吸の力の試験です。気道を守れるかは別に見ます。', null,
                '意識がさらに下がり、気道はもっと守れなくなります。', '呼吸の力は十分でした。足りないのは咳と意識です。'],
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
              miss: ['喘息の音は呼気で目立ちます。吸気の音は上気道です。', null,
                '肺水腫では吸気の高い音は出ません。', '陥没呼吸は正常ではありません。'],
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
            why: '抜管できました。ハルト君は、自分の力で息をしています。'
              + '最初の夜から、よく見てきましたね。'
          }
        ]
      }
    ]
  };

  /* ===================== 第7章 細い気道（そうた君） ===================== */

  var CH7 = {
    id: 'ch7', title: '第7章　細い気道', tag: '細気管支炎',
    sub: '細い気道の乳児を、設定の見直しから抜管まで受け持つ。',
    lessons: [

      {
        id: '7-1', title: '吐ける回数で決める', minutes: 8,
        scenario: 'bronchiolitis',
        settings: { mode: 'VC-AC', vt: 42, rr: 40, peep: 6, fio2: 0.5, flow: 5, pause: 0.3 },
        sedation: 0.9,
        brief: [
          '細気管支炎は気道が細く、とくに吐く息が通りにくい。呼吸回数を上げると吐ききれず auto-PEEP がたまる。',
          'CO₂ を下げたいときは、回数より量。Pplat の上限の中で一回換気量を 7〜8 mL/kg まで使う。',
          '細気管支炎では PaCO₂ 60〜70、pH 7.20 以上を許容する。数字を正常にするより、吐かせることを優先する。',
          'auto-PEEP が消えると、肺胞を支えていた圧も消える。SpO₂ が下がったら設定の PEEP で支え直す。'
        ],
        points: ['回数を上げると吐ききれない', 'CO₂ は回数より量で（Pplat の上限の中で）',
          'pH 7.20 以上なら高 CO₂ を許す'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '5 日目の朝。そうた君の呼吸回数は、夜のうちに 40 回まで上げられていた。CO₂ を下げるためだったと、申し送りにある。'
          },
          {
            talk: true, who: 'doc',
            say: 'そうた君は、今日から{名前}先生の受け持ちです。まず、この設定がこの子に合っているかを確かめましょう。'
          },
          {
            talk: true, who: 'puku',
            say: '回数を上げたら CO₂ が下がるんでしょ？ 何がいけないの？'
          },
          {
            talk: true, who: 'doc',
            say: '下がるかわりに、吐く時間が削られます。細い気道の子は、吐くのにいちばん時間がかかります。'
          },
          {
            talk: true, who: 'doc',
            say: '吐ききれずに肺に残った空気の圧が auto-PEEP。挿管した夜に、この子で一度測りましたね。もう一度測ります。'
          },
          {
            say: '「呼気ポーズ」で、吐き残しを測ってください。',
            spot: 'hard:kExp',
            event: 'hold:exp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。',
            spot: 'val:auto-PEEP', watch: ['auto-PEEP', 'PEEP tot', 'ABP mean'],
            check: function (c) { return paused(c) && c.m.autoPeep > 0; },
            onPass: function (c) { c.mem.ap71 = c.m.autoPeep; },
            why: function (c) {
              return '総 PEEP ' + c.m.peepTot.toFixed(1) + ' に対して設定 PEEP は ' + c.s.peep
                + '。差の ' + c.mem.ap71.toFixed(1) + ' cmH₂O が、吐ききれずに残った圧です。';
            }
          },
          {
            talk: true, who: 'doc',
            say: 'τ（タウ）は吐くときの速さの目安でした。3τ でほぼ吐ききれます。この子の τ は 0.7 秒ほど。気道が細いぶん長いのです。'
          },
          {
            quiz: {
              q: 'τ 0.7 秒の乳児。RR 40 なら 1 呼吸 1.5 秒。足りないのはどれですか。',
              choices: ['吐く時間', '吸う時間', '酸素の濃さ', '鎮静の深さ'],
              answer: 0,
              miss: [null, '吸気時間は設定で決まっていて、削られるのは呼気のほうです。',
                '酸素は吐き残しと関係しません。', '鎮静では吐く時間は増えません。'],
              why: '吸気 0.5 秒を引くと、呼気は 1 秒。3τ の 2 秒に届きません。'
                + '吐ききる前に次の吸気が来るので、空気が少しずつたまっていきます。'
            }
          },
          {
            say: '呼吸回数を下げ、auto-PEEP を 3 cmH₂O 未満にしてください。',
            hint: '下げたら、もう一度「呼気ポーズ」で測ります。この子は RR 24 前後が目安です。',
            spot: ['key:rr', 'hard:kExp'], watch: ['auto-PEEP', 'ABP mean', 'MV'],
            check: function (c) { return c.m.autoPeep < 3 && c.s.rr < 30 && paused(c); },
            why: '吐く時間が戻り、たまっていた空気が抜けました。そのかわり分時換気量は減ります。'
          },
          {
            talk: true, who: 'doc',
            say: '回数を下げたぶん、CO₂ は上がります。ここで量を使います。1 回を大きくすれば、死腔で無駄になる割合が減ります。'
          },
          {
            talk: true, who: 'puku',
            say: 'でも量を増やしたら、肺が伸ばされすぎない？'
          },
          {
            talk: true, who: 'doc',
            say: 'だから Pplat を見張ります。この年齢の上限は、タイルの下に出ています。その内側でなら 8 mL/kg まで使えます。'
          },
          {
            say: '一回換気量を 8 mL/kg にして確定してください。',
            hint: function (c) { return '体重 ' + c.pbw.toFixed(1) + ' kg × 8 ＝ 約 ' + mlkg(c, 8) + ' mL。Pplat が上限を超えないことも確かめます。'; },
            spot: 'key:vt', watch: ['Vte', 'Pplat', 'ΔP'],
            check: function (c) {
              return Math.abs(c.s.vt - c.pbw * 8) <= 3 && c.m.pplat != null && c.m.pplat <= c.e.nm.platMax;
            },
            hold: 10,
            why: 'Pplat は上限の内側です。同じ分時換気量でも、回数より量で稼ぐほうが CO₂ はよく抜けます。'
          },
          {
            talk: true, who: 'scene',
            say: 'しばらくして、SpO₂ がじわじわと下がりはじめた。パルスの音が、少しずつ低くなる。',
            /* 吐き残しの圧が支えていた肺胞が、支えを失って潰れはじめる。 */
            onStart: function (c) { c.e.p.shunt0 = Math.max(c.e.p.shunt0, 0.40); }
          },
          {
            talk: true, who: 'puku',
            say: '吐き残しを減らしたのに、どうして酸素が下がるの？'
          },
          {
            talk: true, who: 'doc',
            say: '吐き残しの圧が、潰れかけた肺胞を支えていたからです。その分を、設定の PEEP で支え直します。'
          },
          {
            say: 'PEEP を 8 にし、SpO₂ 92% 以上を 30 秒保ってください。',
            hint: '足りなければ FiO₂ も少し上げます。PEEP を上げたら血圧も見ます。',
            spot: ['key:peep', 'key:fio2'], watch: ['SpO₂', 'ABP mean', 'Pplat'],
            check: function (c) { return c.s.peep >= 8 && c.e.spo2 >= 92; },
            hold: 30,
            why: 'たまたま残った圧ではなく、決めた圧で肺胞を支えます。いくつかけているかが分かる圧に置き換えた、ということです。'
          },
          {
            talk: true, who: 'doc',
            say: 'では、この設定で CO₂ がどこまで上がるか。換気を変えてから数分おいて採血しましょう。'
          },
          {
            say: '数分進めてから採血し、pH を確かめてください。',
            hint: '「× 10」で 5 分ほど進めてから「血液ガス」を押します。',
            spot: 'hard:kAbg', watch: ['etCO₂', 'MV'],
            check: function (c) { return c.abgs.length >= 1; },
            why: function (c) {
              var g = c.lastAbg;
              return 'pH ' + g.ph.toFixed(2) + '、PaCO₂ ' + g.paco2.toFixed(0) + '、HCO₃⁻ ' + g.hco3.toFixed(0) + '。'
                + (g.ph >= 7.2 ? 'CO₂ は高めですが、pH は許せる範囲です。'
                  : 'pH が 7.20 を割っています。Pplat の上限の中で、量か回数を少し戻します。');
            }
          },
          {
            talk: true, who: 'doc',
            say: 'CO₂ が高い日が続くと、腎臓が HCO₃⁻ を増やして pH を戻しにきます。代償でしたね。この子は数日かけて、それが起きています。'
          },
          {
            quiz: {
              q: '細気管支炎の乳児、pH 7.25 / PaCO₂ 64、auto-PEEP 1。どうしますか。',
              choices: ['呼吸回数を 40 に戻す', 'このまま許容する', 'PEEP を 0 にする', '鎮静を浅くする'],
              answer: 1,
              miss: ['また吐ききれなくなり、血圧が下がります。夜の設定に逆戻りです。', null,
                '肺胞を支える圧がなくなり、酸素化が落ちます。', '自分で速く吸いはじめ、吐く時間がさらに削られます。'],
              why: 'pH 7.20 以上なら許容します。CO₂ の数字を正常にするより、吐かせて肺と循環を守るほうが大事です。'
                + '気道の炎症が引けば、CO₂ は自然に下がってきます。'
            }
          }
        ]
      },

      {
        id: '7-2', title: '夜中の痰づまり', minutes: 6,
        scenario: 'bronchiolitis',
        settings: { mode: 'VC-AC', vt: 48, rr: 24, peep: 8, fio2: 0.55, flow: 6, pause: 0.3 },
        sedation: 0.9,
        brief: [
          'RSV 細気管支炎は痰が多い。乳児の細いチューブは、わずかな痰でも抵抗がはっきり上がる。',
          '圧が上がったら、まず吸気ポーズ。PIP だけ上がれば抵抗、Pplat も上がれば肺の硬さ。',
          '吸引の前に FiO₂ を上げて酸素を貯金する。カテーテルはチューブ内径の半分以下、1 回 10 秒以内。'
        ],
        points: ['圧が上がったら、まず吸気ポーズ', 'PIP だけ上がる＝抵抗（痰が多い）',
          '吸引は 100% O₂ のあとで、短く'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '6 日目の夜。{名前}先生の 3 回目の当直。そうた君は、夕方から痰が増えていると申し送られた。'
          },
          {
            talk: true, who: 'doc',
            say: 'わたしは隣の部屋にいます。鳴ったら、最初の一手は{名前}先生に任せます。順番はもう知っているはずです。'
          },
          {
            talk: true, who: 'puku',
            say: 'えっ、ぼくたちだけで？'
          },
          {
            talk: true, who: 'doc',
            say: 'まずは落ち着いているいまの数字を控えておくこと。比べる相手がないと、何が変わったか分かりません。'
          },
          {
            say: 'いまの PIP と Pplat を覚えておいてください。',
            spot: ['val:PIP', 'val:Pplat'], watch: ['PIP', 'Pplat', 'Raw'],
            check: function (c) { return c.m.pplat != null && c.m.cstat != null; },
            onPass: function (c) { c.mem.pip0 = c.m.pip; c.mem.plat0 = c.m.pplat; },
            why: 'これが平常時の値です。'
          },
          {
            talk: true, who: 'scene',
            say: '午前 2 時。気道内圧上限のアラーム。そうた君がむせて、顔が赤くなっている。',
            onStart: function (c) {
              c.mem.rInsp0 = c.e.p.Rinsp; c.mem.rExp0 = c.e.p.Rexp;
              c.e.p.Rinsp = c.mem.rInsp0 * 3.0;
              c.e.p.Rexp = c.mem.rExp0 * 1.6;
              c.e._raise('気道内圧が上昇しています');
            }
          },
          {
            talk: true, who: 'puku',
            say: 'な、鳴った！ 先生を呼んでくる？'
          },
          {
            talk: true, who: 'scene',
            say: 'いぶき先生の声を思い出す。設定を変える前に、まず上がった圧の中身を分けること。'
          },
          {
            say: 'PIP が上がりました。まず何をしますか。',
            hint: '原因を切り分けるキーがハードキーにあります。',
            spot: 'hard:kInsp', watch: ['PIP', 'Pplat', 'Raw'],
            event: 'hold:insp',
            missEvents: {
              'suction': 'まだ原因が分かっていません。痰なのか、肺が硬くなったのか、先に切り分けます。',
              'o2100': 'SpO₂ はまだ保たれています。いま知りたいのは、圧が上がった理由です。',
              'hold:exp': '呼気ポーズは吐き残しを見るもの。上がった PIP の中身を分けるのは別のキーです。'
            },
            why: '吸気ポーズで Pplat を測ります。'
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
            quiz: {
              q: 'PIP だけが上がり、Pplat はほぼ同じ。Raw も上がっています。原因は？',
              choices: ['肺が硬くなった', '気道の抵抗が上がった（痰など）', '回路のリーク', 'PEEP が高すぎる'],
              answer: 1,
              miss: ['肺が硬くなれば Pplat も上がります。', null,
                'リークなら圧は下がります。', 'PEEP は触っていません。'],
              why: 'PIP と Pplat の差が開いた＝抵抗の増加です。聴診で痰の音。'
                + '内径 3.5 mm のチューブは、断面積が大人の 8 mm のチューブの 5 分の 1 ほどしかありません。'
            }
          },
          {
            talk: true, who: 'scene',
            say: 'ドアが開いて、いぶき先生が入ってきた。モニターを一目見て、小さくうなずく。'
          },
          {
            talk: true, who: 'doc',
            say: '切り分けは合っています。吸引中は換気が止まるので、短く。カテーテルはチューブ内径の半分以下を選びます。'
          },
          {
            quiz: {
              q: '乳児の気管吸引。1 回にかけてよい時間の目安は？',
              choices: ['10 秒以内', '30 秒', '1 分', '痰が取れきるまで'],
              answer: 0,
              miss: [null, '30 秒も換気を止めると、乳児の SpO₂ は大きく落ちます。',
                '長すぎます。徐脈になることもあります。', '取りきれなければ、休んでから何回かに分けます。'],
              why: '乳児は酸素の蓄えが少なく、吸引で徐脈にもなりやすい。短く、必要なら間をあけて何回かに分けます。'
            }
          },
          {
            say: '「100% O₂」を押してから「気管吸引」を押してください。',
            spot: ['hard:kO2', 'hard:kSuc'], watch: ['PIP', 'SpO₂'],
            event: 'suction',
            onPass: function (c) {
              if (c.mem.rInsp0) { c.e.p.Rinsp = c.mem.rInsp0; c.e.p.Rexp = c.mem.rExp0; }
            },
            why: '粘い痰が取れました。抵抗が戻り、PIP が下がります。'
          },
          {
            say: 'SpO₂ と心拍を 1 分見てください。',
            spot: 'val:SpO₂', watch: ['SpO₂', 'HR', 'PIP'],
            check: function (c) { return true; },
            hold: 60,
            why: '吸引のあいだに SpO₂ は一度下がり、そこから戻っていきます。先に 100% で貯金したぶん、浅く済みます。乳児は吸引で徐脈にもなるので、心拍も一緒に見ます。'
          },
          {
            talk: true, who: 'puku',
            say: 'もう詰まらないようにできないの？'
          },
          {
            talk: true, who: 'doc',
            say: '加湿をしっかり、体の向きをこまめに変える。痰の多い時期を、安全にやり過ごすのがわたしたちの仕事です。'
          },
          {
            quiz: {
              q: 'では、PIP も Pplat も上がり、左の胸の上がりが悪かったら？',
              choices: ['痰づまり', '片肺挿管・気胸・大きな無気肺', '回路のリーク', '鎮静が浅い'],
              answer: 1,
              miss: ['痰なら Pplat は上がりません。', null, 'リークなら圧は下がります。',
                '鎮静では片側の胸の動きは変わりません。'],
              why: 'Pplat も上がるのは肺の側の問題です。DOPE の D（チューブの位置）と P（気胸）。'
                + 'チューブの深さ、聴診、胸の X 線で確かめます。'
            }
          }
        ]
      },

      {
        id: '7-3', title: '抜管して高流量鼻カニュラへ', minutes: 9,
        scenario: 'bronchiolitis',
        settings: { mode: 'VC-AC', vt: 48, rr: 20, peep: 6, fio2: 0.45, flow: 6, pause: 0.3 },
        sedation: 0.6,
        brief: [
          '細気管支炎の人工呼吸は数日から 1 週間ほど。痰が減り、熱が下がり、呼気の音が軽くなれば離脱を考える。',
          '条件と SBT は学童と同じ考え方。乳児の SBT は、細いチューブの抵抗を補うため PS 8・PEEP 5 で行う。',
          '抜管後はすぐ高流量鼻カニュラ（HFNC）。温めて加湿した酸素を 2 L/kg/分ほど流し、呼吸の仕事を減らす。'
        ],
        points: ['痰・熱・呼気の音が落ち着いたら離脱を考える', '乳児の SBT は PS 8・PEEP 5',
          '抜管後は HFNC で支え、崩れたら早めに決める'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '8 日目の朝。そうた君の熱は下がり、痰もずいぶん減った。胸の音から、呼気のヒューヒューが消えている。',
            onStart: function (c) {
              c.e.p.Rinsp = 40; c.e.p.Rexp = 60;
              c.e.p.shunt0 = 0.15; c.e.p.shuntMin = 0.08;
              c.e.p.driveGain = 1.0; c.e.temp = 37.0;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'doc',
            say: 'そうた君を、離脱の目で見てみましょう。手順はハルト君のときと同じです。'
          },
          {
            talk: true, who: 'puku',
            say: 'ハルト君より、ずっと小さいよ？'
          },
          {
            talk: true, who: 'doc',
            say: '考え方は同じです。違うのはチューブの細さ。だから SBT でも、学童より少し強めに手伝います。'
          },
          {
            say: '「離脱」キーで、条件のリストを開いてください。',
            spot: 'hard:kWean',
            event: 'weaning:open',
            why: '× がついている項目が、いま足りていないものです。'
          },
          {
            say: '設定と鎮静を調整して、リストを全部 ✓ にしてください。',
            hint: 'FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅くして自発呼吸を出します。「離脱」キーで開き直せます。',
            spot: ['key:fio2', 'key:peep', 'key:sed'], watch: ['SpO₂', 'RR tot', 'ABP mean'],
            check: readyAll,
            why: '条件がそろいました。ここで初めて SBT に進めます。'
          },
          {
            talk: true, who: 'doc',
            say: 'f/VT を覚えていますか。呼吸回数 ÷ 一回換気量（mL/kg）。8 を超える浅く速い呼吸は、疲れのサインでした。'
          },
          {
            quiz: {
              q: '体重 6 kg、RR 48、一回換気量 36 mL。f/VT はいくつですか。',
              choices: ['8', '6', '48', '判定できない'],
              answer: 0,
              miss: [null, 'それは一回換気量を mL/kg にした値です。RR をそれで割ります。',
                'RR をそのまま答えています。', '体重と RR と量があれば計算できます。'],
              why: '36 ÷ 6 ＝ 6 mL/kg、48 ÷ 6 ＝ 8。ちょうど境目です。乳児は呼吸数がもともと速いので、数だけで慌てず f/VT で見ます。'
            }
          },
          {
            say: '「離脱」キーから SBT を開始してください。',
            spot: 'hard:kWean',
            event: 'sbt:start',
            why: 'PEEP 5 と PS 8 に切り替わり、30 分の計測が始まりました。'
          },
          {
            say: '30 分の SBT を、最後まで通してください。',
            hint: '「× 10」や「× 60」で早送りできます。中止になったら原因を直して、もう一度開始します。',
            spot: 'val:f/VT', watch: ['f/VT', 'RR tot', 'SpO₂', 'HR'],
            check: function (c) { return c.sbt != null && c.sbt.done === 'pass'; },
            why: '30 分、呼吸回数も酸素化も循環も保てました。'
          },
          {
            talk: true, who: 'doc',
            say: '抜いたら、すぐ高流量鼻カニュラ（HFNC）。温めて加湿した酸素を、鼻から大きな流量で流す方法です。乳児なら 1 kg あたり 2 L/分が目安。'
          },
          {
            talk: true, who: 'puku',
            say: '入院した日に、つけてたやつだ！'
          },
          {
            talk: true, who: 'doc',
            say: 'そうです。吸う仕事を少し肩代わりし、鼻の奥の死腔を洗い流してくれます。抜管後の 1〜2 日を支えます。'
          },
          {
            quiz: {
              q: '抜管 2 時間後、呼吸数 70、陥没呼吸が強まってきました。どうしますか。',
              choices: ['朝まで様子を見る', 'HFNC を見直し、悪化が続けば早めに再挿管を決める', '鎮静薬を使う', '水分を絞る'],
              answer: 1,
              miss: ['乳児は崩れはじめると速い。待つほど疲れきってから挿管し直すことになります。', null,
                '呼吸が弱まり、かえって危険です。', '呼吸の悪化の答えになっていません。'],
              why: '乳児は崩れはじめると速い。粘りすぎて疲れきってから挿管し直すほうが危険です。決めるなら早く。'
            }
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
            why: '抜管できました。そうた君は HFNC につながれ、自分の力で息をしています。'
          }
        ]
      }
    ]
  };

  /* ===================== 第8章 硬い肺をもう一度（ミオちゃん） ===================== */

  var CH8 = {
    id: 'ch8', title: '第8章　硬い肺をもう一度', tag: 'ARDS',
    sub: '硬い肺の子を、設定のやり直しから抜管まで受け持つ。',
    lessons: [

      {
        id: '8-1', title: '事故抜管と、設定のやり直し', minutes: 8,
        scenario: 'ards',
        settings: { mode: 'VC-AC', vt: 140, rr: 20, peep: 5, fio2: 1.0, flow: 12, pause: 0.3 },
        sedation: 0.92,
        brief: [
          '事故抜管は、Vte の急な低下、etCO₂ の波の消失、泣き声で気づく。迷ったら抜いて、バッグとマスクで換気する。',
          '入れ直したあとは、設定を一から組み直す。量は 5〜6 mL/kg、PEEP で肺胞を開き直し、FiO₂ は SpO₂ を見て下げる。',
          '一度潰れた ARDS の肺は、開き直すまで時間がかかる。PEEP を上げたら Pplat と血圧も見る。'
        ],
        points: ['Vte 急低下＋etCO₂ 消失＋声＝チューブが抜けた', '入れ直したら 量 → PEEP → FiO₂ → 回数 の順に組み直す',
          '100% の酸素のまま置いておかない'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '8 日目の昼。ミオちゃんは酸素の量が減り、少しずつ良くなっていた。床ずれを防ぐため、体の向きを変えようとした、そのとき。',
            onStart: function (c) {
              c.e.C = 0.0075;
              c.e.p.shunt0 = 0.32; c.e.p.shuntMin = 0.10;
              c.e.temp = 37.8;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'scene',
            say: '呼吸器のアラーム。Vte が急に小さくなり、etCO₂ の波が消えた。口元から、かすれた泣き声が聞こえる。'
          },
          {
            talk: true, who: 'puku',
            say: '泣き声？ チューブが入ってたら、声は出ないはずじゃ…'
          },
          {
            talk: true, who: 'doc',
            say: 'etCO₂ は、吐いた息に含まれる CO₂ です。チューブを通って息が出入りしていれば、画面に波が出ます。'
          },
          {
            quiz: {
              q: 'Vte が急に減り、etCO₂ の波が消え、声が出ています。何が起きましたか。',
              choices: ['チューブが抜けた（事故抜管）', '痰づまり', '気胸', '回路の結露'],
              answer: 0,
              miss: [null, '痰なら PIP が上がり、声は出ません。', '気胸なら圧が上がります。声は出ません。',
                '結露では etCO₂ の波は消えません。'],
              why: '声が出るのは、チューブが声帯を通っていない証拠です。DOPE の D（位置）。'
                + '迷ったらチューブを抜いて、バッグとマスクで換気します。'
            }
          },
          {
            talk: true, who: 'scene',
            say: 'いぶき先生がすぐにバッグとマスクで換気し、新しいチューブを入れ直した。胸が左右そろって上がる。'
          },
          {
            talk: true, who: 'doc',
            say: '入りました。呼吸器は、入れ直すときの設定のまま仮につないであります。{名前}先生、一から組み直してください。'
          },
          {
            talk: true, who: 'puku',
            say: 'どこから決めるの？'
          },
          {
            talk: true, who: 'doc',
            say: '体重から量。次に PEEP で肺胞を開き、酸素を下げ、最後に回数。この子の肺は硬いので、量は 6 mL/kg までです。'
          },
          {
            say: '「患者情報」キーで、ミオちゃんの体重を確かめてください。',
            hint: '閉じるときは「呼吸器に戻る」。',
            spot: 'hard:kPt',
            event: 'patient',
            why: function (c) { return '体重 ' + c.pbw.toFixed(0) + ' kg。6 mL/kg なら約 ' + mlkg(c, 6) + ' mL です。'; }
          },
          {
            say: '一回換気量を 6 mL/kg にして確定してください。',
            hint: function (c) { return '体重 ' + c.pbw.toFixed(0) + ' kg × 6 ＝ 約 ' + mlkg(c, 6) + ' mL です。'; },
            spot: 'key:vt', watch: ['Vte', 'Pplat', 'ΔP'],
            check: function (c) { return Math.abs(c.s.vt - c.pbw * 6) <= 5; },
            hold: 6,
            why: 'いまの肺に合った量になりました。Pplat と ΔP も下がっています。'
          },
          {
            talk: true, who: 'doc',
            say: '抜けていたあいだに、肺胞はまた潰れました。PEEP 5 では支えきれません。開き直しましょう。'
          },
          {
            say: 'PEEP を 10 に上げて確定してください。',
            hint: '実際は 2 ずつ上げて、Pplat と血圧を見ながら進めます。',
            spot: 'key:peep', watch: ['SpO₂', 'Pplat', 'ABP mean'],
            check: function (c) { return c.s.peep >= 10; },
            why: ''
          },
          {
            say: 'そのまま 60 秒、SpO₂ と Pplat と血圧を見てください。',
            watch: ['SpO₂', 'Pplat', 'ABP mean'],
            check: function (c) { return c.s.peep >= 10; },
            hold: 60,
            why: function (c) {
              return 'Pplat {Pplat} は上限 ' + c.e.nm.platMax + ' の内側です。'
                + (c.e.map < c.e.nm.mapMin
                  ? '平均動脈圧は下限 ' + c.e.nm.mapMin + ' を割っています。輸液が足りているかも確かめます。'
                  : '血圧も保てています。');
            }
          },
          {
            talk: true, who: 'doc',
            say: '開いたら、酸素は下げる。100% のままにしないこと。この子の SpO₂ の目標は 92〜97% です。'
          },
          {
            say: 'SpO₂ 92% 以上のまま、FiO₂ を 60% 以下にしてください。',
            hint: '5〜10% ずつ下げて SpO₂ を確かめます。',
            spot: 'key:fio2', watch: ['SpO₂'],
            check: function (c) { return c.s.fio2 <= 0.61 && c.e.spo2 >= 92; },
            hold: 30,
            why: 'PEEP で開いてから FiO₂ を下げる。この順番でしたね。'
          },
          {
            talk: true, who: 'doc',
            say: '最後に回数。量を絞ったぶん、CO₂ は回数で補います。この子なら 28〜30 回あたりから始めます。'
          },
          {
            say: '回数を整えてから採血し、pH 7.25 以上を確かめてください。',
            hint: 'RR を上げたら「× 10」で数分進め、「血液ガス」を押します。低ければ RR を足して採り直します。',
            spot: ['key:rr', 'hard:kAbg'], watch: ['MV', 'etCO₂', 'auto-PEEP'],
            check: function (c) { return c.abgs.length >= 1 && c.lastAbg.ph >= 7.25; },
            why: function (c) {
              return 'pH ' + c.lastAbg.ph.toFixed(2) + '、PaCO₂ ' + c.lastAbg.paco2.toFixed(0)
                + '。量は 6 mL/kg のまま、回数で pH を戻せました。';
            }
          },
          {
            quiz: {
              q: '入れ直したあと FiO₂ 100% のまま 6 時間、SpO₂ は 100%。何が問題ですか。',
              choices: ['問題ない', '濃い酸素そのものが肺を傷める', 'CO₂ が上がる', '血圧が下がる'],
              answer: 1,
              miss: ['SpO₂ 100% は、余裕がどれだけあるかを教えてくれません。', null,
                'FiO₂ は CO₂ には効きません。', 'FiO₂ は血圧には直接効きません。'],
              why: '高い酸素は、それ自体が肺を傷めます。SpO₂ 100% は「PaO₂ が 100 以上のどこか」という意味しかありません。'
                + '慌ただしい場面ほど、下げ忘れが起きます。'
            }
          }
        ]
      },

      {
        id: '8-2', title: '酸素と PEEP を下げていく', minutes: 9,
        scenario: 'ards',
        settings: { mode: 'VC-AC', vt: 84, rr: 28, peep: 10, fio2: 0.5, flow: 12, pause: 0.3 },
        sedation: 0.8,
        brief: [
          '良くなってきたら、下げる順番は FiO₂ が先、PEEP があと。PEEP を先に下げると、開いた肺胞がまた潰れる。',
          'PEEP は 1 回に 2 cmH₂O ずつ。下げたら 30 分〜1 時間は SpO₂ を見て、落ちたら戻す。',
          '下げられたかどうかは血液ガスの P/F 比で確かめる。P/F 200 以上・FiO₂ 0.4 以下・PEEP 7 以下が離脱の入口。'
        ],
        points: ['先に FiO₂、あとで PEEP', 'PEEP は 2 ずつ、落ちたら戻す', 'P/F 比で答え合わせ'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '10 日目の朝。ミオちゃんの胸の X 線は、白かった影が少しずつ薄くなってきた。熱も下がりはじめている。',
            onStart: function (c) {
              c.e.C = 0.0088;
              c.e.p.shunt0 = 0.26; c.e.p.shuntMin = 0.08;
              c.e.temp = 37.3;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'doc',
            say: '上げるのは誰でもできます。下げるときに、その人の腕が出ます。まず、いまの酸素化を数字で見ましょう。'
          },
          {
            talk: true, who: 'doc',
            say: 'P/F 比は、PaO₂ を FiO₂（小数）で割った値。正常は 400 以上、200 を超えれば離脱を考えはじめます。'
          },
          {
            say: '採血して、いまの P/F 比を確かめてください。',
            spot: 'hard:kAbg', watch: ['SpO₂', 'Pplat'],
            check: function (c) { return c.abgs.length >= 1; },
            onPass: function (c) { c.mem.pf81 = pf(c.lastAbg); },
            why: function (c) {
              return 'P/F 比 ' + Math.round(pf(c.lastAbg)) + '。再挿管の日より、ずっと良くなっています。';
            }
          },
          {
            talk: true, who: 'puku',
            say: 'じゃあ、PEEP も酸素も、いっぺんに下げちゃおう！'
          },
          {
            talk: true, who: 'doc',
            say: 'いっぺんに動かすと、悪くなったときにどちらのせいか分かりません。1 つずつ、決まった順番で。'
          },
          {
            quiz: {
              q: '良くなってきた ARDS。先に下げるのはどちらですか。',
              choices: ['FiO₂', 'PEEP', '一回換気量', 'どちらでもよい'],
              answer: 0,
              miss: [null, 'PEEP を先に下げると、開いていた肺胞がまた潰れます。',
                '量は肺保護のために、すでに絞っています。', '順番があります。'],
              why: '濃い酸素は肺を傷めるので、先に下げます。PEEP は肺胞を開いておく支えなので、最後まで残します。'
            }
          },
          {
            say: 'SpO₂ 92% 以上のまま、FiO₂ を 40% 以下にしてください。',
            spot: 'key:fio2', watch: ['SpO₂'],
            check: function (c) { return c.s.fio2 <= 0.41 && c.e.spo2 >= 92; },
            hold: 30,
            why: 'FiO₂ 40% まで下がりました。次は PEEP です。'
          },
          {
            talk: true, who: 'doc',
            say: 'PEEP は 2 ずつ。下げたら、しばらく SpO₂ を見ます。落ちてくるなら、まだ肺胞が支えを必要としている証拠です。'
          },
          {
            say: 'PEEP を 2 ずつ下げて 8 にし、90 秒 SpO₂ 92% 以上を保ってください。',
            hint: '「× 10」で早送りすると、変化がはやく見えます。',
            spot: 'key:peep', watch: ['SpO₂', 'Pplat', 'ABP mean'],
            check: function (c) { return c.s.peep <= 8 && c.e.spo2 >= 92; },
            hold: 90,
            why: '肺胞は潰れずに保たれています。Pplat が下がり、血圧も少し楽になりました。'
          },
          {
            say: 'もう一度採血して、P/F 比を確かめてください。',
            hint: '「× 10」で数分進めてから採血します。',
            spot: 'hard:kAbg', watch: ['SpO₂'],
            check: function (c) { return c.abgs.length >= 2 && pf(c.lastAbg) >= 160; },
            why: function (c) {
              return 'P/F 比 ' + Math.round(c.mem.pf81) + ' → ' + Math.round(pf(c.lastAbg))
                + '。酸素も PEEP も下げたのに、酸素化は保てています。肺そのものが良くなってきた証拠です。';
            }
          },
          {
            quiz: {
              q: 'PEEP を 8 → 6 に下げて 20 分、SpO₂ が 95 → 89% に落ちました。どうしますか。',
              choices: ['PEEP を 8 に戻す', 'FiO₂ だけ上げて PEEP 6 のまま', 'さらに PEEP を下げる', '様子を見る'],
              answer: 0,
              miss: [null, '潰れはじめた肺胞は、酸素では開きません。支えの圧を戻します。',
                'もっと潰れます。', '肺胞は時間とともにさらに潰れていきます。'],
              why: '肺胞が潰れはじめたサインです。PEEP を戻し、半日〜1 日おいてから、もう一度試します。'
                + '下げられなかったこと自体が、肺の状態を教えてくれます。'
            }
          }
        ]
      },

      {
        id: '8-3', title: '硬い肺の離脱', minutes: 10,
        scenario: 'ards',
        settings: { mode: 'VC-AC', vt: 84, rr: 24, peep: 7, fio2: 0.4, flow: 12, ps: 10, pause: 0.3 },
        sedation: 0.7,
        brief: [
          '長く A/C で休んでいた子は、いきなり SBT ではなく、まず PSV で自分で吸う力を取り戻させる。',
          'PS は「目標の換気量を楽に出せる最小の圧」。Vte 6〜8 mL/kg と呼吸回数で決める。',
          '長く使った鎮静薬は少しずつ減らす。急にやめると離脱症状（ふるえ・興奮・発汗・発熱）が出る。',
          '抜管前にカフリークテスト。漏れなければ声門下の浮腫を疑い、ステロイドを考える。'
        ],
        points: ['まず PSV で自分で吸う力を取り戻す', 'PS は 6〜8 mL/kg を楽に出せる最小の圧',
          '鎮静薬は少しずつ減らす'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '12 日目。ミオちゃんの肺の影はほとんど消えた。熱もなく、お母さんの声に目を開けるようになった。',
            onStart: function (c) {
              c.e.C = 0.0105;
              c.e.p.shunt0 = 0.14; c.e.p.shuntMin = 0.05;
              c.e.p.driveGain = 1.1; c.e.temp = 37.0;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'doc',
            say: 'ここからは外す相談です。硬かった肺ほど、外すときは慎重に。まず手伝い方を変えます。'
          },
          {
            talk: true, who: 'puku',
            say: 'いきなり SBT じゃないの？'
          },
          {
            talk: true, who: 'doc',
            say: '12 日間、ほとんどの呼吸を機械に任せていました。先に PSV で、自分で吸うことを思い出してもらいます。'
          },
          {
            talk: true, who: 'doc',
            say: '鎮静薬も 12 日使っています。急に切ると、ふるえや興奮が出ます（離脱症状）。浅くするのは、少しずつ。'
          },
          {
            say: '「鎮静」を 30% まで下げて確定してください。',
            spot: 'key:sed', watch: ['RR tot'],
            check: function (c) { return c.e.sedation <= 0.32; },
            why: '呼吸中枢が目を覚まし、自分で吸いはじめます。'
          },
          {
            talk: true, who: 'doc',
            say: 'PSV は、患者が吸うたびに決めた圧で後押しするだけのモードでしたね。始めるのも止めるのも、この子です。'
          },
          {
            say: 'モードを「PSV」に切り替えてください。',
            spot: 'mode:PSV',
            event: 'mode:PSV',
            why: '機械からの強制換気がなくなりました。すべての呼吸を、ミオちゃんが始めています。'
          },
          {
            say: 'PS を調整して Vte を 6〜8 mL/kg に入れ、30 秒保ってください。',
            hint: function (c) { return '体重 ' + c.pbw + ' kg なので目標は ' + mlkg(c, 6) + '〜' + mlkg(c, 8) + ' mL です。'; },
            spot: 'key:ps', watch: ['Vte', 'RR tot', 'f/VT'],
            check: function (c) { var x = vtPerKg(c); return x >= 5.5 && x <= 8.5; },
            hold: 30,
            why: '楽に目標の量を出せています。呼吸回数も、この年齢の範囲です。'
          },
          {
            talk: true, who: 'doc',
            say: 'f/VT は、呼吸回数 ÷ 一回換気量（mL/kg）。8 を超える浅く速い呼吸は、疲れのサインです。'
          },
          {
            quiz: {
              q: '体重 14 kg、RR 36、Vte 84 mL。f/VT はいくつですか。',
              choices: ['6', '0.4', '36', '判定できない'],
              answer: 0,
              miss: [null, '割る向きが逆です。RR を mL/kg で割ります。', 'RR をそのまま答えています。',
                '体重と RR と量があれば計算できます。'],
              why: '84 ÷ 14 ＝ 6 mL/kg、36 ÷ 6 ＝ 6。8 未満なので、浅く速い呼吸にはなっていません。'
            }
          },
          {
            say: '「離脱」キーで、条件のリストを開いてください。',
            spot: 'hard:kWean',
            event: 'weaning:open',
            why: '× がついている項目が、いま足りていないものです。'
          },
          {
            say: '設定を調整して、リストを全部 ✓ にしてください。',
            hint: 'FiO₂ 40% 以下、PEEP 7 以下。P/F 比も 200 以上が要ります。',
            spot: ['key:fio2', 'key:peep', 'key:sed'], watch: ['SpO₂', 'RR tot', 'ABP mean'],
            check: readyAll,
            why: '条件がそろいました。'
          },
          {
            say: '「離脱」キーから SBT を開始してください。',
            spot: 'hard:kWean',
            event: 'sbt:start',
            why: 'PEEP 5 と PS 8 に切り替わり、30 分の計測が始まりました。'
          },
          {
            say: '30 分の SBT を、最後まで通してください。',
            hint: '「× 10」や「× 60」で早送りできます。中止になったら原因を直して、もう一度開始します。',
            spot: 'val:f/VT', watch: ['f/VT', 'RR tot', 'SpO₂', 'HR'],
            check: function (c) { return c.sbt != null && c.sbt.done === 'pass'; },
            why: '30 分、崩れずに呼吸できました。'
          },
          {
            talk: true, who: 'doc',
            say: 'カフリークテストは、カフの空気を抜いて、チューブのまわりから空気が漏れるかを見る検査。漏れなければ、声門の下が腫れています。'
          },
          {
            quiz: {
              q: '挿管 12 日目の 3 歳。カフリークがありません。どうしますか。',
              choices: ['ステロイドを使い、半日〜1 日おいて再評価する', 'そのまま抜管する', '鎮静を深くする', '気管切開を決める'],
              answer: 0,
              miss: [null, '抜管後に声門下の浮腫で窒息しかけ、再挿管になる危険が高い状態です。',
                '浮腫は鎮静では引きません。', '1 回の結果で決めるのは早すぎます。'],
              why: '長く挿管した子ほど声門の下が腫れます。ステロイドで浮腫を引かせてから抜くと、抜管後の stridor を減らせます。'
            }
          },
          {
            talk: true, who: 'scene',
            say: 'ステロイドを使って半日。もう一度カフを抜くと、チューブのまわりから、かすかに空気の漏れる音がした。'
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
            why: '抜管できました。ミオちゃんは HFNC をつけて、お母さんの手を握り返しています。'
          }
        ]
      }
    ]
  };

  /* ===================== 第9章 手のひらの肺（NICU） ===================== */

  var CH9 = {
    id: 'ch9', title: '第9章　手のひらの肺', tag: '新生児',
    sub: '在胎 28 週の肺を、生まれた日から抜管まで受け持つ。',
    lessons: [

      {
        id: '9-1', title: '生まれてすぐの初期設定', minutes: 8,
        scenario: 'rds',
        settings: { mode: 'PC-AC', pinsp: 18, rr: 40, peep: 5, fio2: 1.0, ti: 0.5 },
        sedation: 0.8,
        brief: [
          '新生児は圧規定（PC）が基本。カフのないチューブから漏れるので、量を決めても保証できない。',
          '目標は Vte 4〜6 mL/kg、吸気時間 0.3 秒前後、呼吸回数 40〜60、PEEP 5〜7。',
          '入れすぎると CO₂ が下がりすぎる。低い PaCO₂ は脳の血流を減らし、早産児の脳を傷める。',
          'SpO₂ の目標は 90〜95%。高すぎる酸素は未熟児網膜症の原因になる。'
        ],
        points: ['新生児は PC。Vte 4〜6 mL/kg を P insp で作る', '吸気時間 0.3 秒、PEEP 5〜7',
          'SpO₂ は 90〜95%（上げすぎない）'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '2 週目、NICU の夜。在胎 28 週で生まれた男の子が、保育器ごと運ばれてきた。体重 1,100 g。あおい君。'
          },
          {
            talk: true, who: 'scene',
            say: '分娩室で挿管され、肺を広げる薬が気管から 1 回入っている。呼吸器は、蘇生したときの設定のままだ。'
          },
          {
            talk: true, who: 'doc',
            say: 'その薬がサーファクタント。肺胞の内側に薄く広がり、しぼまないように支える物質です。早産の子は、これが足りません。'
          },
          {
            talk: true, who: 'puku',
            say: 'ぼく、この大きさの子は初めて…。手のひらに乗っちゃいそう。'
          },
          {
            talk: true, who: 'doc',
            say: '新生児は、圧を決める PC で換気するのが一般的です。カフのないチューブで漏れるので、量を決めても守れないからです。'
          },
          {
            talk: true, who: 'doc',
            say: 'まず吸気時間（Ti）。新生児の肺は小さく、τ が短いので、0.3 秒ほどで満ちます。長いと、吸いきったまま押し続けることになります。'
          },
          {
            say: 'Ti を 0.3 秒にして確定してください。',
            spot: 'key:ti', watch: ['I:E', 'Vte'],
            check: function (c) { return c.s.ti <= 0.35; },
            why: '吐く時間にゆとりができました。この子の自然な呼吸のリズムにも近くなります。'
          },
          {
            talk: true, who: 'doc',
            say: 'P insp は、PEEP に上乗せする吸気の圧。上げるほど入る量が増えます。目標は 4〜6 mL/kg、この子なら 4.4〜6.6 mL です。'
          },
          {
            look: ['val:Vte'],
            talk: true, who: 'puku',
            say: 'いまは何 mL 入ってるの？'
          },
          {
            say: 'P insp を下げて、Vte を 4〜6 mL/kg に入れてください。',
            hint: function (c) { return '体重 ' + c.pbw + ' kg なので ' + mlkg(c, 4) + '〜' + mlkg(c, 6) + ' mL。Vte のタイルの右上が mL/kg です。'; },
            spot: 'key:pinsp', watch: ['Vte', 'PIP', 'etCO₂'],
            check: function (c) { var x = vtPerKg(c); return x >= 4 && x <= 6.4; },
            hold: 20,
            why: '蘇生のときは、肺を広げるために強めに押していました。そのままでは入れすぎで、CO₂ も下がりすぎます。'
          },
          {
            quiz: {
              q: '早産児で PaCO₂ 25 まで下がっています。何が心配ですか。',
              choices: ['脳の血流が減り、脳を傷める', '肺が硬くなる', '血糖が下がる', '何も心配ない'],
              answer: 0,
              miss: [null, 'CO₂ そのものは肺の硬さを変えません。', '血糖とは直接関係しません。',
                '低すぎる CO₂ は、早産児では見逃せない害があります。'],
              why: 'CO₂ が下がると脳の血管が縮み、血流が減ります。早産児の脳はこれに弱く、脳室周囲白質軟化症の原因になります。'
                + '入れすぎないことも、守ることのうちです。'
            }
          },
          {
            talk: true, who: 'doc',
            say: 'PEEP は肺胞の支え。サーファクタント不足で肺胞がしぼむ病気を呼吸窮迫症候群（RDS）と言い、PEEP 5〜7 が目安です。'
          },
          {
            say: 'PEEP を 7 に上げて確定してください。',
            spot: 'key:peep', watch: ['SpO₂', 'Vte', 'ABP mean'],
            check: function (c) { return c.s.peep >= 7; },
            hold: 10,
            why: 'しぼみかけた肺胞が支えられ、酸素化が良くなりはじめます。'
          },
          {
            talk: true, who: 'doc',
            say: '早産児の SpO₂ の目標は 90〜95%。上げすぎると、目の網膜の血管が異常に伸びます。未熟児網膜症です。'
          },
          {
            say: 'FiO₂ を下げて、SpO₂ を 90〜95% に 30 秒入れてください。',
            hint: '5〜10% ずつ下げます。95% を超えていたら、まだ下げられます。',
            spot: 'key:fio2', watch: ['SpO₂'],
            check: function (c) { return c.s.fio2 < 0.99 && c.e.spo2 >= 90 && c.e.spo2 <= 95; },
            hold: 30,
            why: '酸素を「足りるだけ」に合わせました。多すぎても少なすぎても害になるのが、早産児の酸素です。'
          },
          {
            quiz: {
              q: '早産児で SpO₂ 99%、FiO₂ 0.5。どうしますか。',
              choices: ['そのまま', 'FiO₂ を下げる', 'PEEP を上げる', '呼吸回数を上げる'],
              answer: 1,
              miss: ['SpO₂ 99% は、この子には高すぎます。', null,
                '酸素化は足りています。', '回数は CO₂ のつまみです。'],
              why: '目標は 90〜95%。99% は高すぎるので下げます。量・時間・圧・酸素、考え方はハルト君と同じで、桁だけが違います。'
            }
          }
        ]
      },

      {
        id: '9-2', title: 'サーファクタントが効いてきた', minutes: 8,
        scenario: 'rds',
        settings: { mode: 'PC-AC', pinsp: 12, rr: 45, peep: 7, fio2: 0.45, ti: 0.3 },
        sedation: 0.8,
        brief: [
          'サーファクタントが効くと、数時間で肺が急に柔らかくなる。PC では、同じ圧のまま入る量が増えていく。',
          '気づかずにいると、入れすぎ（容量損傷）と CO₂ の下がりすぎが同時に起きる。Vte を見て P insp を下げる。',
          '早産児の血液ガスの目標は pH 7.25 以上、PaCO₂ 45〜55 前後。正常値より高めを許す。'
        ],
        points: ['肺が柔らかくなると、PC では量が増える', 'Vte を見て P insp を下げる',
          '早産児は PaCO₂ 45〜55 を許す'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '生まれて 6 時間。あおい君の胸の上がりが、少しずつ大きくなってきた。保育器の中で、手足をもぞもぞと動かしている。',
            onStart: function (c) {
              c.e.C = 0.0008;
              c.e.p.shunt0 = 0.26; c.e.p.shuntMin = 0.10;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'doc',
            say: 'サーファクタントが効いてきました。ここからの数時間は、呼吸器の前を離れられません。'
          },
          {
            talk: true, who: 'puku',
            say: '良くなってるなら、安心なんじゃないの？'
          },
          {
            talk: true, who: 'doc',
            say: 'PC は圧を約束するモードでした。肺が柔らかくなると、同じ圧で入る量が増えます。何が起きるか、見てみましょう。'
          },
          {
            say: 'Vte と Cstat を 30 秒見てください。',
            spot: ['val:Vte', 'val:Cstat'], watch: ['Vte', 'Cstat', 'etCO₂'],
            check: function (c) { return true; },
            hold: 30,
            why: function (c) {
              return 'Vte は ' + vtPerKg(c).toFixed(1) + ' mL/kg。圧は変えていないのに、目標の 6 を超えています。肺が柔らかくなった（Cstat が上がった）ぶんです。';
            }
          },
          {
            quiz: {
              q: 'PC で肺が急に柔らかくなりました。このまま放っておくと？',
              choices: ['入れすぎと、CO₂ の下がりすぎが起きる', '量が減って CO₂ が上がる', '何も変わらない', '圧が上がる'],
              answer: 0,
              miss: [null, '逆です。同じ圧で入る量は増えます。', '量が変わっています。',
                'PC では圧は設定どおりです。'],
              why: '肺胞が伸ばされすぎ（容量損傷）、CO₂ も吐き出されすぎます。圧を約束するモードでは、量を見張るのが人の仕事です。'
            }
          },
          {
            say: 'P insp を下げて、Vte を 4〜6 mL/kg に戻してください。',
            hint: function (c) { return '目標は ' + mlkg(c, 4) + '〜' + mlkg(c, 6) + ' mL。1 ずつ下げて Vte を見ます。'; },
            spot: 'key:pinsp', watch: ['Vte', 'PIP', 'ΔP'],
            check: function (c) { var x = vtPerKg(c); return x >= 4 && x <= 6.2 && c.s.pinsp < 12; },
            hold: 20,
            why: '同じ量を、より低い圧で入れられるようになりました。これが「肺が良くなった」の姿です。'
          },
          {
            talk: true, who: 'doc',
            say: '柔らかくなれば、酸素の通り道も開きます。SpO₂ を見てください。'
          },
          {
            say: 'SpO₂ 90〜95% を保ったまま、FiO₂ を 30% 以下にしてください。',
            spot: 'key:fio2', watch: ['SpO₂'],
            check: function (c) { return c.s.fio2 <= 0.31 && c.e.spo2 >= 90 && c.e.spo2 <= 96; },
            hold: 30,
            why: '酸素も下げられました。サーファクタントが効くと、FiO₂ は数時間で大きく下がります。'
          },
          {
            talk: true, who: 'doc',
            say: '早産児の血液ガスは、正常値より少し CO₂ が高めでも許します。pH 7.25 以上、PaCO₂ 45〜55 前後が目安です。'
          },
          {
            say: '数分進めてから採血し、PaCO₂ を確かめてください。',
            hint: '「× 10」で 5 分ほど進めてから「血液ガス」を押します。',
            spot: 'hard:kAbg', watch: ['etCO₂', 'MV'],
            check: function (c) { return c.abgs.length >= 1; },
            why: function (c) {
              var g = c.lastAbg;
              return 'pH ' + g.ph.toFixed(2) + '、PaCO₂ ' + g.paco2.toFixed(0) + '。'
                + (g.paco2 < 40 ? 'まだ少し下がりすぎです。呼吸回数を下げる余地があります。'
                  : 'この子の目標の範囲です。');
            }
          },
          {
            quiz: {
              q: '早産児、pH 7.28 / PaCO₂ 52。どうしますか。',
              choices: ['このままでよい', '呼吸回数を上げて CO₂ を 40 にする', 'P insp を上げる', 'FiO₂ を上げる'],
              answer: 0,
              miss: [null, '正常値に合わせようと換気を増やすと、肺を傷め、CO₂ も下がりすぎます。',
                '量が増えて肺を傷めます。', 'FiO₂ は CO₂ には効きません。'],
              why: '早産児は、肺を守るために高めの CO₂ を許します。換気を減らすほど、慢性肺疾患（気管支肺異形成症）を減らせます。'
            }
          }
        ]
      },

      {
        id: '9-3', title: '抜管して CPAP へ', minutes: 9,
        scenario: 'rds',
        settings: { mode: 'PC-AC', pinsp: 9, rr: 40, peep: 6, fio2: 0.3, ti: 0.3 },
        sedation: 0.6,
        brief: [
          '早産児はできるだけ早く抜管する。挿管が長いほど、肺と脳の合併症が増える。',
          '抜管の前にカフェイン。未熟な呼吸中枢を目覚めさせ、無呼吸を減らし、抜管の成功率を上げる。',
          '回数と圧を下げて、自分の呼吸を引き出す。抜管後は鼻から CPAP（nCPAP）で肺胞を支え続ける。'
        ],
        points: ['早産児はできるだけ早く抜管する', 'カフェインで呼吸中枢を目覚めさせる',
          '抜管後は nCPAP で支える'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '生まれて 3 日目。あおい君の酸素は 30% まで下がった。足の裏をくすぐると、顔をしかめて泣くそぶりを見せる。',
            onStart: function (c) {
              c.e.C = 0.0012;
              c.e.p.shunt0 = 0.12; c.e.p.shuntMin = 0.05;
              c.e.hco3 = 24; c.e.p.hco3Base = 24;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'doc',
            say: '早産の子は、チューブが入っている時間が長いほど、肺も脳も傷みます。外せるなら、早く外します。'
          },
          {
            talk: true, who: 'doc',
            say: '先にカフェインを入れます。未熟な呼吸中枢を目覚めさせて、息が止まる発作（無呼吸）を減らす薬です。',
            onStart: function (c) {
              c.e.p.maxPmus = 12; c.e.p.driveGain = 1.3;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'puku',
            say: 'コーヒーに入ってるやつ？ 赤ちゃんに？'
          },
          {
            talk: true, who: 'doc',
            say: '同じ物質です。早産児の無呼吸の、いちばん基本の薬です。そのうえで、機械の手伝いを減らして自分の呼吸を引き出します。'
          },
          {
            say: '回数と P insp を下げ、自分の呼吸が 4 回/分 以上出るまで待ちます。',
            hint: 'RR 20〜25、P insp 7 前後が目安です。CO₂ が少し上がると、自分で吸いはじめます。',
            spot: ['key:rr', 'key:pinsp', 'val:RR tot'], watch: ['RR tot', 'Vte', 'SpO₂'],
            check: function (c) { return c.s.rr <= 30 && ((c.m.rrTrig || 0) >= 4 || c.m.rrSpont >= 4); },
            why: '機械が引いたぶん、あおい君が自分で吸いはじめました。RR tot が設定より多くなっています。'
          },
          {
            say: '「離脱」キーで、条件のリストを開いてください。',
            spot: 'hard:kWean',
            event: 'weaning:open',
            why: '× がついている項目が、いま足りていないものです。'
          },
          {
            say: '設定と鎮静を調整して、リストを全部 ✓ にしてください。',
            hint: 'FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅く。',
            spot: ['key:fio2', 'key:peep', 'key:sed'], watch: ['SpO₂', 'RR tot', 'ABP mean'],
            check: readyAll,
            why: '条件がそろいました。'
          },
          {
            talk: true, who: 'doc',
            say: '早産児の呼吸は不規則です。速くなったり、間があいたりをくり返します（周期性呼吸）。SpO₂ と心拍が保たれていれば、慌てません。'
          },
          {
            say: '「離脱」キーから SBT を開始し、最後まで通してください。',
            hint: '早送りを使ってください。中止になったら原因を直して、もう一度開始します。',
            spot: 'hard:kWean', watch: ['f/VT', 'RR tot', 'SpO₂', 'HR'],
            check: function (c) { return c.sbt != null && c.sbt.done === 'pass'; },
            why: '自分の力で 30 分、呼吸を保てました。'
          },
          {
            talk: true, who: 'doc',
            say: '抜いたら、すぐ鼻から CPAP（nCPAP）。鼻に当てた管から一定の圧をかけ続け、PEEP の代わりに肺胞を支えます。'
          },
          {
            quiz: {
              q: '抜管後の nCPAP。30 秒ほど息が止まり、心拍が 80 に落ちました。まずすることは？',
              choices: ['体をさすって刺激し、戻らなければバッグで換気する', '様子を見る', 'CPAP の圧を下げる', 'カフェインを中止する'],
              answer: 0,
              miss: [null, '無呼吸と徐脈が続けば、脳に酸素が届きません。', '圧を下げても呼吸は戻りません。',
                'カフェインは無呼吸を減らす側の薬です。'],
              why: '早産児の無呼吸は、まず刺激。戻らなければマスクとバッグで換気します。くり返すなら、再挿管も考えます。'
            }
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
            why: '抜管できました。あおい君は nCPAP につながれ、小さな胸で、自分の息をしています。'
          }
        ]
      }
    ]
  };

  /* ===================== 第10章 吐けない息（喘息） ===================== */

  var CH10 = {
    id: 'ch10', title: '第10章　吐けない息', tag: '喘息',
    sub: '喘息重積の子に、吐かせる換気を組み立てる。',
    lessons: [

      {
        id: '10-1', title: '吐かせる初期設定', minutes: 8,
        scenario: 'asthma',
        settings: { mode: 'VC-AC', vt: 280, rr: 24, peep: 5, fio2: 0.6, flow: 30, pause: 0.3 },
        sedation: 0.95,
        brief: [
          '喘息重積は、細くなった気管支から息が吐けない病気。回数を上げると auto-PEEP がたまり、血圧が下がる。',
          '設定は「吐かせる」が最優先。呼吸回数は少なく（学童で 10〜14）、吸気流量を上げて吸気時間を短くする。',
          'PIP は抵抗の分で高く出る。肺胞を守る目安は Pplat 30 以下と auto-PEEP。PIP だけで慌てない。'
        ],
        points: ['回数は少なく、呼気時間を長く', '吸気流量を上げて吸気を短く',
          'PIP より Pplat と auto-PEEP を見る'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '3 週目の夕方。救急外来から、11 歳の男の子が運ばれてきた。喘息の発作で、吸入も点滴も効かず、意識が落ちて挿管された。レン君。'
          },
          {
            talk: true, who: 'scene',
            say: '救急外来では、手でバッグを速く押していた。呼吸器も、その勢いのまま 24 回で動いている。血圧が下がってきている。',
            onStart: function (c) { c.e.map = Math.min(c.e.map, 52); }
          },
          {
            talk: true, who: 'puku',
            say: '胸がふくらんだまま、ぜんぜんしぼんでない…'
          },
          {
            talk: true, who: 'doc',
            say: '吐けていないのです。喘息は、気管支が細くなって、とくに吐く息が出ていかない病気です。まず吐き残しを測ります。'
          },
          {
            say: '「呼気ポーズ」で、吐き残しを測ってください。',
            spot: 'hard:kExp',
            event: 'hold:exp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。',
            spot: 'val:auto-PEEP', watch: ['auto-PEEP', 'PEEP tot', 'ABP mean'],
            check: function (c) { return paused(c) && c.m.autoPeep > 0; },
            onPass: function (c) { c.mem.ap101 = c.m.autoPeep; c.mem.map101 = c.e.map; },
            why: function (c) {
              return '吐き残しの圧は ' + c.mem.ap101.toFixed(1) + ' cmH₂O。胸の中の圧が上がり、心臓に血液が戻れなくなっています。';
            }
          },
          {
            talk: true, who: 'doc',
            say: 'そうた君で覚えた順番です。いちばん効くのは、回数を下げて吐く時間を作ること。学童なら 10〜14 回まで下げます。'
          },
          {
            say: '呼吸回数を 12 以下に下げてください。',
            spot: 'key:rr', watch: ['auto-PEEP', 'ABP mean', 'MV'],
            check: function (c) { return c.s.rr <= 12; },
            hold: 10,
            why: '1 呼吸が 5 秒になり、吐く時間が大きく伸びました。'
          },
          {
            say: '平均動脈圧が下限まで戻るのを見届けてください。',
            hint: '戻るまで数分かかります。「× 10」で早送りできます。',
            spot: 'val:ABP mean', watch: ['ABP mean', 'auto-PEEP', 'SpO₂'],
            check: function (c) { return c.e.map >= c.e.nm.mapMin; },
            hold: 10,
            why: function (c) {
              return '平均動脈圧 ' + Math.round(c.mem.map101) + ' → {ABP mean}。たまった空気が抜け、心臓に血液が戻りはじめました。';
            }
          },
          {
            talk: true, who: 'doc',
            say: '次は吸気流量。速く入れれば、吸う時間が短くなり、そのぶん吐く時間が伸びます。'
          },
          {
            say: '吸気流量を 40 L/分 に上げて確定してください。',
            spot: 'key:flow', watch: ['PIP', 'Pplat', 'I:E'],
            check: function (c) { return c.s.flow >= 40; },
            hold: 6,
            why: '吸う時間と吐く時間の比（I:E）の、吐く側が伸びました。かわりに PIP は上がっています。'
          },
          {
            talk: true, who: 'puku',
            say: 'PIP がすごく高いよ！ 大丈夫なの？'
          },
          {
            talk: true, who: 'doc',
            say: 'それを確かめる方法を、もう知っていますね。吸い終わりで流れを止めて、肺胞の圧だけを測ります。'
          },
          {
            say: '「吸気ポーズ」を押して、Pplat を測ってください。',
            spot: 'hard:kInsp', watch: ['PIP', 'Pplat'],
            event: 'hold:insp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。',
            watch: ['PIP', 'Pplat', 'Raw'],
            check: function (c) { return c.m.pplat != null && paused(c); },
            why: 'PIP は高くても、Pplat は上限の 30 よりずっと低い。高いのは細い気管支を押し流す分で、肺胞にはかかっていません。'
          },
          {
            quiz: {
              q: '喘息の子で PIP 40、Pplat 18、auto-PEEP 2。いちばん気にするのは？',
              choices: ['PIP 40 なので流量を下げる', 'Pplat と auto-PEEP が低いので、いまは許容できる', 'PEEP を 15 に上げる', '一回換気量を増やす'],
              answer: 1,
              miss: ['流量を下げると吸気が伸び、吐く時間が削られます。', null,
                '吐けない肺に外から圧を足すと、さらにふくらみます。', '吐く量が増えて、吐き残しが増えます。'],
              why: '肺胞を守る目安は Pplat と auto-PEEP。PIP は抵抗の分で高く出ます。PIP を下げようと流量を落とすのは、喘息ではよくある逆効果です。'
            }
          },
          {
            say: 'SpO₂ 94% 以上のまま、FiO₂ を 40% 以下にしてください。',
            spot: 'key:fio2', watch: ['SpO₂'],
            check: function (c) { return c.s.fio2 <= 0.41 && c.e.spo2 >= 94; },
            hold: 20,
            why: '喘息の子の肺胞は潰れていないので、酸素はすぐ下げられます。問題は、吐けないことだけです。'
          }
        ]
      },

      {
        id: '10-2', title: 'CO₂ を許し、血圧を守る', minutes: 8,
        scenario: 'asthma',
        settings: { mode: 'VC-AC', vt: 280, rr: 12, peep: 5, fio2: 0.4, flow: 40, pause: 0.3 },
        sedation: 0.95,
        brief: [
          '吐かせる設定では CO₂ が上がる。喘息重積では pH 7.20 前後まで許し、回数を上げて CO₂ を追わない。',
          'auto-PEEP で血圧が急に落ちたら、回路を一瞬外して吐かせる（胸を軽く押す）。そのあと回数を下げる。',
          '高い CO₂ を許せないのは、頭蓋内圧が高いとき・肺高血圧・重い心機能低下。喘息の子は多くが当てはまらない。'
        ],
        points: ['喘息重積では pH 7.20 前後まで CO₂ を許す', '回数を上げて CO₂ を追わない',
          '急な血圧低下には、回路を外して吐かせる'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: 'その夜。レン君の採血の結果を見た別の当直医が、CO₂ が高いと言って呼吸回数を 22 回に上げていった。',
            onStart: function (c) { c.s.rr = 22; c.e._raise('呼吸回数が変更されました'); }
          },
          {
            talk: true, who: 'puku',
            say: 'あれ、それってそうた君のときと同じ…'
          },
          {
            talk: true, who: 'doc',
            say: '同じ落とし穴です。数字だけを見ると、誰でも一度はやります。何が起きるか、モニターを見ていてください。'
          },
          {
            say: '平均動脈圧と auto-PEEP の動きを 40 秒見てください。',
            spot: ['val:ABP mean', 'val:auto-PEEP'], watch: ['ABP mean', 'PIP', 'SpO₂'],
            check: function (c) { return true; },
            hold: 40,
            why: '回数を上げたぶん吐ききれず、空気がたまっていきます。平均動脈圧が下がってきました。'
          },
          {
            quiz: {
              q: '吐き残しで血圧が急に 40 台まで落ちました。最初にできることは？',
              choices: ['回路を一瞬外し、胸を軽く押して吐かせる', '輸液だけを急いで入れる', 'PEEP を上げる', '回数をさらに上げる'],
              answer: 0,
              miss: [null, '輸液も助けになりますが、たまった空気が抜けないと戻りません。',
                '外から圧を足すと、さらにふくらみます。', 'もっと吐けなくなります。'],
              why: '回路を外すと、たまった空気が一気に出ていき、数秒で血圧が戻ることがあります。そのうえで回数を下げます。'
            }
          },
          {
            say: '呼吸回数を下げ、auto-PEEP を 3 未満にしてください。',
            hint: '下げてから「呼気ポーズ」で測り直します。RR 12 以下が目安です。',
            spot: ['key:rr', 'hard:kExp'], watch: ['auto-PEEP', 'ABP mean', 'MV'],
            check: function (c) { return c.s.rr <= 14 && c.m.autoPeep < 3 && paused(c); },
            why: '吐く時間が戻り、たまっていた空気が抜けました。'
          },
          {
            talk: true, who: 'doc',
            say: 'では、CO₂ はどこまで許すのか。採血して、自分の目で確かめましょう。'
          },
          {
            say: '数分進めてから採血し、pH と PaCO₂ を確かめてください。',
            hint: '「× 10」で 5 分ほど進めてから「血液ガス」を押します。',
            spot: 'hard:kAbg', watch: ['etCO₂', 'ABP mean'],
            check: function (c) { return c.abgs.length >= 1; },
            why: function (c) {
              var g = c.lastAbg;
              return 'pH ' + g.ph.toFixed(2) + '、PaCO₂ ' + g.paco2.toFixed(0) + '。'
                + (g.ph >= 7.2 ? 'CO₂ は高くても、pH は許せる範囲です。' : 'pH が 7.20 を割っています。回数を 1〜2 回だけ足し、auto-PEEP を見ながら調整します。');
            }
          },
          {
            talk: true, who: 'doc',
            say: '高い CO₂ を許す考え方は、ミオちゃんのときと同じ permissive hypercapnia。違うのは、守っているのが肺胞ではなく循環だということです。'
          },
          {
            quiz: {
              q: '喘息重積、pH 7.21 / PaCO₂ 66、平均血圧は保てています。どうしますか。',
              choices: ['このまま許容し、気管支を広げる治療を続ける', '回数を 22 に戻す', '一回換気量を 12 mL/kg に増やす', 'PEEP を上げる'],
              answer: 0,
              miss: [null, 'さっきの状態に戻り、血圧が下がります。', 'Pplat と吐き残しが増えます。',
                'CO₂ には効きません。'],
              why: '吐ける範囲の換気で、高い CO₂ は許します。CO₂ を下げるのは機械ではなく、ステロイドや気管支拡張薬で気道が開くことです。'
            }
          },
          {
            talk: true, who: 'puku',
            say: '数字を良くしようとして、子どもを悪くしちゃうことがあるんだね。'
          },
          {
            quiz: {
              q: '高い CO₂ を許してはいけないのは、どの子ですか。',
              choices: ['頭部外傷で頭蓋内圧が高い子', '喘息重積の子', 'ARDS の子', '細気管支炎の子'],
              answer: 0,
              miss: [null, '喘息重積は、高い CO₂ を許す代表です。', 'ARDS も肺を守るために許します。',
                '細気管支炎でも許します。'],
              why: 'CO₂ が上がると脳の血管が広がり、頭蓋内圧がさらに上がります。肺高血圧や重い心不全の子でも使えません。'
            }
          }
        ]
      },

      {
        id: '10-3', title: '気管支が開いたら', minutes: 9,
        scenario: 'asthma',
        settings: { mode: 'VC-AC', vt: 280, rr: 12, peep: 5, fio2: 0.4, flow: 40, pause: 0.3 },
        sedation: 0.7,
        brief: [
          '喘息の人工呼吸は短い。気管支が開けば 1〜3 日で外せることが多い。',
          '開いてきたことは、PIP と Pplat の差（抵抗の分）が縮むことで分かる。auto-PEEP も消えていく。',
          '鎮静を浅くすると咳や体動で発作がぶり返すことがある。抜くと決めたら、間をあけずに進める。'
        ],
        points: ['PIP − Pplat が縮む＝気管支が開いた', 'auto-PEEP が消えたら回数を戻せる',
          '決めたら間をあけずに抜管まで進める'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '翌日の昼。ステロイドと気管支拡張薬が効いてきた。聴診すると、呼気の音がはっきり聞こえる。',
            onStart: function (c) {
              c.e.p.Rinsp = 16; c.e.p.Rexp = 22;
              c.e.p.hr = 100; c.e.p.driveGain = 1.0;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'doc',
            say: '気管支が開いたかどうかは、数字でも分かります。昨日と同じ方法で、圧の中身を分けてみましょう。'
          },
          {
            say: '「吸気ポーズ」を押して、Pplat を測ってください。',
            spot: 'hard:kInsp', watch: ['PIP', 'Pplat'],
            event: 'hold:insp',
            why: ''
          },
          {
            say: '測り終わるのを待ちます。',
            watch: ['PIP', 'Pplat', 'Raw'],
            check: function (c) { return c.m.pplat != null && paused(c); },
            why: 'PIP と Pplat の差が、昨日よりずっと小さくなっています。Raw も下がりました。気管支が開いた証拠です。'
          },
          {
            quiz: {
              q: '昨日は PIP 40 / Pplat 18、今日は PIP 24 / Pplat 17。何が変わりましたか。',
              choices: ['気道の抵抗が下がった', '肺が硬くなった', '一回換気量が減った', 'PEEP が上がった'],
              answer: 0,
              miss: [null, '肺が硬くなれば Pplat が上がります。Pplat はほぼ同じです。',
                'VC なので量は同じです。', 'PEEP は触っていません。'],
              why: '差（抵抗の分）が 22 → 7 に縮みました。肺胞にかかる Pplat はほぼ同じ。同じ数字の読み方で、良くなったことも分かります。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '喘息の人工呼吸は、うまくいけば短く済みます。開いたら、間をあけずに外しにいきます。'
          },
          {
            say: '「離脱」キーで、条件のリストを開いてください。',
            spot: 'hard:kWean',
            event: 'weaning:open',
            why: '× がついている項目が、いま足りていないものです。'
          },
          {
            say: '設定と鎮静を調整して、リストを全部 ✓ にしてください。',
            hint: '鎮静を浅くして自発呼吸を出します。FiO₂ 40% 以下、PEEP 7 以下。',
            spot: ['key:fio2', 'key:peep', 'key:sed'], watch: ['SpO₂', 'RR tot', 'ABP mean'],
            check: readyAll,
            why: '条件がそろいました。'
          },
          {
            talk: true, who: 'puku',
            say: '目が覚めたら、また発作が起きたりしない？'
          },
          {
            talk: true, who: 'doc',
            say: '起きることがあります。だから SBT のあいだも聴診と呼気ポーズで、吐けているかを確かめ続けます。'
          },
          {
            say: '「離脱」キーから SBT を開始し、最後まで通してください。',
            hint: '早送りを使ってください。中止になったら原因を直して、もう一度開始します。',
            spot: 'hard:kWean', watch: ['f/VT', 'RR tot', 'SpO₂', 'HR'],
            check: function (c) { return c.sbt != null && c.sbt.done === 'pass'; },
            why: '30 分、吐けなくなることもなく呼吸できました。'
          },
          {
            quiz: {
              q: '抜管後、喘息の再発を防ぐのにいちばん大事なことは？',
              choices: ['吸入ステロイドを毎日続ける', '発作のときだけ吸入する', '運動を禁止する', '酸素を家でも続ける'],
              answer: 0,
              miss: [null, 'それでは炎症がくすぶり続けます。レン君は自己中断から重積になりました。',
                '運動は、発作をコントロールできていれば続けられます。', '発作のない日の酸素は要りません。'],
              why: 'レン君は吸入ステロイドを自分でやめていました。治療は呼吸器を外して終わりではなく、次の発作を起こさないことまでです。'
            }
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
            why: '抜管できました。レン君は少しかすれた声で「…ごめんなさい、薬」と言った。'
          }
        ]
      }
    ]
  };

  /* ===================== 第11章 力を取り戻す（あかりちゃん） ===================== */

  var CH11 = {
    id: 'ch11', title: '第11章　力を取り戻す', tag: '神経筋',
    sub: '呼吸の筋肉が弱い子を、休ませながら抜管までつなぐ。',
    lessons: [

      {
        id: '11-1', title: '休ませながら鍛える', minutes: 9,
        scenario: 'gbs',
        settings: { mode: 'PSV', ps: 12, peep: 5, fio2: 0.3, rr: 16, vt: 160 },
        sedation: 0.2,
        brief: [
          '呼吸の筋肉は、使わなければ衰え、使いすぎれば疲れる。SBT に失敗した日は、24 時間しっかり休ませる。',
          '鍛えるときは、PS を少しずつ下げて、呼吸回数と f/VT を見る。浅く速くなってきたら、そこが今日の限界。',
          '昼に鍛え、夜は休ませる。疲れきるまで粘らせると、翌日はかえって弱くなる。'
        ],
        points: ['失敗した日は休ませる', 'PS を下げて、RR と f/VT で限界を見る',
          '浅く速くなったら PS を戻して休ませる'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '3 週目。あかりちゃんは挿管から 4 週間を過ぎた。手で物をつかめるようになった。最初の SBT のあとは熱と痰で抜管を見送り、2 回目の SBT は 18 分で崩れた。',

          },
          {
            talk: true, who: 'doc',
            say: 'あかりちゃんの肺はきれいです。足りないのは筋力だけ。だから、休ませながら鍛えます。'
          },
          {
            talk: true, who: 'puku',
            say: '休ませながら、鍛える？ どっちなの？'
          },
          {
            talk: true, who: 'doc',
            say: '両方です。筋肉は、使わなければ衰え、使いすぎれば疲れます。その間の、ちょうどいい負荷を探します。'
          },
          {
            talk: true, who: 'doc',
            say: 'いまは PSV で、PS は 12。この子が吸うたびに、かなり強く後押ししています。呼吸は楽なはずです。'
          },
          {
            say: '呼吸回数と f/VT を 60 秒見てください。',
            spot: ['val:RR tot', 'val:f/VT'], watch: ['RR tot', 'f/VT', 'Vte'],
            check: function (c) { return c.m.rsbiKg != null; },
            hold: 60,
            onPass: function (c) { c.mem.rr111 = c.m.rrTotal; },
            why: 'ゆっくり深い呼吸です。いまは、ほとんど機械が仕事をしています。'
          },
          {
            say: 'PS を 7 に下げて、15 分見てください。',
            hint: '「× 60」で早送りできます。RR tot と f/VT の動きに注目します。',
            spot: ['key:ps', 'val:RR tot'], watch: ['RR tot', 'f/VT', 'Vte'],
            check: function (c) { return c.s.ps <= 7; },
            hold: 900,
            why: function (c) {
              return '呼吸回数 ' + Math.round(c.mem.rr111) + ' → {RR tot}。手伝いを減らすと、浅く速くなっていきます。'
                + '最初の数分は保てても、時間とともに崩れていくのが筋力の弱い子の特徴です。';
            }
          },
          {
            quiz: {
              q: 'PS を下げて 15 分。RR がじわじわ上がり、Vte が減ってきました。どうしますか。',
              choices: ['PS を戻して休ませる', 'さらに PS を下げて鍛える', '鎮静を深くする', 'そのまま 1 時間粘る'],
              answer: 0,
              miss: [null, '疲れた筋肉にさらに負荷をかけると、翌日はかえって弱くなります。',
                '呼吸が弱まり、休むのとは違います。', '疲れきるまで粘らせるのは、鍛えることになりません。'],
              why: '浅く速くなってきたところが、今日の限界です。そこで手伝いを戻し、休ませる。明日は少し長く、少し低い PS で試します。'
            }
          },
          {
            say: 'PS を 10 以上に戻し、呼吸回数が落ち着くのを見てください。',
            spot: 'key:ps', watch: ['RR tot', 'f/VT', 'Vte'],
            check: function (c) { return c.s.ps >= 10; },
            hold: 120,
            why: '後押しが戻り、呼吸が深くゆっくりになりました。今日の練習はここまでです。'
          },
          {
            talk: true, who: 'pt',
            say: '（あかりちゃんが、文字盤を指でたどる。「つかれた。でも、きのうより、ながかった」）'
          },
          {
            talk: true, who: 'doc',
            say: '昼に少し鍛えて、夜はしっかり休ませる。毎日の小さな積み重ねが、いちばんの近道です。'
          },
          {
            quiz: {
              q: '神経筋の病気で長く挿管している子。夜間の設定で正しいのは？',
              choices: ['夜は手伝いを十分にして、呼吸の筋肉を休ませる', '夜こそ PS を下げて鍛える', '夜は鎮静を深くして呼吸を止める', '夜も昼も同じ低い PS'],
              answer: 0,
              miss: [null, '眠っているあいだは呼吸が浅くなり、疲れがたまります。',
                '止めると筋肉はかえって衰えます。', '休む時間がなくなり、疲れが抜けません。'],
              why: '休む時間がないと、疲れは翌日に持ち越されます。鍛える時間と休む時間を分けるのが、長い離脱のこつです。'
            }
          }
        ]
      },

      {
        id: '11-2', title: '三度目の SBT と抜管', minutes: 10,
        scenario: 'gbs',
        settings: { mode: 'PSV', ps: 8, peep: 5, fio2: 0.3, rr: 16, vt: 160 },
        sedation: 0.2,
        brief: [
          '神経筋の病気では、肺がきれいでも、咳の力が弱いと痰を出せない。抜管の前に咳と飲み込みも確かめる。',
          '長く挿管した子は、抜管後に NPPV（マスクでの陽圧換気）で手伝うと、再挿管を減らせることがある。',
          'カフリークテストで声門下の浮腫を確かめる。漏れなければステロイドを考える。'
        ],
        points: ['肺だけでなく、咳と飲み込みを確かめる', '抜管後は NPPV で手伝うことがある',
          '長い挿管ほどカフリークを確かめる'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '3 週目の終わり。あかりちゃんは、手すりにつかまって座れるようになった。毎日の練習で、PS 8 なら 1 日じゅう疲れずにいられる。',
            onStart: function (c) {
              c.e.p.maxPmus = 12; c.e.p.fatigueLoad = 0.3;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'doc',
            say: '今日、もう一度 SBT をします。前回は 18 分で崩れました。今度は、30 分を目指します。'
          },
          {
            talk: true, who: 'puku',
            say: 'がんばれ、あかりちゃん…！'
          },
          {
            say: '「離脱」キーで、条件のリストを開いてください。',
            spot: 'hard:kWean',
            event: 'weaning:open',
            why: '× がついている項目が、いま足りていないものです。'
          },
          {
            say: '設定と鎮静を調整して、リストを全部 ✓ にしてください。',
            hint: 'FiO₂ 40% 以下、PEEP 7 以下、鎮静を浅く、自発呼吸があること。',
            spot: ['key:fio2', 'key:peep', 'key:sed'], watch: ['SpO₂', 'RR tot', 'ABP mean'],
            check: readyAll,
            why: '条件がそろいました。'
          },
          {
            say: '「離脱」キーから SBT を開始してください。',
            spot: 'hard:kWean',
            event: 'sbt:start',
            why: 'PEEP 5 と PS 6 に切り替わり、30 分の計測が始まりました。'
          },
          {
            say: '30 分の SBT を、最後まで見届けてください。',
            hint: '「× 10」や「× 60」で早送りできます。後半の RR と f/VT に注目します。',
            spot: 'val:f/VT', watch: ['f/VT', 'RR tot', 'Vte', 'SpO₂'],
            check: function (c) { return c.sbt != null && c.sbt.done === 'pass'; },
            why: '30 分、後半まで崩れずに呼吸できました。前回、18 分で崩れた子です。'
          },
          {
            talk: true, who: 'doc',
            say: 'ギラン・バレーの子は、呼吸の筋肉だけでなく、咳や飲み込みの力も弱っています。肺がきれいでも、痰を出せなければ戻ってきます。'
          },
          {
            quiz: {
              q: 'SBT に通ったあかりちゃん。抜管の前に、ほかに確かめることは？',
              choices: ['咳の強さ・飲み込み・カフリーク', '何もない', '体重', '胸の X 線だけ'],
              answer: 0,
              miss: [null, 'SBT は呼吸の力の試験です。気道を守れるかは別に見ます。',
                '体重は設定を決める材料ですが、抜管の判断ではありません。', '肺はきれいです。見るのは気道を守る力です。'],
              why: '呼吸が保てることと、気道を守れることは別でした。神経筋の病気では、咳と飲み込みがとくに大事です。4 週間挿管していたので、カフリークも確かめます。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '抜いたあと、マスクで陽圧をかけて呼吸を手伝う方法があります。NPPV です。弱い筋肉の子の、抜管後の支えになります。'
          },
          {
            talk: true, who: 'scene',
            say: 'あかりちゃんが、大きく咳をした。チューブの中を、痰が勢いよく上がってくる。'
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
            why: '抜管できました。あかりちゃんは NPPV のマスクの下で、4 週間ぶりに自分の声で「ありがとう」と言った。'
          }
        ]
      }
    ]
  };

  /* ===================== 第12章 ふるえる息（HFO） ===================== */
  /* 在胎 25 週・720 g のつむぎちゃん。従来の換気では CO₂ が下がらず、HFO に切り替える。
   * HFO の 3 つのつまみ：酸素化は MAP、CO₂ は振幅（Amp）と周波数（Freq）。
   * 周波数を下げると一回の揺れが大きくなり、かえって CO₂ が下がる（engine.js の _stepHFO）。 */
  function vtHfKg(c) { return c.m.vtHf / c.pbw; }

  var CH12 = {
    id: 'ch12', title: '第12章　ふるえる息', tag: 'HFO',
    sub: '在胎 25 週の肺を、高頻度振動換気（HFO）で開く。',
    lessons: [

      {
        id: '12-1', title: '揺らして、ひらく', minutes: 9,
        scenario: 'micro',
        settings: { mode: 'PC-AC', pinsp: 20, peep: 6, rr: 55, fio2: 0.7, ti: 0.3,
          hfoMap: 10, hfoAmp: 15, hfoFreq: 12 },
        sedation: 0.85,
        brief: [
          'HFO（高頻度振動換気）は、平均気道内圧 MAP のまわりで、1 秒に 10〜15 回の小さな揺れを送る。',
          '1 回の量（VThf）は死腔より小さい。肺を大きく膨らませたりしぼませたりしないので、傷めにくい。',
          '始めは MAP を、従来の換気の平均気道内圧より 2〜3 cmH₂O 高く。酸素化は MAP で決まる。',
          '振幅（Amp）は、胸の揺れがおへそのあたりまで見える大きさから。VThf は 1.5〜2.5 mL/kg が目安。'
        ],
        points: ['HFO は MAP のまわりの小さく速い揺れ', 'MAP は従来の換気の平均気道内圧 ＋2〜3 から',
          'VThf 1.5〜2.5 mL/kg、胸がおへそまで揺れる振幅'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '4 週目の朝。NICU の奥の保育器に、在胎 25 週で生まれた女の子がいる。体重 720 g。つむぎちゃん。'
          },
          {
            talk: true, who: 'scene',
            say: 'サーファクタントは 2 回入った。それでも胸はほとんど上がらず、酸素は 70% のままだ。'
          },
          {
            look: ['val:PIP', 'val:Vte'],
            talk: true, who: 'doc',
            say: 'P insp を上げても、思うほど量が入りません。肺が硬く、圧を上げるほど、肺の傷（空気の漏れ）が増えていきます。'
          },
          {
            talk: true, who: 'puku',
            say: 'じゃあ、どうするの？ もっと押すの？'
          },
          {
            talk: true, who: 'doc',
            say: '押すのをやめて、揺らします。高頻度振動換気、HFO。1 秒に 10〜15 回、小さな揺れを送り続ける呼吸器です。'
          },
          {
            talk: true, who: 'doc',
            say: '肺は、平均気道内圧（MAP）で膨らんだまま保たれます。血圧の平均（ABP mean）とは別物です。いまの換気の平均気道内圧は {Pmean} cmH₂O。HFO の MAP は、これより 2〜3 高く始めます。'
          },
          {
            say: 'モードを HFO に切り替えてください。',
            spot: 'mode:HFO',
            event: 'mode:HFO',
            why: '波形が細かく震えはじめました。圧の波形の真ん中の点線が MAP です。'
          },
          {
            say: 'MAP を 13 cmH₂O 以上にして確定してください。',
            hint: '従来の換気の平均気道内圧より 2〜3 高く。MAP のキーで回します。',
            spot: 'key:map', watch: ['Pmean', 'SpO₂'],
            check: function (c) { return c.s.hfoMap >= 13; },
            hold: 10,
            why: '肺胞を開いたまま保つ圧を、少し高く据えました。酸素化はここから上がってきます。'
          },
          {
            talk: true, who: 'puku',
            say: 'Amp と Freq は？'
          },
          {
            talk: true, who: 'doc',
            say: 'Amp は振幅、揺れの大きさ（cmH₂O）。Freq は周波数、1 秒に何回揺らすか（Hz）です。1 回の揺れで動く量が VThf。CO₂ を出す力は「周波数 × VThf の 2 乗」で、これを DCO₂ と呼びます。'
          },
          {
            talk: true, who: 'doc',
            say: '口から肺胞までの、ガス交換をしない通り道を死腔と言います。新生児でおよそ 2 mL/kg。VThf は、それより小さいのがふつうです。'
          },
          {
            say: 'Amp を上げて、VThf を 1.5〜2.5 mL/kg に入れてください。',
            hint: function (c) { return '体重 ' + c.pbw + ' kg なので ' + mlkg(c, 1.5) + '〜' + mlkg(c, 2.5) + ' mL。VThf のタイルの右上が mL/kg です。'; },
            spot: 'key:amp', watch: ['VThf', 'DCO₂'],
            check: function (c) { var x = vtHfKg(c); return x >= 1.5 && x <= 2.5; },
            hold: 10,
            why: 'つむぎちゃんの胸が、おへそのあたりまで細かく揺れています。ベッドサイドでは、この揺れを見て振幅を合わせます。'
          },
          {
            quiz: {
              q: 'VThf は死腔より小さいのに、CO₂ が出ていくのはなぜですか。',
              choices: ['速い揺れで気道のガスがかき混ぜられ、少しずつ運ばれるから', '肺胞で CO₂ が消えるから',
                '酸素が CO₂ を押し出すから', '実は出ていない'],
              answer: 0,
              miss: [null, 'CO₂ は体から出ていかなければ消えません。', '酸素が押し出すわけではありません。',
                'HFO でも CO₂ はきちんと下がります。'],
              why: '気道の中で、揺れがガスを混ぜて運びます。CO₂ の出ていく量は DCO₂、つまり「周波数 × VThf の 2 乗」に比例します。'
                + '画面の DCO₂ がその目安です。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '酸素化は MAP で決まります。肺が開いてきたら、FiO₂ から下げます。早産児の SpO₂ の目標は 90〜95% でしたね。'
          },
          {
            say: 'SpO₂ 90〜95% のまま、FiO₂ を 40% 以下に。',
            hint: 'SpO₂ が 90% に届かなければ、MAP を 1〜2 上げてから FiO₂ を下げます。',
            spot: ['key:fio2', 'key:map'], watch: ['SpO₂', 'Pmean', 'ABP mean'],
            check: function (c) { return c.s.fio2 <= 0.41 && c.e.spo2 >= 90 && c.e.spo2 <= 95; },
            hold: 30,
            why: '70% だった酸素が {FiO₂}% まで下がりました。押さずに、開いて揺らす。これが HFO です。'
          }
        ]
      },

      {
        id: '12-2', title: 'CO₂ は揺れの大きさで', minutes: 9,
        scenario: 'micro',
        settings: { mode: 'HFO', hfoMap: 14, hfoAmp: 22, hfoFreq: 15, fio2: 0.4 },
        sedation: 0.85,
        brief: [
          'HFO の CO₂ は、振幅（Amp）を上げると下がる。CO₂ の出ていく量は 周波数 × VThf² に比例する（DCO₂）。',
          '周波数を下げると、1 回の揺れが長くなって VThf が増え、CO₂ はかえって下がる。従来の換気と逆向き。',
          'HFO 中は etCO₂ が測れない。経皮 CO₂（tcPCO₂）で流れを追い、血液ガスで確かめる。',
          'CO₂ の下がりすぎは、早産児の脳の血流を減らす。目標は PaCO₂ 45〜55 前後。'
        ],
        points: ['CO₂ は Amp で下げる', '周波数を下げると VThf が増え、CO₂ が下がる',
          'tcPCO₂ で追い、血液ガスで確かめる'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '生まれて 1 日目の夜。つむぎちゃんは HFO の上で、小さく揺れ続けている。'
          },
          {
            talk: true, who: 'doc',
            say: 'HFO では、吐き出す息の CO₂（etCO₂）が測れません。代わりに、皮膚を温めて CO₂ を測る経皮 CO₂（tcPCO₂）を見ます。'
          },
          {
            look: ['val:tcPCO₂'],
            talk: true, who: 'puku',
            say: 'tcPCO₂ が {tcPCO₂} …高くない？'
          },
          {
            say: '「血液ガス」キーで採血してください。',
            spot: 'hard:kAbg',
            event: 'abg:order',
            why: ''
          },
          {
            say: '結果が返るまで待ちます。',
            watch: ['tcPCO₂', 'VThf'],
            check: function (c) { return c.abgs.length >= 1; },
            why: function (c) {
              return 'PaCO₂ ' + c.lastAbg.paco2.toFixed(0) + ' mmHg、pH ' + c.lastAbg.ph.toFixed(2) + '。'
                + (c.lastAbg.paco2 > 55 ? 'CO₂ が溜まっています。' : 'tcPCO₂ と同じ向きの値です。');
            }
          },
          {
            talk: true, who: 'doc',
            say: 'CO₂ を出すのは揺れです。まず振幅（Amp）を上げます。2〜3 cmH₂O ずつ、VThf と tcPCO₂ を見ながら。'
          },
          {
            say: 'Amp を上げて、VThf を 1.6 mL/kg 以上にしてください。',
            hint: function (c) { return '体重 ' + c.pbw + ' kg なので ' + mlkg(c, 1.6) + ' mL 以上。'; },
            spot: 'key:amp', watch: ['VThf', 'DCO₂', 'tcPCO₂'],
            check: function (c) { return vtHfKg(c) >= 1.6; },
            hold: 10,
            why: 'VThf と DCO₂ が増えました。tcPCO₂ は数分遅れて下がってきます。'
          },
          {
            talk: true, who: 'puku',
            say: 'じゃあ周波数は？ 従来の換気なら、回数を上げると CO₂ が下がったよね。'
          },
          {
            talk: true, who: 'doc',
            say: 'HFO では逆です。周波数を上げると 1 回の揺れが短くなり、細いチューブの先まで届く揺れが小さくなります。'
          },
          {
            say: 'Freq を 10 Hz に下げて、VThf の変化を見ます。',
            spot: 'key:freq', watch: ['VThf', 'DCO₂', 'tcPCO₂'],
            check: function (c) { return c.s.hfoFreq <= 10; },
            hold: 10,
            why: '振幅は同じなのに、VThf が増えました。1 回の揺れが長いほど、チューブの先まで届くからです。'
              + 'このままでは CO₂ が下がりすぎるかもしれません。'
          },
          {
            quiz: {
              q: '振幅をこれ以上上げたくない。CO₂ がまだ高い。周波数は？',
              choices: ['下げる', '上げる', '変えない', '0 にする'],
              answer: 0,
              miss: [null, '上げると VThf が減り、CO₂ はかえって溜まります。',
                '周波数も、CO₂ を動かすつまみです。', '揺れが止まります。'],
              why: '周波数を下げると VThf が増え、CO₂ が出ます。従来の換気の「回数」と、向きが逆になるのが HFO です。'
            }
          },
          {
            say: 'tcPCO₂ が 45〜58 mmHg に入るまで待ちます。',
            hint: '下がりすぎたら Amp を下げます。CO₂ の下がりすぎは、早産児の脳の血流を減らします。',
            spot: ['key:amp', 'key:freq'], watch: ['tcPCO₂', 'VThf'],
            check: function (c) { return c.e.tcpco2 >= 45 && c.e.tcpco2 <= 58; },
            hold: 20,
            why: 'CO₂ が目標に入りました。HFO の CO₂ は振幅と周波数、酸素化は MAP。つまみの役割が分かれています。'
          },
          {
            say: 'もう一度採血して、PaCO₂ を確かめてください。',
            hint: '「血液ガス」キーで採血し、結果が返るまで待ちます。',
            spot: 'hard:kAbg', watch: ['tcPCO₂'],
            check: function (c) { return c.abgs.length >= 2 && c.lastAbg.paco2 >= 40 && c.lastAbg.paco2 <= 58; },
            why: function (c) {
              return 'PaCO₂ ' + c.lastAbg.paco2.toFixed(0) + ' mmHg、pH ' + c.lastAbg.ph.toFixed(2)
                + '。tcPCO₂ は流れを追うもの、答え合わせは血液ガスです。';
            }
          }
        ]
      },

      {
        id: '12-3', title: '肺が開いたら、MAP を下げる', minutes: 9,
        scenario: 'micro',
        settings: { mode: 'HFO', hfoMap: 15, hfoAmp: 26, hfoFreq: 12, fio2: 0.35 },
        sedation: 0.8,
        brief: [
          '肺が良くなると、同じ MAP では膨らみすぎる。胸部X線で横隔膜が第 9 後肋骨より下がっていたら過膨張。',
          '過膨張は心臓への血の戻りを妨げ、血圧を下げる。酸素化もかえって悪くなる。',
          'HFO からの離脱は、FiO₂ を 30% 前後まで下げてから、MAP を 1〜2 ずつ下げていく。'
        ],
        points: ['肺が良くなったら MAP を下げる', '過膨張は血圧を下げる',
          'FiO₂ を先に、MAP はそのあと少しずつ'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '生まれて 3 日目の朝。胸部X線の肺は、白さがずいぶん抜けてきた。横隔膜は、背中側の肋骨で 10 本目まで下がっている。',
            onStart: function (c) {
              c.e.C = 0.00034;
              c.e.p.shunt0 = 0.32; c.e.p.shuntMin = 0.15; c.e.p.recruitP = 8; c.e.p.recruitK = 1.6;
              c.e.p.vdAlvFrac = 0.08;
              c.e._recomputeDrive();
            }
          },
          {
            talk: true, who: 'doc',
            say: '早産児の肺は、横隔膜が背中側の肋骨で 8〜9 本目にあるのがちょうどいい広がりです。10 本目は、膨らみすぎ。'
          },
          {
            look: ['val:ABP mean', 'val:SpO₂'],
            talk: true, who: 'puku',
            say: '良くなったのに、血圧が下がってきてるよ…？'
          },
          {
            talk: true, who: 'doc',
            say: '肺が柔らかくなって、同じ MAP（平均気道内圧）では膨らみすぎたんです。膨らんだ肺が心臓を押し、血が戻りにくくなります。'
          },
          {
            say: 'MAP（平均気道内圧）を 1〜2 ずつ下げ、血圧（ABP mean）を保ってください。',
            hint: 'MAP を 11 前後まで。SpO₂ が 90% を切るなら下げすぎです。',
            spot: 'key:map', watch: ['ABP mean', 'SpO₂', 'Pmean'],
            check: function (c) { return c.s.hfoMap <= 12 && c.e.map >= c.e.nm.mapMin + 2 && c.e.spo2 >= 90; },
            hold: 20,
            why: '膨らみすぎがとれて、血圧が戻りました。酸素化も落ちていません。'
          },
          {
            quiz: {
              q: 'HFO から降りる準備。先に下げるのはどれですか。',
              choices: ['FiO₂ を 30% 前後まで', 'MAP を一気に 6 まで', '周波数を 5 Hz まで', '振幅を 0 まで'],
              answer: 0,
              miss: [null, 'MAP を急に下げると、開いた肺がまたしぼみます。', '周波数は CO₂ のつまみです。',
                '振幅が 0 では、CO₂ が出ていきません。'],
              why: '酸素を先に、MAP はそのあと 1〜2 ずつ。開いた肺をしぼませないように、ゆっくり降ります。'
            }
          },
          {
            say: 'SpO₂ 90〜95% のまま、FiO₂ を 30% 以下に。',
            spot: 'key:fio2', watch: ['SpO₂', 'Pmean'],
            check: function (c) { return c.s.fio2 <= 0.31 && c.e.spo2 >= 90 && c.e.spo2 <= 95; },
            hold: 30,
            why: '酸素は {FiO₂}%、MAP は {MAP}。HFO を降りる日が見えてきました。'
          },
          {
            talk: true, who: 'doc',
            say: '数日のうちに、ふつうの換気に戻します。そのとき使うのは、つむぎちゃん自身の呼吸の合図に合わせる呼吸器です。'
          }
        ]
      }
    ]
  };

  /* ===================== 第13章 自分のリズム（NAVA・NIV-NAVA・HFNC） ===================== */
  /* つむぎちゃんの日齢 5〜7（NAVA → 抜管して NIV-NAVA）と、同じ日のあおい君（HFNC）。
   * NAVA は横隔膜の電気活動 Edi に比例して圧を足す。トリガも吸い終わりも Edi が決める。
   * NAVA レベルを上げると、呼吸中枢が力を抜き、Edi が下がる（Vte はあまり変わらない）。 */
  var NAVA_DAY5 = { ageLabel: '在胎25週 日齢5', weightKg: 0.75,
    compliance: 0.00045, shunt0: 0.18, shuntMin: 0.06, recruitP: 8, recruitK: 2.0, vdAlvFrac: 0.06,
    hco3: 24, hco3Base: 24, paco2: 50, pao2: 60, sedation: 0.2, driveGain: 1.2, maxPmus: 9, map: 36 };

  var CH13 = {
    id: 'ch13', title: '第13章　自分のリズム', tag: 'NAVA・HFNC',
    sub: '横隔膜の声を聞く NAVA から、鼻の NIV-NAVA、HFNC へ。',
    lessons: [

      {
        id: '13-1', title: '横隔膜の声を聞く', minutes: 8,
        scenario: 'micro',
        patient: NAVA_DAY5,
        settings: { mode: 'PC-AC', pinsp: 12, peep: 6, rr: 40, fio2: 0.3, ti: 0.3, navaLevel: 0.5 },
        sedation: 0.2,
        brief: [
          'Edi は横隔膜の電気活動（µV）。胃管の先の電極で測る、呼吸中枢の「吸え」という指令そのもの。',
          'NAVA は Edi に比例した圧を足す。NAVA レベル（cmH₂O/µV）は、Edi 1 µV あたりに足す圧。',
          'トリガも吸い終わりも Edi が決めるので、呼吸器が子どものリズムにぴったり合う。',
          'NAVA レベルを上げると Edi が下がり、Vte はあまり変わらない。Edi peak 5〜15 µV が目安。'
        ],
        points: ['Edi ＝ 呼吸中枢の指令', 'NAVA は Edi に比例して圧を足す',
          'レベルを上げると Edi が下がる。Edi peak 5〜15'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '生まれて 5 日目。つむぎちゃんは HFO を降り、ふつうの換気に戻った。鎮静も浅くなり、自分でも吸おうとしている。'
          },
          {
            talk: true, who: 'scene',
            say: '胃に入っている管が、先に電極のついたものに替わった。画面の端に、見慣れない「Edi」の文字。'
          },
          {
            talk: true, who: 'doc',
            say: 'Edi は横隔膜の電気活動です。脳の呼吸中枢が「吸え」と命じた強さが、そのまま µV（マイクロボルト）で出ます。'
          },
          {
            talk: true, who: 'puku',
            say: '赤ちゃんが、どれだけ吸いたいか分かるってこと？'
          },
          {
            talk: true, who: 'doc',
            say: 'そうです。その Edi に比例して圧を足すのが NAVA。吸いはじめも、吸い終わりも、つむぎちゃんの呼吸中枢が決めます。'
          },
          {
            say: 'モードを NAVA に切り替えてください。',
            spot: 'mode:NAVA',
            event: 'mode:NAVA',
            why: 'NAVA のキーは、NAVA レベルと PEEP、FiO₂。P insp・RR・Ti は、息が止まったときのバックアップ換気の設定です。'
          },
          {
            say: 'Edi peak が出るまで待ちます。',
            spot: 'val:Edi peak', watch: ['Edi peak', 'Edi min', 'PIP', 'RR tot'],
            check: function (c) { return c.m.ediPeak != null && c.e.clock > 20; },
            hold: 15,
            why: 'Edi peak は 1 回の吸気の山、Edi min は吐いているときの谷です。'
          },
          {
            talk: true, who: 'doc',
            say: 'NAVA レベルは、Edi 1 µV あたりに足す圧（cmH₂O/µV）。いまは {NAVA}。手伝いが少ないので、Edi peak が {Edi peak} µV と高めです。'
          },
          {
            say: 'NAVA を 1.5 に上げて、Edi と Vte を見ます。',
            spot: 'key:nava', watch: ['Edi peak', 'Vte', 'PIP', 'RR tot'],
            check: function (c) { return c.s.navaLevel >= 1.45; },
            hold: 40,
            why: 'PIP は上がり、Edi peak は下がりました。Vte はあまり変わっていません。'
          },
          {
            quiz: {
              q: 'NAVA レベルを上げたら Edi peak が下がりました。なぜですか。',
              choices: ['機械が手伝う分、呼吸中枢が力を抜いたから', '電極がずれたから',
                '肺が硬くなったから', '鎮静が深くなったから'],
              answer: 0,
              miss: [null, 'ずれたなら、Edi は急に消えたり乱れたりします。', '肺の硬さは変わっていません。',
                '鎮静は触っていません。'],
              why: '子どもは、必要な量だけ吸おうとします。機械が手伝うほど、自分の力は少なくて済む。Edi はその「がんばり」の目盛りです。'
            }
          },
          {
            talk: true, who: 'doc',
            say: 'Edi peak が 15 µV を超えるなら手伝い不足、5 µV を切るなら手伝いすぎ。その間に入る NAVA レベルを探します。'
          },
          {
            say: 'Edi peak を 5〜15 µV に入れて、保ってください。',
            hint: 'NAVA レベルは 0.5〜2 cmH₂O/µV が目安です。',
            spot: 'key:nava', watch: ['Edi peak', 'Vte', 'SpO₂'],
            check: function (c) { return c.m.ediPeak >= 5 && c.m.ediPeak <= 15 && c.e.spo2 >= 90; },
            hold: 30,
            why: 'つむぎちゃんのがんばりと、機械の手伝いの釣り合いがとれました。'
          }
        ]
      },

      {
        id: '13-2', title: '息が止まっても', minutes: 9,
        scenario: 'micro',
        patient: NAVA_DAY5,
        settings: { mode: 'NAVA', navaLevel: 1.5, peep: 4, fio2: 0.3, pinsp: 12, rr: 30, ti: 0.3 },
        sedation: 0.2,
        brief: [
          'Edi min は吐いているときの横隔膜の緊張。高いのは、肺がしぼまないよう横隔膜がブレーキをかけている印。',
          'Edi min が高ければ PEEP を上げる。肺を PEEP で支えると、横隔膜が休める。',
          '早産児は呼吸中枢が未熟で、息が止まる（無呼吸発作）。Edi が平らになるのが目印。',
          'NAVA は Edi が止まると、設定の P insp・RR でバックアップ換気をする。戻れば NAVA に戻る。'
        ],
        points: ['Edi min が高ければ PEEP を上げる', '無呼吸では Edi が平らになる',
          'バックアップ換気が安全網'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '生まれて 6 日目の夜。つむぎちゃんの呼吸は、速くなったり、間があいたりをくり返している。',
            onStart: function (c) { c.e.p.recruitP = 9; }
          },
          {
            look: ['val:Edi min'],
            talk: true, who: 'doc',
            say: 'Edi min を見てください。吐いているあいだも、横隔膜が {Edi min} µV 働いています。'
          },
          {
            talk: true, who: 'puku',
            say: '吐いてるときなのに、どうして働くの？'
          },
          {
            talk: true, who: 'doc',
            say: '肺がしぼみかけていると、吐ききらないよう横隔膜がブレーキをかけます。PEEP で支えてあげれば、そのブレーキが要らなくなります。'
          },
          {
            say: 'PEEP を上げて、Edi min を 3 µV 未満にしてください。',
            hint: 'PEEP を 1 ずつ。6〜7 が目安です。',
            spot: 'key:peep', watch: ['Edi min', 'Edi peak', 'SpO₂'],
            check: function (c) { return c.m.ediMin != null && c.m.ediMin < 3; },
            hold: 20,
            why: 'Edi min が下がりました。横隔膜が、吐くたびにブレーキをかけなくてよくなりました。'
          },
          {
            talk: true, who: 'scene',
            say: 'そのとき、Edi の線が、すっと平らになった。つむぎちゃんの胸が止まっている。',
            onStart: function (c) { c.e.centralApnea(25); }
          },
          {
            say: '画面の変化を見ます。',
            spot: 'val:Edi peak', watch: ['RR tot', 'SpO₂', 'HR'],
            check: function (c) { return c.e.navaBackup === true; },
            why: 'Edi が止まって 5 秒。呼吸器が、設定の P insp と RR でバックアップ換気を始めました。'
          },
          {
            talk: true, who: 'doc',
            say: '無呼吸発作です。早産の子は呼吸中枢が未熟で、ときどき「吸え」を出し忘れます。だから Edi が平らになる。'
          },
          {
            say: 'つむぎちゃんの呼吸が戻るまで待ちます。',
            watch: ['RR tot', 'SpO₂', 'HR'],
            check: function (c) { return c.e.navaBackup === false && c.e.clock > c.e.apneaUntil + 5; },
            why: 'Edi が戻ると、呼吸器は NAVA に戻りました。バックアップは、止まったときだけの安全網です。'
          },
          {
            quiz: {
              q: 'Edi はしっかり出ているのに、Vte がほとんど入りません。何を疑いますか。',
              choices: ['チューブが痰で詰まっている', '無呼吸発作', '鎮静が深すぎる', 'NAVA レベルが高すぎる'],
              answer: 0,
              miss: [null, '無呼吸なら Edi も平らになります。', '鎮静が深ければ Edi も小さくなります。',
                'レベルが高ければ、Vte はむしろ増えます。'],
              why: '「吸え」は出ているのに空気が入らない。通り道の問題です。Edi が平らか、出ているかで、止まった理由が分かれます。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '無呼吸がくり返すなら、カフェインを確かめます。抜管の前にも欠かせない薬でした。'
          },
          {
            say: 'NAVA を 1.0 に下げ、Edi peak 5〜15 µV を保ちます。',
            hint: 'NAVA レベルを下げても Edi が 15 を超えなければ、つむぎちゃんの力が戻ってきた印です。',
            spot: 'key:nava', watch: ['Edi peak', 'RR tot', 'SpO₂'],
            check: function (c) { return c.s.navaLevel <= 1.05 && c.m.ediPeak >= 5 && c.m.ediPeak <= 15 && c.e.spo2 >= 90; },
            hold: 30,
            why: '少ない手伝いで、自分の力で吸えています。チューブを抜く準備ができてきました。'
          }
        ]
      },

      {
        id: '13-3', title: 'チューブを抜いても', minutes: 8,
        scenario: 'micro',
        patient: { ageLabel: '在胎25週 日齢7', weightKg: 0.78,
          compliance: 0.0005, shunt0: 0.30, shuntMin: 0.15, recruitP: 7, recruitK: 2.0, vdAlvFrac: 0.05,
          hco3: 24, hco3Base: 24, paco2: 50, pao2: 60, sedation: 0.1, driveGain: 1.2, maxPmus: 9, map: 37, leak: 0.35 },
        settings: { mode: 'NAVA', navaLevel: 1.0, peep: 6, fio2: 0.3, pinsp: 12, rr: 30, ti: 0.3 },
        sedation: 0.1,
        brief: [
          'NIV-NAVA は、抜管したあと鼻のマスクやプロングから NAVA を続ける方法。',
          '鼻からは必ず漏れる（リーク）。流量でトリガする呼吸器は、漏れで空振りしたり、勝手に吸気を始めたりする。',
          'Edi は漏れに関係ないので、NIV-NAVA はリークがあっても吸いはじめと吸い終わりがずれない。',
          '鼻からでは Vte は漏れた分だけ少なく出る。Edi と呼吸数、SpO₂ で見る。'
        ],
        points: ['抜管後も NAVA を鼻から続けられる', 'リークがあっても Edi のトリガはずれない',
          'Vte より Edi・呼吸数・SpO₂ を見る'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '生まれて 7 日目の朝。つむぎちゃんの Edi は落ち着き、NAVA レベルは 1 まで下がった。今日、チューブを抜く。'
          },
          {
            talk: true, who: 'doc',
            say: '抜いたあとも、Edi のカテーテルは胃に残します。鼻のマスクから、同じ NAVA を続けられる。NIV-NAVA です。'
          },
          {
            talk: true, who: 'puku',
            say: 'NIV って？'
          },
          {
            talk: true, who: 'doc',
            say: '非侵襲的換気。チューブを入れずに、鼻や顔のマスクから呼吸を支えることです。'
          },
          {
            say: '抜管して、モードを NIV-NAVA にしてください。',
            spot: 'mode:NIV-NAVA',
            event: 'mode:NIV-NAVA',
            why: 'チューブが抜けて、鼻のマスクにつながりました。'
          },
          {
            say: 'リークと Vte を見ます。',
            spot: 'val:Leak', watch: ['Leak', 'Vte', 'Edi peak', 'RR tot'],
            check: function (c) { return c.m.leak > 0.2 && c.m.ediPeak != null && c.e.clock > 15; },
            hold: 15,
            why: '{Leak}% が漏れています。Vte は、肺に入った量より少なく出ます。'
          },
          {
            quiz: {
              q: '鼻からの換気で漏れが多いと、流量でトリガする呼吸器はどうなりますか。',
              choices: ['空振りしたり、勝手に吸気を始めたりする', '何も変わらない',
                'もっと正確になる', '吸気が長くなるだけ'],
              answer: 0,
              miss: [null, '漏れは流量のトリガを狂わせます。', '漏れは雑音です。正確にはなりません。',
                'それだけでは済みません。'],
              why: '漏れた空気を「吸った」と勘違いしたり、本当の吸気を見落としたりします。'
                + 'Edi は漏れに関係ないので、NIV-NAVA は合図がずれません。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '鼻からでは、量で見るのは難しい。Edi peak、呼吸数、SpO₂ で、手伝いが足りているかを見ます。'
          },
          {
            say: 'SpO₂ 90〜95% のまま、Edi peak 5〜15 µV を保ちます。',
            hint: 'Edi が 15 を超えるなら NAVA レベルを上げ、SpO₂ が高ければ FiO₂ を下げます。',
            spot: ['key:nava', 'key:fio2'], watch: ['Edi peak', 'RR tot', 'SpO₂'],
            check: function (c) { return c.m.ediPeak >= 5 && c.m.ediPeak <= 15 && c.e.spo2 >= 90 && c.e.spo2 <= 95; },
            hold: 30,
            why: 'チューブがなくても、つむぎちゃんの合図で呼吸器が動いています。'
          },
          {
            quiz: {
              q: 'NIV-NAVA で Edi peak 25 µV、呼吸数 90 回/分。まず考えることは？',
              choices: ['手伝い不足。NAVA レベルを上げ、悪ければ再挿管も考える', '手伝いすぎ。NAVA レベルを下げる',
                '電極を抜く', 'そのまま様子を見る'],
              answer: 0,
              miss: [null, 'Edi が高いのは、がんばりすぎの印です。', 'Edi は、いちばん大事な目盛りです。',
                'このまま続けば疲れきってしまいます。'],
              why: 'Edi が高く呼吸が速いのは、がんばりすぎ。手伝いを増やし、それでも足りなければチューブに戻ります。'
            }
          }
        ]
      },

      {
        id: '13-4', title: '鼻から流れる風', minutes: 8,
        scenario: 'rds',
        patient: { ageLabel: '在胎28週 日齢21（修正31週）', weightKg: 1.4,
          compliance: 0.0016, shunt0: 0.32, shuntMin: 0.05, recruitP: 4, recruitK: 1.5, vdAlvFrac: 0.04,
          hco3: 24, hco3Base: 24, paco2: 48, pao2: 60, sedation: 0, driveGain: 1.1, maxPmus: 12,
          vco2: 7.6, co: 0.28, map: 38, fatigueLoad: 1.0, fatigueTau: 600 },
        settings: { mode: 'HFNC', hfncFlow: 2, fio2: 0.3 },
        sedation: 0,
        brief: [
          'HFNC（高流量鼻カニュラ）は、温めて加湿したガスを鼻から大きな流量で流す。早産児なら 4〜8 L/分。',
          '流れが鼻と喉の死腔を洗い流し、少しの圧で肺胞を支える。その圧は測れず、流量・口の開き・鼻の隙間で変わる。',
          'カニュラは鼻の穴の半分ほどの太さに。隙間がないと、思わぬ高い圧がかかる。',
          '呼吸を送る機械ではない。無呼吸は助けない。まず刺激、戻らなければバッグで換気する。'
        ],
        points: ['HFNC は温めた大流量で死腔を洗い、肺胞を少し支える', '圧は測れない。カニュラは鼻の穴の半分',
          '無呼吸は助けない'],
        tasks: [
          {
            talk: true, who: 'scene',
            say: '同じ日の午後。隣の保育器のあおい君は、生まれて 3 週。体重は 1,400 g になった。'
          },
          {
            talk: true, who: 'scene',
            say: '鼻の CPAP の当たるところが赤くなっている。今朝から、鼻の管は細くて柔らかいカニュラに替わった。'
          },
          {
            talk: true, who: 'doc',
            say: '高流量鼻カニュラ、HFNC です。温めて加湿したガスを、鼻から大きな流量で流し続けます。鼻にやさしく、抱っこもしやすい。'
          },
          {
            look: ['wave'],
            talk: true, who: 'puku',
            say: 'あれ、波形が出てないよ？'
          },
          {
            talk: true, who: 'doc',
            say: 'HFNC は流すだけの機械なので、圧も換気量も測れません。見るのは呼吸数、SpO₂、それに陥没呼吸や鼻翼呼吸です。'
          },
          {
            look: ['val:RR tot', 'val:SpO₂'],
            talk: true, who: 'doc',
            say: '朝につないだときの流量のままです。早産児なら 4〜8 L/分。この流量では、鼻と喉の死腔が洗いきれていません。'
          },
          {
            say: 'Flow を 6 L/min に上げてください。',
            spot: 'key:hflow', watch: ['RR tot', 'SpO₂', 'tcPCO₂'],
            check: function (c) { return c.s.hfncFlow >= 6; },
            hold: 30,
            why: '呼吸数が落ち着き、SpO₂ が上がりました。流れが死腔を洗い、少しの圧で肺胞を支えています。'
          },
          {
            quiz: {
              q: 'HFNC のカニュラの太さは？',
              choices: ['鼻の穴の半分くらい', '鼻の穴をぴったりふさぐ', '太いほどよい', '細いほど圧が高い'],
              answer: 0,
              miss: [null, 'ふさぐと逃げ道がなくなり、思わぬ高い圧がかかります。', '太いほど隙間がなくなります。',
                '細いと圧は逃げやすくなります。'],
              why: '隙間から余分な流れが逃げるので、圧が上がりすぎません。HFNC の圧は測れないぶん、逃げ道を残しておきます。'
            }
          },
          {
            say: 'FiO₂ を下げて、SpO₂ 90〜95% を 30 秒保ってください。',
            spot: 'key:fio2', watch: ['SpO₂', 'RR tot'],
            check: function (c) { return c.s.fio2 <= 0.29 && c.e.spo2 >= 90 && c.e.spo2 <= 95; },
            hold: 30,
            why: '酸素も下がりました。この流量なら、薄い酸素でも足ります。'
          },
          {
            quiz: {
              q: 'HFNC 中に 20 秒息が止まり、心拍が 80 に。まずすることは？',
              choices: ['体をさすって刺激し、戻らなければバッグで換気する', '流量を上げる', 'FiO₂ を 100% にする', '様子を見る'],
              answer: 0,
              miss: [null, 'HFNC は呼吸を送りません。流量を上げても息は戻りません。',
                '息が止まっていては、酸素は肺に入りません。', '無呼吸と徐脈は待てません。'],
              why: 'HFNC は自分で息をする子を支えるだけ。止まった息は、刺激とバッグで戻します。NAVA のバックアップとの違いです。'
            }
          },
          {
            talk: true, who: 'doc',
            say: '良くなってきたら、流量を 1 L/分ずつ下げていきます。呼吸数と SpO₂ が変わらなければ、次の段へ。'
          },
          {
            say: 'Flow を 4 L/min まで下げ、SpO₂ 90% 以上を保ちます。',
            spot: 'key:hflow', watch: ['SpO₂', 'RR tot'],
            check: function (c) { return c.s.hfncFlow <= 4 && c.e.spo2 >= 90; },
            hold: 30,
            why: 'あおい君は、4 L/分でも落ち着いています。鼻から流れる風だけで、自分の息を続けています。'
          }
        ]
      }
    ]
  };

  var CHAPTERS = [CH1, CH2, CH3, CH4, CH5, CH6, CH7, CH8, CH9, CH10, CH11, CH12, CH13];

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
    if (!t || !t.event) return null;
    if (t.event !== name) {
      /* 違うキーを押したら、なぜ違うかを一言返す（黙って無視すると、押せていないのかと迷う）。 */
      var miss = t.missEvents && t.missEvents[name];
      if (miss) this.feedback = { ok: false, text: miss };
      return null;
    }
    return this.advance(c);
  };

  /** クイズの答え。正解なら進み、誤答なら false を返して解説は出さない。 */
  Runtime.prototype.answer = function (choice, c) {
    var t = this.task();
    if (!t || !t.quiz) return null;
    this.answered = choice;
    if (choice !== t.quiz.answer) {
      this.wrong++;
      var miss = t.quiz.miss && t.quiz.miss[choice];
      this.feedback = { ok: false, text: (miss ? miss + ' ' : '') + 'もう一度考えてみてください。' };
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
    this.enter(c);                 // 場面の onStart（病態を起こすなど）は、読み飛ばしても必ず 1 回起こす
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

  /* 物語のいまの場面。いま進めている課題までで最後のト書き（患者の様子を含む）を返す。
   * 患者情報で「いまの状況」として見せる。セリフが関数のもの（実測値を差し込む）は飛ばす。 */
  function storyNow(lesson, index) {
    var t = lesson.tasks, last = null;
    for (var i = 0; i < t.length && i <= index; i++) {
      if (t[i].talk && (t[i].who === 'scene' || t[i].who === 'pt') && typeof t[i].say === 'string') last = t[i].say;
    }
    return last;
  }

  /* ---- 説明の文から、モニターのどこを見ればよいかを決める ----
   * 会話・クイズ・操作後の解説で「PIP は…」「流量波形が…」と言ったら、画面のその場所を
   * ボタンと同じ光り方で光らせる。文で場所を探させないため。
   * 計測値タイルは見出し（app.js の VALS.k、Swift の Readout.caption）そのままの名前で拾う。
   * 英字の名前は前後が英数字でないときだけ（「SIMV」の中の MV や「Vt」を Vte と取り違えない）。
   * 課題に look: [...] があればそれを優先する（look: [] で光らせない）。
   * iPhone 版 Lessons.swift の monitorSpots(in:) が同じ規則を持つ。片方を変えたらもう片方も。 */
  var MONITOR_VALS = ['PIP', 'Pplat', 'PEEP tot', 'ΔP', 'Vte', 'MV', 'RR tot', 'I:E', 'Cstat', 'Raw',
    'auto-PEEP', 'f/VT', 'SpO₂', 'etCO₂', 'HR', 'ABP mean',
    'Pmean', 'VThf', 'DCO₂', 'tcPCO₂', 'Edi peak', 'Edi min', 'Leak'];
  /* 日本語で呼んだときの言い方。[言い方, タイルの名前] */
  var MONITOR_ALIAS = [['SpO2', 'SpO₂'], ['心拍', 'HR'], ['血圧', 'ABP mean'], ['総 PEEP', 'PEEP tot'],
    ['分時換気量', 'MV'], ['経皮 CO₂', 'tcPCO₂'], ['リーク', 'Leak']];
  /* 波形の段。[言い方, 段] 。どれにも当たらず「波形」とだけ言ったら波形の画面全体。 */
  var MONITOR_LANES = [['圧波形', 'paw'], ['圧の波形', 'paw'], ['気道内圧', 'paw'],
    ['流量', 'flow'], ['換気量波形', 'vol'], ['換気量の波形', 'vol']];

  function wordAt(text, name) {
    var from = 0, i, ascii = /[A-Za-z0-9]/;
    while ((i = text.indexOf(name, from)) >= 0) {
      var before = i > 0 ? text.charAt(i - 1) : '', after = text.charAt(i + name.length);
      var edgeL = !ascii.test(name.charAt(0)) || !ascii.test(before);
      var edgeR = !ascii.test(name.charAt(name.length - 1)) || !(ascii.test(after) || after === '₂');
      if (edgeL && edgeR) return true;
      from = i + 1;
    }
    return false;
  }

  function monitorSpots(text) {
    if (!text) return [];
    var out = [], seen = {};
    function add(s) { if (!seen[s]) { seen[s] = 1; out.push(s); } }
    MONITOR_VALS.forEach(function (k) { if (wordAt(text, k)) add('val:' + k); });
    MONITOR_ALIAS.forEach(function (a) { if (text.indexOf(a[0]) >= 0) add('val:' + a[1]); });
    var lane = false;
    MONITOR_LANES.forEach(function (a) { if (text.indexOf(a[0]) >= 0) { add('lane:' + a[1]); lane = true; } });
    if (!lane && text.indexOf('波形') >= 0) add('wave');
    return out;
  }

  /* 会話・クイズの課題で光らせるもの。text は差し込み前のセリフや設問。 */
  function lookFor(t, text) {
    if (!t) return [];
    if (t.look) return t.look.slice();
    var out = t.spot ? (Array.isArray(t.spot) ? t.spot.slice() : [t.spot]) : [];
    function add(s) { if (out.indexOf(s) < 0) out.push(s); }
    (t.watch || []).forEach(function (k) { add('val:' + k); });     // 帯に出す計測値は画面でも光らせる
    monitorSpots(text).forEach(add);
    return out;
  }

  var api = {
    CHAPTERS: CHAPTERS,
    monitorSpots: monitorSpots,
    lookFor: lookFor,
    MONITOR_VALS: MONITOR_VALS,
    storyNow: storyNow,
    allLessons: allLessons,
    lessonById: lessonById,
    chapterOf: chapterOf,
    nextLessonId: nextLessonId,
    Runtime: Runtime
  };
  root.VentLessons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
