#!/usr/bin/env python3
"""生成画像を VentaSim のアセットに整える。

使い方:
  python3 web/tools/assets.py <入力フォルダ> [出力フォルダ=web/assets]

入力フォルダに、仕様書（web/assets-SPEC.md）のファイル名で PNG を置くと、
  - 緑背景（#00FF00 付近）を透明に切り抜く
  - 2×2 のシート（doctor_sheet / mascot_sheet / icons_sheet）を 4 枚に分ける
  - ボタン・枠・リボンは余白を落として 9 スライスの内側幅を測る
  - 患者の顔色差分（ok / mid / bad）を作る
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
SINGLES = ['doctor_normal', 'doctor_happy', 'doctor_think', 'doctor_alert',
           'patient_bed', 'ui_button', 'ui_button_primary', 'ui_panel', 'ui_ribbon',
           'logo', 'hud_patient_frame', 'fx_confetti']
BACKGROUNDS = ['bg_title_day', 'bg_title_night', 'bg_play']
NINE = ['ui_button', 'ui_button_primary', 'ui_panel', 'ui_ribbon', 'hud_patient_frame']
MAX_SIDE = 1024   # 立ち絵はこれ以上大きくしない（iPhone のメモリと読み込み時間のため）


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
    out = np.concatenate([np.clip(unmixed, 0, 255), (alpha * 255)[..., None]], axis=-1)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


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


def nine_insets(img):
    """9 スライスの内側幅。角丸と縁取りは短辺の 4 割までに収まる前提で、
    その範囲を四隅として固定し、中央を伸ばす。"""
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
        for name, cell in zip(names, split_grid(img)):
            cell = shrink(autocrop(cell))
            extra = nine_insets(cell) if name in NINE else None
            put(name, cell, extra)

    # 単体
    for name in SINGLES:
        p = find(name)
        if not p:
            continue
        print(name)
        img = shrink(autocrop(cutout(load(p))))
        extra = nine_insets(img) if name in NINE else None
        put(name, img, extra)
        if name == 'patient_bed':
            put('patient_bed_mid', tone_variant(img, 'mid'))
            put('patient_bed_bad', tone_variant(img, 'bad'))

    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False, sort_keys=True)
    print('manifest:', manifest_path, len(manifest), 'entries')


if __name__ == '__main__':
    main()
