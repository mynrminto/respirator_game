#!/usr/bin/env python3
"""成人版の UI 部品を、小児版の UI 部品（web/assets/）の色を塗り替えて作る。
ピンク・オレンジ・紫・クリーム色を、紺・青緑・冷たい白に寄せる。形と 9 スライスの幅はそのまま。

  python3 web/tools/adult_ui.py      # web/assets/ から web/assets-adult/ に書き、manifest.json に足す
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'assets')
DST = os.path.join(HERE, '..', 'assets-adult')

# 色相は 0〜360。rule = (色相の範囲, 最低彩度, 新しい色相, 彩度の倍率, 明度の倍率)
PINK = ((290, 360), 0.12)
PINK2 = ((0, 15), 0.12)
YELLOW = ((35, 65), 0.25)
ORANGE = ((10, 50), 0.25)
PURPLE = ((235, 300), 0.12)
CREAM = ((20, 70), 0.0)   # 彩度の低い暖色（パネルやボタンの地）
GLOSS = ((15, 75), 0.04)  # オレンジの上の黄色っぽい照り

NAVY, TEAL, SLATE = 218, 188, 222

RULES = {
    'ui_ribbon':         [(PINK, NAVY, 1.7, 0.55), (PINK2, NAVY, 1.7, 0.55), (YELLOW, TEAL, 0.7, 1.0)],
    'ui_panel':          [(PINK, NAVY, 1.7, 0.55), (PINK2, NAVY, 1.7, 0.55), (YELLOW, TEAL, 0.7, 1.0), (CREAM, 210, 0.35, 1.0)],
    'ui_button':         [(PURPLE, SLATE, 0.55, 0.85), (CREAM, 210, 0.35, 1.0)],
    'ui_button_primary': [(ORANGE, TEAL, 1.0, 0.78), (GLOSS, TEAL, 0.5, 1.0)],
    'hud_patient_frame': [(YELLOW, TEAL, 0.7, 1.0), (CREAM, 210, 0.35, 1.0)],
    'icon_go':           [(ORANGE, TEAL, 1.0, 0.78), (GLOSS, TEAL, 0.5, 1.0)],
    'icon_about':        [(PURPLE, SLATE, 0.6, 0.8)],
    'icon_course':       [],
}


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    h = h * 60.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def hsv_to_rgb(h, s, v):
    c = v * s; hp = (h / 60.0) % 6; x = c * (1 - np.abs(hp % 2 - 1)); z = np.zeros_like(h)
    conds = [hp < 1, hp < 2, hp < 3, hp < 4, hp < 5, hp >= 5]
    rs = [c, x, z, z, x, c]; gs = [x, c, c, x, z, z]; bs = [z, z, x, c, c, x]
    r = np.select(conds, rs); g = np.select(conds, gs); b = np.select(conds, bs)
    m = v - c
    return np.stack([r + m, g + m, b + m], -1)


def recolor(img, rules):
    a = np.asarray(img.convert('RGBA'), dtype=np.float32) / 255.0
    h, s, v = rgb_to_hsv(a[..., :3])
    done = np.zeros(h.shape, bool)
    nh, ns, nv = h.copy(), s.copy(), v.copy()
    for ((lo, hi), smin), th, sk, vk in rules:
        sel = ~done & (h >= lo) & (h < hi) & (s >= smin) & (v > 0.25)
        if smin == 0.0:
            sel &= (s < 0.25) & (v > 0.7)
        nh[sel] = th; ns[sel] = np.clip(s[sel] * sk, 0, 1); nv[sel] = np.clip(v[sel] * vk, 0, 1)
        done |= sel
    rgb = hsv_to_rgb(nh, ns, nv)
    out = np.concatenate([rgb, a[..., 3:]], -1)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGBA')


def main():
    src_m = json.load(open(os.path.join(SRC, 'manifest.json')))
    mpath = os.path.join(DST, 'manifest.json')
    dst_m = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for name, rules in RULES.items():
        if name not in src_m:
            continue
        if name in dst_m and not dst_m[name].get('recolored'):
            continue   # 成人版用に描いた絵があればそちらを優先
        img = recolor(Image.open(os.path.join(SRC, name + '.png')), rules)
        img.save(os.path.join(DST, name + '.png'), optimize=True)
        entry = dict(src_m[name]); entry['recolored'] = True
        dst_m[name] = entry
        print(name)
    with open(mpath, 'w') as f:
        json.dump(dst_m, f, indent=1, ensure_ascii=False, sort_keys=True)


if __name__ == '__main__':
    main()
