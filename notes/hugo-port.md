> The record of porting this site from Hugo, with the Beautiful Hugo theme, to Infusion 6 - kept for reference while
> its findings are moved elsewhere. Paths are as they were at the time: the build was then `infusion/js/`, and the
> theme `infusion/sfc/` and `infusion/adapt/`. They are now `packages/wend/` and `packages/beautiful-wend/`. The
> requirements it cites, `R1` and so on, are those of [REQUIREMENTS.md](REQUIREMENTS.md).

# The port of ponder.org.uk from Hugo

A port of this site's Hugo theme (`themes/beautifulhugo` plus `layouts/`) to Infusion 6 single-file components. The
whole site is rendered by server-side Infusion as a single component tree, with each page rendered into an output
document of its own. What the port needed from the framework is written up in [REQUIREMENTS.md](REQUIREMENTS.md).
Markers `PROPOSED (REQUIREMENTS.md Rn)` in the sources show where the port still assumes a framework feature that
doesn't exist yet.

## Building

The build uses the checkout of Infusion 6 named for `infusion-6` by the site's `moduleOverrides.json5` (not checked
in), e.g. `[{"moduleName": "infusion-6", "baseDir": "../infusion-6/"}]` for a checkout alongside this repository, as
Infusion's own command-line tools do - or else, without one, Infusion installed in `node_modules`. `--infusion <dir>`
names a checkout explicitly. Whichever is used, `infusion/site.html` boots it through its single `FluidBoot.js` script,
whose files are read from that checkout:

```
npm install --no-bin-links    # --no-bin-links on a shared folder such as vboxsf
npm run build                 # or: node infusion/js/buildSite.js [--infusion <dir>] [-o docs] [--live true]
```

This writes the site to `docs/`, in a few seconds for its 70 pages. Only pages whose markup has changed
are rewritten, and pages left by an earlier build which no longer exist are removed. By default the build is static:
the inert records of the SFCs' scripts which each page holds are stripped. `--live true` keeps them, so that a page
records what it would need to be made live again (REQUIREMENTS.md R11). `--from M --limit N` renders just N pages from
the Mth, for working on the theme.

### Infusion in published pages, and live islands

The build publishes one copy of the Infusion which built the site, at `docs/js/infusion-6/`, mirroring the checkout:
the files `FluidBoot.js` loads, and every file which content refers to as `/js/infusion-6/<path within Infusion>` or an
SFC as `%infusion-6/<path>`. Content should refer to Infusion only so, never to a copy of its own.

A shortcode whose widget runs in the browser, e.g. `{{< vizreactive >}}` or `{{< stabilization >}}`, is a component
which boots its widget from a `$bindable` once rendered, with its libraries as `fluid-client` scripts of its SFC, which
are never evaluated by the build. Its layer is listed in `bootLayers` of `linkage.json`, and a page holding it then
boots Infusion from the published copy. Pages without such islands load no Infusion. Heading anchors and code
highlighting are rendered by the markdown pipeline (`js/markdown.js`), not by scripts run once a page has loaded.

The build runs on node 16.6.2 and later. smol-toml declares node >= 18, but needs only `Object.hasOwn` from it, which
`siteModel.js` supplies when it is absent; npm warns of the engine mismatch when installing under node 16.

The output has the same 70 pages as Hugo's `docs/`, with the same URLs, feeds (`index.xml`) and sitemap, and every
local link resolves. Known differences from Hugo's output:

* Code blocks are not highlighted on the server by chroma, with line numbers - they are highlighted in the browser by
  highlight.js, as the site's `useHLJS` already arranges.
* Some elements bear a wrapper or an id which Hugo's output lacks: the `<div>` holding rendered content, ids
  `fl-id-...` on the containers of subcomponents (REQUIREMENTS.md R7), and the data attributes of shortcode islands.
* The 404 page's `<base>` comes straight after `<meta charset>`, ahead of the stylesheets that Hugo's precedes.
* `<div id="header-big-imgs">` is inside rather than beside `<header>` (REQUIREMENTS.md R3) - unused by this site.
* The SEO partials (`seo/schema`, `seo/twitter`; JSON-LD awaits REQUIREMENTS.md R13) and image processing of the home page's avatar are not ported
  (REQUIREMENTS.md R12).

## Layout

