# Assets

Toolbar icons are `icon-*.png`, rendered from vector sources:

- `icon.svg` — the mark (a sun with night sweeping across it, like a phase).
  Source for the 48/96/128 px PNGs.
- `../../design/brand/icon-small.svg` — a pixel-tuned variant for 16/32 px:
  no stars, a bolder split, so it stays legible on light and dark toolbars.
- `../../design/brand/tile.svg` — app-tile version for listings and launch material.

The popup's sky, sun, moon, stars, clouds and hills are drawn in CSS/inline SVG
by `popup.html`, `popup.css` and `sky.js`, so each piece can animate on its own.

Sideload `dist/daylight.xpi`. Rebuild it with `./scripts/pack.sh`.
