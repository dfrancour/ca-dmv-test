#!/usr/bin/env node
// Checks that site/ hangs together. The deploy runs it (vercel.json); run it before you push.
//
//   node scripts/check.mjs           check
//   node scripts/check.mjs --write   also rewrite the pages and site/precache.json
//
// - The pages (scripts/pages.mjs) are current: every HTML page, the sitemap, robots.txt and
//   llms.txt. Each indexed page has a title of its own and a description.
// - precache.json lists every file in site/ the app uses, so it works offline. The pages
//   other than index.html are left out: offline, the service worker makes any page from it.
// - The outline accounts for every section, and each unit starts at a block of its section, in order.
// - Every fact's quotes appear, word for word, in the blocks they cite, and each cite's
//   marks in its quote; its kind is known, and its quantities appear in its text
//   (docs/architecture.md, "Kind and quantities").
// - Questions follow the format rules in docs/questions.md that a script can check, and
//   the picture a question shows is one of the handbook's figures.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { buildPages } from "./pages.mjs";

const SITE = new URL("../site/", import.meta.url).pathname;
const write = process.argv.includes("--write");
const problems = [];
const problem = (message) => problems.push(message);
const read = (path) => JSON.parse(readFileSync(join(SITE, path), "utf8"));

// ---------- pages ----------

const { files: built, pages } = await buildPages();
const isPage = (p) => p.endsWith("index.html") || p === "404.html";
const listFiles = () =>
  readdirSync(SITE, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => relative(SITE, join(e.parentPath ?? e.path, e.name)));

for (const [path, content] of built) {
  const file = join(SITE, path);
  if (existsSync(file) && readFileSync(file, "utf8") === content) continue;
  if (write) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  } else problem(`site/${path} is out of date: run node scripts/check.mjs --write`);
}
// A page for a part that has gone (renamed, or a new edition).
for (const path of listFiles().filter((p) => isPage(p) && !built.has(p))) {
  if (!write) {
    problem(`site/${path} is no longer a page: run node scripts/check.mjs --write`);
    continue;
  }
  rmSync(join(SITE, path));
  // And the folders it leaves empty.
  for (let dir = dirname(join(SITE, path)); relative(SITE, dir) && !readdirSync(dir).length; dir = dirname(dir)) rmSync(dir, { recursive: true });
}

const titles = new Map();
for (const { path, title, description, index } of pages) {
  if (!index) continue;
  if (titles.has(title)) problem(`site/${path} has the same title as site/${titles.get(title)}: "${title}"`);
  titles.set(title, path);
  if (!description || description.length > 160) problem(`site/${path}: its description should be 1 to 160 characters, not ${description.length}`);
}

// ---------- precache ----------

const CRAWLERS_ONLY = new Set(["sitemap.xml", "robots.txt", "llms.txt", "og.png"]);
const files = listFiles()
  .filter((p) => p !== "sw.js" && p !== "precache.json" && !CRAWLERS_ONLY.has(p) && (p === "index.html" || !isPage(p)))
  .sort();
const precache = JSON.stringify(files, null, 1) + "\n";
if (write) writeFileSync(join(SITE, "precache.json"), precache);
else if (!existsSync(join(SITE, "precache.json")) || readFileSync(join(SITE, "precache.json"), "utf8") !== precache) {
  problem("site/precache.json is out of date: run node scripts/check.mjs --write");
}

// ---------- handbook and outline ----------

const plain = (markup) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const edition = read("data/handbook/edition.json");
const outline = read("data/outline.json");
const text = new Map(); // block id -> its text, for facts
const figures = new Set(); // the figures' block ids, for questions that show one

