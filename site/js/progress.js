// Reading progress. A part of a section (a unit) is read or not; a section is read
// when all its units are. Kept by our slugs, so it carries over to a new edition.
//   read   ["<section>/<unit>", ...]
//   place  { section, unit, block }   where the reader last was

import { load, remove, save } from "./storage.js";

const loadRead = () => ((list) => new Set(Array.isArray(list) ? list : []))(load("read", []));
let read = loadRead();

/** Takes up what another tab has read since. */
export const reloadReading = () => (read = loadRead());

export const isRead = (section, unit) => read.has(`${section}/${unit}`);
export const anyRead = () => read.size > 0;

export function markRead(section, unit) {
  const key = `${section}/${unit}`;
  read = loadRead(); // another tab may have read more since this one loaded
  read.add(key);
  save("read", [...read]);
}

export const sectionRead = (section) => section.units.every((u) => isRead(section.slug, u.slug));

export const place = () => load("place", null);
export const setPlace = (where) => save("place", where);

/** Start over: every part unread, and nowhere to continue from. */
export function resetReading() {
  read = new Set();
  remove("read");
  remove("place");
}

/** How much of the handbook is read, weighted by how much text each unit has. */
export function overall(sections, size) {
  let total = 0;
  let done = 0;
  for (const s of sections) {
    for (const u of s.units) {
      const n = size(u);
      total += n;
      if (isRead(s.slug, u.slug)) done += n;
    }
  }
  return { done, total, percent: Math.floor((done / total) * 100) };
}
