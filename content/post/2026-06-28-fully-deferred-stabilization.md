---
title: Bridging the gap between static and dynamic analysis through fully deferred stabilization
date: 2026-06-28
---

It is now ten years since some of us wrote 2016's [Software and How it Lives On](https://www.ppig.org/files/2016-PPIG-27th-Basman1.pdf)
(SaHiLO) which set out a manifesto for durable, live software embedded in open contexts, worked on by unbounded communities of authors. 

In the time since then, progress in reactive software, particularly in the JavaScript community, has now made it possible to tighten
up some of the details of how this vision can be brought about. In that paper's sections 4.4.6, and 4.4.7, entitled 
"Homeostasis rather than Execution" and "Mocks and a Taxonomy of Effects" it is announced somewhat diffusely,
that we should seek an alternative to the dominant execution paradigm for organising our software, and that we should
organise these designs around a clear schema identifying where side-effects may occur in a design.

Some elements of this research programe can now be read from contemporary reactive signals systems which split their ontology
between "computed" signals which are pure (memo-ised) functions of their dependencies, and "effects" which issue changes
in the external world which cannot be called back. In this post I will argue that there are developments in the most
modern reactive systems which point towards more fine-grained, contextually responsive scheduling of reactive updates,
which bring us closer to designing the homeostatic, openly contextualised systems that the paper calls for, as well
as bridging an important gap between currently widely separated fields of computer science.

## Split between systems and languages

