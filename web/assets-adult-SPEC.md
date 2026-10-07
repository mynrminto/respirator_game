# VentaSim 成人版 画像の仕様書（おとなの人工呼吸器シミュレーター）

成人版の舞台は **大学病院の ICU（集中治療部）**、患者は 29〜78 歳の成人 6 人、いぶき先生は集中治療科の指導医です。
こども版の絵（ちびキャラ、パステル、くまのぬいぐるみ、キリンのポスター）は使いません。
成人版は `web/assets-adult/` を見ます。ここに無い絵は、コードで描いた仮の絵（くまなし）で動きます。
ボタン・枠・リボンなど版に関係ない UI 部品は、こども版のものを使い回します（作り直し不要）。

作業環境に画像生成の手段がないため、下のプロンプトをお手元（ChatGPT など）で生成して、
**このスレッドにそのまま添付**してください。ファイル名は一覧のとおりにお願いします。届いた分から差し替えます。

## 使い方の要点

- 英語のプロンプトをそのまま貼ってください。各プロンプトの先頭に **STYLE** を入れます。
- キャラクターは **無地の明るい緑（#00FF00）の背景**で出してください。こちらで切り抜きます。
- 文字は入れないでください。
- いちばん大事なのは **同じキャラが同じ顔で出ていること**。前の画像を参照できるツールなら、
  いぶき先生の 1 枚目を見せながら続きを出してください。

## STYLE（すべてのプロンプトの先頭に貼る）

```
Japanese mobile game illustration for an adult intensive care unit (ICU) training game for
young doctors. Clean modern anime style with ADULT proportions (about 7 heads tall), not
chibi, not childish. Realistic, accurate medical equipment. Crisp dark outlines, soft cel
shading, calm clinical palette (navy, deep teal, white, cool gray, a little warm amber as an
accent). Professional, calm and slightly serious mood, like a medical drama. No toys, no
stuffed animals, no cartoon decorations, no text, no watermark.
```

## キャラクターの設定（キャラの絵にはこれも貼る）

```
CHARACTER "Dr. Ibuki": a calm, competent Japanese female intensive care physician in her
early thirties, dark hair tied back in a low ponytail with a few loose strands, intelligent
eyes, light natural makeup, navy-blue scrubs under an open white coat, a hospital ID badge
clipped to the coat pocket, a dark stethoscope around her neck, a pen and a penlight in the
breast pocket, slim adult proportions (about 7 heads tall), full body, standing, facing the
viewer.
```

```
CHARACTER "Puku-puku": a small spirit born from a breath, drawn as a soft translucent white
wisp of air with a gentle swirl at the top, two simple dark dot eyes and a tiny mouth,
floating, minimal and elegant (not chubby, no blush stickers, no arms), faint cool-blue glow
at the edges, about the size of a fist next to an adult.
```
注記: ぷくぷくは成人版でも出しますが、丸くてかわいいマスコットから「息のかたまり」程度の控えめな姿にします。

---

## A. 背景（横長、1536×1024）

**画角**: こども版と同じ（ベッドの足側の斜めから、目の高さのやや上の広角。左手前に呼吸器とモニター、
右に輸液ポンプの柱、奥に窓とカーテン、手前中央は立ち絵のために空ける）。

### 1. `bg_title_day.png` 必須 — タイトルの背景（朝の成人 ICU）

```
{STYLE} Wide-angle illustration of a real adult intensive care unit bay in a Japanese
university hospital in the morning, camera slightly above eye level at the foot of the bed
space, looking diagonally across the room. In the middle distance an empty full-size
electric ICU bed with side rails, white sheets and the head raised 30 degrees. In the LEFT
foreground a modern mechanical ventilator on a wheeled cart with a touchscreen showing
waveforms and a breathing circuit on a support arm, next to a large patient monitor on a
ceiling-mounted boom showing ECG, SpO2, arterial pressure and respiratory traces. On the
RIGHT, IV poles stacked with syringe pumps and infusion pumps, a dialysis machine, a crash
cart. Back wall: a medical headwall with color-coded gas outlets, a large window with
morning light, gray privacy curtains on ceiling rails, a sink and a hand-sanitizer
dispenser. Gray vinyl floor that stays open in the CENTER foreground. Plain walls, no
posters, no toys. No people, no text. Busy, high-tech, calm.
```

### 2. `bg_title_night.png` あれば — 夜の ICU

```
{STYLE} The same adult ICU bay from the same camera angle at night: ceiling lights off, the
ventilator, monitor and pumps glowing teal, blue and green and lighting the equipment around
them, a small reading light above the bed, dark navy sky with city lights through the
window. Same layout, empty floor in the center foreground. No people, no text.
```

