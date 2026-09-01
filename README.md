# Daylight

A small **Zen / Firefox** extension that puts Linear, ChatGPT, Claude, Cursor, and any other site you add on a morning→evening light/dark schedule. Windows stays dark.

Website-only for now. Desktop apps come after this works.

## Load in Zen (or Firefox)

Use the packed add-on: [`dist/daylight.xpi`](dist/daylight.xpi). It is a normal Firefox zip with `manifest.json` at the root.

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `daylight.xpi` (or, from a clone, `extension/manifest.json`)

Click the Daylight icon in the toolbar — it is a small overlay popup, not a tab. Times are typed as `07:00` and `18:00`. Click **4 sites** to see the list, **+** to add a domain. **Auto** cycles Auto → Light → Dark.

If the icon is in the puzzle menu, pin it to the toolbar (right-click the extension → Pin to Toolbar).

Account-synced sites (Linear, ChatGPT, Claude, Notion) show a `sync` pill. Those account themes also follow you onto your phone.

Temporary add-ons go away when Zen restarts. Load it again from the same screen.

To rebuild the pack from `extension/`:

```bash
./scripts/pack.sh
```

## What it writes

Each listed site gets **its own** theme setting (usually `localStorage.theme` plus the site’s classes). It does not change the Windows theme and does not flip every website.

## Develop

```bash
node --test test/schedule.test.js
```
