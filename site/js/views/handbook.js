import { allSections, contents, size } from "../data.js";
import { html } from "../html.js";
import { crumbs } from "../crumbs.js";
import { check } from "../icons.js";
import { href, title } from "../pages.js";
import { anyRead, overall, place, resetReading, sectionRead } from "../progress.js";
import { stillHere } from "../router.js";

// The handbook's contents: each section read or not, and how much of the whole is read.
// Tapping how much is read offers to start over.
export async function handbook(el, ctx) {
  // How much is read weighs each part by its length, and "Continue" names a part: both need
  // the whole handbook. A first visit needs neither, and the outline will do.
  const here = place();
  const live = stillHere();
  const [{ edition, sections: outline }, full] = await Promise.all([contents(), anyRead() || here ? allSections() : null]);
  if (!live()) return;
  const sections = full ?? outline;
  const { done, total, percent } = full ? overall(full, size) : { done: 0, total: 0, percent: 0 };

  const resume = here && sections.find((s) => s.slug === here.section);
  const resumeUnit = resume?.units.find((u) => u.slug === here.unit);

  document.title = title.handbook;
  el.innerHTML = handbookPage(edition, sections, { done, total, percent, resume, resumeUnit }).toString();

  if (!done) return;
  const ask = el.querySelector("[data-ask]");
  const confirm = el.querySelector(".bar-ask");
  const asking = (on) => {
    ask.hidden = on;
    confirm.hidden = !on;
    (on ? confirm.querySelector("[data-cancel]") : ask).focus();
  };
  ask.addEventListener("click", () => asking(true));
  el.querySelector("[data-cancel]").addEventListener("click", () => asking(false));
  confirm.addEventListener("keydown", (e) => e.key === "Escape" && asking(false));
  el.querySelector("[data-reset]").addEventListener("click", async () => {
    resetReading();
    await handbook(el, ctx);
    el.querySelector("h1").focus();
    ctx.announce("Every part is unread.");
  });
}

/** When our copy of the handbook was taken from the DMV's site: the DMV revises it. */
export const copiedIn = (edition) =>
  `This copy is from ${new Date(edition.fetched).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}.`;

/** The page's markup. The page builder calls it with nothing read and nowhere to continue from. */
export function handbookPage(edition, sections, { done = 0, total = 0, percent = 0, resume, resumeUnit } = {}) {
  return html`
    <header class="bar is-pinned">
      ${crumbs()}
      ${done
        ? html`
            <span class="bar-end">
              <button class="btn quiet" type="button" data-ask><span class="figure">${percent}%</span> read<span class="sr-only">, start over</span></button>
              <span class="bar-ask" role="group" aria-label="Start over" hidden>
                <button class="btn quiet" type="button" data-cancel>Cancel</button>
                <button class="btn" type="button" data-reset>Mark all unread</button>
              </span>
            </span>
          `
        : ""}
    </header>
    ${done ? html`<progress class="progress" max="${total}" value="${done}" aria-label="Handbook read"></progress>` : ""}

    <h1 class="page-title" tabindex="-1">California Driver's Handbook</h1>

    ${resumeUnit
      ? html`
          <a class="resume" href="${href.unit(resume.slug, resumeUnit.slug)}">
            <span class="eyebrow">Continue</span>
            <span>${resumeUnit.title}</span>
          </a>
        `
      : ""}

    <ol class="toc">
      ${sections.map(
        (s) => html`
          <li>
            <a href="${href.section(s.slug)}">
              <span class="toc-num figure">${s.number}</span>
              <span class="toc-title">${s.title}</span>
              <span class="toc-state">${sectionRead(s) ? html`<span class="sr-only">Read</span>${check}` : ""}</span>
            </a>
          </li>
        `,
      )}
    </ol>

    <p class="credit">
      ${edition.license.attribution} ${copiedIn(edition)} ${edition.license.changes}
      <a href="${edition.source}">Original</a> · <a href="${edition.license.url}">License</a>
    </p>
  `;
}
