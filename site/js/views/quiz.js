import { section as loadSection } from "../data.js";
import { html } from "../html.js";
import { back, check, cross } from "../icons.js";
import { href, title } from "../pages.js";
import { NAMES, answeredCount, resumeAt } from "../quiz.js";
import { cameFrom, navigate, stillHere } from "../router.js";
import { explanation, questionFigure, sources } from "../source.js";
import { markFigures } from "../zoom.js";

// One quiet word in the bar for a test that isn't the usual kind.
const TAGS = { hard: "Hard", review: "Review", part: "Part" };

export async function quiz(el, ctx) {
  if (!ctx.session) {
    navigate(href.practice, { replace: true });
    return;
  }
  const session = ctx.session;
  const { part } = session;
  // "Continue" goes on to the next question; coming back from the handbook returns to the answer.
  if (cameFrom() === "practice" && resumeAt(session) !== session.index) {
    session.index = resumeAt(session);
    ctx.saveSession();
  }
  const live = stillHere();
  const [lib, sec] = await Promise.all([ctx.library(), part && loadSection(part.section)]);
  if (!live()) return;
  const unit = sec?.units.find((u) => u.slug === part.unit);
  const name = unit?.title ?? NAMES[session.mode];
  document.title = name ? title.test(name) : title.quiz;
  // Practising a part of the handbook: leaving goes back to it.
  const exit = part ? href.unit(part.section, part.unit) : href.practice;
  const tag = TAGS[session.mode];

  function current() {
    const item = session.items[session.index];
    return { item, question: ctx.byId.get(item.id) };
  }

  function draw() {
    const { item, question } = current();
    const answered = item.picked != null;
    const total = session.items.length;
    const gotIt = item.picked === question.answer;

    const state = (choice) => {
      if (!answered) return { cls: "", mark: "" };
      if (choice === question.answer) return { cls: "is-right", mark: check };
      if (choice === item.picked) return { cls: "is-wrong", mark: cross };
      return { cls: "is-other", mark: "" };
    };

    el.innerHTML = html`
      <header class="bar">
        <a class="back" href="${exit}" aria-label="Exit">${back}</a>
        <span>${tag ? html`<span class="mode-tag">${tag}</span> ` : ""}<span class="figure">${session.index + 1}/${total}</span></span>
      </header>
      <progress class="progress" max="${total}" value="${answeredCount(session)}" aria-label="Progress"></progress>

      <h1 class="prompt" tabindex="-1">${question.prompt}</h1>
      ${questionFigure(question, lib)}

      <ul class="choices">
        ${item.order.map((choice) => {
          const { cls, mark } = state(choice);
          return html`
            <li>
              <button class="choice ${cls}" type="button" data-choice="${choice}" ${answered ? "disabled" : ""}>
                <span>${question.choices[choice]}</span>${mark}
              </button>
            </li>
          `;
        })}
      </ul>

      ${answered
        ? html`
            <p class="why">
              <strong class="${gotIt ? "is-right" : "is-wrong"}">${gotIt ? "Correct." : "Incorrect."}</strong>
              ${explanation(question, lib)}
            </p>
            ${sources(question, lib)}
            <div class="next">
              <button class="btn primary big" type="button" data-action="next">
                ${session.index === total - 1 ? "Finish" : "Next"}
              </button>
            </div>
          `
        : ""}
    `.toString();

    markFigures(el);
    for (const button of el.querySelectorAll("[data-choice]")) {
      button.addEventListener("click", () => pick(Number(button.dataset.choice)));
    }
    el.querySelector('[data-action="next"]')?.addEventListener("click", next);
  }

  function pick(choice) {
    const { item, question } = current();
    if (item.picked != null) return;
    item.picked = choice;
    ctx.saveSession();
    draw();
    el.querySelector('[data-action="next"]').focus();
    // A short screen (a phone on its side) can leave the verdict below the fold, under Next.
    el.querySelector(".why").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    ctx.announce(choice === question.answer ? "Correct." : `Incorrect. The answer: ${question.choices[question.answer].replace(/\.$/, "")}.`);
  }

  function next() {
    if (session.index < session.items.length - 1) {
      session.index++;
      ctx.saveSession();
      draw();
      window.scrollTo(0, 0);
      el.querySelector("h1").focus({ preventScroll: true });
    } else {
      ctx.finishSession();
      navigate(href.results);
    }
  }

  // 1–9 answer, Enter continues.
  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { item } = current();
    if (item.picked == null && /^[1-9]$/.test(event.key)) {
      const choice = item.order[Number(event.key) - 1];
      if (choice != null) {
        event.preventDefault();
        pick(choice);
      }
    } else if (item.picked != null && event.key === "Enter" && !event.target.closest("a, button")) {
      event.preventDefault();
      next();
    }
  }

  draw();
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}
