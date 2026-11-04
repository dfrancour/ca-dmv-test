#!/usr/bin/env python3
"""Download the DMV sources into .cache/dmv/ (git-ignored), for import.py to read.

    python3 scripts/handbook/fetch.py

- The handbook: every page listed in the web handbook's table of contents.
- The English Class C sample tests: each page, and the results page the DMV
  returns when the test is submitted once (it lists the correct answers).
"""

import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "dmv"
ORIGIN = "https://www.dmv.ca.gov"
HANDBOOK = f"{ORIGIN}/portal/handbook/california-driver-handbook/"
SAMPLES = f"{ORIGIN}/portal/driver-education-and-safety/educational-materials/sample-driver-license-dl-knowledge-tests/"
SAMPLE_TESTS = [
    "sample-class-c-drivers-written-test-1",
    "sample-class-c-written-test-2",
    "sample-class-c-drivers-written-test-3",
    "sample-class-c-written-test-4",
]
HEADERS = {"User-Agent": "Mozilla/5.0 (handbook import)"}


def get(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as res:
        text = res.read().decode("utf-8")
    time.sleep(0.5)  # be polite
    return text


def save(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print(f"  {path.relative_to(ROOT)}")


def handbook_pages(index_html):
    """Section pages in table-of-contents order: /portal/handbook/california-driver-handbook/<slug>/"""
    slugs = []
    for href, label in re.findall(r'<a[^>]+href="/portal/handbook/california-driver-handbook/([^"/]+)/"[^>]*>(.*?)</a>', index_html, re.S):
        if re.match(r"\s*Section \d+:", label) and href not in slugs:
            slugs.append(href)
    return slugs


def main():
    print("Handbook")
    index = get(HANDBOOK)
    save(CACHE / "handbook" / "index.html", index)
    pages = handbook_pages(index)
    for slug in pages + ["copyright"]:
        save(CACHE / "handbook" / f"{slug}.html", get(f"{HANDBOOK}{slug}/"))

    print("Sample tests")
    for slug in SAMPLE_TESTS:
        url = f"{SAMPLES}{slug}/"
        page = get(url)
        save(CACHE / "samples" / f"{slug}.html", page)
        count = len(set(re.findall(r'name="(question_\d+)"', page)))
        answers = {f"question_{i}": "0" for i in range(count)}
        save(CACHE / "samples" / f"{slug}.results.html", get(url, {"dmv_practice_test_submit": "1", **answers}))

    manifest = {
        "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "handbook": HANDBOOK,
        "pages": pages,
        "samples": [f"{SAMPLES}{slug}/" for slug in SAMPLE_TESTS],
    }
    save(CACHE / "manifest.json", json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