### 3. `bg_play.png` あれば — 操作画面の背景

```
{STYLE} The same adult ICU bay from the same camera angle, soft-focus and slightly blurred
like a background behind a UI panel, muted low-contrast colors. No people, no text,
nothing in the center foreground.
```

### 4〜6. 物語の場面（あれば）

`bg_story_corridor.png` — プロローグ：朝の病院の廊下と ICU の入口
```
{STYLE} Wide-angle illustration of a quiet university hospital corridor in the early
morning seen from eye level. At the far end frosted-glass automatic sliding doors to the
ICU with a blank sign panel above them, a hand-sanitizer station and an intercom beside the
doors. Polished floor reflecting morning sunlight from tall windows, a stretcher and a
wheelchair parked along the wall, a hint of tension like a first day at work. Empty floor in
the center foreground. No people, no text.
```

`bg_story_station.png` — 当直の夜のナースステーション
```
{STYLE} Wide-angle illustration of an adult ICU nurses' station at night: a long counter
with computer screens and a central monitor showing many patient panels with colored
waveforms, a wall clock, a telephone, charts and a coffee mug, a dim corridor with ICU bays
and glowing equipment behind glass partitions. Warm desk lamps and cool teal screen light.
Empty floor in the center foreground. No people, no text.
```

`bg_story_dawn.png` — 夜明けの ICU（章の幕とエピローグ）
```
{STYLE} The same adult ICU bay as bg_title_day from the same camera angle at dawn: orange
and pink early sunlight through the window, long soft shadows, room lights still off,
screens glowing softly, a feeling of relief after a long night. Same layout, empty floor in
the center foreground. No people, no text.
```

---

## B. キャラクター（無地の緑背景で）

### 7. `doctor_sheet.png` 必須 — いぶき先生の表情 4 種（1024×1024、2×2）

```
{STYLE} {CHARACTER "Dr. Ibuki"} Character expression sheet: the SAME woman drawn 4 times in
a 2x2 grid, each full body, identical outfit and proportions, on a solid flat bright green
(#00FF00) background with nothing else. Top-left: calm gentle smile, hands relaxed. Top-right:
warm confident smile, a small nod, one hand giving a light thumbs-up. Bottom-left: thinking,
one hand on her chin, looking at an imaginary monitor. Bottom-right: alert and focused, eyes
wide, one hand raised as if saying "wait". Even spacing, each figure fully inside its cell.
```
注記: 1 枚で難しければ `doctor_normal` `doctor_happy` `doctor_think` `doctor_alert` の 4 枚（各 1024×1536、縦長）でもかまいません。

### 8. `mascot_sheet.png` 必須 — ぷくぷくの表情 4 種（1024×1024、2×2）

```
{STYLE} {CHARACTER "Puku-puku"} Expression sheet: the SAME wisp drawn 4 times in a 2x2 grid
on a solid flat bright green (#00FF00) background with nothing else. Top-left: calm content.
Top-right: excited, swirl spinning, eyes bright. Bottom-left: startled, eyes wide.
Bottom-right: sad, drooping. Even spacing.
```

### 9. `nurse_normal.png` あれば — 看護師ななみさん（1024×1536、縦長）

```
{STYLE} CHARACTER "Nanami": an experienced Japanese female ICU nurse in her late twenties,
light-brown hair in a neat low bun, kind but sharp eyes, navy-blue nurse scrubs, a penlight
and a small notebook in the chest pocket, a watch pinned to the chest, adult proportions in
the same art style as Dr. Ibuki, full body, standing, facing the viewer, holding a
clipboard, on a solid flat bright green (#00FF00) background with nothing else.
```

---

## C. 患者（症例ごとに 6 枚、1536×1024）

共通の書き出し **PATIENT_STYLE**（STYLE の代わりに先頭へ）:
```
PATIENT_STYLE: Clean medical textbook illustration for a hospital staff training app,
stylized (not photorealistic), soft cel shading with clear dark outlines, medically accurate
equipment, respectful and calm mood. An adult patient in a full-size ICU bed, dressed in a
light-blue hospital gown and covered by a blanket up to the chest; only the face, neck and
hands are visible. Camera from the side of the bed slightly above, the whole bed fully
visible with margin, on a solid flat bright green (#00FF00) background, nothing else, no text.
```
顔色の差分（SpO₂ が落ちたときの青白さ）はこちらで加工します。

