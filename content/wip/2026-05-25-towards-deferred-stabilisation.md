---
title: Towards Deferred Stabilisation
date: 2026-05-25
type: post-single
---

aka "A Farewell to preact-signals"

This posting is a story that can be told from two ends, the theoretical and the practical. To jump ahead to one of
the punchlines, it turns out that Milo's [reactively](https://github.com/milomg/reactively) system, hailed in 
[Understanding Reactivity](/post/2025-12-15-understanding-reactivity) and other posts, harbours yet more riches than
had been explored so far. When looking through Milo's [Reactivity Benchmark](https://github.com/milomg/js-reactivity-benchmark)
with Chee last year, I was greatly taken with the staggering simplicity of the benchmark's 
[adaptor](https://github.com/milomg/js-reactivity-benchmark/blob/main/packages/core/src/frameworks/reactively.ts#L20-L23) for update batching,
which looks like this:

```
  withBatch: (fn) => {
    fn();
    stabilize();
  },
```

Where actually *is* the batching? As I noted in Understanding Reactivity, preact-signals' `endBatch` was a stack frame I'd learned to fear staring at,
and anything which promised to mitigate complexity in this area would be very welcome. But what is all this "stabilize"
business? This appears to be a name which Milo borrowed from Jane Street's 2015 [Incremental](https://www.janestreet.com/tech-talks/seven-implementations-of-incremental/)
system in which Yaron Minsky describes:

> So, stabilize is a somewhat mysterious looking function. It takes unit and returns unit. What does it do?
> So, what it actually does is, it runs the whole computation.
> So, the work flow with an incremental computation is, you build the basic computation.
> You modify some of the inputs. Then you call stabilize to flush that through the graph, and then we get the outputs back out.

This description also highlights the "stabilize/flush" crosslinking of terminology --- some frameworks, e.g. Solid signals,
use the latter term for the same primitive.

To start with, here is Reactively's [machinery](https://github.com/milomg/reactively/blob/main/packages/core/src/core.ts#L315C1-L338C2)
around stabilization which is also staggeringly simple and at first sight also a little puzzling:

```javascript
/** run all non-clean effect nodes */
export function stabilize(): void {
  for (let i = 0; i < EffectQueue.length; i++) {
    EffectQueue[i].get();
  }
  EffectQueue.length = 0;
}

/** run a function for each dirty effect node.  */
export function autoStabilize(fn = deferredStabilize): void {
  stabilizeFn = fn;
}

/** queue stabilize() to run at the next idle time */
function deferredStabilize(): void {
  if (!stabilizationQueued) {
    stabilizationQueued = true;

    queueMicrotask(() => {
      stabilizationQueued = false;
      stabilize();
    });
  }
}
```

What can be puzzling here is the lack of opinionated policy in the framework about how stabilization is meant to happen.
There are plenty of signs of this agnosticism in the wider community --- for example, the TC39 proposal-signals includes 
what could be considered weasel words in its advertisement for "[Implementing Effects](https://github.com/tc39/proposal-signals#implementing-effects)"

>The Signal API does not include any built-in function like effect. This is because effect scheduling is subtle and
>often ties into framework rendering cycles and other high-level framework-specific state or strategies which JS does not have access to.

Despite being a framework builder myself, I found myself unsettled by this explanation since I considered the scheduling
of effects as a core competency of a reactive framework and didn't have my confidence inspired by systems which proposed
to outsource it completely.

In any case, Reactively's exhibition of externalised stabilization seemed in itself, as usual, admirably clear --- if there
are some dirty effect nodes, you fetch their values and then reset the array. However, this leaves a set of imponderable issues on the table.
When, precisely, is one meant to do this, and what are the implications of different choices of timings here, especially in
a self-reactive system in which effect handling can schedule further effects? This could
only be illustrated by reference to our own concrete case which comes up in the next section. However, before that it's worth noting
the small subtlety that through use of a plain `for` loop rather than `Array.forEach`, Milo's `stabilize` guarantees
to deal with the case where pulling an effect causes further effects to be scheduled during the loop.

To skip ahead to another bit of the punchline, it is going to emerge that striving to be a "batteries included" reactive framework
in practice obliges one to make choices on behalf of one's users that are invariably going to end up harmful. But also in
practice, it might well end more up instructive to let the users experience the consequences of these choices first-hand,
since a punch in the nose is rather more instructive than any amount of finger-wagging.

## Back to the Coalface

Having cut my first release of [`fluid.cell`](/docs/fluid-signals) as a self-contained library, it was time to return
to the mainline of [Infusion](/infusion) development, cut away the base reactive layer of preact-signals from under
it and replace it with fluid.cell itself.

Coming back to this, I realised I'd prepared the ground for this work by making fluid.cell as algorithmically compatible,
if not API compatible in detail, with preact-signals. As a result of this, the first round of work was a fairly
mechanical search and replace exercise and I fairly quickly got to a point where roughly as many Infusion test cases
were passing as before the work --- this was pretty satisfying.

However, an interesting holdout was the "[shape cognition tests](https://github.com/fluid-project/infusion-6/blob/main/tests/framework-tests/core/js/FluidILTests.js#L626)"
which were designed to test Infusion's recognition of the framework-configured shape of the reactive map representing a component's
in-memory configuration. This was now failing for a reason apparently unrelated to the shape function directly
under test --- the last assertion, which was checking whether material returned from a method was correctly assigned
to the component's live layer, would fail, if the previous assertion doing the same for an effect was in place.

An annoying statefulness, then, turning up in the implementation, but the immediate cause was fairly clear --- a cyclic relationship
had been wired between the actual effect in the test fixture, 

```javascript
effect: {
    $effect: {
        func: (self, holder) => {
            self.fromEffect = holder;
        }, 
        args: ["{self}", "{self}.holder"]
    }
}
```

and a piece of the framework's inner machinery, the `availableInstance` cell gating overall availability of a component:

```javascript
shadow.availableInstance = fluid.cell(undefined, {name: `availableInstance for path ${shadow.path}`}).computed( () => {
    const unavailableLayerVals = Object.values(shadow.unavailableLayers.get());
    return unavailableLayerVals.length > 0 ? fluid.mergeUnavailables(unavailableLayerVals) : computer.get();
});
```

Regardless of the detailed policy for dealing with a cycle (`fluid.cell` forgives this, whereas preact-signals simply does
`throw new Error("Cycle detected");`) this cyclic linking clearly should never have happened in the first place since it
represents the framework's intent wrongly. How could this disaster have happened?

The clue can be found in the synchronous stabilization scheme that we inherited from preact-signals. Because synchronous
stabilization attempts to settle an update's effects on the same stack frame, there is the standing hazard that any
effect which gets allocated because of an update is going to end up being tracked as a dependency of it. And still worse, since
this entanglement happens in framework rather than user code, there is no hope of cutting it off through bracketing function bodies in
`untracked` to deactivate dynamic dependency discovery. In our case,
since we are building a malleable programming system where the existence of effects is coded for by updates to substrate material,
leading to updates of component instances, this kind of unwelcome entanglement is inevitable.

During the year or so I was working with preact-signals there had been plenty of "bumps in the night" like this, where a
seemingly innocuous change to work order would lead to the insufferably opaque ``Cycle detected``, which without
ready means for itemising which signal depends on which and why they had become tracked, led to a kind of "cod reactivity" where
as far as possible material was tracked in isolated signals lashed together by effects rather than proper computed relations.

And in retrospect, the reason for the situation complained of in [Why was I notified?](/wip/2025-12-15-understanding-reactivity/#why-was-i-notified)
of constantly finding oneself staring at `endBatch` becomes clearer. Given there are no batches in user code, the only
cause can have been `Signal.set`'s own internal bracketing:

```javascript
  set(this: Signal, value) {
    if (value !== this._value) {
            ...
            startBatch();
      try {
        for (
          let node = this._targets;
          node !== undefined;
          node = node._nextTarget
        ) {
          node._target._notify();
        }
      } finally {
        endBatch();
      }
    }
  }
```

So this internally inaccessible source of scheduling has to start to be seen as some kind of hazard, and even, source
of unnecessary complexity. Claude can generate any number of hazardous examples of code which reads and writes to signals
disorderly ways which need bracketing with `batch()` but a particularly entrenched one looks like this, 
"A constructor or initializer that writes signals":

```javascript
class Counter {
  constructor(initial) {
    this.value = signal(initial);
    this.derived = computed(() => this.value.value * 2);
    effect(() => log(this.derived.value));
    this.value.value = initial + 1;  // <-- effect fires here
  }
}
```
which even if part of the body is guarded with `batch()` still harbours risks of re-entrancy. Here's Claude's helpful
commentary:

> When `effect()` is called, the library runs the effect once synchronously to establish dependencies.
> If `this.derived.value` accessed inside the effect triggers refreshing the computed, and that refresh somehow ends up
> writing to another signal (it shouldn't, but in practice computeds sometimes call out to systems that have side effects),
> you can be in a re-entrant state during effect *registration*, not just during signal writes. The general principle:
> any call into the reactive system can re-enter your code.

To me, this heightens the stakes for trying to construct programming primitives in which re-entrancy is *a priori* impossible,
which is part of the overall discipline of using shorter stacks, reducing divergence and supplying other schemes
for transparency of intention. This fundamental critique of the "call/return" model of programming appears to be the
motivation of Hewitt et al's original 1973 [Actors](https://dl.acm.org/doi/10.5555/1624775.1624804) paper which later led
to Gul Agha's [1985 adoption](https://apps.dtic.mil/sti/pdfs/ADA157917.pdf) of an Actors model for concurrent programming.
However, critiques of Actors as a replacement for *all* functions of imperative programs include their relative
inefficiency and loss of intepretability.

## What is the scope of a reactive framework?

As I remarked above, a reactive framework which doesn't take a particular stance on when stabilization is meant to
occur feels uneasily incomplete, but this may also be a function of the truth, emerging to me, that there may well be
no terribly well-embodied notion of a "self-contained reactive framework". Whilst there are numerous such things
appearing in Milo's testing, many appear to have been created to prove various academic or benchmarking points, 
and it seems hard to avoid the observation that the most widely adopted reactive frameworks are those embedded in
bigger frameworks and not easily disentangleable from them, e.g. [Observable](https://github.com/observablehq/runtime/blob/main/src/runtime.js),
Solid and Vue. All of these frameworks were created in the context of a wider view framework rendering a UI
to the DOM and as the TC39 committee observes, inevitably end up entangling their notion of workflow wich their
parent framework's lifecycle and idiom for achieving this. 

Whilst a big part of Infusion's responsibilities will also involve rendering to the DOM, its scope is wider than this
and it makes sense that its own reactive implementation is inevitably going to get end up coupled with its workflow
for self-updates. But I would like to learn what I can about how such choices can be expressed and parameterised cleanly,
and their hazards can be understood. At the opposite extreme are incremental programming systems such as
[miniAdapton](https://arxiv.org/pdf/1609.05337) which have no primitive for automated scheduling whatever, and it is
assumed that "the environment" will manually force the values of any cells they are interested in whenever
they want them.

## Deferred stabilization has always been planned

In fact I have been aiming (some of the time semi-consciously) for a deferred stabilization framework since before
I knew much about reactivity at all. In 2016's [Software and How it Lives On](https://www.ppig.org/files/2016-PPIG-27th-Basman1.pdf)
I wrote in section 4.4.6 that we were aiming for "Homeostasis rather than Execution" as the base metaphor for the system's
state evolution which is clearly consistent with the Jane Street Incremental model which was being written at around the same time.
However much like every other "stack-hugger" I was deeply reliant on the ontological comfort of stack frames as
the explanation of the system's trajectory, and without machinery like `fluid.cell`'s recently implemented
[`findCause`](/docs/fluid-signals/#fluidfindcausecell) it would be a troublesome loss to abandon this source of explanation.
Reactive programming cannot be a satisfactory replacement for imperative programming without this kind of explanation, but now we have it,
it must be time to kick off the stabilizer\[sic] wheels. As last year's
[Vision Statement](https://ponder.org.uk/post/2025-06-03-substrates-vision/#composition-and-components) explains, both the
stack and the heap are sources of unwelcome [divergence](/term/divergence) and so going for the shorter stacks resulting
from deferred stabilisation is a clear architectural win.

It's also happy to realise that deferred stabilisation can be comprised in the same generalisation which was used to
apprehend glitch-freedom in [Understanding Reactivity](/wip/2025-12-15-understanding-reactivity). Like glitch-freedom,
deferred stabilization can be apprehended as following the
[Principle of Least Commitment](/wip/2025-12-15-understanding-reactivity/#essential-unity-of-reactivity). A system which
eagerly and synchronously attempts to settle the consequences of dataflow is going to cut itself off from choices which
could be more contextually informed in the future, as well as running into the kinds of footguns we've seen in this posting.

Moving `fluid.cell` to deferred stabilization should simplify its implementation as well as resolving bugs and race
hazards, and will also pave the way to the next stage of Infusion's development where stabilization will be scheduled
by a priority queue. As it turns out, there are certain kinds of framework work, e.g. hoisting a string holding a layer
name out of the substrate's material into a `$layer` value for a
["polymorphic lift"](/post/2026-02-20-reactivity-for-malleability/#polymorphism-via-indirection-layers) represents work that
`a priori` is going to be categorically more context-forming than others, even in the absence of a directly visible data
dependency. This kind of scheduling work previous versions of Infusion did in an *ad hoc* way in the absence of
a unifying reactive frameowrk.

Stabilization may be one of those areas in which it is better to do nothing rather than something --- but on the other hand,
if everyone did nothing, then noone would learn anything.
