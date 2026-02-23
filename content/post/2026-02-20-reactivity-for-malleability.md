---
title: "fluid.cell: A reactive implementation supporting malleable substrates"
date: 2026-02-20
---

<!-- copied from snippets/reactive-viz.html -->
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dagre-d3@0.6.4/dist/dagre-d3.min.js"></script>
<script src="/infusion-6/js/codemirror.js"></script>
<script src="/infusion-6/js/javascript.js"></script>
<link rel="stylesheet" href="/infusion-6/css/codemirror.css" />
<script src="/infusion-6/js/lezer-javascript-browser.js"></script>
<script src="/infusion-6/js/FluidCore.js"></script>
<script src="/infusion-6/js/FluidSignals.js"></script>
<script src="/infusion-6/js/FluidDebugging.js"></script>
<script src="/infusion-6/js/lezer-transform.js"></script>
<script src="/infusion-6/js/qunit-visual-signals-2.js"></script>
<link rel="stylesheet" href="/infusion-6/css/qunit-visual-signals.css" />
<style>
.statement-color {
  color: #4a90e2
}
.computed-color {
  color: #bb44ff
}
.cause-color {
  color: #e11
}
.clean-color {
  background-color: #ECECFF;
  padding: 2px;
  outline: 1px solid #333;
}
.check-color {
  background-color: #afa;
  padding: 2px;
  outline: 1px solid #333;
}
.dirty-color {
  background-color: #f99;
  padding: 2px;
  outline: 1px solid #333;
}
</style>

