---
title: Fluid View
category: Infusion
type: infusion-docs
---

This page documents how Fluid Infusion 6 components render markup: the template binding syntax, the
Single File Component (SFC) format, and the machinery of views. It builds on the
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

* `$layers` defaults to `["fluid.component", "fluid.sfcLayer"]`.
* A `view` subcomponent is added, with layer `fluid.sfcTemplateViewComponent`, whose template is the SFC's
  `<template>` block (see [Views](#views)).
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
* **After the handler.** Every handler is run with update source `"dom"` (see [Source tracking](#source-tracking-and-the-dom)),
  and is followed by `fluid.cell.stabilize()`.

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
condition is true.

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

### View layers

| Layer | Template source |
|---|---|
| `fluid.viewComponent` | Base layer. Supplies `vTree`, a virtual DOM tree, directly or computed from `templateTree` |
| `fluid.templateViewComponent` | `template`, an HTML string |
| `fluid.sfcTemplateViewComponent` | The `<template>` block of the SFC named by `templateLayer` (added by the loader) |
| `fluid.selfTemplateViewComponent` | The markup its parent placed inside its `@id` element |
| `fluid.partialViewComponent` | Composites partial templates into a parent template at `relativeContainer`, e.g. `"after:.footer"` |

Members of `fluid.viewComponent`:

* `container` - The DOM element rendered into. A `container` passed to a creator function is forwarded here.
* `templateTree` - The parsed template.
* `vTree` - The activated virtual tree, with all bindings resolved.
* `elideParent` - Defaults to `true`, meaning the template's root element is merged with the container rather than
  nested inside it. Set it to `false` to render the root element inside the container.
* `renderedContainer` - A signal holding the element once it has been rendered.
* `renderView` - The effect that patches `vTree` into `container`.

Rendering is a reconciliation of the virtual tree against the existing DOM. Elements are reused wherever they match, so
DOM state such as focus, selection and scroll position survives updates and template edits.

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

### Wrapping an external widget with `$bindable`

> `$bindable` is **experimental and unstable**. See [its definition](/docs/fluid-integration-language#bindable).

Some widgets, such as code editors, maps or charts, own a complex DOM and have their own lifecycle: they must be
constructed once, on a real element, and kept alive while the component's configuration varies. `$bindable`
constructs such an object as soon as its arguments are available, and doesn't rebuild it when they change.

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
            bind: "fluid.codemirror.construct({self}, {self}.view.renderedContainer, {global}.CodeMirror)"
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
3. The constructor calls `fluid.disableRendering(self)`, so that later model changes don't reconcile away the
   widget's DOM.
4. An `$effect` pushes model changes into the widget (model to widget), and a listener on the widget writes its
   changes back to the model (widget to model).
5. An optional `unbind` record, e.g. `unbind: "my.destroy({boundValue})"`, tears the widget down when an argument
   becomes unavailable or the component is destroyed.

Step 4 creates a cycle: the widget writes to the model, which runs the effect, which writes the same text back into
the widget. This can reset its cursor or undo history. The next section explains how to break it.

### Source tracking and the DOM

Every update to a cell can carry a **source**, a string naming the agent in the world that caused it. The source
travels with the update through every computed value that depends on it. An edge marked `excludeSource: "s"` skips
notification for updates from source `s`, and one marked `includeSource: "s"` is notified only of them (see
[`fluid.cell.effect`](/docs/fluid-signals#fluidcelleffectfn-staticsources-props)).

The view layer tags all user activity with the source `"dom"`:

* every `@on...` event handler, and
* every live-state write-back from `value`, `checked` and the like,

run inside `fluid.cell.withAmbientSource("dom", ...)`, so any cell they set is updated with source `"dom"`.

This allows a binding that writes *to* the DOM to ignore changes that came *from* the DOM. Without it, a value typed
into an external widget would flow to the model and straight back into the widget. Annotate the edge that writes into
the widget with `excludeSource: "dom"`:

```js
readEffect: {
    $effect: {
        func: "fluid.codemirror.updateText",
        args: ["{self}.instance", "{self}.text"],
        excludeSource: "dom"
    }
}
```

The widget-to-model listener must then run with the same source, so that its writes are recognised:

```js
instance.on("change", fluid.cell.withAmbientSource("dom", () => self.text = instance.getValue()));
```

Now typing in the editor updates `text`, which still notifies everything else (other views, computed values, the
saved document), but not the effect that would write back into the editor. A change to `text` from any other source,
such as loading a file or undoing in another pane, still reaches the editor.

At the level of raw cells the same annotation applies to a computed edge:

```js
const toWidget = fluid.cell().computed(text => text, [model], {excludeSource: "dom"});
```

> In the Integration Language, `excludeSource` and `includeSource` are currently honoured on `$effect` records only.
> A `$compute` record does not yet forward them, so use an `$effect` (as above) for edges into external widgets.

Template bindings don't need the annotation. A binding such as `value="@{text}"` writes back to the model, and when
the model change returns, the binding compares the property with the new value and doesn't write it again. Source
tracking is needed where a widget can't make that comparison cheaply or without side effects.
