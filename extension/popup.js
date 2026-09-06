const api = typeof browser !== "undefined" ? browser : chrome;
const lib = globalThis.DaylightLib;
const DEFAULTS = lib.DEFAULTS;

const statusEl = document.getElementById("status");
const untilEl = document.getElementById("until");
const lightAt = document.getElementById("lightAt");
const darkAt = document.getElementById("darkAt");
const sitesCount = document.getElementById("sitesCount");
const sitesCompact = document.getElementById("sitesCompact");
const sitesToggle = document.getElementById("sitesToggle");
const sitesPanel = document.getElementById("sitesPanel");
const siteList = document.getElementById("siteList");
const addOpen = document.getElementById("addOpen");
const addOpenExpanded = document.getElementById("addOpenExpanded");
const addForm = document.getElementById("addForm");
const addInput = document.getElementById("addInput");
const syncHint = document.getElementById("syncHint");
const modeBtn = document.getElementById("modeBtn");
const modeLabel = document.getElementById("modeLabel");

let state = { ...DEFAULTS };
let listOpen = false;

const OVERRIDE_LABELS = {
  auto: "Auto",
  light: "Light",
  dark: "Dark",
};

function labelForCount(n) {
  return n === 1 ? "1 site" : `${n} sites`;
}

function faviconUrl(host) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
}

function faviconFallbackLetter(host) {
  const bare = String(host || "").replace(/^www\./, "");
  return bare.charAt(0).toUpperCase() || "?";
}

function createFavicon(host) {
  const img = document.createElement("img");
  img.className = "site-favicon";
  img.alt = "";
  img.width = 16;
  img.height = 16;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.src = faviconUrl(host);
  img.addEventListener("error", () => {
    const fallback = document.createElement("span");
    fallback.className = "site-favicon is-fallback";
    fallback.textContent = faviconFallbackLetter(host);
    fallback.setAttribute("aria-hidden", "true");
    img.replaceWith(fallback);
  });
  return img;
}

function setListOpen(open, showAdd = false) {
  listOpen = open;
  sitesPanel.hidden = !listOpen;
  sitesCompact.hidden = listOpen;
  if (!listOpen) {
    addForm.hidden = true;
    return;
  }
  addForm.hidden = !showAdd;
  if (showAdd) {
    addInput.value = "";
    requestAnimationFrame(() => addInput.focus());
  }
}

function render() {
  const mode = lib.effectiveMode(state);
  const until = lib.nextBoundary(state);
  document.body.dataset.mode = mode;
  statusEl.textContent = mode === "dark" ? "Dark" : "Light";
  untilEl.textContent = `until ${until}`;
  lightAt.value = lib.parseTime(state.lightAt)?.label ?? "07:00";
  darkAt.value = lib.parseTime(state.darkAt)?.label ?? "18:00";
  sitesCount.textContent = labelForCount(state.sites.length);

  const override = state.override;
  modeLabel.textContent = OVERRIDE_LABELS[override] ?? "Auto";
  modeBtn.dataset.override = override;
  modeBtn.setAttribute(
    "aria-label",
    `Override mode: ${OVERRIDE_LABELS[override]}. Click to cycle Auto, Light, then Dark.`,
  );

  syncHint.hidden = !listOpen;

  siteList.replaceChildren(
    ...state.sites.map((site) => {
      const li = document.createElement("li");
      li.dataset.host = site.host;
      li.append(createFavicon(site.host));

      const host = document.createElement("span");
      host.className = "host";
      host.textContent = site.host;
      li.append(host);

      const deep = document.createElement("button");
      deep.className = site.deep ? "sync is-on" : "sync";
      deep.type = "button";
      deep.textContent = "deep";
      deep.setAttribute("aria-pressed", site.deep ? "true" : "false");
      deep.title = site.deep
        ? "Deep mode on — also writes this site’s own theme setting. Turn off if the site set to System already follows the schedule."
        : "Deep mode off — the site follows the schedule via its System theme option. Turn on only if that does not work.";
      deep.addEventListener("click", () => toggleDeep(site.host));
      li.append(deep);

      const remove = document.createElement("button");
      remove.className = "remove";
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${site.host}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => removeSite(site.host));
      li.append(remove);
      return li;
    }),
  );
}

async function persist(patch) {
  state = { ...state, ...patch };
  await api.storage.local.set(state);
  render();
}

async function load() {
  const stored = await api.storage.local.get(null);
  if (!stored.initialized) {
    state = { ...DEFAULTS, initialized: true };
    await api.storage.local.set(state);
  } else {
    state = {
      lightAt: stored.lightAt || DEFAULTS.lightAt,
      darkAt: stored.darkAt || DEFAULTS.darkAt,
      override: stored.override || DEFAULTS.override,
      sites: lib.normalizeSites(stored.sites, stored.schemaVersion),
      schemaVersion: lib.SCHEMA_VERSION,
    };
  }
  render();
}

function commitTime(which) {
  const parsed = lib.parseTime(which === "light" ? lightAt.value : darkAt.value);
  if (!parsed) {
    render();
    return;
  }
  persist(which === "light" ? { lightAt: parsed.label } : { darkAt: parsed.label });
}

function removeSite(host) {
  persist({ sites: state.sites.filter((site) => site.host !== host) });
}

function addSite(value) {
  const host = lib.hostFromInput(value);
  if (!host) return false;
  if (state.sites.some((site) => site.host === host)) {
    flashExisting(host);
    return true;
  }
  persist({ sites: [...state.sites, { host, deep: false }] });
  return true;
}

function toggleDeep(host) {
  persist({
    sites: state.sites.map((site) =>
      site.host === host ? { ...site, deep: !site.deep } : site,
    ),
  });
}

// Adding a host that is already listed used to look like a silent failure.
// Deferred, because the caller re-renders the list right after this returns.
function flashExisting(host) {
  requestAnimationFrame(() => {
    const row = siteList.querySelector(`li[data-host="${CSS.escape(host)}"]`);
    if (!row) return;
    row.classList.add("is-flash");
    setTimeout(() => row.classList.remove("is-flash"), 900);
  });
}

function openAddForm() {
  setListOpen(true, true);
  render();
}

sitesToggle.addEventListener("click", () => {
  setListOpen(!listOpen);
  render();
});

addOpen.addEventListener("click", openAddForm);
addOpenExpanded.addEventListener("click", openAddForm);

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (addSite(addInput.value)) {
    addInput.value = "";
    addForm.hidden = true;
    render();
  }
});

lightAt.addEventListener("change", () => commitTime("light"));
darkAt.addEventListener("change", () => commitTime("dark"));
lightAt.addEventListener("keydown", (event) => {
  if (event.key === "Enter") lightAt.blur();
});
darkAt.addEventListener("keydown", (event) => {
  if (event.key === "Enter") darkAt.blur();
});

modeBtn.addEventListener("click", () => {
  const order = ["auto", "light", "dark"];
  const next = order[(order.indexOf(state.override) + 1) % order.length];
  persist({ override: next });
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // The background writes lastApplied and pendingReload as bookkeeping;
  // reloading on those would rebuild the site list (and refetch favicons)
  // once a minute.
  const ignored = new Set(["lastApplied", "pendingReload"]);
  const keys = Object.keys(changes).filter((key) => !ignored.has(key));
  if (!keys.length) return;
  load();
});

if (!globalThis.DaylightLib) {
  statusEl.textContent = "Load error";
} else {
  load();
}
