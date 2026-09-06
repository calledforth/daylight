## 0.2.1

- Fixed: a live flip only half-applied in apps that re-theme part of their tree
  from a cached value (Linear kept its sidebar and content on different palettes
  until you reloaded). Listed tabs now reload on a flip.
- The tab you are looking at is never reloaded out from under you: it is deferred
  until you switch away from it. Backgrounded tabs reload right away.
- Flipping the override by hand from the toolbar applies immediately, including
  to the tab in front of you.

## 0.2.0

Rewritten theming. Instead of guessing each site's theme convention, Daylight now
answers the site's own `prefers-color-scheme` question.

- Runs at `document_start` in the page, before any site script, on listed hosts only
- Sites set to **System / Auto** now follow the schedule through their own theme code
- Flips live on schedule change — no reload, no fighting the site's re-renders
- Adding a site is now just a hostname; no per-site configuration needed
- Fixed: the old DOM pass stripped `theme-light`/`theme-dark` and added an unknown
  class, breaking any site keyed on the prefixed form (Linear among them)
- Fixed: adding an already-listed site silently did nothing; it now highlights the row
- New per-site **deep** toggle (off by default) for sites whose System option is
  CSS-only and cannot be reached by the media patch

**Set each site's theme to System once** after installing, or nothing will change.

Requires Firefox 128+.

Load it temporarily in Zen:

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `daylight.xpi`
4. Pin Daylight to the toolbar if it sits in the puzzle menu

Temporary add-ons unload when Zen restarts. Load the same file again.
