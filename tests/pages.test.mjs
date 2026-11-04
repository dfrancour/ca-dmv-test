// The built pages (scripts/pages.mjs): every link goes somewhere, and every page says where it is.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { ORIGIN, buildPages } from "../scripts/pages.mjs";

const { files, pages } = await buildPages();
const SITE = new URL("../site/", import.meta.url);
const exists = (path) => files.has(path) || files.has(`${path}index.html`) || existsSync(new URL(path, SITE));

test("every link and image on every page goes to a page or a file", () => {
  for (const { path } of pages) {
    const markup = files.get(path);
    const base = new URL(markup.match(/<base href="([^"]*)">/)[1], new URL(path, ORIGIN));
    for (const [, url] of markup.matchAll(/(?:href|src)="([^"#]*)(?:#[^"]*)?"/g)) {
      const to = new URL(url, base);
      if (to.origin !== new URL(ORIGIN).origin) continue;
      const target = decodeURIComponent(to.pathname.slice(1));
      assert.ok(exists(target), `${path} links to ${url}, which is not there`);
    }
  }
});

test("each indexed page names its own address as canonical, and is in the sitemap", () => {
  const sitemap = files.get("sitemap.xml");
  for (const { path, index } of pages) {
    if (!index) continue;
    const address = new URL(path.replace(/index\.html$/, ""), ORIGIN).href;
    assert.match(files.get(path), new RegExp(`<link rel="canonical" href="${address}">`), path);
    assert.ok(sitemap.includes(`<loc>${address}</loc>`), `${address} is not in the sitemap`);
  }
});

test("a page has one h1, and its content between the markers the service worker looks for", () => {
  for (const { path, index } of pages) {
    const markup = files.get(path);
    assert.match(markup, /<main id="app"><!--page-->[\s\S]*<!--\/page--><\/main>/, path);
    if (index) assert.equal(markup.match(/<h1[\s>]/g)?.length, 1, `${path} should have one h1`);
  }
});
