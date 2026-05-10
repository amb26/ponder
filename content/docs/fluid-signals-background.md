---
title: Fluid Signals background
category: Infusion
type: infusion-docs
---

This page contains background information motivating the design of `fluid.cell`, the reactive primitive built to support
Infusion 6, explaining how it differs from traditional reactive libraries. There are also [API docs](/docs/fluid-signals) for `fluid.cell` and also a more
[extended essay](/post/2026-02-20-reactivity-for-malleability) explaining its goals in the context of a malleable substrate.

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
as [preact-signals](https://github.com/preactjs/signals/blob/main/packages/core/README.md),
[alien-signals](https://github.com/stackblitz/alien-signals),
[Angular signals](https://angular.dev/guide/signals),
[Solid signal](https://docs.solidjs.com/concepts/signals), etc. which has led to the proposal of a
[standardised JS implementation](https://github.com/tc39/proposal-signals) by the TC39 committee. This consensus
baseline is often called "commodity signals" in pages on this site.

Whilst the core implementation of `fluid.cell` is consistent with this consensus implementation --- in fact, it has been
adopted directly from Milo Mighdoll's amazing and minimal [reactively](https://github.com/milomg/reactively) system --- this implementation
departs from the consensus in some significant ways. These departures mostly widen the domain
of validity of the implementation, relaxing restrictions which are incompatible with the demands of a
[substrate](/term/substrate) supporting malleable programming.

Whilst its idiom and goals are aligned with support for the Infusion 6 substrate, `fluid.cell` is a [self-contained
library](https://github.com/fluid-project/infusion-6/blob/main/src/framework/core/js/FluidSignals.js)
with no dependencies which could be adopted for other purposes.

You can read its test cases [here](https://github.com/fluid-project/infusion-6/blob/main/tests/framework-tests/core/js/FluidSignalsTests.js) and run them
[here](https://fluid-project.github.io/infusion-6/tests/framework-tests/core/html/FluidSignalsTests.html).

The best guide to reactive programming in general and fluid.cell's algorithm in particular is Milo's 2022 [Super Charging
Fine-Grained Reactivity](https://milomg.dev/2022-12-01/reactivity) which contrasts a variety of implementations including
Reactively's, about 2/3 of the way down the page with the red and green squares, which I have adopted.

## Extra capabilities in fluid.cell

### Bidirectional relationships
The most significant ergonomic difference in `fluid.cell` is support for bidirectional relationships between cells,
which supports democratic constructs such as [lenses](https://en.wikipedia.org/wiki/Bidirectional_transformation) without
recourse to gratuitous asymmetries such as [writable computed](https://vuejs.org/guide/essentials/computed#writable-computed)
relations.

### Multiple inbound compute arcs
Support for bidirectional relationships entails support for multiple computed relations
capable of updating the value of a single cell. This is a capability not found in any popular reactive library.
In isolation, this capability might lead to the possibility for inconsistent or conflicting updates --- however,
`fluid.cell` follows the insight from Dan Ingall's [Fabrik](https://dl.acm.org/doi/pdf/10.1145/62083.62100) system which
recognizes "bidirectional dataflow connections as a shorthand for multiple paths of flow". As one leg of a bidirectional
relationship is activated, the reverse leg is removed from consideration for this reactive update cycle (this kind of cycle is named a "fit"),
removing the chance for cyclic updates.

### Static compute arguments
Tied in with support for lenses and multiple incoming arcs is `fluid.cell`'s support for *static arguments* to compute arcs.
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
is done with the [fluid.findCause](#fluidfindcausecell) API which returns this path of updated nodes.

### Asynchronous compute arcs

Finally, `fluid.cell` supports compute arcs which produce their results asynchronously. Whilst this is uncommon in
reactive libraries, there is precedent for this in Ryan Carniato's [Solid signals](https://github.com/solidjs/solid/tree/next/packages/solid-signals) supporting
the upcoming 2.0 release of Solid, and Mike Bostock's [Runtime](https://github.com/observablehq/runtime/blob/main/src/runtime.js)
which powers [Observable](https://observablehq.com/framework/). `fluid.cell` passes the
[test cases](https://github.com/solidjs/solid/blob/311548aea535ac803c748ee73dcd576fab5a260a/packages/solid-signals/tests/createAsync.test.ts)
(as of Nov 2025) issued for Solid signals' `createAsync`.
