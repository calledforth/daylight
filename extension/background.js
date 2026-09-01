const api = typeof browser !== "undefined" ? browser : chrome;
const lib = globalThis.DaylightLib;
const DEFAULTS = lib.DEFAULTS;

async function getConfig() {
  const stored = await api.storage.local.get(DEFAULTS);
  return {
    lightAt: stored.lightAt || DEFAULTS.lightAt,
    darkAt: stored.darkAt || DEFAULTS.darkAt,
    override: stored.override || DEFAULTS.override,
    sites: Array.isArray(stored.sites) ? stored.sites : DEFAULTS.sites,
  };
}

async function seed() {
  const current = await api.storage.local.get(null);
  if (current.initialized) return;
  await api.storage.local.set({ ...DEFAULTS, initialized: true });
}

async function applyToTab(tab, mode) {
  if (!tab?.id || !tab.url) return;
  try {
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: (nextMode) => {
        globalThis.__DAYLIGHT_MODE__ = nextMode;
      },
      args: [mode],
    });
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      files: ["inject.js"],
    });
  } catch {
    /* restricted pages */
  }
}

async function applyAll() {
  const config = await getConfig();
  const mode = lib.effectiveMode(config);
  await api.storage.local.set({ lastApplied: mode });
  const tabs = await api.tabs.query({});
  await Promise.all(
    tabs.map((tab) => {
      try {
        const host = new URL(tab.url).hostname;
        const listed = config.sites.some((site) => lib.hostMatches(site.host, host));
        return listed ? applyToTab(tab, mode) : Promise.resolve();
      } catch {
        return Promise.resolve();
      }
    }),
  );
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
  await seed();
  await schedule();
});

api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "tick") await applyAll();
});

api.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes.lightAt || changes.darkAt || changes.override || changes.sites) {
    await applyAll();
  }
});

api.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete") return;
  const config = await getConfig();
  try {
    const host = new URL(tab.url).hostname;
    if (!config.sites.some((site) => lib.hostMatches(site.host, host))) return;
    await applyToTab(tab, lib.effectiveMode(config));
  } catch {
    /* ignore */
  }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "apply") {
    applyAll().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "normalize-host") {
    sendResponse({ sync: lib.isSyncHost(message.host), parsed: lib.parseTime(message.time) });
  }
  return undefined;
});
