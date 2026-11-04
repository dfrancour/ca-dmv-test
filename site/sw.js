// Service worker: makes the app installable and fully offline.
//
// VERSION is replaced with the commit SHA at deploy time (scripts/stamp.mjs).
// Each deploy gets a fresh cache; old caches are deleted on activate.
// Locally (unstamped) it runs network-first so edits show up on reload.

const VERSION = "__BUILD__";
const DEV = VERSION.startsWith("__");
const CACHE = `cdltp-${VERSION}`;

// precache.json lists every file the app uses (written by scripts/check.mjs --write; the deploy checks it).
// "reload" bypasses the HTTP cache so nothing stale is stored.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const files = await (await fetch("precache.json", { cache: "reload" })).json();
      const cache = await caches.open(CACHE);
      await cache.addAll(["./", ...files].map((url) => new Request(url, { cache: "reload" })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("cdltp-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  // Vercel's analytics (js/analytics.js) goes to the network, never the offline cache.
  if (inScope(url).startsWith("_vercel/")) return;
  // Event streams (the dev server's live reload) never end, so they can't be cached.
  if (request.headers.get("accept") === "text/event-stream") return;
  if (!DEV && request.mode === "navigate" && isAppPage(url)) {
    event.respondWith(caches.open(CACHE).then(shell).then((page) => page ?? fetch(request)));
    return;
  }
  event.respondWith(DEV ? networkFirst(request) : cacheFirst(request));
});

// The app's pages (js/pages.js): home, the handbook, the tests, the test and its results.
const APP_PAGE = /^(index\.html)?$|^(handbook|practice|quiz|results)(\/|$)/;
const isAppPage = (url) => APP_PAGE.test(inScope(url));
const inScope = (url) => url.pathname.slice(new URL(self.registration.scope).pathname.length);

/**
 * Any of the app's pages, made from the cached home page, so every page comes from the same
 * version and works offline: its <base> names the root wherever the page is, and its content
 * goes (the app renders the page asked for). scripts/pages.mjs marks the content.
 */
async function shell(cache) {
  const home = await cache.match("./");
  if (!home) return undefined;
  const page = (await home.text())
    .replace(/<base href="[^"]*">/, `<base href="${self.registration.scope}">`)
    .replace(/<!--page-->[\s\S]*<!--\/page-->/, "");
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch (err) {
    if (request.mode === "navigate") return shell(cache);
    throw err;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request.url, { cache: "no-cache" });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = (await cache.match(request, { ignoreSearch: true })) ?? (request.mode === "navigate" ? await shell(cache) : undefined);
    if (hit) return hit;
    throw err;
  }
}
