# VentaSim 画像の仕様書（小児科版・生成画像を差し込むためのリスト）

このゲームは **小児科の人工呼吸器シミュレーター** です。患者は新生児〜学童、舞台は NICU / PICU、
いぶき先生は小児科医です。舞台は **集中治療室そのもの**（頭側の医療ガスパネル、多項目モニター、
積み上げた輸液・シリンジポンプ、人工呼吸器、保育器や開放型保育器）で、子ども部屋ではありません。
小児らしさは色味と小物（くまのぬいぐるみ 1 つ、ネームカード）にとどめます。作業環境に画像生成の手段がないため、ここに書いた画像を Yuichi さんの手元で
生成して、**このスレッドにそのまま添付**してください。ファイル名は下の一覧のとおりにお願いします。
届いた順に組み込みます。全部そろわなくても、あるものから順に差し替わります。

## 使い方の要点

- **英語のプロンプトをそのまま貼る**のがいちばん安定します。日本語注記は意図の説明です。
- 各プロンプトの先頭に、下の **STYLE** をそのまま入れてください（絵柄をそろえるため）。
- キャラクターと UI 部品は **無地の明るい緑（#00FF00）の背景**で出してください。こちらで切り抜きます。
  「透過背景」は生成ツールによって崩れるので使いません。
- サイズは目安です。ChatGPT なら 1024×1024 / 1536×1024 / 1024×1536、Midjourney なら `--ar` で近い比率にしてください。
- 文字は入れないでください（ロゴだけ例外）。文字はこちらでコードから載せます。
- 気に入らないものは何枚でも出し直してかまいません。**同じキャラが同じ顔で出ている**ことがいちばん大事です。
  ChatGPT のように前の画像を参照できるツールなら、いぶき先生の 1 枚目を見せながら続きを出してください。

## STYLE（すべてのプロンプトの先頭に貼る）

```
Cute Japanese mobile game illustration for a pediatric intensive-care hospital game, kawaii
style with realistic medical equipment, clean thick dark-navy outlines, soft cel shading with
glossy highlights, pastel clinical palette (mint green, cream, soft blue, lavender, a little
peach and pink as accents), polished 2D vector-like finish, high quality, no text, no
watermark.
```

## キャラクターの設定（キャラの絵にはこれも貼る）

```
CHARACTER "Dr. Midori": a friendly young Japanese female pediatrician, short dark-navy bob
haircut, big round eyes, rosy cheeks, mint-green scrubs printed with tiny stars under an open
white coat, a small teddy-bear badge on the coat, a stethoscope with a yellow star-shaped
chest piece around her neck, chibi-ish proportions (about 3.5 heads tall), full body,
standing, facing the viewer.
```

```
CHARACTER "Puku-puku": a cute, friendly mascot that is a small puffy white cloud, like a
soft round puff of breath, with big round sparkling eyes, rosy cheeks, a tiny smiling mouth,
a little curl of air on top of its head, two tiny stubby arms, plump and bouncy, glossy,
NOT an organ (no lungs, no anatomy), sometimes holding a small yellow star.
```

---

## A. 背景（横長）

**画角の基準**: Yuichi さんが貼ってくれた ICU の写真（`web/ref/icu-bay-reference.png`）と同じ画角にします。
目の高さのやや上から、ベッドの足側の斜めから見た広角。ベッドスペースが真ん中、
**左右の手前に呼吸器やモニターのカートが張り出し、機材が画面を埋める**。奥の壁に窓とカーテン、
床は広く見える。「きれいに片づいた部屋」ではなく「機材で囲まれたベッド」が見えることが要点です。

### 1. `bg_title_day.png` 必須 — タイトルの背景（朝の PICU / NICU のベッドサイド）
サイズ: 1536×1024（16:9 前後）

```
{STYLE} Wide-angle illustration of a real pediatric intensive care unit bay (PICU / NICU)
in the morning, camera slightly above eye level at the foot of the bed space, looking
diagonally across the room. The bed space is in the middle distance: an empty pediatric ICU
bed with white sheets (or a transparent incubator on a stand) surrounded by equipment. In the
LEFT foreground a modern mechanical ventilator on a wheeled cart, touchscreen showing
colorful waveforms, a blue-and-white breathing circuit on a support arm, next to a patient
monitor on a rolling stand showing ECG, SpO2 and respiratory traces in green, cyan and
yellow. In the RIGHT middle distance IV poles stacked with several syringe pumps and infusion
pumps with small glowing screens, and a large dialysis / ECMO-like machine with tubing.
On the back wall two windows with soft morning light, a long medical headwall with
color-coded gas outlets and electrical sockets, beige privacy curtains on rails, a bulletin
board with a few charts. Cables and tubing everywhere, neatly bundled, a warm wood-toned
vinyl floor that stays open in the CENTER foreground (characters will be placed there
later). One small teddy bear on the bed is the only decoration. No people, no text,
busy, high-tech, calm.
```
注記: 中央〜右の手前を空けてもらうのは、そこに立ち絵を置くためです。**子ども部屋にしない**のが要点です。

