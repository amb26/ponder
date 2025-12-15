---
title: Glitch
categories: ["term"]
---

The term **glitch** in the sense of a reactive miscomputation first entered the literature in Cooper & Krishnamurthi's 
2006 [FrTime paper](http://static.cs.brown.edu/~sk/Publications/Papers/Published/ck-frtime/paper.pdf), 
"Embedding Dynamic Dataflow in a Call-by-Value Language". They define it as

> where a signal is recomputed before all of its subordinate signals are up-to-date

This definition appears helpful and clearcut, but the more one thinks about how to operationalise this definition in a particular
concrete context, and verify that a system is rigorously glitch-free, the less clear it seems. I go into some of the
complexities and murky history of this definition in [Archaeology of Glitches](/post/2025-07-01-archaeology-of-glitches), which
also delineates the dominant "commodity signals" implementations in JS (preact-signals, solid signals, alien
signals, TC39 signals, etc.) which implement essentially the same algorithm as each other and which are all demonstrably (though not
provably) glitch-free.

Here I will unpack a little why this property is important, what are the risks of violating it, and why I feel the name
given to it is somewhat misleading.

#### What are the risks of glitching?

Cooper & Krishnamurthi are clear on these risks (in a way that few subsequent authors are) but as with the definition itself,
this needs some unpacking:

> Such behavior is unacceptable as it results in redundant computation and, much worse, causes signals to violate invariants.

There are two main heads of this violation risk cause by glitching glitching, internal, and external.

We'll use the `signal`/`computed`/`effect` ontology from [preact-signals](https://preactjs.com/guide/v10/signals/#api)

* A glitching system runs the *internal* risk, in a `computed`, that it will present the function on the arc
with inconsistent values, potentially which lie outside its range. For example `computed( () => a.value / b.value)` may
present with b as 0 or missing, which, especially in a less dynamic language than JS, may trigger a runtime failure.
* A glitching system runs the *external* risk, in an `effect`, that it will present the outside environment with
an inconsistent system state. For example a system which writes successive system states to a database or issues
queries based on them will produce faulty behaviour.

#### How can glitching be prevented?

The key to glitching is the order in which the dataflow graph is visited as data values in it are invalidated. This
[ontology of reactive programming](https://www.builder.io/blog/signals-vs-observables) contrasts "push-based" and
"pull-based" reactivity and it's clear that pull-based reactivity enjoys a natural advantage as the graph will
safely be traversed in dependency order. However any efficient reactive system will need to have a "push" phase
to avoid unnecessarily traversing large parts of the data graph which haven't been invalidated. Commodity reactive systems
use a [push-pull](https://dev.to/this-is-learning/derivations-in-reactivity-4fo1) workflow as described by Ryan Carniato.

Transactions are another technique for preventing observation of glitches. [Coherence](http://dspace.mit.edu/bitstream/handle/1721.1/45563/MIT-CSAIL-TR-2009-024.pdf)
uses micro-transactions to prevent inconsistent updates from propagating through the graph, but unless combined with
other mechanisms transactions can only guard against the external and not internal consistency risks caused by glitching.

#### Why does this term carry unhelpful connotations?

Inherited from analogue circuit theory, the term "glitch" carries the connotations of a kind of transitory annoyance.
If one waits a little while, the proper system state will be restored, and perhaps if one weren't observing the system
too closely during the glitch, the harmful consequences will be small. The problem is that computations are not typically
embedded in their environment in quite the same way that analogue circuits are. Especially when interacting with
external systems via a mechanism like `effect`, the consequences of a miscomputation may be arbitrarily bad. Given I'm
positioning reactive primitives in [Infusion](/infusion) as a wholly satisfactory substitute for execution,
it is essential that they are as reliable as execution, and I'd prefer a name drawn from a closer discipline.

Before the term "glitch" became widespread, other researchers had characterised this phenomenon and given different names to it.

Jonathan Edwards' 2009 [Coherent Reaction](http://dspace.mit.edu/bitstream/handle/1721.1/45563/MIT-CSAIL-TR-2009-024.pdf) system
gives the name "coherence" to a closely related property.

Ken Tilton's 2001 [Cells](https://smuglispweeny.blogspot.com/2008/02/cells-manifesto.html) reactive system,
which seems mostly isomorphic to contemporary commodity signals systema and anticipated them by roughly 20 years, 
refers to this property as "data integrity".

#### Glitching is widespread and underappreciated

Since reactive systems have generally been deployed in low-stakes contexts such as UI rendering and/or games, the potential
for glitches has not been strongly in focus. In Bainomugisha et al's 2012
[A Survey on Reactive Programming](https://soft.vub.ac.be/Publications/2012/vub-soft-tr-12-13.pdf), 4 out of 15
reactive systems surveyed were found to be glitch-prone, and RxJS, a popular reactive JS library, is 
[irremediably](https://stackoverflow.com/questions/22332407/how-to-avoid-glitches-in-rx/25779152#25779152) glitch-prone.

Awareness has been steadily growing and glitch freedom is an [explicit goal](https://github.com/tc39/proposal-signals?tab=readme-ov-file#soundness)
of the TC39 signals implementation.
