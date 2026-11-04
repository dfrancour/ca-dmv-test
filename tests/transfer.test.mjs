// Carrying progress in a link (site/js/transfer.js): it survives the trip, and adding it
// to a device's own progress loses nothing from either.

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

// The browser's storage, and the page's address, as transfer.js uses them.
const stored = new Map();
globalThis.localStorage = {
  getItem: (k) => stored.get(k) ?? null,
  setItem: (k, v) => stored.set(k, String(v)),
  removeItem: (k) => stored.delete(k),
};
globalThis.document = { baseURI: "https://example.test/" }; // the site's root, as every page's <base href> names it

const { load, save } = await import("../site/js/storage.js");
const { carriesProgress, progressLink, readLink, takeUp } = await import("../site/js/transfer.js");

beforeEach(() => stored.clear());

test("a link carries the progress, and reads back as it was", async () => {
  const seen = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`q-question-number-${i}`, { box: i % 4, day: 20000 + (i % 9) }]));
  save("read", ["rules-of-the-road/signs"]);
  save("seen", seen);
  save("history", [{ at: 1, correct: 30, total: 36, mode: "full", passed: true }]);
  save("age", "minor");
  save("session", { items: [] }); // a test under way stays on its device

  const link = await progressLink();
  assert.ok(link.startsWith("https://example.test/practice/#progress="));
  assert.ok(carriesProgress(link));
  assert.ok(link.length < 8000, `a link short enough to paste: ${link.length}`);
  assert.deepEqual(await readLink(link), { read: ["rules-of-the-road/signs"], seen, history: load("history"), age: "minor" });
});

test("a link that carries nothing, or something broken, reads as nothing", async () => {
  assert.equal(await readLink("https://example.test/practice/"), null);
  assert.equal(await readLink("https://example.test/practice/#progress=not-really"), null);
});

test("adding progress keeps both devices' reading, each question as of the later day, and every score", () => {
  save("read", ["a/one", "a/two"]);
  save("seen", { kept: { box: 2, day: 10 }, newer: { box: 3, day: 5 }, same: { box: 1, day: 7 } });
  save("history", [{ at: 1, correct: 5, total: 10 }, { at: 3, correct: 7, total: 10 }]);
  save("age", "adult");

  takeUp({
    read: ["a/two", "b/three"],
    place: { section: "b", unit: "three" },
    seen: { kept: { box: 0, day: 9 }, newer: { box: 0, day: 6 }, same: { box: 2, day: 7 }, added: { box: 1, day: 4 }, broken: { box: "x" } },
    history: [{ at: 2, correct: 8, total: 10 }, { at: 3, correct: 7, total: 10 }],
    age: "minor",
  });

  assert.deepEqual(new Set(load("read")), new Set(["a/one", "a/two", "b/three"]));
  assert.deepEqual(load("place"), { section: "b", unit: "three" }, "where you were, since this device had nowhere");
  assert.deepEqual(load("seen"), { kept: { box: 2, day: 10 }, newer: { box: 0, day: 6 }, same: { box: 2, day: 7 }, added: { box: 1, day: 4 } });
  assert.deepEqual(load("history").map((r) => r.at), [1, 2, 3]);
  assert.equal(load("age"), "adult", "this device's age stands");
});
