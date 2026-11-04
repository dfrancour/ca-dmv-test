# Content architecture

The site has two modes, the handbook reader and the practice tests, over one body of content:

```
DMV handbook (imported)        ours (edited by hand or by an agent, reviewed before publish)
───────────────────────        ──────────────────────────────────────────────────────────────
section ─ blocks ◄──── id ──── outline: the reading units each section is divided into
                  ◄──── id ──── facts: one testable statement each, quoting the text it rests on
                                  ▲
                               questions test facts
```

## Files

| Path | What | Written by |
|---|---|---|
| `site/data/handbook/edition.json` | Source URLs, fetch date, licence and credit, the list of sections | `import_handbook.py` |
| `site/data/handbook/sections/NN.json` | One section: its pages and its blocks | `import_handbook.py`; never edited by hand |
| `site/data/handbook/figures/` | The handbook's images, as WebP (signs stay GIF) | `import_handbook.py` |
| `site/data/outline.json` | Each section's slug and its reading units | us |
| `site/data/facts/*.json` | Facts | us |
| `site/data/questions/*.json` | Questions; `dmv-samples.json` is the DMV's sample tests | `import_samples.py`, then us (links to facts) |
| `site/index.html`, `site/handbook/**/index.html`, `site/practice/`, `site/quiz/`, `site/results/`, `site/404.html` | The pages, with their content in them | `scripts/pages.mjs`, by `check.mjs --write`; never edited by hand |
| `site/sitemap.xml`, `site/robots.txt`, `site/llms.txt` | For search engines and AI tools | `scripts/pages.mjs` |
| `site/og.png` | The picture shown when a link is shared | `scripts/og_image.py` |

The app reads these files as they are. There is no build step; `scripts/check.mjs` checks that they agree with each other, and the deploy runs it.

## Pages and addresses