### 2. `bg_title_night.png` あれば — 実機風テーマ用の夜の PICU / NICU
サイズ: 1536×1024

```
{STYLE} The same pediatric intensive care bay from the same camera angle, but at night. Dim
indoor lighting, the ceiling lights off; the ventilator touchscreen, the monitor and the
syringe pumps glow teal, blue and green and light the equipment around them, a warm night
lamp near the bed, deep navy sky through the back windows. Same layout: ventilator and
monitor in the left foreground, pumps and dialysis machine on the right, bed in the middle
distance, empty floor in the center foreground. No people, no text.
```
注記: 無ければ昼の絵を暗く加工して使います。

### 3. `bg_play.png` あれば — 操作画面の背景（機器の後ろに敷く）
サイズ: 1536×1024

```
{STYLE} Wide-angle, soft-focus illustration of the same pediatric intensive care bay from
the same camera angle, slightly blurred as if it were a background for a UI panel in front
of it: ventilator cart and monitor stand on the left, pumps and dialysis machine on the
right, bed in the middle distance, headwall, curtains and windows behind. Muted,
low-contrast colors so that bright UI placed on top stays readable. No people, no text,
nothing in the center foreground.
```
注記: 無ければ 1 をぼかして使います。

---

## B. キャラクター（無地の緑背景で）

### 4. `doctor_sheet.png` 必須 — いぶき先生の表情 4 種（1 枚に 2×2）
サイズ: 1024×1024（正方形）

```
{STYLE} {CHARACTER "Dr. Midori"} Character expression sheet: the SAME character drawn
4 times in a 2x2 grid, each full body, identical outfit and proportions, on a solid flat
bright green (#00FF00) background with nothing else. Top-left: gentle smile, hands
together. Top-right: big happy smile, one hand raised in a thumbs-up. Bottom-left:
thinking, one hand on her chin, eyebrows slightly raised. Bottom-right: surprised and a
little worried, both hands up, mouth open. Even spacing, each figure fully inside its cell.
```
注記: 4 分割してそれぞれ「ふつう／うれしい／考え中／驚き」として使います。
1 枚で出すのが難しければ、`doctor_normal.png` `doctor_happy.png` `doctor_think.png`
`doctor_alert.png` の 4 枚（各 1024×1536、縦長）でもかまいません。

### 5. `mascot_sheet.png` 必須 — ぷくぷくの表情 4 種（1 枚に 2×2）
サイズ: 1024×1024

```
{STYLE} {CHARACTER "Puku-puku"} Expression sheet: the SAME mascot drawn 4 times in a
2x2 grid on a solid flat bright green (#00FF00) background with nothing else.
Top-left: happy smile. Top-right: excited, sparkling eyes, mouth open. Bottom-left:
surprised with round eyes. Bottom-right: sad, teary eyes, drooping. Even spacing.
```

### 6. 患者（症例ごとに 6 枚）— 症例を選ぶとその絵が出ます

生成ツールが「未成年者の描写」で止まることがあります（実際に止まりました）。原因になりやすいのは
写実的な指定・肌や体つきの描写・薄着の指定なので、患者の絵は **医学教科書の説明図** の書き方にします。
子どもは必ず **病衣を着て毛布で覆われ、見えるのは顔と手先だけ**。写実（photorealistic）にはしません。
共通の書き出しを **PATIENT_STYLE** として先頭に貼ってください（STYLE の代わりに使います）。

```
PATIENT_STYLE: Clean medical textbook illustration for a hospital staff training app,
stylized (not photorealistic), soft cel shading with clear dark outlines, medically accurate
equipment, respectful and calm mood. The patient is fully dressed in a light-blue hospital
gown and covered by a blanket up to the chest; only the face and hands are visible. Camera
from the side of the bed slightly above, the whole bed or incubator fully visible with
margin, on a solid flat bright green (#00FF00) background, nothing else, no text.
```

