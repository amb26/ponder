# The site's own parts

What wend needs of this site beyond its content, configuration and static files. `wend.site.json`, at the root, names
each of these, so that nothing of wend assumes where a site keeps them. Within the site's SFCs, this directory is the
module `ponderSite`, e.g. `%ponderSite/sfc/shortcodes/wend-shortcode-figure.vue`.

## `site.html` - the host document

The document in which the build boots Infusion. It declares the site's modules - wend's own (`wend`), the theme's
(`beautifulWend`) and this one (`ponderSite`) - and imports every SFC of them. It renders nothing itself: the root
component, `beautifulWend.site`, renders each page into an output document of its own. A new SFC, e.g. a new
shortcode, is imported here.

## `editing.json` - the editing configuration

What an editing client, e.g. the "Edit in Infusion" browser extension, is told about the site. The build writes it
into each page's record of what the page was built from.

- `repo`, `branch` - the GitHub repository and branch to which edits are committed, and from which sources are read.
  `.github/workflows/build-site.yml` rebuilds the site on pushes to the same branch.
- `bootLayers` - the layers of components which run in the browser, as islands within otherwise static pages, e.g. a
  shortcode's animation, or Infusion's live examples. A page holding one boots Infusion, from the copy the site
  publishes, and pages holding none load no Infusion at all. A layer must be listed here to run in the browser.
- `framing` - the files of each page's framing, beyond its content, which may be edited, each with the `label` an
  editor shows. Each is either:
  - a file of one of the site's modules, by `module` and `file`, with the `layer` it defines - e.g. the theme's footer.
    An edit is committed not to the module but to the site's own copy of the file, under `override/`, which then
    takes the module's file's place;
  - a file of the site's own, by `path`, e.g. `wend.json`, whose `kind` `patch` marks it as a patch to the root's
    configuration.

## `sfc/shortcodes/` - the shortcodes

One component per shortcode, rendering `{{< name ... >}}` in content. The build turns each into an island,
`<div fluid-layers="wend.shortcode.<name>">`, with the shortcode's parameters as `data-` attributes, which the
component of that layer renders. A shortcode which runs in the browser marks its libraries `fluid-client`, so that the
build never evaluates them, and lists its layer in `bootLayers`.

- `wend-shortcode-figure.vue` - `{{< figure >}}`, an image with a caption
- `wend-shortcode-stabilization.vue` - `{{< stabilization >}}`, an animation of the regimes of stabilization,
  driven by `stabilization-regimes.js`
- `wend-shortcode-vizreactive.vue` - `{{< vizreactive >}}`, Infusion's live visualisation of its reactive cells

## `override/` - the site's copies of its modules' files

Absent until the first such edit. A file at `override/<module id>/<path within the module>`, e.g.
`override/beautifulWend/sfc/beautifulWend-footer.vue`, takes the place of the module's own file wherever it is
imported, so that the site changes its theme's footer without changing the theme. An editing client makes the copy on
the first edit of a file listed in `framing`.
