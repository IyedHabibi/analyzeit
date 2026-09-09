"""Turn assets/logo.jpg into the two web assets the app embeds.

    python tools/make-logo.py

Input:  assets/logo.jpg      the owner's render, on its cream ground
Output: assets/logo-mark-256.webp        original colours, transparent
        assets/logo-mark-256-light.webp  light rendering, transparent
        assets/logo-favicon.png          64px, for the browser tab

The build inlines the two webp files as data URIs, so this only needs
running when the source render changes. It exists in tools/ rather than
in someone's scratch folder because a pipeline nobody can re-run is a
pipeline that quietly becomes wrong.

Three things here are not obvious and were each arrived at the hard way:

1. The ground is sampled PER ROW. The render sits on a vignette whose
   bottom corners read about eight levels darker than the top, so a flat
   threshold clips the bottom of the mark.

2. Alpha is UNPREMULTIPLIED against that ground. Without it the soft
   edges keep cream mixed into them, and the mark wears a pale halo the
   moment it sits on anything dark.

3. The light variant is not a hue rotation. Each pixel's own luminance
   becomes the mix factor between two light tones, so the bevels and the
   grain survive and only the value range moves. An invert() would throw
   the colour away with the darkness.

Requires Pillow.
"""
import io, os, sys

try:
    from PIL import Image
except ImportError:
    sys.exit('This needs Pillow:  python -m pip install Pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'logo.jpg')
OUT = os.path.join(ROOT, 'assets')

THRESH = 26.0      # how far below its row's ground a pixel counts as mark
FULL = 150.0       # delta at which a pixel is fully opaque
FLOOR = 0.12       # alpha below this is paper grain, not mark
BASE = (150, 116, 113)   # darkest tone of the light variant
HIGH = (247, 235, 232)   # brightest

lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def main():
    if not os.path.exists(SRC):
        sys.exit('missing ' + SRC)
    im = Image.open(SRC).convert('RGB')
    W, H = im.size
    px = im.load()

    edge = max(4, W // 33)
    row_bg = []
    for y in range(H):
        s = [lum(px[x, y]) for x in range(edge)] + \
            [lum(px[x, y]) for x in range(W - edge, W)]
        row_bg.append(sum(s) / len(s))

    minx, miny, maxx, maxy = W, H, -1, -1
    for y in range(H):
        bg = row_bg[y]
        for x in range(W):
            if bg - lum(px[x, y]) > THRESH:
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
    if maxx < 0:
        sys.exit('found no mark against the ground -- is logo.jpg the right image?')

    pad = 14
    box = (max(0, minx - pad), max(0, miny - pad),
           min(W, maxx + pad + 1), min(H, maxy + pad + 1))
    crop = im.crop(box)
    cw, ch = crop.size
    cpx = crop.load()
    print(f'source {W}x{H} -> mark {cw}x{ch}')

    cut = Image.new('RGBA', (cw, ch))
    opx = cut.load()
    for y in range(ch):
        bg_l = row_bg[min(H - 1, box[1] + y)]
        for x in range(cw):
            c = cpx[x, y]
            a = (bg_l - lum(c)) / FULL
            a = 0.0 if a < 0 else (1.0 if a > 1 else a)
            a = 0.0 if a <= FLOOR else (a - FLOOR) / (1.0 - FLOOR)
            if a <= 0.004:
                opx[x, y] = (0, 0, 0, 0); continue
            t = []
            for i in range(3):
                v = (c[i] - bg_l * (1.0 - a)) / a          # unpremultiply
                t.append(0 if v < 0 else (255 if v > 255 else int(round(v))))
            opx[x, y] = (t[0], t[1], t[2], int(round(a * 255)))

    lums = [lum(opx[x, y]) for y in range(0, ch, 7) for x in range(0, cw, 7)
            if opx[x, y][3] > 40]
    lo, hi = min(lums), max(lums)
    span = max(1.0, hi - lo)

    light = Image.new('RGBA', (cw, ch))
    lpx = light.load()
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = opx[x, y]
            if a == 0:
                lpx[x, y] = (0, 0, 0, 0); continue
            n = (lum((r, g, b)) - lo) / span
            n = 0.0 if n < 0 else (1.0 if n > 1 else n)
            lpx[x, y] = tuple(int(BASE[i] + (HIGH[i] - BASE[i]) * n)
                              for i in range(3)) + (a,)

    def save(img, name, size, **kw):
        r = img.resize((size, int(round(size * ch / cw))), Image.LANCZOS)
        p = os.path.join(OUT, name)
        r.save(p, **kw)
        print(f'  {name:30} {r.size}  {os.path.getsize(p):>7} bytes')

    # WEBP, not PNG: a continuous-tone render costs 119 KB as PNG at this
    # size and 34 KB as WEBP, and both variants are inlined into the build.
    save(cut,   'logo-mark-256.webp',       256, format='WEBP', quality=86, method=6)
    save(light, 'logo-mark-256-light.webp', 256, format='WEBP', quality=86, method=6)
    # PNG for the favicon: WEBP favicon support is still uneven.
    save(cut,   'logo-favicon.png',          64, optimize=True)
    print('done -- rebuild with: python tools/build.py')


if __name__ == '__main__':
    main()
