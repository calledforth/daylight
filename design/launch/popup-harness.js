/*
 * Injected at the very top of extension/popup.html (before any of its own
 * scripts) when the composition embeds the real popup.
 *
 * It does three things:
 *   1. Stubs the extension API (browser.storage) with the install defaults.
 *   2. Freezes the wall clock at 14:48, so the popup opens in daylight
 *      ("Light · until 18:00 · 3h 12m").
 *   3. Puts every clock the popup uses -- setTimeout, setInterval,
 *      requestAnimationFrame, performance.now and all CSS animations and
 *      transitions -- on a virtual timeline that the composition advances one
 *      video frame at a time. That makes the render deterministic: a 900 ms
 *      cascade lasts exactly 900 ms of video no matter how long a screenshot takes.
 */
(() => {
  const fixed = new Date(2026, 10, 5, 14, 48).getTime();
  const RD = Date;
  window.Date = class extends RD {
    constructor(...a) {
      super(...(a.length ? a : [fixed]));
    }
    static now() {
      return fixed;
    }
  };

  const store = {
    initialized: true,
    schemaVersion: 2,
    lightAt: "07:00",
    darkAt: "18:00",
    override: "auto",
    sites: [
      { host: "linear.app", deep: false },
      { host: "chatgpt.com", deep: false },
      { host: "claude.ai", deep: false },
      { host: "cursor.com", deep: false },
    ],
  };
  window.browser = {
    storage: {
      local: {
        get: async () => JSON.parse(JSON.stringify(store)),
        set: async (p) => {
          Object.assign(store, JSON.parse(JSON.stringify(p)));
        },
      },
      onChanged: { addListener: () => {} },
    },
  };

  // No third-party favicon requests: a failed load makes the popup fall back
  // to its own monogram tiles. (The render script also blocks them at the network.)
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get() {
      return srcDesc.get.call(this);
    },
    set(v) {
      srcDesc.set.call(this, String(v).includes("/s2/favicons") ? "data:image/png;base64,AA==" : v);
    },
  });

  // ---------------------------------------------------------- virtual time --
  let vnow = 0;
  let seq = 1;
  const timers = new Map();
  let rafQ = [];

  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = seq++;
    timers.set(id, { at: vnow + Math.max(0, Number(ms) || 0), fn, args });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = seq++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: vnow + every, fn, args, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.requestAnimationFrame = (fn) => {
    const id = seq++;
    rafQ.push({ id, fn });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    rafQ = rafQ.filter((r) => r.id !== id);
  };
  try {
    Object.defineProperty(performance, "now", { configurable: true, value: () => vnow });
  } catch {}

  // Every animation is paused the moment it is first seen and from then on
  // positioned explicitly: currentTime = virtual time since it was born.
  const born = new WeakMap();
  function sync() {
    for (const a of document.getAnimations()) {
      if (!born.has(a)) born.set(a, vnow);
      if (a.playState !== "paused") a.pause();
      a.currentTime = Math.max(0, vnow - born.get(a));
    }
  }

  function run(fn, args) {
    try {
      fn(...(args || []));
    } catch (e) {
      console.error(e);
    }
  }

  window.__vt = {
    get now() {
      return vnow;
    },
    // Advance to an absolute virtual time (ms), firing due timers in order.
    advance(to) {
      for (;;) {
        let next = null;
        for (const [id, t] of timers) {
          if (t.at <= to && (!next || t.at < next.t.at)) next = { id, t };
        }
        if (!next) break;
        vnow = Math.max(vnow, next.t.at);
        if (next.t.every) next.t.at += next.t.every;
        else timers.delete(next.id);
        run(next.t.fn, next.t.args);
        sync();
      }
      vnow = Math.max(vnow, to);
      const q = rafQ;
      rafQ = [];
      for (const r of q) run(r.fn, [vnow]);
      sync();
    },
    // Run an interaction at the current virtual time.
    act(fn) {
      run(fn);
      sync();
    },
  };
})();
