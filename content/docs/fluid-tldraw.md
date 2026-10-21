---
title: Fluid tldraw integration
category: Infusion
type: infusion-docs
---

This page documents how Fluid Infusion 6 components are hosted as widgets on a [tldraw](https://tldraw.dev) canvas:
how a layer marks itself as a widget, what the canvas tells a widget about where it is hosted, and how widgets are
nested and composed. It builds on [Fluid View](/docs/fluid-view) (views, and sharing them between components) and on
the [Fluid Integration Language](/docs/fluid-integration-language) (layers, references, `$linkage`, `$bindable`).

The layers marking and receiving hosting, `fluid.topLevelWidget` and `fluid.topLevelWidgetView`, are part of the
framework, in `FluidView.js`, and say nothing about tldraw. The tldraw host itself is in the
[tldraw demo](https://github.com/fluid-project/infusion-6/tree/main/demo/tldraw), mostly in
`demo/tldraw/js/tldraw-driver.js`.

The raw markdown underlying these docs is available on [GitHub](https://raw.githubusercontent.com/amb26/ponder/refs/heads/main/content/docs/fluid-tldraw.md),
suitable for direct ingestion by your friendly local neighbourhood intelligence.

## Top-level widgets

Nothing in a layer's own definition otherwise says whether it makes sense as a free-standing widget, so a layer which
does declares so by including `fluid.topLevelWidget` amongst its layers, directly or through a parent layer. The
canvas offers exactly these layers in its "New shape" menu.

```js
fluid.def("my.counter", {
    $layers: "fluid.topLevelWidget",
    preferredSize: {w: 260, h: 80},
    count: 0
});
```

`fluid.topLevelWidget` brings these members:

* `preferredSize` - `{w, h}`, the size at which the widget would like to be created, or `null` (the default) for no
  preference. The host reads this from the layer's [avatar](/docs/fluid-integration-language#fluidavatarlayername) before the
  widget exists, so a size inherited from a parent layer, or computed, is honoured.
* `hostBounds` - `{x, y, w, h}`, the bounds at which the widget is currently hosted, in page coordinates, or `null` if
  it is not hosted anywhere. This updates as the widget's shape is moved or resized. See
  [Nested widgets](#nested-widgets) for a widget which is not hosted in a shape of its own.
* A `view` bearing `fluid.topLevelWidgetView`, the attachment point for whatever a host supplies. Its own `hostBounds`
  is what the host reports for this widget's shape, and is `null` until a host reports something.

## Hosting on the canvas

The host is a single component, `fluid.demos.tldrawHost`, which bears `fluid.resolveRoot` so that any component can
reach it as `{tldrawHost}`:

* `editor` - The tldraw editor, the Infusion counterpart of React's `useEditor()`.
* `notes` - The sticky notes on the current page, as `[{id, x, y, text}]`. This is bridged once, for all widgets which
  need it, and updates only when a note changes, not when any other shape does.
* A [`$linkage`](/docs/fluid-integration-language#linkage) which broadcasts `fluid.tldrawViewComponent` onto every
  component bearing `fluid.topLevelWidgetView` - that is, onto the view of every top-level widget, wherever and
  whenever it is created, for as long as the host exists.

Each tldraw shape of type `infusion` hosts one widget. When the shape mounts, the widget is constructed from its layer
and given two things for its view: a `container`, the element inside the shape, and the `shapeId` of the shape.
`fluid.tldrawViewComponent` binds the view's `hostBounds` to that shape's page bounds through tldraw's own signals, so
that it updates only when that shape, or an ancestor of it, moves or is resized.

If the widget's view is [shared](/docs/fluid-view#views) from one of its subcomponents, e.g. by
`view: "{first}.view"`, the widget has no view of its own, so the container and shape id are directed at the view of
that subcomponent instead.

A widget therefore needs nothing beyond `fluid.topLevelWidget` to know where it is. For example, a widget showing the
text of the sticky note nearest to it:

```js
fluid.def("fluid.demos.closestNoteFinder", {
    $layers: "fluid.topLevelWidget",
    preferredSize: {w: 260, h: 200},
    closest: "$compute:fluid.demos.closestNoteFinder.findClosest({tldrawHost}.notes, {self}.hostBounds)",
    noteText: "{self}.closest.text",
    distance: "{self}.closest.distance"
});
```

`closest` is recomputed only when this widget's shape moves or some note changes.

## Nested widgets

A widget may hold another widget as a subcomponent, for example an umbrella composing two widgets. The nested widget
bears `fluid.topLevelWidget` too, but it isn't hosted in a shape of its own, so its host reports no bounds for it. Its
`hostBounds` are then those of the nearest enclosing top-level widget, however deeply it is nested. Nothing needs to be
wired for this, and `tldrawHost` is in scope everywhere, so a nested widget works exactly as it does on its own.

This holds whether the nested widget is visible or hidden.

* **Visible.** An umbrella with a template of its own may render each widget into an `@id` element:

    ```js
    fluid.def("my.umbrella", {
        $layers: "fluid.topLevelWidget",
        finder: {$component: {$layers: "fluid.demos.closestNoteFinder"}},
        generator: {$component: {$layers: "fluid.demos.imageGenerator"}},
        view: {
            $component: {
                $layers: "fluid.templateViewComponent",
                template: `<div><div @id="finder"></div><div @id="generator"></div></div>`
            }
        }
    });
    ```

* **Hidden.** A widget may mix in the behaviour of another without its display, by giving it the outer widget's own
  view, so that it [renders nothing](/docs/fluid-view#views) whilst all of its computation continues. Here the image
  generator *is* the widget, and the note finder only supplies its prompt:

    ```js
    fluid.def("fluid.demos.ai.closestNoteImageGenerator", {
        $layers: ["fluid.demos.imageGenerator", "fluid.topLevelWidget"],
        noteFinder: {
            $component: {
                $layers: "fluid.demos.closestNoteFinder",
                view: "{closestNoteImageGenerator}.view"
            }
        },
        state: {
            prompt: "{noteFinder}.noteText"
        }
    });
    ```

    The finder still measures its distance from the notes using the bounds of the outer widget's shape. The reference
    at `state.prompt` overrides a single member of the image generator's
    [reactive state](/docs/fluid-integration-language#reactiveroot).

Don't forward `hostBounds` to a nested widget yourself. Within its `$component` record, `{self}` is the nested widget,
not the one holding it, so `hostBounds: "{self}.hostBounds"` refers to its own value, and is
[unavailable](/docs/fluid-integration-language#references).

## Transmitting widgets

Widgets travel between canvases, and to and from text, as [PTF documents](/docs/fluid-ptf). The canvas's clipboard
carries them as described in [Embedding PTF](/docs/fluid-ptf#embedding-ptf-the-tldraw-clipboard).
