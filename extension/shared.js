(function initDaylightLib(root) {
  const SYNC_HOSTS = new Set([
    "linear.app",
    "chatgpt.com",
    "chat.openai.com",
    "claude.ai",
    "notion.so",
    "www.notion.so",
  ]);

  const DEFAULT_SITES = [
    { host: "linear.app", sync: true },
    { host: "chatgpt.com", sync: true },
    { host: "claude.ai", sync: true },
    { host: "cursor.com", sync: false },
  ];

  const DEFAULTS = {
    lightAt: "07:00",
    darkAt: "18:00",
    override: "auto",
    sites: DEFAULT_SITES,
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function parseTime(value) {
    const raw = String(value ?? "").trim();
    const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2] ?? "0");
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes, label: `${pad2(hours)}:${pad2(minutes)}` };
  }

  function minutesSinceMidnight(hours, minutes) {
    return hours * 60 + minutes;
  }

  function nowMinutes(date = new Date()) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function scheduledMode(lightAt, darkAt, date = new Date()) {
    const light = parseTime(lightAt);
    const dark = parseTime(darkAt);
    if (!light || !dark) return "light";
    const now = nowMinutes(date);
    const a = minutesSinceMidnight(light.hours, light.minutes);
    const b = minutesSinceMidnight(dark.hours, dark.minutes);
    if (a === b) return "light";
    if (a < b) return now >= a && now < b ? "light" : "dark";
    return now >= a || now < b ? "light" : "dark";
  }

  function effectiveMode(config, date = new Date()) {
    if (config.override === "light" || config.override === "dark") return config.override;
    return scheduledMode(config.lightAt, config.darkAt, date);
  }

  function nextBoundary(config, date = new Date()) {
    const mode = effectiveMode(config, date);
    if (config.override === "light") return parseTime(config.darkAt)?.label ?? "18:00";
    if (config.override === "dark") return parseTime(config.lightAt)?.label ?? "07:00";
    return mode === "light"
      ? parseTime(config.darkAt)?.label ?? "18:00"
      : parseTime(config.lightAt)?.label ?? "07:00";
  }

  function hostFromInput(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return null;
    try {
      const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
      const host = url.hostname.replace(/^www\./, "");
      if (!host || !host.includes(".")) return null;
      return host;
    } catch {
      return null;
    }
  }

  function hostMatches(siteHost, tabHost) {
    const site = String(siteHost || "").replace(/^www\./, "");
    const tab = String(tabHost || "").replace(/^www\./, "");
    return tab === site || tab.endsWith(`.${site}`);
  }

  function isSyncHost(host) {
    const bare = String(host || "").replace(/^www\./, "");
    if (SYNC_HOSTS.has(bare)) return true;
    for (const known of SYNC_HOSTS) {
      if (bare.endsWith(`.${known}`)) return true;
    }
    return false;
  }

  function tabIsListed(sites, tabUrl) {
    try {
      const host = new URL(tabUrl).hostname;
      return (sites || []).some((site) => hostMatches(site.host, host));
    } catch {
      return false;
    }
  }

  const lib = {
    SYNC_HOSTS,
    DEFAULT_SITES,
    DEFAULTS,
    parseTime,
    scheduledMode,
    effectiveMode,
    nextBoundary,
    hostFromInput,
    hostMatches,
    isSyncHost,
    tabIsListed,
  };

  root.DaylightLib = lib;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = lib;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