止まったときの対処:
1. 同じプロンプトをもう一度（誤判定が多い）。
2. 年齢の数字を消して「a young child」「a school-age child」「an infant」にする。
3. それでも止まるなら、下の **代替（人物なし）** を出してください。子どもはこちらで描いて重ねます。

#### 6a. `patient_postop.png` — 小児外科術後（学童）
サイズ: 1536×1024

```
{PATIENT_STYLE} A school-age Japanese child patient resting in a pediatric ICU bed with
raised side rails, eyes closed, calm, drowsy after surgery. An endotracheal tube secured
with tape at the corner of the mouth, connected to a blue-and-white ventilator circuit
leading off to the left. ECG lead wires coming out from under the gown collar, a pulse
oximeter clip on one finger with a small red light, an IV line taped on the back of one
hand. A small teddy bear at the head of the bed.
```

#### 6b. `patient_rds.png` — 早産児の RDS（保育器）
サイズ: 1536×1024

```
{PATIENT_STYLE} A tiny newborn inside a modern transparent acrylic infant incubator, lying
on a white mattress, wrapped snugly in a soft white blanket with a small knitted cap; only
the face is visible, eyes closed, peaceful. A small endotracheal tube secured with tape
above the lip, connected through a port in the incubator wall to a thin ventilator circuit
leading off to the left. Thin monitoring lead wires coming out from under the blanket, a
small pulse-oximeter wrap with a red light on one foot peeking from the blanket. The
incubator sits on a light-gray cabinet base with small wheels, indicator lights and a
control panel with a small display.
```

#### 6c. `patient_bronchiolitis.png` — RSV 細気管支炎（乳児）
サイズ: 1536×1024

```
{PATIENT_STYLE} An infant resting on the back in a hospital crib with white rail bars,
covered by a light blanket up to the chest, wearing a small hospital gown, cheeks a little
flushed as if feverish, eyes closed. A small endotracheal tube secured with tape at the
mouth connected to a small ventilator circuit leading off to the left, a thin feeding tube
taped on the cheek, monitoring lead wires coming out from under the blanket, a
pulse-oximeter wrap with a red light on one foot, an IV line with a small arm board on
one arm.
```

#### 6d. `patient_ards.png` — 小児 ARDS（幼児、重症）
サイズ: 1536×1024

```
{PATIENT_STYLE} A young child patient in a pediatric ICU bed, seriously ill but
peaceful: face pale with a faint bluish tint at the lips, eyes closed, sedated. An
endotracheal tube secured with tape at the corner of the mouth connected to a ventilator
circuit leading off to the left, a thin feeding tube on the cheek, monitoring lead wires
from under the gown collar, a pulse oximeter clip with a red light on one finger, a
dressing with a central line on the side of the neck, an arterial line on the wrist,
tubing from two infusion pumps coming in from the right.
```

#### 6e. `patient_asthma.png` — 喘息重積発作（学童）
サイズ: 1536×1024

```
{PATIENT_STYLE} A school-age Japanese child patient, the largest of the patients, in a
pediatric ICU bed with the head of the bed raised about 30 degrees, eyes closed with a
strained, uncomfortable expression, lips slightly dusky. An endotracheal tube secured
with tape at the corner of the mouth connected to a ventilator circuit leading off to the
left with a small inline nebulizer chamber, monitoring lead wires from under the gown
collar, a pulse oximeter clip with a red light on one finger, an IV line on the forearm,
a blood-pressure cuff on the upper arm over the gown sleeve.
```

#### 6f. `patient_gbs.png` — ギラン・バレー症候群（学童、意識清明）
サイズ: 1536×1024

```
{PATIENT_STYLE} A school-age Japanese child patient in a pediatric ICU bed with the head
slightly raised, awake and alert with a calm gentle expression, eyes open, long dark hair
tied to one side. An endotracheal tube secured with tape at the corner of the mouth
connected to a ventilator circuit leading off to the left, monitoring lead wires from
under the gown collar, a pulse oximeter clip with a red light on one finger, an IV line on
the arm. The arms lie relaxed on the blanket. A picture book and a small teddy bear beside
the child on the bed.
```

#### 代替（人物なし）: `bed_child.png` / `bed_crib.png` / `bed_incubator.png`
サイズ: 各 1536×1024。人物の生成が止まるときはこちらを。子どもはこちらで描いて重ねます。

