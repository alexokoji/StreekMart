#!/usr/bin/env python3
"""Writes the StreekMart brand SVGs (app icon, adaptive foreground, mono,
splash mark) into assets/brand/. The serif "S" is the Instrument Serif glyph
converted to a path, so the SVGs are self-contained. Render to PNG with
scripts/brand-render.mjs."""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
font = TTFont(os.path.join(root, "node_modules/@expo-google-fonts/instrument-serif/400Regular/InstrumentSerif_400Regular.ttf"))
gs = font.getGlyphSet()
pen = SVGPathPen(gs)
gs[font.getBestCmap()[ord("S")]].draw(pen)
S_PATH = pen.getCommands()
# Glyph bounds (font units): x 41..377, y -9..730. Scale so S is ~330px tall.
s = 330 / 739
S_X = 512 - ((41 + 377) / 2) * s
S_Y = 604 - 165 + 730 * s

CREAM, INK, VIOLET, VIOLET_D, GOLD = "#F6F3ED", "#17121F", "#5B21B6", "#2B1760", "#F2C14E"

BAG = "M316 372 H708 Q732 372 734 396 L772 790 Q776 836 730 836 H294 Q248 836 252 790 L290 396 Q292 372 316 372 Z"
HANDLE = "M392 376 C392 236 632 236 632 376"


def mark(body=CREAM, letter=VIOLET, rivet=GOLD, handle=CREAM):
    return f"""
  <path d="{HANDLE}" fill="none" stroke="{handle}" stroke-width="46" stroke-linecap="round"/>
  <path d="{BAG}" fill="{body}"/>
  <path d="{S_PATH}" fill="{letter}" transform="translate({S_X:.2f} {S_Y:.2f}) scale({s:.5f} {-s:.5f})"/>
  <circle cx="392" cy="376" r="21" fill="{rivet}"/>
  <circle cx="632" cy="376" r="21" fill="{rivet}"/>"""


def svg(inner, defs=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">{defs}{inner}\n</svg>\n'


BG_DEFS = f"""
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6D28D9"/><stop offset="0.55" stop-color="{VIOLET_D}"/><stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.22" cy="0.18" r="0.7">
      <stop offset="0" stop-color="#A78BFA" stop-opacity="0.45"/><stop offset="1" stop-color="#A78BFA" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="64" height="64" patternUnits="userSpaceOnUse">
      <circle cx="32" cy="32" r="5" fill="{CREAM}" fill-opacity="0.07"/>
    </pattern>
  </defs>"""

# Full-bleed icon (iOS / legacy). Mark shifted up slightly to centre optically.
icon = svg(f"""
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#dots)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g transform="translate(0 -30)">{mark()}</g>""", BG_DEFS)

# Android adaptive foreground: transparent, mark inside the 66% safe zone.
fg_t = "translate(512 512) scale(0.72) translate(-512 -543)"
foreground = svg(f'\n  <g transform="{fg_t}">{mark()}</g>')

# Adaptive background (gradient + dots only).
adaptive_bg = svg("""
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#dots)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>""", BG_DEFS)

# Android 13 themed icon + notification glyph: single colour silhouette.
mono = svg(f"""
  <defs><mask id="m"><rect width="1024" height="1024" fill="black"/>
    <g transform="{fg_t}">
      <path d="{HANDLE}" fill="none" stroke="white" stroke-width="46" stroke-linecap="round"/>
      <path d="{BAG}" fill="white"/>
      <path d="{S_PATH}" fill="black" transform="translate({S_X:.2f} {S_Y:.2f}) scale({s:.5f} {-s:.5f})"/>
    </g></mask></defs>
  <rect width="1024" height="1024" fill="white" mask="url(#m)"/>""")

# Splash mark (transparent), bigger than the adaptive foreground.
splash_mark = svg(f'\n  <g transform="translate(512 512) scale(0.95) translate(-512 -543)">{mark()}</g>')

out = os.path.join(root, "assets", "brand")
os.makedirs(out, exist_ok=True)
for name, content in [
    ("icon.svg", icon), ("adaptive-foreground.svg", foreground), ("adaptive-background.svg", adaptive_bg),
    ("monochrome.svg", mono), ("splash-mark.svg", splash_mark),
]:
    open(os.path.join(out, name), "w").write(content)
print("wrote", out)
