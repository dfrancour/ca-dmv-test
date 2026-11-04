import { markQuantities, renderBlocks } from "../blocks.js";
import { allSections, neighbours, plain, section as loadSection, size } from "../data.js";
import { html } from "../html.js";
import { crumbs } from "../crumbs.js";
import { href, title } from "../pages.js";
import { anyRead, isRead, markRead, overall, place, setPlace } from "../progress.js";
import { cameFrom, navigate, returning, stillHere } from "../router.js";
import { markFigures } from "../zoom.js";

// One part of a section, on its own page. handbook/<section>/<unit>/[#b-<block>]
// Reaching the end marks it read; the end offers its questions and leads to the next part.
// Arriving at a block is a lookup (from a quiz answer, say): it isn't reading.
export async function unit(el, ctx, slug, unitSlug, blockId) {
  const live = stillHere();
  const sec = await loadSection(slug);
  if (!live()) return;
  const index = sec?.units.findIndex((u) => u.slug === unitSlug) ?? -1;
  if (index < 0) {
    navigate(sec ? href.section(sec.slug) : href.handbook, { replace: true });
    return;
  }
  const u = sec.units[index];
  // The whole handbook is needed only for how much of it is read: with nothing read, it's 0%.
  const [{ prev, next }, sections] = await Promise.all([neighbours(sec.slug, u.slug), anyRead() ? allSections() : null]);
  const titleOf = async (x) => x && (await loadSection(x.section.slug)).units.find((y) => y.slug === x.unit.slug).title;
  const [prevTitle, nextTitle] = await Promise.all([titleOf(prev), titleOf(next)]);
  if (!live()) return;
  const to = (x) => href.unit(x.section.slug, x.unit.slug);

  // A lookup from a test, or from its results, offers the way back to it.
  const lookup = Boolean(blockId);
  const from = cameFrom();
  const back = !lookup
    ? null
    : from === "results" && ctx.last
      ? { href: href.results, label: "Back to results", route: "results" }
      : from === "quiz" && ctx.session
        ? { href: href.quiz, label: "Back to the test", route: "quiz" }
        : null;

  // The part's questions: those testing a fact in it. One test at a time, so while one is
  // under way (perhaps the one that sent you here), the part doesn't offer another.
  const factIds = new Set(u.facts.map((f) => f.id));
  const practice = ctx.bank.some((q) => q.facts?.some((id) => factIds.has(id)));

  document.title = title.unit(sec, u);
  el.innerHTML = unitPage(sec, index, {
    prev,
    prevTitle,
    next,
    nextTitle,
    back,
    percent: sections ? overall(sections, size).percent : 0,
    isRead,
    session: Boolean(ctx.session),
    practice,
  }).toString();

  // Numbers to remember are set apart, in parts worth a close read.
  if (u.mode !== "skim") markQuantities(el.querySelector(".hb"), sec.marks);

  // ---------- where the reader is ----------

  // Once the title has scrolled under the bar, the bar names the part instead of the path to it.
  const bar = el.querySelector(".hb-bar");
  const titleWatch = new IntersectionObserver(
    // Not in view, and above the bar's edge rather than below the screen.
    ([e]) => bar.toggleAttribute("data-scrolled", !e.isIntersecting && e.boundingClientRect.top < e.rootBounds.top),
    { rootMargin: "-56px 0px 0px 0px" },
  );
  titleWatch.observe(el.querySelector(".hb-title"));
  el.querySelector(".hb-heading").addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }),
  );

  // Scrolling back up brings the path back, the way out of the part.
  let lastY = scrollY;
  let upBy = 0;
  function onScroll() {
    const y = scrollY;
    const atBottom = y + innerHeight >= document.documentElement.scrollHeight - 2;
    if (y > lastY) upBy = 0;
    else if (!atBottom) upBy += lastY - y; // the bounce at the foot of the page isn't scrolling up
    lastY = y;
    bar.toggleAttribute("data-up", upBy > 48);
  }
  addEventListener("scroll", onScroll, { passive: true });

  // Back to the test or results: the step back in history, when that is where it goes.
  el.querySelector(".hb-return")?.addEventListener("click", (e) => {
    if (from !== back.route) return;
    e.preventDefault();
    history.back();
  });

  // ---------- read ----------

  // Read once the end has been on screen, and the page open for a few seconds
  // (a short part fits on one screen; opening it is not reading it). A lookup lands near
  // what it looks up, often the end: only following Next counts it read.
  let timeUp = false;
  let atEnd = false;
  const readIfDone = () => !lookup && atEnd && timeUp && finish();
  const endWatch = new IntersectionObserver((entries) => {
    atEnd = entries.at(-1).isIntersecting;
    readIfDone();
  });
  endWatch.observe(el.querySelector(".hb-end"));
  const timer = setTimeout(() => ((timeUp = true), readIfDone()), 3000);
  el.querySelector("[data-next]").addEventListener("click", finish);
  const practiceButton = el.querySelector("[data-practice]");
  practiceButton?.addEventListener("click", () =>
    ctx.begin(practiceButton, () => {
      if (!lookup) finish();
      return ctx.newTest("part", { section: sec.slug, unit: u.slug });
    }),
  );

  // Marked read: its segment fills and the handbook's figure moves on.
  async function finish() {
    if (isRead(sec.slug, u.slug)) return;
    markRead(sec.slug, u.slug);
    el.querySelector(".hb-segs .is-current").classList.add("is-read");
    const figure = el.querySelector(".hb-overall");
    if (!figure) return;
    const sections = await allSections().catch(() => null);
    if (!sections) return;
    const { percent } = overall(sections, size);
    figure.textContent = `${percent}%`;
    figure.setAttribute("aria-label", `${percent}% of the handbook read`);
  }

  // A lookup doesn't move where you're reading.
  const here = place();
  const wasHere = here?.section === sec.slug && here.unit === u.slug;
  if (!lookup) setPlace({ section: sec.slug, unit: u.slug, block: wasHere ? here.block : null });
  const topWatch = new IntersectionObserver(
    (entries) => {
      const top = entries.filter((e) => e.isIntersecting).at(-1);
      if (top && !lookup) setPlace({ section: sec.slug, unit: u.slug, block: top.target.dataset.block });
    },
    { rootMargin: "-72px 0px -85% 0px" },
  );
  el.querySelectorAll("[data-block]").forEach((b) => topWatch.observe(b));

  // ---------- arriving ----------

  // Back or Forward to this page returns to where you were on it (the router sees to that).
  const target = returning() ? null : (blockId ?? (wasHere ? here.block : null));
  if (target) {
    requestAnimationFrame(() => {
      const t = el.querySelector(`#b-${CSS.escape(target)}`);
      if (!t) return;
      t.scrollIntoView({ block: "start" });
      if (blockId) t.classList.add("hb-flash");
    });
  }

  // Figures drawn smaller than they are open full size on a tap.
  markFigures(el);

  // ← and → step through the parts.
  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest("input, textarea, dialog")) return;
    if (e.key === "ArrowRight") navigate(next ? to(next) : href.handbook);
    if (e.key === "ArrowLeft" && prev) navigate(to(prev));
  }
  document.addEventListener("keydown", onKey);

  return () => {
    clearTimeout(timer);
    titleWatch.disconnect();
    endWatch.disconnect();
    topWatch.disconnect();
    removeEventListener("scroll", onScroll);
    document.removeEventListener("keydown", onKey);
  };
}

