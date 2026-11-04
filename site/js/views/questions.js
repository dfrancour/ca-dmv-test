import { section as loadSection } from "../data.js";
import { html } from "../html.js";
import { crumbs } from "../crumbs.js";
import { check } from "../icons.js";
import { href, title } from "../pages.js";
import { navigate, stillHere } from "../router.js";
import { explanation, questionFigure, sources } from "../source.js";
import { markFigures } from "../zoom.js";

// A section's questions, as a list to study from: each with its choices, and its answer,
// explanation and handbook text folded away. handbook/<section>/questions/
// The reader stays as it is; this page is where the questions can be read, and found by search.

/** A section gets a questions page with at least this many; fewer is too thin a page. */
export const MIN_QUESTIONS = 5;

export async function questions(el, ctx, slug) {
  const live = stillHere();
  const sec = await loadSection(slug);
  if (!live()) return;
  const parts = sec ? sectionQuestions(sec, ctx.bank) : [];
  if (count(parts) < MIN_QUESTIONS) {
    navigate(sec ? href.section(sec.slug) : href.handbook, { replace: true });
    return;
  }
  const lib = await ctx.library();
  if (!live()) return;
  document.title = title.questions(sec);
  el.innerHTML = questionsPage(sec, parts, lib).toString();
  markFigures(el);
}

/**
 * The questions on a section, by the part of it they test, in reading order: a question
 * belongs where its first fact is, and comes in the order of the text that fact quotes.
 * @returns {{ unit, questions }[]}  only the parts with questions
 */
export function sectionQuestions(sec, bank) {
  const order = new Map(); // block or list item id -> position in the section
  const walk = (blocks) => blocks.forEach((b) => (order.set(b.id, order.size), walk(b.items ?? [])));
  sec.units.forEach((u) => walk(u.blocks));

  const at = new Map(); // fact id -> [unit index, position]
  sec.units.forEach((u, i) => u.facts.forEach((f) => at.set(f.id, [i, order.get(f.cites[0].block)])));

  const parts = sec.units.map((unit) => ({ unit, questions: [] }));
  bank
    .filter((q) => at.has(q.facts?.[0]))
    .map((q) => ({ q, where: at.get(q.facts[0]) }))
    .sort((a, b) => a.where[0] - b.where[0] || a.where[1] - b.where[1])
    .forEach(({ q, where }) => parts[where[0]].questions.push(q));
  return parts.filter((p) => p.questions.length);
}

export const count = (parts) => parts.reduce((n, p) => n + p.questions.length, 0);

/** The page's markup. `lib` is data.js library(), for the handbook text behind each answer. */
export function questionsPage(sec, parts, lib) {
  return html`
    <header class="bar is-pinned">
      ${crumbs([
        { href: href.handbook, label: "Handbook" },
        { href: href.section(sec.slug), label: `${sec.number} · ${sec.title}` },
      ])}
    </header>

    <p class="eyebrow">Section ${sec.number}</p>
    <h1 class="page-title section-title" tabindex="-1">${sec.title}: practice questions</h1>

    ${parts.map(
      ({ unit, questions }) => html`
        <section class="qa-part">
          <h2><a href="${href.unit(sec.slug, unit.slug)}">${unit.title}</a></h2>
          <ul class="rows">
            ${questions.map((q) => {
              const note = explanation(q, lib);
              return html`
                <li id="${q.id}">
                  <p class="q">${q.prompt}</p>
                  ${questionFigure(q, lib)}
                  <ul class="qa-choices">${q.choices.map((c) => html`<li>${c}</li>`)}</ul>
                  <details class="qa-answer">
                    <summary>Answer</summary>
                    <p class="a is-right">${check}<span>${q.choices[q.answer]}</span></p>
                    ${note ? html`<p class="note">${note}</p>` : ""}
                    ${sources(q, lib)}
                    ${q.source ? html`<p class="qa-from">From the DMV's <a href="${q.source.url}">${q.source.test}</a></p>` : ""}
                  </details>
                </li>
              `;
            })}
          </ul>
        </section>
      `,
    )}
  `;
}
