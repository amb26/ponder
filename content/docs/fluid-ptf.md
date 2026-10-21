---
title: Potentia Transmission Format
category: Infusion
type: infusion-docs
---

This page documents the Potentia Transmission Format (PTF), a plain-text document format which captures everything
required to reconstruct a live Fluid Infusion 6 component somewhere else: in another page, another application or
another user's session. It is implemented in `FluidPTF.js`. It transmits a component's
[layers](/docs/fluid-integration-language#layers), its [potentia](#what-is-transmitted) and the contents of its
[live layer](/docs/fluid-integration-language#creator-functions-layernameuserlayer).

The raw markdown underlying these docs is available on [GitHub](https://raw.githubusercontent.com/amb26/ponder/refs/heads/main/content/docs/fluid-ptf.md),
suitable for direct ingestion by your friendly local neighbourhood intelligence.

## Intention

A user should be able to point at any visible instance, choose "Copy", and paste a working replica elsewhere, together
with the state it had accumulated.

The format is designed to be:

* **Intelligible and hackable.** A PTF document is ordinary text that can be read, diffed, edited in any text editor,
  pasted into a chat or an email, or written by hand.
* **Built on an existing standard.** The container is MIME multipart (RFC 1341, RFC 2046), the format of email
  attachments. Each part carries a `Content-Type` and a filename, so that layers travel in their native
  representation: an SFC as `.vue` source, a JavaScript layer as JavaScript, live state as JSON.
* **Complete but minimal.** It carries exactly the layers that are not part of the framework, and only the state that
  the user actually supplied or changed.

## An example

Take the counter from [Fluid View](/docs/fluid-view#a-first-component), loaded from `my-counter.vue`, rendered and
clicked three times:

```js
const that = my.counter({container});
// ... the user clicks +1 three times
fluid.ptf.componentToPTF(that);
```

This is the complete document produced:

```
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="ptf-boundary-buednuutq8"

This is a Potentia Transmission Format (PTF) document holding the layers and potentia of an Infusion component.
--ptf-boundary-buednuutq8
Content-Type: text/x-vue; charset=utf-8
Content-Disposition: attachment; filename="my.counter"
Content-Description: layer

<script>
fluid.def("my.counter", {
    count: 0,
    increment: {
        $method: {
            func: self => self.count++,
            args: "{self}"
        }
    }
});
</script>

<template>
    <div class="counter">
        <span>Clicked @{count} times</span>
        <button @onclick="{self}.increment()">+1</button>
    </div>
</template>

<style>
.counter {
    display: flex;
    gap: 12px;
}
</style>

--ptf-boundary-buednuutq8
Content-Type: application/json; charset=utf-8
Content-Disposition: attachment; filename="/"
Content-Description: potentia

{
    "$layers": [
        "my.counter"
    ]
}
--ptf-boundary-buednuutq8
Content-Type: application/json; charset=utf-8
Content-Disposition: attachment; filename="/"
Content-Description: live

{
    "count": 3
}
--ptf-boundary-buednuutq8--
```

Reading it from the top:

1. The MIME header declares a multipart document and its boundary string. The boundary is chosen at random so that it
   doesn't occur in any part.
2. The preamble line is ignored by decoders, but tells a human reader what they are looking at.
3. The `layer` part is the SFC exactly as its author wrote it.
4. The `potentia` part for `/` says the component was made from `my.counter`. Its `container` argument has been
   dropped, because it was a DOM node.
5. The `live` part for `/` records that `count` was changed to 3.

Pasting this into another page and calling `fluid.ptf.instantiate(text, {potentia: {container}})` renders
"Clicked 3 times", and the copy then counts on from 3 independently of the original.

### With a JavaScript layer and a subcomponent

If the counter is embedded in a panel defined in plain JavaScript:

```js
fluid.def("my.counterPanel", {
    $layers: "fluid.component",
    title: "Clicks",
    counter: {
        $component: {
            $layers: "my.counter"
        }
    }
});

const panel = my.counterPanel({title: "Visitor clicks"});
panel.counter.increment();
panel.counter.increment();
```

then the document holds these parts:

| Kind | Filename | Content type | Body |
|---|---|---|---|
| `layer` | `my.counterPanel` | `text/javascript` | The `fluid.def("my.counterPanel", {...});` call, regenerated from the stored definition |
| `layer` | `my.counter` | `text/x-vue` | The SFC source, as above |
| `potentia` | `/` | `application/json` | `{"$layers": ["my.counterPanel"], "title": "Visitor clicks"}` |
| `live` | `/counter` | `application/json` | `{"count": 2}` |

There is no `potentia` part for `/counter`, because the panel's layer creates the counter itself. Its live state is
still sent, keyed by its path.

## Transmitting components, not data

Conventional copy and paste moves **data in an application-specific format**: text, an image, a spreadsheet range, or a
serialised blob. Sender and receiver must agree in advance on what that data means, and the receiver must already
contain the code that gives it behaviour. A rich clipboard flavour only works between applications that share an
understanding of it, and what moves is always the application's *output*, never a piece of the application itself.

PTF is a single, general format, which a receiver needs to understand only once. What it carries is a **component of
the application itself**: the definitions that produce it, not data shaped for a particular consumer. Because an
Infusion component is fully determined by its layers plus a small record of how it was configured and changed, sending
those is enough to rebuild it, with its behaviour intact. The receiver doesn't need to have seen the component, or
any application like it, before.

## Preserving authorship

A component is not built from one block of code but from a stack of layers, often written by different people at
different times. A base layer from a library, a derived layer from an application author, a [`$linkage`](/docs/fluid-integration-language#linkage)
contributed by a plugin, the user's own configuration and the edits made during use are each a separate contribution,
merged by the framework with [well-defined precedence](/docs/fluid-integration-language#merging-and-precedence).

PTF keeps that structure. Each layer travels as its own part, under its own name, in the source format its author
wrote it in: an SFC as the `.vue` file it was loaded from, verbatim, not regenerated. The user's configuration and the
live changes made during use travel separately again. A PTF document is never compiled, bundled or flattened into one
tangled block of source code in which nobody can tell which lines came from whom.

This has consequences for the receiver:

* **Provenance is legible.** Anyone reading the document can see which author contributed what, and in what order
  the contributions apply.
* **Contributions stay separable.** A receiver can keep its own, perhaps newer, version of a library layer, and
  accept only the application author's layer and the user's state. It can also edit a single layer without disturbing
  the others.
* **The copy remains malleable.** The rebuilt component has the same layered structure as the original, so it can be
  adapted, re-linked and transmitted onward in the same terms. Its history of authorship grows rather than being
  erased at each hop.

## What is transmitted

A component's merged contents come from three kinds of source, and each is transmitted as a separate kind of part,
named in its `Content-Description` header:

| Kind | What it holds | Filename | Content type |
|---|---|---|---|
| `layer` | The definition of each user layer resolved into the `$layers` of the component or any of its subcomponents | The layer name | `text/x-vue`, `text/javascript` or `application/json` |
| `potentia` | The **user potentia**: the arguments supplied when the component was created (to its creator function or `fluid.pushPotentia`) | The component's path, e.g. `/` or `/counter` | `application/json` |
| `live` | The contents of the component's **live layer**: every value written to it during its lifetime | The component's path | `application/json` |

The first kind is sometimes called "Potentia I" (the reusable definitions) and the other two "Potentia II" (what
distinguishes this particular instance).

Details:

* **Which layers.** Framework layers (those with `$variety: "framework"` or `"frameworkAux"`) are omitted, since the
  receiver is expected to have its own copy of the framework. So are layers whose definitions can't be found.
* **Layer representation.** A layer loaded from a Single File Component is sent as its SFC source text, byte for byte,
  including its `<template>` and `<style>`. Any other layer is rendered as a `fluid.def(...)` call in JavaScript, with
  functions included by their source text. Live layers, whose names are rendered sites beginning with `{`, are JSON.
  `fluid.layerMimeType(layerName)` reports which representation a layer will use. SFC layers are recognised by the tag
  layer `fluid.sfcLayer`, which the SFC loader adds to every layer it loads.
* **Paths.** Filenames for `potentia` and `live` parts are paths relative to the transmitted component, which is `/`.
  A subcomponent at member `counter` is `/counter`, and segments are URI-encoded.
* **Potentia of the root.** The root's `potentia` part always holds `$layers`, the full list of layers the component
  was created with. Its first entry is the layer whose creator function will rebuild it.
* **Live layer.** This is flattened to a map from path to value, e.g. `{"count": 3, "state.prompt": "Hi"}`.
* **Values that can't travel.** Potentia and live values are reduced to what JSON can represent faithfully. Values
  supplied by the host environment, such as a `container` DOM node or a function, are dropped, and so is any object
  left empty by dropping them, e.g. a `view` record holding only a container. The receiver supplies its own.
* **Subcomponents.** Subcomponents are visited recursively. A subcomponent created by a `$component` record in a layer
  needs no `potentia` part, because its layer recreates it, but its live state is still transmitted.

## Reconstruction

`fluid.ptf.instantiate(text, options)` rebuilds the component in three steps:

1. **Register layers.** Each `layer` part is registered. An SFC goes through `fluid.loadSFCText`, a JavaScript part
   is evaluated (running its `fluid.def(...)` call), and a JSON part is passed to `fluid.def`. A layer the receiver
   already defines is left alone unless `overrideLayers` is set.
2. **Construct the root.** A free component is created from the root's `potentia` part, with `options.potentia`
   merged over it, using the creator function of the first entry in its `$layers`. A document with no root
   `potentia` part is rejected.
3. **Apply the rest.** Once the root becomes available, the `potentia` parts of subcomponents are pushed at their
   paths. Then each subcomponent's `live` part is written into its live layer once that subcomponent becomes
   available. Parts whose path matches no component are returned as `unresolved`.

A host which must take responsibility for the component before it becomes available, such as a canvas which may
destroy the shape hosting it while it is still loading, can split the steps: `fluid.ptf.constructParts` performs the first two and returns the component at once, and
`fluid.ptf.applyParts` then performs the third.

### Trust

Instantiating a PTF document runs the code in its layers. Its JavaScript parts are evaluated, and its SFCs' scripts
are executed. Accepting a PTF document therefore requires the same trust as loading an SFC or script from its source.
Unless `overrideLayers` is set, a document can't replace a layer the receiver already has, but it can define new ones.

## Embedding PTF: the tldraw clipboard

PTF documents nest, and other kinds of part can travel alongside them. The tldraw integration
(`demo/tldraw/js/tldraw-clipboard.js`) replaces tldraw's own clipboard format, which is opaque and compressed, with a
plain-text PTF document:

| Kind | Filename | Body |
|---|---|---|
| `tldraw` | `tldraw-content` | tldraw's own JSON for all copied shapes, native ones included, with their ids and positions |
| `component` | A shape id | A nested `multipart/mixed` entity holding that shape's component parts |

On paste, the clipboard text is checked with `fluid.ptf.isPTF`:

* **Plain text.** If it isn't a PTF document, tldraw handles the paste as normal.
* **Copied shapes.** A document with a `tldraw` part is pasted through tldraw, so that ids are remapped and positions
  resolved as for a native paste. Each recreated Infusion shape is then rebuilt from its nested component parts.
* **A bare component.** A document as produced by `fluid.ptf.componentToPTF`, for example one copied out of a text
  editor, becomes a single fresh shape.

Cut and undo use the same mechanism: before a shape is deleted, its component's parts are captured, so that undoing
the cut restores the component with the state it had.

Because the clipboard holds readable text, a copied component can be pasted into a text editor, modified there (for
example by changing its template or its count) and pasted back onto the canvas as a modified component.

## JavaScript API

### Producing documents

* `fluid.ptf.componentToPTF(component)` returns `{String}`, the complete PTF document for `component` and its
  subcomponents.
* `fluid.ptf.componentToParts(component)` returns `{PTFPart[]}`, the parts without encoding them. This is useful for
  embedding a component's parts in a larger document.
* `fluid.ptf.encode(parts, [preamble])` returns `{String}`, encoding any parts as a PTF document. A part with `parts`
  in place of `body` is encoded as a nested multipart entity.
* `fluid.layerMimeType(layerName)` returns `{String}`, the MIME type a layer will be transmitted in.

A `PTFPart` is `{kind, contentType, filename, body}`, or `{kind, filename, parts}` for a nested document. Decoded parts
also carry `headers`, all of their headers with lower-cased names.

### Reading documents

* `fluid.ptf.isPTF(text)` returns `{Boolean}`: `true` if `text` begins with `MIME-Version:` and declares a multipart
  boundary. It is cheap enough to sniff every paste.
* `fluid.ptf.decode(text)` returns `{PTFPart[]|Unavailable}`. It decodes nested multipart parts recursively, and
  returns an unavailable value if `text` is not a PTF document.
* `fluid.ptf.instantiate(text, [options])` returns `{Promise<{that, unresolved}>}` and runs
  [reconstruction](#reconstruction). Its options are:
    * `options.potentia` - Extra potentia merged over the root's, e.g. `{container}`.
    * `options.overrideLayers` - If `true`, transmitted layers replace existing definitions.
* `fluid.ptf.instantiateParts(parts, [options])` does the same as `instantiate`, for parts that have already been decoded.
* `fluid.ptf.constructParts(parts, [options])` returns `{Component}`. It registers the layers and constructs the root
  component without waiting for it to become available, and applies none of the further parts. It throws if there
  is no root `potentia` part.
* `fluid.ptf.applyParts(that, parts)` returns `{Promise<String[]>}`. It applies the subcomponent `potentia` and `live`
  parts to an existing component, and resolves with the filenames of any it could not place.
* `fluid.ptf.registerLayerParts(parts, [overrideLayers])` registers just the layer parts.
* `fluid.loadSFCText(layerName, text)` registers an SFC from text rather than a URL. Reconstruction uses it for SFC parts.