/**
 * The page's markup, from the section (with its units filled in) and which unit.
 * The page builder calls it with nothing read and no test under way.
 */
export function unitPage(sec, index, { prev, prevTitle, next, nextTitle, back, percent = 0, isRead = () => false, session = false, practice = false }) {
  const u = sec.units[index];
  const skim = u.mode === "skim" ? html` <span class="hb-skim">Skim</span>` : "";

  // The unit's title is the page's; a heading that repeats it (in whatever case) is not shown again.
  const [first, ...rest] = u.blocks;
  const repeats = first?.type === "heading" && plain(first.html).toLowerCase() === u.title.toLowerCase();
  const blocks = repeats ? rest : u.blocks;

  return html`
    <header class="hb-bar">
      <div class="hb-lead">
        ${crumbs([
          { href: href.handbook, label: "Handbook" },
          { href: href.section(sec.slug), label: `${sec.number} · ${sec.title}` },
        ])}
        <button class="hb-heading" type="button" tabindex="-1" aria-hidden="true">
          <span class="hb-heading-section">${sec.number} · ${sec.title}</span>
          <span class="hb-heading-title"><span>${u.title}</span>${skim}</span>
        </button>
      </div>
      ${back
        ? html`<a class="hb-return" href="${back.href}">${back.label}</a>`
        : html`<span class="hb-overall figure" role="img" aria-label="${percent}% of the handbook read">${percent}%</span>`}
      <span class="hb-segs" aria-hidden="true">
        ${sec.units.map(
          (x, i) => html`<i class="${isRead(sec.slug, x.slug) ? "is-read" : ""} ${i === index ? "is-current" : ""}">${i === index ? html`<b></b>` : ""}</i>`,
        )}
      </span>
    </header>

    <article class="hb">
      <h1 class="page-title hb-title" tabindex="-1">${u.title}${skim}</h1>
      ${renderBlocks(blocks)}

      <footer class="hb-end">
        ${practice && !session
          ? html`<p class="hb-practice"><button class="btn" type="button" data-practice>Practice this part</button></p>`
          : ""}
        ${next
          ? html`
              <a class="hb-next" href="${href.unit(next.section.slug, next.unit.slug)}" data-next>
                <span class="eyebrow">${next.section.slug === sec.slug ? "Next" : `Next · Section ${next.section.number}`}</span>
                <span>${nextTitle}</span>
              </a>
            `
          : html`<a class="hb-next" href="${href.handbook}" data-next><span class="eyebrow">End of the handbook</span><span>Contents</span></a>`}
        ${prev ? html`<a class="hb-prev" href="${href.unit(prev.section.slug, prev.unit.slug)}">Previous · ${prevTitle}</a>` : ""}
      </footer>
    </article>
  `;
}
