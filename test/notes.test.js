const test = require("node:test");
const assert = require("node:assert/strict");

let notesFor;
test.before(async () => {
  ({ notesFor } = await import("../scripts/notes.mjs"));
});

const SOURCE = [
  "## 0.3.0",
  "newest",
  "",
  "## 0.2.0",
  "body line",
  "",
  "```md",
  "## not a heading, it is inside a fence",
  "```",
  "",
  "tail line",
  "",
  "## 0.1.0",
  "oldest",
  "",
].join("\n");

test("extracts one version's section", () => {
  assert.equal(notesFor("0.3.0", SOURCE), "newest");
  assert.equal(notesFor("0.1.0", SOURCE), "oldest");
});

test("a heading inside a fence does not end the section", () => {
  const body = notesFor("0.2.0", SOURCE);
  assert.match(body, /tail line/);
  assert.match(body, /## not a heading/);
  assert.doesNotMatch(body, /oldest/);
});

test("returns null for an unknown or empty version", () => {
  assert.equal(notesFor("9.9.9", SOURCE), null);
  assert.equal(notesFor("0.2.0", "## 0.2.0\n\n## 0.1.0\nx"), null);
});

test("the real NOTES.md has a section for the shipped manifest version", () => {
  const { version } = require("../extension/manifest.json");
  assert.ok(notesFor(version), `release/NOTES.md is missing "## ${version}"`);
});
