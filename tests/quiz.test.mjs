// How a test is assembled (docs/architecture.md, "How a test is assembled"), run against
// the real question bank.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { BLUEPRINT, FULL, GAPS, PASS_SHARE, answered, dueIds, isDue, isValidSession, newSession, resumeAt, score } from "../site/js/quiz.js";

const site = new URL("../site/", import.meta.url).pathname;
const read = (path) => JSON.parse(readFileSync(site + path, "utf8"));
const kind = new Map();
for (const f of readdirSync(site + "data/facts")) for (const fact of read(`data/facts/${f}`).facts) kind.set(fact.id, fact.kind);
const bank = readdirSync(site + "data/questions").flatMap((f) => read(`data/questions/${f}`).questions);
const byId = new Map(bank.map((q) => [q.id, q]));
const kindOf = (q) => kind.get(q.facts[0]);

function draw(times, options = {}) {
  return Array.from({ length: times }, () => newSession(bank, { kindOf, ...options }));
}

test("tests follow the blueprint's mix of kinds, within 2 points", () => {
  const counts = {};
  let total = 0;
  for (const session of draw(1500)) {
    for (const item of session.items) {
      const k = kindOf(byId.get(item.id));
      counts[k] = (counts[k] ?? 0) + 1;
      total++;
    }
  }
  for (const [k, share] of Object.entries(BLUEPRINT)) {
    const drawn = (counts[k] ?? 0) / total;
    assert.ok(Math.abs(drawn - share) <= 0.02, `${k}: drawn ${(drawn * 100).toFixed(1)}%, blueprint ${share * 100}%`);
  }
});

test("no test has two questions on the same fact", () => {
  for (const session of draw(500)) {
    const facts = session.items.flatMap((item) => byId.get(item.id).facts);
    assert.equal(new Set(facts).size, facts.length);
  }
});

test("a test has the length asked for, and each question's choices shuffled in full", () => {
  for (const session of draw(50)) {
    assert.equal(session.items.length, 10);
    for (const item of session.items) {
      assert.deepEqual([...item.order].sort(), byId.get(item.id).choices.map((_, i) => i));
    }
  }
});

test("hard mode asks only hard questions, and remembers it is hard", () => {
  for (const session of draw(200, { mode: "hard" })) {
    assert.equal(session.mode, "hard");
    for (const item of session.items) assert.equal(byId.get(item.id).difficulty, "hard");
  }
});

test("the full test is as long as the real one for your age, and follows the blueprint too", () => {
  for (const [age, { of }] of Object.entries(FULL)) {
    for (const session of draw(20, { mode: "full", age })) {
      assert.equal(session.mode, "full");
      assert.equal(session.age, age);
      assert.equal(session.items.length, of);
    }
  }
  assert.equal(newSession(bank, { kindOf, mode: "full" }).items.length, FULL.adult.of, "an adult's, until you say");
});

const DAY = 20000;
const missedOn = (day) => ({ box: 0, day });

test("a miss is due again the same day; a right answer moves a box up only on a later day", () => {
  assert.deepEqual(answered(undefined, false, DAY), { box: 0, day: DAY });
  assert.deepEqual(answered(undefined, true, DAY), { box: 1, day: DAY });
  assert.deepEqual(answered({ box: 0, day: DAY }, true, DAY), { box: 1, day: DAY }, "a miss put right the same day");
  assert.deepEqual(answered({ box: 1, day: DAY }, true, DAY), { box: 1, day: DAY }, "right twice in a day is once");
  assert.deepEqual(answered({ box: 1, day: DAY }, true, DAY + 1), { box: 2, day: DAY + 1 });
  assert.deepEqual(answered({ box: GAPS.length - 1, day: DAY }, true, DAY + 9), { box: GAPS.length - 1, day: DAY + 9 }, "the last box holds");
  assert.deepEqual(answered({ box: 3, day: DAY }, false, DAY + 9), { box: 0, day: DAY + 9 }, "a miss starts it over");
});

test("a question is due once its box's gap has passed", () => {
  GAPS.forEach((gap, box) => {
    assert.equal(isDue({ box, day: DAY }, DAY + gap), true, `box ${box}, ${gap} days on`);
    if (gap) assert.equal(isDue({ box, day: DAY }, DAY + gap - 1), false, `box ${box}, a day early`);
  });
  assert.equal(isDue(undefined, DAY), false, "an unseen question isn't due");
});

test("review asks only the questions due, as many as there are up to ten", () => {
  const due = bank.slice(0, 4).map((q) => q.id);
  const seen = {
    [due[0]]: missedOn(DAY),
    [due[1]]: { box: 1, day: DAY - 1 },
    [due[2]]: { box: 2, day: DAY - 2 },
    [due[3]]: { box: 3, day: DAY - 10 },
    [bank[10].id]: { box: 1, day: DAY },
    [bank[11].id]: { box: 3, day: DAY - 3 },
  };
  assert.deepEqual(dueIds(seen, byId, DAY).sort(), [...due].sort());
  for (const session of draw(50, { mode: "review", seen, day: DAY })) {
    assert.equal(session.mode, "review");
    assert.deepEqual(session.items.map((it) => it.id).sort(), [...due].sort());
  }
  assert.equal(draw(1, { mode: "review", seen: Object.fromEntries(bank.slice(0, 30).map((q) => [q.id, missedOn(DAY)])), day: DAY })[0].items.length, 10);
});

