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
behind the cell to bring its value up to date. A call to `Cell.get` within the reactive context of a `computed`
function will set up an automatic subscription to updates of the cell, rerunning the function whenever the value
changes.

### Cell.set(newValue, [source])

* `{any} newValue` The new value to which the cell is to be updated
* `{String} [source]` An optional source tag name to be applied to this update as is propagates.

The reactive cell's value can be updated by calling `Cell.set`. This will trigger a cascade of updates through the
reactive tree. Any computed values that are depended on by effects will be updated immediately. Computed values
that are not depended on by effects will only updated if an effect is created which later reads them, or `Cell.get`
is called for a cell which depends on them.

Optionally, at the time of calling 

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
accepted by the supplied function `fn`.
It's preferred that the source cells are specified in the `staticSources` arguments --- when they update, their values
will be dereferenced and supplied as plain values as arguments to the function. However, any other cells that the
function manages to reference in its surrounding scopes as it executes will also be tracked and schedule a reinvocation
of the function, following the standard tracking semantics of commodity signals implementations.

The first `staticSource` cell, if there is one, will have a special status of establishing the *key* of the relationship
which will be unique in the context of the target cell. If there is no such cell, a `null` value will serve as the key.
If an existing relation is present on the target cell with the same key, it will be replaced by the supplied one.

If `null` is supplied in place of the `fn` argument, any existing relation with the same key will be torn down.

The additional `ComputedProps` argument can contain the following fields:

`{Object} ComputedProps`:
* `{Boolean} isAsync` - Indicates if the computation is asynchronous.
* `{Boolean} isFree` - Indicates if this is a "free" computation that will deliver unavailable values.

Here is a basic example setting up two cells connected by a simple computation:

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.0.0/dist/FluidCell.mjs"

const A = fluid.cell(1);

const B = fluid.cell().computed(a => a + 1, [A]);

console.log("B's value computed to ", B.get()); // Outputs 2
</textarea>

