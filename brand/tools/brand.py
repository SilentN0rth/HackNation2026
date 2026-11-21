"""e-Formularze – logo (koncepcja A) jako SVG z napisem zamienionym na krzywe (Inter, SIL OFL 1.1)."""
import itertools, pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

import os
FONT_DIR = pathlib.Path(os.environ.get("INTER_WOFF_DIR", "fontsource-inter/files"))  # npm pack @fontsource/inter@5
_fonts = {}
_ids = itertools.count(1)


def _font(weight):
    if weight not in _fonts:
        _fonts[weight] = [TTFont(FONT_DIR / f"inter-{sub}-{weight}-normal.woff") for sub in ("latin", "latin-ext")]
    return _fonts[weight]


def text_path(s, size, x, baseline, weight=700, tracking=-0.02):
    """Zwraca (d, szerokość) dla tekstu zamienionego na krzywe."""
    fonts = _font(weight)
    upm = fonts[0]["head"].unitsPerEm
    sc = size / upm
    d, cx = [], x
    for ch in s.replace("‑", "-"):
        f = next((f for f in fonts if ord(ch) in f.getBestCmap()), fonts[0])
        g = f.getBestCmap().get(ord(ch))
        if g is None:
            continue
        gs = f.getGlyphSet()
        pen = SVGPathPen(gs, lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, cx, baseline)))
        d.append(pen.getCommands())
        cx += f["hmtx"][g][0] * sc + tracking * size
    return " ".join(d), cx - x - tracking * size


def cap(weight=700):
    f = _font(weight)[0]
    return f["OS/2"].sCapHeight / f["head"].unitsPerEm


# ------------------------------------------------------------------ palety
NAVY, GREEN = "#0b5cad", "#1e7a3c"
PALETTES = {
    #  nazwa:            (dokument, pieczęć, „e‑”,   „Formularze”, hasło,     tło podglądu, kafel ikony)
    "granat":            (NAVY, GREEN, GREEN, NAVY, "#5a6470", "#f5f7fa", NAVY),
    "granat-ciemne-tlo": ("#ffffff", "#3ec46d", "#3ec46d", "#ffffff", "#a9b6c6", "#0b1f36", NAVY),
    "granat-mono":       (NAVY, NAVY, NAVY, NAVY, NAVY, "#ffffff", NAVY),
    "bialy":             ("#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", NAVY, NAVY),
    "czarny":            ("#0e0e0e", "#0e0e0e", "#0e0e0e", "#0e0e0e", "#0e0e0e", "#ffffff", "#0e0e0e"),
    "zloto-czarne-tlo":  ("#ffffff", "#d4af37", "#d4af37", "#ffffff", "#b9b2a5", "#0e0e0e", "#d4af37"),
    "zloto-jasne-tlo":   ("#0e0e0e", "#8c6a12", "#8c6a12", "#0e0e0e", "#6b6458", "#ffffff", "#0e0e0e"),
}
# na kaflu aplikacji dokument i pieczęć muszą kontrastować z kaflem
TILE_OVERRIDE = {
    "granat": ("#ffffff", "#3ec46d"),
    "granat-mono": ("#ffffff", "#ffffff"),
    "czarny": ("#ffffff", "#ffffff"),
    "zloto-jasne-tlo": ("#ffffff", "#d4af37"),
    "granat-ciemne-tlo": ("#ffffff", "#3ec46d"),
    "zloto-czarne-tlo": ("#0e0e0e", "#0e0e0e"),
}


