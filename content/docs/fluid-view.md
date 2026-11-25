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

Some examples on this page are live - complete and self-contained, they can be edited, and are run once they are
free of errors: what each logs appears in the console beneath it, and a view it defines, or a Single File Component,
is shown beside it. An example's code receives `console`, and `container`, the element beside it. The other examples
show syntax alone, e.g. a fragment of a layer record, and are read-only. Every example is checked by Infusion's
linter, down to the interiors of its references and directives as Infusion reads them - hover over a marked error to
see what is wrong, and, for an editable example, a fix.

## A first component

A Single File Component is a `.vue` file holding a `<script>` defining one layer, a `<template>` holding its markup,
and optionally `<style>`. Here is a complete counter, in a file named `my-counter.vue`:

```html live
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

These are not quite in the same format as the [Vue framework's SFC files](https://vuejs.org/guide/scaling-up/sfc.html) 
but the top-level file organisation and overall conception is the same, of keeping markup, behaviour and styling
related to the same component together in one place.

To use it, declare the module and import the SFC in a host page, and mark an element with the layers to instantiate
on it:

```html syntax
<head>
    <script src="../../src/framework/core/js/FluidBoot.js"></script>
    <fluid-module id="myApp" src="./" modules="fluid-modules.json"></fluid-module>
    <fluid-import src="%myApp/sfc/my-counter.vue"></fluid-import>
</head>
<body>
    <div fluid-layers="my.counter"></div>
</body>
```

* `FluidBoot.js` is the page's one reference to where Infusion lives. It declares Infusion as the module
  `infusion-6`, at the directory holding it, and loads Infusion's files in order as the page is parsed. 
* `<fluid-module id src>` registers a module root, referred to in paths as `%id`. Every page declares the module
  holding it. Its optional `modules` attribute names a module map, relative to the module's root - a JSON object
  locating each module the page reaches, e.g. `{"maplibre-gl": "vendor/maplibre-gl"}`, relative to the map. Every
  other reference a page or SFC makes is relative to the file making it, or through a module, e.g.
  `%maplibre-gl/dist/maplibre-gl-dev.js` or `%@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw-unminified.js`.
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
  loads a classic global script. `src` paths may use `%module` prefixes. Any other relative path is relative to the SFC
  itself, so that a family of SFCs and the files they refer to can be moved together, e.g. by copying them into another
  project. A relative path in a `<fluid-import>` of a host page is relative to the page.
* A script referred to by `src` from several SFCs, e.g. a library or a file of shared utilities and base layers, is
  executed once in each document. The first SFC to reach it injects it, and the others commit their own injections
  only once it has executed, so their scripts may rely on it.
* A `<script src="..." fluid-client>` block is payload for the browser alone, e.g. a widget library such as a map.
  When a page is rendered under node, it is written into the page but not evaluated, and components depending on it
  remain unavailable there.
* Top-level `<fluid-import src="..." [layer="..."]>` blocks import further SFCs, as in a host page. Their paths are
  relative to the importing SFC, so an SFC declares the SFCs it depends on, and a page need only import the root of the
  tree:

```html syntax
<fluid-import src="my-list-item.vue"></fluid-import>
<script>
fluid.def("my.list", {
    items: {
        $component: {
            $layers: "my.listItem",
            $for: {source: "{list}.records", valueAs: "record"}
        }
    }
});
</script>
```

* An optional `<symbols>` block holds SVG `<symbol>` elements which the SFC's template, or any other markup in the document,
  refers to with `<use href="#id">`. Its markup is injected verbatim as a `<defs>` element within a single hidden
  `<svg id="fl-symbols-host">`, shared by every SFC, at the start of the document's `<body>`:

```html syntax
<symbols>
    <symbol id="my-chevron" viewBox="0 0 16 16">
        <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor"/>
    </symbol>
</symbols>
<template>
    <button><svg width="14" height="14"><use href="#my-chevron"/></svg> More</button>
</template>
```

  Symbol ids are global to the document, so they should be prefixed to avoid clashes between SFCs. 
* A `<placeholder name type [encoding]>` block holds a placeholder for the data of the SFC's layer - see
  [Minimal pages and placeholder data](#minimal-pages-and-placeholder-data).

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

```html syntax
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

