# Porting ponder.org.uk from Hugo to Infusion 6: outstanding requirements

This follows on from REQUIREMENTS.md, after the first implementation pass over R1–R11 and the work to build the whole
site. It lists only:

* the issues that are still outstanding, and
* the responses to the comments in REQUIREMENTS.md.

Requirements keep their numbers from REQUIREMENTS.md. A requirement that has been implemented in full, with no comment
needing a response, is left out: R1, R2, R5 (its comment, "a framework utility that can be a func for a regular
`$compute`", is what was implemented: `fluid.definedLayers`, `fluid.firstDefinedLayer`), R7 (both comments were
implemented as asked: `@member` selectors, `fl-id-` ids, and partials ordered by layer precedence) and R8.

## R3. Fragments and multi-root templates

**Done since REQUIREMENTS.md:** all of steps (a)–(c) of the recommended order. A list member's fragment root
contributes its nodes in place. `<fluid-fragment @id="x">` is a slot that renders as its subcomponent's markup alone.
`$for: {positionAs: "position"}` gives `{index, first, last}` (FLUID-7029), and `ponder-postMeta-translations.vue` now
renders Hugo's `delimit` as `<span @if="!position.first">@{{i18n}.strings.translationsSeparator}</span>`. That isn't
checked by the build, because the multilingual adaptation is only a sketch and this site has no translations.

**Still outstanding, not urgent.** `<div id="header-big-imgs">` is still rendered *inside* `<header>`, not beside it.
`ponder-document.vue` could use `<fluid-fragment @id="header">`, or an adaptation could contribute the div as a partial
with `relativeContainer: "before: @header"`. This site doesn't use it.

### Re-evaluation after FLUID-7029: the markup `<head>` needs

`<head>` is where R3 matters most, because nothing may wrap its children: any element other than `<meta>`, `<link>`,
`<title>`, `<base>`, `<style>`, `<script>`, `<noscript>` or `<template>` closes the head in a browser's parser. What
Hugo's `head.html`, `seo/*.html` and `head_custom.html` emit for this site, and what the port can do now:

| Markup | Requirement | Status |
|---|---|---|
| `<meta charset>`, viewport, `X-UA-Compatible` | static, `charset` within the first 1024 bytes | supported |
| `<title>`, `description`, `author`, `og:*`, `generator` | static with interpolation | supported, matches Hugo |
| `<link rel="icon">`, `<link rel="alternate" type="application/rss+xml">` | singletons, optional (`{{ with }}`) | supported (`@if` where optional) |
| `<link rel="stylesheet">` × 7–8 | ordered list without a wrapper, since order is the cascade; entries swapped or added by adaptations (selfHosted, hljs, staticman) | supported: keyed records with `priority` and `$for` in a `<fluid-fragment>` slot. Output matches Hugo apart from `integrity`/`crossorigin` on CDN links when `selfHosted` is off |
| `<script src="/js/ponder.js">` | list without a wrapper | supported, as above |
| `<base href>` on the 404 page only | conditional singleton. It must come *before* any element with a URL, because the page is served at whatever URL was missing | **was missing; now fixed** (below) |
| `og:image`, `fb:app_id` | optional singletons | supported (`fb:app_id` is unused by this site) |
| `twitter:*` meta × 6 | static with interpolation and `truncate` | supportable now, not ported (R12) |
| `<script type="application/ld+json">` × 2–4 (`seo/structured/*`) | JSON text inside `<script>`, built from page data | **not safely supportable**: script text interpolation isn't escaped (R13). The workaround today is a `$compute` that returns `JSON.stringify(record).replace(/</g, "\\u003c")`, bound as the element's whole text |
| `hreflang` alternates per translation | list without a wrapper | supported as a fragment list, not modelled (R14) |
| SFC `<style>` / `<style src>` injected by the framework | placed deterministically relative to the site's stylesheets | not exercised by this site (no SFC styles); see finding 4 |

