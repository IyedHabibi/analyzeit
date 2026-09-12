"""Concatenate src/ into a single distributable HTML file.

Classic scripts joined in order -- deliberately NOT ES modules. Module scripts
are fetched, and fetches from file:// are blocked, which would cost the project
its zero-install property. Plain concatenation in order has byte-identical
execution semantics to what shipped.

  python tools/build.py                      -> dist/ + dev.html
  python tools/build.py --check <reference>  -> also diff against a reference
"""
import hashlib
import pathlib
import sys

SRC = pathlib.Path("src")
DIST = pathlib.Path("dist")

# Load order is load-bearing: views.js calls render() at its end, so everything
# it touches must already be defined. Do not alphabetise this list.
ORDER = [
    "keep-data.js",
    "keep-lessons.js",
    "exercises.js",
    # git-lessons.js does Object.assign onto LESSONS/EX/PREVIEW, so it has to
    # come after the three files that define them, and before ui/views read them.
    "git-lessons.js",
    "keep-engines.js",
    "git-engine.js",
    "motion.js",
    "celebrate.js",
    "ui.js",
    "git-ui.js",
    # bento.js defines initBento(), which welcome.js calls when it builds
    # the track chooser, so it has to load first.
    "bento.js",
    "welcome.js",
    # sync.js wraps save(), which keep-engines.js defines, and calls
    # reconcile()/render() from ui.js and views.js at runtime only.
    # auth-ui.js calls into sync.js, so it follows it.
    "sync.js",
    "auth-ui.js",
    "views.js",
]


ASSETS = pathlib.Path("assets")
# Images embedded into the build as data URIs. An <img src="assets/..."> would
# break the single-file property -- the deliverable has to work from file://
# with no second request -- so the bytes go inline instead.
#
# Each entry maps a CSS custom property to a basename. The property is declared
# in head2.html as `none`, and rewritten here when a matching file exists. A
# missing file is not an error: the CSS falls back to a generated atmosphere,
# so a absent asset can never punch a hole in the page.
#
# Files ending -source are the untouched originals and are deliberately not
# matched, so the build always takes the optimised copy.
IMAGE_VARS = {
    "--hero-img":  "hero",
    "--sec-img-1": "1",
    "--sec-img-2": "2",
    "--sec-img-3": "3",
    "--sec-img-4": "4",
}
EXTS = (".png", ".jpg", ".jpeg", ".webp", ".avif")
MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".avif": "image/avif"}


def find_asset(base: str):
    for ext in EXTS:
        p = ASSETS / (base + ext)
        if p.exists():
            return p
    return None


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


_MARKUP_SRC = None


def markup_src() -> str:
    """Every source file that can emit markup, concatenated once.

    Used to decide which images are actually referenced. Reading the built
    html instead would be wrong for dev.html, where the scripts are external.
    """
    global _MARKUP_SRC
    if _MARKUP_SRC is None:
        _MARKUP_SRC = "".join(read(n) for n in ORDER) + read("head2.html")
    return _MARKUP_SRC


def inject_images(html: str, quiet: bool = False) -> str:
    """Rewrite each `--var: none;` placeholder with an embedded data URI."""
    import base64
    total = 0
    for var, base in IMAGE_VARS.items():
        p = find_asset(base)
        if not p:
            continue
        # Only embed what the page actually renders. A section photo is used
        # via data-photo="<n>"; if no section claims it, the bytes ride along
        # in every copy of the file and never draw a pixel. This caught
        # ~196KB of dead weight when three sections were replaced by the
        # how-it-works walkthrough.
        #
        # Checked against the SOURCE, not the assembled html: in dev.html the
        # scripts are external, so the markup is not in the document at all
        # and every section photo would look unused.
        #
        # The leading space matters too -- without it this also matches the
        # CSS selector `[data-photo="1"]`, which exists whether or not any
        # section carries the attribute. Markup writes ` data-photo="1"`,
        # selectors write `[data-photo="1"]`.
        # Markers must be strings that appear ONLY in markup. `hero-atmo`
        # alone also matches the `.hero-atmo` CSS selector, so the hero
        # image looked used even after the element was deleted -- the same
        # trap as `[data-photo="1"]` versus ` data-photo="1"`.
        marker = (" data-photo=\"{}\"".format(base) if var.startswith("--sec-img-")
                  else 'class="hero-atmo"')
        if marker not in markup_src():
            if not quiet:
                print("  skipped  {:<16} (nothing in the markup references {})".format(str(p), var))
            continue
        raw = p.read_bytes()
        total += len(raw)
        uri = "data:{};base64,{}".format(MIME[p.suffix.lower()],
                                        base64.b64encode(raw).decode("ascii"))
        placeholder = "{}: none;".format(var)
        if placeholder not in html:
            raise SystemExit("build: no placeholder `{}` in the CSS".format(placeholder))
        html = html.replace(placeholder, "{}: url('{}');".format(var, uri))
        if not quiet:
            print("  embedded {:<16} -> {:<12} {:>9,} bytes".format(str(p), var, len(raw)))
    if total and not quiet:
        print("  {:,} bytes of imagery (~{:,} encoded)".format(total, int(total * 1.34)))
    return html


def build() -> str:
    """The shipping artifact: one file, no requests except the two CDN deps."""
    parts = [read("head2.html")]
    for name in ORDER:
        parts.append("<script>\n" + read(name) + "</script>\n")
    parts.append(read("tail.html"))
    return inject_images("".join(parts))


def build_dev() -> str:
    """Same page, but each module stays its own file.

    Classic <script src> works from file:// (unlike module scripts), so this
    opens with a double-click too -- you just get real filenames and line
    numbers in devtools stack traces instead of one 2,893-line blob.
    """
    tags = "".join('<script src="src/{}"></script>\n'.format(n) for n in ORDER)
    return inject_images(read("head2.html") + tags + read("tail.html"), quiet=True)


def main() -> int:
    out = build()
    DIST.mkdir(exist_ok=True)
    target = DIST / "bench-data-skills.html"
    target.write_text(out, encoding="utf-8", newline="")
    pathlib.Path("dev.html").write_text(build_dev(), encoding="utf-8", newline="")

    digest = hashlib.sha256(out.encode()).hexdigest()[:16]
    print("built {}  {:,} bytes  sha256 {}".format(target, len(out.encode("utf-8")), digest))
    print("built dev.html  (modules loaded separately)")

    # The policy pages are generated from PRIVACY.md and TERMS.md. Building
    # them here means the published pages cannot drift from the documents in
    # the repository -- there is no separate command anyone has to remember.
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "build_pages", pathlib.Path(__file__).with_name("build-pages.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.main()
    except Exception as exc:                       # pragma: no cover
        print("WARN  policy pages not rebuilt: {}".format(exc))

    if "--check" in sys.argv:
        ref = pathlib.Path(sys.argv[sys.argv.index("--check") + 1])
        want = ref.read_text(encoding="utf-8")
        if want == out:
            print("MATCH   output is byte-identical to {}".format(ref.name))
            return 0
        print("DIFFER  output does not match {}".format(ref.name))
        print("        {} chars reference vs {} chars built".format(len(want), len(out)))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
