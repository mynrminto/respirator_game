#!/usr/bin/env python3
"""生成画像を VentaSim のアセットに整える。

使い方:
  python3 web/tools/assets.py <入力フォルダ> [出力フォルダ=web/assets]

入力フォルダに、仕様書（web/assets-SPEC.md）のファイル名で PNG を置くと、
  - 緑背景（#00FF00 付近）を透明に切り抜く
  - 2×2 のシート（doctor_sheet / mascot_sheet / icons_sheet）を 4 枚に分ける
  - ボタン・枠・リボンは余白を落として 9 スライスの内側幅を測る
  - 患者（新生児・乳児・学童）の顔色差分（ok / mid / bad）を作る
  - assets/manifest.json に一覧を書く
を行う。無いファイルは飛ばすので、そろった分だけ何度でも実行できる。
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

SHEETS = {
    'doctor_sheet': ['doctor_normal', 'doctor_happy', 'doctor_think', 'doctor_alert'],
    'mascot_sheet': ['mascot_happy', 'mascot_excited', 'mascot_alert', 'mascot_sad'],
    'icons_sheet': ['icon_go', 'icon_course', 'icon_cases', 'icon_about'],
}
# 単体で来てもよいもの（シートの代わり）
PATIENTS = ['patient_postop', 'patient_rds', 'patient_bronchiolitis', 'patient_ards', 'patient_asthma', 'patient_gbs',
            'patient_neonate', 'patient_infant', 'patient_child', 'patient_bed',
            'patient_adult_postop', 'patient_adult_chf', 'patient_adult_copd', 'patient_adult_ards', 'patient_adult_asthma',
            'patient_adult_gbs']
SINGLES = ['doctor_normal', 'doctor_happy', 'doctor_think', 'doctor_alert'] + PATIENTS + ['ui_button', 'ui_button_primary', 'ui_panel', 'ui_ribbon',
           'logo', 'hud_patient_frame', 'fx_confetti', 'nurse_normal', 'icon_cases']
BACKGROUNDS = ['bg_title_day', 'bg_title_night', 'bg_play',
               'bg_story_corridor', 'bg_story_nicu', 'bg_story_station', 'bg_story_dawn']
NINE = ['ui_button', 'ui_button_primary', 'ui_panel', 'ui_ribbon', 'hud_patient_frame']
MAX_SIDE = 1024   # 立ち絵はこれ以上大きくしない（iPhone のメモリと読み込み時間のため）
PATIENT_SIDE = 768  # 患者は小さく出すので、顔色差分 ×3 のぶん軽くする


def load(path):
    return Image.open(path).convert('RGBA')


def guess_bg(img):
    """四隅の平均を背景色とみなす。緑でもマゼンタでも白でも同じ扱い。"""
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    h, w, _ = a.shape
    k = max(4, min(h, w) // 40)
    corners = np.concatenate([a[:k, :k].reshape(-1, 3), a[:k, -k:].reshape(-1, 3),
                              a[-k:, :k].reshape(-1, 3), a[-k:, -k:].reshape(-1, 3)])
    return corners.mean(axis=0)


def cutout(img, lo=70, hi=150):
    """背景色からの距離で透明度を決める。距離 lo 以下は透明、hi 以上は不透明、
    あいだは縁として半透明にし、混ざった背景色を取り除く（unmix）。"""
    bg = guess_bg(img)
    rgba = np.asarray(img, dtype=np.float32)
    rgb = rgba[..., :3]
    d = np.sqrt(((rgb - bg) ** 2).sum(axis=-1))
    alpha = np.clip((d - lo) / float(hi - lo), 0.0, 1.0)
    alpha *= rgba[..., 3] / 255.0
    # 半透明の縁から背景色の混ざりを引く: c = (c_obs - bg * (1 - a)) / a
    a3 = alpha[..., None]
    safe = np.where(a3 > 0.02, a3, 1.0)
    unmixed = np.where(a3 > 0.02, (rgb - bg * (1 - a3)) / safe, rgb)
    # 緑背景のとき、半透明の縁（光のにじみなど）に残る緑かぶりを抑える。不透明な部分の緑はそのまま。
    if bg[1] > bg[0] + 60 and bg[1] > bg[2] + 60:
        g_cap = np.maximum(unmixed[..., 0], unmixed[..., 2])
        edge = alpha < 0.98
        unmixed[..., 1] = np.where(edge, np.minimum(unmixed[..., 1], g_cap), unmixed[..., 1])
    out = np.concatenate([np.clip(unmixed, 0, 255), (alpha * 255)[..., None]], axis=-1)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def despill(img):
    """緑を含まない絵（ぷくぷく）向け: 不透明な部分まで含めて緑かぶりを抑える（G を R・B の大きいほうまでに）。"""
    a = np.array(img)
    a[..., 1] = np.minimum(a[..., 1], np.maximum(a[..., 0], a[..., 2]))
    return Image.fromarray(a, 'RGBA')


def drop_edge_bits(img, frac=0.05):
    """シートを 4 分割したとき、隣のマスからはみ出してきた小さな切れ端（マスの縁に触れる小さな塊）を消す。"""
    a = np.asarray(img)[..., 3] > 8
    h, w = a.shape
    seen = np.zeros_like(a)
    comps = []
    for y0, x0 in zip(*np.nonzero(a)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]; seen[y0, x0] = True; pts = []; edge = False
        while stack:
            y, x = stack.pop(); pts.append((y, x))
            if y == 0 or x == 0 or y == h - 1 or x == w - 1:
                edge = True
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; stack.append((yy, xx))
        comps.append((len(pts), edge, pts))
    if not comps:
        return img
    big = max(c[0] for c in comps)
    out = np.array(img)
    for n, edge, pts in comps:
        if edge and n < big * frac:
            ys, xs = zip(*pts)
            out[list(ys), list(xs), 3] = 0
    return Image.fromarray(out, 'RGBA')


def autocrop(img, pad=4):
    bbox = img.getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img.width, r + pad); b = min(img.height, b + pad)
    return img.crop((l, t, r, b))


def shrink(img, max_side=MAX_SIDE):
    if max(img.size) <= max_side:
        return img
    k = max_side / float(max(img.size))
    return img.resize((max(1, int(img.width * k)), max(1, int(img.height * k))), Image.LANCZOS)


def split_grid(img, cols=2, rows=2):
    cw, ch = img.width // cols, img.height // rows
    cells = []
    for r in range(rows):
        for c in range(cols):
            cells.append(img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
    return cells


# 9 スライスの内側幅（画像の幅・高さに対する割合）。無いものは短辺の 4 割。
NINE_FRAC = {
    # 上のリボン帯ごと角として固定し、本体だけ伸ばす。下は角の飾り縫いを含める。
    'ui_panel': {'top': 0.30, 'right': 0.11, 'bottom': 0.19, 'left': 0.11},
    # 両端の燕尾を固定して真ん中だけ伸ばす。
    'ui_ribbon': {'top': 0.40, 'right': 0.13, 'bottom': 0.40, 'left': 0.13},
}


def nine_insets(img, name=None):
    """9 スライスの内側幅。角丸と縁取りは短辺の 4 割までに収まる前提で、
    その範囲を四隅として固定し、中央を伸ばす。"""
    f = NINE_FRAC.get(name)
    if f:
        w, h = img.size
        return {'left': int(w * f['left']), 'right': int(w * f['right']),
                'top': int(h * f['top']), 'bottom': int(h * f['bottom'])}
    s = int(min(img.size) * 0.4)
    return {'left': s, 'right': s, 'top': s, 'bottom': s}


def tone_variant(img, kind):
    """患者の顔色差分。mid は少し血色を落とし、bad は青白くする。"""
    if kind == 'ok':
        return img
    rgb = img.convert('RGB')
    a = img.split()[3]
    if kind == 'mid':
        rgb = ImageEnhance.Color(rgb).enhance(0.8)
        rgb = ImageEnhance.Brightness(rgb).enhance(0.97)
    else:
        rgb = ImageEnhance.Color(rgb).enhance(0.55)
        r, g, b = rgb.split()
        b = b.point(lambda v: min(255, int(v * 1.08 + 6)))
        r = r.point(lambda v: int(v * 0.94))
        rgb = Image.merge('RGB', (r, g, b))
    out = rgb.convert('RGBA')
    out.putalpha(a)
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'assets')
    os.makedirs(dst, exist_ok=True)
    manifest_path = os.path.join(dst, 'manifest.json')
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            manifest = json.load(f)

    def put(name, img, extra=None):
        path = os.path.join(dst, name + '.png')
        img.save(path, optimize=True)
        entry = {'w': img.width, 'h': img.height}
        if extra:
            entry.update(extra)
        manifest[name] = entry
        print('  ->', name, img.size, extra or '')

    def find(name):
        for ext in ('.png', '.PNG', '.jpg', '.jpeg', '.webp'):
            p = os.path.join(src, name + ext)
            if os.path.exists(p):
                return p
        return None

    # 背景はそのまま（縮小だけ）
    for name in BACKGROUNDS:
        p = find(name)
        if not p:
            continue
        print(name)
        img = load(p)
        if max(img.size) > 1600:
            k = 1600 / float(max(img.size))
            img = img.resize((int(img.width * k), int(img.height * k)), Image.LANCZOS)
        if name == 'bg_play':
            img = img.filter(ImageFilter.GaussianBlur(2))
        put(name, img.convert('RGB').convert('RGBA'))

    # シート
    for sheet, names in SHEETS.items():
        p = find(sheet)
        if not p:
            continue
        print(sheet)
        img = cutout(load(p))
        if sheet == 'mascot_sheet':
            img = despill(img)
        for name, cell in zip(names, split_grid(img)):
            cell = shrink(autocrop(drop_edge_bits(cell)))
            extra = nine_insets(cell, name) if name in NINE else None
            put(name, cell, extra)

    # 単体
    for name in SINGLES:
        p = find(name)
        if not p:
            continue
        print(name)
        img = shrink(autocrop(cutout(load(p))), PATIENT_SIDE if name in PATIENTS else MAX_SIDE)
        extra = nine_insets(img, name) if name in NINE else None
        put(name, img, extra)
        if name in PATIENTS:
            put(name + '_mid', tone_variant(img, 'mid'))
            put(name + '_bad', tone_variant(img, 'bad'))

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False, sort_keys=True)
    print('manifest:', manifest_path, len(manifest), 'entries')


if __name__ == '__main__':
    main()
