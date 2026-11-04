import { html } from "../html.js";
import { back, check, cross } from "../icons.js";
import { neighbours, section as loadSection } from "../data.js";
import { href, title } from "../pages.js";
import { FULL, NAMES, PASS_SHARE, dayOf, dueIds, isCorrect } from "../quiz.js";
import { navigate, stillHere } from "../router.js";
import { explanation, questionFigure, sources } from "../source.js";
import { markFigures } from "../zoom.js";

export async function results(el, ctx) {
  if (!ctx.last) {
    navigate(href.practice, { replace: true });
    return;
  }
  const { result, session } = ctx.last;
  document.title = title.results;
  const live = stillHere();
  const lib = await ctx.library();
  const missed = session.items.filter((item) => !isCorrect(item, ctx.byId));
  const { mode, part } = session;

  // Only a test as long as the real one can say whether you'd pass it.
  const full = mode === "full";
  // After a part of the handbook, reading goes on from the part after it.
  const unit = part && (await loadSection(part.section))?.units.find((u) => u.slug === part.unit);
  const after = part && (await neighbours(part.section, part.unit)).next;
  const again = !part && (mode !== "review" || dueIds(ctx.seen, ctx.byId, dayOf()).length > 0);
  // This test's misses, asked again. After a review, "Take another" is that already: misses are due at once.
  const retry = missed.length > 0 && mode !== "review";
  const tag = full ? "" : (NAMES[mode] ?? unit?.title);
  if (!live()) return;

  el.innerHTML = html`
    <header class="bar">
      ${part
        ? html`<a class="back" href="${href.unit(part.section, part.unit)}" aria-label="Back to the part">${back}</a>`
        : html`<a class="back" href="${href.practice}" aria-label="Practice tests">${back}</a>`}
    </header>

    <section class="results">
      <h1 class="score" tabindex="-1">
        <span class="figure">${result.correct}<span class="of">/${result.total}</span></span>
        ${full ? html`<span class="verdict ${result.passed ? "is-right" : "is-wrong"}">${result.passed ? "Passing" : "Not passing"}</span>` : ""}
      </h1>
      <p class="score-note">
        ${tag ? html`<span class="mode-tag">${tag}</span>` : ""}
        ${full
          ? `Passing takes ${FULL[session.age ?? "adult"].correct} of ${FULL[session.age ?? "adult"].of}, a little over the DMV's ${PASS_SHARE * 100}%.`
          : !mode || mode === "hard"
            ? `The real test takes ${PASS_SHARE * 100}% to pass.`
            : ""}
      </p>
    </section>

    ${missed.length
      ? html`
          <section class="missed">
            <h2 class="eyebrow">Missed</h2>
            <ul class="rows">
              ${missed.map((item) => {
                const q = ctx.byId.get(item.id);
                return html`
                  <li>
                    <p class="q">${q.prompt}</p>
                    ${questionFigure(q, lib)}
                    <p class="a is-wrong">${cross}<span><span class="sr-only">Your answer: </span>${q.choices[item.picked]}</span></p>
                    <p class="a is-right">${check}<span><span class="sr-only">Correct answer: </span>${q.choices[q.answer]}</span></p>
                    ${((note) => (note ? html`<p class="note">${note}</p>` : ""))(explanation(q, lib, 1))}
                    ${sources(q, lib, 1)}
                  </li>
                `;
              })}
            </ul>
          </section>
        `
      : ""}

    ${retry || part || again
      ? html`
          <div class="next">
            ${retry ? html`<button class="btn big" type="button" data-action="retry">Retry missed</button>` : ""}
            ${part
              ? html`<a class="btn primary big" href="${after ? href.unit(after.section.slug, after.unit.slug) : href.handbook}">Continue reading</a>`
              : again
                ? html`<button class="btn primary big" type="button" data-action="again">Take another</button>`
                : ""}
          </div>
        `
      : ""}
  `.toString();
  markFigures(el);

  const begin = (button, test) => button?.addEventListener("click", () => ctx.begin(button, test));
  begin(el.querySelector('[data-action="again"]'), () => ctx.newTest(mode));
  begin(el.querySelector('[data-action="retry"]'), () =>
    ctx.newTest(part ? "part" : "review", part, missed.map((item) => item.id)),
  );
}
