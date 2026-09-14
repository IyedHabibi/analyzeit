"""Render PRIVACY.md and TERMS.md as real pages on analyzeit.dev.

WHY THIS EXISTS

The policies used to be linked to GitHub. That is a reasonable place to keep a
document and a poor place to publish one: it asks a reader to visit a code host
to find out what happens to their email address, and Google's OAuth review
requires the privacy policy to live on the application's own domain before an
app may leave Testing. While it is in Testing, only hand-listed accounts can
sign in with Google at all.

The markdown is the single source of truth. This renders it; nobody edits the
generated HTML.

Run:  python tools/build-pages.py
"""
import io
import os
import re
import html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The drafts open with a warning addressed to the SITE OWNER -- "have a lawyer
# read this before you publish". That advice stands, and it stays in the
# repository where the owner reads it. On the published page it would be
# nonsense: it would tell the reader to hire a lawyer to check a policy that is
# already in force. Strip it from the page, not from the file.
OWNER_NOTE = re.compile(
    r'^\s*(?:This is a draft|A draft)[^\n]*(?:\n(?!\s*$)[^\n]*)*\n\s*$', re.M)


def inline(t):
    """Bold, code and links. Escaped FIRST, so document text cannot inject."""
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'\[([^\]]+)\]\((https?://[^)\s]+)\)',
               r'<a href="\2" rel="noopener noreferrer">\1</a>', t)
    return t


def render(md):
    out = []
    lines = md.split('\n')
    i = 0
    while i < len(lines):
        ln = lines[i]

        if not ln.strip():
            i += 1
            continue

        if ln.strip() == '---':
            out.append('<hr>')
            i += 1
            continue

        m = re.match(r'^(#{1,6})\s+(.*)$', ln)
        if m:
            lv = len(m.group(1))
            out.append('<h%d>%s</h%d>' % (lv, inline(m.group(2)), lv))
            i += 1
            continue

        # A table is a pipe row FOLLOWED BY a separator row. The separator is
        # what tells it apart from ordinary prose that happens to contain "|".
        if (ln.startswith('|') and i + 1 < len(lines)
                and re.match(r'^\|[\s:|-]+\|?\s*$', lines[i + 1])):
            def cells(r):
                return [c.strip() for c in r.strip().strip('|').split('|')]
            head = cells(ln)
            i += 2
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append(cells(lines[i]))
                i += 1
            out.append(
                '<div class="scroll"><table><thead><tr>'
                + ''.join('<th>%s</th>' % inline(c) for c in head)
                + '</tr></thead><tbody>'
                + ''.join('<tr>' + ''.join('<td>%s</td>' % inline(c) for c in r)
                          + '</tr>' for r in rows)
                + '</tbody></table></div>')
            continue

        if re.match(r'^[-*]\s+', ln):
            items = []
            while i < len(lines) and re.match(r'^[-*]\s+', lines[i]):
                items.append(inline(re.sub(r'^[-*]\s+', '', lines[i])))
                i += 1
            out.append('<ul>' + ''.join('<li>%s</li>' % x for x in items) + '</ul>')
            continue

        para = []
        while (i < len(lines) and lines[i].strip()
               and not re.match(r'^(#{1,6}\s|[-*]\s|\||---$)', lines[i])):
            para.append(lines[i].strip())
            i += 1
        if para:
            out.append('<p>%s</p>' % inline(' '.join(para)))
    return '\n'.join(out)