test("retrying a test's misses asks just those, though others are due too", () => {
  const older = bank.slice(0, 6).map((q) => q.id);
  const these = bank.slice(20, 23).map((q) => q.id);
  const seen = Object.fromEntries([...older, ...these].map((id) => [id, missedOn(DAY)]));
  for (const session of draw(50, { mode: "review", seen, day: DAY, only: these })) {
    assert.deepEqual(session.items.map((it) => it.id).sort(), [...these].sort());
  }
});

test("retrying asks every miss, more than ten and on the same fact alike", () => {
  // Fourteen misses, two of them testing the same fact (as a full test's misses can).
  const byFact = new Map();
  for (const q of bank) byFact.set(q.facts[0], [...(byFact.get(q.facts[0]) ?? []), q]);
  const pair = [...byFact.values()].find((qs) => qs.length > 1).slice(0, 2);
  const these = [...pair, ...bank.filter((q) => !pair.includes(q)).slice(0, 12)].map((q) => q.id);
  const seen = Object.fromEntries(these.map((id) => [id, missedOn(DAY)]));
  for (const session of draw(20, { mode: "review", seen, day: DAY, only: these })) {
    assert.deepEqual(session.items.map((it) => it.id).sort(), [...these].sort());
  }
});

test("practising a part asks up to five of its questions, every one in the part and as often as the rest", () => {
  // A part with rules and practices both: the blueprint would favour the rules.
  const pool = new Set([...bank.filter((q) => kindOf(q) === "rule").slice(0, 6), ...bank.filter((q) => kindOf(q) === "practice").slice(0, 6)].map((q) => q.id));
  const part = { section: "s", unit: "u" };
  const counts = {};
  for (const session of draw(2000, { mode: "part", part, inPart: (q) => pool.has(q.id) })) {
    assert.deepEqual(session.part, part);
    assert.ok(session.items.length <= 5);
    for (const it of session.items) {
      assert.ok(pool.has(it.id));
      counts[kindOf(byId.get(it.id))] = (counts[kindOf(byId.get(it.id))] ?? 0) + 1;
    }
  }
  assert.ok(Math.abs(counts.rule / counts.practice - 1) < 0.15, `rules ${counts.rule}, practices ${counts.practice}`);
});

test("missed questions come up more often, and ones not yet due less often", () => {
  const ids = bank.filter((q) => kindOf(q) === "rule").slice(0, 40).map((q) => q.id);
  const missed = Object.fromEntries(ids.slice(0, 20).map((id) => [id, missedOn(DAY)]));
  const notDue = Object.fromEntries(ids.slice(20).map((id) => [id, { box: 2, day: DAY }]));
  const dueAgain = Object.fromEntries(ids.slice(20).map((id) => [id, { box: 2, day: DAY - 2 }]));
  // How often the questions a record is about come up, with it and without.
  const asked = (record, about = record) => {
    let n = 0;
    for (const session of draw(1500, { seen: record, day: DAY })) n += session.items.filter((it) => it.id in about).length;
    return n;
  };
  assert.ok(asked(missed) > asked({}, missed) * 1.2, "missed questions should be favoured");
  assert.ok(asked(notDue) < asked({}, notDue) * 0.9, "questions not yet due should come up less");
  assert.ok(asked(dueAgain) > asked(notDue) * 2, "once due, a question comes back");
});

test("continuing a test goes on past an answered question, but not past the last", () => {
  const session = newSession(bank, { kindOf });
  assert.equal(resumeAt(session), 0);
  session.items[0].picked = 0;
  assert.equal(resumeAt(session), 1);
  session.index = session.items.length - 1;
  session.items[session.index].picked = 0;
  assert.equal(resumeAt(session), session.index);
});

test("a saved test is only resumed if it still matches the bank", () => {
  const session = newSession(bank, { kindOf });
  assert.ok(isValidSession(session, byId));
  assert.ok(!isValidSession({ ...session, items: [{ id: "no-such-question", order: [0, 1, 2], picked: null }] }, byId));
  assert.ok(!isValidSession(null, byId));
});

test("passing takes the real test's count for your age, each over the DMV's 80%", () => {
  for (const [age, { of, correct }] of Object.entries(FULL)) {
    assert.ok(correct / of >= PASS_SHARE, age);
    const session = newSession(bank, { kindOf, mode: "full", age });
    const answerAll = (rightCount) =>
      session.items.forEach((item, i) => (item.picked = i < rightCount ? byId.get(item.id).answer : (byId.get(item.id).answer + 1) % 3));
    answerAll(correct);
    assert.deepEqual(score(session, byId), { correct, total: of, passed: true });
    answerAll(correct - 1);
    assert.equal(score(session, byId).passed, false);
  }
  assert.deepEqual(FULL, { adult: { of: 36, correct: 30 }, minor: { of: 46, correct: 38 } });
});

test("a saved test of a kind there no longer is isn't resumed", () => {
  const session = newSession(bank, { kindOf });
  assert.ok(!isValidSession({ ...session, mode: "missed" }, byId));
});