for (const { number, file } of edition.sections) {
  const { blocks } = read(`data/handbook/${file}`);
  const order = new Map(blocks.map((b, i) => [b.id, i]));
  const walk = (entries) => {
    for (const e of entries) {
      if (text.has(e.id)) problem(`block id ${e.id} is used twice`);
      text.set(e.id, plain(e.html ?? e.caption ?? e.alt ?? (e.rows ?? []).flat().join(" ")));
      if (e.type === "figure") figures.add(e.id);
      if (e.items) walk(e.items);
    }
  };
  walk(blocks);

  const entry = outline.sections.find((s) => s.number === number);
  if (!entry) {
    problem(`outline.json has no entry for section ${number}`);
    continue;
  }
  const slugs = new Set();
  let last = -1;
  entry.units.forEach((unit, i) => {
    if (slugs.has(unit.slug)) problem(`section ${number}: unit slug "${unit.slug}" is used twice`);
    if (unit.slug === "questions") problem(`section ${number}: "questions" can't be a unit's slug; it's the address of the section's questions`);
    if (unit.mode !== undefined && unit.mode !== "skim") problem(`section ${number}: unit "${unit.slug}" has mode "${unit.mode}"; the only mode is "skim" (close reading is the default)`);
    slugs.add(unit.slug);
    const at = order.get(unit.start);
    if (at === undefined) problem(`section ${number}: unit "${unit.slug}" starts at ${unit.start}, which is not a block of the section`);
    else if (i === 0 && at !== 0) problem(`section ${number}: the first unit must start at the first block`);
    else if (at <= last) problem(`section ${number}: unit "${unit.slug}" starts before the unit ahead of it`);
    last = at ?? last;
  });
}
for (const s of outline.sections) {
  if (!edition.sections.some((e) => e.number === s.number)) problem(`outline.json: section ${s.number} is not in the handbook`);
}
if (new Set(outline.sections.map((s) => s.slug)).size !== outline.sections.length) problem("outline.json: section slugs repeat");

// ---------- facts ----------

const KINDS = new Set(["meaning", "rule", "practice", "consequence", "process", "definition"]);
const facts = new Set();
const dir = (path) => (existsSync(join(SITE, path)) ? readdirSync(join(SITE, path)).filter((f) => f.endsWith(".json")) : []);
for (const file of dir("data/facts")) {
  for (const fact of read(`data/facts/${file}`).facts) {
    if (facts.has(fact.id)) problem(`fact "${fact.id}" is defined twice`);
    facts.add(fact.id);
    if (!fact.cites?.length) problem(`fact "${fact.id}" cites nothing`);
    if (!KINDS.has(fact.kind)) problem(`fact "${fact.id}" has kind "${fact.kind}", which is not one of: ${[...KINDS].join(", ")}`);
    for (const q of fact.quantities ?? []) {
      if (!fact.text.includes(q)) problem(`fact "${fact.id}": quantity "${q}" is not in its text`);
    }
    if (fact.quantities && !fact.quantities.length) problem(`fact "${fact.id}": leave quantities out rather than empty`);
    for (const { block, quote, marks = [] } of fact.cites ?? []) {
      if (!text.has(block)) problem(`fact "${fact.id}" cites block ${block}, which is not in the handbook`);
      else if (!text.get(block).includes(quote)) problem(`fact "${fact.id}": "${quote}" is not in block ${block}`);
      for (const m of marks) if (!quote.includes(m)) problem(`fact "${fact.id}": mark "${m}" is not in its quote`);
    }
  }
}

// ---------- questions ----------
// The format rules in docs/questions.md that a script can check.

