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

## Cut a release

Write the section in `release/NOTES.md` first, headed `## x.y.z`, then:

```
npm run release -- patch        # or minor, major, or an explicit 1.0.0
```

That bumps `extension/manifest.json`, commits, tags `vx.y.z`, and pushes. The
release workflow then tests, packs, and publishes the XPI to a GitHub Release
with that section as the body. It refuses to run on a dirty tree, off `main`,
or without a matching notes section. Add `--dry-run` to see the version it
would pick without touching anything.

CI runs the tests and packs an XPI artifact on every push and PR.

### Permanent installs

Releases contain `daylight-signed.xpi`, signed by Mozilla on the unlisted
channel. Install that file once in Zen or Firefox; the browser then checks the
release's `updates.json` and installs later GitHub releases automatically.

The release workflow requires `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` repository
secrets from
[addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/en-US/developers/addon/api/key/).
It deliberately refuses to publish an unsigned release.

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
