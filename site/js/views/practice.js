import { crumbs } from "../crumbs.js";
import { section as loadSection } from "../data.js";
import { html } from "../html.js";
import { installed, onApple } from "../install.js";
import { href, title } from "../pages.js";
import { FULL, MODES, NAMES, PASS_SHARE, dayOf, dueIds, resumeAt } from "../quiz.js";
import { stillHere } from "../router.js";
import { progressLink, readLink, takeUp } from "../transfer.js";

// The kinds of test, and the one under way if there is one. Starting another replaces it,
// after asking: there is one test at a time. The first full test asks your age, which sets
// its length. At the foot, a way to keep your progress: as a link, to carry elsewhere.
export async function practice(el, ctx) {
  // Every test needs the handbook (for each answer's source): fetch it before the tap.
  ctx.library().catch(() => {});

  const { session } = ctx;
  const part = session?.part;
  const live = stillHere();
  const unit = part && (await loadSection(part.section).catch(() => null))?.units.find((u) => u.slug === part.unit);
  if (!live()) return;

  document.title = title.practice;
  const draw = () => {
    el.innerHTML = practicePage({
      current: session && {
        name: unit?.title ?? NAMES[session.mode] ?? "Practice test",
        at: resumeAt(session) + 1,
        of: session.items.length,
      },
      due: dueIds(ctx.seen, ctx.byId, dayOf()).length,
      full: ctx.history.findLast((r) => r.mode === "full"),
      age: ctx.age,
      apple: onApple() && !installed(),
    }).toString();
    wire();
  };

  const start = (button) => ctx.begin(button, () => ctx.newTest(button.dataset.start || undefined));

  // A row asks beneath itself: before replacing the test under way, and your age before a first full test.
  let open = null;
  function ask(button, markup, actions) {
    open?.remove();
    button.insertAdjacentHTML("afterend", markup.toString());
    const box = (open = button.nextElementSibling);
    const cancel = () => {
      box.remove();
      open = null;
      button.focus();
    };
    box.addEventListener("keydown", (e) => e.key === "Escape" && cancel());
    box.querySelector("[data-cancel]")?.addEventListener("click", cancel);
    for (const [name, act] of Object.entries(actions)) box.querySelector(`[data-${name}]`).addEventListener("click", act);
    box.querySelector("button").focus();
  }

  function wire() {
    for (const button of el.querySelectorAll("[data-start]")) {
      button.addEventListener("click", () => {
        if (button.dataset.start === "full" && !ctx.age) {
          const pick = (age) => () => (ctx.setAge(age), start(button));
          ask(button, ageMarkup(Boolean(ctx.session)), { minor: pick("minor"), adult: pick("adult") });
        } else if (ctx.session) ask(button, replaceMarkup(), { confirm: () => start(button) });
        else start(button);
      });
    }

    // Your age, once given, can be changed: the full test's length goes with it.
    el.querySelector("[data-age]")?.addEventListener("click", (e) => {
      ctx.setAge(e.currentTarget.dataset.age);
      draw();
      el.querySelector("[data-age]").focus();
    });

    keepProgress(el.querySelector(".keep"));
  }

  /** The progress link, made when the panel opens, so a tap can copy it at once. */
  function keepProgress(panel) {
    let link = null;
    const send = panel.querySelector("[data-send]");
    const share = Boolean(navigator.share) && matchMedia("(pointer: coarse)").matches;
    send.textContent = share ? "Share link" : "Copy link";
    const make = () => progressLink().then((made) => (link = made), () => (send.disabled = true));
    panel.addEventListener("toggle", () => panel.open && !link && make());
    if (panel.open) make();

    send.addEventListener("click", async () => {
      if (!link) return;
      if (share) return navigator.share({ url: link }).catch(() => {});
      try {
        await navigator.clipboard.writeText(link);
        send.textContent = "Copied";
      } catch {
        send.textContent = "Couldn't copy";
      }
    });

    const form = panel.querySelector("form");
    const note = form.querySelector(".keep-note");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = await readLink(form.elements.link.value);
      if (!data) {
        note.textContent = "That link doesn't carry any progress.";
        return;
      }
      takeUp(data);
      ctx.reload();
      ctx.announce("Progress added.");
      draw();
      const fresh = el.querySelector(".keep");
      fresh.open = true;
      fresh.querySelector(".keep-note").textContent = "Added. Your progress here now includes it.";
    });
  }

  draw();
  // Arriving to keep your progress (from the offer to install): the panel is open, in view.
  if (location.hash === "#keep") {
    const panel = el.querySelector(".keep");
    panel.open = true;
    panel.scrollIntoView({ block: "start" });
  }
}

