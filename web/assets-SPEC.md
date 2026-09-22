# VentaSim 画像の仕様書（生成画像を差し込むためのリスト）

作業環境に画像生成の手段がないため、ここに書いた画像を Yuichi さんの手元で生成して、
**このスレッドにそのまま添付**してください。ファイル名は下の一覧のとおりにお願いします。
届いた順に組み込みます。全部そろわなくても、あるものから順に差し替わります。

## 使い方の要点

- **英語のプロンプトをそのまま貼る**のがいちばん安定します。日本語注記は意図の説明です。
- 各プロンプトの先頭に、下の **STYLE** をそのまま入れてください（絵柄をそろえるため）。
- キャラクターと UI 部品は **無地の明るい緑（#00FF00）の背景**で出してください。こちらで切り抜きます。
  「透過背景」は生成ツールによって崩れるので使いません。
- サイズは目安です。ChatGPT なら 1024×1024 / 1536×1024 / 1024×1536、Midjourney なら `--ar` で近い比率にしてください。
- 文字は入れないでください（ロゴだけ例外）。文字はこちらでコードから載せます。
- 気に入らないものは何枚でも出し直してかまいません。**同じキャラが同じ顔で出ている**ことがいちばん大事です。
  ChatGPT のように前の画像を参照できるツールなら、みどり先生の 1 枚目を見せながら続きを出してください。

## STYLE（すべてのプロンプトの先頭に貼る）

```
Cute Japanese mobile game illustration, kawaii style, clean thick dark-navy outlines,
soft cel shading with glossy highlights, pastel hospital palette (mint green, peach, cream,
lavender, soft pink), polished 2D vector-like finish, high quality, no text, no watermark.
```

## キャラクターの設定（キャラの絵にはこれも貼る）

```
CHARACTER "Dr. Midori": a friendly young Japanese female doctor, short dark-navy bob haircut,
big round eyes, rosy cheeks, teal-green scrubs under an open white coat, stethoscope around
her neck, chibi-ish proportions (about 3.5 heads tall), full body, standing, facing the viewer.
```

```
CHARACTER "Puku-puku": a cute mascot shaped like a pair of pink lungs with a small trachea on
top, big round sparkling eyes, rosy cheeks, tiny smiling mouth, plump and bouncy, glossy.
```

---

## A. 背景（横長）

### 1. `bg_title_day.png` 必須 — タイトルの背景（夜明けの ICU）
サイズ: 1536×1024（16:9 前後）

```
{STYLE} Wide illustration of a bright, cozy ICU hospital room at sunrise. A large window in
the center shows an orange-to-pink dawn sky over a soft city skyline. Cream walls, light
lavender floor, pink curtains on both sides, an IV pole on the left, a patient monitor on a
stand on the right, a small potted plant. The center and right foreground are empty open
floor (characters will be placed there later). No people, no text, calm and welcoming.
```
注記: 中央〜右の手前を空けてもらうのは、そこに立ち絵を置くためです。

### 2. `bg_title_night.png` あれば — 実機風テーマ用の夜の ICU
サイズ: 1536×1024

```
{STYLE} The same ICU hospital room as before, but at night. Deep navy sky through the
window with a city skyline of lit windows and a soft moon, dim warm indoor lighting,
monitors glowing teal. Same layout: IV pole on the left, monitor on the right, potted
plant, empty open floor in the center and right foreground. No people, no text.
```
注記: 無ければ昼の絵を暗く加工して使います。

### 3. `bg_play.png` あれば — 操作画面の背景（機器の後ろに敷く）
サイズ: 1536×1024

```
{STYLE} Wide, soft-focus illustration of a hospital ICU room interior seen from the
foot of the bed, slightly blurred as if it were a background for a UI panel in front of it.
Muted, low-contrast pastel colors so that bright UI placed on top stays readable. No
people, no text, no equipment in the center.
```
注記: 無ければ 1 をぼかして使います。

---

## B. キャラクター（無地の緑背景で）

### 4. `doctor_sheet.png` 必須 — みどり先生の表情 4 種（1 枚に 2×2）
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

### 6. `patient_bed.png` 必須 — ベッドの患者
サイズ: 1536×1024（横長）

```
{STYLE} A calm adult Japanese patient lying in a hospital bed, eyes closed, peaceful
expression, a breathing tube from the mouth connected to a soft blue hose leading off
to the left, white pillow, light-blue blanket with gentle folds, bed with simple metal
frame, seen from the side at a slight angle from the foot of the bed. Whole bed fully
visible with margin, on a solid flat bright green (#00FF00) background, nothing else.
```
注記: 顔色を変える差分はこちらで加工します（症例の重さで血色を変える）。

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
outline, a cream-colored body, and a pink ribbon-style header band across the top, small
decorative rivets or stitches in the corners, front view, the inside of the body is plain
and empty, no text, centered on a solid flat bright green (#00FF00) background.
```
注記: 中身は空にしておいてください。文字と一覧をこちらで入れます。

### 10. `ui_ribbon.png` 必須 — ロゴを載せるリボン
サイズ: 1536×1024

```
{STYLE} A wide decorative banner ribbon for a game title, soft pink with folded
swallow-tail ends on both sides, glossy highlight along the top, thick dark-navy outline,
front view, perfectly horizontal, the center of the ribbon is empty (no text), centered
on a solid flat bright green (#00FF00) background.
```

### 11. `logo.png` あれば — ロゴ
サイズ: 1536×1024

```
{STYLE} Game title logo with the word "VentaSim" in bold rounded playful letters,
white letters with a thick dark-navy outline and a soft pink-to-orange gradient
shadow, a small cute pink lungs mascot peeking from behind the letters, no other text,
centered on a solid flat bright green (#00FF00) background.
```
注記: 文字が崩れたら不要です。リボンの上に文字をコードで載せます。

### 12. `icons_sheet.png` 必須 — メニューのアイコン 4 種（1 枚に 2×2）
サイズ: 1024×1024

```
{STYLE} Four round game UI icon badges in a 2x2 grid, each a glossy circle with a thick
dark-navy outline and a small highlight: top-left a white play triangle on orange,
top-right three white horizontal lines (list) on blue, bottom-left a white medical cross
on mint green, bottom-right a white question mark on lavender. Even spacing, centered,
on a solid flat bright green (#00FF00) background.
```

---

## D. 操作画面まわり（あれば）

### 13. `hud_patient_frame.png` あれば — 患者の顔を出す丸い窓の飾り枠
サイズ: 1024×1024

```
{STYLE} A round game UI portrait frame, thick dark-navy outline, cream inner ring with a
small mint-green heart-rate icon at the bottom, the center of the circle is empty,
centered on a solid flat bright green (#00FF00) background.
```

### 14. `fx_confetti.png` あれば — 修了演出の紙吹雪
サイズ: 1024×1024

```
{STYLE} Scattered confetti pieces and small sparkles in pink, orange, mint and lavender,
some star-shaped, floating, no background objects, centered on a solid flat bright green
(#00FF00) background.
```

---

## 届いたあとにこちらでやること

- 緑背景の切り抜き、2×2 シートの分割、ボタンと枠の 9 スライス化、患者の顔色差分の生成。
- タイトル・メニュー・ダイアログ・操作画面への差し込み。画像が無い部分は今の絵のまま動きます。
- iPhone 版には同じ PNG をそのまま使います（切り抜き済みのものをアセットとして入れます）。
