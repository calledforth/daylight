// Runs in the page's MAIN world at document_start, before any site script.
// Replaces the answer to "(prefers-color-scheme: ...)" with Daylight's
// scheduled mode, so a site set to System themes itself through its own
// supported code path. Nothing outside this document is touched.
(function daylightMediaPatch(global) {
  function normalize(value) {
    return value === "dark" ? "dark" : "light";
  }

  // Re-injected into an already-patched page: just re-assert the mode.
  if (global.__DAYLIGHT_PATCH__) {
    global.__DAYLIGHT_PATCH__.set(normalize(global.__DAYLIGHT_MODE__), false);
    return;
  }

  const nativeMatchMedia =
    typeof global.matchMedia === "function" ? global.matchMedia.bind(global) : null;
  if (!nativeMatchMedia) return;

  let mode = normalize(global.__DAYLIGHT_MODE__);
  // Real MediaQueryList objects we have lied to, so we can notify them later.
  const tracked = new Set();

  function makeEvent(mql, matches) {
    try {
      return new global.MediaQueryListEvent("change", { matches, media: mql.media });
    } catch {
      const event = new global.Event("change");
      try {
        Object.defineProperty(event, "matches", { value: matches, configurable: true });
        Object.defineProperty(event, "media", { value: mql.media, configurable: true });
      } catch {
        /* best effort */
      }
      return event;
    }
  }

  function notify(force) {
    for (const entry of tracked) {
      const matches = entry.wanted === mode;
      if (!force && matches === entry.last) continue;
      entry.last = matches;
      // Dispatching on the genuine MediaQueryList reaches listeners the site
      // registered natively, including onchange.
      try {
        entry.mql.dispatchEvent(makeEvent(entry.mql, matches));
      } catch {
        /* ignore */
      }
    }
  }

  function track(mql, wanted) {
    // Own-property getter shadows the prototype getter. The object stays a
    // real MediaQueryList, so instanceof and addEventListener keep working.
    try {
      Object.defineProperty(mql, "matches", {
        configurable: true,
        enumerable: true,
        get() {
          return wanted === mode;
        },
      });
    } catch {
      return mql;
    }
    tracked.add({ mql, wanted, last: wanted === mode });
    return mql;
  }

  function patchedMatchMedia(query) {
    const text = String(query);
    const mql = nativeMatchMedia(text);
    // Only answer a query that is *purely* a colour-scheme test. A compound
    // query ("(min-width: 700px) and (prefers-color-scheme: dark)") also
    // depends on things we are not overriding, so it falls through untouched
    // rather than getting an answer we would be guessing at.
    const bare = text.trim().replace(/^\(+/, "").replace(/\)+$/, "").trim();
    const found = bare.match(/^prefers-color-scheme\s*:\s*(dark|light)$/i);
    if (!found) return mql;
    return track(mql, found[1].toLowerCase());
  }

  try {
    Object.defineProperty(global, "matchMedia", {
      configurable: true,
      writable: true,
      value: patchedMatchMedia,
    });
  } catch {
    global.matchMedia = patchedMatchMedia;
  }

  global.__DAYLIGHT_PATCH__ = {
    set(next, force) {
      const wanted = normalize(next);
      const changed = wanted !== mode;
      mode = wanted;
      global.__DAYLIGHT_MODE__ = wanted;
      if (changed || force) notify(force === true);
      return changed;
    },
    get mode() {
      return mode;
    },
  };

  global.__DAYLIGHT_MODE__ = mode;
})(globalThis);
