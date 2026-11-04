import { section as loadSection } from "../data.js";
import { html } from "../html.js";
import { crumbs } from "../crumbs.js";
import { check } from "../icons.js";
import { href, title } from "../pages.js";
import { isRead } from "../progress.js";
import { navigate, stillHere } from "../router.js";
import { MIN_QUESTIONS, count, sectionQuestions } from "./questions.js";

// One section: its parts, each read or not. handbook/<section>/
export async function section(el, ctx, slug) {
  const live = stillHere();
  const sec = await loadSection(slug);
  if (!live()) return;
  if (!sec) {
    navigate(href.handbook, { replace: true });
    return;
  }
  document.title = title.section(sec);
  el.innerHTML = sectionPage(sec, count(sectionQuestions(sec, ctx.bank)), isRead).toString();
}

/** The page's markup, given how many questions there are on the section. The page builder calls it with nothing read. */
export function sectionPage(sec, questions, isRead = () => false) {
  // A section of only skim parts says so once, above its title; its rows are plain.
  const allSkim = sec.units.every((u) => u.mode === "skim");
  const skim = (u) => !allSkim && u.mode === "skim";

  return html`
    <header class="bar is-pinned">
      ${crumbs([{ href: href.handbook, label: "Handbook" }])}
    </header>

    <p class="eyebrow">Section ${sec.number}${allSkim ? " · Skim" : ""}</p>
    <h1 class="page-title section-title" tabindex="-1">${sec.title}</h1>

    <ol class="toc">
      ${sec.units.map(
        (u, i) => html`
          <li>
            <a href="${href.unit(sec.slug, u.slug)}">
              <span class="toc-num figure">${i + 1}</span>
              <span class="toc-title ${skim(u) ? "is-skim" : ""}">${u.title}${skim(u) ? html` <span class="hb-skim">Skim</span>` : ""}</span>
              <span class="toc-state">${isRead(sec.slug, u.slug) ? html`<span class="sr-only">Read</span>${check}` : ""}</span>
            </a>
          </li>
        `,
      )}
    </ol>

    ${questions >= MIN_QUESTIONS
      ? html`
          <a class="section-questions" href="${href.questions(sec.slug)}">Practice questions</a>
        `
      : ""}

    ${sec.next
      ? html`
          <a class="hb-next section-next" href="${href.section(sec.next.slug)}">
            <span class="eyebrow">Next · Section ${sec.next.number}</span>
            <span>${sec.next.title}</span>
          </a>
        `
      : ""}
  `;
}
