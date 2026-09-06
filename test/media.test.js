const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PATCH = fs.readFileSync(path.join(__dirname, "../extension/mediaPatch.js"), "utf8");

// Minimal stand-in for the browser pieces mediaPatch touches: a real
// MediaQueryList with a prototype getter for `matches`, plus event plumbing.
function makeWorld(osDark = false) {
  class Event {
    constructor(type) {
      this.type = type;
    }
  }
  class MediaQueryListEvent extends Event {
    constructor(type, init = {}) {
      super(type);
      this.matches = init.matches;
      this.media = init.media;
    }
  }
  class MediaQueryList {
    constructor(query) {
      this._media = query;
      this._listeners = new Set();
      this.onchange = null;
    }
    get media() {
      return this._media;
    }
    get matches() {
      // The "real" OS answer, which the patch is meant to shadow.
      return /dark/i.test(this._media) ? osDark : !osDark;
    }
    addEventListener(type, fn) {
      if (type === "change") this._listeners.add(fn);
    }
    removeEventListener(type, fn) {
      this._listeners.delete(fn);
    }
    dispatchEvent(event) {
      if (typeof this.onchange === "function") this.onchange(event);
      for (const fn of this._listeners) fn(event);
      return true;
    }
  }

  const sandbox = {
    Event,
    MediaQueryListEvent,
    MediaQueryList,
    Object,
    String,
    Set,
    console,
    matchMedia(query) {
      return new MediaQueryList(query);
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function run(world) {
  vm.runInContext(PATCH, world);
}

test("reports the injected mode, not the OS", () => {
  const world = makeWorld(false); // OS is light
  world.__DAYLIGHT_MODE__ = "dark";
  run(world);

  assert.equal(world.matchMedia("(prefers-color-scheme: dark)").matches, true);
  assert.equal(world.matchMedia("(prefers-color-scheme: light)").matches, false);
});

test("patched list is still a real MediaQueryList", () => {
  const world = makeWorld(false);
  world.__DAYLIGHT_MODE__ = "dark";
  run(world);

  const mql = world.matchMedia("(prefers-color-scheme: dark)");
  assert.equal(mql instanceof world.MediaQueryList, true);
  assert.equal(mql.media, "(prefers-color-scheme: dark)");
});

test("fires change on listeners when the schedule flips", () => {
  const world = makeWorld(false);
  world.__DAYLIGHT_MODE__ = "light";
  run(world);

  const mql = world.matchMedia("(prefers-color-scheme: dark)");
  const seen = [];
  mql.addEventListener("change", (e) => seen.push(e.matches));
  mql.onchange = (e) => seen.push(`onchange:${e.matches}`);

  assert.equal(mql.matches, false);
  world.__DAYLIGHT_PATCH__.set("dark");

  assert.equal(mql.matches, true);
  assert.deepEqual(seen, ["onchange:true", true]);
});

test("does not fire when the mode does not change", () => {
  const world = makeWorld(false);
  world.__DAYLIGHT_MODE__ = "light";
  run(world);

  const mql = world.matchMedia("(prefers-color-scheme: dark)");
  let calls = 0;
  mql.addEventListener("change", () => (calls += 1));

  world.__DAYLIGHT_PATCH__.set("light");
  assert.equal(calls, 0);
});

test("leaves unrelated and compound queries alone", () => {
  const world = makeWorld(true); // OS is dark
  world.__DAYLIGHT_MODE__ = "light";
  run(world);

  // Compound: depends on width too, which we are not overriding.
  const compound = world.matchMedia("(min-width: 700px) and (prefers-color-scheme: dark)");
  assert.equal(compound.matches, true, "compound query keeps the real answer");

  const unrelated = world.matchMedia("(min-width: 700px)");
  assert.equal(unrelated.matches, false);
});

test("accepts the query without outer parens", () => {
  const world = makeWorld(false);
  world.__DAYLIGHT_MODE__ = "dark";
  run(world);
  assert.equal(world.matchMedia("prefers-color-scheme: dark").matches, true);
});

test("re-injection re-asserts instead of double patching", () => {
  const world = makeWorld(false);
  world.__DAYLIGHT_MODE__ = "light";
  run(world);
  const first = world.matchMedia;

  const mql = world.matchMedia("(prefers-color-scheme: dark)");
  let calls = 0;
  mql.addEventListener("change", () => (calls += 1));

  world.__DAYLIGHT_MODE__ = "dark";
  run(world); // background re-injects the same file

  assert.equal(world.matchMedia, first, "matchMedia is not wrapped twice");
  assert.equal(mql.matches, true, "existing list follows the new mode");
  assert.equal(calls, 1, "existing listener was notified");
});

test("forced notify wakes a site that already read the query", () => {
  const world = makeWorld(false);
  world.__DAYLIGHT_MODE__ = "dark";
  run(world);

  const mql = world.matchMedia("(prefers-color-scheme: dark)");
  let calls = 0;
  mql.addEventListener("change", () => (calls += 1));

  world.__DAYLIGHT_PATCH__.set("dark", true);
  assert.equal(calls, 1);
});