Submission to the March [Substrates 2026](https://2026.programming-conference.org/home/substrates-2026) Workshop, co-located with
[<Programming 2026>](https://2026.programming-conference.org/).

### Abstract

_This post explains why reactivity is a key requirement for openly authored, malleable substrates, and motivates [`fluid.cell`](/docs/fluid-signals), 
a reactive library designed to support the needs of these substrates. It preserves the good properties of widely available commodity reactive systems whilst
expanding their domain. I explain the core reactive competencies of _glitch freedom_ and _early cutoff_, and 
how `fluid.cell` delivers these competencies whilst supporting reactive graphs with bidirectional arcs, asynchronous
propagation of reactive updates and allows the cause of these updates to be tracked to their source, and why these
expanded capabilites are vital to support successful substrates. The post finishes with a interactive visual demo of the reactive
library on a simple test fixture._

## Why reactivity?

Why do we need reactivity in a substrate? In my vision of an openly authored, malleable [substrate](/term/substrate), its interface and capabilities
need to adjust dynamically to the gestures of the authors. As well as reflecting its change of function as it is built
and maintained, the substrate also needs to reflect the needs of different audiences, sometimes simultaneously.

Recently I have been working with a "commodity" reactive system, [preact-signals](https://preactjs.com/guide/v10/signals/), and part of my journey
with that system was described in December 2025's [Understanding Reactivity](/wip/2025-12-15-understanding-reactivity)
posting. I learned a lot from these commodity systems about what valuable regularities and guarantees a reactive system
needs to support, and also about the limitations of these commodity systems, some of which are fundamental, and some incidental. This learning fed into
the development of [`fluid.cell`](/docs/fluid-signals), a reactive library designed
to support the needs of a malleable substrate; it preserves the good properties of commodity reactive systems whilst
expanding their domain.

Much of the discussion here is anticipated by my 2025 [Substrates Vision Statement](/post/2025-06-03-substrates-vision) which
calls for many of the properties of the reactive system which has now been built. Documentation for [`fluid.cell`](/docs/fluid-signals)
is available on [this site](/docs/fluid-signals), and a live demonstration can be seen at the [bottom of the page](#live-demo).

### Reactivity for disclosure

Bridging the gap between use and change --- following Lennart Lövstrand's notion in his 1990 [Pressing the issues
with buttons](https://dl.acm.org/doi/10.1145/97243.97271) that "it should be as easy to change the environment as it is to use it" --- 
could sound straightforward, but is actually a multi-faceted, socio-technical issue. Central to its difficulty is that
_not all audiences will want this gap bridged_, and few will want it bridged all the time. This implies that these malleable 
capabilities need to lie latent within an ordinary-looking artefact, cheaply and fluidly ready to spring into existence
when required. This is one of the key loci at which a substrate needs to deploy reactivity. I've referred to this site
of adaptation under the heading of [disclosable computing](/term/disclosable-computing) --- those users who want to
simply *use* an artefact shouldn't be bothered by the fact that it is malleable. Otherwise highly successful substrates
such as Boxer and the Lively Kernel are hampered by their lack of graceful support for disclosability. A Boxer interface
always exposes all of its authoring capabilities, and a Lively interface, whilst it can be "locked down" still exposes
this potential in a visually and technologically distracting way.

[Hyperclay](https://hyperclay.com/) is an interesting recent HTML-based system with a clean approach to disclosure ---
it features a "Save-Strip-Restore" cycle that injects and removes interface elements related to malleability. However it
is not a reactive or generically adaptable system.

### Reactivity for liveness

Apart from the disclosure process, it's highly desirable that reactivity is available throughout the lifecycle
of a substrate. 
Closely aligned with the disciplines of substrate-oriented and malleable programming is the discipline of live programming.
To maintain the impression that [The thing on the screen is supposed to be the actual thing](http://davidungar.net/Live2013/Live_2013.html) (David Ungar, 2013),
the system should adapt smoothly and immediately to whatever gestures the author has made to modify it. This contributes
to the impression that the substrate represents a material under the author's direction rather than having a hidden realm
"offstage" where important things happen. Josh Horowitz in his 2024 [Technical Dimensions of Feedback](https://joshuahhh.com/dims-of-feedback/dims-of-feedback-live-2024.pdf)
has surveyed many of these dimensions, including "reactivity" in the everyday sense as experienced by 
users rather than a specific technical phenomenon.

### Fine-grained and coarse-grained reactivity, push vs pull

Reactivity is a poorly-characterised phenomenon, coming with many kinds of granularities. A central source of confusion
has been that the extremely popular [React](https://legacy.reactjs.org/docs/design-principles.html#scheduling) framework
[is not itself reactive in the strongest sense](https://dev.to/playfulprogramming/how-react-isn-t-reactive-and-why-you-shouldn-t-care-152m)[^1].
Subsequently, the distinction between "fine-grained" and "coarse-grained" reactivity emerged, in order to account
for the failure of some frameworks to support graphs built of autonomously reactive values. A further axis of confusion
is between "push-based" and "pull-based" reactive systems. The former are sometimes called "stream-based" systems and 
since they also inherently suffer from glitches, which I describe later, they lie outside our interest. 

### Substrate nature must coexist with imperative and functional backgrounds

It is possible to take the purity of a substrate's design too far. A successful substrate needs to coexist not only
against the background of what imperatively or functionally constructed software there already is, but also with
the computational literacies that users already have. Pushing too rigorously for complete homogeneity, for a substrate
constructed of a single material supporting an operation from a single paradigm, will produce a system with ergonomic problems.
For example, [Boxer](https://boxer-project.github.io/) and [Subtext](https://www.subtext-lang.org/retrospective.html) 
are systems with an admirable and total homogeneity, yet their primitives are so rigorous as to not permit ordinary
algebraic expressions such as _(A * B) + (C * D)_ to be idiomatically expressed. This could be considered an example of what
diSessa (1985) in
[A Principled Design for an Integrated
Computational Environment](https://boxer-project.github.io/boxer-literature/papers/A%20Principled%20Design%20for%20an%20Integrated%20Computational%20Environment%20-%20ACM%20HCI%20(diSessa,%201985).pdf)
describes as the "formalist bug" of providing a too sparse set of primitives from which to build all functions. 

A successful substrate will cover and re-express some of the same ground as existing computational systems, but will not intrude on semantics that the public has
already mastered at a grade school level.

### `fluid.cell` offers reactive competence for substrates

Previous
incarnations of [Infusion](/infusion), my substrate supporting open authorship, imagined that we could apply a
relatively coarse-grained reactivity[^2], but work over the last decade bringing fine-grained reactivity to numerous
JavaScript frameworks such as [preact-signals](https://preactjs.com/guide/v10/signals/), 
[solid signals](https://docs.solidjs.com/concepts/signals), [Vue signals](https://vuejs.org/guide/extras/reactivity-in-depth),
etc. has shown that these systems can be highly performant, principled and capable.

The community's wisdom has established two main properties of reactive competence that the best of these commodity reactive
systems can enjoy. These have gone by various names over the years, but I'll adopt names for them which have become
pretty well-attested from high-profile treatments - *glitch freedom* and *early cutoff*.

However, big gaps exist between even the best-of-breed of such "commodity" reactive systems and the requirements of
a malleable, openly authorable substrate.

I've bridged these gaps with a fine-grained reactive library, [`fluid.cell`](/docs/fluid-signals) which is specifically tailored to support open, malleable systems.
Whilst it will be used to replace preact-signals as the underpinning of Infusion, `fluid.cell` is a self-contained small library with
clearly explainable guarantees and capabilities which could support the development of other malleable systems too.

Firstly I'll describe the two main properties constituting reactive competence 
which I have distilled from these commodity systems, and then I will explain how `fluid.cell` greatly extends the domain over which
it provides these guarantees compared to commodity systems, to meet the needs of substrates. Some of the journey towards 
this implementation is described in my work in progress posting [understanding reactivity](/wip/2025-12-15-understanding-reactivity).

## Two pillars of reactive competence

### Glitch freedom

Glitch freedom is a consistency property which has gone by various names as it was independently rediscovered by many workers over the last decades. The
property is about dataflows which diverge and then reconverge --- it is essential that only one update is received by
a node at the top of a "diamond" of dataflow convergence, reflecting data which has been drawn from a consistent data
horizon, rather than a mixture of stale and fresh data. The diagram below shows the simplest possible graph which might glitch, with
a core of 3 nodes, with a short path directly from X down to B, and a longer path from X to B via A. It's essential that when
X updates, we don't happen to activate the arc X->B first, but make sure that we provide a consistent horizon of data to 
B by updating A from X first.

{{< figure src="/img/glitch-3.png" width="436px"
caption="The simplest possible graph that might glitch, made of 3 nodes">}}

An early and thorough treatment was in 
Kenny Tilton's [Cells](https://smuglispweeny.blogspot.com/2008/02/cells-manifesto.html) system for CLOS, which in 2001,
5 years before the coining of the terms "[glitch](/term/glitch)" and "reactive programming", had already solved the problems of
reactivity embedded in imperative programming languages. Kenny named this property "data integrity" which I quite like and
think it is a shame it didn't stick. Jonathan Edwards named
a closely related property as [Coherence](https://www.subtext-lang.org/Onward09.pdf) in 2009.

The naming of the property which has taken hold came in Cooper & Krishnamurthi's 2006
[FrTime paper](http://static.cs.brown.edu/~sk/Publications/Papers/Published/ck-frtime/paper.pdf) which I cover in my
[archaeology of glitches](/post/2025-07-01-archaeology-of-glitches) posting.

### Early cutoff

The other pillar of reactive competence is an efficiency guarantee, rather than a consistency property. It's essential
that the reactive system does not do a certain kind of "obviously unnecessary" work --- if a reactive update leaves
the value of a node unchanged, that node's "update" should not be used to schedule further updates of nodes which might depend on it.

This property is less hard-edged than glitch freedom since in practice there is a huge sliding scale of kinds of 
"unnecessary work" which a sufficiently clever reactive system could avoid. You can consult treatments like Robert Lord's 
[How to Recalculate a Spreadsheet](https://lord.io/spreadsheets/) and Jane Street's [Seven Implementations of Incremental](https://blog.janestreet.com/seven-implementations-of-incremental/)
for some of the fruity possibilities, but basic early cutoff support represents a straightforward everyday level of
competence that every reactive system should aspire to.

The diagram below shows a canonical situation, taken from Mokhov, Mitchell and Peyton Jones' 2018
[Build Systems à la Carte](https://www.microsoft.com/en-us/research/wp-content/uploads/2018/03/build-systems.pdf) which is
not ostensibly about reactive systems but build systems, but in practice the domains (as the paper argues, gearing through the 
primordial reactive system, Excel) are much the same. A user has changed a source file, `main.c`, in a way which
leads to no change in the produced object file `main.o`, perhaps by editing a comment. A competent reactive build system
should spot this, and, via early cutoff, not then go on to rebuild the executable `main.exe` once it sees that
`main.o` is unchanged.

{{< figure src="/img/early-cutoff.png" width="436px"
caption="Early cutoff in a simple graph of C language artefacts">}}

This might seem to be a quite basic variety of competence but in fact several popular reactive systems, such as [knockout](https://knockoutjs.com/documentation/introduction.html)
and Adapton, were created without it.

## Supporting open substrates

Whilst maintaining the two pillars of reactive competence, glitch freedom and early cutoff,
here are the new use cases and capabilities which `fluid.cell` supports in order to support an open substrate:

### Support for graphs with bidirectional arcs, malleably authorable

{{< figure src="/img/KCF-rendered.png" width="600px"
caption="A reactive graph with three nodes, two bidirectional arcs">}}

This diagram shows a reactive graph with three nodes connected by two bidirectional arcs, of the kind that is impossible to support
in a commodity reactive system. In this context it represents a toy domain of a temperature conversion app holding
temperatures in three scales, of the kind described in [Harmonious Authorship from Different Representations](https://www.ppig.org/files/2015-PPIG-26th-Basman.pdf) 
(Basman et al, 2015). Whilst niche, this is already a simple kind of domain that should be natural to represent
rather than require peculiar contortions or asymmetries (such as, for example, use of Vue signal's notion of a
[writeable computed](https://vuejs.org/guide/essentials/computed.html#writable-computed)).

There are plenty of examples in the user domain of why it might be idiomatic to support such structures --- for example
the seminal Cooper & Krishnamurthi 2006
[FrTime paper](http://static.cs.brown.edu/~sk/Publications/Papers/Published/ck-frtime/paper.pdf) mentions an example of
RGB and HSV views in a color selection window, but there are more fundamental reasons in an openly authorable system.
Such an open system must always be considered *authorially incomplete*, simply a projection on behalf of 
one or more authors out of a larger design, and hence cannot subscribe to the core religion which underlies much modern
systems design of a *[single source of truth](https://en.wikipedia.org/wiki/Single_source_of_truth)*. Inhabiting a
pluralistic informational space implies there can be no privileged node from which dataflow only proceeds
outwards.

Handling bidirectional arcs requires a fundamental change in representation of the reactive graph with respect to all commodity implementations,
which opportunistically fold together a "node plus edge" structure into a single data structure on the assumption that
each computed edge uniquely corresponds to a node, and that each node has only one incoming edge. Changes are also needed
in many parts of the algorithm which traverse and invalidate the graph.

### Agnostic to asynchrony

The issue of whether a value is available right away, or requires an asynchronous I/O operation to fetch it, is one that
is guaranteed to be absolutely unfathomable to the end user, yet to a typical stack-hugging developer is one of a frightful
viral nature. Bob Nystrom admirably sums up the situation in his [What Color is Your Function](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/) posting,
explaining the viral nature of asynchronous operations in code expressed in functional or imperative forms. 

Modern language features such as `async/await` provide close facsimiles to the user that asynchronous code works like
synchronous code, but the analogy breaks down pretty quickly, requires foresight, and, as Bob explains, a switch from
a synchronous to asynchronous source of data must cascade all the way up a chain of consuming functions.

Reactive systems, which by nature operate on values as they become ready, promise to free the user from having the issue
of asynchrony in mind, which is usually irrelevant to their domain. However, very few reactive systems have so far 
delivered on this promise by putting asynchronous operations on a level footing with synchronous ones. Ryan Carniato's
in-progress rewrite of [solid signals](https://docs.solidjs.com/concepts/signals) is the notable exception, and
`fluid.cell` adopts with thanks his [test cases](https://github.com/solidjs/signals/blob/1005d57a4ee78ecf8d8b3395060e7005a0312fd5/tests/createMemo.test.ts#L310)
verifying reactive competence in the face of asynchronous propagation, which our implementation passes. 

### Accounting for cause of updates

In the [background section](#substrate-nature-must-coexist-with-imperative-and-functional-backgrounds) we explained that
whilst moving beyond the "execution paradigm" which both imperative and functional idioms tie us to, we must coexist
with them gracefully as well as respecting the computational literacies that users already have.

However, a successful substrate will also need to offer equivalent guarantees, and especially, equivalent capabilities
for explaining the state of the system, as we got from other paradigms. Reactivity has the potential to replace
imperative and functional systems with far more malleable and democratic alternatives, but without providing
the equivalent reassurances that users got from the coordinates of program counters and stack frames to explain
the system's trajectory, we will again have serious ergonomic problems. `fluid.cell` provides a dedicated primitive
[`findCause`](/docs/fluid-signals/#fluidfindcausecell) which is available whenever a reactive update is in progress, which
will trace back through the graph to the original cause of the update. This can then be available to the substrate's
own self-tooling which visually exports this information to the user --- in the demo below, this path of nodes is highlighted
in red during a reactive update.

### Short-circuit behaviour on errors and incompletion

`fluid.cell`'s mechanism for supporting asynchronous computations, based around a specially marked payload named an
[unavailable value](/term/unavailable-value) generalises to some other substrate requirements. 

The short-circuit behaviour of unavailable values in the reactive graph is as follows:

* A reactive computation any of whose dependencies is unavailable is short-circuited, and produces a further unavailable value,
possibly accumulating an extra annotation holding the address of the computation
* A reactive effect any of whose dependencies is unavailable does not activate.

The lifecycle of a malleable substrate is quite different to that of a conventional reactive system. A commodity reactive system
expects the dependence structure of its graph handed to it as a *fait accompli* --- its structure is already
*implied* by the dependence structure of the body of code which has started to execute, and dependencies merely need
to be *discovered*. However, a malleable substrate needs to supervise its own construction, which implies that
considerable time is spent traversing reactive material on startup whose dependencies have not yet been loaded or
constructed. The short-circuit behaviour of unavailable values provides a natural semantic to allow the substrate to
make progress on constructing parts of the graph which are available without attempting to activate computations with missing values,
a typical problem with commodity reactive libraries.

Analogously to accounting for the cause of updates, a substrate also needs to account for the causes of errors, and
route the user's attention through its surface to the cause that a value is unavailable, either through outstanding
I/O, design incompletion or a structural/syntacic error. Unavailable values also handle this case within the 
substrate, accumulating all the addresses of substrate cells on the paths between visible error sites and their causes.
`fluid.cell` is agnostic about the substrate structure which it supports and so does little to interpret these
aspects of the payloads to unavailable values which are intended to be processed in a substrate-specific way.

### Dynamic dependency discovery

This is a standard feature to all commodity reactive frameworks, but in the context of substrate work this appears as
somewhat of a surplus feature. In an imperative/functional environement which privileges the world of executing code,
it is an idiomatic and powerful feature to subscribe a reactive computation to dependencies as they are discovered
through the course of executing a conventional function encoding a reactive computation. However, in an openly
authored substrate constituting an [integation domain](/term/integration-domain), the principle of *interface hiding*[^3]
implies that executing code should properly have no power of reference to other than its immediate arguments. However,
`fluid.cell` retains this feature to support interoperability with imperative codebases.

## Feature comparison

Here is table showing a feature comparison of `fluid.cell` against a number of historical reactive implementations ---
"Discovery" indicates dynamic dependency discovery and "Bx ⟺" indicates support for bidirectional reactive edges.

| Year | System | Discovery | Glitch-Freedom | Early Cutoff | Async | Bx ⟺ | Causes |
|------|-----------|-----------|--------|--------------|-------|----|-----------|
| 2001 | cells | ✓         | ✓ | ✓ | | | |
| 2006 | FrTime | ✓         | ✓ | ? | | ✓~ | |
| 2010 | knockout | ✓         | ✓ | | | | |
| 2012 | S.js | ✓         | | ✓ | | | |
| 2014 | mobX | ✓         | ✓ | ✓ | | | |
| 2020 | Observable | ✓         | ✓ | ✓ | ✓ | | |
| 2023 | Solid | ✓         | ✓ | ✓ | ✓ | | |
| 2026 | fluid.cell | ✓         | ✓ | ✓ | ✓ | ✓ | ✓ |

## Live demo

You can see it working here. Understanding how control flow works in detail when embedding reactive primitives within
an imperative backdrop can be a puzzle, so the legendary "flag" test case from preact-signals is here animated in a timeline alternating between
imperative <span class="statement-color">statement steps</span> (S) in blue, and reactive <span class="computed-color">computation steps</span> (C) in purple. 

In addition, the <span class="cause-color">cause</span> of any current reactive computation, that is, the path to the node
whose update originally scheduled it, is highlighted in red.

You can step forwards and backwards
through the test fixture to see nodes and arcs being built up and torn down, and also the reactive cell values and states
being altered. Each node can be in one of three reactive states --- 

* <span class="clean-color">Clean</span> --- The cell is fully up to date with all of its dependencies
* <span class="dirty-color">Dirty</span> --- The cell is provably dirty, since one of its immediate dependencies has recently updated
* <span class="check-color">Check</span> --- The cell may be dirty, since a distant upstream dependency has recently updated

These states and their colours are taken from Milo Mighdoll's admirable [Super Charging
Fine-Grained Reactivity](https://milomg.dev/2022-12-01/reactivity) illustration of his own Reactively system, from which
a good part of the `fluid.cell` implementation has been adapted.

Note that without support for asychronous propagation of reactive values, this demo could not have been implemented,
since behind the scenes the original synchronous test fixture is rewritten to an asynchronous one which then suspends
waiting for user interaction.

<div class="vizreactive-target">
<span class="vizreactive-testname">preact-signals: Should drop A->B->A updates</span>
<pre class="vizreactive-source" src="/testjs/a-b-a-updates.js">
</pre>
</div>

<script>
    fluid.vizReactive.bootVizReactiveUI();
</script>




[^1]: Section 4.4.4 of [Software and How it Lives On](https://www.ppig.org/files/2016-PPIG-27th-Basman1.pdf),
Basman et al, 2016, describes a bulky, transaction-oriented style of reactivity named "Queen of Sheba adaptation".
[^2]: Ryan's 2021 article is excellent but betrays the complexity of this terrain in the analysis of Svelte's
reactivity --- he observes that a touchstone of why Svelte is not reactive is that one can
"read a derived value on the next line of code it isn't updated. It is definitely not synchronous.", yet the latest
incarnation of his signals system, solid-signals, shows [just the same behaviour](https://github.com/solidjs/signals/blob/main/tests/createMemo.test.ts).
I actually agree with him that Svelte is not reactive, but not with this exact reasoning of why not, and yet at the same
time I also support the behaviour of his latest test cases. 
[^3]: Described in Stephen Kell's [The Mythical Matched Modules](https://www.cl.cam.ac.uk/research/srg/netos/papers/2009-kell2009mythical.pdf) (2009).
