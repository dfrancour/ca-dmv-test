// Builds the site's pages: one HTML file per address, with the page's content already in
// it, so search engines and AI crawlers (most of which don't run JavaScript) can read the
// handbook, and every page has its own title, description and canonical address. The app
// takes the page over when it starts, rendering the same markup with your progress in it.
//
// scripts/check.mjs writes these (--write) and fails when they are out of date. The markup
// comes from the views' own page functions, so the two can't drift apart.
//
//   index.html                         home
//   handbook/index.html                contents
//   handbook/<section>/index.html      a section
//   handbook/<section>/<unit>/index.html  a part
//   handbook/<section>/questions/index.html  its questions, with answers (MIN_QUESTIONS or more)
//   practice/index.html                the kinds of test
//   quiz/, results/                    the app alone (noindex): a reload mid-test needs a file
//   404.html, sitemap.xml, robots.txt, llms.txt

import { existsSync, readFileSync } from "node:fs";

/** Where the site is published. Canonical addresses, the sitemap and share images use it. */
export const ORIGIN = "https://ca-dmv-test.dfrancour.dev/";

const SITE = new URL("../site/", import.meta.url);

// The views load content with fetch("data/…"); here that reads site/.
globalThis.fetch = async (path) => {
  const file = new URL(path, SITE);
  return existsSync(file)
    ? { ok: true, json: async () => JSON.parse(readFileSync(file, "utf8")) }
    : { ok: false, status: 404 };
};

const { contents, library, neighbours, plain, questionBank, section: loadSection } = await import("../site/js/data.js");
const { escape, html, raw } = await import("../site/js/html.js");
const { SITE_NAME, href, title } = await import("../site/js/pages.js");
const { homePage } = await import("../site/js/views/home.js");
const { practicePage } = await import("../site/js/views/practice.js");
const { copiedIn, handbookPage } = await import("../site/js/views/handbook.js");
const { sectionPage } = await import("../site/js/views/section.js");
const { unitPage } = await import("../site/js/views/unit.js");
const { MIN_QUESTIONS, count, questionsPage, sectionQuestions } = await import("../site/js/views/questions.js");

const DESCRIPTION_LENGTH = 160;