const questionIds = new Set();
const ourQuestions = []; // for the tells below
const prompts = new Map();
for (const file of dir("data/questions")) {
  const ours = file !== "dmv-samples.json";
  for (const q of read(`data/questions/${file}`).questions) {
    const where = `question ${q.id} (${file})`;
    if (questionIds.has(q.id)) problem(`${where}: id is used twice`);
    questionIds.add(q.id);
    if (!Number.isInteger(q.answer) || !q.choices[q.answer]) problem(`${where}: answer ${q.answer} is not one of its choices`);
    if (!["easy", "medium", "hard"].includes(q.difficulty)) problem(`${where}: difficulty "${q.difficulty}" should be easy, medium or hard`);
    for (const f of q.facts ?? []) if (!facts.has(f)) problem(`${where} tests fact "${f}", which does not exist`);
    if (q.figure && !figures.has(q.figure.block)) problem(`${where} shows figure "${q.figure.block}", which is not a figure in the handbook`);
    if (q.figure?.alt !== undefined && !q.figure.alt.trim()) problem(`${where}: its figure's alt text is empty; leave it out to use the handbook's`);
    const key = q.prompt.toLowerCase().replace(/\s+/g, " ").trim();
    if (prompts.has(key) && ours) problem(`${where}: same prompt as ${prompts.get(key)}`);
    prompts.set(key, q.id);
    if (!ours) continue;
    if (q.choices.length !== 3) problem(`${where}: has ${q.choices.length} choices, not 3`);
    if (new Set(q.choices.map((c) => c.toLowerCase())).size !== q.choices.length) problem(`${where}: choices repeat`);
    if (q.choices.some((c) => /of the above|both a and b/i.test(c))) problem(`${where}: "of the above" choices are not allowed`);
    if (!q.facts?.length) problem(`${where}: tests no facts`);
    if (!q.explanation?.trim()) problem(`${where}: has no explanation`);
    if (q.choices.length === 3) ourQuestions.push(q);
  }
}

// ---------- tells across the bank ----------
// A pattern no single question shows, but a learner who has seen enough of them picks up
// (docs/questions.md, "Tells in the shape of the choices"). By chance each is a third.

const TELL_LIMIT = 0.4;
const firstWord = (choice) => choice.toLowerCase().replace(/^(a|an|the)\s+/, "").match(/^[a-z]+/)?.[0] ?? "";
// When two choices start alike and one doesn't, the one that doesn't.
const oddOneOut = (q) => {
  const words = q.choices.map(firstWord);
  const odd = words.findIndex((w) => words.filter((x) => x === w).length === 1);
  return new Set(words).size === 2 ? odd : -1;
};
function tell(name, questions, isTell) {
  const hits = questions.filter(isTell);
  const share = hits.length / questions.length;
  if (questions.length && share > TELL_LIMIT) {
    problem(
      `${name}: the answer is it ${hits.length} of ${questions.length} times (${Math.round(share * 100)}%; ` +
        `at most ${TELL_LIMIT * 100}%). Among them: ${hits.slice(0, 8).map((q) => q.id).join(", ")}`,
    );
  }
}
const yesNo = ourQuestions.filter((q) => q.choices.every((c) => /^(yes|no)\b/i.test(c)));
tell("Yes/No choices: the odd one out", yesNo, (q) => oddOneOut(q) === q.answer);
tell("Choices where two start alike: the odd one out", ourQuestions.filter((q) => oddOneOut(q) >= 0), (q) => oddOneOut(q) === q.answer);
// When one choice states a flat rule and the others carry a condition ("No, unless…", "Yes, if…"),
// the flat one. Rules are often flat, so a writer has to give some wrong choices no condition
// (over-generalising: "No, never.") and some right answers one.
const CONDITION = /\b(unless|if|only|except|but|as long as|provided|more than|at least|until)\b/i;
const onlyFlat = (q) => {
  const flat = q.choices.flatMap((c, i) => (CONDITION.test(c) ? [] : [i]));
  return flat.length === 1 ? flat[0] : -1;
};
tell("The only choice without a condition", ourQuestions.filter((q) => onlyFlat(q) >= 0), (q) => onlyFlat(q) === q.answer);
// A writer pads the right answer to be complete, or keeps a flat rule terse: either way, length tells.
const lengthTell = (pick) => (q) => {
  const lengths = q.choices.map((c) => c.length);
  const extreme = pick(...lengths);
  return lengths[q.answer] === extreme && lengths.filter((n) => n === extreme).length === 1;
};
tell("The longest choice", ourQuestions, lengthTell(Math.max));
tell("The shortest choice", ourQuestions, lengthTell(Math.min));

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log(`OK: ${files.length} files, ${text.size} blocks, ${facts.size} facts, ${questionIds.size} questions.`);
