// Loads the content files once each and joins them: the handbook's sections and
// blocks (imported) with the outline (ours).

const cache = new Map();

function json(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path)
        .then((res) => {
          if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
          return res.json();
        })
        .catch((err) => {
          cache.delete(path); // a failure isn't kept: the next try fetches again
          throw err;
        }),
    );
  }
  return cache.get(path);
}

/** The handbook's sections in order: number, title, slug, units, file. No blocks. */
export async function contents() {
  const [edition, outline] = await Promise.all([json("data/handbook/edition.json"), json("data/outline.json")]);
  const bySection = new Map(outline.sections.map((s) => [s.number, s]));
  return {
    edition,
    sections: edition.sections.map((s) => ({ ...s, ...bySection.get(s.number) })),
  };
}

/**
 * One section with its units filled in: each unit has a title, its blocks and its facts.
 * @returns {Promise<{ number, title, slug, units: { slug, title, mode?, blocks, facts }[], next? }>}
 */
export async function section(slug) {
  const { sections } = await contents();
  const index = sections.findIndex((s) => s.slug === slug);
  if (index < 0) return null;
  const meta = sections[index];
  const [{ blocks }, { facts }] = await Promise.all([
    json(`data/handbook/${meta.file}`),
    json(`data/facts/${meta.file.split("/").pop()}`),
  ]);

  const starts = new Map(meta.units.map((u, i) => [u.start, i]));
  const units = meta.units.map((u) => ({ ...u, blocks: [], facts: [] }));
  const unitOf = new Map(); // block or list item id -> unit
  let unit = units[0];
  const claim = (items) => items.forEach((b) => (unitOf.set(b.id, unit), claim(b.items ?? [])));
  for (const block of blocks) {
    if (starts.has(block.id)) unit = units[starts.get(block.id)];
    unit.blocks.push(block);
    claim([block]);
  }
  // A fact belongs to the unit of the first text it cites.
  for (const fact of facts) unitOf.get(fact.cites[0].block)?.facts.push(fact);

  // The numbers to mark in each block, in the handbook's own words.
  const marks = new Map();
  for (const fact of facts) {
    for (const { block, marks: found = [] } of fact.cites) {
      if (!marks.has(block)) marks.set(block, new Set());
      for (const m of found) marks.get(block).add(m);
    }
  }
  for (const u of units) {
    u.title ??= plain(u.blocks[0]?.html ?? meta.title);
  }

  return { ...meta, units, unitOf, marks, next: sections[index + 1] };
}

/** Every section with its units filled in (for the handbook's overall progress). */
export async function allSections() {
  const { sections } = await contents();
  return Promise.all(sections.map((s) => section(s.slug)));
}

/**
 * Where everything is: each fact, and each block or list item, with its section and unit.
 * Lets a question cite the handbook text behind its answer.
 */
export async function library() {
  const sections = await allSections();
  const facts = new Map();
  const blocks = new Map();
  for (const section of sections) {
    for (const [id, unit] of section.unitOf) blocks.set(id, { section, unit });
    for (const unit of section.units) for (const fact of unit.facts) facts.set(fact.id, { fact, section, unit });
  }
  return { facts, blocks };
}

/** Every question: the DMV's samples and ours, one file per section (a missing file has none). */
export async function questionBank() {
  const { edition } = await contents();
  const files = ["dmv-samples.json", ...edition.sections.map((s) => s.file.split("/").pop())];
  const docs = await Promise.all(
    files.map((f) =>
      fetch(`data/questions/${f}`)
        .then((res) => (res.ok ? res.json() : { questions: [] }))
        .catch(() => ({ questions: [] })),
    ),
  );
  return docs.flatMap((d) => d.questions);
}

/** A unit's place in the handbook: the units before and after it, across sections. */
export async function neighbours(sectionSlug, unitSlug) {
  const sections = (await contents()).sections;
  const flat = sections.flatMap((s) => s.units.map((u) => ({ section: s, unit: u })));
  const i = flat.findIndex((x) => x.section.slug === sectionSlug && x.unit.slug === unitSlug);
  return { prev: flat[i - 1], next: flat[i + 1] };
}

/**
 * Text of a fragment of the handbook's markup. No DOM, so the page builder can use it too:
 * the import reduces the markup to a few tags, and &amp; is the only entity it leaves.
 */
export function plain(markup) {
  return markup
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** How much there is to read in a unit: its blocks and list items. */
export function size(unit) {
  const count = (items) => items.reduce((n, item) => n + 1 + count(item.items ?? []), 0);
  return count(unit.blocks);
}
