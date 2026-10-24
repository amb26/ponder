# Porting ponder.org.uk from Hugo to Infusion 6: framework requirements

Findings from a sketch port of the `beautifulhugo` theme (as customised for this site) to Infusion 6 SFCs, in
`infusion/sfc` and `infusion/adapt`. The port is not runnable yet. Every point below is either checked against
Infusion 6 at `0fe90a8` by a small experiment (marked **[verified]**) or comes from reading the framework source.

Requirements are ordered roughly by how much they block the port. The SFCs cite them as `REQUIREMENTS.md Rn`.

## What already works well

* **Environmental adaptation by `$linkage` [verified].** Each `{{ if .Site.Params.gcse }}`-style cascade becomes a
  holder component under `ponder.site` with `$if` on the parameter, whose `$linkage` broadcasts adaptation layers onto
  the theme's layers (`adapt/*`). An experiment confirmed the semantics the port needs:
    * the output layer is stronger than the layer that matched (`$layers` came out as
      `[fluid.component, t.doc, t.doc.self]`),
    * plain-object members merge key by key, so `ponder.document.selfHosted` replaces only the `href` of
      `stylesheets.katex` and leaves its `priority` alone,
    * clearing the holder's `$if` retracts the adaptation and restores the base values.

  None of `ponder.navbar`, `ponder.document`, `ponder.footer` or `ponder.postMeta` mention gcse, piwik, staticman,
  self-hosting, highlight.js, disclaimers or multilinguality.
* **Data-shaped extension points.** Where the theme has an `if` that appends markup to a list (the gcse and language
  entries of the nav bar, the CDN versus self-hosted asset URLs), the base layer exposes a keyed record (`extraItems`,
  `stylesheets`, `footerScripts`) and adaptations contribute entries to it as data.
* **Hugo's layout lookup maps onto dynamic layers.** `ponder.document` takes `["ponder.kind.<kind>", "ponder.type.<type>"]`
  as dynamic layers, and these re-target its `header` and `main` slots (`sfc/kinds/`).
* **Compact `$if: "$compute:fn(...)"` works [verified]**, although the docs only describe the `{func, args}` form.
* **The template parser keeps `<html>`, `<head>` and `<body>` as elements [verified]**, so a whole document can be
  written as one template (`ponder-document.vue`). All 36 templates parse to a single root.

## Changes made while getting the build working

Following the pass recorded under each requirement below, the port was made to build the whole site (see
README.md). That needed these further changes to Infusion 6, each with tests:

* **R3, partly implemented.** `<fluid-fragment @id="x">` is a slot rendering its subcomponent's markup alone, with no
  element of its own - e.g. the lists of `<link>`s and `<script>`s in `<head>`. A list member whose view does not elide
  its template's root now contributes all of the root's nodes to the list, so `<a>…</a>&nbsp;` per tag renders as
  Hugo's does, rather than within a literal `<fragment>` or `<template>` element as the response to R3 found.
* **Layer precedence across subcomponent records.** A stronger `$component` record listing
  `["ponder.header.post", "ponder.header"]` made `ponder.header` the strongest, since `fluid.flatMergedComputer`
  reversed each record's own list as well as the order of the records. Records are now taken strongest first, each in
  the order it lists its layers. `ponder.header.post`'s `showRule: false` failed to apply without this.
* **SFC blocks are top-level only.** A `<script>` or `<style>` within an SFC's `<template>`, e.g. the giscus loader or
  `ponder.scriptTag`, was taken as a block of the SFC - a template script with `src="@{script.src}"` was fetched.
* **R16, partly implemented.** `defer`, `async`, `itemscope`, `autoplay`, `loop`, `muted`, `playsinline` and others are
  boolean attributes.
* **Writer hook.** `fluid.writeOutputDocumentsWhenSettled(filenameFor, prepare)` calls `prepare` on each ready document
  just before serialising it - `buildSite.js` relativises URLs and strips the traces of a live build there. Doing so in
  `filenameFor` was too early, since islands rendered after it.
* **Performance.** The first full build took over 20 minutes. Three causes were found by profiling: the open fits of
  `fluid.cell` were held in an array, whose removals and scans were quadratic in their number (now a Set); every merge
  tested each layer once per key for being a plain object (now once per layer); and destroying the whole tree at the
  end took half the time (`buildSite.js` no longer does so). The build now takes about 35 seconds.

## R1. Multi-document rendering

Hugo renders one tree of templates per output page. The natural Infusion form is a **single component tree for the
whole site**: `ponder.site` has a `$for` over the page records, and each `ponder.document` renders into **its own
document**. Editing a layer would then re-render exactly the affected pages, and a rebuild could write only the
documents whose DOM changed. This is an incremental build with no extra machinery.

What's missing:

* A way to give a view a container in a fresh server document, e.g. `fluid.serverDocument.create(outputPath)`, with
  `documentElement` as the container (`ponder-document.vue`).
* Per-document SFC `<style>`/`<script>` injection. `fluid.documentInjections` is already keyed by document, which is
  promising.
* Per-document readiness, and a writer for many documents. `hydrate.js` boots one input file and writes one output
  file. `fluid.documentReady(dokkument)` exists but nothing enumerates documents (`js/buildSite.js`).
