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

Some examples on this page are live - complete and self-contained, they can be edited, and are run once they are
free of errors: what each logs appears in the console beneath it, and a view it defines, or a Single File Component,
is shown beside it. An example's code receives `console`, and `container`, the element beside it. The other examples
show syntax alone, e.g. a fragment of a layer record, and are read-only. Every example is checked by Infusion's
linter, down to the interiors of its references and directives as Infusion reads them - hover over a marked error to
see what is wrong, and, for an editable example, a fix.

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

```js live
fluid.def("my.app.counter", {
    $layers: "fluid.component",
    count: 0
});

const counter = my.app.counter({count: 5}); // Creator function - argument is a "user" layer
console.log(counter.count); // 5
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
  [`$reactiveRoot`](#reactiveroot) is applied immutably to the root's value. A write to a member which is defined by a
  reference to another site, e.g. `pane: "{hashManager}.hash.pane"`, is applied to that site rather than to the member,
  which goes on following it --- so a member defined by a reference is never severed from its source by a write.
  A write or deletion made from within a computation or effect does not make it depend on what the write consults - the
  site written, the value overwritten or the component's layers. An effect which seeds a member, is therefore not rerun  when the member is later written.
  
* **Reads within a computation**, i.e. within the function of a [`$compute`](#compute) or [`$effect`](#effect), make
  the computation depend on the member read, so that it reruns when that member changes, as well as when its arguments
  do. To execute code without setting up tracking on its dependencies, wrap it in 
  [`fluid.cell.untracked`](/docs/fluid-signals#fluidcelluntrackedfn), e.g. `fluid.cell.untracked(() => self.open)`.
* Access after destruction throws, other than within a computation, where a destroyed component and each of its members
  read as [unavailable](#unavailable-components).

### Component.destroy()

Every component (via the base layer `fluid.component`) has a `destroy` method. Destruction disposes all of the
component's effects, bindables and subcomponents. Equivalent to `fluid.destroyComponent(that)`.

Once destroyed, the component and each of its members read as an unavailable value reporting the destruction. Any
computation which read one of its members is notified once, and is then itself unavailable, unless it no longer reads
the destroyed component when it reruns - e.g. a computation over a [selector](#selectors) whose matches have changed.

A member of a [`$for`](#for) list whose source is sited is lensed from an element of that source, and is not
destroyed in place. Instead its element is deleted from the original source data, and the list then destroys the
component in turn. A todo item can therefore delete itself with `{self}.destroy()`, without asking its list to do it.

### Unavailable components

A component is **unavailable** while any of its layers is undefined, loading, or circular. References to it, and to
values within it[^1], yield unavailable values; no effects are allocated within it. When the missing layers arrive, the
component completes and its effects start. `fluid.unavailableComponents` is a global cell holding `true` once no
component in the tree is unavailable, and an unavailable value otherwise.

Reading a member of an unavailable component from outside a computation throws an error saying why it is unavailable,
rather than quietly returning `undefined`, so that it is not mistaken for an empty component. Within a computation the
member reads as unavailable, and the computation depends on the component becoming available. Members probed by generic
code, such as `then`, `toJSON` and `constructor`, still read quietly.

A layer which a component names but which is never defined leaves it unavailable. 

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
listed later in `$layers` beats one listed earlier. A parent listed after a layer which already inherits from it is
ignored, since it cannot beat that layer, and that layer's own hierarchy already places it. The resolved list is
readable at `that.$layers`, weakest first. To be instantiable
as a component, its layer hierarchy must somewhere include `fluid.component`. The algorithm and its rationale are
described in [Layer Linearisation](/docs/linearisation-algorithm).

```js live
fluid.def("my.shape", {$layers: "fluid.component", sides: 0, colour: "black"});
fluid.def("my.red", {$layers: "fluid.component", colour: "red"});
fluid.def("my.triangle", {$layers: "my.shape", sides: 3});
fluid.def("my.redTriangle", {$layers: ["my.triangle", "my.red"]});

const t = my.redTriangle();
console.log(t.sides); // 3 - my.triangle beats my.shape
console.log(t.colour); // "red" - my.red is listed after my.triangle and so beats my.shape
```

An entry in `$layers` which is itself a [reference](#references) is a **dynamic layer name**, resolved reactively from the
component's context. The referenced value may be a layer name or array of names:

```js live
fluid.def("my.compactPanel", {$layers: "fluid.component", padding: 2});
fluid.def("my.roomyPanel", {$layers: "fluid.component", padding: 12});

fluid.def("my.panel", {
    $layers: ["fluid.component", "{self}.flavour"],
    flavour: "my.compactPanel"
});

const panel = my.panel();
fluid.cell.stabilize();   // The dynamic layer is resolved and merged
console.log(panel.padding); // 2
panel.flavour = "my.roomyPanel";
fluid.cell.stabilize();
console.log(panel.padding); // 12
```

Dynamic layers merge above all static layers and literal configuration, wherever they appear in the list (see
[precedence](#merging-and-precedence)). Amongst themselves, a later reference beats an earlier one, and the dynamic
layers of a derived layer beat those it inherits.

A dynamic layer name which names an undefined layer makes the component unavailable until the layer is defined. To
choose amongst candidate layers only those which exist, compute the name with `fluid.definedLayers` or
`fluid.firstDefinedLayer` (see [Utilities](#utilities)):

```js live
fluid.def("my.type.default", {$layers: "fluid.component", heading: "Page"});

