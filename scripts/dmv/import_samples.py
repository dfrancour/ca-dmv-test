#!/usr/bin/env python3
"""Turn the fetched DMV sample tests into site/data/questions/dmv-samples.json.

    python3 scripts/dmv/fetch.py && python3 scripts/dmv/import_samples.py

Each test page gives the questions and choices; the results page the DMV returns
for one submission gives the correct answer to each. Questions keep their ids and
their links to facts across imports (matched by prompt).
"""

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "dmv"
OUT = ROOT / "site" / "data" / "questions" / "dmv-samples.json"


def clean(text):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text))).strip()


def parse_test(page, results):
    questions = []
    for block in re.findall(r'<li class="dmv-practice-test__question">(.*?)</li>', page, re.S):
        prompt = clean(block.split('<span class="dmv-practice-test__question-required"', 1)[0])
        choices = [clean(c) for c in re.findall(r'<span class="dmv-practice-test__answer-text">(.*?)</span>', block, re.S)]
        questions.append({"prompt": prompt, "choices": choices})

    graded = re.findall(r'<li class="dmv-practice-test__result[^"]*"[^>]*data-user-answer="([^"]*)"[^>]*data-is-correct="(true|false)"(.*?)</li>', results, re.S)
    if len(graded) != len(questions):
        raise SystemExit(f"{len(questions)} questions but {len(graded)} results")
    for question, (user, correct, body) in zip(questions, graded):
        if correct == "true":
            answer = clean(user)
        else:
            answer = clean(re.search(r'result-answer--correct">\s*<strong>Correct answer:</strong>(.*?)</p>', body, re.S).group(1))
        question["answer"] = question["choices"].index(answer)
    return questions


def key(question):
    return (question["prompt"], tuple(sorted(question["choices"])))


def main():
    manifest = json.loads((CACHE / "manifest.json").read_text())
    previous = {}
    if OUT.exists():
        previous = {key(q): q for q in json.loads(OUT.read_text())["questions"]}

    questions, seen = [], set()
    for number, url in enumerate(manifest["samples"], start=1):
        slug = url.rstrip("/").rsplit("/", 1)[-1]
        page = (CACHE / "samples" / f"{slug}.html").read_text(encoding="utf-8")
        results = (CACHE / "samples" / f"{slug}.results.html").read_text(encoding="utf-8")
        for index, q in enumerate(parse_test(page, results), start=1):
            if key(q) in seen:
                continue  # the same question on more than one test
            seen.add(key(q))
            old = previous.get(key(q), {})
            questions.append({
                "id": old.get("id", f"dmv-c{number}-{index:02d}"),
                **q,
                **({"difficulty": old["difficulty"]} if "difficulty" in old else {}),
                "facts": old.get("facts", []),
                "source": {"test": f"Class C Test #{number}", "url": url},
            })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = {"origin": "DMV sample knowledge tests (Class C, English)", "questions": questions}
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    gone = set(previous) - seen
    print(f"{len(questions)} questions" + (f"; {len(gone)} no longer on the DMV site" if gone else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