```html syntax
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
* **Read-only sources.** If the site holds a computed value (`$compute`), or lies anywhere within one, e.g. a form
  bound to a model computed from component state, it is not written. Writing it would detach the member from its inputs
  and leave the other bindings stale. The attribute is re-materialised from the element's state, so the page still
  serialises faithfully. Within a [`$reactiveRoot`](/docs/fluid-integration-language#reactiveroot), every path is
  writable.
* **Special elements.** `<textarea value="@{...}">` is materialised as the textarea's content. `<select value="@{...}">`
  is materialised as `selected` on the matching `<option>`.
* **No redundant writes.** A property is written only if it differs, so binding `value` doesn't disturb the caret in a
  focused input.

Because both the attribute and the property are kept in step, the live DOM always serialises to markup that reflects
what the user sees.

### Conditional classes: `@class`

```html live
<script>
fluid.def("my.todoTag", {
    todo: {text: "Write docs", completed: false},
    toggle: {
        $method: {
            func: self => self.todo = {...self.todo, completed: !self.todo.completed},
            args: "{self}"
        }
    }
});
</script>

<template>
    <div>
        <span class="todo" @class="completed:@{todo.completed}, is-info:!@{todo.completed}">@{todo.text}</span>
        <button @onclick="{self}.toggle()">Toggle</button>
    </div>
</template>

<style>
.todo.completed {
    text-decoration: line-through;
}

.todo.is-info {
    color: #0b5394;
}
</style>
```

`@class` takes a comma-separated list of `className:@{reference}` pairs. Each class is present while its reference is
truthy and available. A `!` before the reference negates it in place: `is-info:!@{todo.completed}` applies `is-info`
while the item is *not* completed. Classes in a static `class` attribute are kept.

### Events: `@on<event>`

```html live
<script>
fluid.def("my.eventDemo", {
    count: 0,
    open: false,
    mode: "view",
    lastKey: "",
    increment: "$method:my.eventDemo.increment({self})",
    keyUp: "$method:my.eventDemo.keyUp({self}, {0})",
    remove: "$method:my.eventDemo.remove({self})"
});
my.eventDemo.increment = self => self.count++;
my.eventDemo.keyUp = (self, event) => self.lastKey = event.key;
my.eventDemo.remove = self => self.count = 0;
</script>

<template>
    <div class="event-demo">
        <p>Count: @{count}, open: @{open}, mode: @{mode}, last key: @{lastKey}</p>
        <button @onclick="{self}.increment()">+1</button>
        <input @onkeyup="{self}.keyUp({0})" placeholder="Type here"/>
        <button @onclick.stop="{self}.remove()">x</button>
        <button @onclick="{self}.open = !{self}.open">Toggle</button>
        <button @onclick="{self}.mode = edit">Edit</button>
    </div>
</template>

<style>
.event-demo {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
}

.event-demo p {
    flex-basis: 100%;
    margin: 0;
}
</style>
```

* **Invocation.** The value is a compact function call in the syntax of
  [`$method`](/docs/fluid-integration-language#method). The function is either a method reference such as
  `{self}.increment()` or a global function name. Within the arguments, `{0}` is the DOM event.
* **Assignment.** `target = source` writes to a component site. A target's path may pass through subcomponents, e.g.
  `{self}.panel.open = true` writes `open` of the subcomponent `panel`. `source` is a reference, read at the time of the
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

```html syntax
<div @id="todoItems" class="section"></div>
```

`@id="member"` marks the element as the container for the subcomponent at `member` of the owning component. Its
contents are taken as the subcomponent's template unless the subcomponent supplies its own. If `member` holds a
component list (a [`$component` with `$for`](/docs/fluid-integration-language#for)), each list member is rendered in
sequence inside the element.

```js syntax
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
Adding to or removing from `todos` creates or destroys exactly the corresponding item views. Each `@id` slot keeps
one stable record of its container, so a parent's re-render which leaves a slot's markup unchanged does not rebuild the
child rendered into it.

