#!/usr/bin/env node
// Cut a release: bump the manifest, tag it, push. CI does the rest.
//
//   npm run release -- patch      0.2.1 -> 0.2.2
//   npm run release -- minor      0.2.1 -> 0.3.0
//   npm run release -- 1.0.0      explicit
//
// Refuses to run on a dirty tree, off main, or without a matching section in
// release/NOTES.md, because all three produce a release that lies about itself.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { notesFor } from "./notes.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "extension/manifest.json");

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function die(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const [major, minor, patch] = current.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  return die(`unknown bump "${bump}" (use major, minor, patch, or an explicit x.y.z)`);
}

const bump = process.argv[2];
if (!bump) die("usage: npm run release -- <major|minor|patch|x.y.z> [--dry-run]");
const dryRun = process.argv.includes("--dry-run");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const version = nextVersion(manifest.version, bump);

if (git("status", "--porcelain")) die("working tree is dirty; commit or stash first");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") die(`on "${branch}"; release from main`);
if (git("tag", "--list", `v${version}`)) die(`tag v${version} already exists locally`);
// The local check alone is not enough: a tag pushed from elsewhere would only
// surface after the bump commit had already been made and pushed.
if (git("ls-remote", "--tags", "origin", `refs/tags/v${version}`)) {
  die(`tag v${version} already exists on origin`);
}
if (!notesFor(version)) die(`release/NOTES.md has no "## ${version}" section; write it first`);

// The manifest can already sit at the target version when a release is cut
// from a commit that bumped it by hand. Tag that commit rather than stacking
// an empty bump commit on top of it.
const alreadyBumped = manifest.version === version;
console.log(
  alreadyBumped
    ? `tagging ${version} (manifest is already there)`
    : `${manifest.version} -> ${version}`,
);
if (dryRun) {
  console.log("dry run, nothing written");
  process.exit(0);
}

if (!alreadyBumped) {
  manifest.version = version;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  git("add", "extension/manifest.json");
  git("commit", "-m", `Daylight ${version}`);
}

git("tag", "-a", `v${version}`, "-m", `Daylight ${version}`);
// One atomic push: main and the tag land together or not at all. Pushing them
// separately can leave origin with the bump commit but no tag, which the
// release workflow never sees.
try {
  git("push", "--atomic", "origin", "main", `v${version}`);
} catch (error) {
  // Leave the bump commit; drop the tag so a rerun takes the already-bumped
  // path instead of dying on "tag already exists".
  git("tag", "-d", `v${version}`);
  console.error(error.stderr?.toString?.() ?? String(error));
  die(`push failed, local tag v${version} removed; fix the cause and rerun`);
}

console.log(`pushed v${version}; the release workflow will build and publish it`);