```
{PATIENT_STYLE} An EMPTY pediatric ICU bed with raised side rails, white pillow and a
light-blue blanket turned down, a ventilator circuit on a support arm leading off to the
left, ECG lead wires and a pulse-oximeter cable resting on the blanket, an IV pole with a
pump beside the bed. No person.
```
```
{PATIENT_STYLE} An EMPTY hospital infant crib with white rail bars, small mattress and a
light blanket, a small ventilator circuit on a support arm leading off to the left,
monitoring cables on the mattress, a small IV pump on a pole beside it. No person.
```
```
{PATIENT_STYLE} An EMPTY modern transparent acrylic infant incubator on a light-gray
cabinet base with wheels, indicator lights and a control panel, a thin ventilator circuit
entering through a port from the left, monitoring cables inside. No person.
```

注記:
- 症例 ID と同じファイル名にしてください（`patient_rds.png` など）。届いた症例から順に差し替わります。
- 顔色の差分（SpO₂ が下がったときの青白さ）は 6 枚ともこちらで加工します。
- 年齢層の 3 枚（`patient_neonate` / `patient_infant` / `patient_child`）でもかまいません。無くても動きます。

---

## C. UI 部品（無地の緑背景で）

### 7. `ui_button.png` 必須 — ふつうのボタンの板
サイズ: 1536×1024 → 板は横長

```
{STYLE} A single game UI button plate, wide rounded rectangle, cream-white face with a
subtle top highlight, thick dark-navy outline, a visible thicker lavender bottom edge
giving it 3D depth, front view, perfectly horizontal, no text, no icon, centered on a
solid flat bright green (#00FF00) background.
```
注記: 角と中央を分けて（9 スライス）好きな幅に伸ばして使います。

### 8. `ui_button_primary.png` 必須 — 主役ボタン（はじめる／確定）
サイズ: 1536×1024

```
{STYLE} The same style of game UI button plate, wide rounded rectangle, but with a warm
orange-to-yellow gradient face, glossy top highlight, thick dark-navy outline, darker
orange bottom edge for depth, front view, no text, no icon, centered on a solid flat
bright green (#00FF00) background.
```

### 9. `ui_panel.png` 必須 — ダイアログの枠
サイズ: 1024×1024

```
{STYLE} A game UI dialog panel frame: a large rounded rectangle with a thick dark-navy
outline, a cream-colored body, and a baby-pink ribbon-style header band across the top with
a tiny yellow star at each end, small decorative stitches in the corners, front view, the
inside of the body is plain and empty, no text, centered on a solid flat bright green
(#00FF00) background.
```
注記: 中身は空にしておいてください。文字と一覧をこちらで入れます。

### 10. `ui_ribbon.png` 必須 — ロゴを載せるリボン
サイズ: 1536×1024

```
{STYLE} A wide decorative banner ribbon for a game title, baby pink with folded
swallow-tail ends on both sides, glossy highlight along the top, thick dark-navy outline,
a small yellow star at each end, front view, perfectly horizontal, the center of the
ribbon is empty (no text), centered on a solid flat bright green (#00FF00) background.
```

### 11. `logo.png` あれば — ロゴ
サイズ: 1536×1024

```
{STYLE} Game title logo with the word "VentaSim" in bold rounded playful letters,
white letters with a thick dark-navy outline and a soft pink-to-yellow gradient
shadow, a small cute puffy white cloud mascot holding a yellow star peeking from behind
the letters, no other text, centered on a solid flat bright green (#00FF00) background.
```
注記: 文字が崩れたら不要です。リボンの上に文字をコードで載せます。

### 12. `icons_sheet.png` 必須 — メニューのアイコン 4 種（1 枚に 2×2）
サイズ: 1024×1024

```
{STYLE} Four round game UI icon badges in a 2x2 grid, each a glossy circle with a thick
dark-navy outline and a small highlight: top-left a white play triangle on orange,
top-right three white horizontal lines (list) on baby blue, bottom-left a white teddy-bear
face on mint green, bottom-right a white question mark on lavender. Even spacing,
centered, on a solid flat bright green (#00FF00) background.
```

---

## D. 操作画面まわり（あれば）

### 13. `hud_patient_frame.png` あれば — 患者の顔を出す丸い窓の飾り枠
サイズ: 1024×1024

