---
title: Fluid Signals API
category: Infusion
type: infusion-docs
---

<link href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css" rel="stylesheet" crossorigin="anonymous">
<script src="/js/fluid-code-box.js"></script>
<link rel="stylesheet" href="/css/fluid-code-box.css" />

This page documents the API of `fluid.cell`, the primitive of the reactive library underlying Fluid Infusion 6.
You can read [background information](/docs/fluid-signals-background) on how `fluid.cell` offers extra capabilities
above traditional reactive libraries, and also a more
[extended essay](/post/2026-02-20-reactivity-for-malleability) explaining its goals in the context of a malleable substrate.

The raw markdown underlying these docs is available on [GitHub](https://raw.githubusercontent.com/amb26/ponder/refs/heads/main/content/docs/fluid-signals.md),
suitable for direct ingestion by your friendly local neighbourhood intelligence.

## Construction

### fluid.cell(initialValue, props)

* `{Any} [initialValue]` - The initial value to store in the cell
* `{Object} [props]` - Optional additional properties to contextualise the cell
* Returns: `{Cell}` - The freshly constructed cell

A fresh reactive cell is constructed, with an optional initial value and optional additional properties.

If the initial value is `undefined`, this will be upgraded to an [unavailable](#unavailable-values) value marking
the signal's value as uninitialised.

The only currently supported property in `props` is 

* `{String} name` - Supplies a name or address for this cell

## Reading and writing

### Cell.get()

The value of a reactive cell can be read by calling `Cell.get`. This forces the reactive tree of computations
behind the cell to bring its value up to date. A call to `Cell.get` of some cell within the reactive context of a `computed`
function (that is, further up its call stack) will set up an automatic subscription of the function to updates of that cell, rerunning the function whenever the value
changes. If a further invocation of the `computed` does not execute `Cell.get` for that cell, the dynamic subscription
will be torn down.

To read a cell within a computation without subscribing to it, read it within
[`fluid.cell.untracked`](#fluidcelluntrackedfn).

### Cell.set(newValue, [source])

* `{any} newValue` The new value to which the cell is to be updated
* `{String} [source]` An optional source tag name to be applied to this update as is propagates.

The reactive cell's value can be updated by calling `Cell.set`. This will trigger a cascade of updates through the
reactive tree. Any computed values that are depended on by effects will be marked to execute when 
[`fluid.cell.stabilize`](#fluidcellstabilize) is next called. Computed values that are not depended on by effects will
only be updated if `Cell.get` is called for a cell which depends on them.

Optionally, at the time of calling `Cell.set`, the reactive update can be marked with a `source`, which encodes the
identity of the source in the world triggering the change. A source is usually a string, but may be any value compared
by identity, e.g. the self source of a component returned by
[`fluid.selfSource`](/docs/fluid-view#excluding-self-widgets-that-should-not-hear-their-own-changes). An effect marked
with a matching source in its `excludeSource` will skip notification. This scheme allows the reactive graph to avoid cyclically propagating changes
back to the same source which triggered them. The second example after [`fluid.effect`](#fluidcelleffectfn-staticsources-props) shows
this source tracking facility in action.

A source travels with the update through every computed value which depends on the cell, and also through effects. Any
cell which an effect sets whilst it runs is updated with the sources of the change which caused the effect to run, as
well as any source of its own. A change caused by a source therefore remains marked with it however many effects it
passes through - see [FLUID-5498](https://issues.fluidproject.org/browse/FLUID-5498). It is also carried across an
[asynchronous computation](#asynchronous-computations). Its eventual value, once it settles, reaches its dependents
still marked with the sources of the change which started it. Within an effect, this holds only for cells set
synchronously by the effect's function, not for any set later, e.g. after an `await`.

Each fresh change to a cell from outside the reactive graph carries only its own sources. The sources of an earlier change
don't linger on the cell, even while an asynchronous effect that the earlier change triggered is still pending.

Sources can also be applied to every cell set within a function by wrapping it with
`fluid.cell.withAmbientSource(source, fn)`, where `source` is a source or an array of them. This returns a function
suitable for use as an event listener. Calls may be nested, and a cell set within them carries the sources of each.

### Cell._value

A "blind read" of the current value of the cell, regardless of how stale it is, can be made by looking at the `_value`
property. This isn't recommended except in specialised cases, usually of framework-building.

## Relations and effects

### Cell.computed(fn, staticSources, props)

* `{Function | null} fn` - The function which will reactively evaluate this cell's value, or `null` if an existing relation is to be torn down
* `{Cell[]} [staticSources]` - Any statically known cell dependencies whose reactively evaluated arguments will be supplied to `fn` when it is called
* `{ComputedProps} [props]` - Optional additional properties to contextualise the computation
* Returns: `{Cell}` - This cell

`computed` is available as a function in the prototype of cells created via `fluid.cell`.

`Cell.computed` constructs or tears down a computed relationship between a target cell (`this` one) and one or more source cells
accepted by the supplied function `fn`. The function will be invoked when the pull of a reactive value via `Cell.get`
or an effect demands the value of the target cell and the values of one or more of the source cells have changed. The
function will be invoked with arguments formed by evaluating the values of the source cells supplied in `staticSources`.

As well as the source cells supplied in `staticSources`, any other cells that the
function references as it executes will also be tracked and schedule a reinvocation
of the function, following the standard tracking semantics of commodity signals implementations.

If any of the source cells evaluates to an [unavailable value](#unavailable-values), invocation of `fn` will be
short-circuited and upstream cells will receive a corresponding, perhaps wrapped, unavailable value directly.

The first `staticSource` cell, if there is one, will have a special status of establishing the *key* of the relationship
which will be unique in the context of the target cell. If there is no such cell, a `null` value will serve as the key.
If an existing relation is present on the target cell with the same key, it will be replaced by the supplied one.

If `null` is supplied in place of the `fn` argument, any existing relation with the same key will be torn down.

The additional `ComputedProps` argument can contain the following fields:

`{Object} ComputedProps`:
* `{Boolean} isFree` - Indicates if this is a "free" computation that will deliver unavailable values.

Here is a basic example setting up two cells connected by a simple computation:

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.1.0/dist/FluidCell.mjs"

const A = fluid.cell(1);

const B = fluid.cell().computed(a => a + 1, [A]);

console.log("B's value computed to ", B.get()); // Outputs 2
</textarea>

For a more advanced example setting up and tearing down bidirectional relationships, you can see the
visual test sample for [Bidirectional temperature conversion](https://ponder.org.uk/post/2026-02-20-reactivity-for-malleability/?selectedTest=bidirectional_tests_-_temperature_conversion_with_two_nodes)
in the extended essay.

### Asynchronous computations

A computation set up by [`Cell.computed`](#cellcomputedfn-staticsources-props) may be asynchronous. If its function
returns, rather than a plain value, either:

* A `Promise` representing a deferred value or error, or
* An `AsyncIterator`, e.g. as returned by an
[async generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*) function,
representing a bounded or unbounded sequence of deferred values,

the cell holds a [pending](#fluidpendingstalevalue-site) value until the promise settles, or until the first value is
yielded, and then the value it resolves to or yields. A promise which rejects leaves the cell holding an
[unavailable value](#unavailable-values) reporting the error. Computations which depend on the cell are not run with the
promise, but once its value is available.

Whether a computation is asynchronous is discovered from what its function returns, and so no declaration is needed -
an `async` function, and a plain function which returns a promise, are treated alike. Once a computation has returned a
promise or async iterator, its cell is marked pending from the outset of each later run.

Here's an example receiving a result through an asynchronous computation. Rather than manually waiting for event turns
as here, asynchronous results are more conveniently received through [fluid.cell.signalToPromise](#fluidcellsignaltopromisevalsignal), see below.

<textarea class="fluid-code-box" rows="13">
import fluid from "https://unpkg.com/infusion-6@6.1.0/dist/FluidCell.mjs"

const A = fluid.cell(1);

const B = fluid.cell().computed(a =>
    new Promise(resolve => setTimeout(() => resolve(a + 1), 0)), [A]);

B.get(); // Trigger fetch of B - returns unavailable value

await new Promise(resolve => setTimeout(() => resolve(), 0)); // Wait for async propagation

console.log("B's value computed to ", B.get()); // Outputs B's value computed to 2
</textarea>

### fluid.cell.effect(fn, [staticSources], [props])

* `{Function} fn` - The function to execute reactively when any of the staticSources change
* `{Cell[]} staticSources` - The array of source cells whose values are dependencies for the effect
* `{Object}   [props]` - Optional properties to configure the effect
* `{Function} [props.onDispose]` - Optional cleanup function to run when the effect is disposed
* `{Boolean}  [props.isFree]` - If true, the effect will run even if some sources are unavailable, delivering unavailable values in their place.
* `{any}      [props.excludeSource]` - If this optional field is populated, a change triggered by `Cell.set` whose source (supplied as 
 the `source` argument there) matches this value will skip notifying this effect.
* `{any}      [props.includeSource]` - If this optional field is populated, only a change whose source matches this value
 will notify this effect.

* Returns: `{Effect}`

`fluid.cell.effect` accepts a function and arguments to run when one or more reactive values change. The signature
is similar to `Cell.compute` only an effect's `fn` is expected to have some side-effect upon the world,
such as printing a value or writing to a database, rather than computing a value internal to the reactive graph.
Values returned from `fn` are ignored.

Effects do not activate automatically. Every effect cell is specially marked to be activated by `fluid.cell.stabilize`
which will then pull reactive values through the graph and activate their `fn` if any of their reactive arguments have changed
as a result. 

Similarly to `Cell.compute`, if any cells referenced in `staticSources` or
in dynamically tracked reactive values resolve to an [unavailable value](#unavailable-values), and the effect is not
marked as `isFree`, notification of the function is skipped.

In order to deactivate the effect it needs to be explicitly disposed by calling the
`Effect.dispose()` method on the returned `Effect`. An effect represents a resource in the world outside the reactive graph and as such may require special actions
when it is torn down. The optional `props` argument accepts a callback `onDispose` which is called when the effect
is disposed via `Effect.dispose()`.

This simple example follows the pattern of previous examples, but actively pulls updates to B using an effect
rather than manually pulling them via `get()`:

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.1.0/dist/FluidCell.mjs"

const A = fluid.cell(1);

const B = fluid.cell().computed(a => a + 1, [A]);

const Blogger = fluid.cell.effect(b =>
    console.log("B's value computed to ", b), [B]);

fluid.cell.stabilize(); // Outputs B's value computed to 2

A.set(2);

fluid.cell.stabilize() // Outputs B's value computed to 3

Blogger.dispose();
</textarea>

This example shows `fluid.cell`'s ___source tracking___ facility. If a source of changes is tagged by using the 
`source` argument to [`Cell.set`](#cellsetnewvalue-source), changes due to this source can skip notifying an effect with a matching
`excludeSource` argument. This can be helpful when interfacing with external systems which should not be
notified of changes that they themselves have caused:

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.1.0/dist/FluidCell.mjs"

const A = fluid.cell();
const B = fluid.cell().computed(a => a + 1, [A]);
const Blog = [];

const Beff = fluid.cell.effect(b =>
    console.log("B's value computed to ", b), [B],
    {excludeSource: "scrollbar"});

A.set(2);

fluid.cell.stabilize(); // Outputs B's value computed to 3

A.set(3, {source: "scrollbar"});

fluid.cell.stabilize(); // No notification: B excludes scrollbar source
</textarea>

### fluid.cell.stabilize()

`fluid.cell.stabilize` will run all effects whose reactive arguments have changed, after pulling updates through the reactive graph.
Example code is in the section on [`effects`](#fluidcelleffectfn-staticsources-props).

Unlike in many reactive frameworks, effects do not run eagerly or synchronously --- this choice is motivated in
the [deferred stabilization](/wip/2026-05-25-towards-deferred-stabilisation/) posting.

### fluid.cell.stabilizeAsync()

A helpful utility layered on top of `fluid.cell.stabilize` which as well as scheduling any effects, will also return
a promise which may be `await`ed, to be notified when any asynchronous computations launched by the stabilization
operation have successfully notified the effects which depend on them.

## Comprehension

### fluid.cell.findCause([cell])

* `{Cell} cell` If supplied, the cell whose update cause should be reported. If absent, any current
  reaction will be used instead.
* Returns: `{Cell[]}`

Reports the cause of any reaction which has updated a given cell, or else the one that is currently
in progress, in the form of an array of nodes reaching back from the supplied cell to the one whose modification
triggered the reaction. The triggering cell appears first in the array.

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.1.0/dist/FluidCell.mjs"

const A = fluid.cell(1, {name: "A"});

const B = fluid.cell(undefined, {name: "B"}).computed(a => a + 1, [A]);

const Blogger = fluid.cell.effect(b => {
    const cause = fluid.cell.findCause();
    console.log("Causes of this update were ",
        cause.map(cause => cause.name).join(", "));
}, [B], {name: "Blogger"});

fluid.cell.stabilize(); // Outputs "Blogger"

A.set(2);

fluid.cell.stabilize(); // Outputs "Blogger, B, A"

Blogger.dispose();
</textarea>

## Utilities

### fluid.cell.signalToPromise(valSignal)
* `{Cell<any>} valSignal` - The signal to monitor.
* Returns: `Promise<any>` - A Promise that resolves with the signal's first available value.

Gear from the world of signals into a Promise that can be `await`ed.

The [asynchronous computation](#asynchronous-computations) example from above is more conveniently written:

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.1.0/dist/FluidCell.mjs";

const A = fluid.cell(1);

const B = fluid.cell().computed(a =>
    new Promise(resolve => setTimeout(() => resolve(a + 1), 0)), [A]);

console.log("B's value computed to ",
    await (fluid.cell.signalToPromise(B))); // Outputs B's value computed to 2
</textarea>

### Cell.refresh(staticSources)

* `{Cell[]} [staticSources]` - An optional array of static source cells to identify the computation edge to be refreshed
* `this: {Cell}` The cell for which an incoming edge is to be refreshed

A method available on any `Cell`: Refreshes the value of the cell by re-evaluating its computation for the specified static sources.
Finds the incoming edge corresponding to the given static sources and triggers an update for this cell along that edge. Particularly
useful when the value is computed via an asynchronous activity in the world --- if the edge is async, the cell's value
will be set to stale and the asynchronous activity will be restarted.

### fluid.cell.untracked(fn)

* `{Function} fn` - The function to execute without tracking
* Returns: `{any}` - The value returned by `fn`

Executes a function, within a computation or effect, without subscribing the computation to any cell which the function
reads. This suits a value which is consulted rather than depended upon. For example, an effect which closes a popup on
a press outside it should read whether the popup is open, but should not rerun when it is opened, since opening it is no
reason to look again at a press made before it was opened:

```js
fluid.cell.effect(press => {
    if (press && fluid.cell.untracked(() => popupOpen.get()) && !popup.contains(press.target)) {
        popupOpen.set(false);
    }
}, [lastPress]);
```

`untracked` is needed whenever an effect reads a value which it also writes, for example an effect which appends to a
history:

```js
fluid.cell.effect(text => fluid.cell.untracked(() => {
    history.set([...history.get(), current.get()]);
    current.set(text);
}), [validText]);
```

Without it, the effect depends on `history`, so each write reruns it, and it would append forever. An effect which keeps
triggering itself like this is stopped after `fluid.cell.maxEffectRuns` (100) runs within one stabilization, and is
reported, naming the effect, through `fluid.cell.reportCycle`, which logs to `console.error`. In the Integration Language
this is rarely needed, since a [`$method`](/docs/fluid-integration-language#method) runs untracked - an effect which
updates such values by calling a method needs no `untracked` of its own.

## Unavailable values

Some background on unavailable values is available on their [own page](/term/unavailable-value). An unavailable
value held at a cell represents a value which is either uninitialised, pending due to outstanding I/O, or an error.

Unavailable values can be received by [`effect`](#fluidcelleffectfn-staticsources-props)s by marking them with the `isFree` property --- otherwise, they
only receive fully settled, concrete values.

An unavailable value is created using the `fluid.unavailable` API, which in the simplest usage simply accepts a
string holding a message explaining why the value is unavailable. These values are normally created by frameworks
rather than users.

### fluid.unavailable(cause = {}, variety = "error")
* `{String|Object|Array} [cause={}]` - A list of dependencies or reasons for unavailability.
* `{String} [variety="error"]` - The variety of unavailable value:
* * `"error"` indicates a syntax issue that needs design intervention.
* * `"config"` indicates that an expected value has been configured away or is missing - the value may appear through regular user action
* * `"pending"` indicates the value depends on pending I/O which is expected to imminently resolve
* Returns: `{Unavailable}` An unavailable value marker.

A special variety of unavailable value represents a value which is temporarily stale as a result of I/O pending
to update it. This is created by `fluid.pending` which is just a wrapper for `fluid.unavailable`:

### fluid.pending(staleValue, site)
* `{Any} staleValue` - The most recently seen value before it became unavailable due to pending I/O.
* `{String} site` - The site or resource (e.g. URL) responsible for the pending I/O.
* Returns: `{Unavailable}` An object representing the unavailable state due to pending I/O.

### fluid.isUnavailable(totest)
* `{any} totest` - The value to be tested for being an unavailable value
* Returns `{Boolean}` `true` if the supplied value was an unavailable, `false` if it is a plain value.

For more complex examples of propagating and receiving unavailable states, please consult the test cases 
in [GitHub](https://github.com/fluid-project/infusion-6/blob/main/tests/framework-tests/core/js/FluidSignalsAsyncTests.js),
and in this context, "Error propagation across async graph", "Error propagation across async surfacing as promise rejection".
