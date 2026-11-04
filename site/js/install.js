// Installing the site as an app, which keeps its progress safer: Safari clears a site's
// data after a week without a visit, but not an installed app's. Offered once, on a visit
// on a later day than the first, so only to someone coming back.

import { dayOf } from "./quiz.js";
import { load, save } from "./storage.js";

let deferred = null; // Chrome's install prompt, kept for when we offer it
let onReady = null;

if (typeof addEventListener !== "undefined") {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // offer it ourselves, later, rather than at once
    deferred = e;
    onReady?.();
  });
}

/** True when running as the installed app. */
export const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

/** True on an iPhone or iPad, where installing is Add to Home Screen, in the Share menu. */
export const onApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Offers to install, once, if this isn't the first day you've visited. `offer(install)`
 * shows the offer, or returns false if now isn't the time (then it's offered another visit);
 * `install` is Chrome's prompt, or null where there is none (iPhone).
 */
export function offerInstall(offer) {
  const today = dayOf();
  const first = load("firstDay", null);
  if (first == null) return save("firstDay", today);
  if (today === first || load("offered", false) || installed()) return;

  const make = () => {
    onReady = null;
    if (offer(deferred ? () => deferred.prompt() : null) !== false) save("offered", true);
  };
  if (deferred) make();
  else if (onApple()) make();
  else onReady = make; // Chrome may say it can install a little after the page loads
}
