# Writing questions

How we write practice questions. The rules come from the DMV's 38 sample questions (`site/data/questions/dmv-samples.json`): their format, and what makes their good questions good. Where the samples are weak, we do better. Read `docs/architecture.md` first, for facts, kinds and quantities.

Every question tests facts, and every fact rests on handbook text: **source text → facts → questions**. A question never asks about something no fact states.

## Format

```json
{
 "id": "q-railroad-15-mph",
 "facts": ["railroad-15-mph"],
 "prompt": "What is the speed limit within 100 feet of a railroad crossing where you cannot see the tracks for 400 feet in both directions?",
 "choices": ["15 mph.", "25 mph.", "10 mph."],
 "answer": 0,
 "explanation": "Within 100 feet of a crossing where you can't see 400 feet down the tracks both ways, the limit is 15 mph."
}
```

Our questions live in `site/data/questions/NN.json`, one file per handbook section: `{ "section": N, "questions": [...] }`.

- **`id`:** `q-` plus a short kebab-case slug, unique across all question files. Never reuse an id for a different question.
- **`facts`:** the ids of the facts the question tests. Usually one, at most three. The answer must follow from these facts alone.
- **`answer`:** the zero-based index of the correct choice. The quiz shuffles choices, so position doesn't matter.
- **`explanation`:** one or two sentences in our words, saying why the answer is right. Name what makes a tempting choice wrong if that helps. It's shown after the reader answers.

## The prompt

- **One question, one idea.** Test the fact the question is linked to, and nothing else.
- **Prefer a situation to a recital.** "What should you do when a school bus ahead starts flashing yellow lights?" beats "What do flashing yellow lights on a school bus mean?". Most DMV questions put you in a situation.
- **Second person, plain words.** About 15 words; up to about 30 when a situation needs setting up.
- **A question ending in "?"**, or a stem ending in ":" that each choice completes ("You must notify the DMV within 5 days if you:").
- **Give the conditions the answer depends on.** If the rule only holds within 100 feet of the crossing, say "within 100 feet".
- **No negatives in the stem** ("Which is NOT…", "…EXCEPT"). "Which of the following is illegal…" is fine.
- **Don't give the answer away.** Don't repeat a distinctive word from the right answer in the prompt.

## Pictures

A question about what a sign, signal or marking means, or what it asks of you, can show it: `"figure": { "block": "<the handbook figure's id>" }`, with `"alt"` when the handbook's alt text won't do. The prompt points at it ("this sign", "a light like this").

- **The whole picture must not answer.** The caption is left out, but anything drawn in stays: the handbook's hand-signal drawings circle the lamp that's signalling, so those questions describe the arm in words instead. A sign that prints its own instruction (DO NOT ENTER) tests reading, not knowing: ask about it in words, or not at all.
- **The picture has to matter.** If the prompt already says what the sign means ("you are going against traffic"), the picture adds nothing. Let the picture carry what the prompt used to describe.
- **A shape or colour question stays in words.** "A five-sided sign" asks about the shape; a picture of it shows the children too.
- **Flashing can't be drawn.** The handbook shows it as rays around the lamp; say "flashing" in the prompt.
- **Alt text says what is seen, not what it means:** "A round yellow sign with a black X and the letters R R", not "railroad crossing sign". Give a direction when the question turns on it ("A red arrow pointing right").

## The choices

- **Exactly three choices, one clearly correct.** No "all of the above", "none of the above" or "both A and B".
- **Parallel in form:** the same grammar and a similar length. Each is a short sentence or phrase ending in a period, about 3–15 words.
- **The right answer is not the longest choice** more often than chance, so roughly a third of the time at most. Make wrong choices as specific as the right one. Don't pad the right one with qualifiers.
- **The right answer follows the handbook's meaning,** in plain words, not copied word for word.
- **Every wrong choice is plainly wrong according to the handbook.** It should contradict a fact, often a different fact from the same part. It must never be something the handbook says is acceptable, and never "also true, but less good".
- **Wrong choices must be tempting.** Each one is a mistake a real learner might make, of one of these kinds:
  - **A near miss:** the right idea with the wrong number, condition or scope: 10 or 25 mph instead of 15; one ear instead of both; "during school hours only" instead of "at all times".
  - **A plausible wrong instinct:** what an untrained driver might do, such as speeding up for a tailgater, tapping the brakes, or passing on the left.
  - **Confusing it with a neighbouring rule:** the yellow curb's meaning offered as the red curb's; the rule for a flashing red light offered for a flashing yellow one.
  - **Over- or under-generalising:** "at any time", "never", "only if…", when the rule is narrower or wider.
- **No throwaway choices.** A choice nobody would pick ("Better traffic flow" as a cause of collisions) teaches nothing.
- **For numbers:** the wrong choices are nearby, believable values in the same unit (500 feet → 300 feet and 1,000 feet). Ideally, use a number the handbook gives for a related rule, so the question tests whether you know which number goes with which rule.

## Traps a review found

