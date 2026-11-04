#!/usr/bin/env python3
"""Propose which reading units are skim parts, by the rule in docs/architecture.md ("Skim parts").

    python3 scripts/propose_skim.py           # list the proposal and how it differs from the outline
    python3 scripts/propose_skim.py --write   # set "mode": "skim" exactly on the proposed units

A unit is skim when it has no facts, or when at least three quarters of its facts are
`process` and none of its other facts has quantities. The outline is editorial: review
the proposal before writing it.
"""

import json
import sys
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "site" / "data"


def units_with_facts(outline):
    """Each (section, unit slug) -> the facts whose first cite falls in it."""
    unit_of = {}
    for section in outline["sections"]:
        number = section["number"]
        blocks = json.loads((DATA / "handbook" / "sections" / f"{number:02d}.json").read_text())["blocks"]
        starts = {u["start"]: u["slug"] for u in section["units"]}
        current = None

        def claim(items, unit):
            for block in items:
                unit_of[block["id"]] = (number, unit)
                claim(block.get("items", []), unit)

        for block in blocks:
            current = starts.get(block["id"], current)
            claim([block], current)

    facts = {}
    for path in sorted((DATA / "facts").glob("*.json")):
        for fact in json.loads(path.read_text())["facts"]:
            facts.setdefault(unit_of[fact["cites"][0]["block"]], []).append(fact)
    return facts


def is_skim(facts):
    if not facts:
        return True
    kinds = Counter(f["kind"] for f in facts)
    tested_numbers = any(f.get("quantities") and f["kind"] != "process" for f in facts)
    return kinds["process"] / len(facts) >= 0.75 and not tested_numbers


def main():
    path = DATA / "outline.json"
    outline = json.loads(path.read_text())
    facts = units_with_facts(outline)
    changes = 0
    for section in outline["sections"]:
        for unit in section["units"]:
            proposed = is_skim(facts.get((section["number"], unit["slug"]), []))
            current = unit.get("mode") == "skim"
            mark = "  " if proposed == current else ("+ " if proposed else "- ")
            if proposed or current:
                print(f"{mark}{section['number']:>2} {unit['slug']}")
            if proposed != current:
                changes += 1
                if proposed:
                    unit["mode"] = "skim"
                else:
                    unit.pop("mode", None)
    print(f"{changes} differ from the outline (+ would become skim, - would stop being skim)")
    if "--write" in sys.argv:
        path.write_text(json.dumps(outline, indent=1, ensure_ascii=False) + "\n")
        print("written")


if __name__ == "__main__":
    main()
