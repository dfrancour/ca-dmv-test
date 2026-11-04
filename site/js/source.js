// The handbook text behind a question's answer: the quotes its facts rest on, with
// numbers set apart, and a link to the part of the handbook they come from.

import { markPattern, renderFigure } from "./blocks.js";
import { html } from "./html.js";
import { href } from "./pages.js";

const MAX_SOURCES = 2;

/** The quotes to show for a question: its facts' quotes, a passage per fact, at most `max` of them. */
function passages(question, lib, max) {
  const shown = new Set();
  const out = [];
  for (const id of question.facts ?? []) {
    const cites = (lib.facts.get(id)?.fact.cites ?? []).filter((c) => !shown.has(c.block));
    if (!cites.length) continue;
    cites.forEach((c) => shown.add(c.block));
    out.push(cites);
    if (out.length === max) break;
  }
  return out;
}

/** @param {{ facts?: string[] }} question  @param {{ facts: Map, blocks: Map }} lib */
export function sources(question, lib, max = MAX_SOURCES) {
  return passages(question, lib, max).map((cites) => source(cites, lib));
}

function source(cites, lib) {
  // A lead-in ("You must stop if:") and its item read as one passage; link to the item.
  const target = cites.at(-1).block;
  const where = lib.blocks.get(target);
  // A fact that rests on a figure (a hand signal, by its caption) shows the figure, caption and all.
  const figure = where.unit.blocks.find((b) => b.id === target && b.type === "figure");
  return html`
    <figure class="source">
      ${figure ? renderFigure(figure) : html`<blockquote>${cites.map((c, i) => html`${i ? " " : ""}${withMarks(c)}`)}</blockquote>`}
      ${pointedAt(cites, where)}
      <figcaption>
        <a href="${href.unit(where.section.slug, where.unit.slug, target)}">
          <span class="figure">${where.section.number}</span> · ${where.unit.title}
        </a>
      </figcaption>
    </figure>
  `;
}

/**
 * The figure a quote points at ("The table below shows…"): the handbook's next block, when it
 * is one. Without it the quote would send you looking for something that isn't there.
 */
function pointedAt(cites, { unit }) {
  if (!cites.some((c) => /\bbelow\b/i.test(c.quote))) return "";
  const at = unit.blocks.findIndex((b) => b.id === cites.at(-1).block);
  const next = at >= 0 ? unit.blocks[at + 1] : null;
  return next?.type === "figure" ? renderFigure(next) : "";
}

function withMarks({ quote, marks = [] }) {
  if (!marks.length) return quote;
  // The pattern captures each mark, so split() alternates text and marks.
  return quote.split(markPattern(marks)).map((part, i) => (i % 2 ? html`<span class="qty">${part}</span>` : part));
}

/**
 * Our explanation, unless it only restates the handbook text shown beneath it
 * (most of its words are in the quotes): then the source says it better.
 */
export function explanation(question, lib, max = MAX_SOURCES) {
  const text = question.explanation;
  if (!text) return "";
  const quoted = passages(question, lib, max)
    .flat()
    .map((c) => c.quote)
    .join(" ");
  const words = (t) => t.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const inQuote = new Set(words(quoted));
  const own = words(text);
  const repeated = own.filter((w) => inQuote.has(w)).length / own.length;
  return repeated >= 0.7 ? "" : text;
}

/**
 * The picture a question asks about (a sign, a signal), from the handbook. Without its caption,
 * which can give the answer away; with the question's own alt text where the handbook's would.
 * A small one (most signs) is drawn larger, to about the height of a line of choices.
 */
export function questionFigure(question, lib) {
  const id = question.figure?.block;
  const block = id && lib.blocks.get(id)?.unit.blocks.find((b) => b.id === id);
  if (!block) return "";
  const scale = Math.min(2, Math.max(1, 96 / block.height));
  return html`<div class="q-figure">${renderFigure({
    ...block,
    caption: null,
    alt: question.figure.alt ?? block.alt,
    width: Math.round(block.width * scale),
    height: Math.round(block.height * scale),
  })}</div>`;
}
