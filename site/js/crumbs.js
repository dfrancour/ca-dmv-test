import { html } from "./html.js";
import { house } from "./icons.js";
import { href } from "./pages.js";

/**
 * Where a page sits: the pages above it, each a link. Home is the house.
 * @param {{ href: string, label: string }[]} trail  below Home, outermost first
 */
export function crumbs(trail = []) {
  return html`
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        <li><a class="crumb-home" href="${href.home}" aria-label="Home">${house}</a></li>
        ${trail.map((c) => html`<li><a href="${c.href}">${c.label}</a></li>`)}
      </ol>
    </nav>
  `;
}
