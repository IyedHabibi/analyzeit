"""Build assets/og-card.jpg -- the preview shown when analyzeit.dev is shared.

1200x630 is the size Facebook, LinkedIn, X, Slack and WhatsApp all crop to.
The logo is placed exactly as the owner supplied it: never recoloured. The
card's ground is SAMPLED from the logo image's own paper, so the mark sits
on it without a visible box around it.

Run:  python tools/make-og.py   (needs Pillow; output is committed)
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1200, 630
FONTS = 'C:/Windows/Fonts'


def font(name, size):
    for n in name:
        p = os.path.join(FONTS, n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


logo = Image.open(os.path.join(ROOT, 'assets', 'logo-card.jpg')).convert('RGB')

# Sample the paper from the logo's corners, so the card matches it exactly.
px = [logo.getpixel(p) for p in [(8, 8), (logo.width - 9, 8),
                                 (8, logo.height - 9), (logo.width - 9, logo.height - 9)]]
ground = tuple(sum(c[i] for c in px) // len(px) for i in range(3))

card = Image.new('RGB', (W, H), ground)
side = 470
mark = logo.copy()
mark.thumbnail((side, side), Image.LANCZOS)
# The logo's paper is not perfectly flat -- lighter at the centre -- so
# pasting the rectangle leaves a visible box. Fading its edges was tried and
# rejected: it faded the outermost nodes of the mark too, which is changing
# the owner's logo. Instead the mask is built from how much darker than the
# paper each pixel is. The mark is far darker, so it stays fully opaque;
# the paper becomes transparent and the card's ground shows through; the
# embossed shadow, in between, is kept in proportion.
from PIL import ImageChops, ImageFilter
lum = mark.convert('L')
hist, seen, total = lum.histogram(), 0, lum.width * lum.height
paper = 255
for v in range(256):                       # 90th percentile = the paper
    seen += hist[v]
    if seen >= total * 0.9:
        paper = v
        break
mask = lum.point(lambda v: max(0, min(255, (paper - 4 - v) * 5)))
mask = mask.filter(ImageFilter.GaussianBlur(0.6))
card.paste(mark, (80, (H - mark.height) // 2), mask)

d = ImageDraw.Draw(card)
INK = (43, 20, 22)        # the logo's burgundy, darkened for legible text
SUB = (96, 78, 74)
x = 600

d.text((x, 190), 'AnalyzeIt', font=font(['georgia.ttf'], 96), fill=INK)
d.line((x + 4, 318, x + 120, 318), fill=(122, 38, 44), width=4)
body = font(['segoeui.ttf'], 33)
# Every claim here is true of the product. 66 of the 84 exercises are graded
# by running the code; R has no runtime and is marked against worked answers,
# so "most", not "all".
for i, line in enumerate(['84 hands-on exercises in SQL,',
                          'Python, R and Git. Most are graded',
                          'by actually running your code.']):
    d.text((x, 348 + i * 46), line, font=body, fill=SUB)
d.text((x, 520), 'analyzeit.dev  \u00b7  free', font=font(['seguisb.ttf', 'segoeuib.ttf'], 26),
       fill=(122, 38, 44))

# JPEG, not PNG: WhatsApp silently drops previews above roughly 300 KB, and a
# PNG of a textured photo is several times that.
out = os.path.join(ROOT, 'assets', 'og-card.jpg')
card.save(out, 'JPEG', quality=86, optimize=True, progressive=True)
print('built assets/og-card.jpg  %dx%d  ground=%s  %s bytes'
      % (W, H, '#%02X%02X%02X' % ground, format(os.path.getsize(out), ',')))
