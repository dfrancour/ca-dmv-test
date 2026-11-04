import { library, questionBank } from "./js/data.js";
import { html } from "./js/html.js";
import { cross } from "./js/icons.js";
import { offerInstall } from "./js/install.js";
import { href } from "./js/pages.js";
import { reloadReading } from "./js/progress.js";
import { blockInAddress, createRouter, navigate } from "./js/router.js";
import { load, save, remove } from "./js/storage.js";
import { carriesProgress, readLink, takeUp } from "./js/transfer.js";
import { answered, dayOf, isCorrect, isValidSession, newSession, score } from "./js/quiz.js";
import { handbook } from "./js/views/handbook.js";
import { home } from "./js/views/home.js";
import { practice } from "./js/views/practice.js";
import { questions } from "./js/views/questions.js";
import { quiz } from "./js/views/quiz.js";
import { results } from "./js/views/results.js";
import { section } from "./js/views/section.js";
import { unit } from "./js/views/unit.js";

const outlet = document.getElementById("app");
const announcer = document.getElementById("announcer");

registerServiceWorker();

// Safari shows :active (a press) only on a page that listens for touches.
document.addEventListener("touchstart", () => {}, { passive: true });

try {
  // Opened from a progress link (transfer.js): add what it carries, and take it out of the address.
  const carried = carriesProgress(location.hash) && (await readLink(location.hash));
  if (carriesProgress(location.hash)) history.replaceState(null, "", location.pathname);
  if (carried) takeUp(carried);

  const bank = await questionBank();
  const ctx = createContext(bank);

  await createRouter(outlet, {
    "": (el) => home(el),
    practice: (el) => practice(el, ctx),
    quiz: (el) => quiz(el, ctx),
    results: (el) => results(el, ctx),
    handbook: (el, slug, unitSlug) =>
      unitSlug === "questions"
        ? questions(el, ctx, slug)
        : unitSlug
          ? unit(el, ctx, slug, unitSlug, blockInAddress())
          : slug
            ? section(el, ctx, slug)
            : handbook(el, ctx),
  }).start();

  if (carried) toast("Progress added from the link.");
  // Once you've come back on another day: install, to keep your progress. Not over a test's Next.
  else
    offerInstall((install) => {
      if (location.pathname.includes("/quiz/")) return false;
      if (install) toast("Install the app to keep your progress on this device.", "Install", install, { dismiss: true });
      else toast("Safari clears a site's data after a week away.", "Keep it", () => navigate("practice/#keep"), { dismiss: true });
    });
} catch (err) {
  console.error(err);
  // The page as built is still there to read, and its links still work: keep it. Only the
  // offline shell, emptied of its page, has nothing to show.
  if (!outlet.textContent.trim()) {
    outlet.innerHTML = `<div class="home"><p class="tagline">Couldn't load the site. Check your connection and reload.</p></div>`;
  }
}