```
{STYLE} A round game UI portrait frame, thick dark-navy outline, cream inner ring with a
small mint-green heart-rate icon at the bottom and a tiny yellow star at the top, the
center of the circle is empty, centered on a solid flat bright green (#00FF00) background.
```

### 14. `fx_confetti.png` あれば — 修了演出の紙吹雪
サイズ: 1024×1024

```
{STYLE} Scattered confetti pieces and small sparkles in pink, orange, mint, baby blue and
lavender, some star-shaped and some tiny hearts, floating, no background objects, centered
on a solid flat bright green (#00FF00) background.
```

---

## E. 物語の場面（あれば）— プロローグと章の扉・幕

コースの前後に、主人公（初期研修医）が小児科を回る物語の幕が入りました。下の絵は**無くても動きます**
（今ある PICU の昼と夜の絵で代えています）。届いたものから順に差し替わります。

### 15. `bg_story_corridor.png` あれば — プロローグ：朝の病院の廊下と PICU の入口
サイズ: 1536×1024

```
{STYLE} Wide-angle illustration of a quiet hospital corridor in the early morning, seen
from eye level. At the far end a pair of frosted-glass automatic sliding doors with a
small sign panel above them (leave the sign blank, no letters), a hand-sanitizer station
and an intercom next to the doors. Clean light floor reflecting soft morning sunlight
from tall windows on one side, a few wheeled carts and an empty wheelchair parked along
the wall, pastel-mint wall stripe, calm and a little tense like a first day at work.
Empty floor in the center foreground for characters. No people, no text.
```

### 16. `bg_story_nicu.png` あれば — プロローグ：NICU の保育器の並ぶ一角
サイズ: 1536×1024

```
{STYLE} Wide-angle illustration of a real neonatal intensive care unit (NICU), same camera
style as the PICU background: a row of closed transparent incubators on stands with
small ventilator circuits, patient monitors glowing with green and cyan traces, syringe
pumps stacked on poles, soft dimmed lighting with covers half over some incubators to keep
the babies' environment dark. Inside the nearest incubator only a tiny swaddled shape
under a blanket and a small knitted hat is visible (no face details). Medical headwall
with gas outlets behind. Empty floor in the center foreground. No people, no text.
```
注記: 患者の絵で安全フィルタに引っかかったことがあるので、赤ちゃんは毛布と帽子だけにしています。

### 17. `bg_story_station.png` あれば — 当直の夜のナースステーション
サイズ: 1536×1024

```
{STYLE} Wide-angle illustration of a hospital ICU nurses' station at night: a long
counter with several computer screens and a central monitor showing many small patient
panels with colored waveforms, a wall clock, a telephone, clipboards and a mug, a dim
corridor with ICU bays and glowing equipment visible behind glass partitions. Dark ceiling,
warm desk lamps, cool teal screen light. Empty floor in the center foreground.
No people, no text.
```

### 18. `bg_story_dawn.png` あれば — 夜明け・夕方の PICU（章の幕とエピローグ）
サイズ: 1536×1024

```
{STYLE} The same pediatric intensive care bay as bg_title_day from the same camera angle,
but at dawn: orange and pink early sunlight coming through the back windows, long soft
shadows, the room lights still off, the monitor and ventilator screens glowing softly,
a feeling of relief after a long night. Same layout, empty floor in the center foreground.
No people, no text.
```

### 19. `nurse_normal.png` あれば — PICU の看護師「ななみさん」（全身・縦長）
サイズ: 1024×1536

```
{STYLE} CHARACTER "Nanami": a friendly young Japanese female ICU nurse, shoulder-length
light-brown hair tied in a low ponytail, gentle eyes, navy-blue nurse scrubs with a small
pink heart badge, a penlight and a small notebook in the chest pocket, a watch pinned to
the chest, chibi-ish proportions (about 3.5 heads tall) in the same art style as
Dr. Midori, full body, standing, facing the viewer, one hand holding a clipboard, on a
solid flat bright green (#00FF00) background with nothing else.
```
注記: いぶき先生の 1 枚目を見せながら出すと絵柄がそろいます。無いあいだは「看」の丸い印で出しています。


---

## 届いたあとにこちらでやること

- 緑背景の切り抜き、2×2 シートの分割、ボタンと枠の 9 スライス化、患者 3 種の顔色差分の生成。
- タイトル・メニュー・ダイアログ・操作画面への差し込み。画像が無い部分は今の絵のまま動きます。
- iPhone 版には同じ PNG をそのまま使います（切り抜き済みのものをアセットとして入れます）。
