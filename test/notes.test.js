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

const joined = (...lines) => lines.join("\n");

test("a shorter backtick run does not close a longer fence", () => {
  const body = notesFor(
    "1.0.0",
    joined("## 1.0.0", "````", "```", "## still inside", "````", "after", "", "## 0.9.0", "older"),
  );
  assert.match(body, /still inside/);
  assert.match(body, /after/);
  assert.doesNotMatch(body, /older/);
});

test("tilde fences are respected", () => {
  const body = notesFor(
    "1.0.0",
    joined("## 1.0.0", "~~~", "## inside tildes", "~~~", "after", "", "## 0.9.0", "older"),
  );
  assert.match(body, /inside tildes/);
  assert.match(body, /after/);
  assert.doesNotMatch(body, /older/);
});

test("a fence is not closed by the other fence character", () => {
  const body = notesFor(
    "1.0.0",
    joined("## 1.0.0", "~~~", "```", "## inside", "~~~", "after", "", "## 0.9.0", "older"),
  );
  assert.match(body, /inside/);
  assert.doesNotMatch(body, /older/);
});

test("an over-indented backtick line is not a fence opener", () => {
  // Four spaces makes it an indented code block, so the heading after it must
  // still end the section.
  const body = notesFor("1.0.0", joined("## 1.0.0", "    ```", "body", "", "## 0.9.0", "older"));
  assert.match(body, /body/);
  assert.doesNotMatch(body, /older/);
});

test("a closing fence may not carry trailing content", () => {
  const body = notesFor(
    "1.0.0",
    joined("## 1.0.0", "```", "## inside", "``` trailing", "still inside", "```", "after"),
  );
  assert.match(body, /still inside/);
  assert.match(body, /after/);
});

test("a no-break space does not make a closing fence valid", () => {
  // trim() would treat U+00A0 as whitespace and close the block early;
  // CommonMark only allows spaces and tabs after a closing fence.
  const body = notesFor(
    "1.0.0",
    joined("## 1.0.0", "```", "```\u00a0", "## still inside", "```", "after"),
  );
  assert.match(body, /still inside/);
  assert.match(body, /after/);
});

test("a backtick in the info string means it is not a fence opener", () => {
  const body = notesFor("1.0.0", joined("## 1.0.0", "``` aa ```", "body", "", "## 0.9.0", "older"));
  assert.match(body, /body/);
  assert.doesNotMatch(body, /older/);
});
