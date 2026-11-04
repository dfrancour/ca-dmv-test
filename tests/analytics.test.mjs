// Analytics (site/js/analytics.js) stays off for a browser that asks not to be tracked.

import assert from "node:assert/strict";
import { test } from "node:test";
import { asksNotToTrack } from "../site/js/analytics.js";

test("a browser that asks not to be tracked isn't", () => {
  assert.equal(asksNotToTrack({ globalPrivacyControl: true }), true);
  assert.equal(asksNotToTrack({ doNotTrack: "1" }), true);
});

test("a browser that hasn't asked is counted", () => {
  assert.equal(asksNotToTrack({}), false);
  assert.equal(asksNotToTrack({ globalPrivacyControl: false, doNotTrack: "0" }), false);
  assert.equal(asksNotToTrack({ doNotTrack: "unspecified" }), false);
});
