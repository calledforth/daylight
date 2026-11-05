const api = typeof browser !== "undefined" ? browser : chrome;
const lib = globalThis.DaylightLib;
const DEFAULTS = lib.DEFAULTS;

const $ = (id) => document.getElementById(id);
const popup = $("popup");
const statusEl = $("status");
const untilEl = $("until");
const lightAt = $("lightAt");
const darkAt = $("darkAt");
const sitesCount = $("sitesCount");
const sitesToggle = $("sitesToggle");
const faviconStack = $("faviconStack");
const drawer = $("drawer");
const drawerScroll = drawer.querySelector(".drawer-scroll");
const addWrap = $("addWrap");
const siteList = $("siteList");
const addOpen = $("addOpen");
const addForm = $("addForm");
const addInput = $("addInput");
const modeGroup = $("modeGroup");
const segButtons = [...modeGroup.querySelectorAll(".seg")];

const ORDER = ["auto", "light", "dark"];
const STACK_MAX = 4;

let state = { ...DEFAULTS };
let listOpen = false;
let adding = false;

function labelForCount(n) {
  return n === 1 ? "1 site" : `${n} sites`;
}

function faviconUrl(host) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

// A stable hue per host, so a site without a favicon always gets the same tile.
function hueFor(host) {
  let h = 0;
  for (const ch of String(host)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function monogram(tile, host) {
  tile.classList.add("is-monogram");
  tile.style.setProperty("--hue", hueFor(host));
  tile.textContent = String(host || "").replace(/^www\./, "").charAt(0) || "?";
}

function createTile(host) {
  const tile = document.createElement("span");
  tile.className = "tile";
  tile.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.src = faviconUrl(host);
  img.addEventListener("error", () => {
    img.remove();
    monogram(tile, host);
  });
  tile.append(img);
  return tile;
}

/* ------------------------------------------------------------- views ------ */

function setListOpen(open) {
  if (open === listOpen) return;
  listOpen = open;
  popup.dataset.view = open ? "sites" : "compact";
  sitesToggle.setAttribute("aria-expanded", String(open));
  // Collapsed content stays in the DOM for the animation; keep it out of tab order.
  drawer.inert = !open;
  if (open) {
    // Cascade the rows in, once, for this opening only.
    drawer.classList.add("is-entering");
    setTimeout(() => drawer.classList.remove("is-entering"), 900);
  } else {
    setAdding(false);
  }
}

function setAdding(on) {
  adding = on;
  popup.classList.toggle("is-adding", on);
  addOpen.setAttribute("aria-expanded", String(on));
  addOpen.setAttribute("aria-label", on ? "Cancel adding a site" : "Add site");
  addWrap.inert = !on;
  addForm.classList.remove("is-invalid");
  if (on) {
    setListOpen(true);
    addInput.value = "";
    // Focus once the field has started to open; focusing a 0-height field can
    // make the browser scroll the card to reveal it.
    setTimeout(() => addInput.focus({ preventScroll: true }), 60);
  } else if (document.activeElement === addInput) {
    addInput.blur();
  }
}

/* ------------------------------------------------------------ render ------ */

function minutesOf(label) {
  const t = lib.parseTime(label);
  return t ? t.hours * 60 + t.minutes : 0;
}

function formatLeft(mins) {
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function renderStatus() {
  const mode = lib.effectiveMode(state);
  document.body.dataset.mode = mode;
  statusEl.textContent = mode === "dark" ? "Dark" : "Light";

  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  const light = minutesOf(state.lightAt);
  const dark = minutesOf(state.darkAt);

  if (state.override !== "auto") {
    untilEl.textContent = "held · schedule paused";
  } else {
    const until = lib.nextBoundary(state);
    const left = (minutesOf(until) - now + 1440) % 1440;
    const tail = formatLeft(left);
    untilEl.textContent = tail ? `until ${until} · ${tail}` : `until ${until}`;
  }

  // The dot travels toward the side of the next flip: rightward through the
  // day, leftward back through the night.
  const start = mode === "light" ? light : dark;
  const end = mode === "light" ? dark : light;
  const span = (end - start + 1440) % 1440 || 1440;
  const done = Math.min(1, ((now - start + 1440) % 1440) / span);
  const pos = mode === "light" ? done : 1 - done;
  popup.style.setProperty("--progress", `${(pos * 100).toFixed(1)}%`);
}

function renderTimes() {
  if (document.activeElement !== lightAt) lightAt.value = lib.parseTime(state.lightAt)?.label ?? "07:00";
  if (document.activeElement !== darkAt) darkAt.value = lib.parseTime(state.darkAt)?.label ?? "18:00";
}

function renderMode() {
  const idx = Math.max(0, ORDER.indexOf(state.override));
  modeGroup.style.setProperty("--seg", idx);
  for (const btn of segButtons) {
    const on = btn.dataset.value === ORDER[idx];
    btn.setAttribute("aria-checked", String(on));
    btn.tabIndex = on ? 0 : -1;
  }
}

function renderStack() {
  const shown = state.sites.slice(0, STACK_MAX);
  faviconStack.replaceChildren(...shown.map((site) => createTile(site.host)));
  const extra = state.sites.length - shown.length;
  if (extra > 0) {
    const more = document.createElement("span");
    more.className = "more";
    more.textContent = `+${extra}`;
    faviconStack.append(more);
  }
  faviconStack.hidden = state.sites.length === 0;
}

function buildRow(site) {
  const li = document.createElement("li");
  li.dataset.host = site.host;
  li.append(createTile(site.host));

  const host = document.createElement("span");
  host.className = "host";
  host.textContent = site.host;
  host.title = site.host;
  li.append(host);

  const deep = document.createElement("button");
  deep.type = "button";
  deep.textContent = "deep";
  deep.addEventListener("click", () => toggleDeep(site.host));
  li.append(deep);

  const remove = document.createElement("button");
  remove.className = "remove";
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove ${site.host}`);
  remove.innerHTML =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  remove.addEventListener("click", () => removeSite(site.host, li));
  li.append(remove);
  return li;
}

function updateRow(li, site) {
  const deep = li.querySelector("button:not(.remove)");
  deep.className = site.deep ? "deep is-on" : "deep";
  deep.setAttribute("aria-pressed", String(site.deep));
  deep.title = site.deep
    ? "Deep on — also writes this site’s own theme setting. Turn off if System already follows the schedule."
    : "Deep off — the site follows the schedule via its System theme. Turn on only if that does not work.";
}

// Keyed by host: existing rows (and their already-loaded favicons) are reused,
// so toggling deep or a storage sync never flickers the list.
function renderList() {
  const existing = new Map([...siteList.children].filter((el) => el.dataset.host).map((li) => [li.dataset.host, li]));
  const rows = state.sites.map((site, i) => {
    const li = existing.get(site.host) ?? buildRow(site);
    li.style.setProperty("--i", i);
    updateRow(li, site);
    return li;
  });
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No sites yet. Add one with +";
    rows.push(empty);
  }
  siteList.replaceChildren(...rows);
}

function render() {
  renderStatus();
  renderTimes();
  renderMode();
  sitesCount.textContent = labelForCount(state.sites.length);
  renderStack();
  renderList();
}

/* ----------------------------------------------------------- actions ------ */

async function persist(patch) {
  state = { ...state, ...patch };
  render();
  await api.storage.local.set(state);
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
  const input = which === "light" ? lightAt : darkAt;
  const parsed = lib.parseTime(input.value);
  if (!parsed) {
    input.value = "";
    renderTimes();
    return;
  }
  persist(which === "light" ? { lightAt: parsed.label } : { darkAt: parsed.label });
}

function removeSite(host, li) {
  const commit = () => persist({ sites: state.sites.filter((site) => site.host !== host) });
  if (!li?.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    commit();
    return;
  }
  li.style.pointerEvents = "none";
  li.animate(
    [
      { height: `${li.offsetHeight}px`, opacity: 1, transform: "none" },
      { height: "0px", opacity: 0, transform: "translateX(12px)" },
    ],
    { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
  ).finished.then(commit, commit);
}

function addSite(value) {
  const host = lib.hostFromInput(value);
  if (!host) return false;
  if (state.sites.some((site) => site.host === host)) {
    pulseRow(host, "is-flash");
    return true;
  }
  persist({ sites: [...state.sites, { host, deep: false }] });
  pulseRow(host, "is-new");
  return true;
}

function toggleDeep(host) {
  persist({
    sites: state.sites.map((site) => (site.host === host ? { ...site, deep: !site.deep } : site)),
  });
}

function pulseRow(host, cls) {
  requestAnimationFrame(() => {
    const row = siteList.querySelector(`li[data-host="${CSS.escape(host)}"]`);
    if (!row) return;
    row.classList.remove(cls);
    void row.offsetWidth;
    row.classList.add(cls);
    // Scroll only the list. scrollIntoView would also scroll the clipped frame.
    const top = row.offsetTop - drawerScroll.offsetTop;
    if (top + row.offsetHeight > drawerScroll.scrollTop + drawerScroll.clientHeight || top < drawerScroll.scrollTop) {
      drawerScroll.scrollTo({ top: Math.max(0, top - 40), behavior: "smooth" });
    }
    setTimeout(() => row.classList.remove(cls), 1300);
  });
}

/* ------------------------------------------------------------ events ------ */

sitesToggle.addEventListener("click", () => setListOpen(!listOpen));
addOpen.addEventListener("click", () => setAdding(!adding));

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (addSite(addInput.value)) {
    addInput.value = "";
    setAdding(false);
  } else {
    addForm.classList.remove("is-invalid");
    void addForm.offsetWidth;
    addForm.classList.add("is-invalid");
  }
});

addInput.addEventListener("input", () => addForm.classList.remove("is-invalid"));

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (adding) {
    event.preventDefault();
    setAdding(false);
  } else if (listOpen) {
    event.preventDefault();
    setListOpen(false);
  }
});

for (const [input, which] of [
  [lightAt, "light"],
  [darkAt, "dark"],
]) {
  input.addEventListener("change", () => commitTime(which));
  input.addEventListener("focus", () => input.select());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
  });
}

for (const btn of segButtons) {
  btn.addEventListener("click", () => {
    if (state.override !== btn.dataset.value) persist({ override: btn.dataset.value });
  });
}

modeGroup.addEventListener("keydown", (event) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const next = ORDER[(ORDER.indexOf(state.override) + step + ORDER.length) % ORDER.length];
  persist({ override: next });
  segButtons[ORDER.indexOf(next)].focus();
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // The background writes lastApplied and pendingReload as bookkeeping.
  const ignored = new Set(["lastApplied", "pendingReload"]);
  if (!Object.keys(changes).some((key) => !ignored.has(key))) return;
  load();
});

// Keep "3h 12m" honest while the popup stays open.
setInterval(renderStatus, 20_000);

drawer.inert = true;
addWrap.inert = true;

if (!globalThis.DaylightLib) {
  statusEl.textContent = "Load error";
} else {
  load();
}
