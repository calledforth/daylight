## 0.3.0

A redesigned popup.

- Opening the sites list is now one smooth motion: the sky folds into a header
  and the list slides open into the space it frees. The popup no longer resizes
  while it animates.
- Frosted-glass panels over a new layered landscape. The sun now sets behind
  the hills when the schedule flips to dark.
- Auto / Light / Dark is now a three-way switch instead of a button that cycled
  through them. When Light or Dark is held, the status line says the schedule
  is paused.
- The status line shows the time left until the next flip, and the schedule
  row has a dot marking where you are between the two times.
- Sites show their favicons in the collapsed row. Sites without one get a
  coloured letter tile.
- Removing a site animates out, an invalid entry shakes the field, and Esc
  closes the add field and then the list.
- Toggling **deep** no longer reloads every site's icon.
- New toolbar icon: a sun with night sweeping across it, drawn to stay sharp at
  16px on light and dark toolbars.

## 0.2.2

- Replaced the heavy bitmap popup backgrounds with an animated CSS sky, orbiting
  sun and moon, stars, clouds, and glass controls.
- Reduced the packaged extension by removing roughly 6 MB of obsolete artwork.
- Releases are now Mozilla-signed for permanent installation and automatically
  update from GitHub Releases in Zen and Firefox.

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
