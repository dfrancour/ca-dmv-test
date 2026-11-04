# Design

How the site looks and behaves, and why.

## Taste

- **Remove before adding.** No cards, number badges, stat tiles or marketing copy. Every line of copy earns its place; where a label is needed, one quiet word does it ("Skim", "Hard").
- **Rows, not boxes.** Lists are rows split by thin hairlines (`.toc`, `.choices`, `.rows`). Content sits on the page, not in panels.
- **The home page doesn't change.** The plate, a tagline and two links, "Read the handbook" and "Take a practice test", the same for everyone. Anything that depends on where you are (continue reading, resume a test, review misses) is on the page each link leads to.
- **One wordmark, drawn from the subject:** a California licence plate, as an inline SVG.
- **Type does the work.** System sans-serif; semibold, not black, for headings. Numbers in tabular monospace (`.figure`). Small uppercase labels (`.eyebrow`) sparingly. Only the type sizes listed at the top of `site/styles.css`; spacing in fours. Text meant to be read is 16px or more.
- **Colour:** cool neutrals with a purple accent, in light and dark (the tokens at the top of `site/styles.css`). Green and red only for right and wrong.

## Phones first

- Every control is at least 36px to tap, by padding rather than bigger glyphs, and taps never zoom (`touch-action: manipulation`).
- Nothing depends on hover or a tooltip. Hover styles are only for a pointer that hovers (`@media (hover: hover)`): after a tap, a hover style stays on until the next tap elsewhere.
- **A tap shows at once.** Everything tappable has a pressed look (`:active`), the same as its hover. A tap that starts a test keeps its row pressed until the test opens, and the practice tests page fetches what a test needs before the tap.
- The page clears the notch, the home indicator and an installed app's status bar (`env(safe-area-inset-*)`).
- Check every visual change at about 390px wide, in light and dark.

## The reader

- **Order is the handbook's.** Sections and parts stay in DMV order. Opinions about what matters are labels, never a different order.
- **Three levels:** contents → section → one part per page. Each part ends with a large link to the next, crossing into the next section, and under it a small one back to the part before.
- **Where you are:** a breadcrumb in a frosted bar, which shows the section and part title once the title scrolls under it; tapping it scrolls back up, and scrolling up brings the breadcrumb back, the way out of the part. Beneath it, one segment per part of the section, the current one filling as you scroll.
- **Progress:**
  - A part is read once its end has been on screen and the page has been open 3 seconds, or when you follow Next. A lookup (below) lands near what it looks up, often the end, so it counts only by Next. A section is read when all its parts are.
  - The only percentage is for the whole handbook, weighted by each part's length, on the contents page and in the bar.
  - Tapping the percentage offers "Mark all unread". It clears reading progress, not quiz history, and has no page or menu of its own.
- **Skim parts** keep their full text. "Skim" appears beside the title wherever it's shown, and the part is muted in its section's list (muted alone reads as disabled). A section of only skim parts says it once, "Section 3 · Skim" above its title, and its rows are plain: with nothing to contrast with, a label on every row is noise.
- **The handbook's own pages** (contents, a section, its questions) keep the breadcrumb pinned at the top, frosted as in the reader, its edge showing once something scrolls under it: a section can run to 28 parts.
- **A section's page** is its title, its parts as rows, and a larger, unruled link to the next section. The parts are the way in, with nothing above them: the checkmarks show where you left off, and "Continue" lives on the contents page.
- **Numbers to remember** are marked in close-read parts only, in tabular monospace on a faint chip. Never whole sentences: in the parts that matter most, nearly everything would be marked.
- **Lookups don't move you.** Arriving at a block, say from a quiz answer, highlights it briefly, doesn't change where "Continue" goes, and isn't reading the part. From a test or its results, the bar offers the way back, "Back to the test" or "Back to results", in the percentage's place.
- **Figures drawn smaller than they are** (a chart, a page of signs) open full size on a tap, with a small enlarge button in the corner to say so.
- **Practice at the end of a part:** "Practice this part" (up to five questions) above the link to the next part, its results leading on with "Continue reading". While a test is under way, the part offers no practice, since starting one would replace the test.
- **Questions beside the reader, not in it.** A section with five or more questions has a page of them (`handbook/<section>/questions/`), linked under its list of parts by the words "Practice questions" alone, faint and small, since it isn't a step in reading: rows by part, each with its choices and a folded "Answer". The reader itself never shows questions.

## The quiz

- After an answer, brought into view if a short screen leaves it below the fold: right or wrong, our explanation when it adds to the source, then the handbook text behind the answer, linked to its spot. When that text points at a figure ("The table below shows…"), the figure comes with it. The handbook is the authority; we cite it rather than paraphrase it.
- **The practice tests page** lists the kinds of test as rows, one line each: "Review" first, when questions are due, then "Practice test" (ten questions), "Full test" (as long as the real test), and "Hard mode". A test under way sits above them as "Continue", which goes on to the next question if the one it was left on is answered (coming back from the handbook returns to the answer). There is one test at a time; while one is under way, a row asks before replacing it, beneath itself. The first time, "Full test" asks your age the same way ("Under 18" or "18 or older"), and starts; after that one quiet line under the row changes it.
- **Keeping your progress** is folded away at the foot of the practice tests page, small and faint, as "Practice questions" is under a section: a link to copy (or share, on a phone) and a field to paste one into. On an iPhone not yet installed, it also says how to add the site to the Home Screen.
- **Toasts** sit at the foot of the screen, never over a test. One that offers something you may not want (installing) can be dismissed; one with nothing to do goes by itself.
- **A question about a sign or signal shows it,** under the prompt, as the handbook draws it.
- Only the full test says "Passing" or "Not passing". On ten questions a verdict would mostly be chance, so a short test shows its score with the real test's bar beside it.
- The last full test is the only score kept in view: one faint line under "Full test".
- The results page reviews wrong answers with the same sources. Its actions sit at the foot of the screen, as Next does in the quiz: "Take another" (or "Continue reading" after a part), and "Retry missed", a test of just this one's misses.
