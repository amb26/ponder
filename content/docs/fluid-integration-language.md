---
title: Fluid Integration Language
category: Infusion
type: infusion-docs
---

This page documents the Fluid Integration Language (IL), the configuration language through which Fluid Infusion 6
components are defined, composed and wired together as an [integration domain](/term/integration-domain).
It is implemented in [`FluidIL.js`](https://github.com/fluid-project/infusion-6/blob/main/src/framework/core/js/FluidIL.js)
on top of the reactive primitive
[`fluid.cell`](/docs/fluid-signals), whose semantics (signals, effects, [unavailable values](/docs/fluid-signals#unavailable-values),
deferred stabilization) it inherits throughout.

The raw markdown underlying these docs is available on [GitHub](https://raw.githubusercontent.com/amb26/ponder/refs/heads/main/content/docs/fluid-integration-language.md),
suitable for direct ingestion by your friendly local neighbourhood intelligence.

## Model

A program in the IL is derived from a set of named **layers**: plain JSON-like records registered in a global, reactive layer store
via [`fluid.def`](#fluiddeflayername-layer). A **component** is a live instance whose contents are derived from the merge of an
ordered set of layers. Within a layer, any value may written as be a plain value, a **reference** to a value elsewhere in the
component tree, or a **signal record** ([`$compute`](#compute), [`$method`](#method), [`$effect`](#effect),
[`$component`](#component), ...) describing how the live value is produced.

Key properties:

* **Everything is addressable by name.** Layers are referred to by global name, components and values by
  [context references](#references) resolved through the component tree. Functions are referred to by global name or
  by reference. Configuration is expected to be completely serialisable and should not hold direct JavaScript references.
* **Everything is reactive.** A component is a computed signal over its layers. Redefining a layer, writing to a
  component, or a component appearing or disappearing in the tree propagates to every dependent value, effect and
  subcomponent on the next stabilization. This runs automatically at the end of the current task, or at once on a
  call to `fluid.cell.stabilize()`. Signal products whose defining record is unchanged are transferred intact to the
  next component state.
* **Any party may contribute.** Layers from independent authors combine by merging, linkages, dynamic layer names and
  live writes without editing each other's source. The precedence of every contribution is well-defined.
* **Incompleteness is a value.** A missing layer, an unresolvable reference or pending I/O yields an
  [unavailable value](/docs/fluid-signals#unavailable-values) that propagates rather than throws. A component with
  unavailable layers is itself unavailable and allocates no effects until it becomes complete.

## Reading and writing layers

### fluid.def(layerName, [layer])

* `{String} layerName` - Global name of the layer, conventionally a dotted path, e.g. `"my.app.counter"`
* `{Object} [layer]` - The layer definition to store
* Returns: `{Object|undefined}` - If `layer` is omitted, the raw (unmerged) definition currently stored for `layerName`

With two arguments, writes or replaces the definition of `layerName` in the layer store. Every live component whose
layers include `layerName`, directly or by inheritance, re-merges reactively. A global **creator function** is also
registered at the path `layerName`, which constructs a free-standing component:

```js
fluid.def("my.app.counter", {
    $layers: "fluid.component",
    count: 0
});

const counter = my.app.counter({count: 5}); // Creator function - argument is a "user" layer
counter.count; // 5
```

With one argument, reads back the stored definition. A layer whose definition is not yet written reads as unavailable,
and any component depending on it waits for it with its own unavailable status.

## Component lifecycle

### Creator functions: layerName([userLayer])

* `{Object} [userLayer]` - Optional layer merged at `user` precedence. Its own `$layers` are appended to the component's layers
* Returns: `{Component}` - A proxy to a fresh component instantiated at the root of the tree

The returned **component proxy** (from regular client JavaScript code) has these semantics:

* **Reads** resolve signals transparently: `that.count` returns the current concrete value, `that.child` returns a
  proxy to a subcomponent, `that.method(...)` invokes a `$method`.
* **Writes** (`that.count = 6`, or mutating array methods such as `that.items.push(x)`) are recorded in the
  component's **live layer**, the highest-precedence layer, and propagate reactively. A write beneath a
  [`$reactiveRoot`](#reactiveroot) is applied immutably to the root's value.
* Access after destruction throws.

### Component.destroy()

Every component (via the base layer `fluid.component`) has a `destroy` method. Destruction disposes all of the
component's effects, bindables and subcomponents. Equivalent to `fluid.destroyComponent(that)`.

A member of a [`$for`](#for) list whose source is sited is lensed from an element of that source, and is not
destroyed in place. Instead its element is deleted from the original source data, and the list then destroys the
component in turn. A todo item can therefore delete itself with `{self}.destroy()`, without asking its list to do it.

### Unavailable components

A component is **unavailable** while any of its layers is undefined, loading, or circular. References to it, and to
values within it[^1], yield unavailable values; no effects are allocated within it. When the missing layers arrive, the
component completes and its effects start. `fluid.unavailableComponents` is a global cell holding `true` once no
component in the tree is unavailable, and an unavailable value otherwise.

## Layers

Infusion's behaviour is controlled by the contents of *layers*, which are declarative,
serialisable blocks of configuration equivalent to their JSON representation. Layers may contain a variety of directives,
whose names begin with the dollar character $. Some commonly used directives are `$layers`, `$compute`, `$effect`
and `$method`; others are described below.

The values in components instantiated from layers are related by context-scoped *references* which are strings beginning with the `{` 
curly brace and typically take the form `{context}.path.into.value`.

The characters `{`, `$` and `\` occurring naturally at the start of strings in configuration should be escaped as `\{`, `\$` and
`\\`.

### $layers

`{String|String[]}` - The parent layers of this layer. A component's full layer list is linearised from the layer
hierarchy by C3 (as for Python's method resolution order): a layer beats the layers it inherits from, and a parent
listed earlier in `$layers` beats one listed later. The resolved list is readable at `that.$layers`. To be instantiable
as a component, its layer hierarchy must somewhere include `fluid.component`.

```js
fluid.def("my.shape", {$layers: "fluid.component", sides: 0, colour: "black"});
fluid.def("my.red", {$layers: "fluid.component", colour: "red"});
fluid.def("my.triangle", {$layers: "my.shape", sides: 3});
fluid.def("my.redTriangle", {$layers: ["my.red", "my.triangle"]});

const t = my.redTriangle();
t.sides;   // 3 - my.triangle beats my.shape
t.colour;  // "red" - my.red is listed before my.triangle and so beats my.shape
```

An entry in `$layers` which is itself a [reference](#references) is a **dynamic layer name**, resolved reactively from the
component's context. The referenced value may be a layer name or array of names:

```js
fluid.def("my.panel", {
    $layers: ["fluid.component", "{self}.flavour"],
    flavour: "my.compactPanel"
});
```

Dynamic layers merge above all static layers and literal configuration (see [precedence](#merging-and-precedence)).

A cycle in the hierarchy, or a layer which is not defined, makes the component unavailable.

#### Merging and precedence

A component's contents are a deep merge of layer records, applied weakest first:

| Precedence (weakest first) | Source |
|---|---|
| `def` | Static layers named in `$layers`, linearised; more derived beats less derived |
| `subcomponent` | The body of the [`$component`](#component) record which created this component |
| `user` | The argument to a creator function |
| `dynamicLayers` | Layers named via references in `$layers` |
| `variables` | Iteration variables bound by [`$for`](#for) |
| `live` | Writes made through the component proxy |

Merge rules:

* Plain objects contributed by more than one layer merge recursively, key by key.
* Any other value (primitive, array, function, signal record) from a stronger layer **replaces** that from a weaker
  one wholesale. Arrays are not concatenated.
* A key holding a signal record is replaced as a unit by a stronger layer's value at that key; the record is not merged
  into. The exception is a [`$reactiveRoot`](#reactiveroot), whose individual members a stronger layer may override with
  literal values or references.

Merging is reactive: changing any contributing layer re-merges the component. Signal products (computed values,
effects, subcomponents) whose defining record is identical before and after are retained rather than rebuilt.

## References

An (IL) **reference** is a string of the form

```
{context}.path.into.value
{context selector}.path
```

appearing as a configuration value, an argument, a signal designator or a `$layers` entry. It is resolved
reactively from the point of view of the component in which it appears: if the context or the value at the path
changes, so does the reference. A reference which can't be resolved yields an unavailable value.
A path which runs off the end of plain data yields `undefined`; a path naming a missing member of a component yields
an unavailable value.

```js
fluid.def("my.greeter", {
    $layers: "fluid.component",
    name: "World",
    shout: "{self}.name"           // tracks name
});
```

A reference to a path holding mutable configuration is **sited**: writing through it writes to the original site.

A reference which designates its own value, or a value which includes or is included by it, yields an unavailable
value rather than a cycle - e.g. `bounds: "{self}.bounds"`. Within a `$component` record this is easily written by
mistake for a reference to the enclosing component, which should instead be named by its context, e.g.
`bounds: "{workspace}.bounds"`.

### Context names

| Context | Resolves to |
|---|---|
| `self` | The component in which the reference appears - within a [`$component`](#component) record, this is the subcomponent being defined, not the component holding the record |
| `$parent` | The parent of the component in which the reference appears |
| A member name, e.g. `{panel}` | A component of that member name, in scope |
| A layer name or its nickname (last segment), e.g. `{my.app.panel}` or `{panel}` | A component bearing that layer, in scope |
| `/` | The root of the component tree |
| `/path.to.component` | The component at that absolute path in the tree |
| `global` | The JavaScript global object |
| `0`, `1`, ... | The positional arguments of a [`$method`](#method) call |

**Scope.** A context name is resolved by searching outwards from the referring component: its own names, then its
direct children's, then its parent's, then its siblings', and so on up through each ancestor and that ancestor's
direct children.
The names of a component are its member name and each of its non-framework layer names and their nicknames. A member
name beats a layer name at the same level. Components bearing `fluid.resolveRoot` are visible from everywhere.
Scope is reactive: a reference re-resolves when a matching component appears or disappears.

```js
fluid.def("my.app", {
    $layers: "fluid.component",
    theme: "dark",
    toolbar: {
        $component: {
            $layers: "my.toolbar",
            theme: "{app}.theme"     // nickname of my.app
        }
    }
});
```

### Selectors

A reference whose context is followed by a space and a selector, `{context selector}`, resolves to the live array
of components below `context` which match the selector, as for
[`fluid.liveQueryILSelector`](#fluidlivequeryilselectorroot-selector-flat). With a path, it yields the array of
values at that path in each match.

Selector syntax follows CSS: whitespace-separated steps match descendants, `>` matches direct children, and each step
is a context name (layer name, nickname or member name) or `&name`, or `#id`.

```js
fluid.def("my.dashboard", {
    $layers: "fluid.component",
    allTitles: "{self my.widget}.title",
    topLevel: "{self > my.widget}"
});
```

## Signal directives

A signal record is an object with a single key starting with `$`, or equivalently a **compact string**
`"$type:body"`. Function-bearing records share the **function record** syntax:

```js
{func: "my.global.fn", args: ["{self}.a", 3]}   // full form
"$compute:my.global.fn({self}.a, 3)"            // compact form
```

* `func` - A global function name, a [reference](#references) to a function (e.g. `"{self}.helper"`), or a function value.
* `args` - Array (or single value) of argument material. References anywhere within it, including inside nested
  objects and arrays, are resolved.
* In compact form, arguments are split on commas and coerced: `3` → number, `true` → boolean, otherwise a string or
  reference. Use the full form for arguments containing commas, parentheses or structure.

### $compute

A value computed by a pure function from its resolved arguments. Recomputed lazily whenever any argument changes.
If any argument is unavailable the function is not called and the value is unavailable.

```js
fluid.def("my.rect", {
    $layers: "fluid.component",
    width: 3,
    height: 4,
    area: "$compute:my.multiply({self}.width, {self}.height)"
});
my.multiply = (a, b) => a * b;

const r = my.rect();
r.area;          // 12
r.width = 5;
r.area;          // 20
```

The function may be async (returning a `Promise` or async iterator, as for
[`asyncComputed`](/docs/fluid-signals#cellasynccomputedfn-staticsources-props)); the value is pending until it settles.

### $effect

A side effect upon the world outside the component tree, run during stabilization whenever its resolved arguments
change. Effects are allocated only once the component is fully available, are not run while any
argument is unavailable, and are disposed when the component is destroyed or the record is withdrawn from its layers.

* `includeSource`, `excludeSource` (full form only) - restrict notification by update source, as for
  [`fluid.cell.effect`](/docs/fluid-signals#fluidcelleffectfn-staticsources-props).

```js
fluid.def("my.logger", {
    $layers: "fluid.component",
    count: 1,
    log: "$effect:my.log({self}.count)"
});
my.log = count => console.log("Count is " + count);

const l = my.logger();
fluid.cell.stabilize();   // Count is 1
l.count++;
fluid.cell.stabilize();   // Count is 2
```

### $method

A function member invocable on the component. Arguments are resolved at call time. `$method` does not produce a signal
(other than to the extent that every Infusion value is a signal) like `$compute` and `$effect` but has a similar syntax,
including a short form variant.

* **Without `args`**: the function is called with the component followed by the caller's arguments: `func(that, ...args)`.
* **With `args`**: the call's positional arguments are available as contexts `{0}`, `{1}`, ... An optional `:label`
  suffix on a reference documents it and is otherwise ignored. A positional argument not supplied is `undefined`.

```js
fluid.def("my.taxa", {
    $layers: "fluid.component",
    entries: ["Vicia hirsuta", "Stellaria graminea"],
    lookup: "$method:my.lookup({self}.entries, {0}:query, {1}:max)",
    describe: "$method:my.describe"
});
my.lookup = (entries, query, max) => entries.filter(e => e.includes(query)).slice(0, max);
my.describe = (that, prefix) => prefix + that.entries.length;

my.taxa().lookup("Vicia", 1);   // ["Vicia hirsuta"]
my.taxa().describe("Count: ");  // "Count: 2"
```

## Other directives


### $component

Declares a subcomponent at this member. The record body is a layer merged at `subcomponent` precedence and must
name `$layers`. The subcomponent lives as long as the record is present in its parent's merged layers: removing or
changing the record destroys or reconfigures it.

```js
fluid.def("my.app", {
    $layers: "fluid.component",
    title: "Inbox",
    header: {
        $component: {
            $layers: "my.header",
            text: "{app}.title"
        }
    }
});

my.app().header.text;   // "Inbox"
```

#### Injecting an existing component

A top-level member may instead hold a [reference](#references) to a component which exists elsewhere in the tree. While
the reference resolves to a component, that component is **injected** at the member. It can be reached through the
member, and its siblings see it in scope under the names it would have had if it had been created there: the
injecting member name, plus its layer names and their nicknames. Its member name at its original site is not
carried over. It is not moved or copied, and keeps its original path and lifetime. The injection is withdrawn if the
reference stops resolving to a component, if a stronger layer overrides the reference, or if the component is
destroyed.

```js
fluid.def("my.workspace", {
    $layers: "fluid.component",
    library: {
        $component: {
            $layers: "my.library",
            items: {
                $component: {
                    $layers: "my.catalogue"
                }
            }
        }
    },
    current: "{library}.items",   // Inject the library's catalogue at "current"
    searchBox: {
        $component: {
            $layers: "my.searchBox",
            entries: "{current}.entries"
        }
    }
});
```

`workspace.current` is the same component as `workspace.library.items`. Within `searchBox` it resolves as `{current}`,
`{catalogue}` or `{my.catalogue}`, but not as `{items}`. A stronger layer may override a `$component` record with a
reference at the same member, or the other way round. A reference to the component itself (`{self}`) is never
injected, and a reference which turns out to designate plain data rather than a component simply yields that value.
Injecting another component's [view](/docs/fluid-view#views) lets one component render through another's view.
### $for

Within a `$component` record, instantiates one subcomponent per element of a collection, kept in step with it. The
member then holds a `fluid.componentList` whose `list` holds the instances.

* `source` - Reference to an array or object
* `valueAs` - Name under which each collection element is visible in its corresponding subcomponent (via `{self}.<valueAs>`). When the
  source is sited, this is a live reference to the element and can be written through.
* `keyAs` - Name under which the collection element's index or key is visible in its subcomponent

```js
fluid.def("my.editorHolder", {
    $layers: "fluid.component",
    names: {$reactiveRoot: ["alpha"]},
    editors: {
        $component: {
            $layers: "my.editor",
            $for: {source: "{editorHolder}.names", valueAs: "name", keyAs: "index"},
            label: "$compute:my.label({self}.index, {self}.name)"
        }
    }
});

const h = my.editorHolder();
h.names.push("beta");      // Second editor is created on stabilize
h.editors.list.length;     // 2
```

**Writing through iteration variables.** When the source is sited, each `valueAs` variable keeps track of where its
data came from, so the subcomponent can change its own element without involving the component that owns the
list:

* A write beneath the variable, e.g. `self.todo.completed = true`, is applied to the original element of the source.
* `delete self.todo` removes the element from the source, as does [`destroy()`](#componentdestroy) on the subcomponent.
* Writing to the variable itself, e.g. `self.todo = {...}`, rebinds it locally in the subcomponent's live layer and
  doesn't touch the source.

This holds across intermediate projections. Elements selected by a non-mutating array method such as `filter()`
remain linked to their original source:

```js
fluid.def("my.todoItem", {
    $layers: "fluid.component",
    toggle: {
        $method: {
            func: self => self.todo.completed = !self.todo.completed,   // Writes into {todoList}.todos
            args: "{self}"
        }
    }
});

fluid.def("my.todoList", {
    $layers: "fluid.component",
    todos: {$reactiveRoot: []},
    openTodos: "$compute:my.openTodos({self}.todos)",
    openItems: {
        $component: {
            $layers: "my.todoItem",
            $for: {source: "{todoList}.openTodos", valueAs: "todo"}
        }
    }
});
my.openTodos = todos => todos.filter(todo => !todo.completed);
```
### $if

Within a `$component` record, a condition whose truthiness controls whether the subcomponent exists. In its short
form this is a reference:

```js
fluid.def("my.task", {
    $layers: "fluid.component",
    assigned: false,
    assignee: {
        $component: {
            $layers: "my.assignee",
            $if: "{task}.assigned"
        }
    }
});
```

In its long form it is a [function record](#signal-directives), as for `$compute`, and the truthiness of the computed
value is tested. This avoids a separate boolean member for conditions where a value such as `0` or `""` should still
count:

```js
distanceLabel: {
    $component: {
        $layers: "my.distanceLabel",
        $if: {
            func: distance => distance !== null,
            args: "{closestNoteFinder}.distance"
        }
    }
}
```

### $reactiveRoot

Marks a value as an independently writable unit of reactive data, typically structured data which will be
mutated. Writes at or beneath the root through the component proxy produce a fresh immutable value of the whole root,
notifying dependents of the root and of any path within it. The value is either literal data, or a string
reference, in which case the root is bound to the referenced site.

Alongside the root, in the same layer or merged from a stronger one, the record may hold individual members of the
root's value:

* A **literal** value replaces the value of that member in the root's initial value.
* A **reference** links that member to the referenced value: whenever the referenced value changes, it is written into
  the member, as an immutable update of the root which is not recorded in the history. The member may still be written
  through the component proxy as before, until the referenced value next changes.

A member supplied by a stronger layer, whether alongside or within its own `$reactiveRoot` record, displaces any
literal or reference from a weaker layer at that member, leaving the others in place. A signal record such as
`$compute` at the path of the root replaces it as a whole, but a member may not hold one - this fails, since only
literal values and references may be merged alongside a root.

```js
fluid.def("my.todoList", {
    $layers: "fluid.component",
    todos: {$reactiveRoot: [{text: "Write docs", done: false}]},
    remaining: "$compute:my.countRemaining({self}.todos)"
});
my.countRemaining = todos => todos.filter(t => !t.done).length;

const t = my.todoList();
t.todos[0].done = true;   // Immutable update of todos
t.remaining;              // 0
```

A layer deriving from another may wire a single member of its reactive state to a value elsewhere, leaving the rest of
the root as it was:

```js
fluid.def("my.searchPanel", {
    $layers: "fluid.component",
    state: {$reactiveRoot: {query: "", results: []}}
});

fluid.def("my.linkedSearchPanel", {
    $layers: "my.searchPanel",
    finder: {
        $component: {
            $layers: "my.textFinder"
        }
    },
    state: {
        query: "{finder}.foundText"   // Tracks foundText; results is retained from my.searchPanel
    }
});
```

### $importMap

`{Object<String, String>}` - Maps layer names to module paths (`.js`, or `.vue` single-file components) from which
their definitions are loaded on demand. This demand occurs when a component derived from the layer name begins to
instantiate. While loading, dependent components are unavailable with pending status.

```js
fluid.def("my.app", {
    $layers: "fluid.component",
    $importMap: {"my.app.chart": "%my-app/src/chart.vue"}
});
```

### $linkage

Registers a rule, for as long as the containing component exists, that any component bearing all layer names of `inputLayers`
also acquires `outputLayers`. Allows a layer to be adapted to a context its author did not anticipate. Accepts a
single linkage or an array.

```js
fluid.def("my.plugin", {
    $layers: "fluid.component",
    darkTables: {
        $linkage: {
            inputLayers: ["my.table", "my.darkTheme"],
            outputLayers: ["my.darkTable"]
        }
    }
});
```

The linkage rule's effect lasts as long as the component holding it. Linkages are sometimes called
[co-occurrences](https://hal.science/hal-01854418/file/AnAnatomyOfInteraction_authorversion.pdf).  

### $bindable

> **Experimental and unstable.** The syntax and semantics of `$bindable` are likely to change.

A value produced by binding to a resource in the world, eagerly as soon as the arguments to `bind` are available.
The value is released by `unbind` when any argument becomes unavailable, when it is rebound, or when the record is
disposed, for example by destroying its component.

By default, as for `$compute` and `$effect`, a change in any argument **rebinds** the value: it is unbound, and `bind`
is called again with the new arguments. A component passed as an argument doesn't count as changed just because it
is re-merged. Anything `bind` reads other than its arguments is not tracked.

* `bind` - A function record, compact `"func(args)"` string or bare function, producing the bound value. A binder
  may return a signal to stream updates over the lifetime of a binding, and readers of the bindable see through it.
* `unbind` - Optional, in any of the same forms, receiving the bound value (by default, or via `{boundValue}` in its
  `args`)
* `onceOnly` - If `true`, the value is bound exactly once for the lifetime of the record. Later changes in its
  arguments, even a brief period when they are unavailable, don't rebind it. Use this for heavyweight widgets which
  can't be reconfigured without being rebuilt, and which would lose their state if they were (see
  [Wrapping an external widget](/docs/fluid-view#wrapping-an-external-widget-with-bindable)).

```js
fluid.def("my.socketHolder", {
    $layers: "fluid.component",
    url: "wss://example.org/feed",
    socket: {
        $bindable: {
            bind: "my.openSocket({self}.url)",
            unbind: "my.closeSocket({boundValue})"
        }
    }
});
```

### $variety

Used to categorise layers. Currently seen values are `"framework"` which marks a layer as part of the Infusion framework, 
and `"frameworkAux"` which marks it as part of the Infusion layer editing UI. Framework 
layers are not entered into [scope](#context-names) by name.

## Additional JavaScript API

A few public-facing methods are exposed as utilities to help with reading and writing to the component tree but their
use is expected to be rare:

### fluid.liveQueryILSelector(root, selector, [flat])

* `{Component} root` - The component below which to search
* `{String} selector` - An [IL selector](#selectors), matched downwards from `root` (which is not itself a candidate)
* `{Boolean} [flat=false]` - If `true`, consider only direct children of `root`
* Returns: `{Cell<Component[]|Unavailable>}` - A cell holding all matching components in tree order

Returns a live, cached cell which is recomputed whenever components below `root` are created, destroyed or change
layers. If any traversed component is unavailable, the cell holds the merged unavailable value instead.

```js
fluid.def("my.app.editor", {$layers: "fluid.component"});

const editors = fluid.liveQueryILSelector(app, "my.app.editor");
fluid.cell.effect(list => console.log(list.length + " editors"), [editors]);
```

In most cases, the same result should be achieved declaratively via a [selector reference](#selectors) `"{self my.app.editor}"`,
subject to current framework limitations.

### fluid.queryILSelector(root, selector, [flat])

As `fluid.liveQueryILSelector`, but returns a one-off array.

### fluid.contextRefToPromise(contextRef, root)

* `{String} contextRef` - A [context reference](#references), e.g. `"{self}.results"`
* `{Component} root` - The component from whose point of view the reference is resolved
* Returns: `{Promise<Any>}` - Resolves with the first available value of the reference

### fluid.avatar(layerName)

* `{String} layerName` - The layer to inspect
* Returns: `{Component}` - A proxy to the layer's **avatar**

Inspecting a layer's definition with `fluid.def` misses anything it gains from its parent layers or from
[linkages](#linkage). An avatar is a trial instance of a component bearing just that layer, held in an `avatars` area
at the root of the tree, which shows everything the layer brings to a component. Avatars are **inert**: they allocate
no effects or linkages, bind no bindables, render nothing, don't hold up `fluid.unavailableComponents` and aren't
found by selectors or scope searches from outside. Members which depend on context the layer only finds where it is
genuinely deployed are unavailable, but all others, including computed ones, can be read as for any component. An
avatar follows any redefinition of its layers and is destroyed when its layer is deleted.

`fluid.avatarMerged(layerName)` returns the avatar's raw merged layer structure, including the fully resolved
`$layers`. This is available even when the avatar itself is unavailable. A host uses avatars, for example, to
discover a widget's `preferredSize` or whether it bears `fluid.topLevelWidget`.

### Utilities

* `fluid.isComponent(value)` - `true` if `value` is a component instance
* `fluid.isDestroyed(that, [strict])` - `true` if destruction of `that` has begun (or with `strict`, completed)
* `fluid.unwrapProxy(value)` - The plain value underlying a component or mat proxy
* `fluid.hasLayer(that, layerName)` - `true` if `layerName` is in the component's resolved `$layers`

[^1]: From components designated by ordinary user configuration - under the covers, components with unavailable 
constituents actually continue to evaluate and elaborate as normal, routing around the individual unavailable
values until they resolve. Inspector tools can use the Infusion JavaScript API to expose this process.