`patient_adult_postop.png` — 佐藤さん（68 歳男性、腹膜炎術後・敗血症性ショック）
```
{PATIENT_STYLE} A 68-year-old Japanese man with short gray hair, sedated, eyes closed. An
oral endotracheal tube secured with a tube holder, connected to a ventilator circuit leading
off to the left, a nasogastric tube taped to the nose, a central line dressing on the right
side of the neck, an arterial line on the wrist, ECG leads and a pulse oximeter on one
finger, an abdominal drain tube coming out from under the blanket to a bag hanging on the bed.
```

`patient_adult_chf.png` — 鈴木さん（78 歳女性、急性心不全）
```
{PATIENT_STYLE} A 78-year-old Japanese woman with short white hair, the head of the bed
raised to 45 degrees, eyes closed, sedated. An oral endotracheal tube connected to a
ventilator circuit leading off to the left, ECG leads, a pulse oximeter on one finger, a
urinary catheter bag hanging on the bed frame, an IV line with a syringe pump.
```

`patient_adult_copd.png` — 田中さん（72 歳男性、COPD 急性増悪）
```
{PATIENT_STYLE} A thin 72-year-old Japanese man with sparse gray hair and a slightly barrel
shaped chest under the gown, eyes closed, sedated. An oral endotracheal tube connected to a
ventilator circuit leading off to the left with a small inline nebulizer, ECG leads, a pulse
oximeter on one finger, an IV line on the forearm.
```

`patient_adult_ards.png` — 山本さん（54 歳女性、ARDS、重症）
```
{PATIENT_STYLE} A 54-year-old Japanese woman with shoulder-length dark hair, seriously ill
but peaceful, face pale with a faint bluish tint at the lips, eyes closed, deeply sedated.
An oral endotracheal tube connected to a ventilator circuit leading off to the left, a
nasogastric tube, a central line dressing on the neck, an arterial line on the wrist,
tubing from several infusion pumps coming in from the right.
```

`patient_adult_asthma.png` — 高橋さん（29 歳女性、重症喘息）
```
{PATIENT_STYLE} A 29-year-old Japanese woman with long dark hair tied to one side, head of
the bed raised 30 degrees, eyes closed with a strained expression, sedated. An oral
endotracheal tube connected to a ventilator circuit leading off to the left with an inline
nebulizer chamber, ECG leads, a pulse oximeter on one finger, a blood-pressure cuff on the
upper arm, an IV line on the forearm.
```

`patient_adult_gbs.png` — 伊藤さん（45 歳男性、ギラン・バレー、意識清明）
```
{PATIENT_STYLE} A 45-year-old Japanese man with short black hair and light stubble, head of
the bed slightly raised, awake and alert with a calm expression, eyes open. An oral
endotracheal tube connected to a ventilator circuit leading off to the left, ECG leads, a
pulse oximeter on one finger, an IV line on the arm, arms resting on the blanket, a small
letter board for communication on the bed.
```

---

## D. アイコン（あれば）

`icon_cases.png` — 「症例で練習」のアイコン（こども版はくまの顔なので差し替え）
```
{STYLE} A round glossy game UI icon badge with a thick dark-navy outline: a white clipboard
with a small heartbeat line on a deep-teal circle, centered on a solid flat bright green
(#00FF00) background.
```

---

## 届いたあとにこちらでやること

- `python3 web/tools/assets.py <届いた画像のフォルダ> web/assets-adult` で切り抜き・分割・顔色差分を作る。
- 成人版の公開版を差し替える。画像が無い部分はコードで描いた仮の絵のまま動きます。

---

## 変更（2026-10-07）: 上級医を男性に

いぶき先生を、明るくて優しい 30 代半ばの男性に描き直す。差し替えるのは `doctor_sheet.png`（または `doctor_normal/happy/think/alert`）だけ。
名前と台詞はそのまま（性別の決まる言い回しは無い）。コピー用のプロンプトは `web/doctor-male-brief.html`。

```
CHARACTER "Dr. Ibuki": a cheerful, kind Japanese male intensive care physician in his
mid-thirties, short slightly tousled dark-brown hair, warm friendly eyes with faint smile lines, an
easy open smile, clean-shaven, navy-blue scrubs under an open white coat with the sleeves rolled up
to the forearms, a hospital ID badge clipped to the coat pocket, a dark stethoscope around his neck,
a pen and a penlight in the breast pocket, white sneakers, tall with a relaxed and approachable
posture, adult proportions (about 7 heads tall), full body, standing, facing the viewer.
```
表情は女性版と同じ 4 種（ふだん・うれしい・考える・注意）。ななみさんの画像を参照として添付して絵柄をそろえる。
