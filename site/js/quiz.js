// Pure quiz logic. No DOM access here.

/**
 * @typedef {{ id: string, facts: string[], prompt: string, choices: string[], answer: number, explanation?: string, difficulty: string, figure?: { block: string, alt?: string } }} Question
 * @typedef {{ id: string, order: number[], picked: number | null }} Item
 * @typedef {{ startedAt: number, index: number, mode?: Mode, age?: Age, part?: { section: string, unit: string }, items: Item[] }} Session
 * @typedef {"full" | "hard" | "review" | "part"} Mode
 * @typedef {"adult" | "minor"} Age
 * @typedef {{ box: number, day: number }} Seen  where a question stands in review, and the day you last answered it
 */

/** The DMV's pass mark for the knowledge test. */
export const PASS_SHARE = 0.8;

/**
 * The real test's length, and how many it takes to pass, for adults and for under-18s. The DMV
 * publishes only its pass mark; these are the lengths usually reported, and the counts passing
 * takes on them (each a little over 80%).
 */
export const FULL = { adult: { of: 36, correct: 30 }, minor: { of: 46, correct: 38 } };

/**
 * The kinds of test: which questions each draws from, and how many it asks.
 * With no mode, a test is ten questions from the whole bank. Tests of the whole bank (or
 * its hard questions) follow the blueprint; a part, or your review, are asked evenly.
 * A full test is as long as the real one for your age (FULL).
 */
export const MODES = {
  test: { length: 10, blueprint: true },
  full: { length: FULL.adult.of, blueprint: true },
  hard: { length: 10, blueprint: true, pool: (q) => q.difficulty === "hard" },
  review: { length: 10, pool: (q, { seen, day }) => isDue(seen[q.id], day) },
  part: { length: 5, pool: (q, { inPart }) => inPart(q) },
};

/** What a test of a mode is called; a part's test goes by the part's title, and a plain one is a "Practice test". */
export const NAMES = { full: "Full test", hard: "Hard mode", review: "Review" };

export function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The share of each kind of fact the DMV's sample questions test (docs/architecture.md).
export const BLUEPRINT = { rule: 0.56, practice: 0.26, meaning: 0.1, consequence: 0.03, process: 0.03, definition: 0.02 };

// ---------- review ----------
// A question you have answered comes back after a number of days set by its box. A miss puts
// it in box 0, due again the same day; a right answer on a later day than the last moves it up
// a box, so it is learned by answering it right on separate days, at growing gaps.

/** Days until a question in each box is due again. */
export const GAPS = [0, 1, 2, 4];

/** The day it is where you are, counted in whole days: the unit review works in. */
export const dayOf = (time = Date.now()) => Math.floor((time - new Date(time).getTimezoneOffset() * 60_000) / 86_400_000);

/** Where a question stands after you answer it on `day`, right or not. @returns {Seen} */
export function answered(seen, right, day) {
  if (!right) return { box: 0, day };
  if (!seen) return { box: 1, day };
  // Right again the same day doesn't move it on: it's the days between that make it stick.
  return { box: seen.day === day ? Math.max(seen.box, 1) : Math.min(seen.box + 1, GAPS.length - 1), day };
}

/** True if a question you have answered is due for review on `day`. */
export const isDue = (seen, day) => Boolean(seen) && day - seen.day >= GAPS[seen.box];

/** The questions due for review, of those still in the bank. */
export const dueIds = (seen, byId, day) => Object.keys(seen).filter((id) => byId.has(id) && isDue(seen[id], day));

// How much more or less likely a question is, by where it stands: one you missed most, one
// that isn't due yet least.
const freshness = (seen, day) => (!seen ? 1 : seen.box === 0 ? 2 : isDue(seen, day) ? 1 : 0.25);

/**
 * A new test of the given mode: questions drawn so their kinds follow the blueprint on
 * average (where the mode does), favouring ones you got wrong or haven't seen and passing
 * over ones not yet due, with no two questions on the same fact. Shorter than the mode's
 * length only if the pool runs out. `only` limits it to those questions (retrying a test's
 * misses), and asks every one of them that's in the mode's pool, however many and whatever
 * facts they share.
 * @param {Question[]} bank
 * @param {{ mode?: Mode, kindOf: (q: Question) => string, seen?: Record<string, Seen>, day?: number, age?: Age,
 *           part?: { section: string, unit: string }, inPart?: (q: Question) => boolean, only?: string[] }} how
 * @returns {Session}
 */
export function newSession(bank, { mode, kindOf, seen = {}, day = dayOf(), age = "adult", part, inPart, only }) {
  const { blueprint, pool, length: usual } = MODES[mode ?? "test"];
  const length = only ? only.length : mode === "full" ? FULL[age].of : usual;
  if (pool) bank = bank.filter((q) => pool(q, { seen, day, inPart }));
  if (only) bank = bank.filter((q) => only.includes(q.id));
  const perKind = {};
  for (const q of bank) perKind[kindOf(q)] = (perKind[kindOf(q)] ?? 0) + 1;
  const share = (q) => (blueprint ? (BLUEPRINT[kindOf(q)] ?? 0.02) / perKind[kindOf(q)] : 1);
  const weight = (q) => share(q) * freshness(seen[q.id], day);

  // Weighted sampling without replacement: each question draws random^(1/weight); take the highest.
  const ranked = bank.map((q) => ({ q, key: Math.random() ** (1 / weight(q)) })).sort((a, b) => b.key - a.key);
  const picked = [];
  const covered = new Set();
  for (const { q } of ranked) {
    if (picked.length === length) break;
    if (!only && (q.facts ?? []).some((f) => covered.has(f))) continue;
    (q.facts ?? []).forEach((f) => covered.add(f));
    picked.push(q);
  }

  return {
    startedAt: Date.now(),
    index: 0,
    ...(mode ? { mode } : {}),
    ...(mode === "full" ? { age } : {}),
    ...(mode === "part" ? { part } : {}),
    items: picked.map((q) => ({ id: q.id, order: shuffle(q.choices.map((_, i) => i)), picked: null })),
  };
}

/** True if a stored session still matches the current question bank. */
export function isValidSession(session, byId) {
  return (
    (session?.mode === undefined || session.mode in MODES) &&
    Array.isArray(session?.items) &&
    session.items.length > 0 &&
    Number.isInteger(session.index) &&
    session.items.every((item) => byId.get(item.id)?.choices.length === item.order?.length)
  );
}

export const isCorrect = (item, byId) => item.picked === byId.get(item.id).answer;

export const answeredCount = (session) => session.items.filter((item) => item.picked != null).length;

/**
 * Where "Continue" picks a test up: the question it was left on, or the one after if that
 * was answered (its answer has been seen). The last question stays, to show "Finish".
 */
export function resumeAt(session) {
  const answered = session.items[session.index].picked != null;
  return answered && session.index < session.items.length - 1 ? session.index + 1 : session.index;
}

/** How a test went. `passed` holds it to the real test's bar, for a full test of your age. */
export function score(session, byId) {
  const total = session.items.length;
  const correct = session.items.filter((item) => isCorrect(item, byId)).length;
  const bar = FULL[session.age ?? "adult"];
  return { correct, total, passed: correct * bar.of >= total * bar.correct };
}