**The 404 `<base>`, fixed in this pass.** Hugo emits `<base href="https://ponder.org.uk/">` on the 404 page. Without
it, the relativised URLs in the page (`./css/main.css` and every link) resolve against the missing URL, so a 404 at
`/a/b/` is served unstyled with broken links. `ponder.head` now has a member `baseHref`, which defaults to `false`, and
its template renders `<base @if="baseHref" href="@{baseHref}">`. `ponder.kind.404` sets it through
`head: {$component: {baseHref: ...}}`. The element comes straight after `<meta charset>`, not where Hugo puts it after
most of the stylesheets, because a `<base>` doesn't reliably rebase URLs that the parser has already resolved.

So **for the static build no R3 framework fix is urgent**. Every element of `<head>` that the site uses renders
correctly. The gaps are porting work (twitter meta) and R13 (JSON-LD).

### What breaks once a `<head>` is live

These findings come from an experiment run with linkedom through `fluid.patchChildren`, which is the same code that
would run on the client. It rendered a head with
`<base @if>`, a keyed `$for` of `<link>`s and one of `<script>`s in `<fluid-fragment>` slots, and a trailing `<meta>`,
and then edited it. They don't affect a one-shot static build, but they block optimistic liveness, and `<head>` is
where they bite, because there a node's identity is the resource: a `<link>` whose `href` changes is fetched again, and
a `<script>` runs only when it is first connected.

1. **Fragment members are reconciled by position, not by key.** Inserting stylesheet `m` between `a` and `b`
   rewrote `href` on the existing nodes of `b` and `c`, and replaced the first `<script>` with a fresh `<link>`.
   It then moved each script's `src` onto its neighbour's node and appended fresh nodes for the remainder, including
   the unrelated trailing `<meta>`. In a browser, the stylesheets after the insertion point would be fetched again,
   with a flash of unstyled content. A script whose `src` was rewritten would never run, and a freshly created one would
   run again. FLUID-7029 keyed elements bearing `@id`, but the vnodes spliced in by `fluid.expandFragmentSlot` carry
   no key. **Fix:** give the root vnode of each list member a `memberKey`, and have `patchChildren` match keyed vnodes to
   nodes by key, moving rather than rewriting them. The positional pass would then apply to unkeyed nodes only.
2. **Ids go stale on reused nodes.** The `fl-id-` id is a *default* attribute, written only when the node has none.
   After the insertion above, the head serialised as `<link href="/m.css" id="fl-id-page-4.sheetTags.a">`, so every id
   after the insertion point names the wrong member. Hydration and debugging both rely on these ids. Finding 1's fix
   removes the cause, but a reused node should also have its id rewritten.
3. **`<head>` assumes it owns all its children.** Only SFC injections (`flInjected`, ids `fl-script-`/`fl-style-`)
   are skipped. A `<style>` appended by anything else, such as a browser extension, a widget loader (gcse, piwik), or
   `fluid-hydrated` boot scripts in a hydrated host document, was **removed** by the next re-render of the head. A
   rendered `<head>` has to tolerate foreign nodes. **Fix:** reconcile only nodes this render produced: nodes it created
   (marked), plus, on hydration, nodes matched to the template. Insert relative to owned neighbours, and leave the rest
   alone. A trailing unowned node is not "surplus".
4. **Injections land in the middle of the rendered children.** In a `--live` build, the inert SFC records came out
   between the first stylesheet (`katex`) and the rest. `fluid.swapInjectedNode` appends to `<head>` while the head is
   still being rendered, and later members are appended after the injections. Inert records do no harm there, but SFC
   `<style>` elements injected by the same route would end up at an arbitrary point in the cascade. They would come
   before `bootstrap.min.css` and `main.css`, which would then override them at equal specificity. **Fix:** a fixed
   injection point, e.g. the end of `<head>` after rendering, or a designated `<fluid-fragment>`/comment anchor. This
   mechanism is shown by the inert records; it hasn't been tested with styles, since no SFC in this site has one.
5. **A fragment slot leaves no anchor.** In the output, the slot is just its members, so a client hydrating an
   *empty* list has nowhere to insert the first member except by position. Comments are allowed in `<head>` and
   survive parsing, so `<!--fl:stylesheetTags-->…<!--/fl:stylesheetTags-->` around each fragment slot's output would
   give a stable range. A static build could strip it, as it strips other traces (R11).