A blind review of 60 questions found these mistakes more than once. Check every question against them.
- **Thresholds.** When a rule is a threshold ("0.01% or higher", "at least 3 feet"), other numbers can make the stem true too. A 19-year-old at 0.08% is also breaking the law. Ask for the *lowest* or *highest* value, or the exact limit, so only one choice fits.
- **Keep every condition, add none.** The question carries every condition the fact has ("during the first 12 months", "within 200 feet"). The right answer adds none the fact lacks: "never while the car is moving" invites "so at a red light is fine". Read the cited block's lead-in for conditions the fact's text leaves out.
- **Search the whole handbook for each wrong choice.** A wrong choice the linked fact doesn't mention may be supported elsewhere: using the horn to warn of a hazard, or headlights so others can see you. If the handbook supports a wrong choice anywhere, replace it.
- **Tells in the shape of the choices:**
  - the right answer is the only one with a qualifier
  - it's the only one with a different grammatical form ("Hanging…" against two noun phrases)
  - it repeats a word from the prompt ("middle" in the prompt, "center" in the answer)
  - two wrong choices start with "Only…" next to one broad right answer
  - two choices are exact opposites, so the answer must be one of them
- **Tells across the bank.** A pattern no single question shows can still give answers away once a learner has seen enough questions. Four that reviews found, the first three each in the fix for the one before:
  - In Yes/No questions, the answer was the only Yes (or the only No) in 23 of 28.
  - The fix then made the answer the only flat choice ("No, never." against "No, unless…" and "Yes, if…") in 22 of 23.
  - The next made the answer the most cautious choice in 23 of 31: a lone prohibition against two permissions with excuses ("…if no one is coming", "…only to the DMV"), the same excuses reused across questions. No script measures this one.
  - Safety phrases ("when it is safe", "with caution", "be ready to stop") were on the right answer in 10 of 14 questions that had one. Put them on wrong choices too ("Slow down and roll through if it is safe."). No script measures this one either.

  So vary the shapes: recast some yes/no questions as who/what/when questions, give some wrong choices no condition or more caution than the rule asks ("over-generalising"), don't reuse an excuse across questions, and let the right answer carry the rule's condition when it has one. `scripts/check.mjs` measures the patterns it can, but check any batch of questions as a set.
- **Overlap.** Don't test the same point as another question in the bank or a DMV sample, even with a different prompt. Check what the answer tests, not just the wording.
- **Trivia.** Skip facts about what other people must do (doctors, insurers, the DMV) unless the driver has to act on it.
- **Law the handbook hasn't caught up with.** Don't ask about a rule that has since changed, even though the handbook still states it: whichever answer is marked, it's wrong by one of them. The Clean Air Vehicle decal (solo HOV access for low- and zero-emission cars) ended on September 30, 2025, so `hov-low-emission-decal` has no question.

## Which facts get questions

Weight the bank toward what the DMV tests (see `docs/architecture.md`: the sample tests lean toward rules, meanings and numbers):

| Kind | Coverage |
|---|---|
| `rule`, `meaning` | Nearly all: one question each. Two for important rules with numbers, from different angles. |
| `practice` | About half: those with a concrete behaviour you could get wrong. Skip vague advice ("be alert"). |
| `consequence` | The major ones: prison, suspension, revocation, fines with amounts. |
| `definition` | Key terms only: barrier, crosswalk, roundabout, BAC, and similar. |
| `process` | Only what a learner driver must know: permit and provisional rules for minors, and deadlines you must meet. |

- **Facts in parts marked `"mode": "skim"` in `site/data/outline.json`:** only `rule` facts.
- **Several facts in one question:** combine closely related facts when a single question tests them naturally (for example, a curb colour and what's allowed at it). Never combine facts just to cover more of them.
- **No near-duplicates:** none of the DMV sample questions, which are already in the bank, and none of our other questions.

## Difficulty

Every question has a `difficulty`: `"easy"`, `"medium"` or `"hard"`. Hard mode in the quiz asks only `hard` questions. Rate the question as written, choices included, not just its fact. The test: **would a sensible adult driver who hasn't read the handbook get it right?**

- **`easy`:** common sense or ordinary driving experience gets it, or the wrong choices are plainly unsafe or silly. Don't text while driving; slow down in fog; a red octagon means stop.
- **`medium`:** a sensible guess is likely right, but it helps to have read the handbook. Usually one wrong choice is tempting, or the rule is familiar but its details aren't.
- **`hard`:** a sensible guess is likely wrong, or it's a coin toss between two choices. A question is hard if any of these apply:
  - **It turns on a number or threshold, and the wrong choices are believable numbers:** 300 versus 500 feet for dimming high beams; 0.01% versus 0.05% BAC under 21; 10 days to report a collision.
  - **It goes against instinct:** the obvious answer is a wrong choice. Merge into the bike lane before turning right; you can get a speeding ticket while driving the speed limit.
  - **It tells apart two similar rules:** red curb versus yellow; flashing red versus flashing yellow; what a provisional driver may do in the first 12 months versus after.
  - **It's a lesser-known rule** most drivers have never had to apply: towing lanes, neighbourhood electric vehicles, animal-drawn vehicles, and points thresholds.

Aim for roughly a quarter of the bank to be `hard`. Don't rate a question hard only because it's awkwardly worded. Fix the wording instead.

## Checked automatically

`node scripts/check.mjs` enforces:
- three distinct choices
- an answer that is one of them
- facts that exist
- unique ids
- no "of the above"
- no repeated prompts
- a picture that is one of the handbook's figures
- an explanation on every question we write
- **tells across the bank**, which no single question shows but a learner who has seen enough of them picks up. Each would be right a third of the time by chance; the check fails if one is right more than 40% of the time:
  - among questions whose choices all start with Yes or No, the answer being the one that differs
  - among questions where two choices start with the same word and one doesn't, the answer being the one that doesn't
  - among questions where one choice has no condition and the others do ("unless", "if", "only", "more than"…), the answer being the one without
  - the answer being the longest choice, or the shortest

The rest of this guide is for writers and reviewers to apply.
