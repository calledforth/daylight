#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "extension/manifest.json"), "utf8"));
const [xpiPath, outputPath] = process.argv.slice(2);

if (!xpiPath || !outputPath) {
  console.error("usage: update-manifest.mjs <signed-xpi> <output-json>");
  process.exit(1);
}

const id = manifest.browser_specific_settings?.gecko?.id;
if (!id) throw new Error("manifest is missing browser_specific_settings.gecko.id");

const hash = createHash("sha256").update(readFileSync(xpiPath)).digest("hex");
const update = {
  addons: {
    [id]: {
      updates: [
        {
          version: manifest.version,
          update_link: `https://github.com/calledforth/daylight/releases/download/v${manifest.version}/daylight-signed.xpi`,
          update_hash: `sha256:${hash}`,
        },
      ],
    },
  },
};

writeFileSync(outputPath, `${JSON.stringify(update, null, 2)}\n`);
console.log(`wrote ${outputPath} for ${id} ${manifest.version}`);
