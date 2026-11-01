---
title: Fluid View
category: Infusion
type: infusion-docs
---

This page documents how Fluid Infusion 6 components render markup: the template binding syntax, the
Single File Component (SFC) format, the machinery of views, and rendering pages under node. It builds on the
[Fluid Integration Language](/docs/fluid-integration-language) (layers, references, `$compute`, `$method`, `$effect`,
`$component`) and on [`fluid.cell`](/docs/fluid-signals) (signals, effects, source tracking).

The raw markdown underlying these docs is available on [GitHub](https://raw.githubusercontent.com/amb26/ponder/refs/heads/main/content/docs/fluid-view.md),
suitable for direct ingestion by your friendly local neighbourhood intelligence.

## A first component

A Single File Component is a `.vue` file holding a `<script>` defining one layer, a `<template>` holding its markup,
and optionally `<style>`. Here is a complete counter, in a file named `my-counter.vue`:

```html
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
```

* `@{count}` in text or an attribute value binds live to the component's `count` member.
* `@onclick="{self}.increment()"` invokes the component's `increment` method when the button is clicked.
* `self.count++` writes through the component proxy into its live layer. The text node updates, and nothing else
  in the DOM is touched.

To use it, declare the module and import the SFC in a host page, and mark an element with the layers to instantiate
on it:

```html
<head>
    <fluid-module id="infusion-6" src="../../"></fluid-module>
    <!-- Infusion core script tags here -->
    <fluid-module id="myApp" src="./"></fluid-module>
    <fluid-import src="%myApp/sfc/my-counter.vue"></fluid-import>
</head>
<body>
    <div fluid-layers="my.counter"></div>
</body>
```

* `<fluid-module id src>` registers a module root, referred to in paths as `%id`.
* `<fluid-import src [layer]>` loads an SFC on demand. The layer name defaults to the file name with `-` replaced by
  `.`, so `my-counter.vue` must define `my.counter`.
* `fluid-layers="layerA layerB"` on any element instantiates a component with those layers, rendering into that
  element. The element is watched live: elements added to the document later are booted too.

A component can equally be created from JavaScript with `my.counter({container: element})`, which renders into
`element`.

### What the SFC loader does

When the SFC is loaded, its script is patched before execution:

* `$layers` defaults to `["fluid.sfcLayer", "fluid.component"]`, and `fluid.sfcLayer` is otherwise placed first, where it
  is weakest, amongst any `$layers` written.
* A `view` subcomponent is added, with layer `fluid.sfcTemplateViewComponent`, whose `template` refers to the SFC's
  `<template>` block as `{sfcLayer: "my.counter"}` (see [Views](#views)). Since this is an ordinary member of the view,
  a layer derived from the SFC's layer may replace the template by supplying its own, e.g.
  `view: {$component: {template: "<div>...</div>"}}`, whilst keeping the rest of the SFC's definition.
* Each `<style>` and further `<script>` block is injected into the document. `<script src="..." data-fl-scope="global">`
  loads a classic global script. `src` paths may use `%module` prefixes.

Editing the file and reloading it, for example through the Fluid editor, updates every live instance in place.

## Template binding syntax

Templates are plain HTML, with bindings introduced by `@`. References are resolved in the context of the component
that owns the view, exactly as in configuration.

### Text and attribute interpolation: `@{...}`

| Form | Meaning |
|---|---|
| `@{count}` | Shorthand for `{self}.count` |
| `@{todo.text}` | Shorthand for `{self}.todo.text` |
| `@{{todoList}.todos.length}` | A full [context reference](/docs/fluid-integration-language#references) |
| `@{my.urlize({self}.tag)}` | A call to a global function, whose arguments are references or literals as for a compact [`$compute`](/docs/fluid-integration-language#compute) |
| `@@{count}` | The literal text `@{count}`, not interpolated |

A function call is recomputed whenever any of its arguments changes, as for a `$compute`:

```html
<a href="/tags/@{my.urlize({self}.tag)}/">@{tag}</a>
```

Interpolations can be mixed with literal text, as in `title="Busy: @{busy}"`, which is rendered as a string. Every
binding is a fine-grained effect bound to its own text node or attribute. A change updates exactly that node, with no
re-rendering of the surrounding tree.

If a referenced value is unavailable, for example still loading or an error, a text binding renders the error in
place, and an attribute binding removes the attribute.

### Attribute and property binding

An attribute whose whole value is a single `@{...}` binds the **raw value**, not its string form. This allows
booleans and live DOM state to be bound directly:

```html
<button disabled="@{busy}" aria-pressed="@{busy}">Go</button>
<input value="@{state.prompt}"/>
<input type="checkbox" checked="@{done}"/>
<textarea value="@{notes}"></textarea>
<select value="@{choice}">
    <option value="a">A</option>
    <option value="b">B</option>
</select>
```

How a bound value is applied:

| Bound value | Result |
|---|---|
| `false`, `null`, `undefined`, unavailable | Attribute removed. Exception: `aria-*` attributes render `false` as `"false"` |
| `true` on a boolean attribute | Attribute present with empty value, e.g. `disabled=""` |
| `"false"` on a boolean attribute | Treated as `false` |
| Anything else | Attribute set to `String(value)` |

The boolean attributes are `disabled`, `checked`, `selected`, `readonly`, `required`, `hidden`, `multiple`, `open`,
`inert`, `autofocus`, `novalidate` and `indeterminate`.

**Live state.** Some attributes only hold a default, while the element's real state is held in a DOM property that the
user can change. For these attributes the binding writes **both** the attribute and the property, and listens for the
user's changes:

| Attribute | Property | Event listened to |
|---|---|---|
| `value` | `value` | `input` |
| `checked` | `checked` | `change` |
| `selected` | `selected` | `change` |
| `open` | `open` | `toggle` |
| `indeterminate` | `indeterminate` | `change` |

* **Write-back.** When the user changes the element, the new value is written back to the bound model site, so
  `<input value="@{text}"/>` is a two-way binding with no handler code. Writing into a
  [`$reactiveRoot`](/docs/fluid-integration-language#reactiveroot) path such as `@{state.prompt}` updates that root
  immutably.
* **Read-only sources.** If the site holds a computed value (`$compute`), it is not written. The attribute is
  re-materialised from the element's state, so the page still serialises faithfully.
* **Special elements.** `<textarea value="@{...}">` is materialised as the textarea's content. `<select value="@{...}">`
  is materialised as `selected` on the matching `<option>`.
* **No redundant writes.** A property is written only if it differs, so binding `value` doesn't disturb the caret in a
  focused input.

Because both the attribute and the property are kept in step, the live DOM always serialises to markup that reflects
what the user sees.

### Conditional classes: `@class`

```html
<span class="todo" @class="completed:@{todo.completed}, is-info:!@{todo.completed}">
```

`@class` takes a comma-separated list of `className:@{reference}` pairs. Each class is present while its reference is
truthy and available. A `!` before the reference negates it in place: `is-info:!@{todo.completed}` applies `is-info`
while the item is *not* completed. Classes in a static `class` attribute are kept.

### Events: `@on<event>`

```html
<button @onclick="{self}.increment()">+1</button>
<input @onkeyup="my.app.keyUp({0}, {todoList}.todos)"/>
<button @onclick.stop="{self}.remove()">x</button>
<button @onclick="{self}.open = !{self}.open">Toggle</button>
<button @onclick="{self}.mode = edit">Edit</button>
```

* **Invocation.** The value is a compact function call in the syntax of
  [`$method`](/docs/fluid-integration-language#method). The function is either a method reference such as
  `{self}.increment()` or a global function name. Within the arguments, `{0}` is the DOM event.
* **Assignment.** `target = source` writes to a component site. `source` is a reference, read at the time of the
  event, or a literal (`edit`, `3`, `true`). A `!` before the source negates it in place, so
  `{self}.open = !{self}.open` is a toggle.
* **Modifiers.** These are dot suffixes on the event name, following Vue:
    * `.stop` and `.prevent` call `stopPropagation()` and `preventDefault()`.
    * `.self` only fires when the event's target is the element itself.
    * `.ctrl`, `.shift`, `.alt` and `.meta` require that key to be held. `.exact` additionally forbids any other.
    * `.left`, `.middle` and `.right` filter mouse buttons. `click.right` listens to `contextmenu`.
    * For keyboard events, any other modifier names a key, e.g. `@onkeyup.enter`.
* **After the handler.** Every handler is run with the update sources `"dom"` and `"self"` of its component (see
  [Source tracking](#source-tracking-and-the-dom)), and is followed by `fluid.cell.stabilize()`.

### Subcomponents: `@id`

```html
<div @id="todoItems" class="section"></div>
```

`@id="member"` marks the element as the container for the subcomponent at `member` of the owning component. Its
contents are taken as the subcomponent's template unless the subcomponent supplies its own. If `member` holds a
component list (a [`$component` with `$for`](/docs/fluid-integration-language#for)), each list member is rendered in
sequence inside the element.

```js
fluid.def("my.todoList", {
    todos: {$reactiveRoot: []},
    todoItems: {
        $component: {
            $layers: "my.todoItem",
            $for: {source: "{todoList}.todos", valueAs: "todo", keyAs: "index"}
        }
    }
});
```

Each `my.todoItem` then renders its own SFC template, in which `@{todo.text}` refers to its element of the list.
Adding to or removing from `todos` creates or destroys exactly the corresponding item views.

A subcomponent with [`$if`](/docs/fluid-integration-language#if) renders into its `@id` element only while its
condition is true. A subcomponent [removed](/docs/fluid-integration-language#removing-a-subcomponent) by a stronger
layer holding `null` at its member renders nothing, and its `@id` element is omitted from the document altogether until
the member is restored.

The template of a subcomponent with `elideParent: false` may have several top-level nodes. All of them are rendered
in sequence inside the `@id` element, after those of any preceding list member.

#### Fragment slots: `<fluid-fragment>`

Where the subcomponent's nodes must appear without any wrapping element, for example a list of `<link>` elements
inside `<head>`, mark its place with a `<fluid-fragment>` element. The slot renders no element of its own, and the
subcomponent's nodes, or those of each member of its list, are rendered in its place:

```html
<head>
    <title>@{title}</title>
    <fluid-fragment @id="stylesheetLinks"></fluid-fragment>
</head>
```

```js
stylesheetLinks: {
    $component: {
        $layers: "fluid.component",
        $for: {source: "{page}.stylesheets", valueAs: "sheet"},
        view: {
            $component: {
                $layers: "fluid.templateViewComponent",
                template: `<link rel="stylesheet" href="@{sheet.href}">`
            }
        }
    }
}
```

#### Separators between list members

A list member can render a separator before itself using its position, bound by
[`positionAs`](/docs/fluid-integration-language#for). This works the same way whether the source is an array or a
keyed collection:

```js
tagLinks: {   // Rendered into <p @id="tagLinks"></p> as "Alpha, Beta, Gamma"
    $component: {
        $layers: "fluid.component",
        $for: {source: "{post}.tags", valueAs: "tag", positionAs: "position"},
        view: {
            $component: {
                $layers: "fluid.templateViewComponent",
                elideParent: false,
                template: `<span @if="!position.first" class="separator">, </span><a href="@{tag.url}">@{tag.name}</a>`
            }
        }
    }
}
```

### Conditional elements: `@if` and `@else`

```html
<h2 @if="subtitle" class="sub">@{subtitle}</h2>
<p @else class="nosub">No subtitle</p>
<hr @if="!@{compact}"/>
```

An element bearing `@if` is rendered only while its condition is truthy. The condition is any expression which
`@{...}` accepts (a bare path, a context reference or a function call), optionally enclosed in `@{` and `}`, and
optionally preceded by `!` to negate it. As for [`$if`](/docs/fluid-integration-language#if), an unavailable value
counts as false. An element bearing `@else` is rendered while the condition of the `@if` element preceding it, separated
from it by nothing but whitespace, is false. An `@else` without such a predecessor is an error.

References within a conditional element resolve against the component whose template it is, as for the rest of the
template. While its condition holds, the element is rendered by an anonymous child component, so its bindings and any
subcomponents designated by `@id` within it exist only while it is shown. The elements around it are undisturbed as it
comes and goes.

Unlike a subcomponent with `$if`, whose element in the template remains while the subcomponent renders nothing, an
element bearing `@if` is removed from the document entirely.

## Views

A component *has* a view rather than *being* one. Everything to do with rendering (container, template, virtual tree
and the effects that patch the DOM) lives in a subcomponent at the member `view`. The component itself holds only model
state and behaviour, and bears no view layers in its own `$layers`. An SFC adds the view automatically, but it can
also be written out:

```js
fluid.def("my.greeting", {
    $layers: "fluid.component",
    name: "World",
    view: {
        $component: {
            $layers: "fluid.templateViewComponent",
            template: "<p>Hello, @{name}!</p>"
        }
    }
});

my.greeting({container: document.getElementById("greeting")});
```

The two components refer to each other across this boundary:

* **From the template.** References in a view's template resolve against the view's parent, the owning component, so
  `@{name}` means the component's `name`, not the view's.
* **From the view's configuration.** Configuration *on* the view, such as a `$compute` producing its `templateTree`,
  reaches the owning component as `{$parent}`.
* **From the component.** The component reaches its view as `{self}.view`, e.g. `{self}.view.renderedContainer` for
  the rendered element. From JavaScript this is `that.view.container`.

All view configuration therefore goes under `view.$component`, including settings such as `elideParent`:

```js
fluid.def("my.footer", {
    view: {
        $component: {
            elideParent: false
        }
    }
});
```

In an SFC this record needs no `$layers`, since the loader supplies them. A view inherited from another layer
accumulates the configuration, by the usual [merging rules](/docs/fluid-integration-language#merging-and-precedence).

Because the view is a subcomponent, the same component can be rendered differently by giving its `view` other layers,
and it can exist with no view at all, or share the view of another component by having it injected across:

```js
fluid.def("my.shared.component", {
    view: "{other.component}.view"
});
```

A component sharing another's view renders nothing of its own: its template is not rendered, so the views of any of
its subcomponents which would have rendered into that template have no container and render nothing either. All of
its other members continue to be computed as usual. This is a way of mixing in the behaviour of a component which has
a view, without its display.

### View layers

| Layer | Template source |
|---|---|
| `fluid.viewComponent` | Base layer. Supplies `vTree`, a virtual DOM tree, directly or computed from `templateTree` |
| `fluid.templateViewComponent` | `template` - an HTML string, or `{sfcLayer: layerName}` for the `<template>` block of that SFC |
| `fluid.sfcTemplateViewComponent` | Tag layer which the loader adds to the view of an SFC with a `<template>` block, when it sets the view's `template` as above |
| `fluid.selfTemplateViewComponent` | The markup its parent placed inside its `@id` element |
| `fluid.partialViewComponent` | Composites the [partial templates](#partial-templates) of the component's layers into its template |
| `fluid.outputDocumentView` | Mixed in alongside a template layer: renders into a whole document of its own at `documentLocation` - see [Output documents](#output-documents-and-server-side-rendering) |

Members of `fluid.viewComponent`:

* `container` - The DOM element rendered into. A `container` passed to a creator function is forwarded here.
* `templateTree` - The parsed template.
* `vTree` - The activated virtual tree, with all bindings resolved.
* `elideParent` - Defaults to `true`, meaning the template's root element is merged with the container rather than
  nested inside it. Set it to `false` to render the root element inside the container.
* `verbatim` - Defaults to `false`. If `true`, a template supplied as markup is rendered [verbatim](#verbatim-markup-and-islands).
* `renderedContainer` - A signal holding the element once it has been rendered.
* `renderView` - The effect that patches `vTree` into `container`.

Rendering is a reconciliation of the virtual tree against the existing DOM. Elements are reused wherever they match, so
DOM state such as focus, selection and scroll position survives updates and template edits.

* **Keyed nodes.** The markup of each member of a [`$for`](/docs/fluid-integration-language#for) list is keyed by its
  member, as is an element bearing `@id` by its member and one bearing `@if` by its block. A keyed node is reused only
  for the same key, and is moved, never rewritten, when the list is reordered or grows. This matters wherever a node's
  identity is the resource: in `<head>`, a `<link>` whose `href` is rewritten fetches its stylesheet again, and a
  `<script>` runs only when it is first connected. A list keyed by record, e.g. `{main: {...}, print: {...}}`, keeps its
  members' nodes however entries are added; a list over an array is keyed by index, so an insertion shifts the keys of
  the members after it. Other nodes are matched by position.
* **Nodes the rendering doesn't own are left alone.** A rendering owns the nodes it creates. Any other node, e.g. one
  added to `<head>` by a widget loader or a browser extension, a node injected for a Single File Component, or a
  script booting the framework, is neither reused nor removed, and keeps its place. A node created by the rendering is
  placed immediately after the rendering's node that precedes it, so nodes appended by others stay after the
  rendering's own. In particular, the `<style>` of an SFC injected into `<head>` follows the document's own stylesheets.
* **Rendering over existing markup.** On the first rendering into an element which already has children, e.g. a page
  written by a static build, the children are claimed by position, since they are expected to have been rendered from
  the same template. Thereafter they are owned, and keyed as above.

The framework writes no ids or other markers into the rendered markup. Which component rendered which node is
recovered by rendering the same tree again over it.

## Advanced features

### Generating a vTree by hand

A view can compute its own `templateTree` rather than parsing a template. This is useful where the structure depends
on data in ways the template syntax can't express. A vTree node is `{tag, attrs, children}` or `{text}`. Its
attributes may use all of the binding syntax above, and are processed exactly as if they came from a template.

`fluid.UISelect`, from the todo list demo, renders a `<select>` from parallel arrays of values and names:

```js
fluid.def("fluid.UISelect", {
    $layers: "fluid.component",
    optionValues: {$reactiveRoot: []},
    optionNames: {$reactiveRoot: []},
    updateSelection: "$method:fluid.UISelect.update({self}, {0}:event)",
    view: {
        $component: {
            $layers: "fluid.UISelectView"
        }
    }
});

fluid.UISelect.update = (self, e) => self.selection = e.target.value;

fluid.def("fluid.UISelectView", {
    $layers: "fluid.viewComponent",
    elideParent: false,
    templateTree: {
        $compute: {
            func: (selection, optionValues, optionNames) => ({
                tag: "select",
                attrs: {"@onchange": "{self}.updateSelection({0})"},
                children: optionValues.map((value, i) => ({
                    tag: "option",
                    attrs: {value, ...(selection === value && {selected: "selected"})},
                    children: [{text: optionNames[i] ?? value}]
                }))
            }),
            args: ["{$parent}.selection", "{$parent}.optionValues", "{$parent}.optionNames"]
        }
    }
});
```

The `$compute` reruns whenever the selection or options change, and reconciliation updates only the nodes that
differ. With [live-state binding](#attribute-and-property-binding), the same widget can now also be written as a
template that binds `<select value="@{selection}">` and needs no change handler.

A heavier variant computes the template as an **HTML string**. The editor's `fluid.substrateTree` (in
`src/framework/edit/js/substrateTree.js`) renders a large recursive tree this way:

```js
view: {
    $component: {
        $layers: "fluid.templateViewComponent",
        template: "$compute:fluid.substrateTree.renderTemplate({$parent}, {$parent}.rootEntries, {$parent}.idToState)"
    }
}
```

Here `renderTemplate` builds the markup imperatively, including `@on...` attributes on its root element so that events
are delegated to a few handlers. The string is reparsed on every change, but reconciliation still keeps the DOM
updates minimal. Choose this approach when building the markup recursively is simpler than composing subcomponents.

### Partial templates

A layer may contribute a **partial template**, a fragment of markup composited into the template of any component
bearing it, without replacing that template. This lets independent layers each add to, or take away from, a shared
page structure such as a header. The component's view must bear `fluid.partialViewComponent` alongside its template
layer:

```js
fluid.def("my.header", {
    $layers: "fluid.component",
    view: {
        $component: {
            $layers: ["fluid.templateViewComponent", "fluid.partialViewComponent"],
            template: `<header><h1 class="title">@{title}</h1><nav @id="navbar"></nav><p class="strapline">...</p></header>`
        }
    }
});

fluid.def("my.header.post", {
    view: {
        $component: {
            relativeContainer: "after: h1.title",
            partialTemplate: `<span class="date">@{date}</span>`
        }
    }
});

fluid.def("my.header.bare", {
    view: {
        $component: {
            relativeContainer: "remove: .strapline"
        }
    }
});
```

A layer contributes a partial if the view record in its own definition, `view.$component`, holds `relativeContainer`.
Its markup is `partialTemplate` in the same record or, for a Single File Component, its `<template>` block.

* `relativeContainer` - A **cutpoint** of the form `"disposition: selector"`. The selector must match exactly one node
  of the template, by tag, `.class`, `#id`, or `@member` for the element bearing `@id="member"`, combined with descendant
  and `>` combinators. The disposition is one of:
    * `before` or `after` - The partial's nodes are placed before or after the matched node.
    * `first` or `last` - They are placed at the start or end of the matched node's children.
    * `replace` - They replace the matched node.
    * `remove` - The matched node is removed, and the partial needs no markup.
* `@relative` - A top-level node of a partial bearing this attribute is placed at its own cutpoint instead of its
  layer's, e.g. `<div @relative="first: header">`, so one partial can contribute to several places.
* `partialTemplateLayers` - A member of the merged view through which any layer may redirect the partial of another,
  e.g. `partialTemplateLayers: {"my.header.post": {relativeContainer: "before: @navbar"}}`.

Partials are composited in order of their layers' precedence, weakest first, and those placed at the same cutpoint
appear in that order in the document. The selectors of later partials are matched against the template as composited
so far. A malformed cutpoint, or a selector matching no node or several, makes the view's template unavailable with an
error naming the layer.

### Verbatim markup and islands

A view with `verbatim: true` renders markup produced elsewhere, such as HTML from a content pipeline, without treating
it as a template:

```js
fluid.def("my.article", {
    $layers: "fluid.component",
    html: "<p>Rendered from <em>Markdown</em></p><div fluid-layers=\"my.figure\" data-src=\"a.png\"></div>",
    view: {
        $component: {
            $layers: "fluid.templateViewComponent",
            verbatim: true,
            template: "{$parent}.html"
        }
    }
});
```

* The markup is not scanned for bindings, so text such as `@{count}` is rendered as it stands.
* Whitespace is kept, and the markup may have any number of top-level nodes, all of which are rendered within the
  container.
* An element bearing `fluid-layers` is an **island**: it is rendered by a child component bearing those layers. The
  child's member `dataset` holds the element's `data-` attributes, named as for the DOM's `dataset`, so
  `data-image-caption` is read as `@{dataset.imageCaption}`. The child is named by the element's `fluid-id` attribute,
  or otherwise receives a generated name, and the element keeps its attributes.

When the markup changes, it is reconciled with the DOM as for any template. An island whose element changes layers
is rebuilt with its new layers, and one whose element disappears is destroyed.

### Wrapping an external widget with `$bindable`

> `$bindable` is **experimental and unstable**. See [its definition](/docs/fluid-integration-language#bindable).

Some widgets, such as code editors, maps or charts, own a complex DOM and have their own lifecycle: they must be
constructed once, on a real element, and kept alive while the component's configuration varies. `$bindable`
constructs such an object as soon as its arguments are available. By default it rebuilds the object whenever an
argument changes, but with `onceOnly: true` it constructs it exactly once for the lifetime of the record.

`fluid.codemirror` (`src/framework/edit/sfc/fluid-codemirror.vue`) binds a CodeMirror editor to the textarea that
its own view renders:

```js
fluid.def("fluid.codemirror", {
    text: "",
    view: {
        $component: {
            elideParent: false,
            template: "<textarea>@{text}</textarea>"
        }
    },
    instance: {
        $bindable: {
            bind: "fluid.codemirror.construct({self}, {self}.view.renderedContainer, {global}.CodeMirror)",
            unbind: "fluid.codemirror.destroy({boundValue})",
            // Rebuilding the editor would lose its undo history, selection and scroll position
            onceOnly: true
        }
    },
    readEffect: "$effect:fluid.codemirror.updateText({self}.instance, {self}.text)"
});

fluid.codemirror.construct = function (self, container, CodeMirror) {
    const instance = CodeMirror.fromTextArea(container.firstElementChild, {lineNumbers: true});
    instance.on("change", () => self.text = instance.getValue());   // Widget -> model
    fluid.disableRendering(self);   // CodeMirror now owns this markup
    return instance;
};
```

The pattern:

1. The view renders a plain placeholder, here a `<textarea>`.
2. `bind` waits on `{self}.view.renderedContainer`, so it runs only once the markup exists in the DOM, and also
   waits for the global `CodeMirror` script to load.
3. `onceOnly: true` keeps the widget alive however its arguments change. Without it, any change in an argument
   would unbind the widget and build a new one.
4. The constructor calls `fluid.disableRendering(self)`, so that later model changes don't reconcile away the
   widget's DOM.
5. An `$effect` pushes model changes into the widget (model to widget), and a listener on the widget writes its
   changes back to the model (widget to model).
6. The `unbind` record tears the widget down when the record is disposed, for example when the component is
   destroyed. Without `onceOnly`, it is also called before each rebind, and whenever an argument becomes unavailable.

Step 5 creates a cycle: the widget writes to the model, which runs the effect, which writes the same text back into
the widget. This can reset its cursor or undo history. The next section explains how to break it.

### Source tracking and the DOM

Every update to a cell can carry a **source**, which identifies the agent in the world that caused it. The source
travels with the update through every computed value that depends on it, and through any effect it causes to write
further cells. An edge marked `excludeSource: "s"` skips notification for updates from source `s`, and one marked
`includeSource: "s"` is notified only of them (see
[`fluid.cell.effect`](/docs/fluid-signals#fluidcelleffectfn-staticsources-props)).

The view layer tags all user activity, that is

* every `@on...` event handler, and
* every live-state write-back from `value`, `checked` and the like,

with two sources: the string `"dom"`, and the **self source** of the component whose template bound the handler or
element. Each runs inside `fluid.cell.withAmbientSource(...)`, so any cell they set is updated with both.

#### Excluding `"self"`: widgets that should not hear their own changes

A component wrapping an external widget has a cycle: the widget reports the user's edit to the model, and the model
change runs the effect that writes the same text back into the widget. This can reset its cursor or undo history, or,
if the change takes time to arrive, overwrite text the user has typed since. Annotate the effect that writes into the
widget with `excludeSource: "self"`:

```js
readEffect: {
    $effect: {
        func: "fluid.codemirror.readText",
        args: ["{self}.text", "{self}.instance"],
        excludeSource: "self"
    }
}
```

The effect is then not notified of any change originated by its own component, nor of any change which that one causes
in turn. Every other effect is still notified, including the same effect in another instance of the same widget, for
example a second editor showing the same text. A change from anywhere else, such as loading a file or undoing in
another pane, still reaches the editor.

`"self"` names a source which is distinct for each component instance (it is the component's shadow). It can't be
written as a string in configuration or confused with another component's. The view tags writes made by the
component's own template with it automatically. A third-party widget's changes, which the view doesn't see, should be
written back by an effect declaring `source: "self"`. Here the widget's listener only records what the widget reports,
and the effect writes it back to the model:

```js
validText: null,              // set by the widget's listener: self.validText = text
writeEffect: {
    $effect: {
        func: "fluid.codemirror.writeText",
        // The instance is an argument so that nothing is written before the widget is constructed
        args: ["{self}", "{fluid.editor}", "{self}.validText", "{self}.instance"],
        source: "self"
    }
}
```

Where a write can't be made from an effect, it can be wrapped instead, with the component's self source fetched by
`fluid.selfSource(self)`:

```js
instance.on("change", fluid.cell.withAmbientSource(fluid.selfSource(self), () => self.text = instance.getValue()));
```

`excludeSource: "self"` applies to the whole component, so two widgets within one component which show the same value
would not hear each other's changes. Give each such widget a component of its own.

At the level of raw cells, the same source can be supplied to an edge directly:

```js
const toWidget = fluid.cell.effect(text => widget.setText(text), [model], {excludeSource: fluid.selfSource(self)});
```

> In the Integration Language, `excludeSource` and `includeSource` are currently honoured on `$effect` records only.
> A `$compute` record does not yet forward them, so use an `$effect` (as above) for edges into external widgets.

Template bindings don't need the annotation. A binding such as `value="@{text}"` writes back to the model, and when
the model change returns, the binding compares the property with the new value and doesn't write it again. Source
tracking is needed where a widget can't make that comparison cheaply or without side effects.

#### `"dom"`: changes the user made

`"dom"` marks every change made by the user through any view. It is useful with `includeSource`, to act on the user's
own changes only. For example, an effect that records undo history, sets a dirty flag, or reports analytics:

```js
markDirty: {
    $effect: {
        func: self => self.dirty = true,
        args: ["{self}", "{self}.document"],
        includeSource: "dom"
    }
}
```

`excludeSource: "dom"` is almost always a mistake. It ignores changes made through *every* widget, not just one's own, so
a widget excluding it is not told when the user edits the same value elsewhere. Use `"self"` instead. To react only to
changes from some other agent, such as a server or a collaborator, have that agent tag its writes (e.g.
`cell.set(value, "remote")`), and select them with `includeSource`.

## Output documents and server-side rendering

The same component tree which renders live in the browser can render static pages under node, for example to build a
website, and those pages can later be made live again in the browser. Under node, Infusion renders into documents
implemented by [linkedom](https://github.com/WebReflection/linkedom), and is loaded with `require("infusion-6")`.

### `fluid.outputDocumentView`

A view bearing `fluid.outputDocumentView` alongside its template layer renders into a whole document of its own. The
root element of its template, normally `<html>`, is rendered onto the document's root element:

```js
fluid.def("my.page", {
    $layers: "fluid.component",
    view: {
        $component: {
            $layers: ["fluid.templateViewComponent", "fluid.outputDocumentView"],
            documentLocation: "$compute:my.outputPath({page}.entry.path)",
            baseURL: "{site}.baseURL",
            template: `<html><head><title>@{entry.title}</title></head><body><main @id="content"></main></body></html>`
        }
    }
});

fluid.def("my.site", {
    $layers: "fluid.component",
    baseURL: "https://example.org/blog",
    entries: {$reactiveRoot: []},
    pages: {
        $component: {
            $layers: "my.page",
            $for: {source: "{site}.entries", valueAs: "entry"}
        }
    }
});
```

* `documentLocation` - Where the document is written, e.g. `"post/first/index.html"`. A relative location resolves
  against the working directory.
* `baseURL` - Optional. The base URL of the site to which the page belongs. The page's root element then records the
  relative URL of the site's root in its `fluid-site-root` attribute, e.g. `"../../"`, so that in the browser the page
  recognises its own location wherever the site is served from, even from local files.

Under node, the view creates a fresh **output document** while `documentLocation` is available, and releases it when
the location becomes unavailable or the view is destroyed. A changed location creates a fresh document. Every output
document is listed in the cell `fluid.outputDocuments`, as records `{dokkument, location, url}`, in order of creation.
Nothing executes in an output document. The Single File Components of the layers of the component and its view are
recorded in it as they would be in a live page: their styles as `<style>` elements, and their scripts as inert
`<script type="text/x-fluid-layer">` elements, which a browser does not run.

In the browser, which can only see its own document, the same view renders into the current document if
`documentLocation` designates it, and otherwise has no container and renders nothing. The locations are compared by
their path relative to the site's root, using `baseURL` and any `fluid-site-root` attribute recorded in the page. So a
site's whole component tree can be booted in each of its pages, and only the page being viewed renders.

### Writing documents

These functions are defined in `src/framework/server/server-support.js`:

* `fluid.writeOutputDocumentsWhenSettled([filenameFor], [prepare])` - Waits until the reactive graph has settled, and
  then writes every output document which is ready.
    * `filenameFor` receives a record of `fluid.outputDocuments` and returns the file to write. By default this is the
      file at its location.
    * `prepare` receives each record just before its document is serialised, e.g. to strip material not wanted in a
      static build.
    * Returns a promise for `{written, unchanged, unready}`, arrays of the records in each state. A file which already
      holds exactly the document's markup is not rewritten, so a rebuild after an edit writes only the pages which
      changed. A document is unready while any injection into it is in progress, any script is loading or any
      component which may render into it is unavailable. Each unready record bears a `readiness` member giving the
      reason.
* `fluid.writeDocumentsWhenSettled(records, [prepare])` - As above, for an explicit list of `{dokkument, filename}`
  records.
* `fluid.writeDocumentWhenSettled(dokkument, filename)` - Writes a single document, rejecting with the reason it is
  unready if it doesn't become ready.

A single host page, whose elements bear `fluid-layers` as in the browser, can be rendered from the command line:

```
node src/framework/server/hydrate.js page.html [-o out.html]
```

This boots the page as a browser would, waits for the graph to settle, and writes the rendered page, by default to
`page-hydrated.html`. If the graph settles with the page still unready, it exits with an error listing the pending
effects.

### Scripts

A document booted under node evaluates its JavaScript scripts as a browser would, except for Infusion's own scripts,
which node already has, inert records of injections, and scripts marked as meant for the browser alone.
`fluid.classifyScriptNode(node)` reports the role of a script element, so that a `prepare` function can
decide which to keep:

| Role | Script |
|---|---|
| `"framework"` | Boots Infusion itself, and bears `fluid-hydrated`, e.g. `fluid-hydrated="%infusion-6"` |
| `"injection"` | Injected for a Single File Component, or an inert record of one in an output document |
| `"client"` | Payload for the browser, such as a widget library, bearing `fluid-client`. It is never evaluated under node, whether in a booted document or one rendered from a template |
| `"page"` | Any other script |
