// Marking numbers in the handbook's text, and escaping what we insert into the page.

import assert from "node:assert/strict";
import { test } from "node:test";
import { markPattern } from "../site/js/blocks.js";
import { escape, html, raw } from "../site/js/html.js";

const marked = (words, text) => [...text.matchAll(markPattern(words))].map((m) => m[0]);

test("a mark matches only as a whole number", () => {
  assert.deepEqual(marked(["18"], "under 18 years old"), ["18"]);
  assert.deepEqual(marked(["18"], "within 180 feet"), []);
  assert.deepEqual(marked(["18"], "a BAC of 1.18"), []);
  assert.deepEqual(marked(["15 feet"], "15 feet and 150 feet"), ["15 feet"]);
});

test("marks with symbols and brackets match as written", () => {
  assert.deepEqual(marked(["0.08%"], "a BAC of 0.08% or higher"), ["0.08%"]);
  assert.deepEqual(marked(["$1,000"], "more than $1,000 in damage"), ["$1,000"]);
  assert.deepEqual(marked(["Three (3) feet"], "Three (3) feet of distance"), ["Three (3) feet"]);
});

test("the longer of two overlapping marks wins", () => {
  assert.deepEqual(marked(["100", "100 feet"], "within 100 feet"), ["100 feet"]);
});

test("splitting a quote alternates text and marks", () => {
  const parts = "The limit is 15 mph within 100 feet.".split(markPattern(["15 mph", "100 feet"]));
  assert.deepEqual(parts, ["The limit is ", "15 mph", " within ", "100 feet", "."]);
});

test("html`` escapes what it interpolates, but not raw() or nested html``", () => {
  assert.equal(escape(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(String(html`<p>${"<b>"}</p>`), "<p>&lt;b&gt;</p>");
  assert.equal(String(html`<p>${raw("<b>ok</b>")}</p>`), "<p><b>ok</b></p>");
  assert.equal(String(html`<ul>${["a", "b"].map((x) => html`<li>${x}</li>`)}</ul>`), "<ul><li>a</li><li>b</li></ul>");
  assert.equal(String(html`${null}${false}${undefined}`), "");
});
