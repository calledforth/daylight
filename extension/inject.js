// Optional "deep" layer, per site, off by default. Only for sites whose
// System/Auto option is not JS-driven, where the matchMedia patch alone
// cannot reach them. Writes the site's own theme setting and swaps whatever
// theme marker is already on <html>.
(function daylightInject(global) {
  const MODE = global.__DAYLIGHT_MODE__;
  if (MODE !== "light" && MODE !== "dark") return;

  const OTHER = MODE === "dark" ? "light" : "dark";
  const host = location.hostname.replace(/^www\./, "");

  function write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  function patchJson(key, mutator) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object") return;
      mutator(parsed);
      localStorage.setItem(key, JSON.stringify(parsed));
    } catch {
      /* ignore */
    }
  }

  // Swap only markers the page actually uses. The previous version removed
  // "theme-light"/"theme-dark" and added a bare "light"/"dark", which deleted
  // the working theme class on any site keyed on the prefixed form.
  function applyRoot(mode) {
    const root = document.documentElement;
    const targets = [root, document.body].filter(Boolean);

    for (const el of targets) {
      for (const prefix of ["", "theme-", "color-scheme-", "is-"]) {
        const from = `${prefix}${OTHER}`;
        const to = `${prefix}${mode}`;
        if (el.classList.contains(from)) {
          el.classList.remove(from);
          el.classList.add(to);
        }
      }
      for (const attr of ["data-theme", "data-color-mode", "data-colormode", "data-mode", "data-appearance"]) {
        const value = el.getAttribute(attr);
        if (value === null) continue;
        if (value === OTHER || value === `theme-${OTHER}` || value === "system" || value === "auto") {
          el.setAttribute(attr, value.startsWith("theme-") ? `theme-${mode}` : mode);
        }
      }
    }

    root.style.colorScheme = mode;
  }

  function applyChatGPT(mode) {
    write("theme", mode);
    applyRoot(mode);
  }

  function applyClaude(mode) {
    write("theme", mode);
    patchJson("settings", (obj) => {
      if ("theme" in obj) obj.theme = mode;
    });
    applyRoot(mode);
  }

  function applyLinear(mode) {
    write("theme", mode);
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !/theme/i.test(key)) continue;
      const value = localStorage.getItem(key);
      if (value === "light" || value === "dark" || value === "system") write(key, mode);
    }
    applyRoot(mode);
  }

  function applyGeneric(mode) {
    write("theme", mode);
    write("appearance", mode);
    applyRoot(mode);
  }

  if (host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "chat.openai.com") {
    applyChatGPT(MODE);
  } else if (host === "claude.ai" || host.endsWith(".claude.ai")) {
    applyClaude(MODE);
  } else if (host === "linear.app" || host.endsWith(".linear.app")) {
    applyLinear(MODE);
  } else {
    applyGeneric(MODE);
  }
})(globalThis);