fluid.def("my.document", {
    $layers: ["fluid.component", "{self}.typeLayers"],
    type: "post",
    candidates: "$compute:my.document.candidates({self}.type)",
    // my.type.post if it is defined, otherwise my.type.default
    typeLayers: "$compute:fluid.firstDefinedLayer({self}.candidates)"
});
my.document.candidates = type => ["my.type." + type, "my.type.default"];

const doc = my.document();
fluid.cell.stabilize();
console.log(doc.heading); // "Page" - my.type.post is not yet defined
fluid.def("my.type.post", {$layers: "fluid.component", heading: "Blog post"});
fluid.cell.stabilize();
console.log(doc.heading); // "Blog post"
```

Since these test whether a layer is defined reactively, the component switches to the preferred layer as soon as it is
defined, and back again if it is deleted.

A cycle in the hierarchy, or a layer which is not defined, makes the component unavailable.

#### Merging and precedence

A component's contents are a deep merge of layer records, applied weakest first:

| Precedence (weakest first) | Source |
|---|---|
| `def` | Static layers named in `$layers`, linearised; more derived beats less derived |
| `subcomponent` | The body of the [`$component`](#component) record which created this component |
| `forLayer` | The collection element merged into this component by [`$for`](#for)'s `layerAs` |
| `user` | The argument to a creator function |
| `distribution` | Options refining this component written at a member which injects it elsewhere - see [Refining an injected component](#refining-an-injected-component) |
| `template` | Material contributed by the template which renders this component, e.g. the markup at its `@id` element, or the layers and `data-` attributes of an [island](/docs/fluid-view#verbatim-markup-and-islands) |
| `dynamicLayers` | Layers named via references in `$layers` |
| `variables` | Iteration variables bound by [`$for`](#for) |
| `live` | Writes made through the component proxy |

Merge rules:

* Plain objects contributed by more than one layer merge recursively, key by key.
* Any other value (primitive, array, function, signal record) from a stronger layer **replaces** that from a weaker
  one wholesale. Arrays are not concatenated.
* A key holding a signal record is replaced as a unit by a stronger layer's value at that key; the record is not merged
  into. There are two exceptions: a [`$reactiveRoot`](#reactiveroot), whose individual members a stronger layer may
  override with literal values or references, and an [`$effect`](#composite-effects), whose listener records are merged
  by namespace.
* A [reference](#references) from a stronger layer which resolves to `undefined` passes over to whatever weaker layers
  supplied at that key, as if it had not been written. A layer may therefore refer to an optional value, e.g.
  `maxCount: "{self}.options.maxCount"`, without displacing a default supplied by a weaker layer. This is reactive: once
  the reference resolves to a value, that value is used. Only `undefined` passes over. A reference which is unavailable,
  e.g. one to a member which does not exist, remains unavailable.
* `null` at a member displaces whatever weaker layers supplied there. At a member holding a
  [`$component`](#removing-a-subcomponent) record, this removes the subcomponent.
* Where several layers supply `$component` records at the same member, the `$layers` named by each are combined, those
  of a stronger record beating those of a weaker one. Within one record, as in a layer's own `$layers`, a layer listed
  later beats one listed earlier.
* A `$component` record naming no `$layers`, stronger than a reference at the same member, does not displace the
  reference: it [refines](#refining-an-injected-component) the component the reference injects there. A record naming
  `$layers` constructs a fresh component at the member, displacing the reference.

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

```js live
fluid.def("my.greeter", {
    $layers: "fluid.component",
    name: "World",
    shout: "{self}.name"           // tracks name
});