/** Every generated file: site-relative path -> contents. Also each page's title and description, for the checks. */
export async function buildPages() {
  const files = new Map();
  const pages = []; // { path, title, description }
  const { edition, sections: outline } = await contents();
  const sections = await Promise.all(outline.map((s) => loadSection(s.slug)));
  const bank = await questionBank();
  const lib = await library();
  const fetched = edition.fetched.slice(0, 10);
  const sitemap = [];

  const handbookCredit = {
    "@type": "CreativeWork",
    name: edition.title,
    url: edition.source,
    publisher: { "@type": "GovernmentOrganization", name: edition.publisher, url: "https://www.dmv.ca.gov/" },
    license: edition.license.url,
  };

  function page({ address, title: pageTitle, description, body, data, index = true }) {
    const path = address === href.home ? "index.html" : `${address}index.html`;
    const depth = address === href.home ? 0 : address.split("/").filter(Boolean).length;
    const url = new URL(address, ORIGIN).href;
    files.set(path, shell({ base: "../".repeat(depth) || "./", url, title: pageTitle, description, body, data, index }));
    pages.push({ path, title: pageTitle, description, index });
    if (index) sitemap.push({ url, lastmod: fetched });
  }

  const crumbs = (...trail) => ({
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", address: href.home }, ...trail].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: new URL(c.address, ORIGIN).href,
    })),
  });
  const webPage = (address, name, description, extra) => ({
    "@type": "WebPage",
    "@id": new URL(address, ORIGIN).href,
    url: new URL(address, ORIGIN).href,
    name,
    description,
    inLanguage: "en-US",
    isPartOf: { "@id": `${ORIGIN}#website` },
    ...extra,
  });

  // ---------- home ----------

  const homeDescription =
    `Free practice tests for the California DMV knowledge test: ${bank.length} questions on the Driver's Handbook, ` +
    "each answer backed by its own words. No ads, no sign-up.";
  page({
    address: href.home,
    title: title.home,
    description: homeDescription,
    body: homePage(),
    data: [
      { "@type": "WebSite", "@id": `${ORIGIN}#website`, name: SITE_NAME, url: ORIGIN, description: homeDescription, inLanguage: "en-US" },
    ],
  });

  // ---------- the tests ----------

  const practiceDescription =
    "Free California DMV practice tests: ten questions at a time, a full-length test for adults or under-18s, " +
    "or hard mode. Every answer cites the handbook.";
  page({
    address: href.practice,
    title: title.practice,
    description: practiceDescription,
    body: practicePage(),
    data: [webPage(href.practice, "Practice tests", practiceDescription), crumbs({ name: "Practice tests", address: href.practice })],
  });

  // ---------- the handbook ----------

  const handbookDescription =
    "The California DMV's Driver's Handbook in short parts, easy to read on a phone, with practice questions on what you've read.";
  page({
    address: href.handbook,
    title: title.handbook,
    description: handbookDescription,
    body: handbookPage(edition, sections),
    data: [
      webPage(href.handbook, edition.title, handbookDescription, { isBasedOn: handbookCredit, license: edition.license.url, dateModified: fetched }),
      crumbs({ name: "Handbook", address: href.handbook }),
    ],
  });

  for (const sec of sections) {
    const { pages: dmvPages = [] } = JSON.parse(readFileSync(new URL(`data/handbook/${sec.file}`, SITE), "utf8"));
    const source = { ...handbookCredit, name: `${edition.title}: ${sec.title}`, url: dmvPages[0] ?? edition.source };
    const sectionCrumb = { name: `Section ${sec.number}: ${sec.title}`, address: href.section(sec.slug) };
    const description = clip(`Section ${sec.number} of the California Driver's Handbook, ${sec.title}: ${sec.units.map((u) => u.title).join(", ")}.`);
    const parts = sectionQuestions(sec, bank);
    page({
      address: href.section(sec.slug),
      title: title.section(sec),
      description,
      body: sectionPage(sec, count(parts)),
      data: [
        webPage(href.section(sec.slug), sec.title, description, { isBasedOn: source, license: edition.license.url, dateModified: fetched }),
        crumbs({ name: "Handbook", address: href.handbook }, sectionCrumb),
      ],
    });

    for (const [index, u] of sec.units.entries()) {
      const { prev, next } = await neighbours(sec.slug, u.slug);
      const titleOf = (x) => x && sections.find((s) => s.slug === x.section.slug).units.find((y) => y.slug === x.unit.slug).title;
      const [prevTitle, nextTitle] = [titleOf(prev), titleOf(next)];
      const factIds = new Set(u.facts.map((f) => f.id));
      const practice = bank.some((q) => q.facts?.some((id) => factIds.has(id)));
      const description = clip(unitText(u) || `${u.title}, from Section ${sec.number} of the California Driver's Handbook: ${sec.title}.`);
      const address = href.unit(sec.slug, u.slug);
      page({
        address,
        title: title.unit(sec, u),
        description,
        body: unitPage(sec, index, { prev, prevTitle, next, nextTitle, practice }),
        data: [
          webPage(address, u.title, description, { isBasedOn: source, license: edition.license.url, dateModified: fetched }),
          crumbs({ name: "Handbook", address: href.handbook }, sectionCrumb, { name: u.title, address }),
        ],
      });
    }

    if (count(parts) >= MIN_QUESTIONS) {
      const address = href.questions(sec.slug);
      const description = clip(
        `${count(parts)} free practice questions on ${sec.title}, Section ${sec.number} of the California Driver's Handbook. ` +
          "Each with its answer and the handbook text behind it.",
      );
      page({
        address,
        title: title.questions(sec),
        description,
        body: questionsPage(sec, parts, lib),
        data: [
          {
            ...webPage(address, `${sec.title}: practice questions`, description, { isBasedOn: source, dateModified: fetched }),
            "@type": ["WebPage", "Quiz"],
            educationalUse: "practice",
            about: { "@type": "Thing", name: `California driver's license knowledge test: ${sec.title}` },
            hasPart: parts.flatMap((p) => p.questions).map((q) => ({
              "@type": "Question",
              "@id": `${new URL(address, ORIGIN).href}#${q.id}`,
              eduQuestionType: "Multiple choice",
              text: q.prompt,
              acceptedAnswer: { "@type": "Answer", text: q.choices[q.answer], ...(q.explanation ? { answerExplanation: { "@type": "Comment", text: q.explanation } } : {}) },
              suggestedAnswer: q.choices.filter((_, i) => i !== q.answer).map((text) => ({ "@type": "Answer", text })),
            })),
          },
          crumbs({ name: "Handbook", address: href.handbook }, sectionCrumb, { name: "Practice questions", address }),
        ],
      });
    }
  }

  // ---------- the app alone ----------

  for (const [address, pageTitle] of [
    [href.quiz, title.quiz],
    [href.results, title.results],
  ]) {
    page({ address, title: pageTitle, description: homeDescription, body: "", index: false });
  }

  // Any other address. Vercel serves it at the address asked for, so its links can't be
  // relative to where it is: the site is at the root of its domain.
  files.set(
    "404.html",
    shell({
      base: "/",
      title: `Page not found · ${SITE_NAME}`,
      description: homeDescription,
      index: false,
      app: false,
      body: html`
        <div class="home">
          <h1 class="page-title" tabindex="-1">Page not found</h1>
          <p class="tagline">There's nothing at this address.</p>
          <div class="modes"><a class="btn primary big" href="${href.home}">Home</a></div>
        </div>
      `,
    }),
  );

  // ---------- for crawlers ----------

  files.set(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      sitemap.map((u) => `  <url><loc>${escape(u.url)}</loc><lastmod>${u.lastmod}</lastmod></url>\n`).join("") +
      `</urlset>\n`,
  );

  files.set(
    "robots.txt",
    `# Search engines and AI crawlers are all welcome.\nUser-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}sitemap.xml\n`,
  );

  files.set("llms.txt", llms({ edition, sections, bank, homeDescription }));

  return { files, pages };
}