* A host document whose only job is to declare modules and imports (`site.html`), as distinct from a document that is
  rendered.

Fallback without R1: boot one host document per page, passing the page record in somehow, with no way to share the
site model or the reactive graph between pages. That would be slower than Hugo and would lose the incremental story.

**Implemented in this pass.**

* `fluid.outputDocumentView` is a view layer whose container is the root element of a fresh *output document*, created
  by `fluid.createOutputDocument(documentLocation)` while `documentLocation` is available and released when it isn't.
  A changed location creates a fresh document. The template's root, e.g. `<html>`, is elided onto the document
  element. For `ponder.document`:
  `view: {$component: {$layers: ["fluid.sfcTemplateViewComponent", "fluid.outputDocumentView"], documentLocation: "{document}.page.permalink"}}`.
  The location is the page's URL. `buildSite.js` writes each document to the file of the page at that URL, its
  `outputPath`.
  An SFC that writes `view.$component.$layers` must name `fluid.sfcTemplateViewComponent` itself, as partials already do.
* `fluid.outputDocuments` is a cell listing `{dokkument, location, url}` for every live output document, so a writer
  can enumerate them. No script runs in an output document, which the server parses with linkedom.
* Output documents exist only on the server: the registry, the injection of SFCs into them and the layer itself live
  in `FluidView-node.js`. A client sees at most one document, its own. Its version of `fluid.outputDocumentView`, in
  `FluidView-browser.js`, renders into `document.documentElement` when `documentLocation` is this page's URL, and
  doesn't render otherwise. Given the site's `baseURL`, as ponder supplies, the comparison is of paths relative to the
  site's root, ignoring the origin. Each page records the relative URL of the site's root on its `<html>` element, as
  `fluid-site-root="../../"`, which the server writes when it creates the document. The client resolves that against
  its own address, so a page recognises itself wherever the site is served, even opened from files:
  `https://ponder.org.uk/post/x/`, `http://localhost:1313/post/x/` and `file:///.../docs-infusion/post/x/index.html`
  alike. A page without the record falls back to the base URL's path. The static build strips the record along with the
  other make-it-live material; `--live true` keeps it. That is why ponder passes page URLs rather than file paths: a
  page made live again on the client recognises itself.
* Per-document SFC injection: when a view renders into an output document, the SFCs of its component's layers, and of
  the view's own layers, are injected into that document. Styles are injected as they are in a host document. Scripts
  are not run again: each is recorded as an inert `<script type="text/x-fluid-layer" id="fl-script-...">` holding the
  SFC's script text. Layers are still defined only by the host document. `fluid.ensureImportsLoaded` never picks an
  output document to load a layer into.
* The reconciler now ignores injected nodes (`fluid.isInjectedNode`). Before this, a component that rendered a
  document's `<head>` deleted the SFC styles and scripts injected there on its first re-render.
* Per-document readiness: `fluid.documentReady(dokkument)` moved from `hydrate.js` to `server-support.js`. It now
  works for a document with no injections, and considers only the unavailable components that may render into that
  document (`fluid.documentComponentsAvailable`), so one failing page doesn't hold back the rest.
* Writer: `fluid.writeOutputDocumentsWhenSettled(filenameFor?)` settles the graph, then writes every output document
  to the file at its location, or to `filenameFor(record)`. `fluid.writeDocument` skips a file whose contents are
  already identical, so a rebuild writes only the documents whose markup changed. The result reports
  `{written, unchanged, unready}`. `fluid.writeDocumentsWhenSettled(records)` is the general form.
* Host document: no change needed. `fluid.loadAndBootDocument("site.html")` declares the modules and imports, and
  `fluid.initFreeComponent("ponder.site", ...)` renders the pages. `tests/framework-tests/server/output-documents-test.js`
  (`npm run output-documents-test`) is a small end-to-end version of `buildSite.js`. It checks that an SFC's script runs
  once, that every page holds its style and an inert record of its script, and that after an edit only the edited page
  is rewritten.
* Found along the way: dynamic layer references such as `"{self}.pageLayers"` only worked inside a `$component`
  record. In a layer's own `$layers`, which is how `ponder.document` uses them, they were looked up as layer names, and
  the component became unavailable. They now work in both places. Also, `class="@{...}"` was never interpolated unless
  `@class` was present (`ponder-header.vue`, `ponder-document.vue`). It now is.

## R2. Verbatim HTML and component islands

Page content is HTML produced by the markdown pipeline (`{{ .Content }}`, `{{ .Summary }}`). Infusion has no way to
insert an HTML string verbatim. The only route, a `templateViewComponent` whose `template` is the content, **parses
the content as a template**:

* **[verified]** `<pre>count is @{count}</pre>` rendered as `<pre></pre>`. The reference resolved to `undefined` and
  rendered as empty text, with no error. `content/docs/fluid-view.md` contains 25 `@{` sequences, all in code samples
  documenting Infusion itself, so the docs pages would silently lose their examples.
* i18n strings that contain HTML (`poweredBy`) can't be interpolated, so `ponder-footer.vue` writes that markup out.

Needed:

* A `verbatim` view mode, or an `@html` binding, which reconciles the markup without scanning it for bindings
  (assumed in `ponder-content.vue`).
* **Component islands within verbatim content.** Hugo shortcodes (`{{< figure >}}`, `{{< stabilization >}}`) are
  components embedded in content. `siteModel.expandShortcodes` translates them to `<div fluid-layers="ponder.shortcode.x"
  data-...>`. Verbatim mode should still boot `fluid-layers` elements found inside it, as their child components, so
  that they are subject to the same layers and linkages as the rest of the site.
* An escape for a literal `@{` in templates generally, e.g. `@@{`.

**Implemented in this pass.**

* `verbatim: true` on a template view, as `ponder-content.vue` assumes. The markup is parsed keeping whitespace, may
  have any number of top-level nodes, all rendered inside the container, and is never scanned for bindings, so
  `<pre>count is @{count}</pre>` renders as written.
* Islands: an element bearing `fluid-layers` in verbatim markup is rendered by a child component of the content
  component, with those layers, so the site's layers and linkages apply to it. Its `data-` attributes are its member
  `dataset`, camel-cased like the DOM's (`data-image-caption` is `{self}.dataset.imageCaption`). It is named
  `island-1`, `island-2`, ... in document order, or by its `fluid-id` attribute. It is destroyed when its element
  leaves the content. With no template of its own, the island renders its own markup, still verbatim.
* `@@{` renders a literal `@{` in any template, in text or attributes.

## R3. Fragments and multi-root templates

* **Lists rendered in place.** A `$for` renders its members *inside* its `@id` element. Inside `<head>` there can be
  no wrapper element, so the stylesheet and script tags can't be lists today. The sketch assumes
  `<fluid-fragment @id="...">`, rendered as its members alone (`ponder-head.vue`, `ponder-document.vue`), the
  equivalent of Vue's `<template v-for>`.
* **Multi-root templates.** Hugo partials often emit siblings: `<a>…</a>&nbsp;` per tag, and
  `<div id="header-big-imgs">` beside `<header>`. Each needed an extra wrapper or a change of structure
  (`ponder-tags.vue`, `ponder-header.vue`).
* **Separators between list members**, as in Hugo's `delimit` (`ponder-postMeta-translations.vue`).

Give more explicit examples here, as well as considering how much of this problem can be solved by elide-parent.

**Response.**

What `elideParent` does now, checked against this pass's code. A string template parses to a `fragment` node holding
its top-level nodes. With `elideParent: true`, the default, the fragment's *first* child is rendered onto the
container: its attributes are applied to the container, its children become the container's children, and its tag is
discarded (R16). With `elideParent: false`, the fragment itself is the root, so *all* the top-level nodes become
children of the container. Experiments:

| Template, and where it is used | `elideParent: true` | `elideParent: false` |
|---|---|---|
| `<a>first</a>&nbsp;<a>second</a>` for a plain `@id` child in `<p @id="x">` | `<p><a>first</a></p>`: the rest is dropped, with only a parse warning | `<p><a>first</a>&nbsp;<a>second</a></p>`: correct |
| `<a href="/t/@{tag}">@{tag}</a>&nbsp;` for each member of a `$for` in `<p @id="tags">` | `<p><a>x</a><a>y</a></p>`: each `&nbsp;` silently dropped | `<p><fragment><a>x</a>&nbsp;</fragment><fragment>...</fragment></p>`: **literal `<fragment>` elements in the output** |

So for a single child, `elideParent: false` already supports multi-root templates *inside* the container. For list
members it is broken: `fluid.listViewTree` places each member's root vnode as a child of the list container, so a
fragment root becomes an element. `ponder-tags.vue` and `ponder-postMeta-translations.vue` set `elideParent: false`
and would emit `<fragment>` elements today. Fix: `fluid.listViewTree` should splice a member's fragment children in
place of the fragment. Then `<a>@{tag}</a>&nbsp;` per member renders exactly as Hugo's
`{{ range }}<a>…</a>&nbsp;{{ end }}`.

Separately, elision can't remove the need for a *container*. Three cases remain:

1. **A list with no wrapper.** In `<head>`, `ponder-head.vue` wants
   ```html
   <title>@{title}</title>
   <fluid-fragment @id="stylesheetTags"></fluid-fragment>   <!-- members' <link>s rendered here, with no wrapper -->
   ```
   Elision changes how a member renders into its container. Here the list *itself* must have no container. The
   proposal is `<fluid-fragment @id="x">`, a slot that renders as its children alone. One implementation: the parent's
   `patchChildren` splices the child's current vTree children in place of the slot, as it now splices around absent
   `@if` elements and ignores injected nodes. The parent then re-renders when the list changes, and the members' nodes
   are reconciled positionally among the parent's own.
2. **A component whose output is siblings.** Hugo's header emits `<div id="header-big-imgs">` *beside* `<header>`.
   With `elideParent: false`, the header component's template `<div id="header-big-imgs"/><header>…</header>` would
   render both *inside* the document's `<header @id="header">`, giving a header nested in a header. This needs
   `<fluid-fragment @id="header">` in `ponder-document.vue` as well. In this pass's R7, an adaptation on the document
   can instead contribute the div as a partial with `relativeContainer: "before: @header"`, which works today.
