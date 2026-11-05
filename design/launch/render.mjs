#!/usr/bin/env node
/*
 * Renders the Daylight launch film frame by frame.
 *
 *   node design/launch/render.mjs                      # full film -> design/launch/daylight-launch.mp4
 *   node design/launch/render.mjs --fps 30 --out /tmp/x.mp4
 *   node design/launch/render.mjs --stills 3,9,21.5 --dir /tmp/stills   # PNGs at those times
 *
 * How it stays smooth: nothing plays in real time. A local server hosts the
 * repo, Chromium opens index.html?drive, and for every frame we call
 * window.__film.render(t) -- which also steps the embedded popup's virtual
 * clock and its CSS animations -- then take a screenshot and pipe it to ffmpeg.
 * A slow screenshot just makes the render slower; it never drops a frame.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  // Fall back to a global install (NODE_PATH is not consulted by ESM imports).
  const { execSync } = await import("node:child_process");
  const root = execSync("npm root -g").toString().trim();
  playwright = require(path.join(root, "playwright"));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const fps = Number(opt("fps", 60));
const out = path.resolve(opt("out", path.join(here, "daylight-launch.mp4")));
const stills = opt("stills", null)?.split(",").map(Number);
const stillDir = path.resolve(opt("dir", path.join(here, "stills")));
const from = Number(opt("from", 0));
const crf = opt("crf", "18");

// ---------------------------------------------------------------- server --
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const file = path.join(repo, decodeURIComponent(url.pathname));
  if (!file.startsWith(repo) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// --------------------------------------------------------------- browser --
const browser = await playwright.chromium.launch({ args: ["--font-render-hinting=none", "--force-color-profile=srgb", "--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.error(`[page ${m.type()}]`, m.text());
});
page.on("pageerror", (e) => console.error("[page error]", e.message));
// Belt and braces: no third-party favicon requests (the harness also blocks them).
await page.route("**/s2/favicons**", (route) => route.abort());
await page.goto(`http://127.0.0.1:${port}/design/launch/index.html?drive`);
await page.evaluate(() => window.__film.ready);
const duration = await page.evaluate(() => window.__film.DURATION);

// Raw CDP capture: lossless PNG, about 4x faster than page.screenshot().
const cdp = await page.context().newCDPSession(page);
const shoot = async () => {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
  return Buffer.from(data, "base64");
};

if (stills) {
  fs.mkdirSync(stillDir, { recursive: true });
  const want = [...stills].sort((a, b) => a - b);
  // Step through time at a coarse rate so popup state builds up in order.
  let t = 0;
  for (const s of want) {
    for (; t < s; t += 0.1) await page.evaluate((x) => window.__film.render(x), t);
    await page.evaluate((x) => window.__film.render(x), s);
    t = s;
    const file = path.join(stillDir, `still-${s.toFixed(2).padStart(6, "0")}.png`);
    fs.writeFileSync(file, await shoot());
    console.log(file);
  }
} else {
  const total = Math.round(duration * fps);
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-tune", "film",
    "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
    "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const started = Date.now();
  for (let i = Math.round(from * fps); i < total; i++) {
    await page.evaluate((x) => window.__film.render(x), i / fps);
    const buf = await shoot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % fps === 0) {
      const el = (Date.now() - started) / 1000;
      process.stdout.write(`\r${(i / fps).toFixed(1)}s / ${duration}s  (${el.toFixed(0)}s elapsed)   `);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(`\nwrote ${out}`);
}

await browser.close();
server.close();