// ---------- the page around the content ----------

function shell({ base, url, title: pageTitle, description, body, data = [], index, app = true }) {
  const jsonLd = data.length
    ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": data }).replace(/</g, "\\u003c")}</script>\n`
    : "";
  const meta = html`
<meta name="description" content="${description}">
${index ? html`<link rel="canonical" href="${url}">` : raw(`<meta name="robots" content="noindex">`)}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${pageTitle}">
<meta property="og:description" content="${description}">
${url ? html`<meta property="og:url" content="${url}">` : ""}
<meta property="og:image" content="${ORIGIN}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A California license plate that reads PRACTICE">
<meta name="twitter:card" content="summary_large_image">`;
  // The page's own content sits between the markers; the service worker empties it to make
  // the app's shell for any address (sw.js).
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<base href="${base}">
<title>${escape(pageTitle)}</title>${meta}
<meta name="theme-color" content="#f5f9fb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1214" media="(prefers-color-scheme: dark)">
<link rel="license" href="https://creativecommons.org/licenses/by-nc/4.0/">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="stylesheet" href="styles.css">
<script type="module" src="js/analytics.js"></script>
${app ? `<script type="module" src="app.js"></script>\n` : ""}${jsonLd}</head>
<body>
<main id="app"><!--page-->${tidy(String(body))}<!--/page--></main>
<div id="announcer" class="sr-only" aria-live="polite"></div>
</body>
</html>
`;
}

/** The template literals' indentation, dropped: smaller pages, same markup. */
const tidy = (markup) =>
  markup
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

/** The opening text of a part, for its description. */
function unitText(unit) {
  const texts = [];
  const walk = (blocks) => {
    for (const b of blocks) {
      if (b.type === "heading" || b.type === "figure") continue;
      if (b.html) texts.push(plain(b.html));
      if (b.rows) texts.push(b.rows.map(([term, meaning]) => `${plain(term)}: ${plain(meaning ?? "")}`).join(" "));
      if (b.items) walk(b.items);
      if (texts.join(" ").length >= DESCRIPTION_LENGTH) return;
    }
  };
  walk(unit.blocks);
  return texts.join(" ");
}

/** Cut at a word, under the length search results show. */
function clip(text, max = DESCRIPTION_LENGTH) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** A map of the site for AI tools (llmstxt.org). */
function llms({ edition, sections, bank, homeDescription }) {
  const at = (address) => new URL(address, ORIGIN).href;
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${homeDescription}`,
    "",
    "Unofficial: not affiliated with the California DMV.",
    `The handbook text is the DMV's: ${edition.license.attribution} ${copiedIn(edition)} ${edition.license.changes}`,
    `Original: ${edition.source}`,
    "",
    "## The handbook",
    "",
  ];
  for (const sec of sections) {
    const file = sec.file.split("/").pop();
    const data = ["facts", "questions"].filter((d) => existsSync(new URL(`data/${d}/${file}`, SITE))).map((d) => `[${d}](${at(`data/${d}/${file}`)})`);
    lines.push(`- [Section ${sec.number}: ${sec.title}](${at(href.section(sec.slug))})${data.length ? ` (${data.join(", ")})` : ""}`);
    for (const u of sec.units) lines.push(`  - [${u.title}](${at(href.unit(sec.slug, u.slug))})`);
    const asked = count(sectionQuestions(sec, bank));
    if (asked >= MIN_QUESTIONS) lines.push(`  - [Practice questions, with answers](${at(href.questions(sec.slug))}): ${asked}`);
  }
  lines.push(
    "",
    "## Data",
    "",
    "Each section's facts are testable statements, each with the handbook text it quotes. Its questions are multiple choice, with the answer, an explanation and the facts they test.",
    "",
    `- [The DMV's sample tests](${at("data/questions/dmv-samples.json")})`,
    `- [The handbook, as imported](${at("data/handbook/edition.json")}): its sections, in data/handbook/sections/`,
    "",
  );
  return lines.join("\n");
}
