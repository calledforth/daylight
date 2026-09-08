# Assets

Toolbar icons are `icon-*.png` (and a vector `icon.svg`). That is all the bitmap
art left: the popup's sky, sun, moon, stars and clouds are drawn in CSS by
`popup.css` and `sky.js`, so each piece can animate on its own. The old
`wash-*.png` / `art-*.png` washes were ~6 MB and could only crossfade.

Sideload `dist/daylight.xpi`. Rebuild it with `./scripts/pack.sh`.
