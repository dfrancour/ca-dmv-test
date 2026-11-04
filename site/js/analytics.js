// Vercel Web Analytics and Speed Insights: anonymous visit counts and page speed, without cookies.
// Vercel serves both scripts under _vercel/ once they're turned on for the project. A browser
// that asks not to be tracked (Global Privacy Control or Do Not Track) loads neither.

/** Whether the browser asks sites not to track it. */
export const asksNotToTrack = (nav) => nav?.globalPrivacyControl === true || nav?.doNotTrack === "1";

if (globalThis.document && !asksNotToTrack(navigator)) {
  for (const src of ["_vercel/insights/script.js", "_vercel/speed-insights/script.js"]) {
    const script = document.createElement("script");
    script.src = src;
    document.head.append(script);
  }
}
