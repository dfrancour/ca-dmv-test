// A figure drawn smaller than it is (a chart, a page of signs) opens full size on a tap.
// Views call markFigures() on what they draw; the listeners here serve every page.

import { html } from "./html.js";
import { expand } from "./icons.js";

/** Notes which figures are drawn smaller than they are, and gives those an enlarge button. */
export function markFigures(root = document) {
  for (const fig of root.querySelectorAll(".hb-figure")) {
    const img = fig.querySelector("img");
    if (!img.clientWidth) continue; // not laid out (folded away): looked at again when shown
    const on = Number(img.getAttribute("width")) > img.clientWidth * 1.15;
    fig.classList.toggle("is-shrunk", on);
    if (on && !fig.querySelector(".hb-zoom")) {
      img.insertAdjacentHTML("afterend", html`<button class="hb-zoom" type="button" aria-label="Enlarge">${expand}</button>`.toString());
    }
  }
}

let dialog = null;

function enlarge(img) {
  if (!dialog) {
    document.body.insertAdjacentHTML(
      "beforeend",
      html`<dialog class="zoom" aria-label="Enlarged figure"><div class="zoom-figure"><img alt=""></div><button class="btn zoom-close" type="button">Close</button></dialog>`.toString(),
    );
    dialog = document.body.lastElementChild;
    // A tap anywhere closes it; a drag to look around doesn't.
    dialog.addEventListener("click", () => dialog.close());
  }
  const big = dialog.querySelector("img");
  big.src = img.src;
  big.alt = img.alt;
  dialog.showModal();
  dialog.scrollTo(0, 0);
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const fig = e.target.closest(".hb-figure.is-shrunk");
    if (fig && e.target.closest("img, .hb-zoom")) enlarge(fig.querySelector("img"));
  });
  addEventListener("resize", () => markFigures());
  // A folded answer opened: its figures are laid out now.
  document.addEventListener("toggle", (e) => e.target.open && markFigures(e.target), true);
  // Leaving the page leaves the enlarged figure too.
  addEventListener("popstate", () => dialog?.close());
}