# ------------------------------------------------------------------ znak
def mark_g(pal, x=0, y=0, size=64, simple=False, outline=False, doc=None, seal=None):
    """Grupa SVG ze znakiem w układzie 64×64, przeskalowana do `size`. Wycięcia są przezroczyste (maska)."""
    p = PALETTES[pal]
    doc = doc or p[0]
    seal = seal or p[1]
    i = next(_ids)
    s = size / 64
    body = "M14 5H35L51 21V53A5 5 0 0 1 46 58H14A5 5 0 0 1 9 53V10A5 5 0 0 1 14 5Z"
    fold = "M35 5V16A5 5 0 0 0 40 21H51Z"
    lines = "" if simple else '<path d="M17 30H37M17 39H29" stroke="black" stroke-width="4.5" stroke-linecap="round"/>'
    check = "M40.5 47.5L45 52L53.5 43"
    o = [f'<g transform="translate({x:g} {y:g}) scale({s:g})">',
         f'<mask id="ef-d{i}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">'
         f'<rect width="64" height="64" fill="white"/>{lines}'
         f'<path d="{fold}" fill="#6e6e6e"/><circle cx="47" cy="47" r="18" fill="black"/></mask>',
         f'<mask id="ef-s{i}" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">'
         f'<rect width="64" height="64" fill="white"/>'
         f'<path d="{check}" fill="none" stroke="black" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></mask>']
    if outline:
        o.append(f'<g mask="url(#ef-d{i})"><path d="{body}" fill="none" stroke="{doc}" stroke-width="4" stroke-linejoin="round"/>'
                 f'<path d="M35 6V16A5 5 0 0 0 40 21H50" fill="none" stroke="{doc}" stroke-width="4" stroke-linejoin="round"/>'
                 + ("" if simple else f'<path d="M17 30H37M17 39H29" stroke="{doc}" stroke-width="4" stroke-linecap="round"/>') + '</g>'
                 f'<circle cx="47" cy="47" r="12" fill="none" stroke="{seal}" stroke-width="4"/>'
                 f'<path d="{check}" fill="none" stroke="{seal}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>')
        # w wersji liniowej linie pól są rysowane, a nie wycinane
        o[1] = o[1].replace(lines, "")
    else:
        o.append(f'<path d="{body}" fill="{doc}" mask="url(#ef-d{i})"/>'
                 f'<circle cx="47" cy="47" r="14" fill="{seal}" mask="url(#ef-s{i})"/>')
    o.append("</g>")
    return "".join(o)


def wordmark_g(pal, x, baseline, size, weight=700):
    p = PALETTES[pal]
    d1, w1 = text_path("e‑", size, x, baseline, weight)
    d2, w2 = text_path("Formularze", size, x + w1 - 0.02 * size, baseline, weight)
    return f'<path d="{d1}" fill="{p[2]}"/><path d="{d2}" fill="{p[3]}"/>', w1 - 0.02 * size + w2


TAGLINE = "AI napisało, kod sprawdził"


def tagline_g(pal, x, baseline, size):
    d, w = text_path(TAGLINE, size, x, baseline, 500, tracking=0)
    return f'<path d="{d}" fill="{PALETTES[pal][4]}"/>', w


def svg(w, h, inner, label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" width="{w:.0f}" height="{h:.0f}" '
            f'role="img" aria-label="{label}"><title>{label}</title>{inner}</svg>')


# ------------------------------------------------------------------ warianty
def v_icon(pal, **kw):
    return svg(64, 64, mark_g(pal, **kw), "e-Formularze – znak")


def v_icon_small(pal):
    return svg(64, 64, mark_g(pal, simple=True), "e-Formularze – znak (favicon)")


def v_icon_outline(pal):
    return svg(64, 64, mark_g(pal, outline=True), "e-Formularze – znak liniowy")


def v_icon_app(pal, radius=14):
    p = PALETTES[pal]
    doc, seal = TILE_OVERRIDE.get(pal, (p[0], p[1]))
    tile = p[6] if pal != "bialy" else "#ffffff"
    if pal == "bialy":
        doc, seal = NAVY, NAVY
    return svg(64, 64, f'<rect width="64" height="64" rx="{radius}" fill="{tile}"/>' + mark_g(pal, 9, 9, 46, doc=doc, seal=seal),
               "e-Formularze – ikona aplikacji")


def v_icon_round(pal):
    p = PALETTES[pal]
    doc, seal = TILE_OVERRIDE.get(pal, (p[0], p[1]))
    tile = p[6] if pal != "bialy" else "#ffffff"
    if pal == "bialy":
        doc, seal = NAVY, NAVY
    return svg(64, 64, f'<circle cx="32" cy="32" r="32" fill="{tile}"/>' + mark_g(pal, 13, 12, 40, doc=doc, seal=seal),
               "e-Formularze – ikona okrągła")


