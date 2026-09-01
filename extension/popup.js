const api = typeof browser !== "undefined" ? browser : chrome;
const lib = globalThis.DaylightLib;
const DEFAULTS = lib.DEFAULTS;

const statusEl = document.getElementById("status");
const untilEl = document.getElementById("until");
const lightAt = document.getElementById("lightAt");
const darkAt = document.getElementById("darkAt");
const sitesCount = document.getElementById("sitesCount");
const sitesToggle = document.getElementById("sitesToggle");
const sitesPanel = document.getElementById("sitesPanel");
const siteList = document.getElementById("siteList");
const addOpen = document.getElementById("addOpen");
const addForm = document.getElementById("addForm");
const addInput = document.getElementById("addInput");
const modeBtn = document.getElementById("modeBtn");

let state = { ...DEFAULTS };
let listOpen = false;

function labelForCount(n) {
  return n === 1 ? "1 site" : `${n} sites`;
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
  modeBtn.textContent = state.override === "auto" ? "Auto" : state.override === "light" ? "Light" : "Dark";
  siteList.replaceChildren(
    ...state.sites.map((site) => {
      const li = document.createElement("li");
      const host = document.createElement("span");
      host.className = "host";
      host.textContent = site.host;
      li.append(host);
      if (site.sync) {
        const sync = document.createElement("span");
        sync.className = "sync";
        sync.textContent = "sync";
        li.append(sync);
      }
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
      sites: Array.isArray(stored.sites) ? stored.sites : DEFAULTS.sites,
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
  if (state.sites.some((site) => site.host === host)) return true;
  persist({ sites: [...state.sites, { host, sync: lib.isSyncHost(host) }] });
  return true;
}

function openList(showAdd) {
  listOpen = true;
  sitesPanel.hidden = false;
  addForm.hidden = !showAdd;
  if (showAdd) {
    addInput.value = "";
    addInput.focus();
  }
}

sitesToggle.addEventListener("click", () => {
  listOpen = !listOpen;
  sitesPanel.hidden = !listOpen;
  if (!listOpen) addForm.hidden = true;
});

addOpen.addEventListener("click", () => openList(true));

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (addSite(addInput.value)) {
    addInput.value = "";
    addForm.hidden = true;
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
  load();
});

if (!globalThis.DaylightLib) {
  statusEl.textContent = "Load error";
} else {
  load();
}
