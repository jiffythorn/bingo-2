#!/usr/bin/env python3
"""Rebuild downloads/bingo-2.zip from the shipped files.

Deterministic: fixed member order and timestamps, so identical sources produce
identical bytes and CI only commits when the archive really changed.
"""

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "downloads" / "bingo-2.zip"
FILES = [
    "index.html",
    "bingo-2.css",
    "style.css",
    "terms.html",
    "README.md",
    "PROJECT.md",
    "LICENSE",
]


def main() -> None:
    missing = [name for name in FILES if not (ROOT / name).is_file()]
    if missing:
        raise SystemExit("missing shipped file(s): " + ", ".join(missing))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in FILES:
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, (ROOT / name).read_bytes())
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