A subcomponent with [`$if`](/docs/fluid-integration-language#if) renders into its `@id` element only while its
condition is true. A subcomponent [removed](/docs/fluid-integration-language#removing-a-subcomponent) by a stronger
layer holding `null` at its member renders nothing, and its `@id` element is omitted from the document altogether until
the member is restored.

The template of a subcomponent with `elideParent: false` may have several top-level nodes. All of them are rendered
in sequence inside the `@id` element, after those of any preceding list member.

#### Placing a component by its layers: `fluid-layers`

A component a layer doesn't declare can be placed in a template by its layers alone:

```html
<main>
    <div fluid-layers="energy.historyChart"></div>
    <div fluid-layers="energy.chartSvg energy.dataExtrapolated" fluid-id="projection"></div>
</main>
```

Each element bearing `fluid-layers` is rendered by a subcomponent of the owning component bearing those layers, as an
[island](#verbatim-markup-and-islands) of verbatim markup is. It is named by its `fluid-id`, or else by the last segment
of its first layer, so the two above are `historyChart` and `projection`. The name is stable however the template
changes, so that state saved for the subcomponent, e.g. in [PTF](/docs/fluid-ptf), finds it again.

- Two elements of one template may not share a name: give one a `fluid-id`.
- An element may not bear both `@id` and `fluid-layers`.
- Either mistake is logged as an error, and the element is rendered as plain markup.

Since no layer declares such a subcomponent, no layer can configure it or remove it with `null`. For that, declare it
as a member holding a `$component` record, and place it by `@id`.

#### Fragment slots: `<fluid-fragment>`

Where the subcomponent's nodes must appear without any wrapping element, for example a list of `<link>` elements
inside `<head>`, mark its place with a `<fluid-fragment>` element. The slot renders no element of its own, and the
subcomponent's nodes, or those of each member of its list, are rendered in its place:

```html syntax
<head>
    <title>@{title}</title>
    <fluid-fragment @id="stylesheetLinks"></fluid-fragment>
</head>
```

```js syntax
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

```js live
fluid.def("my.post", {
    $layers: "fluid.component",
    tags: [{name: "Alpha", url: "#alpha"}, {name: "Beta", url: "#beta"}, {name: "Gamma", url: "#gamma"}],
    view: {
        $component: {
            $layers: "fluid.templateViewComponent",
            template: `<div><p>Tagged: <span @id="tagLinks"></span></p></div>`
        }
    },
    tagLinks: {   // Rendered into its container as "Alpha, Beta, Gamma"
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
});
```

### Conditional elements: `@if` and `@else`

```html live
<script>
fluid.def("my.titled", {
    subtitle: "",
    compact: false
});
</script>

<template>
    <div>
        <input value="@{subtitle}" placeholder="Subtitle"/>
        <label><input type="checkbox" checked="@{compact}"/> Compact</label>
        <h2 @if="subtitle" class="sub">@{subtitle}</h2>
        <p @else class="nosub">No subtitle</p>
        <hr @if="!@{compact}"/>
    </div>
</template>
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

```js live
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

my.greeting({container});
```

The two components refer to each other across this boundary:

* **From the template.** References in a view's template resolve against the view's parent, the owning component, so
  `@{name}` means the component's `name`, not the view's.
* **From the view's configuration.** Configuration *on* the view, such as a `$compute` producing its `templateTree`,
  reaches the owning component as `{$parent}`.
* **From the component.** The component reaches its view as `{self}.view`, e.g. `{self}.view.renderedContainer` for
  the rendered element. From JavaScript this is `that.view.container`.

All view configuration therefore goes under `view.$component`, including settings such as `elideParent`:

```js syntax
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

```js syntax
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
  nested inside it. Set it to `false` to render the root element inside the container. The container's classes are
  the union of those written by the element bearing `@id` in the parent's template, those of the template's root, and
  any added by other code, e.g. a widget, in that order. Either template may re-render without the other, and each
  removes only classes which it wrote and no longer writes. Likewise, a template never removes an attribute which it
  did not write, such as one a widget sets on an element of the template. A class bound by the parent onto the element bearing `@id` is written by
  interpolation, as `class="slot @{extraClass}"`, since a `@class` there belongs to the child's placeholder template.
  Other attributes of the container are written by whichever template last wrote them.
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

```js live
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
fluid.def("my.filterSelect", {
    $layers: "fluid.UISelect",
    optionValues: ["all", "active", "completed"],
    optionNames: ["All", "Active", "Completed"],
    selection: "active",
    logSelection: "$effect:my.logSelection({self}.selection)"
});
my.logSelection = selection => console.log("Selected " + selection);

// With elideParent: false, the root of the tree, a <select>, is rendered onto the container itself
const select = container.ownerDocument.createElement("select");
container.appendChild(select);
my.filterSelect({container: select});
```

The `$compute` reruns whenever the selection or options change, and reconciliation updates only the nodes that
differ. With [live-state binding](#attribute-and-property-binding), the same widget can now also be written as a
template that binds `<select value="@{selection}">` and needs no change handler.

A heavier variant computes the template as an **HTML string**. The editor's `fluid.substrateTree` (in
`src/framework/edit/js/substrateTree.js`) renders a large recursive tree this way:

```js syntax
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

```js live
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

// A header of a post with no strapline, which is rendered at the left
fluid.def("my.postHeader", {
    $layers: ["my.header", "my.header.post", "my.header.bare"],
    title: "Partial templates",
    date: "21 November 2026"
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

```js live
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

Some widgets, such as code editors, maps or charts, own a complex DOM and have their own lifecycle: they must be
constructed once, on a real element, and kept alive while the component's configuration varies. `$bindable`
constructs such an object as soon as its arguments are available. By default it rebuilds the object whenever an
argument changes, but with `onceOnly: true` it constructs it exactly once for the lifetime of the record.

`fluid.codemirror` (`src/framework/edit/sfc/fluid-codemirror.vue`) binds a CodeMirror editor to the textarea that
its own view renders:

```js syntax
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

```js syntax
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

```js syntax
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

```js syntax
instance.on("change", fluid.cell.withAmbientSource(fluid.selfSource(self), () => self.text = instance.getValue()));
```

`excludeSource: "self"` applies to the whole component, so two widgets within one component which show the same value
would not hear each other's changes. Give each such widget a component of its own.

At the level of raw cells, the same source can be supplied to an edge directly:

```js syntax
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

```js syntax
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

```js syntax
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

**Site-absolute URLs.** In a page recording its site's root, every `href` and `src` which rendering writes and which
begins with a single `/`, e.g. `/css/main.css`, is resolved against that root as it is written, e.g. to
`../../css/main.css`. This applies alike to URLs bound in templates, to those in verbatim markup such as content
rendered from markdown, and to those islands render. Templates and content can therefore name the site's resources
site-absolutely, and the page still works wherever the site is served from, with no pass over the output, as Hugo's
`relativeURLs` makes. The browser resolves them against the same attribute, so a page made live renders the same URLs as
the build wrote. Protocol-relative URLs (`//host/...`), absolute URLs and relative URLs are left as written, as is
everything in a page which records no site root.

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
effects. Data fetched by `fluid.fetch` and its relatives, or by any asynchronous `$compute`, is waited for, and a
relative URL is resolved against the page. Scripts the page holds as its own are evaluated in document order before it
boots, as in the browser. An example is a script defining the layer named by its `fluid-layers`. A script whose `src`
is remote is not evaluated, and nor is one bearing `fluid-client`. Injected scripts, stylesheets and symbols are placed
in the head after its last `<fluid-import>`, in the order they are made. So a stylesheet the page holds after its
imports overrides those of its SFCs in the same way, whether the page is hydrated or booted in the browser.

The `sourceURL` comment naming each injected style's file is written relative to the document, as for scripts and
links, so a hydrated page reveals nothing of the builder's file system and is the same whichever machine built it.

Hydration is reversible. Everything `hydrate.js` adds to the page is marked with `data-fluid-hydrated`:

* An element added beside the page's own, e.g. an injected script, stylesheet or symbol host, bears an empty value.
* An element on which a component booted bears the JSON of its attributes and content as the page wrote them.
* When the bootstrap of Infusion is written in the `source` or `built` form, the first script it is expanded into
  bears `boot:` followed by the bootstrap's `src`.

`src/framework/server/dehydrate.js` reverses this. It writes the page exactly as `hydrate.js` read it, as serialised
by `fluid.serializeDocument`:

```
node src/framework/server/dehydrate.js page-hydrated.html [-o page.html]
```

So a site may keep its pages hydrated in place and recover each page's source from it. The round-trip support
described below also checks that dehydrating each hydrated page gives back the page.

#### Minimal pages and placeholder data

A page need hold no more than its bootstrap of Infusion, a `<fluid-import>` of the Single File Component at the root of
its tree, and an element bearing `fluid-layers`. The SFCs it imports, and those they import in turn, supply all of its
scripts, stylesheets, symbols and markup. Booted in the browser, such a page discovers them as its components are
instantiated. Rendered by `hydrate.js`, the page is written with all of them in place, and the browser shows its markup
as soon as it is parsed.

A **placeholder** is a minimal representative of the data a layer needs in order to instantiate and render most of its
content, used by rendering test fixtures and authoring tools. A layer names one as the default of a member holding a
URL, by the scheme `placeholder://{layerName}/{resourceName}`, and a runnable application overrides the member with
the URL of its real data. The component which fetches it bears the mixin `fluid.withPlaceholder`, beside a reader such
as `fluid.jsonReader`:

```js syntax
fluid.def("my.app", {
    records: {
        $component: {
            $layers: ["fluid.jsonReader", "fluid.withPlaceholder"],
            url: "placeholder://my.app/records"
        }
    }
});

// A runnable application, rendered from its real data, statically as in the browser
fluid.def("my.recordsSite", {
    $layers: "my.app",
    records: {url: "data/records.json"}
});
```

Since a placeholder is as small as possible, it is always held inline, by a top-level `<placeholder>` block of the
layer's Single File Component, so that it travels with the SFC wherever it is copied. Its material is held as text, or,
if it is binary or holds markup, in base64:

```html syntax
<placeholder name="records" type="application/json">[{"name": "Placeholder"}]</placeholder>
<placeholder name="viz" type="application/octet-stream" encoding="base64">H4sIAAAAAAAA...</placeholder>
```

A block bearing `src` is rejected. `src/framework/server/inlinePlaceholder.js` writes a file into an SFC as such a
block, replacing any of the same name, choosing the encoding and media type from the file unless told otherwise:

```
node src/framework/server/inlinePlaceholder.js my-app.vue records data/records.json [--type <media type>]
    [--encoding base64|text] [-n]
```

A placeholder may also be declared from script by `fluid.registerPlaceholder`. The mixin computes the reader's
`fetchUrl` by `fluid.resolveUrl`, which resolves a placeholder's URL to a Blob URL onto its material, a
module-relative URL such as `%my-module/data/records.json` through its module, and leaves any other URL as it is. It
also makes `isPlaceholder` `true` while `url` is a placeholder's, so that the component, or what holds it, can show that
its data is a stand-in. Any reader can take the mixin, provided it fetches its `fetchUrl` - e.g. bagatelle's
`hortis.csvReader`.

Every live component bearing the mixin is listed in `fluid.withPlaceholder.instances`, so the hydrater can find,
without knowing the page's design, which components were rendered from placeholders - see `fluid.documentPlaceholders`
in `server-support.js`. `hydrate.js` reports each one, and with `--no-placeholders` refuses to write a page which has
any - for a page which is a runnable application rather than a test fixture. `fluid.renderingStatically` is `true`
whilst a page is rendered under node, but no longer determines what a component fetches: a page is rendered
statically from the same data as in the browser.

When the browser boots a page written by `hydrate.js`, it adopts what the page already holds:

* Injected scripts, styles and symbols are not injected again. A script referred to by `src` records its source as
  `fluid-src`, so that it is recognised, and is not run a second time, by any other SFC which refers to it.
* Scripts bearing `fluid-client`, which were written but not run under node, load as the page does.
* The rendered markup is claimed by position, and rerendered as the real data arrives. Classes and attributes which
  the templates no longer write are removed from it. Those of a container which are its own, e.g. those written on the
  element bearing `fluid-layers`, are recorded as `fluid-own-class` when a template first renders into it, and are kept.

Once ready, the page renders the same markup whether it was booted from its minimal form or from its hydrated one.
`tests/framework-tests/server/hydrate-roundtrip-test.js` tests this, using the support in
`tests/test-core/browser/js/hydration-roundtrip.js`, which other projects can use for their own pages.

#### Copying out the files a page depends on

A page reaches every module through its bootstrap, for Infusion, and its module map, for the rest:

```html syntax
<script src="../vendor/infusion/src/framework/core/js/FluidBoot.js"></script>
<fluid-module id="my-site" src="../" modules="fluid-modules.json"></fluid-module>
<fluid-import src="%imerss-bioinfo/src/client/sfc/bbea/hortis-beaVizLoader.vue"></fluid-import>
```

`src/framework/server/copyOut.js` copies the modules into the site from their checkouts, and writes the map:

```
node copyOut.js story/index.html --source infusion-6=../infusion-6 --source imerss-bioinfo=../bagatelle [-n] [--list]
    [--vendor <dir>] [--framework boot|source|built] [--in-place]
```

It boots the page under node, as `hydrate.js` does, with each module's files read from its source. That is the
checkout given by `--source`, or else, for a module named like an npm package such as `maplibre-gl` or
`@mapbox/mapbox-gl-draw`, the directory where node finds that package - from the page's module or any of the
checkouts given, so wherever npm installed or hoisted it. Each module is placed where the map already locates it, or
else at `<vendor>/<module>`, by default `vendor` beside the map. It then copies into each module's directory every
file the page demanded from it. These are:

* the SFCs it imported, and those they import in turn;
* the scripts and stylesheets they inject, including those bearing `fluid-client`, which are not run under node;
* Infusion's files, in the form `--framework` chooses - see below;
* the images and fonts its stylesheets refer to;
* any data it fetched.

Before copying anything, it checks the version of each module copied from an installed npm package against the
version the project's `package.json` specifies for it, and copies nothing if they differ, so that a stale
`node_modules` cannot revert vendored copies to an older release - `--skip-version-check` overrides this. A module
copied from a checkout given by `--source` is not held to its version, but a warning is given if the checkout's version
differs, or if any of the files copied from it have uncommitted changes.

Finally, it writes the page's module map, locating every module it reached other than its own and Infusion. Nothing
else in the checkouts is copied, and the page and its SFCs need no rewriting. Run again, it reports which files have
changed in their checkouts, and with `-n` copies and writes nothing. A file the page demands from outside any module,
such as its own data, is not copied, but must exist. Sources may also be given by `--sources moduleOverrides.json5`,
an array of `{moduleName, baseDir}`.

With `--in-place`, nothing is copied: the map locates each module where its source is found. This suits a page
served from a checkout - e.g. bagatelle's own pages, whose map points into its `node_modules`.

**The form of Infusion's bootstrap.** `hydrate.js --framework` and `copyOut.js --framework` choose how a page's
`FluidBoot.js` is written out:

* `boot` (the default) - left as it is, to load Infusion's files in the browser;
* `source` - replaced by a `<script>` for each of Infusion's files;
* `built` - replaced by their bundle, `dist/fluid.boot.min.js`, built by Infusion's `build.js`.

`tests/framework-tests/server/copyout-test.js` copies out a page whose SFCs depend on a package installed beneath
their module and one hoisted above it, checks the map written, and checks that the page renders correctly from each
form of its bootstrap, served from its own directory alone.

#### Development affordances

A page in development may mark `FluidBoot.js` with `<script src=".../FluidBoot.js" data-fluid-dev-mode>`. It then looks for a
`moduleOverrides.json5` in the directory holding Infusion's root, and in each directory above it up to the root of
the server, and honours the nearest found. If its `infusion-6` entry names another checkout, that checkout's
`FluidBoot.js` is booted instead, so that the page runs the same Infusion as the site's tools, wherever the site
keeps the Infusion it names - in `node_modules` or vendored. The checkout is reached only if it is served too, e.g.
from a common parent of the site and the checkout; if it can't be fetched, a warning is logged and the named Infusion
boots. Without the attribute nothing is looked for, so a deployed page makes no requests beyond Infusion's own files.

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
