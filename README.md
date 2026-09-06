# Daylight

A small **Zen / Firefox** extension that puts Linear, ChatGPT, Claude, Cursor, and any other site you add on a morning→evening light/dark schedule. Windows stays dark.

Website-only for now. Desktop apps come after this works.

## Load in Zen (or Firefox)

Use the packed add-on `dist/daylight.xpi` (build it with `npm run pack`). It is a normal Firefox zip with `manifest.json` at the root. Needs Firefox 128+.

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `daylight.xpi`

Click the Daylight icon in the toolbar. Times are typed as `07:00` and `18:00`. Click **4 sites** to see the list, **+** to add a domain. **Auto** cycles Auto → Light → Dark.

If the icon is in the puzzle menu, pin it to the toolbar.

Temporary add-ons go away when Zen restarts. Load the same file again.

## Publish a release

From a clone that has `dist/daylight.xpi`:

```
gh release create v0.2.0 dist/daylight.xpi --repo calledforth/daylight --title "Daylight 0.2.0" --notes-file release/NOTES.md
```

Or GitHub → Releases → Draft a new release → tag `v0.2.0` → attach `daylight.xpi`.

## Develop

```
npm test
npm run pack
```

## Set each site to System

Daylight works by answering the site's own `prefers-color-scheme` question, so **set each listed site's theme to System / Auto once**. From then on the site follows the schedule through its own theme code.

## How it works

A `document_start` script runs in the page, before any site script, on listed hosts only. It replaces `window.matchMedia` for `(prefers-color-scheme: ...)` so the site sees Daylight's scheduled mode instead of the OS setting, and fires `change` when the schedule flips so the site re-themes without a reload.

Windows is never touched, the browser is never touched, and nothing runs at all on sites that are not in your list.

Sites that implement System purely in CSS (`@media (prefers-color-scheme: dark)`) cannot be reached this way, since the CSS engine reads the real OS value. For those, turn on **deep** on the site's row in the popup: it additionally writes the site's own stored theme setting and swaps the theme marker on `<html>`. Off by default.