```
infusion/
  site.html             Host document: declares Infusion and imports every SFC; renders nothing itself
  js/siteModel.js       Content pipeline: wend.json + content/ -> page records (Hugo's non-template work)
  js/feeds.js           RSS feeds and the sitemap, generated from the site model
  js/buildSite.js       Multi-document build driver - the counterpart of Infusion's hydrate.js
  sfc/                  The theme
    beautifulWend-site.vue       Root: site model, one beautifulWend.document per page, environmental adaptation holders
    beautifulWend-document.vue   baseof.html - one output document, with header/main/footer slots
    kinds/                Hugo's layout lookup as dynamic layers by page kind and type
    i18n/                 i18n/*.yaml as layers selected by language
    shortcodes/           Hugo shortcodes, rendered as islands within content
    ...                   One SFC per partial or layout
  adapt/                The {{ if .Site.Params.xxx }} cascades, as $linkage holders and the layers they broadcast
    gcse/ piwik/ selfHosted/ hljs/ staticman/ disclaimer/ multilingual/
```

## Component tree

```
beautifulWend.site                         (fluid.resolveRoot: {site} visible everywhere)
├─ i18n          [beautifulWend.i18n, beautifulWend.i18n.<lang>]
├─ gcse, piwik, selfHosted, ...     $if on a site parameter; each holds a $linkage
└─ documents     $for page in pages
   └─ beautifulWend.document  + dynamic [beautifulWend.type.<type>, beautifulWend.kind.<kind>]
      ├─ head      beautifulWend.head      (stylesheetTags, scriptTags: $for over keyed asset records)
      ├─ navbar    beautifulWend.navbar    (items: $for over menu + extraItems, each with a variant layer)
      ├─ header    beautifulWend.header    (+ beautifulWend.header.home / .post / .page by kind or type)
      ├─ main      beautifulWend.main.single | .list | .home | .terms | .notFound
      ├─ pageMeta  ($if type page)
      ├─ footer    beautifulWend.footer
      └─ footerScriptTags
```

## Hugo to Infusion

| Hugo | Infusion |
|---|---|
| `.Site`, `.Site.Params` | `{site}.config`, a `$reactiveRoot` on the resolve-root `beautifulWend.site` |
| A page and its front matter | `{document}.page`, the `$for` variable of `beautifulWend.document` |
| `baseof.html` blocks `header`, `main` | Subcomponent slots of `beautifulWend.document` |
| Layout lookup by kind and type | Dynamic layers `beautifulWend.kind.*` and `beautifulWend.type.*`, which re-target the slots |
| `{{ partial "x.html" . }}` | A subcomponent with an `@id` element |
| `{{ range }}` | `$component` with `$for` |
| `{{ if }}` around markup that belongs to the component | `$component` with `$if` and a self-template (`@id` element) |
| `{{ if eq .Type "post" }}` inside a partial | A variant layer (`beautifulWend.header.post`) applied by the type layer |
| `{{ if .Site.Params.gcse }}` and other environmental cascades | A holder under `beautifulWend.site` with `$if`, whose `$linkage` broadcasts adaptation layers |
| `{{ if .Site.Params.selfHosted }} A {{ else }} B {{ end }}` | Keyed data records (`stylesheets.katex.href`) overridden by an adaptation layer |
| `$.Scratch` | Computed members |
| `i18n "key"` | `{i18n}.strings.key`, from a per-language layer |
| Filters such as `urlize`, `dateFormat` and `urlquery` | `$compute` members calling `beautifulWend.urlize`, `beautifulWend.formatDate`, ... |
| `relativeURLs` | Site-absolute URLs in templates, relativised just before each document is written (R11) |
| `.Content` | `wend.content`, a verbatim view (R2) |
| Shortcodes | Component islands `<div fluid-layers="ponder.shortcode.x">` in content (R2) |
| `{{ if }}` around an element | `@if` on the element (R4) |
| `{{ range }}` emitting siblings, e.g. in `<head>` | A `$for` rendered into a `<fluid-fragment @id>` slot (R3) |
| Aliases (`page/1/`) | `wend.alias`, a component list rendering redirect documents |

## What was checked

* The site builds end to end, and its output was compared page by page with Hugo's `docs/`: the same pages and URLs,
  every local link resolving, and matching markup for the header, navigation, post metadata, summaries, share links,
  pagers, comments and footer scripts.
* Every SFC `<script>` block passes `node --check`, and `infusion/js` passes ESLint.
* Small IL and rendering experiments against Infusion 6 at `0fe90a8` check the claims marked **[verified]** in
  REQUIREMENTS.md.