const greeter = my.greeter();
console.log(greeter.shout); // "World"
greeter.name = "Infusion";
console.log(greeter.shout); // "Infusion"
```

A reference to a path holding mutable configuration is **sited**: writing through it writes to the original site.

### Literal strings beginning with `{` or `$`

Only the first character of a configuration string is interpreted. A string beginning with `{` is a reference, and
one beginning with `$` is a compact record such as `"$compute:..."`. To write a literal string beginning with either,
escape its first character with a backslash. A string whose first character is a backslash is taken literally, without
that backslash. A backslash anywhere else in a string has no special meaning.

```js live
fluid.def("my.prices", {
    $layers: "fluid.component",
    json: "\\{\"a\": 1}",       // the literal text {"a": 1}
    price: "\\$5.00",           // the literal text $5.00
    share: "\\\\server",         // the literal text \server
    path: "C:\\temp"            // unchanged: the backslash is not the first character
});

const prices = my.prices();
console.log(prices.json, prices.price, prices.share, prices.path); // {"a": 1} $5.00 \server C:\temp
```

The escape applies wherever configuration is interpreted, including arguments and nested material. Values written at
runtime, e.g. `that.text = '{"a": 1}'`, are data, and are never interpreted.

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

```js live
fluid.def("my.toolbar", {$layers: "fluid.component", theme: "light"});

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

const app = my.app();
fluid.cell.stabilize();   // Scope is resolved once the component tree has settled
console.log(app.toolbar.theme); // "dark"
app.theme = "high-contrast";
console.log(app.toolbar.theme); // "high-contrast"
```

### Selectors

A reference whose context is followed by a space and a selector, `{context selector}`, resolves to the live array
of components below `context` which match the selector, as for
[`fluid.liveQueryILSelector`](#fluidlivequeryilselectorroot-selector-flat). With a path, it yields the array of
values at that path in each match.

Selector syntax follows CSS: whitespace-separated steps match descendants, `>` matches direct children, and each step
is a context name (layer name, nickname or member name) or `&name`, or `#id`.

```js syntax
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

```js live
fluid.def("my.rect", {
    $layers: "fluid.component",
    width: 3,
    height: 4,
    area: "$compute:my.multiply({self}.width, {self}.height)"
});
my.multiply = (a, b) => a * b;

const r = my.rect();
console.log(r.area); // 12
r.width = 5;
console.log(r.area); // 20
```

The function may be asynchronous: if it returns a `Promise` or async iterator, e.g. as an `async` or `async*` function
does, the value is pending until the promise settles or the first value is yielded, and is then the value it resolves
to or yields. Computations depending on it are not run with the promise itself - see
[Asynchronous computations](/docs/fluid-signals#asynchronous-computations). No declaration is needed, since this is
discovered from what the function returns.

Members of components read within the function, as well as its arguments, are its dependencies - see the
[component proxy](#creator-functions-layernameuserlayer).

The full form `{$compute: {func, args, equiv}}` accepts:

* `equiv` - A policy for when a recomputation leaves the value morally unchanged, as a function
  `(oldValue, newValue) => Boolean` or the global name of one, e.g. `"fluid.equiv.elementwise"`. The member then keeps
  the value it held, and notifies nothing - see the
  [`equiv` of a cell](/docs/fluid-signals#fluidcellinitialvalue-props).

An argument written as `{$oldValue}` receives the value the computation last produced, or `undefined` if it has
produced none, so that it may build on its own previous result, as a reducer:

```js live
fluid.def("my.history", {
    $layers: "fluid.component",
    current: 0,
    // Every value current has held, most recent last
    seen: "$compute:my.appendValue({$oldValue}, {self}.current)"
});
my.appendValue = (seen, value) => [...seen || [], value];

const history = my.history();
console.log(history.seen); // [0]
history.current = 1;
console.log(history.seen); // [0, 1]
history.current = 2;
console.log(history.seen); // [0, 1, 2]
```

### $transient

State belonging to one instance of a component which takes no part in the reactive graph, e.g. a drag in progress, a
timer, or a handle onto an object outside the tree:

```js syntax
fluid.def("my.dragger", {
    $layers: "fluid.viewComponent",
    drag: {$transient: null},
    autoScroll: {$transient: null, dispose: "clearInterval"}
});

that.drag = {startX: e.clientX};        // No notification, no remerge
that.autoScroll = setInterval(scroll, 50);
```

* Reading it creates no dependency, and writing it notifies nothing. A write is never raised into the
  [live layer](#creator-functions-layernameuserlayer), so it never remerges its component.
* The initial value is copied for each instance, and the value held survives turnover of the component while the
  record is unchanged.
* `dispose` - Optionally, a function, or the global name of one, which receives each value as it is overwritten, and
  the value held when the member is withdrawn or its component destroyed, e.g. `"clearTimeout"` for a timer.

A member is held as transient only at the top level of its component. Since nothing reruns when it changes, reading one among the
arguments of a `$compute` is almost certainly a mistake, and logs a warning.

### $lens

A value which is a view of the value held at another site, its **source**, through a relation whose forward and
backward arcs are written together in one spot. Unlike a `$compute`, a lens may be written - a write to it, or beneath
it, is applied to its source:

```js syntax
range: {
    $lens: {
        source: "{elevationFilter}.filterState",
        forward: "my.toRange({0}, {self}.minRange, {self}.maxRange)",
        backward: "my.toState({0}, {self}.minRange, {self}.maxRange)"
    }
}
```

* `source` - A [reference](#references) to the site viewed.
* `path` - Optionally, the path of the address viewed within the source's value - a String, an Array of segments, or a
  reference resolving to either, e.g. `"{self}.urlKey"`. The lens owns only this address: writes through it leave the
  rest of the source's value as it was.
* `forward` - A compute-style function record computing the lens's value, in whose arguments `{0}` designates the value
  at the lens's address. It is recomputed whenever any of its arguments changes, as for `$compute`.
* `backward` - A method-style function record computing the value for the lens's address from a value written to the
  lens, which it receives as `{0}`. Returning `fluid.deleteMarker` removes the address from the source.

A write to the lens, e.g. `that.range.min = 20` or `that.range = {min: 0, max: 100}`, is applied to the lens's current
value, passed through `backward`, and the result is written at the lens's address within the source's site - following
the fish upstream, as for a write to a [member defined by a reference](#references), so that a source which is itself a
lens, or a reference to a reactive root elsewhere, is written in turn. The lens's value then follows from its source
along `forward`; nothing is held at the lens's own site.

The backward arc is not an edge in the graph of cells, but an **address writer** registered with the lens's component
under the stable key of the lens's site, e.g. `"app.filter:filterState"` - see `fluid.siteWriterOf`. A lens allocated
afresh at the same site replaces it. Each write it makes carries that key as its source marker, so that an effect may
recognise, or decline with `excludeSource`, the writes which arrived through the lens, and it records its last write
for explanation.

```js syntax
// A filter's state held in one entry of a hash shared with other filters
filterState: {
    $lens: {
        source: "{hashManager}.hash",
        path: "{self}.urlKey",
        forward: "my.decode({0})",
        backward: "my.encode({0})"
    }
}
```

A lens may be laid by a stronger layer over a member which a weaker one defines in any other way, including a
`$reactiveRoot` and any links merged alongside it - the lens replaces it. This frees the site which a weaker layer used
to hold state, e.g. a filter's `filterState`, to be supplied from elsewhere, such as the URL.

### $effect

A side effect upon the world outside the component tree, run during stabilization whenever its resolved arguments
change. Effects are allocated only once the component is fully available, are not run while any
argument is unavailable, and are disposed when the component is destroyed or the record is withdrawn from its layers.

* `includeSource`, `excludeSource` (full form only) - restrict notification by update source, as for
  [`fluid.cell.effect`](/docs/fluid-signals#fluidcelleffectfn-staticsources-props). Any member which an effect writes
  is updated with the sources of the change which caused it to run, so that an effect further along can exclude a
  change however many effects it has passed through - see [`Cell.set`](/docs/fluid-signals#cellsetnewvalue-options).
  The source `"self"` matches the changes which the effect's own component originates, e.g. from its template's event
  handlers - see [Source tracking and the DOM](/docs/fluid-view#excluding-self-widgets-that-should-not-hear-their-own-changes).
* `debounce` (full form only) - a delay in milliseconds. The effect runs only once its arguments have rested unchanged
  for this long, with their latest values, rather than on every change - e.g. for writing a search query to the URL as
  the user types. A pending run is cancelled when the effect is disposed. A debounced effect runs outside the reactive
  graph, so `fluid.cell.settle`, and hence a static rendering, does not wait for it.
* `source` (full form only) - a source with which every member the effect writes is marked, e.g. `"self"` for an
  effect which writes back the changes a widget wrapped by its component has reported. An effect of the component
  excluding `"self"` is then not notified of them. As for any writes made by an effect, this holds for members set
  synchronously by its function, not for any set after an `await`.

```js live
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

#### Composite effects

An `$effect` may instead hold an array of **listener records**, each a [function record](#signal-directives) which may
also bear:

* `namespace` - A name for the record, unique within the effect. A record without one, including that of an effect
  written in simple form, has the empty namespace.
* `priority` - Its position relative to the other records: `"before:namespace"`, `"after:namespace"`, `"first"`,
  `"last"` or a number, higher numbers running first. Records without one run in the order supplied, weakest layer first.

The records run as a chain whenever any of their arguments changes. An argument written `{$payload}` receives the
value returned by the previous record, or the value it resolves to if it returned a promise. A record returning
`undefined` passes on the payload it received, and the chain stops at any record returning an unavailable value. The
effect's member holds the final payload, and is pending while the chain runs, so a downstream `$compute` or `$effect`
can depend on the chain having completed. If the arguments change again while a record is awaiting a promise, the
superseded run dispatches no further records.

```js live
fluid.def("my.map", {
    $layers: "fluid.component",
    mapUrl: "maps/region.json",
    ready: {
        $effect: [{
            namespace: "load",
            func: "my.loadMap",            // Async, resolving to the loaded map
            args: "{self}.mapUrl"
        }, {
            namespace: "applyStyle",
            priority: "after:load",
            func: "my.applyStyle",
            args: "{$payload}"
        }]
    },
    report: "$effect:my.reportReady({self}.ready)"   // Runs once the whole chain has completed
});
my.loadMap = url => new Promise(resolve => setTimeout(() => resolve({url, regions: 12}), 200));
my.applyStyle = map => ({...map, styled: true});
my.reportReady = ready => console.log("Ready:", ready);

my.map(); // Ready: {"url": "maps/region.json", "regions": 12, "styled": true} - logged once the map has loaded
```

Effects supplied by several layers at the same member are **merged by namespace** rather than the stronger replacing
the weaker. A stronger record displaces a weaker record of the same namespace in place, and a record with a new
namespace joins the chain at the position given by its `priority`:

```js syntax
fluid.def("my.patternedMap", {
    $layers: "my.map",
    ready: {
        $effect: [{
            namespace: "loadPatterns",
            priority: "before:applyStyle",
            func: "my.loadPatterns",
            args: "{$payload}"
        }]
    }
});
```

A simple effect counts as a single record with the empty namespace, so a stronger simple effect replaces a weaker one
whole, and composite records accumulate alongside it. If the merge leaves just one record which was written in simple
form, the effect behaves exactly as a simple effect. These composite effects replace the namespaced listeners and
transforming promise events (`fireTransformEvent`) of earlier Infusion versions - see
[FLUID-7028](https://github.com/fluid-project/infusion-6/issues/28).

### $method

A function member invocable on the component. Arguments are resolved at call time. `$method` does not produce a signal
(other than to the extent that every Infusion value is a signal) like `$compute` and `$effect` but has a similar syntax,
including a short form variant.

* **Without `args`**: the function is called with the component followed by the caller's arguments: `func(that, ...args)`.
* **With `args`**: the call's positional arguments are available as contexts `{0}`, `{1}`, ... An optional `:label`
  suffix on a reference documents it and is otherwise ignored. A positional argument not supplied is `undefined`.

A method is an action rather than a computation. Values its function reads are consulted, and never become dependencies
of a `$compute` or `$effect` which calls it. An effect may therefore call a method which updates the values it reads,
such as one appending to a history, without rerunning itself:

```js syntax
commit: "$method:my.commit({self}, {0}:text)",   // reads and writes {self}.history and {self}.text
commitValid: {
    $effect: {
        func: (self, text) => self.commit(text),
        args: ["{self}", "{self}.validText"]     // reruns only when validText changes
    }
}
```

```js live
fluid.def("my.taxa", {
    $layers: "fluid.component",
    entries: ["Vicia hirsuta", "Stellaria graminea"],
    lookup: "$method:my.lookup({self}.entries, {0}:query, {1}:max)",
    describe: "$method:my.describe"
});
my.lookup = (entries, query, max) => entries.filter(e => e.includes(query)).slice(0, max);
my.describe = (that, prefix) => prefix + that.entries.length;

console.log(my.taxa().lookup("Vicia", 1)); // ["Vicia hirsuta"]
console.log(my.taxa().describe("Count: ")); // "Count: 2"
```

## Other directives


### $component

Declares a subcomponent at this member. The record body is a layer merged at `subcomponent` precedence and must
name `$layers` - unless it is stronger than another record at the member which names them, onto whose subcomponent it
accumulates, or than a reference injecting a component there, which it [refines](#refining-an-injected-component).
The subcomponent lives as long as the record is present in its parent's merged layers: removing or changing the record
destroys or reconfigures it.

```js live
fluid.def("my.header", {$layers: "fluid.component", text: ""});

fluid.def("my.inbox", {
    $layers: "fluid.component",
    title: "Inbox",
    header: {
        $component: {
            $layers: "my.header",
            text: "{inbox}.title"
        }
    }
});

const inbox = my.inbox();
fluid.cell.stabilize();
console.log(inbox.header.text);   // "Inbox"
```

#### Injecting an existing component

A top-level member may instead hold a [reference](#references) to a component which exists elsewhere in the tree. While
the reference resolves to a component, that component is **injected** at the member. It can be reached through the
member, and its siblings see it in scope under the names it would have had if it had been created there: the
injecting member name, plus its layer names and their nicknames. Its member name at its original site is not
carried over. It is not moved or copied, and keeps its original path and lifetime. The injection is withdrawn if the
reference stops resolving to a component, if a stronger layer overrides the reference, or if the component is
destroyed.

```js live
fluid.def("my.library", {$layers: "fluid.component"});
fluid.def("my.catalogue", {$layers: "fluid.component", entries: ["Vicia hirsuta", "Stellaria graminea"]});
fluid.def("my.searchBox", {$layers: "fluid.component", entries: []});

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

const workspace = my.workspace();
fluid.cell.stabilize();
console.log(workspace.current === workspace.library.items); // true
console.log(workspace.searchBox.entries); // ["Vicia hirsuta", "Stellaria graminea"]
```

`workspace.current` is the same component as `workspace.library.items`. Within `searchBox` it resolves as `{current}`,
`{catalogue}` or `{my.catalogue}`, but not as `{items}`. A stronger layer may override a `$component` record with a
reference at the same member, or the other way round with a record naming its `$layers` - a record naming none instead
[refines](#refining-an-injected-component) the component injected. A reference to the component itself (`{self}`) is never
injected, and a reference which turns out to designate plain data rather than a component simply yields that value.
Injecting another component's [view](/docs/fluid-view#views) lets one component render through another's view.

#### Refining an injected component

Anything done at an injected member is done to the component injected there: a read of the member reads it, and a
write through the member writes it. Merging is no exception. A `$component` record naming no `$layers`, written at a
member by a layer stronger than the reference injecting a component there, **refines** that component - its options
are merged into the injected component, just as options naming no `$layers` accumulate onto a subcomponent declared
by a weaker layer. So options addressed to a member mean the same whether the component there was constructed there or
injected.

The usual case is a component which borrows the view of one of its subcomponents, and is supplied, as any component
is, with a container for its view:

```js live
fluid.def("my.widget", {
    $layers: "fluid.component",
    view: {
        $component: {
            $layers: "fluid.templateViewComponent",
            template: "<p>Rendered by the umbrella's first widget</p>"
        }
    }
});

fluid.def("my.umbrella", {
    $layers: "fluid.component",
    first: {
        $component: {
            $layers: "my.widget"
        }
    },
    // The umbrella renders through its subcomponent's view
    view: "{first}.view"
});

const umbrella = my.umbrella({container});
fluid.cell.stabilize();
console.log(umbrella.view === umbrella.first.view);   // true - the container refined the borrowed view, rather than displacing it
```

(A creator function forwards its `container` argument to `view: {$component: {container}}` - which, at a member
injecting a view, refines it.)

* **Where the refinement stands.** A refinement is merged into the injected component as a `distribution` - stronger
  than the component's own layers, the record which created it and the arguments it was created with, and weaker than
  material contributed by its template, its dynamic layers and live writes to it. Its layer map names it, e.g.
  `distribution from umbrella-4.view`.
* **One component, wherever it is seen.** The component injected is the same one at every site at which it appears,
  and at its own: a refinement written at one member is seen through all of them. A refinement may reach a component
  anywhere in the tree, e.g. through a global reference.
* **Several refinements** of the same component, from members at different paths, are merged in the order of those
  paths - that of the later path being the stronger.
* **References within a refinement** resolve as they would at the member where the refinement was written, not from
  the component refined, whose scope may hold none of their contexts, or others of the same names. `{self}` within the
  record designates the component refined, as it does within any `$component` record.
* **Withdrawal.** A refinement lasts as long as the injection: when the reference designates another component, stops
  resolving to one, is overridden, or its component is destroyed, the refinement is withdrawn and the component it
  refined remerges without it.
* **Plain data.** A refinement of a reference which designates plain data rather than a component leaves the member
  unavailable - write the record with `$layers` to construct a fresh component there instead.
* **Transmission.** In [PTF](/docs/fluid-ptf) a refinement is transmitted where it was written, in the potentia of the
  component holding the injecting member, and refines the injected component again as that component is reconstructed.

#### Removing a subcomponent

A stronger layer may remove a subcomponent which a weaker one declared by writing `null`, or `{$component: null}`, at its
member. The subcomponent is destroyed, and the records of all weaker layers at the member are discarded, so a still
stronger layer restoring the member must supply a complete record, including its `$layers`:

```js live
fluid.def("my.header", {$layers: "fluid.component", text: ""});
fluid.def("my.compactHeader", {$layers: "my.header", compact: true});

fluid.def("my.page", {
    $layers: "fluid.component",
    header: {
        $component: {
            $layers: "my.header"
        }
    }
});

fluid.def("my.bareSection", {
    header: null
});

fluid.def("my.headedSection", {
    header: {
        $component: {
            $layers: "my.compactHeader"
        }
    }
});

fluid.def("my.barePage", {$layers: ["my.page", "my.bareSection"]});
fluid.def("my.reheadedPage", {$layers: ["my.page", "my.bareSection", "my.headedSection"]});
const bare = my.barePage(), reheaded = my.reheadedPage();
fluid.cell.stabilize();
console.log(bare.header); // null - the header is removed
console.log(reheaded.header.compact); // true - restored by a complete record
```

If the subcomponent rendered into an element bearing `@id` in its parent's template, that element is omitted while the
member is removed - see [Subcomponents](/docs/fluid-view#subcomponents-id).

### $for

Within a `$component` record, instantiates one subcomponent per element of a collection, kept in step with it. The
member then holds a `fluid.componentList` whose `list` holds the instances.

* `source` - Reference to an array or object
* `valueAs` - Name under which each collection element is visible in its corresponding subcomponent (via `{self}.<valueAs>`). When the
  source is sited, this is a live reference to the element and can be written through.
* `keyAs` - Name under which the collection element's index or key is visible in its subcomponent
* `positionAs` - Name under which the subcomponent sees its position in the list, as `{index, first, last}`: its index
  from 0, and whether it is the first or the last member. Unlike `keyAs`, this is numeric for a keyed collection too, so
  `@if="!position.first"` can render a separator before every member but the first - see
  [Separators](/docs/fluid-view#separators-between-list-members)
* `layerAs` - Name of a layer, holding each collection element, which is merged into its subcomponent as configuration -
  see [Configuring members from data](#configuring-members-from-data)

```js live
fluid.def("my.editor", {$layers: "fluid.component", label: ""});
my.label = (index, name) => (index + 1) + ": " + name;

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
fluid.cell.stabilize();
console.log(h.editors.list.length); // 2
console.log(h.editors.list.map(editor => editor.label)); // ["1: alpha", "2: beta"]
```

**Keyed collections.** When the source is an object, one subcomponent is created per entry, in the order of the merged
object's keys, except that an entry holding a `priority` member is placed by it, as for the listener records of a
[composite effect](#composite-effects): a number (higher numbers first), `"first"`, `"last"`, or `"before:key"` or
`"after:key"` naming another entry. An entry whose value is `null` is skipped. Since an object source merges key by key, layers may
therefore contribute, reorder and remove entries independently:

```js live
fluid.def("my.stylesheetLink", {$layers: "fluid.component"});

fluid.def("my.styledPage", {
    $layers: "fluid.component",
    stylesheets: {
        main: {href: "main.css"},
        print: {priority: "after:main", href: "print.css"}
    },
    links: {
        $component: {
            $layers: "my.stylesheetLink",
            $for: {source: "{styledPage}.stylesheets", valueAs: "sheet", keyAs: "key"}
        }
    }
});

fluid.def("my.mathsPage", {
    $layers: "my.styledPage",
    stylesheets: {
        katex: {priority: "before:main", href: "katex.css"},
        print: null                    // No print stylesheet for this page
    }
});

const page = my.mathsPage();
fluid.cell.stabilize();
console.log(page.links.list.map(link => link.key + ": " + link.sheet.href)); // ["katex: katex.css", "main: main.css"]
```

<a id="configuring-members-from-data"></a>**Configuring members from data.** Material reached through `valueAs` is data.
It is final, and is never expanded: a reference within it stays a string, and a `$component` record within it stays a
plain object. When each element instead holds configuration for its member, e.g. records describing panes written into
a page by a build, name a layer with `layerAs`. Each element is then merged into its member at `forLayer` precedence,
above the `$component` record and the member's own layers:

* The element is expanded in the member's context, as any layer is. References within it resolve, and `$component`
  and signal records within it are instantiated.
* Any `$layers` in the element are added to the member's own.
* The member keeps any value from its own layers which the element omits, and merges plain objects key by key.
* When an element changes, its member is re-merged.

Each element must be a plain object.

```js live
fluid.def("my.obsPaneHandler", {$layers: "fluid.component", title: "Observations"});
fluid.def("my.choroplethSlider", {$layers: "fluid.component", obsRows: []});

fluid.def("my.paneHandler", {
    $layers: "fluid.component",
    maxObsCount: 100
});

fluid.def("my.storyPage", {
    $layers: "fluid.component",
    obsRows: [],
    paneRecords: [{
        $layers: "my.obsPaneHandler",
        maxObsCount: 5273,
        widgets: {
            speciesPlot: {
                $component: {
                    $layers: "my.choroplethSlider",
                    obsRows: "{storyPage}.obsRows"    // Resolved in the widget's own context
                }
            }
        }
    }, {
        title: "Status"                              // Gets maxObsCount 100 from my.paneHandler
    }],
    panes: {
        $component: {
            $layers: "my.paneHandler",
            $for: {source: "{storyPage}.paneRecords", layerAs: "paneRecord"}
        }
    }
});

const story = my.storyPage({obsRows: [{taxon: "Vicia hirsuta"}]});
fluid.cell.stabilize();
console.log(story.panes.list.map(pane => pane.title + ": " + pane.maxObsCount)); // ["Observations: 5273", "Status: 100"]
console.log(story.panes.list[0].widgets.speciesPlot.obsRows); // [{"taxon": "Vicia hirsuta"}]
```

**Writing through iteration variables.** When the source is sited, each `valueAs` variable keeps track of where its
data came from, so the subcomponent can change its own element without involving the component that owns the
list:

* A write beneath the variable, e.g. `self.todo.completed = true`, is applied to the original element of the source.
* `delete self.todo` removes the element from the source, as does [`destroy()`](#componentdestroy) on the subcomponent.
* Writing to the variable itself, e.g. `self.todo = {...}`, replaces the original element of the source.

This holds across intermediate projections. Elements selected by a non-mutating array method such as `filter()`
remain linked to their original source:

```js live
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

const list = my.todoList();
list.todos.push({text: "Sow seeds", completed: false}, {text: "Water plants", completed: false});
fluid.cell.stabilize();
console.log(list.openItems.list.length); // 2
list.openItems.list[0].toggle();
fluid.cell.stabilize();
console.log(list.todos[0].completed, list.openItems.list.length); // true 1
```
### $if

Within a `$component` record, a condition whose truthiness controls whether the subcomponent exists. In its short
form this is a reference:

```js live
fluid.def("my.assignee", {$layers: "fluid.component", name: "Unassigned"});

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

const task = my.task();
console.log(fluid.isUnavailable(task.assignee)); // true - no assignee exists
task.assigned = true;
fluid.cell.stabilize();
console.log(task.assignee.name); // "Unassigned" - the assignee has been created
```

In its long form it is a [function record](#signal-directives), as for `$compute`, and the truthiness of the computed
value is tested. This avoids a separate boolean member for conditions where a value such as `0` or `""` should still
count:

```js syntax
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

```js live
fluid.def("my.checklist", {
    $layers: "fluid.component",
    todos: {$reactiveRoot: [{text: "Write docs", done: false}]},
    remaining: "$compute:my.countRemaining({self}.todos)"
});
my.countRemaining = todos => todos.filter(t => !t.done).length;

const t = my.checklist();
t.todos[0].done = true;   // Immutable update of todos
console.log(t.remaining); // 0
```

A layer deriving from another may wire a single member of its reactive state to a value elsewhere, leaving the rest of
the root as it was:

```js live
fluid.def("my.textFinder", {$layers: "fluid.component", foundText: "Vicia"});

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

const panel = my.linkedSearchPanel();
fluid.cell.stabilize();
console.log(panel.state.query, panel.state.results.length); // Vicia 0
panel.finder.foundText = "Stellaria";
fluid.cell.stabilize();
console.log(panel.state.query); // Stellaria
```

### $importMap

`{Object<String, String>}` - Maps layer names to module paths (`.js`, or `.vue` single-file components) from which
their definitions are loaded on demand. This demand occurs when a component derived from the layer name begins to
instantiate. While loading, dependent components are unavailable with pending status.

```js syntax
fluid.def("my.chartApp", {
    $layers: "fluid.component",
    $importMap: {"my.chartApp.chart": "%my-app/src/chart.vue"}
});
```

### $linkage

Registers a rule, for as long as the containing component exists, that any component bearing all layer names of `inputLayers`
also acquires `outputLayers`. Allows a layer to be adapted to a context its author did not anticipate. Accepts a
single linkage or an array.

```js live
fluid.def("my.table", {$layers: "fluid.component", background: "white"});
fluid.def("my.darkTheme", {$layers: "fluid.component"});
fluid.def("my.darkTable", {background: "black"});

fluid.def("my.plugin", {
    $layers: "fluid.component",
    darkTables: {
        $linkage: {
            inputLayers: ["my.table", "my.darkTheme"],
            outputLayers: ["my.darkTable"]
        }
    },
    plainTable: {
        $component: {
            $layers: "my.table"
        }
    },
    themedTable: {
        $component: {
            $layers: ["my.table", "my.darkTheme"]
        }
    }
});

const plugin = my.plugin();
fluid.cell.stabilize();
console.log(plugin.plainTable.background, plugin.themedTable.background); // white black
```

Each entry of a linkage may also bear:

* `$if` - A condition, as for [`$if`](#if) on a subcomponent, applying the linkage only while it holds.
* `selector` - In place of `inputLayers`, an [IL selector](#selectors) which a component must match, so that a linkage
  can depend on a component's ancestors as well as its own layers. For example
  `"my.post > my.header"` matches a component bearing `my.header` whose parent bears `my.post`.
* `scope` - A reference to a component, e.g. `"{self}"`, confining the linkage to components at or below it.

```js syntax
fluid.def("my.site", {
    $layers: "fluid.component",
    headerLinkage: {
        $linkage: [{
            selector: "my.type.post > my.header",
            outputLayers: "my.header.post",
            scope: "{self}",
            $if: "{self}.adaptHeaders"
        }]
    }
});
```

The linkage reacts to changes in a component's layers and those of its ancestors: a header acquires `my.header.post`
as soon as its parent acquires `my.type.post`, for example through a dynamic layer, and loses it again when the parent
loses it.

The linkage rule's effect lasts as long as the component holding it. Linkages are sometimes called
[co-occurrences](https://hal.science/hal-01854418/file/AnAnatomyOfInteraction_authorversion.pdf).  

### $bindable

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

```js live
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
// Stand-ins for a real socket's opening and closing
my.openSocket = url => {
    console.log("Open " + url);
    return {url};
};
my.closeSocket = socket => console.log("Close " + socket.url);

const holder = my.socketHolder();
fluid.cell.stabilize();                       // Open wss://example.org/feed
holder.url = "wss://example.org/other";       // Close wss://example.org/feed, Open wss://example.org/other
fluid.cell.stabilize();
holder.destroy();                             // Close wss://example.org/other
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

```js live
fluid.def("my.app.editor", {$layers: "fluid.component"});
fluid.def("my.editorApp", {
    $layers: "fluid.component",
    names: {$reactiveRoot: ["notes"]},
    editors: {
        $component: {
            $layers: "my.app.editor",
            $for: {source: "{editorApp}.names", valueAs: "name"}
        }
    }
});

const app = my.editorApp();
fluid.cell.stabilize();
const editors = fluid.liveQueryILSelector(app, "my.app.editor");
fluid.cell.effect(list => console.log(list.length + " editors"), [editors]); // 1 editors
app.names.push("draft");
fluid.cell.stabilize();                                                      // 2 editors
```

In most cases, the same result should be achieved declaratively via a [selector reference](#selectors) `"{self my.app.editor}"`,
subject to current framework limitations.

### fluid.queryILSelector(root, selector, [flat])

As `fluid.liveQueryILSelector`, but returns a one-off array. It may be searched from the root of the tree. Each
unavailable component matched is returned wrapped as an unavailable component proxy, which reads as an
[unavailable component](#unavailable-components) does.

### fluid.layerForMember(component, path)

* `{Component} component` - The component
* `{String|String[]} path` - The path of the member, which may pass through subcomponents, e.g. `"checklist.renderTooltip"`
* Returns: `{String|undefined}` - The name of the layer supplying the member's value, or `undefined` if none does, e.g.
  if it was written at run time

Finds the strongest of the component's layers writing the member, or the layer of the parent configuring it onto the
subcomponent - e.g. to diagnose why a layer's definition of a member is overridden. A component's own definition is
stronger than every layer it names in its `$layers`.

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
* `fluid.unwrapProxy(value)` - The plain value underlying a component or mat proxy. Reads through it are not tracked
  as dependencies, which may also pay off in performance-critical loops
* `fluid.hasLayer(that, layerName)` - `true` if `layerName` is in the component's resolved `$layers`
* `fluid.definedLayers(...candidates)` - Those of the candidate layer names (strings or arrays of them) which are
  defined, in the order supplied. Since a later layer is stronger, list the most specific candidate last
* `fluid.firstDefinedLayer(...candidates)` - An array holding just the first of the candidates which is defined, in
  order of preference, or an empty array if none is

The layer store records who demanded each such layer - the layer naming it in its `$layers` and the path of the component waiting for it:

* `fluid.undefinedLayers()` returns a record `{layerName, requiredBy, componentPaths, imported, message}` for each. The
  message says whether an import was registered under the layer's name and its file failed to define it, or else
  that nothing supplies it - recalling that an SFC imported by `<fluid-import>` is loaded only when the layer named
  after its file, e.g. `foo-barBaz.vue` for `foo.barBaz`, is demanded.
* `fluid.reportUndefinedLayers()` logs each new such message at `FAIL` level. A booted document runs it whenever the
  cell graph falls idle, so a mistyped layer name is reported without being asked for.

[^1]: From components designated by ordinary user configuration - under the covers, components with unavailable 
constituents actually continue to evaluate and elaborate as normal, routing around the individual unavailable
values until they resolve. Inspector tools can use the Infusion JavaScript API to expose this process.
