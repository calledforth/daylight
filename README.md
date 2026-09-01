# Daylight

A small **Zen / Firefox** extension that puts Linear, ChatGPT, Claude, Cursor, and any other site you add on a morning→evening light/dark schedule. Windows stays dark.

Website-only for now. Desktop apps come after this works.

## Load in Zen (or Firefox)

Use the packed add-on `daylight.xpi` from a GitHub Release (tag `v0.1.1`). It is a normal Firefox zip with `manifest.json` at the root.

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `daylight.xpi`

Click the Daylight icon in the toolbar. Times are typed as `07:00` and `18:00`. Click **4 sites** to see the list, **+** to add a domain. **Auto** cycles Auto → Light → Dark.

If the icon is in the puzzle menu, pin it to the toolbar.

Temporary add-ons go away when Zen restarts. Load the same file again.

## Publish a release

From a clone that has `dist/daylight.xpi`:

```
gh release create v0.1.1 dist/daylight.xpi --repo calledforth/daylight --title "Daylight 0.1.1" --notes-file release/NOTES.md
```

Or GitHub → Releases → Draft a new release → tag `v0.1.1` → attach `daylight.xpi`.

## Develop

```
node --test test/schedule.test.js
./scripts/pack.sh
```

## What it writes

Each listed site gets its own theme setting (usually `localStorage.theme` plus the site’s classes). It does not change the Windows theme and does not flip every website.
