"""Dev server that refuses to let the browser cache anything.

`python -m http.server` sends Last-Modified and no Cache-Control, so Chrome
happily serves a stale copy after a rebuild. That cost real debugging time:
the page showed 458 CSS rules with none of the new ones, and looked exactly
like the previous build, which reads as "my changes did nothing" rather than
"the browser did not fetch them".

Use this instead of `python -m http.server` while developing.

  python tools/serve.py [port]
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_header(self, keyword, value):
        # Drop the validators too -- with these present Chrome can still
        # issue a conditional request and act on a 304.
        if keyword.lower() in ("last-modified", "etag"):
            return
        super().send_header(keyword, value)

    def log_message(self, fmt, *args):
        pass   # quiet; the interesting output is the app, not the access log


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8712
    srv = ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"serving {srv.server_address[0]}:{port} with caching disabled")
    print(f"  app    http://127.0.0.1:{port}/dev.html")
    print(f"  built  http://127.0.0.1:{port}/dist/bench-data-skills.html")
    print(f"  tests  http://127.0.0.1:{port}/tests/index.html")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
