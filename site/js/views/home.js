import { html } from "../html.js";
import { github } from "../icons.js";
import { href, title } from "../pages.js";

// The wordmark: a California plate. textLength squeezes the letters to the plate's
// condensed look whatever font the system has.
const plate = html`
  <svg viewBox="0 0 300 150" aria-hidden="true">
    <rect class="plate-body" x="1" y="1" width="298" height="148" rx="12"/>
    <rect class="plate-emboss" x="7" y="7" width="286" height="136" rx="8"/>
    <rect class="plate-sticker" x="244" y="16" width="32" height="19" rx="2"/>
    <text class="plate-state" x="150" y="41" text-anchor="middle">California</text>
    <text class="plate-text" x="150" y="122" text-anchor="middle" textLength="236" lengthAdjust="spacingAndGlyphs">PRACTICE</text>
  </svg>
`;

export function home(el) {
  document.title = title.home;
  el.innerHTML = homePage().toString();
}

/** The page's markup: the same for everyone. Where to go next is on the page each leads to. */
export function homePage() {
  return html`
    <div class="home">
      <h1 class="plate" tabindex="-1"><span class="sr-only">California driver's license practice test</span>${plate}</h1>
      <p class="tagline">Read the California Driver's Handbook and practice for the knowledge test.</p>
      <div class="modes">
        <a class="btn primary big" href="${href.handbook}">Read the handbook</a>
        <a class="btn big" href="${href.practice}">Take a practice test</a>
      </div>
    </div>
    <footer class="fine">
      <p>Free and unofficial. Not affiliated with the California DMV.</p>
      <p class="fine-links">
        <a href="https://dfrancour.dev" target="_blank" rel="noopener"><img src="icons/apple-touch-icon.png" alt="" width="14" height="14">dfrancour.dev</a>
        <a href="https://github.com/dfrancour/ca-dmv-test" target="_blank" rel="noopener">${github}Source on GitHub</a>
      </p>
    </footer>
  `;
}
