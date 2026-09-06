const api = typeof browser !== "undefined" ? browser : chrome;
const lib = globalThis.DaylightLib;
const DEFAULTS = lib.DEFAULTS;

const SCRIPT_ID = "daylight-media";
const MODE_FILES = { light: "mode-light.js", dark: "mode-dark.js" };

let registeredKey = null;

async function getConfig() {
  const stored = await api.storage.local.get(null);
  return {
    lightAt: stored.lightAt || DEFAULTS.lightAt,
    darkAt: stored.darkAt || DEFAULTS.darkAt,
    override: stored.override || DEFAULTS.override,
    sites: lib.normalizeSites(stored.sites, stored.schemaVersion),
  };
}

async function seed() {
  const current = await api.storage.local.get(null);
  if (!current.initialized) {
    await api.storage.local.set({ ...DEFAULTS, initialized: true });
    return;
  }
  if (Number(current.schemaVersion || 1) < lib.SCHEMA_VERSION) {
    await api.storage.local.set({
      sites: lib.normalizeSites(current.sites, current.schemaVersion),
      schemaVersion: lib.SCHEMA_VERSION,
    });
  }
}

// The patch has to run before any page script, so it is a registered
// document_start content script rather than an after-load injection. The
// mode cannot be read asynchronously that early, so it is baked in by
// picking one of two one-line files and re-registering when the mode flips.
async function syncRegistration(config, mode) {
  const matches = lib.matchPatterns(config.sites);
  const key = `${mode}|${matches.join(",")}`;
  if (key === registeredKey) return;

  try {
    await api.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch {
    /* nothing registered yet */
  }

  if (!matches.length) {
    registeredKey = key;
    return;
  }

  try {
    await api.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        matches,
        js: [MODE_FILES[mode], "mediaPatch.js"],
        runAt: "document_start",
        world: "MAIN",
        allFrames: true,
        persistAcrossSessions: false,
      },
    ]);
    registeredKey = key;
  } catch (error) {
    registeredKey = null;
    console.warn("Daylight: could not register document_start script", error);
  }
}

// A live flip only half-propagates in some apps: Linear re-themes its sidebar
// but leaves the content grid on the old palette until the document reloads.
// So listed tabs are reloaded on a flip -- except the one you are looking at,
// which is deferred until you switch away, so a reload never lands mid-edit.
async function focusedWindowId() {
  try {
    const win = await api.windows.getLastFocused();
    return win?.focused ? win.id : -1;
  } catch {
    return -1;
  }
}

// Kept in storage, not memory: the event page can be suspended between the
// flip and the tab switch that flushes the queue.
async function getPending() {
  const stored = await api.storage.local.get({ pendingReload: [] });
  return new Set(Array.isArray(stored.pendingReload) ? stored.pendingReload : []);
}

async function setPending(pending) {
  await api.storage.local.set({ pendingReload: [...pending] });
}

async function reloadTab(tabId) {
  try {
    await api.tabs.reload(tabId);
  } catch {
    /* gone */
  }
}

async function dropPending(tabId) {
  const pending = await getPending();
  if (!pending.delete(tabId)) return;
  await setPending(pending);
}

async function queueReloads(tabs, immediate) {
  const focused = immediate ? -1 : await focusedWindowId();
  const pending = await getPending();
  for (const tab of tabs) {
    if (tab.id === undefined || tab.id === null) continue;
    if (tab.active && tab.windowId === focused) pending.add(tab.id);
    else await reloadTab(tab.id);
  }
  await setPending(pending);
}

async function flushPending() {
  const pending = await getPending();
  if (!pending.size) return;
  const focused = await focusedWindowId();
  let dirty = false;
  for (const tabId of [...pending]) {
    let tab = null;
    try {
      tab = await api.tabs.get(tabId);
    } catch {
      /* closed */
    }
    if (tab && tab.active && tab.windowId === focused) continue;
    pending.delete(tabId);
    dirty = true;
    if (tab) await reloadTab(tabId);
  }
  if (dirty) await setPending(pending);
}