For a more advanced example setting up and tearing down bidirectional relationships, you can see the
visual test sample for [Bidirectional temperature conversion](https://ponder.org.uk/post/2026-02-20-reactivity-for-malleability/?selectedTest=bidirectional_tests_-_temperature_conversion_with_two_nodes)
in the extended essay.

### Cell.asyncComputed(fn, [staticSources], [props])

* `{Function | null} fn` - The function which will reactively evaluate this cell's value, or `null` if an existing relation is to be torn down
* `{Cell[]} [staticSources]` - Any statically known cell dependencies whose reactively evaluated arguments will be supplied to `fn` when it is called
* `{ComputedProps} [props]` - Optional additional properties to contextualise the computation
* Returns: `{Cell}` - This cell

Sets up an asynchronous computed relationship between one or more cells. This is equivalent to a call to `Cell.computed()`
with the `props` in the 3rd argument set with `isAsync: true`.

In this case, the function argument `fn` rather than returning a plain value should be an `async` or `async*` function
which returns either:

* A `Promise` representing a deferred value or error
* An `AsyncIterator` produced by the `yield` function indicating that this function is a 
[async generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*) of a
bounded or unbounded sequence of deferred values.

Here's an example receiving a result through an asynchronous computation. Rather than manually waiting for event turns
as here, asynchronous results are more conveniently received through [fluid.cell.signalToPromise](#fluidcellsignaltopromisevalsignal), see below.

<textarea class="fluid-code-box" rows="13">
import fluid from "https://unpkg.com/infusion-6@6.0.0/dist/FluidCell.mjs"

const A = fluid.cell(1);

const B = fluid.cell().asyncComputed(a =>
    new Promise(resolve => setTimeout(() => resolve(a + 1), 0)), [A]);

B.get(); // Trigger fetch of B

await new Promise(resolve => setTimeout(() => resolve(), 0)); // Wait for async propagation

console.log("B's value computed to ", B.get()); // Outputs 2
</textarea>

### fluid.cell.effect(fn, [staticSources], [props])

* `{Function} fn` - The function to execute reactively when any of the staticSources change
* `{Cell[]} staticSources` - The array of source cells whose values are dependencies for the effect
* `{Object}   [props]` - Optional properties to configure the effect
* `{Function} [props.onDispose]` - Optional cleanup function to run when the effect is disposed
* `{Boolean}  [props.isFree]` - If true, the effect will run even if some sources are unavailable, delivering unavailable
* `{String}   [props.excludeSource]` - Optional source name (as supplied as last argument to cell.set) that will have its notification skipped
values in their place.
* Returns: `{Effect}`

`fluid.cell.effect` accepts a function and arguments to run when one or more reactive values change. The signature
is similar to `Cell.compute` only the evaluation is not lazy --- an effect runs immediately upon registration
and again when any values change. Another difference is that effects do not correspond to a value --- values returned
from `fn` are ignored. In order to deactivate the effect it needs to be explicitly disposed by calling the
`Effect.dispose()` method on the returned `Effect`. 

Another difference is in handling of unavailable arguments --- if any cells referenced in `staticSources` or
in dynamically tracked reactive values resolve to an [unavailable value](#unavailable-values), and the effect is not
marked as `isFree`, notification of the function is skipped.

An effect represents a resource in the world outside the reactive graph and as such may require special actions
when it is torn down. The optional `props` argument accepts a callback `onDispose` which is called when the effect
is disposed via `Effect.dispose()`.

This simple example follows the pattern of previous examples, but actively pulls updates to B using an effect
rather than manually pulling them via `get()`:

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.0.0/dist/FluidCell.mjs"

const A = fluid.cell(1);

const B = fluid.cell().computed(a => a + 1, [A]);

const Blogger = fluid.cell.effect(b =>
    console.log("B's value computed to ", b), [B]); // Outputs 2 immediately

A.set(2); // Outputs 3

Blogger.dispose();
</textarea>

This example shows `fluid.cell`'s ___source tracking___ facility. If a source of changes is tagged by using the 
`source` argument to `fluid.set`, changes due to this source can skip notifying an effect with a matching
`excludeSource` argument. This can be helpful when interfacing with external systems which should not be
notified of changes that they themselves have caused:

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.0.0/dist/FluidCell.mjs"

const A = fluid.cell();
const B = fluid.cell().computed(a => a + 1, [A]);
const Blog = [];

const Beff = fluid.cell.effect(b =>
    console.log("B's value computed to ", b), [B],
    {excludeSource: "scrollbar"});

A.set(2); // B's value computed to 3

A.set(3, {source: "scrollbar"}); // No notification: B excludes scrollbar source
</textarea>

## Comprehension

### fluid.cell.findCause([cell])

* `{Cell} cell` If supplied, the cell whose update cause should be reported. If absent, any current
  reaction will be used instead.
* Returns: `{Cell[]}`

Reports the cause of any reaction which has updated a given cell, or else the one that is currently
in progress, in the form of an array of nodes reaching back from the supplied cell to the one whose modification
triggered the reaction. The triggering cell appears first in the array.

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.0.0/dist/FluidCell.mjs"

const A = fluid.cell(1, {name: "A"});

const B = fluid.cell(undefined, {name: "B"}).computed(a => a + 1, [A]);

const Blogger = fluid.cell.effect(b => {
    const cause = fluid.cell.findCause();
    console.log("Causes of this update were ",
        cause.map(cause => cause.name).join(", "));
}, [B], {name: "Blogger"}); // Outputs "Blogger" immediately

A.set(2); // Outputs "Blogger, B, A"

Blogger.dispose();
</textarea>

## Utilities

### fluid.cell.signalToPromise(valSignal)
* `{Cell<any>} valSignal` - The signal to monitor.
* Returns: `Promise<any>` - A Promise that resolves with the signal's first available value.

Gear from the world of signals into a Promise that can be `await`ed.

The [`asyncComputed`](#cellasynccomputedfn-staticsources-props) example from above is more conveniently written:

<textarea class="fluid-code-box">
import fluid from "https://unpkg.com/infusion-6@6.0.0/dist/FluidCell.mjs"

const A = fluid.cell(1);

const B = fluid.cell().asyncComputed(a =>
    new Promise(resolve => setTimeout(() => resolve(a + 1), 0)), [A]);

console.log("B's value computed to ",
    await (fluid.cell.signalToPromise(B))); // Outputs 2
</textarea>

### Cell.refresh(staticSources)

* `{Cell[]} [staticSources]` - An optional array of static source cells to identify the computation edge to be refreshed
* `this: {Cell}` The cell for which an incoming edge is to be refreshed

A method available on any `Cell`: Refreshes the value of the cell by re-evaluating its computation for the specified static sources.
Finds the incoming edge corresponding to the given static sources and triggers an update for this cell along that edge. Particularly
useful when the value is computed via an asynchronous activity in the world --- if the edge is async, the cell's value
will be set to stale and the asynchronous activity will be restarted.

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
* * `"config"` indicates configuration designed to short-circuit evaluation which is not required.
* * `"I/O"` indicates pending I/O
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
