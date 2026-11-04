// Every page's address and title. Addresses are relative to the site's root (each page's
// <base href> points there), and end in "/" as Vercel serves them (vercel.json, trailingSlash).
// The app and the page builder (scripts/pages.mjs) both use these, so they always agree.

export const href = {
  home: "./",
  handbook: "handbook/",
  section: (section) => `handbook/${section}/`,
  /** A section's questions, to study from (views/questions.js). */
  questions: (section) => `handbook/${section}/questions/`,
  /** A part; with a block, that spot in it. */
  unit: (section, unit, block) => `handbook/${section}/${unit}/${block ? `#b-${block}` : ""}`,
  /** The kinds of test, and the one under way. */
  practice: "practice/",
  quiz: "quiz/",
  results: "results/",
};

export const SITE_NAME = "California DMV Practice Test";
const HANDBOOK = "California Driver's Handbook";

export const title = {
  home: "Free California DMV Practice Test and Driver's Handbook",
  handbook: HANDBOOK,
  section: (sec) => `Section ${sec.number}: ${sec.title} · ${HANDBOOK}`,
  unit: (sec, unit) => `${unit.title} · ${HANDBOOK}, Section ${sec.number}`,
  questions: (sec) => `${sec.title}: practice questions · California DMV knowledge test`,
  practice: `Practice tests · ${SITE_NAME}`,
  quiz: `Practice test · ${SITE_NAME}`,
  /** A test under way, by what it is called ("Hard mode", a part's title). */
  test: (name) => `${name} · ${SITE_NAME}`,
  results: `Results · ${SITE_NAME}`,
};
