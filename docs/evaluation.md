# Evaluation

How we know the content is good. Content written or labelled by one agent (or person) is checked by another who hasn't seen the first one's work. These checks are judgements, so they live here as procedures rather than in `scripts/check.mjs`. Rerun the relevant one after any substantial change, and add the result to the table at the end.

Tools: `scripts/eval/sample.py` draws a blind, seeded sample, and `scripts/eval/agreement.py` measures how well two raters' labels agree. Keep working files in `/tmp/eval/`, not the repo.

## 1. Facts cover what gets tested

**When:** after extracting or changing facts, or importing a new edition.

**How:** a grader who didn't write the facts reads each DMV sample question (`site/data/questions/dmv-samples.json`) and decides whether the facts support its answer:
- `covered`: the facts together support the correct choice over the wrong ones, without outside knowledge.
- `partial`: related facts exist, but the answer needs a step or detail they don't state.
- `missing`: nothing in the facts gets you there.

For `partial` and `missing`, the grader says whether the handbook has the answer: an extraction gap (with block id and quote), or a handbook gap.

**Prompt points that matter:**
- The extraction agent must not have seen the sample questions.
- Before calling something a handbook gap, the grader must search the *whole* handbook. One once missed Section 7's bike-lane rules after reading only Section 6.

**Bar:** no `missing`, and every `partial` explained.

## 2. Fact kinds and quantities

**When:** after tagging facts, or changing the definitions in `docs/architecture.md`.

**How:**
1. Draw a sample: `python3 scripts/eval/sample.py facts 100 --seed N`.
2. A second rater labels it, given only the definitions in `docs/architecture.md` ("Kind and quantities") and each fact's id and text.
3. Run `python3 scripts/eval/agreement.py kind <their file>`.
4. Read every disagreement. Disagreements that cluster point to an unclear definition: fix the definition, then re-review the facts on that boundary.

**Bar:** κ ≥ 0.85.

## 3. Question quality

**When:** after writing or revising questions.

**How:**
1. Draw a sample: `python3 scripts/eval/sample.py questions 60 --seed N --exclude <ids already reviewed>`.
2. A reviewer who didn't write them grades each question on six checks, reading its linked facts and the handbook blocks they cite, and searching the rest of the handbook for any wrong choice that might be true:
   1. **supported:** the correct choice follows from the linked facts and handbook alone.
   2. **distractors-wrong:** every wrong choice is plainly wrong according to the handbook; none is defensible.
   3. **distractors-plausible:** each wrong choice is a mistake a real learner might make; no throwaways.
   4. **no-tells:** the answer can't be found from the choices' form (length, wording, a word echoed from the prompt, absolute language).
   5. **clear:** one reading, one best answer.
   6. **worth-asking:** something a learner should know, in the spirit of the DMV samples.
3. Each question gets an overall verdict: `good`, `fix` (with the exact change) or `drop`.
4. Apply every verdict. When a problem recurs, add it to "Traps a review found" in `docs/questions.md`, and audit the whole bank for it.

**Bar:**
- No `supported` failures.
- No more than 1 in 20 failing `distractors-wrong` or `clear`.
- At least 80% `good`.

## 4. Difficulty

**When:** after rating questions, or changing the rubric in `docs/questions.md` ("Difficulty").

**How:**
1. Draw a sample: `python3 scripts/eval/sample.py questions 80 --seed N`.
2. A second rater rates it using only the rubric.
3. Run `python3 scripts/eval/agreement.py difficulty <their file>`.

**Bar:**
- Weighted κ ≥ 0.8.
- No question rated easy by one rater and hard by the other.
- Agreement on hard versus not-hard of at least 85%. Hard mode depends on it.

## 5. Code

`node --test "tests/*.test.mjs"` holds test assembly to the blueprint (`docs/architecture.md`, "How a test is assembled"), and number marking to whole numbers. The deploy runs it. Change the tests in the same commit as the rule they test.

## Results so far

| Date | Evaluation | Sample | Result |
|---|---|---|---|
| 2026-11-03 | 1. Facts cover what gets tested | all 38 DMV samples | 37 covered, 1 partial (65 mph: the DMV's answer says "must" where the handbook says "ideal maximum") |
| 2026-11-03 | 2. Kinds | 100 facts | 95% identical, κ 0.93. After the definitions were tightened, 35 boundary facts changed; the remaining 8 disagreements with that rater were all cases the new rules decide differently. |
| 2026-11-03 | 2. Quantities | 100 facts | 99% identical |
| 2026-11-03 | 3. Questions, first round | 60 of 493 | 46 good, 12 fix, 2 drop. Led to "Traps a review found"; the bank was revised to 476. |
| 2026-11-03 | 3. Questions, second round | 60 fresh, of 476 | 48 good, 9 fix, 3 drop; no `supported` failures. Applied; the bank is now 462 of ours. |
| 2026-11-03 | 4. Difficulty | 80 questions | 85% identical, weighted κ 0.88, no easy-versus-hard; hard versus not-hard 74/80 (93%) |
| 2026-11-03 | Tells across the bank (new in `check.mjs`) | all 462 of ours | Yes/No answer the odd one out 23 of 28; answer the odd one out by first word 66 of 134; and, measured after the first rewrite below, the only choice without a condition 32 of 50. All over the 40% limit, so `check.mjs` now enforces it. |
| 2026-11-03 | 3. Questions, the Yes/No rewrite | 23 rewritten, then 31, then 12 | Three rounds, each blind. Round 1: 17 good, 4 fix, 2 drop; the fix had made the answer the only flat choice in 22 of 23. Round 2 (31, after recasting and 10 more): 14 good, 15 fix, 3 drop; the answer was the most cautious choice in 23 of 31. Round 3 (the 12 fixed from round 2): 7 good, 5 fix; no `supported` failures. All applied. The bank is now 457 of ours. Led to "Tells across the bank" in `docs/questions.md`. |
| 2026-11-03 | 3. Questions, before launch (supported, distractors-wrong, clear only) | 50 fresh, of 457 | 50 pass all three. One was out of date: the Clean Air Vehicle decal it asks about ended on 2025-09-30, though the handbook still describes it. Dropped; led to "Law the handbook hasn't caught up with" in `docs/questions.md`. The bank is now 456 of ours. |
| 2026-11-04 | 3. Questions, pictures | 17 (14 recast to show their sign or signal, 3 new on hand signals) | Round 1: 7 good, 9 fix, 1 drop; no `supported` failures. The hand-signal drawings circle the signalling lamp, so those describe the arm in words; DO NOT ENTER, which prints its own answer, was dropped. Round 2 (the 9 fixed): 5 good, 4 fix. Questions whose choices are each other's answers (the three hand signals; green arrow and flashing yellow arrow) now share their facts, so no test asks two. All applied; led to "Pictures" in `docs/questions.md`, and a fourth tell across the bank (safety phrases on the answer, 10 of 14). |
| 2026-11-04 | 4. Difficulty, pictures | the same 17, then the 9 | 13 of 17 identical in round 1, 8 of 9 in round 2; no easy-versus-hard; hard versus not-hard 15 of 17. Three ratings changed to the reviewer's. |
| 2026-11-04 | 2. Kinds, hand-signal facts | 3 | 3 of 3 identical (`meaning`) |