def v_wordmark(pal, size=48, tag=False):
    c = cap()
    pad = 2
    base = pad + c * size
    g, w = wordmark_g(pal, pad, base, size)
    h = base + pad + 0.02 * size
    if tag:
        ts = size * 0.36
        t, tw = tagline_g(pal, pad, base + size * 0.30 + cap(500) * ts, ts)
        g += t
        w = max(w, tw)
        h = base + size * 0.30 + cap(500) * ts + 0.26 * ts + pad
    return svg(w + 2 * pad, h, g, "e-Formularze" + (" – AI napisało, kod sprawdził" if tag else ""))


def v_horizontal(pal, tag=False, m=64):
    f = m * 0.53
    c = cap()
    gap = m * 0.25
    tx = m + gap
    if tag:
        ts = f * 0.42
        block = c * f + f * 0.32 + cap(500) * ts + 0.22 * ts
        top = (m - block) / 2
        base = top + c * f
        g, w = wordmark_g(pal, tx, base, f)
        t, tw = tagline_g(pal, tx, base + f * 0.32 + cap(500) * ts, ts)
        g += t
        w = max(w, tw)
    else:
        base = m / 2 + c * f / 2
        g, w = wordmark_g(pal, tx, base, f)
    return svg(tx + w + 2, m, mark_g(pal, 0, 0, m) + g, "e-Formularze" + (" – AI napisało, kod sprawdził" if tag else ""))


def v_vertical(pal, m=80):
    f = 30
    ts = 13
    c = cap()
    g0, w = wordmark_g(pal, 0, 0, f)
    _, tw = tagline_g(pal, 0, 0, ts)
    W = max(w, tw, m) + 4
    base = m + 18 + c * f
    g, _ = wordmark_g(pal, (W - w) / 2, base, f)
    tb = base + 12 + cap(500) * ts
    t, _ = tagline_g(pal, (W - tw) / 2, tb, ts)
    return svg(W, tb + 0.26 * ts + 2, mark_g(pal, (W - m) / 2, 0, m) + g + t, "e-Formularze – AI napisało, kod sprawdził")


VARIANTS = {
    "logo-poziome": lambda p: v_horizontal(p),
    "logo-poziome-haslo": lambda p: v_horizontal(p, tag=True),
    "logo-pionowe": v_vertical,
    "ikona": v_icon,
    "ikona-favicon": v_icon_small,
    "ikona-liniowa": v_icon_outline,
    "ikona-aplikacji": v_icon_app,
    "ikona-okragla": v_icon_round,
    "napis": lambda p: v_wordmark(p),
    "napis-haslo": lambda p: v_wordmark(p, tag=True),
}


def inline(svg_text, height=None, width=None):
    """SVG do osadzenia na canvasie (bez xmlns/title, z jawnym rozmiarem)."""
    import re
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg_text)
    vw, vh = float(vb.group(1)), float(vb.group(2))
    if height:
        width = vw * height / vh
    elif width:
        height = vh * width / vw
    else:
        width, height = vw, vh
    s = re.sub(r' width="\d+" height="\d+"', f' width="{width:.0f}" height="{height:.0f}"', svg_text, count=1)
    s = s.replace(' xmlns="http://www.w3.org/2000/svg"', "")
    s = re.sub(r"<title>.*?</title>", "", s)
    return s.replace("<svg ", '<svg style="display: block; flex-shrink: 0" ', 1)


def favicon(pal="granat"):
    p = PALETTES[pal]
    doc, seal = TILE_OVERRIDE.get(pal, (p[0], p[1]))
    return svg(64, 64, f'<rect width="64" height="64" rx="14" fill="{p[6]}"/>' + mark_g(pal, 8, 8, 48, simple=True, doc=doc, seal=seal),
               "e-Formularze")


if __name__ == "__main__":
    import sys
    out = pathlib.Path(sys.argv[1])
    n = 0
    for pal in PALETTES:
        d = out / pal
        d.mkdir(parents=True, exist_ok=True)
        for name, fn in VARIANTS.items():
            (d / f"{name}.svg").write_text(fn(pal), encoding="utf-8")
            n += 1
    (out / "favicon.svg").write_text(favicon(), encoding="utf-8")
    print("zapisano", n, "plików SVG w", out)
