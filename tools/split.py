"""One-time split of the concatenated build back into source modules.

Boundaries are the ten <script> blocks. The ranges below are asserted against
the file's actual content, so this fails loudly rather than silently producing
a wrong split if the input is not shaped as HANDOFF.md describes.
"""
import pathlib

SRC = pathlib.Path("C:/Users/iyedh/Downloads/bench-data-skills.html")
OUT = pathlib.Path("src")
OUT.mkdir(exist_ok=True)

lines = SRC.read_text(encoding="utf-8").split("\n")
at = lambda n: lines[n - 1]          # 1-indexed, the way the manifest counts

# (name, first content line, last content line) -- <script>/</script> excluded
MODULES = [
    ("keep-data.js",     744,  820),
    ("keep-lessons.js",  823, 1046),
    ("exercises.js",    1049, 1295),
    ("keep-engines.js", 1298, 1578),
    ("motion.js",       1581, 1736),
    ("celebrate.js",    1739, 1804),
    ("ui.js",           1807, 2224),
    ("welcome.js",      2227, 2399),
    ("views.js",        2402, 2891),
]

for name, a, b in MODULES:
    assert at(a - 1) == "<script>",  f"{name}: line {a-1} is {at(a-1)!r}, expected <script>"
    assert at(b + 1) == "</script>", f"{name}: line {b+1} is {at(b+1)!r}, expected </script>"

(OUT / "head2.html").write_text("\n".join(lines[:742]) + "\n", encoding="utf-8")
(OUT / "tail.html").write_text("\n".join(lines[2892:]), encoding="utf-8")

print(f"{'head2.html':<18}{742:>5}")
for name, a, b in MODULES:
    (OUT / name).write_text("\n".join(lines[a - 1:b]) + "\n", encoding="utf-8")
    print(f"{name:<18}{b - a + 1:>5}")
print(f"{'tail.html':<18}{len(lines) - 2892:>5}")
