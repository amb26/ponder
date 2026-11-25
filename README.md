# ponder.org.uk

The sources of [ponder.org.uk](https://ponder.org.uk), a static site built with **wend**. wend renders a site as one
tree of [Infusion 6](https://github.com/fluid-project/infusion-6) components, and publishes each page as plain HTML.
Each page also carries a record of what it was built from, so that the "Edit in Infusion" browser extension can edit
the page in place and commit the edit back to this repository.

## Layout

```
content/          The site's pages, in markdown with front matter - posts, docs, terms, standalone pages
static/           The site's own static files - images, papers, stylesheets - copied as they are into the site
wend.json         The site's configuration: its title, menus, author and the theme's parameters
wend.site.json    How wend builds this site: its modules, host document, editing configuration and static directories
wend/             The site's own parts - see wend/README.md
  site.html         The host document, which declares Infusion and imports every SFC of the site's modules
  editing.json      The editing configuration - the repository and branch edits are committed to, and what may be edited
  sfc/shortcodes/   The site's shortcodes, as components
docs/             The built site, which GitHub Pages publishes - written by the build, never edited by hand
notes/            Design notes and requirements gathered while building wend, to be moved elsewhere
checklinks.js     Checks that every link of the built site resolves - npm test
```

The build, and the parts any wend site shares, are the npm package `@fluid-project/wend`, and the theme is `@fluid-project/wend-theme-beautiful` - both
released from `packages/` of [Infusion 6's repository](https://github.com/fluid-project/infusion-6), whose READMEs
describe them.

## Building

```
npm install
npm run build
```

This writes the site to `docs/`, in a few seconds. Only pages whose markup has changed are rewritten, and pages
which no longer exist are removed. Then serve `docs/` with any static server, e.g. `npx http-server docs`.

The build uses Infusion 6 as installed in `node_modules`. To build against a checkout of Infusion instead, name it in a
`moduleOverrides.json5` at the root, which is never committed:

```json5
[{"moduleName": "infusion-6", "baseDir": "../infusion-6/"}]
```

or pass `--infusion <dir>`. The other options of `npx wend-build` are:
- `-o <dir>` writes the site elsewhere than `docs/`;
- `--live true` keeps in each page the records from which it could be made live again;
- `--from M --limit N` renders just N pages from the Mth, e.g. while working on the theme.

## Writing content

A page is a markdown file under `content/`, whose URL follows its path, e.g. `content/post/2025-03-20-ui-as-code.md` is
`/post/2025-03-20-ui-as-code/`. Front matter, in YAML between `---` lines, gives its
`title`, `date`, `tags`, `subtitle` and so on.

Within the markdown:
- **A shortcode**, e.g. `{{< figure src="..." caption="..." >}}`, renders a component of the site's own
  `wend/sfc/shortcodes/`. Those which run in the browser, e.g. `{{< vizreactive >}}`, boot Infusion on their page
  alone - see `bootLayers` in `wend/README.md`.
- **A code fence** whose info string is a language followed by `live`, e.g. ` ```js live `, renders as a live example
  of Infusion: an editor whose code is run, beside any view it defines. One followed by `syntax` is shown highlighted
  and read-only.

## Publishing

`.github/workflows/build-site.yml` builds the site whenever its sources change on the branch named in
`wend/editing.json`, and commits the rebuilt `docs/` to that branch. GitHub Pages serves ponder.org.uk from `docs/` on
`main`.

## Editing in place

The "Edit in Infusion" extension for Chrome, from Infusion 6's `extension/edit-in-infusion/`, edits a page of the
published site in place: its content, and the parts of its framing which `wend/editing.json` lists, e.g. the footer.
Each edit is committed, as the user signed in to GitHub, to the repository and branch which `wend/editing.json` names.
The workflow then rebuilds the site, and the extension recognises the edit as published once the rebuilt site's
`docs/fluid-trace.json` records it.

An edit to a file of the theme is not made in `node_modules/@fluid-project/wend-theme-beautiful` but in the site's own copy of the file, under
`wend/override/`, which takes the place of the theme's - see `overrides` in `wend.site.json`.
