"""Transform the built single file into an Artifact-publishable page.

The Artifact host wraps whatever it is given in its own
`<!doctype html><head>...</head><body>` skeleton, so the page must NOT
carry doctype/html/head/body tags of its own. This lifts the head's
inner content (title, font links, the pre-paint theme script, the whole
stylesheet) above the body's inner content and drops the wrapper.

Known limitation, stated rather than hidden: the Artifact CSP allows
scripts from cdnjs but blocks fetch/XHR to every host. sql.js fetches
its .wasm and Pyodide fetches its runtime, so both fail there. The app
already degrades gracefully when the CDN is blocked -- the sidebar and
every lesson still render -- but SQL and Python become read-only.

  python tools/build_artifact.py  ->  dist/bench-artifact.html
"""
import pathlib
import re

SRC = pathlib.Path("dist/bench-data-skills.html")
OUT = pathlib.Path("dist/bench-artifact.html")


def main() -> int:
    html = SRC.read_text(encoding="utf-8")

    head = re.search(r"<head>(.*?)</head>", html, re.S)
    body = re.search(r"<body>(.*?)</body>", html, re.S)
    if not head or not body:
        raise SystemExit("could not find <head>/<body> in " + str(SRC))

    head_inner = head.group(1)
    body_inner = body.group(1)

    # The host supplies charset and viewport itself; ours would be duplicates.
    head_inner = re.sub(r'<meta\s+charset[^>]*>', "", head_inner, flags=re.I)
    head_inner = re.sub(r'<meta\s+name="viewport"[^>]*>', "", head_inner, flags=re.I)

    banner = (
        "<!-- Built by tools/build_artifact.py from dist/bench-data-skills.html.\n"
        "     Do not edit directly: edit src/ and rebuild.\n"
        "     Note: SQL and Python need fetch() for their WASM runtimes, which the\n"
        "     Artifact sandbox blocks. They degrade to read-only here; the local\n"
        "     single file has them working. -->\n"
    )

    OUT.write_text(banner + head_inner.strip() + "\n" + body_inner.strip() + "\n",
                   encoding="utf-8", newline="")
    size = len(OUT.read_bytes())
    print(f"built {OUT}  {size:,} bytes")
    for tag in ("<!DOCTYPE", "<html", "<head>", "<body>"):
        assert tag.lower() not in OUT.read_text(encoding="utf-8").lower(), f"{tag} leaked into output"
    print("clean: no wrapper tags in output")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
