const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseTime,
  scheduledMode,
  effectiveMode,
  nextBoundary,
  hostFromInput,
  hostMatches,
} = require("../extension/shared.js");

test("parses times", () => {
  assert.deepEqual(parseTime("7:00"), { hours: 7, minutes: 0, label: "07:00" });
  assert.deepEqual(parseTime("18:00"), { hours: 18, minutes: 0, label: "18:00" });
  assert.equal(parseTime("25:00"), null);
});

test("morning is light", () => {
  const noon = new Date("2026-09-01T12:00:00");
  assert.equal(scheduledMode("07:00", "18:00", noon), "light");
});

test("evening is dark", () => {
  const night = new Date("2026-09-01T19:10:00");
  assert.equal(scheduledMode("07:00", "18:00", night), "dark");
});

test("override wins", () => {
  const noon = new Date("2026-09-01T12:00:00");
  assert.equal(effectiveMode({ override: "dark", lightAt: "07:00", darkAt: "18:00" }, noon), "dark");
});

test("until label follows schedule", () => {
  const noon = new Date("2026-09-01T12:00:00");
  assert.equal(nextBoundary({ override: "auto", lightAt: "07:00", darkAt: "18:00" }, noon), "18:00");
});

test("normalizes pasted URLs", () => {
  assert.equal(hostFromInput("https://ChatGPT.com/c/123"), "chatgpt.com");
  assert.equal(hostFromInput("linear.app"), "linear.app");
});

test("matches subdomains", () => {
  assert.equal(hostMatches("linear.app", "app.linear.app"), true);
  assert.equal(hostMatches("linear.app", "github.com"), false);
});
