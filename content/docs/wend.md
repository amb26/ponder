---
title: wend
category: Infusion
type: infusion-docs
---

Wend builds a static site from Infusion 6 components, and lets the site be edited in place, in the browser,
with the edits committed to its GitHub repository. This site is built with it.

## Edit in Infusion

**[Download the latest Edit in Infusion extension (zip)](https://github.com/fluid-project/infusion-6/releases/latest/download/edit-in-infusion.zip)**

"Edit in Infusion" is the Chrome extension which makes a wend site editable in place: edit a page as it is shown, or
its markdown source beside it, and commit the edits to the site's repository. See its
[privacy policy](/edit-in-infusion-privacy/).

Earlier versions are among the [releases](https://github.com/fluid-project/infusion-6/releases) of Infusion's
repository. To install it from the zip:

1. Unzip it into a directory of its own.
2. Open `chrome://extensions` in Chrome, and turn on **Developer mode**, at the top right.
3. Click **Load unpacked**, and choose the directory.

You can also install the most recent published version from the [Chrome Extension Store](https://chromewebstore.google.com/detail/edit-in-infusion/epphpgiplmpablplnonaihjhfmkhcimn).

## Packages

wend is published to npm from [Infusion 6's repository](https://github.com/fluid-project/infusion-6), in two packages:

- [`@fluid-project/wend`](https://www.npmjs.com/package/@fluid-project/wend) - the build, run as `wend-build` in the site's directory, and what is
  published for editing in place.
- [`@fluid-project/wend-theme-beautiful`](https://www.npmjs.com/package/@fluid-project/wend-theme-beautiful) - a theme, the page furniture of
  Beautiful Hugo as Infusion 6 layers, which this site uses.

A site describes itself to wend by its `wend.site.json` - its modules, its host document, its editing configuration
and its static directories. See wend's
[README](https://github.com/fluid-project/infusion-6/tree/main/packages/wend) for the details.