Unrelated to `<head>`, the same experiment turned up a bug: a **`$reactiveRoot` holding a primitive reads wrongly on
the first render**. `flag: {$reactiveRoot: false}` (or `0`, `null`, `""`) renders `@{flag}` as `[object Object]`, and
`@if="flag"` as true. `$reactiveRoot: "x"` renders empty. All of these are correct after the first write. Ponder
avoids this by using plain members.

**Fixed in this pass: all five findings, and the primitive `$reactiveRoot`.**

1. `fluid.patchChildren` now matches nodes by key. The markup of each list member is keyed by the list's path and the
   member's key (`fluid.listViewTree`), an `@id` element by its member, and an `@if` element by its block. A keyed node
   is reused only for the same key and is moved, never rewritten. Unkeyed nodes are matched by position among the
   unkeyed ones. For a list over an *array*, members are keyed by index, so an insertion still shifts the keys of
   later members. Lists keyed by record, as `stylesheetTags` is, keep their nodes.
2. The `fl-id-` ids are removed entirely, both on containers and on `@id` elements. See below.
3. A rendering reconciles only the nodes it owns: those it created, plus, on the first rendering over existing markup,
   those it claims from it by position. Foreign nodes are neither reused nor removed. SFC injections and `fluid-hydrated`
   boot scripts are never claimed. An error report rendered in place is owned, so the next rendering replaces it.
4. Each created or moved node is placed immediately after the owned node that precedes it, so anything appended by
   others, injections included, stays after all of the rendering's own nodes. In a `--live` build of this site, all
   the inert records now follow `ponder.js`, after every stylesheet.
5. No anchors are needed. A member of an empty list is inserted after the owned node preceding its slot.

The test "Keyed list members keep their nodes, and nodes not rendered are left alone" in FluidViewTests.js covers
insertion, reordering, emptying and refilling a fragment list beside foreign and injected nodes. Run against the
previous `FluidView.js`, it fails. "Rendering against markup from an earlier rendering claims its nodes" covers
hydration. A full build of this site produces the same output as before, apart from the ids.

**The ids.** Nothing read them back. Ownership is recovered by rendering the same tree over the markup: the client
claims nodes by position on its first rendering, which is how a static page will be made live. Without the ids, the
free-component counter (R16) no longer appears in any page.

**The primitive `$reactiveRoot`.** Two bugs: `fluid.expandElement` recognised record types by the truthiness of their
key, so `{$reactiveRoot: false}` was taken as a plain object, and `fluid.expandReactiveRecord` treated any String as a
context reference. A `$reactiveRoot` is now recognised by the key's presence (`fluid.elementTypeOf`), and only an IL
reference is resolved.

**Recommendation.** Fix 1 together with 2, and fix 3, before any liveness work on full documents. They are small
changes within `patchChildren`, and without them a live `<head>` reloads its stylesheets and runs its scripts again,
or skips them, whenever a list changes. Fix 4 matters as soon as a site with SFC styles renders whole documents. Fix 5
can wait for hydration itself.

### Earlier response to the comment

The comment: "Give more explicit examples here, as well as considering how much of this problem can be solved by
elide-parent".

What `elideParent` does. A string template parses to a `fragment` node holding its top-level nodes. With
`elideParent: true`, the default, the fragment's *first* child is rendered onto the container: its attributes are
applied to the container, its children become the container's children, and its tag is discarded (R16). With
`elideParent: false`, the fragment itself is the root, so *all* the top-level nodes become children of the container.
Experiments, before the fixes of this pass:

| Template, and where it is used | `elideParent: true` | `elideParent: false` |
|---|---|---|
| `<a>first</a>&nbsp;<a>second</a>` for a plain `@id` child in `<p @id="x">` | `<p><a>first</a></p>`: the rest is dropped, with only a parse warning | `<p><a>first</a>&nbsp;<a>second</a></p>`: correct |
| `<a href="/t/@{tag}">@{tag}</a>&nbsp;` for each member of a `$for` in `<p @id="tags">` | `<p><a>x</a><a>y</a></p>`: each `&nbsp;` silently dropped | `<p><fragment><a>x</a>&nbsp;</fragment><fragment>...</fragment></p>`: literal `<fragment>` elements in the output |

