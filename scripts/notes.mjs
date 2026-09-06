#!/usr/bin/env node
// Pull one version's section out of release/NOTES.md, so the GitHub release
// body and the changelog never drift apart.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Fence handling covers the CommonMark rules that plausibly show up in a
// changelog. It is deliberately not a full parser: a fence-like line inside a
// raw HTML block is still misread. Getting that right needs HTML block
// tracking or a Markdown dependency, and the failure is a release body with
// too much text in it, visible on the release page and fixed by editing
// NOTES.md. Not worth either cost here.
export function notesFor(version, source) {
  const text = source ?? readFileSync(join(root, "release/NOTES.md"), "utf8");
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  // A fenced code block can contain a line starting with "## "; treating that
  // as the next section would truncate the release body. Fences follow the
  // CommonMark rules that actually bite here: ``` or ~~~, indented at most
  // three spaces, closed only by the same character at least as long as the
  // opener, with nothing but spaces or tabs after it.
  let fence = null;
  const end = rest.findIndex((line) => {
    const marker = line.match(/^ {0,3}(`{3,}(?!.*`)|~{3,})/);
    if (fence) {
      const closes =
        marker &&
        marker[1][0] === fence.char &&
        marker[1].length >= fence.length &&
        /^[ \t]*$/.test(line.slice(marker[0].length));
      if (closes) fence = null;
      return false;
    }
    if (marker) {
      fence = { char: marker[1][0], length: marker[1].length };
      return false;
    }
    return /^## /.test(line);
  });
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return body || null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: notes.mjs <version>");
    process.exit(1);
  }
  const body = notesFor(version);
  if (!body) {
    console.error(`release/NOTES.md has no "## ${version}" section`);
    process.exit(1);
  }
  process.stdout.write(body + "\n");
}