Every page has an address of its own, and a file there with its content already in it: `handbook/<section>/<unit>/` is `site/handbook/<section>/<unit>/index.html`. Search engines and AI tools read the handbook from these files (most AI crawlers don't run JavaScript), and a link to a part shows that part's title and opening words. When the app starts it renders the same page over it, with your progress in.

- **One source of markup.** Each view (`site/js/views/`) has a page function (`unitPage`, `sectionPage`, `handbookPage`, `homePage`, `practicePage`) that returns its markup; the view calls it with your progress, `scripts/pages.mjs` with none. Addresses and titles come from `site/js/pages.js`, for both. So a change to a view shows up in the pages at the next `node scripts/check.mjs --write`, and the deploy fails until it's done.
- **Relative addresses.** Each page's `<base href>` points at the site's root (`../../` two levels down), so every address in the app (`styles.css`, `data/…`, `handbook/…/`) is relative to the root wherever the page is. `404.html` is the exception, with `<base href="/">`: Vercel serves it at whatever address was asked for, so it relies on the site being at the root of its domain. The router (`site/js/router.js`) handles clicks on links to the app's pages without loading a page.
- **A section's questions** are at `handbook/<section>/questions/` when it has at least `MIN_QUESTIONS` (5; `views/questions.js`). A question belongs to the part, and comes in the order, of the first fact it tests. A section's slug can't be followed by a unit named `questions`; `check.mjs` says so. The page's JSON-LD marks it up as a `Quiz` of `Question`s.
- **A spot in a part** is the block's id as the fragment: `handbook/<section>/<unit>/#b-<block>`. Addresses from before the site had paths (`#/handbook/…`) are redirected.
- **Offline**, the service worker makes any page from the cached home page: it points the `<base>` at the root and empties the content between `<!--page-->` and `<!--/page-->`, and the app renders the page asked for. So the 120-odd pages stay out of the offline cache.
- **What each page says about itself:** its title, a description (a part's opening words, clipped to 160 characters), its canonical address on `ORIGIN` (in `scripts/pages.mjs`), share tags with `og.png`, and JSON-LD: the site, the breadcrumb, and the DMV page and licence the text comes from. The test and results pages are `noindex`.

## Blocks

A section is a flat list of blocks in reading order: `heading` (level 2–4), `paragraph`, `note` (the handbook's Note and Important callouts), `list`, `figure`, `table`. A list's items carry ids too, since they are often the statements a question tests. Text is a small subset of HTML: `strong`, `em`, `a`, `br`, and `p` inside list items.

Every block and list item has a six-character id that means nothing and never changes. On re-import, a block whose text is unchanged keeps its id; one that was edited keeps it when it is still clearly the same block (same type, text at least 60% alike); anything else gets a new id. The import prints what was kept, edited, added and removed.

## Outline

`outline.json` divides each section into units: what the reader shows as one step, and what progress is counted in.

```json
{ "number": 7, "slug": "rules-of-the-road", "units": [
  { "slug": "traffic-signals", "start": "ubfjun", "title": "Traffic Signals" },
  { "slug": "pedestrian-signals-and-signs", "start": "…" }
]}
```

A unit runs from its `start` block to the next unit's start, so every block is in exactly one unit. `title` defaults to the text of the start block when that is a heading. Subdividing a section means adding a unit; the handbook text is untouched. Slugs are ours, so addresses (`#/handbook/rules-of-the-road/traffic-signals`) survive the DMV renumbering or renaming a section.

### Skim parts

A unit with `"mode": "skim"` is labelled Skim in the reader and shown in muted text in its section's list; close reading is the default. `python3 scripts/propose_skim.py` lists the units the rule picks, and `--write` sets them. A unit is skim when either:
- it has no facts (nothing in it is testable), or
- at least three quarters of its facts are `process`, and none of its other facts has quantities (a number in a DMV process, such as "three attempts", doesn't count).

The script proposes; the outline is ours, so review its output before writing it, and hand-edit any exception.

## Facts

```json
{ "id": "flashing-red", "text": "A flashing red light means stop; after stopping, go when it is safe.",
  "cites": [{ "block": "xy69c5", "quote": "A flashing red signal light means STOP" }] }
```

A fact is one testable statement in our words, with the handbook text it rests on: a block id and the exact words. The quote is how a question links to a sentence rather than a paragraph, and it is checked: if a new edition changes those words, the check fails and names the fact.

### Kind and quantities

Every fact has a `kind`, and a fact that turns on a number lists it in `quantities`:

```json
{ "id": "railroad-15-mph", "kind": "rule", "quantities": ["15 mph", "100 feet", "400 feet"], "text": "…", "cites": […] }
```

`kind` is one of these six, chosen by what someone would be tested on:

| Kind | What the fact is | Example |
|---|---|---|
| `meaning` | What a sign, signal, marking, light or curb colour tells you | A flashing yellow light means slow down and proceed with caution. |
| `rule` | Something the law requires or forbids, including right-of-way and duties to the DMV, police or others | You must report a collision to the DMV within 10 days if anyone was injured. |
| `practice` | Safe-driving advice or technique (what you should do, or how to do it well), and safety knowledge (how fatigue, weather or carbon monoxide affect you) | Scan the road 10 to 15 seconds ahead. |
| `consequence` | What happens if you break a rule: fines, suspension, jail, points | Fleeing a police officer can mean up to 7 years in state prison. |
| `process` | How licensing and the DMV work: documents, tests, fees, renewals, eligibility, and rights or options you may use | You can renew your licence online if you are eligible. |
| `definition` | What a term, thing or service is | A roundabout is a circular intersection with no traffic signals. |

When more than one could apply:
- **`rule` or `practice`:** a fact is a `rule` if the handbook says *must*, *must not*, *illegal*, *required* or *the law*, or if it's a right-of-way rule. A fact that only says *should* or describes a technique is a `practice`.
- **Plain commands** ("Do not…", "Never…", "Signal…", "Start from the left lane"): judge by the handbook, not the grammar.
  - It's a `rule` if the handbook says elsewhere that the same thing is illegal or required, if it sits under a lead-in that says *must* or *illegal*, or if it sets an exact position, distance or time (which lane to turn from, how many feet).
  - It's a `practice` if it sits under a *should* lead-in, or is general care ("check your blind spots", "do not stop just over a hill").
  - Read the cited block and its lead-in when unsure.
- **"Must be able to"** (see, hear, react) describes fitness to drive, not a law to obey, so it's a `practice`.
- **`rule` or `consequence`:** a fact is a `consequence` when the penalty is the point. If a rule mentions its penalty in passing, it stays a `rule`.
- **`meaning` or `rule`:** a fact is a `meaning` if it tells you what something *means*, even if it implies what to do ("a red arrow means stop"). It's a `rule` if it says what to do without anything to interpret ("stop at the limit line").
- **`process` or `rule`:** a deadline or duty you must meet is a `rule` (notify the DMV within 5 days of selling a vehicle). How a DMV service works is a `process`, and so is a right you *may* use, even one with a deadline (request a hearing within 10 days of a DUI arrest).
- **`meaning` or `definition`:** road markings, lines and curb colours are `meaning`, even when the fact is phrased as "X is…".

`quantities` lists, word for word from the fact's `text`, each number the fact turns on, with its unit: `"15 mph"`, `"100 feet"`, `"five seconds"`, `"0.08%"`, `"11 p.m."`, `"$1,000"`, `"18"`. It is left out when there are none. Numbers that only identify something, such as form names like "DL 44" or a phone number, don't count. The check enforces both: a known kind, and every quantity appears in the text.

Each cite can also have `marks`: the same numbers as the handbook words them, word for word from its `quote` ("Ten hours" where our fact says "10 hours"). The reader sets these apart in close-read parts. `python3 scripts/mark_quantities.py` derives them from `quantities`, ignoring case, apostrophes, hyphens, and digits versus number words. It lists any it can't find, which you then place by hand or leave unmarked if the quote doesn't contain the number.

## Questions

```json
{ "id": "dmv-c4-08", "prompt": "…", "choices": ["…"], "answer": 1, "facts": ["flashing-yellow"],
  "source": { "test": "Class C Test #4", "url": "…" } }
```

`answer` is an index into `choices`, which the quiz shuffles. `facts` links a question to what it tests; from there the quiz can show the handbook text behind an answer, and the reader can ask the questions for a unit (a question is in a unit when any fact it tests is). `difficulty` is easy, medium or hard. How we write and rate questions is in `docs/questions.md`.

A question about a sign, a signal or a marking can show it: `"figure": { "block": "bsbkr9" }` names one of the handbook's figures, which the check confirms. It's drawn under the prompt without its caption (some captions name the answer), small ones larger. `alt` replaces the handbook's alt text where that would give the answer away or says too little ("red arrow", for a question that turns on which way it points).

### How a test is assembled

`newSession` in `site/js/quiz.js` draws a test from the bank (the DMV samples and ours). There are five kinds (`MODES`):

| Mode | Draws from | Questions | Blueprint |
|---|---|---|---|
| (none) | the whole bank | 10 | yes |
| `full` | the whole bank | as the real test for your age: 36 for adults, 46 for under-18s | yes |
| `hard` | `hard` questions | 10 | yes |
| `review` | questions due for review (below) | up to 10; "Retry missed" asks all of one test's misses | no |
| `part` | one unit's questions | up to 5 | no |

The tests in `tests/` hold it to this:
- **The blueprint.** Where a mode follows it, the kinds of the facts tested match the DMV's samples on average: `rule` 56%, `practice` 26%, `meaning` 10%, `consequence` 3%, `process` 3%, `definition` 2%. A question's kind is the kind of its first fact. A unit, or your review, are asked evenly: there the blueprint would only skew a small pool.
- **Review.** Every question you answer goes in a box, with the day you answered it. A miss puts it in box 0; a right answer moves it up a box, but only on a later day than the last (right twice in one day counts once), up to box 3. A question is due again 0, 1, 2 or 4 days after you last answered it, by its box: so a miss comes back the same day, and a question is learned by getting it right on separate days, further apart each time. Days are local calendar days.
- **Freshness.** In every kind of test, a question you missed is twice as likely to come up as an unseen one, one that's due again as likely, and one not yet due a quarter as likely.
- **No repeats within a test.** No two questions test the same fact, except in a retry of one test's misses, which asks them all.
- **Passing.** The DMV publishes only its pass mark, 80%. The full test uses the lengths usually reported, and the counts that pass on them: 30 of 36 for adults, 38 of 46 for under-18s, each a little over 80%. Your age is asked before your first full test. Only the full test says whether you passed: on ten questions it would take 8 or 9, and chance swings that too far to mean much.

After an answer, the quiz shows the handbook text behind it (the quotes of its facts, with numbers marked, or the figure itself for a fact that rests on one) and links to that spot in the reader. Our explanation is shown only when it adds to the quote; one whose words mostly repeat the quote is left out.

## What the browser keeps

Progress is kept in `localStorage` (`site/js/storage.js`), on this device only: what you've read and where you were (`progress.js`), each question's box and day (`seen`), the last 50 scores, the test under way and the last one finished, and your age. After a first finished test the app asks the browser to keep it (`navigator.storage.persist()`).

**A progress link** (`site/js/transfer.js`) carries it elsewhere: `practice/#progress=…`, the progress as JSON, deflated, in base64url, in the fragment, which never reaches the server. Opening one, or pasting it on the practice page, adds it to what's there, losing nothing: every part read on either, each question as of the later day, every score. Where you were and your age stay this device's, if it has them. A test under way stays behind.

**Installing** (`site/js/install.js`) is offered once, on a visit on a later day than the first: Safari clears a site's storage after a week without a visit, but not an installed app's. Chrome gets its install prompt; an iPhone, a way to the practice page's "Keep your progress", which explains Add to Home Screen and the link that brings progress into the app.

## A new edition

```sh
python3 scripts/dmv/fetch.py            # into .cache/dmv/ (git-ignored)
python3 scripts/dmv/import_handbook.py  # needs Pillow, for the figures
python3 scripts/dmv/import_samples.py
node scripts/check.mjs
```

Then: read the import's report, fix facts whose quotes no longer match, place blocks the outline doesn't account for, and review the diff. Git keeps past editions.

## Licence

The handbook is © California DMV, licensed CC BY-NC 4.0: we may adapt it for non-commercial use, crediting the DMV and saying what changed (`edition.json` holds both; the reader shows them).
