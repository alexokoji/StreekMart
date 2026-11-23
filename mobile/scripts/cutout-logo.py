#!/usr/bin/env python3
"""Cuts the flat violet background out of the original StreekMart logo
(assets/brand/logo-original.png) and writes the transparent mark plus every
icon/splash variant Expo needs. Usage: python3 scripts/cutout-logo.py"""
import os
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(root, "assets/brand/logo-original.png")).convert("RGBA")
a = np.array(src).astype(int)
H, W, _ = a.shape
bg = a[4, 4, :3]
d = np.sqrt(((a[:, :, :3] - bg) ** 2).sum(2))
T = 26

# Flood fill the background from the border so enclosed shapes that happen to
# share the background colour (hanger, cart) stay in the logo.
mask = np.zeros((H, W), bool)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        if d[y, x] < T and not mask[y, x]:
            mask[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if d[y, x] < T and not mask[y, x]:
            mask[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and not mask[ny, nx] and d[ny, nx] < T:
            mask[ny, nx] = True; q.append((ny, nx))

# Enclosed shapes drawn in the background colour (inside the handle, the
# hanger, the cart wheels) are negative space too: clear them as well, with a
# tighter tolerance so the logo's own violets are left alone.
mask |= d < 18
alpha = np.where(mask, 0, 255).astype(np.uint8)
# Soften the cut edge: blur the hard alpha slightly, then pull it in a touch
# so no violet halo is left around the shape.
al = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.2))
al = al.point(lambda v: 0 if v < 70 else min(255, int((v - 70) * 255 / 150)))
out = np.array(src); out[:, :, 3] = np.array(al)
mark = Image.fromarray(out.astype(np.uint8), "RGBA")
bbox = mark.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
mark = mark.crop(bbox)
print("mark bbox", bbox, mark.size)

def fit(img, box, canvas=1024, bgcolor=None, dy=0):
    """Place img centred in a canvas, scaled so its longest side is `box`."""
    s = box / max(img.size)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    c = Image.new("RGBA", (canvas, canvas), bgcolor or (0, 0, 0, 0))
    c.alpha_composite(im, ((canvas - im.width) // 2, (canvas - im.height) // 2 + dy))
    return c

A = os.path.join(root, "assets")
mark.save(os.path.join(A, "logo-mark.png"))                       # in-app mark (transparent)
INK = (23, 18, 31, 255)
fit(mark, 620, bgcolor=INK).convert("RGB").save(os.path.join(A, "icon.png"))        # iOS / legacy
fit(mark, 560).save(os.path.join(A, "adaptive-icon.png"))         # Android foreground (safe zone)
Image.new("RGBA", (1024, 1024), INK).save(os.path.join(A, "adaptive-background.png"))
fit(mark, 720).save(os.path.join(A, "splash-icon.png"))           # native splash (on ink)
fit(mark, 800, canvas=256, bgcolor=INK).convert("RGB").resize((256, 256)).save(os.path.join(A, "favicon.png"))
# Android 13 themed icon + notification glyph: single-colour silhouette.
sil = Image.new("RGBA", mark.size, (255, 255, 255, 255)); sil.putalpha(mark.getchannel("A"))
fit(sil, 560).save(os.path.join(A, "monochrome-icon.png"))
print("done")
