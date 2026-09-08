/*
 * The hero scene. Everything here is drawn with elements and CSS -- no bitmaps --
 * so the sun, moon, stars and clouds can each move on their own. That is the whole
 * reason this is not just two pictures crossfading: a sun baked into a photo cannot set.
 *
 * popup.js only ever writes document.body.dataset.mode. This file watches that and
 * plays the sweep, so the two stay decoupled.
 */
(() => {
  const STAR_COUNT = 96;
  // Roughly one star in nine carries diffraction spikes. Many more than that and
  // the sky stops reading as depth and starts reading as decoration.
  const BRIGHT_EVERY = 9;
  const still = document.querySelector(".popup");
  const field = document.getElementById("stars");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Deterministic scatter: same sky every open, no flicker of a "new" layout.
  let seed = 0x2f6e2b1;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // Real starlight is not uniformly white; a slight spread reads as depth.
  const TINTS = ["#ffffff", "#f4f6ff", "#eaefff", "#fff6ec", "#e6ecff"];

  if (field) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const star = document.createElement("span");
      const bright = i % BRIGHT_EVERY === 0;
      star.className = bright ? "star star-bright" : "star";
      // Bright stars are larger; the rest stay sub-pixel-ish so the field reads
      // as mostly faint with a few standouts, the way a real sky does.
      const size = bright ? 2.1 + rand() * 1.5 : 0.7 + rand() * 1.4;
      // Confined to the sky above the controls, and biased upward on top of that,
      // so the field thins toward the horizon instead of drifting behind the panels.
      const y = Math.pow(rand(), 1.5) * 34;
      const props = [
        `left:${(rand() * 100).toFixed(2)}%`,
        `top:${y.toFixed(2)}%`,
        `width:${size.toFixed(2)}px`,
        `height:${size.toFixed(2)}px`,
        `--star-tint:${TINTS[Math.floor(rand() * TINTS.length)]}`,
        `--star-bloom:${(bright ? 5 + rand() * 4 : 2 + rand() * 2).toFixed(1)}px`,
        // Each star gets its own twinkle phase so the field never pulses in unison.
        `--twinkle-delay:${(rand() * 5.5).toFixed(2)}s`,
        `--twinkle-dur:${(2.6 + rand() * 3.4).toFixed(2)}s`,
        `--star-peak:${(bright ? 0.75 + rand() * 0.25 : 0.35 + rand() * 0.45).toFixed(2)}`,
        // Stars near the horizon come up last, so night arrives top-down.
        `--rise-delay:${(0.15 + (y / 34) * 0.5).toFixed(2)}s`,
      ];
      if (bright) props.push(`--spike:${(9 + rand() * 9).toFixed(1)}px`);
      star.style.cssText = props.join(";");
      frag.append(star);
    }
    field.append(frag);
  }

  if (!still) return;

  // First paint lands in whatever mode the schedule says. Snap to it, then arm
  // the transitions on the next frame so opening the popup is never a 1.4s sweep.
  // The timer is a fallback: if rAF is throttled the popup must still end up
  // interactive rather than frozen with every transition suppressed.
  const arm = () => still.classList.remove("is-still");
  requestAnimationFrame(() => requestAnimationFrame(arm));
  setTimeout(arm, 120);

  if (reduced) return;

  let last = document.body.dataset.mode;
  let clear;
  new MutationObserver(() => {
    const mode = document.body.dataset.mode;
    if (mode === last) return;
    last = mode;
    // The sweep is a one-shot wash of warm or cool light across the card,
    // riding on top of the orbit rotation the CSS is already doing.
    still.classList.remove("is-sweeping");
    void still.offsetWidth; // restart the animation even on a rapid re-toggle
    still.classList.add("is-sweeping");
    clearTimeout(clear);
    clear = setTimeout(() => still.classList.remove("is-sweeping"), 1500);
  }).observe(document.body, { attributes: true, attributeFilter: ["data-mode"] });
})();
