// Path router. "handbook/rules-of-the-road/signs/" renders
// routes.handbook(outlet, "rules-of-the-road", "signs"). Addresses are relative to the
// site's root, which every page's <base href> names (see js/pages.js).
//
// Links are ordinary <a href>s: a click on one the app can show is handled here without
// loading a page, so the same links work for a reader without JavaScript and for crawlers.
//
// A view may be async, and may return:
//   - nothing,
//   - a cleanup function, or
//   - { cleanup, update }: when the next address goes to the same view and
//     update(...args) returns true, the view handles the change in place.
//
// A view that waits (for data) checks it's still wanted before drawing: see stillHere().
//
// Back and forward return to where you were on the page: the position is kept in the
// history entry when you leave it.

let go = () => {};
let here = null; // this page's route name ("quiz", "handbook", ...)
let before = null; // the page shown before it, in this visit
let token = 0; // counts the pages shown; a view's page is gone once it moves on

if (typeof history !== "undefined") history.scrollRestoration = "manual";

export function createRouter(outlet, routes) {
  const root = new URL("./", document.baseURI).pathname;
  let current = null; // { view, cleanup, update }

  const routeName = (url) => url.pathname.slice(root.length).split("/").find(Boolean) ?? "";

  /** The route and its arguments, or null for an address that isn't the app's. */
  function match(url) {
    if (!url.pathname.startsWith(root)) return null;
    const [name = "", ...args] = url.pathname.slice(root.length).split("/").filter(Boolean).map(decodeURIComponent);
    return name === "index.html" ? { view: routes[""], args: [] } : routes[name] ? { view: routes[name], args } : null;
  }

  async function resolve() {
    const { view, args } = match(location) ?? { view: routes[""], args: [] };
    before = here;
    here = routeName(location);

    if (current?.view === view && current.update?.(...args)) return;

    const mine = ++token;
    current?.cleanup?.();
    current = null;
    window.scrollTo(0, 0);
    const result = await view(outlet, ...args);
    if (mine !== token) {
      (typeof result === "function" ? result : result?.cleanup)?.();
      return;
    }
    current = typeof result === "function" ? { view, cleanup: result } : { view, ...result };
    if (!outlet.contains(document.activeElement) || document.activeElement === document.body) {
      outlet.querySelector("h1")?.focus({ preventScroll: true });
    }
    const y = returning();
    if (y) window.scrollTo(0, y);
  }

  go = resolve;
  addEventListener("popstate", resolve);
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download")) return;
    const url = new URL(a.href);
    if (url.origin !== location.origin || !match(url)) return;
    // A spot on this same page: the browser scrolls to it.
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    navigate(url);
  });

  return {
    start() {
      // Addresses from before the site had paths: "#/handbook/<section>/<unit>/<block>".
      if (location.hash.startsWith("#/")) {
        const [name = "", a, b, block] = location.hash.slice(2).split("/").filter(Boolean);
        const to = name === "handbook" && b ? `handbook/${a}/${b}/${block ? `#b-${block}` : ""}` : [name, a, b].filter(Boolean).map((s) => `${s}/`).join("") || "./";
        history.replaceState(null, "", new URL(to, document.baseURI));
      }
      return resolve();
    },
  };
}

/** Go to an address (relative to the site's root), as a link would. */
export function navigate(to, { replace = false } = {}) {
  const url = new URL(to, document.baseURI);
  if (!replace) history.replaceState({ ...history.state, y: scrollY }, "");
  history[replace ? "replaceState" : "pushState"](null, "", url);
  return go();
}

/**
 * For a view that waits before drawing: a check that its page is still the one wanted.
 * Call it before the first wait; once the address has moved on, it returns false.
 */
export function stillHere() {
  const mine = token;
  return () => mine === token;
}

/** Where on the page you were when you left it, coming back to it by Back or Forward; else 0. */
export const returning = () => history.state?.y ?? 0;

/** The route the page before this one was on ("quiz", "results", ...), or null on arrival. */
export const cameFrom = () => before;

/** The block an address points at: "#b-<id>". */
export const blockInAddress = () => location.hash.match(/^#b-(.+)$/)?.[1];