So for a single child, `elideParent: false` already supported multi-root templates *inside* the container. For list
members it was broken, since `fluid.listViewTree` placed each member's root vnode as a child of the list container.
That is now fixed, and `<a>@{tag}</a>&nbsp;` per member renders exactly as Hugo's `{{ range }}<a>…</a>&nbsp;{{ end }}`.

Elision can't remove the need for a *container*. Three cases remain beyond it:

1. **A list with no wrapper**, such as the `<link>`s in `<head>`. Here the list *itself* must have no container. This is
   now `<fluid-fragment @id="stylesheetTags">`.
2. **A component whose output is siblings.** Hugo's header emits `<div id="header-big-imgs">` *beside* `<header>`. With
   `elideParent: false`, both would render *inside* the document's `<header @id="header">`, giving a header nested in
   a header. This needs a `<fluid-fragment>` slot, or the partial described above. Still outstanding, as above.
3. **Separators** (Hugo's `delimit`). These can be expressed in the member template with no new syntax:
   `<span @if="{self}.index">, </span><a href="@{translation.permalink}">…</a>`, with `$for: {keyAs: "index"}` over an
   array. Index 0 is falsy, so the separator precedes every member but the first. A keyed collection yields keys rather
   than indices, which is why `positionAs` would be the general form. It is a few lines in
   `fluid.expandComponentRecord`.

## R4. Element-level conditionals

**Done.** `@if`/`@else` are implemented. The `showPager`, `showPageMeta` and `showHeader` knobs on `ponder.document`
have been removed in favour of removing members with `null` (R9).

## R6. Linkage ergonomics

**Outstanding.** One follow-up from the response below: `fluid.activateTemplate` reads `shadow.flatMerged`, so any
turnover re-activates the component's whole template. Making it depend on `fluid.partialContributions` instead, in a
cell of its own with value-equality cutoff, would let a linkage that only changes values re-render just the affected
bindings.

**Response to the comment** ("Not clear how we can do better than this, since a change of layer content is by
definition what causes turnover... double-check whether there could be an improvement here").

Experiment: a `$linkage` entry with `$if`, toggled on and off, adding a layer to a `ponder.header`-like component that
has a child component, a sibling and a parent, a `$reactiveRoot` holding an edited value, a `$compute` derived from it,
and a rendered template.

* Only the target's *instance object* turned over: `instanceId` went 1 → 2 → 3. Its parent, sibling and child kept
  `instanceId` 0.
* Its shadow, live layer and reactive state survived (`count` stayed 5). The unchanged `$compute` was **not**
  re-evaluated: `fluid.mountSignalRecord` carries a signal product over when its record is unchanged. The rendered
  `<h1>` was the same DOM node afterwards.
* From the code, not the experiment: a linkage that doesn't change a component's resolved layers causes no turnover.
  `fluid.invalidateLayer` makes every component bearing the input layer re-run its merge, but
  `fluid.flatMergedComputer` returns its previous merge when the inputs are unchanged.

So the original observation is accurate, but the cost is small. A new instance is how "the merged definition changed"
shows up, and there is nothing to avoid at the IL level. The one real cost for live editing is in the view, as
described under **Outstanding** above. The dependency on `shadow.flatMerged` exists only so that a change of partial
templates is noticed.

## R9. Removing and adjusting subcomponents

**Done since this was written (FLUID-7029):** removal with `null`, including leaving out the `@id` element. In the
port:
* `ponder.kind.404` has `header: null`;
* `ponder.document` has `pageMeta: null`, which `ponder.type.page` restores with a complete record;
* `ponder.type.page` removes the pager with `main: {$component: {pager: null}}`. This adjusts the `main` record
  contributed by `ponder.kind.page` without restating it.

The output is byte-identical to the knob-based version.

**Outstanding.**

1. **No way to replace or remove `$layers`.** They only concatenate, so a stronger layer can't swap `ponder.header` for
   `ponder.header.minimal`. One option: `$layers: {$replace: [...]}` in a contribution, resetting the layers of weaker
   contributions. Removing with `null` and restoring with a complete record now covers the cases this site has.
2. **No way to cancel a weaker `$if` or `$for`.** `$if: true` resolves as a function record, and the subcomponent comes
   out unavailable. `fluid.expandIfRecord` should accept Boolean literals.

**Response to the comment** ("This should have been implemented in the work in #19 inherited from FLUID-5614, report on
what might be missing here. In Infusion 4 we had a special fluid.emptySubcomponent marker for this purpose but report on
any limitations/ergonomics that might prevent us using null").

*Adjusting a subcomponent is already implemented by #19.* `fluid.collectComponentRecords` keeps every layer's
`$component` record for a member as a separate merge record of the subcomponent. Experiment with `ponder.type.page`
restating only `main: {$component: {showPager: false}}` over a base record holding `$layers`, `$if` and `label`:

* `showPager` was overridden, `label` and the base layer's other members were kept, and `$layers` stayed
  `[fluid.component, t.main]`.
* A stronger record holding `$layers: "t.extra"` *added* `t.extra`. Layers accumulate.
* The weaker record's `$if` still governed the subcomponent.

What is missing is items 2 and 3 under **Outstanding**.

*Removing a subcomponent with `null`.* Accepting `null` is a small change: in `fluid.collectComponentRecords`, treat a
`null` contribution as an IL reference is treated now, discarding all weaker contributions, and return `null` as the
member's value. A stronger contribution after it brings the subcomponent back. Infusion 4 needed
`fluid.emptySubcomponent` because its options merging treated `null` as "no value", and because `components` entries
had to keep a `type`. Neither applies now: plain members already take `null` from a stronger layer, and layers are
data, which a marker function is not. A `null` serialises in PTF and round-trips through the editor. The real
limitations are elsewhere:

1. **The template slot still makes a component.** `<header @id="header">` pushes a template merge record, so the member
   comes back as a bare `fluid.component` rendering an empty placeholder element. `null` must also suppress the slot:
   `fluid.activateTemplate` should check the merged member, as it already does for `fluid.isComponentListMember`, and
   either leave the element out (as for a false `@if`) or render it empty without a component. Hugo's 404 empty
   `header` block wants the element left out.
2. **The live layer.** `that.header = null` writes to the live layer, the strongest of all, and would destroy the
   subcomponent from a stray write. It should probably be refused there, or require an explicit `fluid.destroy`.
3. **Lost state.** When the layer holding `null` is withdrawn, e.g. a dynamic kind layer or a linkage, the subcomponent
   comes back as a *fresh* component, and its reactive state is lost. That is inherent, but worth documenting.
4. **References.** `{document}.header` resolves to `null` rather than to an unavailable value, so a computation over a
   removed component sees `null` and runs. Context names (`{header}`) simply stop resolving. Consumers need to expect
   both.

`{$component: null}` would be a more explicit spelling and could be accepted alongside bare `null`. The recommendation
is bare `null` plus limitation 1, which is needed for the 404 page to match Hugo anyway.

## R10. Expressions in bindings

**Outstanding.** Calls in `@{...}` are implemented. Pipelines in Hugo's style (`@{tag | urlize}`) are not. They need a
decision on whether the piped value is the first or last argument. Calls don't nest.

## R11. Output pipeline

**Outstanding.** The first bullet, client-only scripts, is implemented. From the responses below:

1. **Neutralise the boot scripts** in a static build, e.g. as `type="text/x-fluid-stripped"` with the same `src`, which
   an extension can restore.
2. **`<fluid-module>` and `<fluid-import>` in `<head>`** close the head in a browser's parser. In a document produced
   by `hydrate.js` they must move to the end of `<head>`, become `<template>` contents or comments, or be stripped.
   Output documents from R1 don't contain them.
3. **SFC `<style src>` links** point back into the source tree (`infusion/sfc/`). The writer must copy or redirect them
   (R12).
4. **Embed the model for reconstruction.** Per page: the root layer, the path of the page's component, and its model
   data (the page record, in PTF), in an inert script such as `type="application/x-fluid-model"`.
5. **Render-time URLs.** A relative-URL function for R10 calls, e.g.
   `href="@{ponder.relURL({document}.page.relPermalink, /css/main.css)}"`, and a URL-rewriting option on the verbatim
   view for URLs inside content. `buildSite.js` still runs `relativiseURLs` over each document in its `prepare` hook,
   and both could replace it.
6. **A text writer hook** in `fluid.writeDocument`, from the serialised text to text, for the legitimate post-passes:
   minifying, fingerprints, validation. The current `prepare` hook works on the DOM.

**Response to the second comment** ("The strategy is that we will 'soft-strip' them... Comment on whether anything
other than efficiency prevents us from simply leaving them in").

Beyond bytes, these things stop a static build from leaving everything in:

1. **The boot scripts run.** `<script src="…/FluidCore.js" fluid-hydrated="%infusion-6">` and the rest boot Infusion in
   every visitor's browser. The self-boot effect then re-instantiates every `fluid-layers` element, every SFC is fetched
   again from its source path, and the page re-renders. Anything that depends on the client, such as dates, `buildYear`
   or locale, can come out differently from the static output. That isn't a trace any more, it's live mode. These must
   be neutralised.
2. **Wrapped SFC scripts in a hydrated host document.** These are `fluid.def` calls with a `//# sourceURL=` pointing at
   the build machine's absolute `file:` URLs. Without Infusion they throw `fluid is not defined` in the console, and the
   source URLs leak local paths. SFC styles carry the same URL in a `/*# sourceURL=` comment. The inert records written
   into output documents avoid both problems: browsers neither run nor fetch scripts of an unknown type, and the records
   hold the unwrapped text with no `sourceURL`. Styles in output documents omit the comment too. These records are the
   soft-strip traces, at no cost beyond their size.
3. **`<fluid-module>` and `<fluid-import>` in `<head>` change how the page parses.** In a browser's HTML parser, an
   unknown element in `<head>` closes the head and opens the body. Every `<title>`, `<meta>` and `<link>` after it is
   then placed in `<body>`. `site.html` puts `<fluid-module>` first, so for a document produced by `hydrate.js` in that
   style, the OpenGraph metadata and title end up in the body. linkedom doesn't do this, so it doesn't show up on the
   server.
4. **Links to SFC stylesheets point into the source tree.** An SFC `<style src>` is written relative to the module, so
   in an output document it points from `docs-infusion/post/x/` back into `infusion/sfc/`. That works for a local
   preview but not once deployed. This is a correctness issue, not just a trace issue.
5. **Reconstruction needs data that isn't in the page.** An extension can rebuild the module declarations, imports and
   SFC scripts from the traces. It can't rebuild the *model*, i.e. the page record and site configuration that
   `ponder.site` was given. In the single-tree build, a page is a member of `documents` and has no root component of its
   own.

The remaining traces cost only bytes and can stay, as reconstruction aids: `fluid-layers` on islands,
`fluid-client` attributes, the inert records, and the `fluid-site-root` attribute on `<html>`.

**Response to the third comment** ("Such bizarre things should be entirely unnecessary, the renderer has all the
context it needs at the moment of generating the URL, comment on whether there is any need for post-passes beyond
this").

Agreed that a URL post-pass shouldn't be needed. Each output document has a location (`fluid.documentLocation`), and
any binding can compute a relative URL at render time with an R10 call, so `relativiseURLs` can go from templates. The
one exception is URLs *inside verbatim content* (R2), such as markdown's `<img src="/images/…">`, which no template
generates. The same summary HTML also appears on list pages at different depths, so the content pipeline can't
relativise it once. The render-time fix is a URL-rewriting option on the verbatim view, applied to `href`/`src` as the
markup is reconciled, since the view knows its document. Other passes over the output are legitimate, but they are
serialisation or build steps, not DOM rewriting:

* stripping or neutralising traces (above), and minifying or reformatting;
* content hashes and cache-busting fingerprints, which need the final bytes of the assets;
* site-wide outputs that read every document, such as `sitemap.xml`, RSS and search indices (R12);
* HTML validation and link checking.

A text writer hook remains useful for these. A DOM post-pass for URLs is not needed.

## R12. Assets and auxiliary outputs

**Outstanding.** `static/` is copied, and `index.xml` RSS feeds and `sitemap.xml` are generated (`js/feeds.js`). Still
not done:

* image processing (the home avatar uses `resources.Get … Fit "300x300 webp"`);
* the `seo/schema` and `seo/twitter` partials;
* copying or redirecting SFC stylesheet assets (R11).

## R13. Context-aware escaping

**Outstanding, unchanged.** Interpolation is not escaped for its context:

* **[verified]** `<script>var cx = '@{subtitle}';</script>` with a subtitle of `it's "quoted" </script>` produced
  `var cx = 'it's "quoted" </script>';`. That breaks the JavaScript string and closes the element early. Text and
  attribute interpolation are escaped correctly.
* URL query parameters need encoding by hand (`ponder-shareLinks.vue`).

At minimum, interpolation into `<script>`/`<style>` text should be refused or JS-escaped.

## R14. Content pipeline

**Outstanding, unchanged.**

* Should `js/siteModel.js` stay a batch step, or become **reactive file resources** (one cell per content file), so
  that the incremental benefit of R1 extends to content edits?
* Markdown parity with goldmark: attributes `{.class}`, typographer quotes, heading ids.
* Multilingual page trees and `translations` are not modelled (`adapt/multilingual` is a sketch).
* Code blocks are highlighted in the browser by highlight.js, not on the server by chroma with line numbers.

## R15. Module loading

**Outstanding, unchanged.**

* `site.html` lists 62 `<fluid-import>`s. A directory import, or a bulk `$importMap` on `ponder.site`, would replace the
  list.
* One layer per SFC means a feature spans several files (gcse has four). A multi-layer SFC bundle, with several
  `<script>`/`<template>` pairs keyed by layer, would keep a feature in one file.

## R16. Smaller issues

**Done since REQUIREMENTS.md:** `defer`, `async`, `itemscope`, `autoplay`, `loop`, `muted`, `playsinline` and others
are boolean attributes.

**Outstanding.**

* **[verified]** When a template's root is elided into its `@id` container, the container's tag wins and the root's tag
  is dropped silently. A `<header>` template rendered into `<div @id="header">` comes out as a `<div>`. A warning, or
  adopting the root's tag, would help.
* **[verified]** A `$for` iteration variable replaces any default for the same member in the subcomponent record,
  rather than merging over it.
* The docs don't say what `elideParent` means for the members of a list, or how a list's per-member containers are
  created. The R3 response above has the material for this.

* A `$compute` whose function path has a numeric segment, e.g. `"$compute:ponder.kind.404.baseHref(...)"` for a
  function defined as `ponder.kind["404"].baseHref`, makes the build hang rather than fail with a diagnostic. The
  port names the function `ponder.kind.notFoundBaseHref` instead.
  **Fixed, but the cause was different.** That `$compute` with that definition builds correctly, both now and with
  the previous framework. The hang came from writing the definition as `ponder.kind.404.baseHref = ...`, which is a
  JavaScript syntax error, so the SFC's script failed and `ponder.kind.404` was unavailable. That layer is a dynamic
  layer of the page, read from `{self}`, and the page oscillated: with the layer it was unavailable, so the reference
  was unavailable and the layer dropped. Without the layer it was available, so the layer returned. The dynamic layer
  effect now keeps a reference's last resolution while the reference is unavailable. The build exits with status 1,
  reporting the `SyntaxError` and the unavailable page. Tested by "A failed dynamic layer read from the component
  itself leaves it stably unavailable" in FluidILTests.js. `ponder.kind["404"].baseHref` would work, but
  `notFoundBaseHref` is clearer anyway.
* The counter of free components is part of every container id (`fl-id-site-11.documents.0` in the last committed
  build, `fl-id-site-4.documents.0` now). Every page's markup therefore changes whenever the order of construction
  changes, which defeats "only pages whose markup has changed are rewritten", and the id exposes a detail of the
  implementation.
  **Fixed by removing the ids** (R3). No component path appears in the output any more.

**Comment with no response yet:** "Give an example of what is meant by this", on the `$for` iteration variable. This
was not answered in the first pass, and still needs an experiment.
