---
title: Edit in Infusion - Privacy Policy
subtitle: The Chrome extension "Edit in Infusion"
comments: false
socialShare: false
---

*Last updated 20 November 2026*

"Edit in Infusion" is a Chrome extension for editing a statically published website in place, on pages which
advertise the sources they were built from. This policy describes what it handles, where that is kept, and where it
is sent. In short: it has no server of its own, collects nothing about you, and sends what you edit only to the
GitHub repository of the site you are editing, when you ask it to.

### When it does anything

The extension does nothing on a website until you click its button there. Clicking asks your permission to access
that site. If you grant it, the extension runs on that site's pages from then on, so that they can show edits you
have made which are not yet published. You can withdraw that access at any time from the extension's options page,
or from Chrome's own extension settings. On every other site, it does nothing.

### What it handles

- **The pages of sites you enable it on.** It reads the page's *linkage record*, a small description the site
  publishes of the files the page was built from, and the content of the page, in order to show your edits in it. It
  does not read or record anything else about your browsing.
- **Your edits.** The text of the files you edit, held until they are published.
- **A GitHub access token** which you provide, so that it can read and commit the site's files on your behalf.

### Where it is kept

Everything is kept in your own browser, in the extension's private storage:

- Your GitHub token is kept in the extension's local storage. It is never made visible to the pages you edit.
- Your edits are kept in the extension's IndexedDB storage until the site is seen to have published them, or you
  discard them.

The extension has no server of its own and no analytics. Nothing is synchronised between your devices.

### Where it is sent

- **To GitHub** (api.github.com), using your token: requests to read the files of the repository a page names, and,
  only when you press *Commit*, a commit of your edit to that repository. Such requests are governed by
  [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
  A commit is public if the repository is, and records your GitHub identity as its author.
- **To the site you are editing**: requests for files the site itself publishes - the description of its latest
  build, the code it renders its pages with, and the data of the page being edited - in the same way that viewing
  the site does.

Nothing is sent anywhere else, and nothing is sold or shared with anyone.

### Removing your data

Choosing *Forget token* in the extension's options removes your token. Discarding an edit removes it. Uninstalling
the extension removes everything it has stored.

### Contact

Questions about this policy may be sent to [amb26web@ponder.org.uk](mailto:amb26web@ponder.org.uk). The extension's
source is part of [Infusion 6](https://github.com/fluid-project/infusion-6), in its `extension/` directory.