/** Shared app state handed to every view. Persists to localStorage. */
function createContext(bank) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const saved = load("session", null);

  const ctx = {
    bank,
    byId,
    session: isValidSession(saved, byId) ? saved : null,
    history: loadHistory(),
    last: load("last", null),
    // Where each question you have answered stands in review (quiz.js, "review").
    seen: loadSeen(),
    // "adult" or "minor", once asked: it sets the full test's length.
    age: load("age", null),

    /** The handbook's facts and blocks with where they are; loaded the first time a view needs it. */
    library: () =>
      (ctx.libraryPromise ??= library().catch((err) => {
        ctx.libraryPromise = null; // try again next time
        throw err;
      })),

    /**
     * A new test of a mode (quiz.js, MODES); for a part of the handbook, `part` says which.
     * A question is in a part when any fact it tests is. `only` limits it to those questions.
     */
    async newTest(mode, part, only) {
      const lib = await ctx.library();
      const inPart = (q) =>
        (q.facts ?? []).some((id) => {
          const hit = lib.facts.get(id);
          return hit?.section.slug === part?.section && hit.unit.slug === part?.unit;
        });
      return newSession(bank, {
        mode,
        part,
        inPart,
        kindOf: (q) => lib.facts.get(q.facts?.[0])?.fact.kind ?? "rule",
        seen: ctx.seen,
        age: ctx.age ?? "adult",
        only,
      });
    },

    startSession(session) {
      ctx.session = session;
      save("session", session);
    },
    /**
     * Starts the test `make` resolves to, from a tap on `button`: the button stays pressed
     * until the test opens. If it can't load, says so and offers to try again.
     */
    async begin(button, make) {
      if (button.disabled) return;
      button.disabled = true;
      let session;
      try {
        session = await make();
      } catch (err) {
        console.error(err);
        button.disabled = false;
        toast("Couldn't load the test.", "Try again", () => ctx.begin(button, make));
        return;
      }
      ctx.startSession(session);
      navigate(href.quiz);
    },
    saveSession() {
      save("session", ctx.session);
    },
    setAge(age) {
      ctx.age = age;
      save("age", age);
    },
    /** Takes up progress stored since this page loaded: by another tab, or from a link. */
    reload() {
      reloadReading();
      ctx.history = loadHistory();
      ctx.seen = loadSeen();
      ctx.age = load("age", null);
    },
    finishSession() {
      const { mode } = ctx.session;
      const result = { at: Date.now(), ...(mode ? { mode } : {}), ...score(ctx.session, byId) };
      // Another tab may have finished a test since this one loaded: add to what's stored.
      ctx.history = [...loadHistory(), result].slice(-50);
      ctx.seen = loadSeen();
      const day = dayOf();
      for (const item of ctx.session.items) ctx.seen[item.id] = answered(ctx.seen[item.id], isCorrect(item, byId), day);
      save("seen", ctx.seen);
      keep();
      ctx.last = { result, session: ctx.session };
      ctx.session = null;
      save("history", ctx.history);
      save("last", ctx.last);
      remove("session");
    },
    announce(message) {
      announcer.textContent = "";
      requestAnimationFrame(() => (announcer.textContent = message));
    },
  };

  if (ctx.last && !isValidSession(ctx.last.session, byId)) ctx.last = null;

  // Another tab changed what's stored: take it up, so neither tab undoes the other.
  addEventListener("storage", (e) => {
    if (e.storageArea !== localStorage) return;
    ctx.reload();
    const last = load("last", null);
    ctx.last = last && isValidSession(last.session, byId) ? last : null;
    const stored = load("session", null);
    const session = isValidSession(stored, byId) ? stored : null;
    if (session?.startedAt === ctx.session?.startedAt) return;
    // The test under way was finished or replaced in the other tab.
    ctx.session = session;
    const page = location.pathname.slice(new URL("./", document.baseURI).pathname.length);
    if (page.startsWith("quiz/") || page.startsWith("practice/")) navigate(location.href, { replace: true });
  });
  return ctx;
}

// What's stored, or nothing if it isn't the shape it should be.
function loadHistory() {
  const history = load("history", []);
  return Array.isArray(history) ? history : [];
}
function loadSeen() {
  const seen = load("seen", {});
  return seen && typeof seen === "object" && !Array.isArray(seen) ? seen : {};
}

/**
 * Asks the browser to keep what's stored rather than clear it to make room, or after a
 * stretch away. Asked once a test is finished, when there is something worth keeping.
 */
function keep() {
  navigator.storage?.persisted?.().then((kept) => kept || navigator.storage.persist()).catch(() => {});
}

/**
 * A message at the foot of the screen, with an action or none. One with no action goes by
 * itself; one that offers something you may not want can be dismissed.
 */
function toast(message, action, onClick, { dismiss = false } = {}) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = html`<span>${message}</span>${action ? html`<button class="btn" type="button">${action}</button>` : ""}${dismiss ? html`<button class="toast-close" type="button" aria-label="Dismiss">${cross}</button>` : ""}`.toString();
  el.querySelector(".btn")?.addEventListener("click", () => (el.remove(), onClick()));
  el.querySelector(".toast-close")?.addEventListener("click", () => el.remove());
  document.body.append(el);
  if (!action) setTimeout(() => el.remove(), 4000);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("Service worker registration failed", err));

  // A new version took over while this page was open: offer a reload.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || window.devServer) return;
    toast("A new version is available.", "Reload", () => location.reload());
  });
}
