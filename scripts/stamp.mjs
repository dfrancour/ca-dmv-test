#!/usr/bin/env node
// Stamps the build into the service worker, so each deploy gets a fresh offline cache and
// installed apps show a "new version" prompt (site/sw.js). Vercel's build runs it last (vercel.json).
//
//   node scripts/stamp.mjs

import { readFileSync, writeFileSync } from "node:fs";

const SW = new URL("../site/sw.js", import.meta.url);
const build = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || Date.now().toString(36);
const source = readFileSync(SW, "utf8");
if (!source.includes('"__BUILD__"')) throw new Error("site/sw.js has no __BUILD__ to stamp");
writeFileSync(SW, source.replace('"__BUILD__"', JSON.stringify(build)));
console.log(`Stamped build ${build} into site/sw.js`);
