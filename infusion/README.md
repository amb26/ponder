# ponder.org.uk rendered by Infusion 6

A port of this site's Hugo theme (`themes/beautifulhugo` plus `layouts/`) to Infusion 6 single-file components. The
whole site is rendered by server-side Infusion as a single component tree, with each page rendered into an output
document of its own. What the port needed from the framework is written up in [REQUIREMENTS.md](REQUIREMENTS.md).
Markers `PROPOSED (REQUIREMENTS.md Rn)` in the sources show where the port still assumes a framework feature that
doesn't exist yet.

## Building

With a checkout of Infusion 6 alongside this repository, as `../fluid-infusion-6`:

```
npm install --no-bin-links    # --no-bin-links on a shared folder such as vboxsf
npm run build-infusion        # or: node infusion/js/buildSite.js [-o docs-infusion] [--live true]
```

This writes the site to `docs-infusion/`, in about 35 seconds for its 69 pages. Only pages whose markup has changed
are rewritten, and pages left by an earlier build which no longer exist are removed. By default the build is static:
the inert records of the SFCs' scripts which each page holds are stripped. `--live true` keeps them, so that a page
records what it would need to be made live again (REQUIREMENTS.md R11). `--from M --limit N` renders just N pages from
the Mth, for working on the theme.

The build runs on node 16.6.2 and later. smol-toml declares node >= 18, but needs only `Object.hasOwn` from it, which
`siteModel.js` supplies when it is absent; npm warns of the engine mismatch when installing under node 16.

The output has the same 69 pages as Hugo's `docs/`, with the same URLs, feeds (`index.xml`) and sitemap, and every
local link resolves. Known differences from Hugo's output:

* Code blocks are not highlighted on the server by chroma, with line numbers - they are highlighted in the browser by
  highlight.js, as the site's `useHLJS` already arranges.
* Some elements bear a wrapper or an id which Hugo's output lacks: the `<div>` holding rendered content, ids
  `fl-id-...` on the containers of subcomponents (REQUIREMENTS.md R7), and the data attributes of shortcode islands.
* `<div id="header-big-imgs">` is inside rather than beside `<header>` (REQUIREMENTS.md R3) - unused by this site.
* The SEO partials (`seo/schema`, `seo/twitter`) and image processing of the home page's avatar are not ported
  (REQUIREMENTS.md R12).

## Layout

```
infusion/
  site.html             Host document: declares Infusion and imports every SFC; renders nothing itself
  js/siteModel.js       Content pipeline: hugo.toml + content/ -> page records (Hugo's non-template work)
  js/feeds.js           RSS feeds and the sitemap, generated from the site model
  js/buildSite.js       Multi-document build driver - the counterpart of Infusion's hydrate.js
  sfc/                  The theme
    ponder-site.vue       Root: site model, one ponder.document per page, environmental adaptation holders
    ponder-document.vue   baseof.html - one output document, with header/main/footer slots
    kinds/                Hugo's layout lookup as dynamic layers by page kind and type
    i18n/                 i18n/*.yaml as layers selected by language
    shortcodes/           Hugo shortcodes, rendered as islands within content
    ...                   One SFC per partial or layout
  adapt/                The {{ if .Site.Params.xxx }} cascades, as $linkage holders and the layers they broadcast
    gcse/ piwik/ selfHosted/ hljs/ staticman/ disclaimer/ multilingual/
```

## Component tree

```
ponder.site                         (fluid.resolveRoot: {site} visible everywhere)
├─ i18n          [ponder.i18n, ponder.i18n.<lang>]
├─ gcse, piwik, selfHosted, ...     $if on a site parameter; each holds a $linkage
└─ documents     $for page in pages
   └─ ponder.document  + dynamic [ponder.type.<type>, ponder.kind.<kind>]
      ├─ head      ponder.head      (stylesheetTags, scriptTags: $for over keyed asset records)
      ├─ navbar    ponder.navbar    (items: $for over menu + extraItems, each with a variant layer)
      ├─ header    ponder.header    (+ ponder.header.home / .post / .page by kind or type)
      ├─ main      ponder.main.single | .list | .home | .terms | .notFound
      ├─ pageMeta  ($if type page)
      ├─ footer    ponder.footer
      └─ footerScriptTags
```

## Hugo to Infusion

| Hugo | Infusion |
|---|---|
| `.Site`, `.Site.Params` | `{site}.config`, a `$reactiveRoot` on the resolve-root `ponder.site` |
| A page and its front matter | `{document}.page`, the `$for` variable of `ponder.document` |
| `baseof.html` blocks `header`, `main` | Subcomponent slots of `ponder.document` |
| Layout lookup by kind and type | Dynamic layers `ponder.kind.*` and `ponder.type.*`, which re-target the slots |
| `{{ partial "x.html" . }}` | A subcomponent with an `@id` element |
| `{{ range }}` | `$component` with `$for` |
| `{{ if }}` around markup that belongs to the component | `$component` with `$if` and a self-template (`@id` element) |
| `{{ if eq .Type "post" }}` inside a partial | A variant layer (`ponder.header.post`) applied by the type layer |
| `{{ if .Site.Params.gcse }}` and other environmental cascades | A holder under `ponder.site` with `$if`, whose `$linkage` broadcasts adaptation layers |
| `{{ if .Site.Params.selfHosted }} A {{ else }} B {{ end }}` | Keyed data records (`stylesheets.katex.href`) overridden by an adaptation layer |
| `$.Scratch` | Computed members |
| `i18n "key"` | `{i18n}.strings.key`, from a per-language layer |
| Filters such as `urlize`, `dateFormat` and `urlquery` | `$compute` members calling `ponder.urlize`, `ponder.formatDate`, ... |
| `relativeURLs` | Site-absolute URLs in templates, relativised just before each document is written (R11) |
| `.Content` | `ponder.content`, a verbatim view (R2) |
| Shortcodes | Component islands `<div fluid-layers="ponder.shortcode.x">` in content (R2) |
| `{{ if }}` around an element | `@if` on the element (R4) |
| `{{ range }}` emitting siblings, e.g. in `<head>` | A `$for` rendered into a `<fluid-fragment @id>` slot (R3) |
| Aliases (`page/1/`) | `ponder.alias`, a component list rendering redirect documents |

## What was checked

* The site builds end to end, and its output was compared page by page with Hugo's `docs/`: the same pages and URLs,
  every local link resolving, and matching markup for the header, navigation, post metadata, summaries, share links,
  pagers, comments and footer scripts.
* Every SFC `<script>` block passes `node --check`, and `infusion/js` passes ESLint.
* Small IL and rendering experiments against Infusion 6 at `0fe90a8` check the claims marked **[verified]** in
  REQUIREMENTS.md.
