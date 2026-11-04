// Renders the handbook's blocks. Their markup was reduced to strong, em, a, br and p
// by the import, so it is inserted as it is.

import { html, raw } from "./html.js";

export function renderBlocks(blocks) {
  // Figures in a run (the hand signals, the roundabout turns) sit side by side.
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === "figure" && blocks[i + 1]?.type === "figure") {
      const run = [];
      while (blocks[i]?.type === "figure") run.push(blocks[i++]);
      i--;
      out.push(html`<div class="hb-figures">${run.map(renderBlock)}</div>`);
    } else {
      out.push(renderBlock(blocks[i]));
    }
  }
  return out;
}

function renderBlock(block) {
  const id = `b-${block.id}`;
  switch (block.type) {
    case "heading": {
      const tag = `h${Math.min(block.level, 4)}`;
      return raw(`<${tag} class="hb-h${block.level}" id="${id}" data-block="${block.id}">${block.html}</${tag}>`);
    }
    case "paragraph":
      return html`<p id="${id}" data-block="${block.id}">${raw(block.html)}</p>`;
    case "note":
      return html`
        <aside class="hb-note" id="${id}" data-block="${block.id}">
          <span class="eyebrow">${block.kind === "important" ? "Important" : "Note"}</span>
          <p>${raw(block.html)}</p>
        </aside>
      `;
    case "list":
      return renderList(block, id);
    case "figure":
      return renderFigure(block, id);
    case "table":
      return renderTable(block, id);
    default:
      return "";
  }
}

function renderList(list, id) {
  const items = (entries) =>
    entries.map(
      (item) => html`
        <li id="b-${item.id}" data-block="${item.id}">
          ${raw(item.html)}
          ${item.items ? html`<ul>${items(item.items)}</ul>` : ""}
        </li>
      `,
    );
  return list.ordered
    ? html`<ol class="hb-list" id="${id}">${items(list.items)}</ol>`
    : html`<ul class="hb-list" id="${id}">${items(list.items)}</ul>`;
}

/** A figure; outside the reader (beside a quote), without the id that marks its place. */
export function renderFigure(figure, id) {
  const small = figure.width && figure.width <= 160;
  return html`
    <figure class="hb-figure ${small ? "is-small" : ""}" ${id ? raw(`id="${id}" data-block="${figure.id}"`) : ""}>
      <img
        src="data/handbook/${figure.file}"
        alt="${figure.alt}"
        ${figure.width ? raw(`width="${figure.width}" height="${figure.height}"`) : ""}
        loading="lazy"
        decoding="async"
      >
      ${figure.caption ? html`<figcaption>${raw(figure.caption)}</figcaption>` : ""}
    </figure>
  `;
}

// The handbook's tables are two columns of term and meaning (the glossary), so
// they read as a definition list.
function renderTable(table, id) {
  return html`
    <dl class="hb-terms" id="${id}" data-block="${table.id}">
      ${table.rows.map(([term, meaning]) => html`<dt>${raw(term)}</dt><dd>${raw(meaning ?? "")}</dd>`)}
    </dl>
  `;
}

/**
 * A pattern that finds any of `words` (marks, in the handbook's words) as a whole number:
 * "18" matches in "under 18 years" but not in "180 feet" or "1.18". Longer marks win.
 * The match is captured, so the pattern can also split text around its marks.
 */
export function markPattern(words) {
  const alternatives = [...words]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(`(?<![\\w.,$])(${alternatives})(?![\\w])`, "g");
}

/**
 * Set the numbers a reader should remember apart from the text around them: in each
 * block, wrap the marks its facts name (`marks`: block id -> strings, in the handbook's
 * words). Only the block's own text is searched, not the list items nested in it.
 */
export function markQuantities(root, marks) {
  for (const el of root.querySelectorAll("[data-block]")) {
    const words = [...(marks.get(el.dataset.block) ?? [])];
    if (!words.length) continue;
    const find = markPattern(words);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement.closest("[data-block]") === el && !node.parentElement.closest(".qty")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.data;
      find.lastIndex = 0;
      if (!find.test(text)) continue;
      const out = document.createDocumentFragment();
      let at = 0;
      find.lastIndex = 0;
      for (const m of text.matchAll(find)) {
        out.append(text.slice(at, m.index));
        const span = document.createElement("span");
        span.className = "qty";
        span.textContent = m[0];
        out.append(span);
        at = m.index + m[0].length;
      }
      out.append(text.slice(at));
      node.replaceWith(out);
    }
  }
}
