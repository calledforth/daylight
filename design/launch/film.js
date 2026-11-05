/*
 * Daylight launch film. One timeline, one render(t).
 *
 * Everything on screen is a pure function of t, except the embedded popup,
 * which is the real extension/popup.html running on a virtual clock
 * (popup-harness.js). render(t) advances that clock to t and fires the popup
 * interactions (real clicks on its real controls) as t passes their cue.
 * Frames must therefore be rendered in order, which both render.mjs and the
 * live preview do.
 */
(() => {
  const DURATION = 37;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------- easing ----
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        const d = dx(t);
        if (Math.abs(e) < 1e-6 || !d) break;
        t -= e / d;
      }
      t = Math.min(1, Math.max(0, t));
      return sy(t);
    };
  }
  const E = {
    out: bezier(0.22, 1, 0.36, 1), // the popup's own --ease-out
    inOut: bezier(0.62, 0, 0.3, 1), // the popup's own --ease
    soft: bezier(0.45, 0, 0.25, 1),
    in: bezier(0.55, 0, 0.9, 0.4),
  };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const prog = (t, a, b, e = E.inOut) => e(clamp((t - a) / (b - a)));
  // In over [a, a+dIn], out over [b, b+dOut].
  const env = (t, a, b, dIn = 0.9, dOut = 0.7, eIn = E.out, eOut = E.soft) =>
    prog(t, a, a + dIn, eIn) * (1 - prog(t, b, b + dOut, eOut));

  function mix(c1, c2, p) {
    const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = h(c1), b = h(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], p))).join(",")})`;
  }

  // Text that rises in out of a blur and drifts up and away on exit.
  function reveal(el, t, a, b, o = {}) {
    const dIn = o.dIn ?? 1.0, dOut = o.dOut ?? 0.7, rise = o.rise ?? 22, blur = o.blur ?? 10;
    const pin = prog(t, a, a + dIn, E.out);
    const pout = b == null ? 0 : prog(t, b, b + dOut, E.soft);
    const op = pin * (1 - pout);
    el.style.opacity = op.toFixed(4);
    el.style.visibility = op <= 0.001 ? "hidden" : "visible";
    const y = (1 - pin) * rise - pout * (o.lift ?? 14);
    const s = o.scale ? lerp(o.scale, 1, pin) : 1;
    el.style.transform = `${o.base || ""} translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
    const bl = (1 - pin) * blur + pout * blur * 0.6;
    el.style.filter = bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : "none";
    return op;
  }

  // -------------------------------------------------------------- stars ----
  const starCanvas = $("stars");
  const sctx = starCanvas.getContext("2d");
  const STARS = (() => {
    let seed = 0x5eed1;
    const r = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const out = [];
    for (let i = 0; i < 300; i++) {
      const bright = i % 14 === 0;
      out.push({
        x: r() * 1920,
        y: Math.pow(r(), 1.5) * 820,
        s: bright ? 1.5 + r() * 1.1 : 0.5 + r() * 0.9,
        a: bright ? 0.8 + r() * 0.2 : 0.25 + r() * 0.5,
        ph: r() * Math.PI * 2,
        sp: 0.6 + r() * 1.4,
        bright,
        tint: ["#ffffff", "#f1f3ff", "#e6ecff", "#fff4e6"][Math.floor(r() * 4)],
      });
    }
    return out;
  })();

  // clear: 0..1, how much to thin the field behind centred type.
  function drawStars(t, alpha, drift, clear = 0) {
    sctx.clearRect(0, 0, 1920, 1080);
    if (alpha <= 0.002) {
      starCanvas.style.opacity = 0;
      return;
    }
    starCanvas.style.opacity = 1;
    for (const st of STARS) {
      const tw = 0.65 + 0.35 * Math.sin(t * st.sp + st.ph);
      const x = st.x + drift * (st.s * 2);
      const y = st.y;
      const d = ((x - 960) / 700) ** 2 + ((y - 540) / 340) ** 2;
      const keep = d >= 1 ? 1 : lerp(1, clamp((d - 0.3) / 0.7) ** 2, clear);
      const a = st.a * tw * alpha * keep;
      if (a < 0.004) continue;
      sctx.globalAlpha = a;
      sctx.fillStyle = st.tint;
      sctx.beginPath();
      sctx.arc(x, y, st.s, 0, Math.PI * 2);
      sctx.fill();
      if (st.bright) {
        const g = sctx.createRadialGradient(x, y, 0, x, y, st.s * 6);
        g.addColorStop(0, "rgba(220,225,255,0.35)");
        g.addColorStop(1, "rgba(220,225,255,0)");
        sctx.fillStyle = g;
        sctx.beginPath();
        sctx.arc(x, y, st.s * 6, 0, Math.PI * 2);
        sctx.fill();
        sctx.globalAlpha = a * 0.55;
        sctx.fillStyle = "#eef0ff";
        sctx.fillRect(x - st.s * 5, y - 0.5, st.s * 10, 1);
        sctx.fillRect(x - 0.5, y - st.s * 5, 1, st.s * 10);
      }
    }
    sctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- grain -----
  (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const img = g.createImageData(256, 256);
    let seed = 99;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = 128 + ((seed >> 8) % 120) - 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    $("grain").style.backgroundImage = `url(${c.toDataURL()})`;
  })();

  // ------------------------------------------------- the fictional page ----
  // "Quillmere" is an invented notes app. Two copies (light, dark) are stacked;
  // the dark one fades in when the schedule flips.
  const PAGE = `
    <aside class="qm-side">
      <div class="qm-ws"><span class="qm-logo"></span>Quillmere</div>
      <div class="qm-search">Search notes</div>
      <div class="qm-nav"><i></i>Home</div>
      <div class="qm-nav"><i></i>Inbox<span class="n">3</span></div>
      <div class="qm-nav is-on"><i></i>Notes</div>
      <div class="qm-nav"><i></i>Projects</div>
      <div class="qm-nav"><i></i>Calendar</div>
      <div class="qm-sec">Pinned</div>
      <div class="qm-nav"><i></i>Winter release</div>
      <div class="qm-nav"><i></i>Field guide</div>
      <div class="qm-nav"><i></i>Reading list</div>
      <div class="qm-me"><span class="av" style="background:linear-gradient(140deg,#f2b680,#d7745a)"></span>Mara Lind</div>
    </aside>
    <main class="qm-main">
      <div class="qm-top">Notes <span>/</span> <b>Winter release</b>
        <span class="qm-avs">
          <span class="av" style="background:linear-gradient(140deg,#9db7f0,#5a72c8)"></span>
          <span class="av" style="background:linear-gradient(140deg,#a7dcc0,#4f9a7c)"></span>
          <span class="av" style="background:linear-gradient(140deg,#f2b680,#d7745a)"></span>
        </span>
        <span class="qm-share">Share</span>
      </div>
      <div class="qm-body">
        <article class="qm-doc">
          <div class="qm-cover"></div>
          <div class="qm-kicker">Plan · edited 2h ago</div>
          <h1 class="qm-h1">Winter release, field notes</h1>
          <p class="qm-p">The new reader ships on the 18th. Below is what is left, who has it, and what we cut if the week runs long.</p>
          <ul class="qm-tasks">
            <li class="done"><span class="cb"></span><span class="tt">Offline sync for shared notes</span><span class="who">Ines</span></li>
            <li class="done"><span class="cb"></span><span class="tt">New onboarding checklist</span><span class="who">Mara</span></li>
            <li><span class="cb"></span><span>Freeze copy for the release post</span><span class="who">Theo</span></li>
            <li><span class="cb"></span><span>Final pass on the reading view</span><span class="who">Ines</span></li>
          </ul>
        </article>
        <aside class="qm-rail">
          <div class="qm-card"><h4>Progress</h4><div class="qm-big">68%</div><div class="qm-bar"><i></i></div></div>
          <div class="qm-card"><h4>Edits this week</h4>
            <div class="qm-spark">${[30, 46, 38, 60, 52, 72, 88].map((h) => `<i style="height:${h}%"></i>`).join("")}</div>
          </div>
          <div class="qm-out"><b>On this page</b><br>Scope<br>Owners<br>Cut list</div>
        </aside>
      </div>
    </main>`;
  $("pageLight").innerHTML = PAGE;
  $("pageDark").innerHTML = PAGE;

  // -------------------------------------------------------- the popup ------
  const frame = $("popupFrame");
  let fw = null; // popup window
  let fd = null; // popup document

  async function loadPopup() {
    const base = new URL("../../extension/", location.href).href;
    const harness = new URL("popup-harness.js", location.href).href;
    let html = await (await fetch(base + "popup.html")).text();
    html = html.replace(/<head>/i, `<head><base href="${base}"><script src="${harness}"></script>`);
    const loaded = new Promise((r) => frame.addEventListener("load", r, { once: true }));
    frame.srcdoc = html;
    await loaded;
    fw = frame.contentWindow;
    fd = frame.contentDocument;
    // The caret blinks on a real-time clock we cannot step; hide it.
    const st = fd.createElement("style");
    st.textContent = "input { caret-color: transparent !important; }";
    fd.head.append(st);
    await fd.fonts.ready;
    await document.fonts.ready;
    // Let the popup's async load() settle and the first frames arm.
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 30));
      fw.__vt.advance(0);
    }
  }

  const q = (sel) => fd.querySelector(sel);
  const TYPED = "quillmere.app";
  const TYPE_AT = 20.35, TYPE_STEP = 0.075;

  // Real clicks on the popup's real controls, at their cue.
  const ACTIONS = [
    { at: 16.45, run: () => q("#sitesToggle").click() },
    { at: 19.85, run: () => q("#addOpen").click() },
    ...[...TYPED].map((_, i) => ({
      at: TYPE_AT + i * TYPE_STEP,
      run: () => {
        const input = q("#addInput");
        input.value = TYPED.slice(0, i + 1);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
    })),
    { at: 21.75, run: () => q("#addForm").requestSubmit() },
    { at: 23.05, run: () => q(`li[data-host="${TYPED}"] .deep`).click() },
    { at: 26.05, run: () => q("#sitesToggle").click() },
    { at: 27.35, run: () => q('.seg[data-value="dark"]').click() },
  ];

  function stepPopup(t) {
    if (!fw) return;
    const ms = t * 1000;
    for (const a of ACTIONS) {
      if (!a.done && a.at * 1000 <= ms) {
        fw.__vt.advance(a.at * 1000);
        fw.__vt.act(a.run);
        a.done = true;
      }
    }
    fw.__vt.advance(ms);
  }

  // -------------------------------------------------------- the camera -----
  // Popup at 1x hangs under the toolbar icon; on stage it is 1.9x on the left.
  const POP_A = { x: 1286 + 300, y: 334 }; // its top-right corner at 1x
  const STAGE_S = 1.9;
  const POP_B = { x: 270 + 300 * STAGE_S, y: 65 }; // top-right corner on stage
  const CAM0 = 12.05, CAM1 = 13.85;

  function cameraAt(t) {
    const p = prog(t, CAM0, CAM1, bezier(0.6, 0, 0.2, 1));
    const s = Math.pow(STAGE_S, p);
    const px = lerp(POP_A.x, POP_B.x, p);
    const py = lerp(POP_A.y, POP_B.y, p);
    return { s, tx: px - s * POP_A.x, ty: py - s * POP_A.y, p };
  }

  // -------------------------------------------------------- the cursor -----
  const cursorEl = $("cursor");
  const cursorSvg = cursorEl.querySelector("svg");
  const ripple = $("ripple");

  function popupPoint(sel, dx = 0, dy = 0) {
    return () => {
      const el = q(sel);
      if (!el) return { x: 960, y: 540 };
      const r = el.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const k = f.width / 300;
      return { x: f.left + (r.left + r.width / 2 + dx) * k, y: f.top + (r.top + r.height / 2 + dy) * k };
    };
  }
  const iconPoint = () => {
    const r = $("tbDaylight").getBoundingClientRect();
    return { x: r.left + r.width / 2 + 2, y: r.top + r.height / 2 + 3 };
  };

  // Each move: [start, end, target]. Clicks: times. Visibility: [in, out] pairs.
  const MOVES = [
    { a: 9.9, b: 11.25, to: iconPoint, from: { x: 1700, y: 1010 } },
    { a: 15.2, b: 16.25, to: popupPoint("#sitesCount", 6, 2), from: { x: 1000, y: 900 } },
    { a: 18.9, b: 19.7, to: popupPoint("#addOpen", 3, 3) },
    { a: 22.1, b: 22.9, to: () => popupPoint(`li[data-host="${TYPED}"] .deep`, 4, 3)() },
    { a: 25.2, b: 25.9, to: popupPoint(".chevron", 3, 3) },
    { a: 26.35, b: 27.2, to: popupPoint('.seg[data-value="dark"]', 0, 3) },
  ];
  const CLICKS = [11.45, 16.45, 19.85, 23.05, 26.05, 27.35];
  const SHOWN = [
    [9.9, 12.3],
    [15.1, 28.4],
  ];
  let cur = { x: 1700, y: 1010 };
  const moveStart = new Map();

  function renderCursor(t) {
    let vis = 0;
    for (const [a, b] of SHOWN) vis = Math.max(vis, prog(t, a, a + 0.4, E.out) * (1 - prog(t, b, b + 0.45, E.soft)));
    for (const m of MOVES) {
      if (t < m.a) continue;
      if (!moveStart.has(m)) moveStart.set(m, m.from || { ...cur });
      const from = moveStart.get(m);
      const to = m.to();
      const p = prog(t, m.a, m.b, bezier(0.5, 0, 0.18, 1));
      // A slight arc reads as a hand, a straight line as a robot.
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const bow = Math.sin(Math.PI * p) * Math.min(60, len * 0.12);
      cur = { x: lerp(from.x, to.x, p) + (-dy / len) * bow, y: lerp(from.y, to.y, p) + (dx / len) * bow };
    }
    let press = 1, rip = 0, ripS = 0.3;
    for (const c of CLICKS) {
      if (t >= c - 0.1 && t < c + 0.25) press = Math.min(press, 1 - 0.14 * Math.sin(Math.PI * clamp((t - c + 0.1) / 0.35)));
      if (t >= c && t < c + 0.6) {
        const p = (t - c) / 0.6;
        rip = Math.max(rip, (1 - E.soft(p)) * 0.75);
        ripS = lerp(0.3, 1.25, E.out(p));
      }
    }
    cursorEl.style.opacity = vis.toFixed(3);
    cursorEl.style.transform = `translate(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px)`;
    cursorSvg.style.transform = `scale(${press.toFixed(4)})`;
    ripple.style.opacity = rip.toFixed(3);
    ripple.style.transform = `scale(${ripS.toFixed(4)})`;
  }

  // --------------------------------------------------------- the clock -----
  function rollHTML(from, to, ps) {
    let i = 0;
    return [...to]
      .map((ch, k) => {
        const f = from[k];
        if (f === ch) return `<span class="d"><span>${ch}</span></span>`;
        const p = ps[i++] ?? 1;
        return `<span class="d"><span style="visibility:hidden">${ch}</span>` +
          `<span class="roll" style="transform:translateY(${(-p * 100).toFixed(2)}%);opacity:${(1 - p).toFixed(3)}">${f}</span>` +
          `<span class="roll" style="transform:translateY(${((1 - p) * 100).toFixed(2)}%);opacity:${p.toFixed(3)}">${ch}</span></span>`;
      })
      .join("");
  }

  function renderClock(t) {
    // 17:58 -> 17:59 -> 18:00, digits rolling right to left like an odometer.
    let html;
    if (t < 6.2) {
      const p = prog(t, 5.9, 6.4, E.out);
      html = rollHTML("17:58", "17:59", [p]);
    } else {
      const base = 7.55;
      const ps = [0.16, 0.08, 0].map((d) => prog(t, base + d, base + d + 0.55, E.out));
      html = rollHTML("17:59", "18:00", ps);
    }
    const el = $("clock");
    if (el._h !== html) {
      el.innerHTML = html;
      el._h = html;
    }
    const p = prog(t, 7.85, 8.35, E.out);
    const mq = `<span style="transform:translateY(${(-p * 100).toFixed(2)}%);opacity:${(1 - p).toFixed(3)}">light</span>` +
      `<span style="transform:translateY(${((1 - p) * 100).toFixed(2)}%);opacity:${p.toFixed(3)}">dark</span>`;
    const mv = $("mqVal");
    if (mv._h !== mq) {
      mv.innerHTML = mq;
      mv._h = mq;
    }
  }

  // ------------------------------------------------------------ captions ---
  const caps = [...document.querySelectorAll(".cap")].map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out }));
  function layoutCaps() {
    for (const c of caps) c.el.style.top = `${Math.round(540 - c.el.offsetHeight / 2)}px`;
  }

  // ------------------------------------------------------------- render ----
  function show(el, op) {
    el.style.opacity = op.toFixed(4);
    el.style.visibility = op <= 0.001 ? "hidden" : "visible";
  }

  function render(t) {
    stepPopup(t);

    // Sky: night -> (browser, still night) -> day stage -> dusk pass -> night.
    const DARK_AT = 27.35;
    const day = prog(t, 12.2, 13.7, E.soft) * (1 - prog(t, DARK_AT + 0.05, DARK_AT + 1.35, E.inOut));
    const dusk = Math.sin(Math.PI * clamp((t - DARK_AT) / 1.5)) * 0.85;
    show($("bgDay"), day);
    show($("bgDusk"), dusk);
    const night = 1 - day; // 1 at night

    // Stars: in for the cold open, faint behind the browser, gone by day,
    // back after the switch, and fullest for the close.
    const starA =
      prog(t, 0.0, 1.6, E.soft) * lerp(1, 0.55, prog(t, 4.2, 5.4)) * (1 - prog(t, 12.2, 13.2, E.soft)) +
      prog(t, DARK_AT + 0.4, DARK_AT + 2.2, E.soft) * lerp(0.7, 1, prog(t, 30.5, 32));
    const clearText = 1 - prog(t, 4.0, 5.0) + prog(t, 30.6, 31.6);
    drawStars(t, starA, t * 1.2, clamp(clearText));

    // Ridges: the brand's hills, night version behind the browser, day version on stage.
    const ridges = prog(t, 4.0, 5.6, E.soft);
    show($("ridges"), ridges);
    $("ridges").style.transform = `translateY(${(prog(t, 30.4, 33.6, E.soft) * 150).toFixed(2)}px)`;
    $("ridgesDay").style.opacity = day.toFixed(4);
    $("ridgesNight").style.opacity = "1";

    // Halo behind the popup on stage.
    const halo = $("halo");
    halo.style.transform = `translate(${270 + 285}px, ${65 + 470}px)`;
    show(halo, prog(t, 12.6, 14.2, E.soft) * lerp(1, 0.28, prog(t, DARK_AT, DARK_AT + 1.4)) * (1 - prog(t, 30.4, 31.6, E.soft)));

    // 1. Cold open --------------------------------------------------------
    const markOp = reveal($("openMark"), t, 0.35, 3.95, { dIn: 1.6, dOut: 0.8, rise: 0, blur: 18, scale: 0.9, lift: 30 });
    const sweep = prog(t, 0.9, 2.6, E.inOut);
    $("openNight").setAttribute("transform", `translate(${(56 * (1 - sweep)).toFixed(3)} ${(56 * (1 - sweep)).toFixed(3)})`);
    reveal($("openLine"), t, 1.9, 4.0, { dIn: 1.1, dOut: 0.7, rise: 18, blur: 10, lift: 24 });
    show($("open"), markOp > 0 || t < 5 ? 1 : 0);

    // 2. Browser ----------------------------------------------------------
    const win = $("window");
    const winIn = prog(t, 4.5, 6.0, E.out);
    const winOut = prog(t, 12.25, 13.35, E.soft);
    show(win, winIn * (1 - winOut));
    win.style.transform = `translateY(${((1 - winIn) * 70).toFixed(2)}px) scale(${lerp(0.965, 1, winIn).toFixed(4)})`;
    win.style.filter = winOut > 0.01 ? `blur(${(winOut * 14).toFixed(2)}px)` : "none";

    reveal($("clockBlock"), t, 5.0, 10.75, { dIn: 1.0, dOut: 0.6 });
    renderClock(t);
    reveal($("s2Caption"), t, 8.55, 10.75, { dIn: 1.0, dOut: 0.6 });
    reveal($("mq"), t, 5.6, 10.75, { dIn: 1.0, dOut: 0.6, rise: 16, base: "translateX(-50%)" });

    // The flip: dark washes out from the Daylight button across the page.
    const flip = prog(t, 7.9, 8.85, bezier(0.5, 0, 0.3, 1));
    const pd = $("pageDark");
    show(pd, flip > 0 ? 1 : 0);
    const R = flip * 1750;
    pd.style.maskImage = pd.style.webkitMaskImage =
      flip >= 1 ? "none" : `radial-gradient(circle at 1278px -40px, #000 ${Math.max(0, R - 220).toFixed(1)}px, transparent ${R.toFixed(1)}px)`;
    const ring = Math.max(env(t, 7.9, 8.7, 0.35, 0.8), env(t, 11.1, 11.55, 0.3, 0.6) * 0.8);
    $("tbRing").style.opacity = ring.toFixed(3);

    // Popup appears under the icon, then the camera pushes in on it.
    const rig = $("popupRig");
    const popIn = prog(t, 11.55, 11.95, E.out);
    const popFade = prog(t, 11.55, 11.72, E.soft);
    const popOut = prog(t, 30.6, 31.6, E.soft);
    show(rig, popFade * (1 - popOut));
    const ps = lerp(0.95, 1, popIn) * lerp(1, 0.95, popOut);
    rig.style.transform = `translateY(${(popOut * 20).toFixed(2)}px) scale(${ps.toFixed(4)})`;
    rig.style.filter = popOut > 0.01 ? `blur(${(popOut * 8).toFixed(2)}px)` : "none";

    const cam = cameraAt(t);
    $("camera").style.transform = `translate(${cam.tx.toFixed(3)}px, ${cam.ty.toFixed(3)}px) scale(${cam.s.toFixed(5)})`;

    // 3. Captions ---------------------------------------------------------
    const nightText = 1 - prog(t, 12.6, 13.4) + prog(t, DARK_AT + 0.2, DARK_AT + 1.2);
    const ink = clamp(nightText);
    for (const c of caps) {
      reveal(c.el, t, c.a, c.b, { dIn: 1.0, dOut: 0.6, rise: 26, blur: 10 });
      c.el.querySelector("h2").style.color = mix("#1d1a15", "#f6f3ff", ink);
      c.el.querySelector("p").style.color = ink > 0.5 ? `rgba(226,222,255,${lerp(0.6, 0.62, ink)})` : `rgba(29,26,21,0.6)`;
    }

    // 4. Close ------------------------------------------------------------
    reveal($("outroTile"), t, 31.3, null, { dIn: 1.6, rise: 0, blur: 20, scale: 0.86 });
    reveal($("outroName"), t, 32.0, null, { dIn: 1.2, rise: 26, blur: 12 });
    reveal($("outroTag"), t, 32.65, null, { dIn: 1.2, rise: 20, blur: 10 });
    reveal($("outroFor"), t, 33.3, null, { dIn: 1.2, rise: 16, blur: 8, base: "translateX(-50%)" });

    renderCursor(t);
  }

  // --------------------------------------------------------------- boot ----
  const ready = (async () => {
    await loadPopup();
    layoutCaps();
    render(0);
  })();

  window.__film = { DURATION, ready, render };

  // Opened directly in a browser: play it live. render.mjs passes ?drive.
  if (!new URLSearchParams(location.search).has("drive")) {
    ready.then(() => {
      const start = performance.now();
      const tick = () => {
        const t = (performance.now() - start) / 1000;
        render(Math.min(t, DURATION));
        if (t < DURATION) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
})();
