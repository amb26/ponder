---
title: Fluid Signals API
category: Infusion
type: infusion-docs
---

This page documents the reactive library underlying Fluid Infusion 6, based around the primitive `fluid.cell`.
I chose the name "cell", rather than "signal" which is more common in the 2020s JavaScript reactive community,
in honour of 3 traditions:

* Spreadsheet cells, which are the public's primeval grounding in reactivity.
* Kenny Tilton's [Cells](https://smuglispweeny.blogspot.com/2008/02/cells-manifesto.html) system for CLOS, which in 2001,
5 years before the coining of the terms "[glitch](/term/glitch)" and "reactive programming", had already solved all the problems of
reactivity embedded in imperative programming languages.
* The notion of a [reference cell](https://en.wikipedia.org/wiki/Reference_(computer_science)#Functional_languages) in JavaScript
and and other functional languages, taking the form of an object + key or 1-element array which mocks up the mutable capability of
a pointer in languages which lack them.

There is now a consensus notion of the capabilities of a reactive library in JavaScript, amongst such popular implementations
as preact-signals, alien-signals, Angular signals, solid-signals, etc. which has led to the proposal of a 
[standardised JS implementation](https://github.com/tc39/proposal-signals) by the TC39 committee. This consensus
baseline is often called "commodity signals" in pages on this site.

Whilst the core implementation of fluid.cell is consistent with this consensus implementation --- in fact, it has been
adopted directly from Milo Mighdoll's amazing and minimal [reactively](https://github.com/milomg/reactively) system --- this implementation
departs from the consensus in several significant ways. These departures mostly widen the domain
of validity of the implementation, relaxing restrictions which are incompatible with the demands of a
[substrate](/term/substrate) supporting malleable programming.

Whilst its idiom and goals are aligned with support for the Infusion 6 substrate, `fluid.cell` is a [self-contained
library](https://github.com/fluid-project/infusion-6/blob/main/src/framework/core/js/FluidSignals.js)
with no dependencies which could be adopted for other purposes.

You can read its test cases [here](https://github.com/fluid-project/infusion-6/blob/main/tests/framework-tests/core/js/FluidJSTests.js) and run them
[here](https://fluid-project.github.io/infusion-6/tests/framework-tests/core/html/FluidSignalsTests.html).

The best guide to reactive programming in general and fluid.cell's algorithm in particular is Milo's 2022 [Super Charging
Fine-Grained Reactivity](https://milomg.dev/2022-12-01/reactivity) which contrasts a variety of implementations including
Reactively's, about 2/3 of the way down the page with the red and green squares, which I have adopted.

## Extra capabilities in fluid.cell

### Bidirectional relationships
The most significant ergonomic difference in fluid.cell is support for bidirectional relationships between cells,
which supports democratic constructs such as [lenses](https://en.wikipedia.org/wiki/Bidirectional_transformation) without
recourse to gratuitous asymmetries such as [writable computed](https://vuejs.org/guide/essentials/computed#writable-computed)
relations.

### Multiple inbound compute arcs 
Support for bidirectional relationships entails support for multiple computed relations 
capable of updating the value of a single cell. This is a capability not found in any popular reactive library.
In isolation, this capability might lead to the possibility for inconsistent or conflicting updates --- however,
`fluid.cell` follows the insight from Dan Ingall's [Fabrik](https://dl.acm.org/doi/pdf/10.1145/62083.62100) system which
recognizes "bidirectional dataflow connections as a shorthand for multiple paths of flow". As one leg of a bidirectional
relationship is activated, the reverse leg is removed from consideration for this reactive update cycle (I name this a "fit"),
removing the chance for cyclic updates.

### Static compute arguments
Tied in with support for lenses and multiple incoming arcs is fluid.cell's support for *static arguments* to compute arcs.
This is a significant departure from commodity signals, which pride themselves on automatic discovery of dependencies 
as code executes in the compute arc. In a substrate forming an [integration domain](/term/integration-domain) this is unidiomatic
since base language code should ideally have no power of reference to surrounding scopes, in accordance with the principle of 
*interface hiding*. However, the use of static arguments isn't mandatory, standard dynamic tracked dependencies are
available to be used either instead of or along with them, to aid experts in interoperating with established
codebases.

### Cycle diagnostics
Another difference is the treatment of cycles. Rather than being rejected outright with a base language exception, these
can be configured to either resolve benignly through having the cycle broken by deferring a potentially cyclic update
to a further task, or else to resolve to an unavailable value which accumulates the addresses of the nodes involved,
producing a visible diagnostic in the substrate\[coming soon].

### Cause tracking

A hugely important ergonomic improvement is being able to report the *cause* of any ongoing reaction, that is, the 
chain of updated nodes leading back to the initial changed node triggered by the user or environment. This is vital in
a substrate which positions reactivity as a wholesale replacement for execution, and therefore needs to replace the
invaluable explanatory power of the stack with a correspondingly thorough explanation stretching across the substrate. This
is done via the [fluid.findCause](#fluid-findcause) API which returns this path of updated nodes.

### Asynchronous compute arcs

Finally, fluid.cell supports compute arcs which produce their results asynchronously \[coming soon]. Whilst this is uncommon in
reactive libraries, there is precedent for this in Ryan Carniato's [Solid signals](https://github.com/solidjs/signals) supporting
the upcoming 2.0 release of Solid, and Mike Bostock's [Runtime](https://github.com/observablehq/runtime/blob/main/src/runtime.js)
which powers [Observable](https://observablehq.com/framework/).

## Construction

### fluid.cell(initialValue, props)

* `{Any} [initialValue]` - The initial value to store in the cell
* `{Object} [props]` - Additional properties to contextualise the cell
* Returns: `{Cell}` - The freshly constructed cell

A fresh reactive cell is constructed, with an optional initial value and optional additional properties.

If the initial value is `undefined`, this will be upgraded to an [unavailable](#unavailable-values) value marking
the signal's value as initially unavailable.

The only currently supported property in `props` is 

* `{String} name` - Supplies a name or address for this cell

## Reading and writing

### Cell.get()

The value of a reactive cell can be read by calling `Cell.get`. This forces the reactive tree of computations
behind the cell to bring its value up to date. A call to `Cell.get` within the reactive context of a `computed`
function will set up an automatic subscription to updates of the cell, rerunning the function whenever the value
changes.

### Cell.set()

The reactive cell's value can be updated by calling `Cell.set`. This will trigger a cascade of updates through the
reactive tree. Any computed values that are depended on by effects will be updated immediately. Computed values
that are not depended on by effects will only updated if an effect is created which later reads them, or `Cell.get`
is called for a cell which depends on them.

### Cell._value

A "blind read" of the current value of the cell, regardless of how stale it is, can be made by looking at the `_value`
property. This isn't recommended except in specialised cases, usually of framework-building.

## Relations and effects

### Cell.computed(fn, staticSources)

* `{Function | null} fn` - The function which will reactively evaluate this cell's value, or null if an existing relation is to be torn down
* `{Cell[]} [staticSources]` - Any statically known cell dependencies whose reactively evaluated arguments will be supplied to fn when it is called
* Returns: `{Cell}` - This cell

`computed` is available as a function in the prototype of cells created via `fluid.cell`.

`Cell.computed` constructs or tears down a computed relationship between a target cell (`this` one) and one or more source cells
computed by the supplied function `fn`.
It's preferred that the source cells are specified in the `staticSources` arguments --- when they update, their values
will be dereferenced and supplied as plain values as arguments to the function. However, any other cells that the
function manages to reference in its surrounding scopes as it executes will also be tracked and schedule a reinvocation
of the function by the standard semantics of commodity signals implementations.

The first `staticSource` cell, if there is one, will have a special status of establishing the *key* of the relationship
which will be unique in the context of the target cell. If there is no such cell, a `null` value will serve as the key.
If an existing relation is present on the target cell with the same key, it will be replaced by the supplied one.

If `null` is supplied in place of the `fn` argument, any existing relation with the same key will be torn down.

### fluid.cell.effect(fn, staticSources, props)

* `{Function} fn` - The function to execute reactively when any of the staticSources change
* `{Cell[]} staticSources` - The array of source cells whose values are dependencies for the effect
* `{Object} [props]` - Optional properties to configure the effect
* `{Function} [props.onDispose]` - Optional cleanup function to run when the effect is disposed
* `{Boolean} [props.free]` - If true, the effect will run even if some sources are unavailable
* Returns: `{Effect}`

`fluid.cell.effect` accepts a function and arguments to run when one or more reactive values change. The signature
is similar to `Cell.compute` only the evaluation is not lazy --- an effect runs immediately upon registration
and again when any values change. Another difference is that effects do not correspond to a value --- values returned
from `fn` are ignored. In order to deactivate the effect it needs to be explicitly disposed by calling the
`Effect.dispose()` method on the returned Effect. 

Another difference is in handling of unavailable arguments --- if any cells referenced in `staticSources` or
in dynamically tracked reactive values resolve to an unavailable value, notification of the function is skipped.

An effect represents a resource in the world outside the reactive graph and as such may require special actions
when it is torn down. The optional `props` argument accepts a callback `onDispose` which is called when the effect
is disposed via `Effect.dispose()`.

## Comprehension

### fluid.findCause([cell])

* `{Cell} cell` If supplied, the cell whose update cause should be reported. If absent, any current
  reaction will be used instead.
* Returns: `{Cell[]}`

Reports the cause of any reaction which has updated a given cell, or else the one that is currently
in progress, in the form of an array of nodes reaching back from the supplied cell to the one whose modification
triggered the reaction. The triggering cell appears first in the array.

## Unavailable values

Some background on unavailable values is available on their [own page](/term/unavailable-value).

An unavailable value is created using the `fluid.unavailable` API, which in the simplest usage simply accepts a
string holding a message explaining why the value is unavailable.

### fluid.unavailable(cause = {}, variety = "error")
* `{String|Object|Array} [cause={}]` - A list of dependencies or reasons for unavailability.
* `@param {String} [variety="error"]` - The variety of unavailable value:
* * `"error"` indicates a syntax issue that needs design intervention.
* * `"config"` indicates configuration designed to short-circuit evaluation which is not required.
* * `"I/O"` indicates pending I/O
* Returns: `{Unavailable}` An unavailable value marker.