SHELL = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TITLE_ — AnalyzeIt</title>
<meta name="description" content="DESC_">
<link rel="icon" href="/assets/logo-favicon.png">
<link rel="canonical" href="https://analyzeit.dev/SLUG_/">
<meta property="og:type" content="article">
<meta property="og:title" content="TITLE_ — AnalyzeIt">
<meta property="og:description" content="DESC_">
<meta property="og:url" content="https://analyzeit.dev/SLUG_/">
<meta property="og:image" content="https://analyzeit.dev/assets/og-card.jpg">
<meta name="twitter:card" content="summary_large_image">
<style>
  :root{
    --paper:#FBFAF7; --ink:#23201C; --ink2:#4A453D; --mut:#8A8278;
    --line:#E4DFD6; --tk:#3B5BDB; --sunk:#F3F0EA;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --paper:#14161A; --ink:#E9E6E1; --ink2:#C3BDB4; --mut:#8E877D;
      --line:#2A2D33; --tk:#8FA8FF; --sunk:#1B1E23;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:16px/1.72 "Iowan Old Style",Charter,Georgia,"Times New Roman",serif;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:44rem;margin:0 auto;padding:40px 22px 90px}
  nav.top{display:flex;align-items:center;justify-content:space-between;
    padding-bottom:18px;border-bottom:1px solid var(--line);margin-bottom:38px;
    font-family:Archivo,"Helvetica Neue",system-ui,sans-serif}
  nav.top a{color:var(--ink);text-decoration:none;font-weight:700;
    letter-spacing:-.02em;font-size:19px}
  nav.top .back{font-size:12.5px;font-weight:600;color:var(--mut);
    text-transform:uppercase;letter-spacing:.09em}
  nav.top .back:hover{color:var(--tk)}
  h1{font-size:33px;line-height:1.18;letter-spacing:-.022em;margin:0 0 6px}
  h2{font-family:Archivo,"Helvetica Neue",system-ui,sans-serif;font-size:13px;
    font-weight:700;text-transform:uppercase;letter-spacing:.11em;
    color:var(--mut);margin:40px 0 12px}
  h3{font-size:19px;margin:28px 0 8px;letter-spacing:-.01em}
  p{margin:0 0 16px;color:var(--ink2)}
  ul{margin:0 0 16px;padding-left:20px;color:var(--ink2)}
  li{margin-bottom:7px}
  a{color:var(--tk)}
  hr{border:0;border-top:1px solid var(--line);margin:34px 0}
  code{font-family:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;
    font-size:.87em;background:var(--sunk);padding:1px 5px;border-radius:4px}
  /* Wide tables scroll inside their own box, never the page. */
  .scroll{overflow-x:auto;margin:0 0 18px}
  table{border-collapse:collapse;width:100%;font-size:14.5px;
    font-family:Archivo,"Helvetica Neue",system-ui,sans-serif}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);
    vertical-align:top}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;
    color:var(--mut);font-weight:700}
  td{color:var(--ink2)}
  footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);
    font-family:Archivo,"Helvetica Neue",system-ui,sans-serif;font-size:12.5px;
    color:var(--mut);display:flex;gap:16px;flex-wrap:wrap}
  footer a{color:var(--mut);text-decoration:none}
  footer a:hover{color:var(--tk);text-decoration:underline}
</style>
</head>
<body>
<div class="wrap">
  <nav class="top">
    <a href="/">AnalyzeIt</a>
    <a class="back" href="/">&larr; Back to the site</a>
  </nav>
BODY_
  <footer>
    <a href="/">Home</a>
    <a href="/privacy/">Privacy</a>
    <a href="/terms/">Terms</a>
    <a href="https://github.com/IyedHabibi/analyzeit" rel="noopener noreferrer">Source</a>
  </footer>
</div>
</body>
</html>
'''

PAGES = [
    ('PRIVACY.md', 'privacy', 'Privacy Policy',
     'What AnalyzeIt stores, why, and how to have it deleted.'),
    ('TERMS.md', 'terms', 'Terms of Use',
     'The terms under which AnalyzeIt is offered.'),
]


def main():
    for src, slug, title, desc in PAGES:
        md = io.open(os.path.join(ROOT, src), encoding='utf-8').read()
        md = OWNER_NOTE.sub('', md, count=1)
        page = (SHELL
                .replace('TITLE_', title)
                .replace('SLUG_', slug)
                .replace('DESC_', html.escape(desc, quote=True))
                .replace('BODY_', render(md)))
        d = os.path.join(ROOT, slug)
        if not os.path.isdir(d):
            os.makedirs(d)
        io.open(os.path.join(d, 'index.html'), 'w',
                encoding='utf-8', newline='\n').write(page)
        print('built %s/index.html  %s bytes'
              % (slug, format(len(page.encode('utf-8')), ',')))


if __name__ == '__main__':
    main()
