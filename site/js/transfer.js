// Your progress as a link, to carry it to another device or into the installed app: what
// you've read and where, how each question stands in review, your scores and your age.
// It rides in the address's fragment, which the browser never sends to the server.
//
//   practice/#progress=<the progress, as JSON, deflated, in base64url>

import { load, save } from "./storage.js";

const MARK = "#progress=";
const KEYS = ["read", "place", "seen", "history", "age"];

/** A link to this device's progress. */
export async function progressLink() {
  const data = {};
  for (const key of KEYS) {
    const value = load(key, null);
    if (value != null) data[key] = value;
  }
  const packed = await through(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream("deflate-raw"));
  return new URL(`practice/${MARK}${toBase64url(packed)}`, document.baseURI).href;
}

/** True if the text (a link, or an address) carries progress. */
export const carriesProgress = (text) => String(text).includes(MARK);

/** The progress a link carries, or null if it carries none it can read. */
export async function readLink(text) {
  const at = String(text).indexOf(MARK);
  if (at < 0) return null;
  try {
    const bytes = fromBase64url(String(text).slice(at + MARK.length).trim());
    const json = await through(bytes, new DecompressionStream("deflate-raw"));
    const data = JSON.parse(new TextDecoder().decode(json));
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Adds progress from elsewhere to this device's, losing nothing: every part read on either,
 * each question as of the later of the two, every score. Where you are and your age are
 * this device's, if it has them.
 */
export function takeUp(data) {
  const list = (value) => (Array.isArray(value) ? value : []);
  const map = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

  save("read", [...new Set([...list(load("read", [])), ...list(data.read).filter((k) => typeof k === "string")])]);

  if (!load("place", null) && map(data.place).section) save("place", data.place);

  const seen = map(load("seen", {}));
  for (const [id, theirs] of Object.entries(map(data.seen))) {
    if (!Number.isInteger(theirs?.box) || !Number.isInteger(theirs?.day)) continue;
    const ours = seen[id];
    if (!ours || theirs.day > ours.day || (theirs.day === ours.day && theirs.box > ours.box)) seen[id] = { box: theirs.box, day: theirs.day };
  }
  save("seen", seen);

  const scores = new Map([...list(load("history", [])), ...list(data.history)].filter((r) => Number.isFinite(r?.at)).map((r) => [r.at, r]));
  save("history", [...scores.values()].sort((a, b) => a.at - b.at).slice(-50));

  if (!load("age", null) && ["adult", "minor"].includes(data.age)) save("age", data.age);
}

async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

function toBase64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