In his 2012 [Structure of a Programming Language Revolution](https://dreamsongs.com/Files/Incommensurability.pdf), Richard
Gabriel identifies that after 1990, a fundamental schism occurred between communities working on programming *systems*
and programming *languages*. An incarnation of this split can be read from the highly vigorous discipline of
*static analysis*, which tries to read as many constraints and regularities as possible from the source text of a
programming system before it begins to execute. This analysis provides helpful syntax assistance and behavioural assurances
to engineers working on the source text, but its insights are greatly limited by ignorance of the context
in which the system is to be deployed. In addition, this disciplinary split entrenches a corresponding split between
the communities of those who design programs, benefitting from the elite tooling and insights available around its
source text, and those who merely use them, from whose view all of these benefits are permanently effaced by the
information-destroying, unidirectional tool chains which produce running programs.

I will argue that this split can be healed, by refounding our notion of the "execution" of running program.
We need to perform this refounding along two axes, firstly through reconceiving the driving force of execution as homeostasis,
which exhibits as little eagerness as possible, 
and secondly by ensuring that updates can be pushed through the reactive graph backwards as easily as forwards.

Under homeostasis of a reactive system, rather than executing a predetermined set of steps deterministically, it is instead 
constantly seeking to minimise the discrepancy between upstream reactive nodes constituting the design and data underlying the system,
and the downstream nodes representing the effects of the program in the world dependent on these. This discrepancy,
in reactive systems, is known as "staleness" --- a reactive system is constantly working to bring the state of
the reactive graph up to date, by recomputing the contents of nodes which are stale with respect to their dependents.
Some communities call this work the "stabilization" of the reactive graph.

## Traditional homeostasis: Synchronous, depth-first 

As it turns out, there are a lot of subtleties as to how this stabilization should be scheduled. Most older reactive
systems stabilize the reactive graph in an eager, synchronous way which is qualitatively very similar to the
synchronous, deterministic strategy implied by imperative code written against the execution paradigm. Specifically,
in traditional eager reactive systems such as preact-signals, [effects](https://preactjs.com/guide/v10/signals/#effectfn)
will synchronously notify effects to the outside world from the same stack frame on which changes are notified.

In the last few years, an interesting vanguard of reactive systems, particularly Ryan Carniato's upcoming
[Solid signals](https://github.com/solidjs/solid/tree/next/packages/solid-signals) supporting
the 2.0 release of the Solid web framework, is starting to support *deferred stabilization*, under which the
reactive graph doesn't update until explicitly prompted. I wrote about this strategy in last month's
work in progress, [Towards Deferred Stabilization](/wip/2026-05-25-towards-deferred-stabilisation), and traced its
lineage back to Jane Street's 2015 [Incremental](https://www.janestreet.com/tech-talks/seven-implementations-of-incremental/)
computation system, and the intermediate 2025 Reactively system from Milo Mighdoll.

Milo's system exhibits this stabilization point very clearly in a nutshell: 

```javascript
/** run all non-clean effect nodes */
export function stabilize(): void {
  for (let i = 0; i < EffectQueue.length; i++) {
    EffectQueue[i].get();
  }
  EffectQueue.length = 0;
}
```

To those consuming the reactive system as coders, the need to call `stabilize` can appear annoyingly bureaucratic. On the one hand, it 
represents an increase in the clarity of design of the reactive system --- what used to be scattered across multiple
control flow points (for example, updating the value of a cell, constructing a new effect, or modifying the graph
topology) that might be capable of triggering updates in the external world, is now focused in a single named
entry point. But on the other hand, it seems that all of this complexity, of determining the control
flow points where updates could be triggered, has now been exported into the user's own design, creating what looks like
a good deal of noise scattered across their own design.

In fact, as I argue in [Towards Deferred Stabilization](/wip/2026-05-25-towards-deferred-stabilisation), this 
represents a big win in coherence, and can be taken even further to deliver even greater benefits.

You will observe from the code above that the trigger `EffectQueue[i].get()`, whilst it is triggered at a time point of
the user's choosing, still proceeds to traverse the entire depth of the graph, bringing one whole effect's worth of 
nodes up to date synchronously and then proceeding to synchronously enact the effect. This has several adverse consequences:

1. The system chews up an unpredictable amount of program stack, which is a performance risk, as well a risk to deterministic resource
consumption
2. The system becomes `divergent` --- under the terms of SaHiLO, this represents an invisible execution coordinate
causing the system's visible state to diverge from its authored state 
3. The system violates the Principle of Least Commitment (PoLC)which should require that any effects issued against the
world should be maximally contextualised.

The PoLC is well treated by Phil Agre in his 1997 [Computation and Human Experience](https://archive.org/details/computationhuman0000agre)
and I write about this in last year's [Understanding Reactivity](../wip/2025-12-15-understanding-reactivity/#essential-unity-of-reactivity).

## Fully deferred stabilization

Some of the most performant reactive systems, for example, 2024's [alien-signals](https://github.com/stackblitz/alien-signals)
are responding to the performance point 1. by turning function call recursion into iteration over a stack structure,
for a significant performance boost. But I argue that within this choice of an externalised data structure (rather than
the program stack) representing the trajectory of reactive homeostasis, lies a crucial locus of policy. Instead of 
unwrapping reactive propagation to a stack, corresponding to traditional depth-first scheduling, one could instead
unwrap it to a queue, producing a breadth-first order which can respond simultaneously to the demands of multiple effects,
but still further, to a priority queue, reflecting in a more refined way the contextual demands of homeostasis in a
malleable, open system. Use of a queue or priority queue here enables what could be called *fully deferred stabilization* 
in which *all* of the dependents of nodes issuing effects in the world can be brought to date first, in a smoothly
graded and easily interruptible process.

Following the PoLC, the homeostatic process of scheduling reactive updates should be as little eager
as possible --- following a breadth-first search, but in addition allowing nodes whose updates can be *a priori* 
expected to have disproportionate influence on the graph contents and topology to jump the queue and be scheduled first.
I write about this in the last section of
[Understanding Reactivity](wip/2026-05-25-towards-deferred-stabilisation/#deferred-stabilization-has-always-been-planned),
and this issue also connects to the [Hierarchy of Good Function](/wip/2025-09-26-this-weeks-reactive-chats/#hierarchy-of-good-functions)
I wrote about last year (relations which destroy information should be scheduled last).

### Contextually informed analysis

But one of the greatest riches that can be released by *fully deferred stabilization* is our headline
point, the facility that under the execution paradigm used to be called "static analysis". We could call this
"contextually informed analysis" (CIF). Under fully deferred stabilization,
a workflow point now exists in which the system can be paused, where the signal graph has been made maximally consistent
with underlying updates to data sources, and responded fully to the authorial gestures of a broad community of authors,
but has so far exhibited no visible changes in the world. It is now in the ideal state for analysis and design
interpretation, since it can be clearly read off from the system what effects in the world it is about to issue, and also
what is the full provenance chain stretching back through the reactive graph that leads to those effects. Unlike static analysis,
this inference is fully contextually informed and precise with respect to the system's deployment context and can also
be helpfully parameterised with respect to it.

At this point, one could intervene and determine that a fundamental design invariant had been broken --- for example, that
an effect about to be issued in the world no longer had an adequate provenance chain connecting it with the source data
it should depend on. At this point the design can be rejected as faulty, the broken chain highlighted in a visible form,
and the problem corrected before any harmful consequences had been issued. At the same time as assuring this safety,
the design's authorship network could be massively more permissive to malleable influence than would be possible
under the execution paradigm.

CIF is particularly timely in a world where large portions of system design undertaken
by AI puts accountability greatly at risk. Development teams are now deluged by code review tasks which the execution
paradigm renders Sisyphean --- because it is so intrinsically hard to reason about the effects of code in its deployed state 
from its source expression, and because this task itself could never be delegated effectively to AI without surrendering the
very accountability that the review process is designed to assure, this fundamental reform to the transparency properties
connecting the behaviour of executing systems to their designs and source data seems essential.
