#!/usr/bin/env python3
"""How well a second rater's labels agree with the labels in the repo.

    python3 scripts/eval/agreement.py kind /tmp/eval/kinds-rater2.json
    python3 scripts/eval/agreement.py difficulty /tmp/eval/difficulty-rater2.json

The rater's file is a JSON list of {"id", "<field>"}. For `kind` (facts; six categories,
no order) it reports Cohen's kappa; for `difficulty` (questions; easy < medium < hard)
a quadratically weighted kappa, which counts easy-versus-hard as worse than a one-step
miss. Also prints the disagreements, to read for unclear definitions. See docs/evaluation.md.
"""

import json
import sys
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "site" / "data"
FIELDS = {
    "kind": ("facts", "facts", ["meaning", "rule", "practice", "consequence", "process", "definition"], False),
    "difficulty": ("questions", "questions", ["easy", "medium", "hard"], True),
}


def kappa(pairs, labels, weighted):
    n = len(pairs)
    index = {label: i for i, label in enumerate(labels)}
    k = len(labels)
    observed = [[0] * k for _ in labels]
    for a, b in pairs:
        observed[index[a]][index[b]] += 1
    rows = [sum(r) for r in observed]
    cols = [sum(observed[i][j] for i in range(k)) for j in range(k)]
    weight = (lambda i, j: (i - j) ** 2 / (k - 1) ** 2) if weighted else (lambda i, j: 0 if i == j else 1)
    disagreement = sum(weight(i, j) * observed[i][j] for i in range(k) for j in range(k))
    expected = sum(weight(i, j) * rows[i] * cols[j] / n for i in range(k) for j in range(k))
    return 1 - disagreement / expected, observed


def main():
    field, path = sys.argv[1], Path(sys.argv[2])
    folder, key, labels, weighted = FIELDS[field]
    repo = {x["id"]: x for p in (DATA / folder).glob("*.json") for x in json.loads(p.read_text())[key]}
    theirs = json.loads(path.read_text())
    pairs = [(repo[x["id"]][field], x[field]) for x in theirs]

    same = sum(a == b for a, b in pairs)
    value, observed = kappa(pairs, labels, weighted)
    print(f"{field}: {same}/{len(pairs)} identical ({same / len(pairs):.0%}), {'weighted ' if weighted else ''}kappa {value:.2f}")
    print("confusion, rows = repo, columns = second rater:")
    for label, row in zip(labels, observed):
        print(f"  {label:12} {row}")
    print("disagreements:")
    for x, (a, b) in zip(theirs, pairs):
        if a != b:
            print(f"  {x['id']}: repo {a}, second rater {b}")
    print("most common in the repo's sample:", Counter(a for a, _ in pairs).most_common())


if __name__ == "__main__":
    main()
