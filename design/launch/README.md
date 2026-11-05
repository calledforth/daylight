# Daylight launch film

`daylight-launch.mp4`: 1920×1080, 60 fps, H.264 (yuv420p, faststart), 37 s, silent.

## Re-render

From the repo root:

```
node design/launch/render.mjs
```

It needs Node 18+, Playwright with its Chromium, and `ffmpeg` on the PATH. It
writes `design/launch/daylight-launch.mp4` in a few minutes. Options:

```
node design/launch/render.mjs --fps 30 --out /tmp/draft.mp4      # quicker draft
node design/launch/render.mjs --crf 16                            # x264 quality; lower is better and bigger (default 18)
node design/launch/render.mjs --stills 9.5,15,24.5 --dir /tmp/s   # PNG stills at those seconds
```

To watch it live, serve the repo root (`npx serve .`, `python3 -m http.server`)
and open `/design/launch/index.html`. Live playback can drop frames; the render
does not.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `film.css` | The composition: a 1920×1080 stage with every scene laid out. |
| `film.js` | The timeline. `render(t)` sets every moving value from `t`, and cues the popup clicks. |
| `popup-harness.js` | Injected at the top of the real `extension/popup.html`: stubs `browser.storage` with the install defaults, fixes the clock at 14:48, hides favicon requests, and runs the popup's timers and CSS animations on a virtual clock. |
| `render.mjs` | Serves the repo, drives Chromium one frame at a time, and pipes the PNG frames to ffmpeg. |

## How it works

The popup is not redrawn. `film.js` fetches `extension/popup.html`, adds a
`<base>` and the harness script to its `<head>`, and loads it as the `srcdoc` of
an iframe scaled to 1.9×. Every interaction is a real click on the popup's own
controls (`#sitesToggle`, `#addOpen`, `#addInput` plus `requestSubmit`, `.deep`,
`.seg[data-value=dark]`) at its cue in `ACTIONS`.

For each frame, `render(t)` advances the popup's virtual clock to `t`. That
fires any due `setTimeout` or `requestAnimationFrame`, then pauses every CSS
animation and transition and sets its `currentTime`. The popup's 560 ms fold
or 1.4 s sunset therefore lasts exactly that long in the film, however slow a
screenshot is. Frames must be rendered in order, because the popup keeps state.

Everything else (the browser window, the invented "Quillmere" notes page, the
clock, the captions, the cursor and the stars) is plain DOM whose values are a
pure function of `t`.

## Scenes

| Time | Scene |
| --- | --- |
| 0:00–0:05 | Night. The mark resolves as night sweeps across the sun. "Your sites, on your schedule." |
| 0:04–0:12 | A neutral browser window on a dark desktop. The clock rolls 17:59 → 18:00, `prefers-color-scheme` flips to `dark`, and the page turns dark. The browser chrome and desktop do not change. |
| 0:10–0:14 | The cursor clicks the Daylight toolbar button. The popup opens and the camera pushes in on it while the sky turns to day. |
| 0:14–0:31 | The real popup, with captions: the schedule, the sites list unfolding, adding `quillmere.app`, **deep**, then Dark: the sun sets behind the hills and the stars come out. |
| 0:31–0:37 | Tile, "Daylight", tagline, "For Zen & Firefox". |

Quillmere, Postwick and Trail map are invented. The browser chrome is a
generic design, not any real browser's UI. The site list keeps the extension's
defaults, and the rows show the popup's own monogram tiles because favicon
requests are blocked.
