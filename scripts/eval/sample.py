#!/usr/bin/env python3
"""Draw a random sample of facts or questions for a blind review or a second rater.

    python3 scripts/eval/sample.py facts 100 --seed 1 > /tmp/eval/facts-sample.json
    python3 scripts/eval/sample.py questions 60 --seed 2 --exclude /tmp/eval/earlier.json > /tmp/eval/q-sample.json

The output carries only what a blind rater should see: a fact's id and text; a question's
id, prompt, choices and answer. No kind, quantities or difficulty. `--exclude` takes a
JSON list of ids (or of objects with "id") already reviewed. See docs/evaluation.md.
"""

import argparse
import json
import random
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "site" / "data"


def facts():
    for path in sorted((DATA / "facts").glob("*.json")):
        for f in json.loads(path.read_text())["facts"]:
            yield {"id": f["id"], "text": f["text"]}


def questions():
    for path in sorted((DATA / "questions").glob("*.json")):
        for q in json.loads(path.read_text())["questions"]:
            yield {"id": q["id"], "prompt": q["prompt"], "choices": q["choices"], "answer": q["answer"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("what", choices=["facts", "questions"])
    parser.add_argument("count", type=int)
    parser.add_argument("--seed", type=int, required=True, help="record it with the results, so the sample can be redrawn")
    parser.add_argument("--exclude", type=Path)
    args = parser.parse_args()

    skip = set()
    if args.exclude:
        skip = {x["id"] if isinstance(x, dict) else x for x in json.loads(args.exclude.read_text())}
    pool = [x for x in (facts() if args.what == "facts" else questions()) if x["id"] not in skip]
    sample = random.Random(args.seed).sample(pool, args.count)
    print(json.dumps(sample, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