3. **Separators** (Hugo's `delimit`). With list fragments fixed, R4 and R10 express a separator in the member template
   without new syntax: `<span @if="{self}.index">, </span><a href="@{translation.permalink}">…</a>`, with
   `$for: {keyAs: "index"}` over an array. Index 0 is falsy, so the separator precedes every member but the first. A
   keyed collection yields keys rather than indices, so a `$for` option `positionAs: "position"` giving
   `{index, first, last}` would be the general form, and is a few lines in `fluid.expandComponentRecord`.

Recommended order: (a) fix list-member fragments in `fluid.listViewTree`, a bug fix that covers the `&nbsp;` cases;
(b) `<fluid-fragment>` slots, for `<head>` and sibling output; (c) `positionAs`.

## R4. Element-level conditionals

The only conditional is `$if` on a subcomponent. The idiom for an optional element is an `@id` element whose markup
becomes the template of a `$component` with `$if` and no template of its own (`fluid.selfTemplateViewComponent`). It
works, but:

* every optional element costs a named configuration entry as well as its markup. `ponder.header`, `ponder.pager`,
  `ponder.listPager` and `ponder.postPreview` are mostly such entries;
* **[verified]** when the condition is false, **the `@id` element remains, empty**. A false `subtitleBlock` left
  `<h2 class="s"></h2>` in the output, which differs from Hugo's output and is visible in some CSS.

Proposed: `@if="{header}.subtitle"` (and `@else`) on an element, desugaring to the same anonymous `$if` subcomponent
with a self-template, and omitting the element entirely when the condition is false. The `ponder.navbar` variant layer
for leaf versus parent items would also go.

**Implemented in this pass.** `@if="{header}.subtitle"` on an element, and `@else` on the element that follows it,
with only whitespace between. The condition is a reference, a bare path (`@if="showRule"`), a call
(`@if="fluid.tests.isPost({self}.page)"`) or any of these in `@{...}`, optionally negated with a leading `!`.
Unavailable is false, as for `$if`. The element is rendered by an anonymous `fluid.templateBlock` child, named `if-1`,
`else-2`, ..., which exists only while its condition holds. The element is left out of the markup entirely when the
condition is false. References in the element, and subcomponents designated by `@id` inside it, resolve against the
component whose template it is, so moving markup into an `@if` doesn't change its meaning. Blocks get no default id. An
element bearing both `@id` and `@if` renders its configured member as usual, present only while the condition holds.
Nodes around a toggled block are left alone.

## R5. Dynamic layers with fallback

Hugo's template lookup tries several candidates in order (`post/single.html`, `_default/single.html`, …). A dynamic
layer name that isn't defined makes the component unavailable, so `ponder.document.pageLayers` has to hard-code which
type layers exist. Wanted: a "first defined of" form, or a way for a `$compute` to test whether a layer is defined
without becoming unavailable itself.

Comment: This should just be a framework utility that can be a func for a regular $compute

**Implemented in this pass.** `fluid.definedLayers(...candidates)` filters candidate names (Strings or arrays of
them) to the layers that are defined, or listed in `fluid.importMap` and so pending. `fluid.firstDefinedLayer(...)`
returns the first of them, as a 0- or 1-element array. `fluid.isLayerDefined(name)` is the underlying test. Inside a
`$compute`, the result updates when a layer is defined or deleted. `ponder.document.pageLayers` can compute the Hugo
candidate list (`ponder.type.<type>`, then `ponder.kind.<kind>`, ...) and pass it through `fluid.definedLayers`.
This needed the dynamic-layers fix described under R1.

## R6. Linkage ergonomics

The semantics are right (see above). Improvements:

* **`$if` on the `$linkage` record itself**, to avoid a holder component per feature (`ponder-site.vue`).
* **Contextual linkage.** `inputLayers` matches layers *on the same component*. Many Hugo conditions are about the
  *environment*, e.g. "a header within a document of type post". Here they are handled by the document's dynamic type
  layers, which restate the `header` subcomponent record. A selector form matching ancestors, along the lines of
  Infusion 2–5's distributeOptions, would let the type layers stay away from the header:
  `{selector: "ponder.type.post ponder.header", outputLayers: "ponder.header.post"}`.
* **Scope.** Linkages are global for the holder's lifetime. A site tree holding several sites, or a preview beside the
  live site, would need linkages scoped to the holder's subtree.
* **[verified] observation:** toggling the linkage re-instantiated the target component (`instanceId 1 → 2`) rather
  than re-merging it in place. This doesn't matter for a static build, but would for live editing.

Comment: Not clear how we can do better than this, since a change of layer content is by definition what causes turnover. The AI may have misunderstood this, but double-check whether there could be an improvement here.

**Implemented in this pass (first three bullets).**

* `$if` on each entry of a `$linkage` record, as on a `$component` record. The entry is registered only while its
  condition holds. `ponder.site` can hold `gcseLinkage: {$linkage: [{$if: "{site}.config.params.gcse", inputLayers: ..., outputLayers: ...}]}`
  with no holder component.
* Contextual linkage: an entry may hold `selector` instead of `inputLayers`, e.g.
  `{selector: "ponder.type.post ponder.header", outputLayers: "ponder.header.post"}`. The selector's last compound is
  matched against the layers the component is resolving. Earlier compounds are matched against its ancestors' merged
  layers, with `>` for a direct child, and a compound may also be a member name or a layer nickname. The component
  re-merges when an ancestor gains or loses a matched layer, e.g. when `ponder.document`'s dynamic type layer changes.
  `outputLayers` may now be a single String.
* Scope: `scope: "{site}"` (any reference to a component) confines an entry to that component's subtree. The entry is
  registered only while the component exists. Without `scope`, linkages stay global.

**Response (fourth bullet).** Experiment: a `$linkage` entry with `$if`, toggled on and off, adding a layer to a
`ponder.header`-like component that has a child component, a sibling and a parent, a `$reactiveRoot` holding an edited
value, a `$compute` derived from it, and a rendered template.

* Only the target's *instance object* turned over: `instanceId` went 1 → 2 → 3. Its parent, sibling and child kept
  `instanceId` 0.
* Its shadow, live layer and reactive state survived (`count` stayed 5). The unchanged `$compute` was **not**
  re-evaluated: `fluid.mountSignalRecord` carries a signal product over when its record is unchanged. The rendered
  `<h1>` was the same DOM node afterwards.
* From the code, not the experiment: a linkage that doesn't change a component's resolved layers causes no turnover.
  `fluid.invalidateLayer` makes every component bearing the input layer re-run its merge, but
  `fluid.flatMergedComputer` returns its previous merge when the inputs are unchanged.

So the AI's observation is accurate, but the cost is small. A new instance is how "the merged definition changed"
shows up, and there is nothing to avoid at the IL level. The one real cost for live editing is in the view:
`fluid.activateTemplate` reads `shadow.flatMerged`, so any turnover re-activates the component's whole template.
Every binding effect is disposed and reallocated, and event listeners are rebound, although the DOM is reconciled in
place. The dependency exists only so that a change of partial templates is noticed. Making it depend on
`fluid.partialContributions`, computed in a cell of its own with value-equality cutoff, would make a linkage that only
changes values re-render just the affected bindings. That would be a worthwhile follow-up. I haven't done it here.

## R7. Partial template composition

Partial views (`fluid.partialViewComponent`) let an adaptation add markup to a base template without editing it, as
in gcse's modal, piwik's `<noscript>`, the disclaimer, the home avatar and the post metadata. Limitations:

* Only `before:` and `after:` are supported. `first:`/`last:` (into) are needed; post metadata belongs *inside* the
  header's `<h1>` (`ponder-header-post.vue`). `replace:` and `remove:` would also help.
* The selector must be one simple class matching exactly one node, so the base templates gain marker classes
  (`ponder-heading`, `ponder-title`, `ponder-date`, `ponder-credits-row`, `ponder-navbar`, `ponder-footer`). This
  reintroduces a mild version of the coupling that linkage removes. Matching on `@id` members would be more principled.
  
Comment: Add selector syntax of this kind, and also add actual id elements to rendered markup derived from the path + @id of subcomponents to make it clear what component has rendered what node.
  
* One cutpoint per layer: gcse contributes at two places and so goes by two routes (`ponder-document-gcse.vue`).
* The order of several partials at the same cutpoint is unspecified.

Comment: The order should be derived from the layer precedence order of the layers contributing the partials.

* `relativeContainer` is read from the SFC *source text* (`fluid.defFromMap` in FluidView.js) rather than from merged
  configuration. That is why several partial layers on one component don't collide, but it means a partial can't be
  configured by an ordinary layer.

**Implemented in this pass.**

* Dispositions `before:`, `after:`, `first:` and `last:` (into), `replace:` and `remove:`. A `remove:` partial needs no
  template. `ponder-header-post.vue`'s `"last: .ponder-title"` works.
* Selectors (the first comment): `@member` matches the element bearing `@id="member"`, so `"after: @navbar"` needs no
  marker class. Tags, `.class` and `#id` can be combined, with descendant and `>` combinators, e.g. `"last: header > h1"`.
  A selector must still match exactly one node. Later partials are matched against the tree composited so far, so a
  partial can target nodes contributed by a weaker one.
* Ids (the first comment): every element bearing `@id` now carries `id="fl-id-<owner path>.<member>"` in the
  rendered markup, even when the subcomponent renders nothing of its own (previously a placeholder rendering got no id).
  This is the same id the subcomponent's own rendering gives the node, so the markup always shows which member holds
  which node. The conditional-rendering tests now expect `<div id="fl-id-....assignee"></div>` for an empty slot.
* Several cutpoints per layer: a top-level node of a partial template may carry its own cutpoint as
  `@relative="after: @navbar"`. Other top-level nodes go to the layer's `relativeContainer`. All top-level nodes are
  composited, not only the first. gcse's modal and loader could be one partial.
* Order (the second comment): partials are composited in the component's layer precedence order, weakest first, and
  partials at the same cutpoint appear in the document in that order, whatever the disposition. In `$layers`, a parent
  listed earlier is *stronger*.
* `relativeContainer` is no longer read from the SFC's source text. `fluid.partialContributions` reads each layer's own
  definition, `view.$component.relativeContainer` plus either its SFC template or a `partialTemplate` markup String.
  So partials can be written as ordinary JavaScript layers, and any layer can redirect another layer's partial with
  `view: {$component: {partialTemplateLayers: {"ponder.document.gcse": {relativeContainer: "before: @footer"}}}}`.
* Also fixed: a child component's attributes on its container were stripped whenever the parent re-rendered.
  `fluid.patchAttrs` now tracks which attributes the parent wrote and which the child's root wrote, and each removes
  only its own.

## R8. Ordered keyed collections

Keyed records are the right shape for collections which adaptations extend. However, **[verified]** a `$for` over an
object iterates in insertion order, so an entry contributed by an adaptation always comes last. The port sorts by a
`priority` member by hand (`ponder.document.byPriority`). Wanted: `$for` honouring `priority`, ideally with Infusion
2–5's relative constraints (`"before:katex"`).

**Implemented in this pass.** A `$for` over a keyed collection (`fluid.orderKeyedRecords`) orders entries by
`priority` with Infusion's listener priorities: numbers, **higher first**, or `"before:katex"`, `"after:katex"`,
`"first"`, `"last"`. Entries of equal or no priority keep key order. Entries whose value is `null`, e.g. removed by a
stronger layer with `katex: null`, are skipped. The port's `priority` values are ascending, Hugo-weight style, so they
must be negated or reversed. `ponder.document.byPriority` then goes, apart from its defaults for script records (R16).

## R9. Removing and adjusting subcomponents

* **[verified]** A stronger layer can't remove a subcomponent: `header: null` fails with *"Cannot merge value null at
  path child … with a subcomponent record"*. Hugo's 404 layout blanks the header block (`ponder-kind-404.vue`). Wanted:
  a removal directive, or `null` accepted.
* A `$component` record is replaced as a unit, so a layer that only wants to adjust one member of a subcomponent must
  restate the whole record, including `$layers` and `$if`. `ponder.type.page` uses a `showPager` flag on the document
  to avoid this. Merging `$component` records member by member, with `$layers` concatenated or replaced explicitly,
  would remove most such flags.
  
This should have been implemented in the work in #19 inherited from FLUID-5614, report on what might be missing here. In Infusion 4 we had a special fluid.emptySubcomponent marker for this purpose but report on any limitations/ergonomics that might prevent us using null.

**Response.** Checked against this pass's code.

*Adjusting a subcomponent: already implemented by #19.* `fluid.collectComponentRecords` keeps every layer's
`$component` record for a member as a separate merge record of the subcomponent. Experiment with `ponder.type.page`
restating only `main: {$component: {showPager: false}}` over a base record holding `$layers`, `$if` and `label`:

* `showPager` was overridden, `label` and the base layer's other members were kept, and `$layers` stayed `[fluid.component, t.main]`.
* A stronger record holding `$layers: "t.extra"` *added* `t.extra`. Layers accumulate.
* The weaker record's `$if` still governed the subcomponent.

So the port's `showPager` and `showPageMeta` knobs can go, and the comments in `ponder-type-page.vue` and
`ponder-kind-404.vue` are out of date. What is missing:

1. **No way to replace or remove `$layers`.** They only concatenate. A stronger layer can't swap `ponder.header` for
   `ponder.header.minimal`, which is what the requirement's "replaced explicitly" asks for. One option:
   `$layers: {$replace: [...]}` in a contribution, resetting the layers of weaker contributions.
2. **No way to cancel a weaker `$if` or `$for`.** Light-merging takes the strongest contribution holding each, but a
   literal is not accepted. `$if: true` resolves as a function record, and the subcomponent comes out unavailable.
   `fluid.expandIfRecord` should accept Boolean literals.

*Removing a subcomponent with `null`.* This fails as reported: `Cannot merge value null at path main ... with a
subcomponent record`, and the failure makes the **whole parent** unavailable, not just the member. Accepting `null`
is a small change: in `fluid.collectComponentRecords`, treat a `null` contribution as an IL reference is treated now,
discarding all weaker contributions, and return `null` as the member's value. A stronger contribution after it brings
the subcomponent back. Infusion 4 needed `fluid.emptySubcomponent` because its options merging treated `null` as
"no value", and because `components` entries had to keep a `type`. Neither applies now: plain members already take
`null` from a stronger layer, and layers are data, which a marker function is not. A `null` serialises in PTF and
round-trips through the editor. The real limitations are elsewhere:

1. **The template slot still makes a component.** `<header @id="header">` pushes a template merge record, so the member
   comes back as a bare `fluid.component` rendering an empty placeholder element. `null` must also suppress the slot:
   `fluid.activateTemplate` should check the merged member, as it already does for `fluid.isComponentListMember`, and
   either leave the element out (as for a false `@if`) or render it empty without a component. Hugo's 404 empty
   `header` block wants the element left out.
2. **The live layer.** `that.header = null` writes to the live layer, the strongest of all, and would destroy the
   subcomponent from a stray write. It should probably be refused there, or require an explicit `fluid.destroy`.
3. **Lost state.** When the layer holding `null` is withdrawn, e.g. a dynamic kind layer or a linkage, the
   subcomponent comes back as a *fresh* component, and its reactive state is lost. That is inherent, but worth
   documenting.
4. **References.** `{document}.header` resolves to `null` rather than to an unavailable value, so a computation over a
   removed component sees `null` and runs. Context names (`{header}`) simply stop resolving. Consumers need to expect
   both.

`{$component: null}` would be a more explicit spelling and could be accepted alongside bare `null`. My recommendation
is bare `null` plus limitation 1, which is needed for the 404 page to match Hugo anyway.

## R10. Expressions in bindings

Every derived value needs a named `$compute` member: `urlize` for tag slugs, date formatting, i18n placeholder
substitution, URL encoding for share links. That accounts for about half the script in `ponder-shareLinks.vue`,
`ponder-postMeta.vue` and `ponder-termPanel.vue`. The compact call syntax already exists for `@on…` handlers and for
`"$compute:fn(args)"` strings; allowing it in `@{…}` (`@{ponder.urlize({self}.tag)}`) would fold these back into the
templates. Pipelines in Hugo's style (`@{tag | urlize}`) are a further option.

**Implemented in this pass.** `@{ponder.urlize({self}.tag)}` in text, attributes, `@class` and `@if`, with the compact
syntax of `$compute`. Arguments are references or literals (numbers, `true`, bare words). Calls don't nest. The call is
recomputed when an argument changes. A call alone in an attribute binds its raw value, as a single reference does.
`fluid.parseAtStringTemplate` now finds the matching closing brace rather than the first `}`. Pipelines
(`@{tag | urlize}`) are not done: they need a decision on whether the value is the first or last argument, and calls
already cover the port.

## R11. Output pipeline

* **Client-only scripts.** The site emits `<script>` elements that are payload for the browser (KaTeX, giscus, gcse,
  piwik, the 404 emoji). They must not be evaluated during server rendering, and the writer must be able to tell them
  apart from the scripts that boot Infusion. `fluid-hydrated="%infusion-6"` covers only the latter.
* **Lithified versus live output.** A static build wants `<fluid-module>`, `<fluid-import>` and injected SFC script
  nodes stripped. A live-editable build wants them kept and the document marked as hydrated.
  
The strategy is that we will "soft-strip" them. A key requirement is that some external mechanism, such as a Chrome extension, should be able to inspect the traces of the stripped nodes and reconstruct what would have been, and hoist the site back into live editability. Comment on whether anything other than efficiency prevents us from simply leaving them in.
  
* **Post-passes.** Hugo's `relativeURLs` is itself a pass over the output. `buildSite.js` does it with a
  `relativiseURLs` function on the written document, and the templates use site-absolute URLs throughout. A writer hook
  for such passes would be natural.
  
Comment: Such bizarre things should be entirely unnecessary, the renderer has all the context it needs at the moment of generating the URL, comment on whether there is any need for post-passes beyond this.

**Implemented in this pass (first bullet).** A `<script fluid-client>` is payload for the browser. The server never
evaluates it (`fluid.isServerEvaluableScript`), nor inert records, injected SFC scripts, or scripts of a non-JavaScript
type. In output documents (R1) no script is evaluated at all. `fluid.classifyScriptNode(node)` tells a writer, or a
browser extension, what each script is: `"framework"` (`fluid-hydrated`), `"injection"` (an SFC script or an inert
record of one), `"client"` (`fluid-client`) or `"page"`.

**Response (second bullet: can the traces simply be left in?).** Beyond bytes, these things stop a static build from
leaving everything in:

1. **The boot scripts run.** `<script src="…/FluidCore.js" fluid-hydrated="%infusion-6">` and the rest boot Infusion
   in every visitor's browser. The self-boot effect then re-instantiates every `fluid-layers` element, every SFC is
   fetched again from its source path, and the page re-renders. Anything that depends on the client, such as dates,
   `buildYear` or locale, can come out differently from the static output. That isn't a trace any more, it's live
   mode. These must be neutralised, e.g. by turning them into `type="text/x-fluid-stripped"` with the same `src`, which
   an extension can restore.
2. **Wrapped SFC scripts in a hydrated host document.** These are `fluid.def` calls with a `//# sourceURL=` pointing at
   the build machine's absolute `file:` URLs. Without Infusion they throw `fluid is not defined` in the console, and
   the source URLs leak local paths. SFC styles carry the same URL in a `/*# sourceURL=` comment. The inert records
   written into output documents in this pass avoid both problems: browsers neither run nor fetch scripts of an
   unknown type, and the records hold the unwrapped text with no `sourceURL`. Styles in output documents now omit the
   comment too. These records are the soft-strip traces, at no cost beyond their size.
3. **`<fluid-module>` and `<fluid-import>` in `<head>` change how the page parses.** In a browser's HTML parser, an
   unknown element in `<head>` closes the head and opens the body. Every `<title>`, `<meta>` and `<link>` after it is
   then placed in `<body>`. `site.html` puts `<fluid-module>` first, so for a document produced by `hydrate.js` in that
   style, the OpenGraph metadata and title end up in the body. linkedom doesn't do this, so it doesn't show up on the
   server. These elements must move to the end of `<head>`, become `<template>` contents or comments, or be stripped.
   Output documents from R1 don't contain them.
4. **Links to SFC stylesheets point into the source tree.** An SFC `<style src>` is written relative to the module, so
   in an output document it points from `docs-infusion/post/x/` back into `infusion/sfc/`. That works for a local
   preview but not once deployed. The writer must copy or redirect these assets (R12). This is a correctness issue,
   not just a trace issue.
5. **Reconstruction needs data that isn't in the page.** An extension can rebuild the module declarations, imports
   and SFC scripts from the traces. It can't rebuild the *model*, i.e. the page record and site configuration that
   `ponder.site` was given. In the single-tree build, a page is a member of `documents` and has no root component of
   its own. For live editability, the writer should embed, per page, the root layer, the path of the page's component
   and its model data (the page record, in PTF) in an inert script, say `type="application/x-fluid-model"`.

The remaining traces cost only bytes and can stay, as reconstruction aids: `fl-id-` ids, `fluid-layers` on islands,
`fluid-client` attributes, and the inert records.

**Response (third bullet: post-passes).** Agreed that a URL post-pass shouldn't be needed. Each output document now
has a location (`fluid.documentLocation`), and any binding can compute a relative URL at render time with an R10 call,
e.g. `href="@{ponder.relURL({document}.page.relPermalink, /css/main.css)}"`, so `relativiseURLs` can go from
templates. The one exception is URLs *inside verbatim content* (R2), such as markdown's `<img src="/images/…">`, which
no template generates. The same summary HTML also appears on list pages at different depths, so the content pipeline
can't relativise it once. The render-time fix is a URL-rewriting option on the verbatim view, applied to `href`/`src`
as the markup is reconciled, since the view knows its document. Other passes over the output are legitimate but are
serialisation or build steps, not DOM rewriting:

* stripping or neutralising traces (above), and minifying or reformatting;
* content hashes and cache-busting fingerprints, which need the final bytes of the assets;
* site-wide outputs that read every document, such as `sitemap.xml`, RSS and search indices (R12);
* HTML validation and link checking.

A writer hook remains useful for these, as a function from the serialised text to text, run by
`fluid.writeDocument`. A DOM post-pass for URLs is not needed.

## R12. Assets and auxiliary outputs

These are outside the view layer but needed to retire Hugo: copying `static/`, image processing (the home avatar uses
`resources.Get … Fit "300x300 webp"`), `index.xml` RSS, `sitemap.xml`, and the `seo/schema` and `seo/twitter`
partials, which are not ported.

## R13. Context-aware escaping

Go's `html/template` escapes each interpolation for its context: HTML text, attribute, URL, JavaScript string.
Infusion's interpolation does not:

* **[verified]** `<script>var cx = '@{subtitle}';</script>` with a subtitle of `it's "quoted" </script>` produced
  `var cx = 'it's "quoted" </script>';`. That breaks the JavaScript string and closes the element early. Text and
  attribute interpolation were escaped correctly.
* URL query parameters need encoding by hand (`ponder-shareLinks.vue`).

The port builds inline scripts in JavaScript with `JSON.stringify` (`ponder-document-gcse.vue`,
`ponder-document-piwik.vue`). At minimum, interpolation into `<script>`/`<style>` text should be refused or
JS-escaped.

## R14. Content pipeline

`js/siteModel.js` sketches what Hugo does besides templating: TOML config, YAML front matter, markdown with goldmark's
options (`unsafe`, block attributes, code fences and highlighting), sections, taxonomies, pagination, summaries,
prev/next, and i18n YAML. It produces plain data held in `$reactiveRoot`s on `ponder.site`. Open questions:

* Should this stay a batch step, or become **reactive file resources** (one cell per content file) so that the
  incremental benefit of R1 extends to content edits?
* Markdown parity with goldmark: attributes `{.class}`, typographer quotes, heading ids.
* Multilingual page trees and `translations` are not modelled (`adapt/multilingual` is a sketch).

## R15. Module loading

* `site.html` lists 62 `<fluid-import>`s. A directory import, or a bulk `$importMap` on `ponder.site`, would replace
  the list.
* One layer per SFC means a feature spans several files (gcse has four). A multi-layer SFC bundle, with several
  `<script>`/`<template>` pairs keyed by layer, would keep a feature in one file.

## R16. Smaller issues found on the way

* **[verified]** When a template's root is elided into its `@id` container, **the container's tag wins and the root's
  tag is dropped silently**. A `<header>` template rendered into `<div @id="header">` came out as a `<div>`. The
  document template therefore repeats each slot's root tag. A warning, or adopting the root's tag, would help.
* **[verified]** `defer` is missing from the boolean attribute list, so `defer="@{true}"` renders `defer="true"`.
  `async`, `itemscope`, `autoplay`, `loop`, `muted` and `playsinline` are also missing.
* **[verified]** A `$for` iteration variable replaces any default for the same member in the subcomponent record,
  rather than merging over it.

Comment: Give an example of what is meant by this.

* The docs don't say what `elideParent` means for the members of a list, or how a list's per-member containers are
  created.