const replaceMarkup = () => html`
  <div class="tests-ask" role="group" aria-label="Replace the test under way">
    <span>Replaces the test under way.</span>
    <span class="tests-ask-do">
      <button class="btn quiet" type="button" data-cancel>Cancel</button>
      <button class="btn" type="button" data-confirm>Start</button>
    </span>
  </div>
`;

const ageMarkup = (replacing) => html`
  <div class="tests-ask" role="group" aria-label="Your age">
    <span>Under-18s take a longer test.${replacing ? " Starting replaces the test under way." : ""}</span>
    <span class="tests-ask-do">
      <button class="btn" type="button" data-minor>Under 18</button>
      <button class="btn" type="button" data-adult>18 or older</button>
    </span>
  </div>
`;

/** What the full test is, for your age; before it's known, both. */
function fullNote(age) {
  const pass = `a little over the DMV's ${PASS_SHARE * 100}%`;
  if (!age) return `As long as the real test: ${FULL.adult.of} questions for adults, ${FULL.minor.of} for under-18s.`;
  const { of, correct } = FULL[age];
  return `${of} questions, the usual length of the test for ${age === "minor" ? "under-18s" : "adults"}. Passing takes ${correct}, ${pass}.`;
}

/** The page's markup. The page builder calls it for someone who hasn't started. */
export function practicePage({ current, due = 0, full, age = null, apple = false } = {}) {
  const row = (mode, name, note, extra = "", after = "") => html`
    <li>
      <button type="button" data-start="${mode}">
        <span class="toc-title">${name}</span>
        <span class="tests-note">${note}</span>
        ${extra}
      </button>
      ${after}
    </li>
  `;
  const { length } = MODES.review;
  const why = "ones you missed, and ones it's time to see again";
  return html`
    <header class="bar">${crumbs()}</header>

    <h1 class="page-title" tabindex="-1">Practice tests</h1>

    ${current
      ? html`
          <a class="resume" href="${href.quiz}">
            <span class="eyebrow">Continue</span>
            <span>${current.name}, question <span class="figure">${current.at}</span> of <span class="figure">${current.of}</span></span>
          </a>
        `
      : ""}

    <ul class="toc tests">
      ${due
        ? row(
            "review",
            "Review",
            due === 1
              ? "1 question due: one you missed, or one it's time to see again."
              : `${due > length ? `${length} of the ${due}` : due} questions due: ${why}.`,
          )
        : ""}
      ${row("", "Practice test", `${MODES.test.length} questions from across the handbook.`)}
      ${row(
        "full",
        "Full test",
        fullNote(age),
        full
          ? html`<span class="tests-last">Last time: <span class="figure">${full.correct}</span> of <span class="figure">${full.total}</span>, ${full.passed ? "passing" : "not passing"}</span>`
          : "",
        age
          ? html`<button class="tests-age" type="button" data-age="${age === "minor" ? "adult" : "minor"}">${age === "minor" ? "I'm 18 or older" : "I'm under 18"}</button>`
          : "",
      )}
      ${row("hard", "Hard mode", `${MODES.hard.length} of the harder questions.`)}
    </ul>

    <details class="keep" id="keep">
      <summary>Keep your progress</summary>
      <p>Your progress is kept in this browser. To carry it to another device, or into the app once it's installed, copy this link and open it there.</p>
      ${apple ? html`<p>Safari clears a site's data after a week away. To keep yours, add this site to your Home Screen from the Share menu, then paste this link in the app.</p>` : ""}
      <p><button class="btn" type="button" data-send>Copy link</button></p>
      <form class="keep-add">
        <label for="keep-link">Or add progress from a link</label>
        <span class="keep-field">
          <input id="keep-link" name="link" type="url" inputmode="url" autocomplete="off" required>
          <button class="btn" type="submit">Add</button>
        </span>
        <span class="keep-note" role="status"></span>
      </form>
    </details>
  `;
}
