#!/usr/bin/env python3
"""Find each fact's quantities in the handbook text it cites, and record them as marks.

    python3 scripts/mark_quantities.py

A fact's `quantities` are in our words ("10 hours"); the reader marks numbers in the
handbook's words ("Ten hours"). For each cite, `marks` lists the quantities as they
appear in that cite's quote, matched ignoring case, apostrophe style, hyphens versus
spaces, and digits versus number words. Marks already present are kept, so ones placed
by hand survive a rerun. Prints the quantities it could not find.
"""

import json
import re
from pathlib import Path

FACTS = Path(__file__).resolve().parents[1] / "site" / "data" / "facts"
WORDS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split()
NUMBER = {w: str(i) for i, w in enumerate(WORDS)} | {str(i): w for i, w in enumerate(WORDS)}


def pattern(quantity):
    parts = []
    for token in re.split(r"[\s-]+", quantity.strip()):
        options = {re.escape(token)}
        if token.lower() in NUMBER:
            options.add(re.escape(NUMBER[token.lower()]))
        parts.append("(?:" + "|".join(sorted(options)) + ")")
    joined = re.sub("['’]", "['’]", r"[\s-]+".join(parts))
    return re.compile(r"(?<![\w$])" + joined + r"(?!\w)", re.IGNORECASE)


def main():
    missing = []
    for path in sorted(FACTS.glob("*.json")):
        doc = json.loads(path.read_text())
        for fact in doc["facts"]:
            for quantity in fact.get("quantities", []):
                found = False
                for cite in fact["cites"]:
                    match = pattern(quantity).search(cite["quote"])
                    if match:
                        marks = cite.setdefault("marks", [])
                        if match.group(0) not in marks:
                            marks.append(match.group(0))
                        found = True
                if not found and not any(m for c in fact["cites"] for m in c.get("marks", [])):
                    missing.append((fact["id"], quantity))
        path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    for fact_id, quantity in missing:
        print(f"not found: {fact_id}: {quantity!r}")
    print(f"{len(missing)} quantities not found in their quotes")


if __name__ == "__main__":
    main()