// Live update for tabs that are already open. Sites that subscribe to the
// media query re-theme from this alone; the ones that only partly follow are
// caught by the reload queue above.
async function applyToTab(tab, mode, deep) {
  if (!tab?.id || !tab.url) return;
  try {
    const [probe] = await api.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: (next) => {
        if (globalThis.__DAYLIGHT_PATCH__) {
          globalThis.__DAYLIGHT_PATCH__.set(next, false);
          return true;
        }
        globalThis.__DAYLIGHT_MODE__ = next;
        return false;
      },
      args: [mode],
    });

    if (probe?.result === false) {
      // Tab predates registration (just installed, or just added this site).
      // Inject now and force a notify; the site may still need a reload if it
      // read the media query before we got here.
      await api.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        files: ["mediaPatch.js"],
      });
      await api.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (next) => globalThis.__DAYLIGHT_PATCH__?.set(next, true),
        args: [mode],
      });
    }

    if (deep) {
      await api.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        files: ["inject.js"],
      });
    }
  } catch {
    /* restricted page, or tab closed mid-flight */
  }
}

async function applyAll(options = {}) {
  const config = await getConfig();
  const mode = lib.effectiveMode(config);
  await syncRegistration(config, mode);

  const stored = await api.storage.local.get({ lastApplied: null });
  // Only a real flip triggers reloads. Without this the one-minute tick would
  // reload every listed tab, forever.
  const flipped = stored.lastApplied !== null && stored.lastApplied !== mode;
  await api.storage.local.set({ lastApplied: mode });

  const tabs = await api.tabs.query({});
  const listed = [];
  for (const tab of tabs) {
    try {
      const host = new URL(tab.url).hostname;
      const site = config.sites.find((entry) => lib.hostMatches(entry.host, host));
      if (site) listed.push({ tab, site });
    } catch {
      /* about:, view-source:, and friends */
    }
  }

  await Promise.all(listed.map(({ tab, site }) => applyToTab(tab, mode, site.deep === true)));

  if (flipped && listed.length) {
    await queueReloads(listed.map(({ tab }) => tab), options.immediate === true);
  }
}

async function schedule() {
  await api.alarms.clear("tick");
  await api.alarms.create("tick", { periodInMinutes: 1 });
  await applyAll();
}

api.runtime.onInstalled.addListener(async () => {
  await seed();
  await schedule();
});

api.runtime.onStartup.addListener(async () => {
  registeredKey = null;
  // Tab ids do not survive a restart.
  await api.storage.local.set({ pendingReload: [] });
  await seed();
  await schedule();
});

api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "tick") await applyAll();
});

api.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes.lightAt || changes.darkAt || changes.override || changes.sites) {
    // Flipping the override by hand is a deliberate act on the toolbar, not
    // typing in the page, so that one takes effect where you can see it.
    await applyAll({ immediate: Boolean(changes.override) });
  }
});

api.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete") return;
  const config = await getConfig();
  try {
    const host = new URL(tab.url).hostname;
    const site = config.sites.find((entry) => lib.hostMatches(entry.host, host));
    if (!site) return;
    // Fresh document, whether we reloaded it or you did. Only listed tabs are
    // ever queued, so this stays off the path of every other navigation.
    await dropPending(tabId);
    await applyToTab(tab, lib.effectiveMode(config), site.deep === true);
  } catch {
    /* ignore */
  }
});

api.tabs.onActivated.addListener(() => {
  flushPending();
});

api.tabs.onRemoved.addListener((tabId) => {
  dropPending(tabId);
});

if (api.windows?.onFocusChanged) {
  api.windows.onFocusChanged.addListener(() => {
    flushPending();
  });
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "apply") {
    applyAll().then(() => sendResponse({ ok: true }));
    return true;
  }
  return undefined;
});

// The event page can be torn down and revived without onInstalled/onStartup
// firing, which would leave the registration stale.
seed().then(schedule);
