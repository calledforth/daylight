(function daylightInject(global) {
  const MODE = global.__DAYLIGHT_MODE__;
  if (MODE !== "light" && MODE !== "dark") return;

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

  function applyRoot(mode) {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "theme-light", "theme-dark");
    root.classList.add(mode);
    root.style.colorScheme = mode;
    root.dataset.theme = mode;
    root.dataset.colorMode = mode;
    root.setAttribute("data-theme", mode);
    if (document.body) document.body.style.colorScheme = mode;
  }

  function applyChatGPT(mode) {
    write("theme", mode);
    applyRoot(mode);
  }

  function applyClaude(mode) {
    write("theme", mode);
    write("appearance", mode);
    write("colorMode", mode);
    patchJson("settings", (obj) => {
      obj.theme = mode;
      obj.appearance = mode;
    });
    applyRoot(mode);
  }

  function applyLinear(mode) {
    write("theme", mode);
    write("linear-theme", mode);
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (/theme/i.test(key)) {
        const value = localStorage.getItem(key);
        if (value === "light" || value === "dark" || value === "system") {
          write(key, mode);
        }
      }
    }
    applyRoot(mode);
  }

  function applyCursor(mode) {
    write("theme", mode);
    write("cursor-theme", mode);
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
  } else if (host === "cursor.com" || host.endsWith(".cursor.com")) {
    applyCursor(MODE);
  } else {
    applyGeneric(MODE);
  }

  try {
    global.dispatchEvent(new Event("daylight-theme"));
  } catch {
    /* ignore */
  }
})(globalThis);
