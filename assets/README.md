# assets

| file | role |
|---|---|
| `hero.jpg` | the home-page hero, **embedded into the build** |
| `hero-source.jpg` | the untouched original, kept as the source of truth |

`hero-source.jpg` is deliberately *not* named `hero.*`, so the build never
picks it up instead of the optimised copy.

## Replacing the hero

Drop a file here as `hero.png` / `.jpg` / `.webp` / `.avif`, then:

```bash
python tools/build.py
```

It is base64-encoded into the built HTML as a data URI, so the single file keeps
working from `file://` with no second request. An `<img src="assets/hero.jpg">`
would not -- one file is the whole point of the build.

## Optimise before you commit it

The bytes land in **every copy of the page**, so size it first. The current
hero went 634,797 -> 124,332 bytes (81% smaller) with no visible loss, because
it renders at 72% opacity behind a gradient veil and film grain:

```python
from PIL import Image
im = Image.open("hero-source.jpg").convert("RGB")
im.save("hero.jpg", "JPEG", quality=82, optimize=True, progressive=True)
```

Aim for under ~150 KB and about 1400px wide. Base64 adds roughly a third on
top of whatever the file weighs.

## If no hero is present

The hero falls back to a generated atmosphere -- an accent field plus a cool
counter-light -- so the page is never broken by a missing asset.
