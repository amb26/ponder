---
title: Archaeology of Glitches
date: 2025-07-01
---

In 2024 I was working on a [small project](https://datacommunities.ca/toolkit/sewa-saamarth-app/) that I wanted to be able to be handed over,
and wondered what was the most congenial way out there of rendering apps that wouldn't bring in too heavy a dependency.
My eye was caught by the
[following passage](https://github.com/preactjs/signals/blob/b5334c55443a46a94605685d27d19e5495f30303/packages/core/test/signal.test.tsx#L1572-L1596)
in preact-signals' test cases:

```
    it("should drop A->B->A updates", async () => {
        //     A
        //   / |
        //  B  | <- Looks like a flag doesn't it? :D
        //   \ |
        //     C
        //     |
        //     D
        const a = signal(2);

        const b = computed(() => a.value – 1);
        const c = computed(() => a.value + b.value);

        const compute = sinon.spy(() => "d: " + c.value);
        const d = computed(compute);

        // Trigger read
        expect(d.value).to.equal("d: 3");
        expect(compute).to.have.been.calledOnce;
        compute.resetHistory();

        a.value = 4;
        d.value;
        expect(compute).to.have.been.calledOnce;
    });
```

I was mostly in pursuit of the [Preact + HTM templating](https://preactjs.com/guide/v10/getting-started/#alternatives-to-jsx)
rendering approach that seemed harmless and minimal, but with also the promise of [rendering optimisations](https://preactjs.com/guide/v10/signals/#rendering-optimizations)
which could route signal updates directly to leaves in the DOM, bypassing the horrors of React-style top-down global updates.

However, as I stared at this test case, a lightbulb went off in my head about something that had niggled me perhaps through
a decade of Infusion development – a kind of subliminal sense that if there was a "slow path" and a "fast path" through
a dataflow network, one really needed the fast path to wait for the slow path so that the computation could see a
consistent data horizon. I realised I had encountered this hazard countless times without properly articulating it
to myself until this moment.

Comparing a few different reactive frameworks for this property and seeing this helpful but not fully satisfying
[Signals vs Observables](https://www.builder.io/blog/signals-vs-observables) /
push vs pull reactive posting on builder.io, I asked a
[Stack Overflow question](https://stackoverflow.com/questions/78703449/can-observables-support-data-consistency-in-flow-graphs-which-rejoin)
about the relationship between this consistency property and the push/pull distinction, to resounding silence.

#### Glitches appear in the literature

In the meantime my research tracked the term `[glitch](/term/glitch)' to the seminal Cooper & Krishnamurthi 2006 [FrTime paper](http://static.cs.brown.edu/~sk/Publications/Papers/Published/ck-frtime/paper.pdf),
the site where this term first emerged in the visible literature. Their definition is very clear and helpful – a glitch occurs

> where a signal is recomputed before all of its subordinate signals are up-to-date

Cognitively this appears clear-cut, but the more one thinks about how to operationalise this definition in a particular
concrete context, and verify that a system is rigorously glitch-free, the less clear it seems. More on this later.

This research uncovered a further kind of glitch since
Cooper & Krishnamurthi cite for this term their reference \[5], Antony Courtney's 2001
[Frappé: FRP in Java](https://www.antonycourtney.com/pubs/frappe-padl01.pdf) in which the term doesn't appear! I wrote to Sriram
and Greg about this anomaly and got a helpful response describing a visit to Paul Hudak's research group in Yale:

> ... We spent a day with him, John Peterson, and Antony Courtney.
>
> During this time, Paul told us to look out for glitches. The actual origin of the term is digital circuit design: see for instance
>
> [http://web.cecs.pdx.edu/~mperkows/CLASS_573/febr-2007/hazards.pdf](http://web.cecs.pdx.edu/~mperkows/CLASS_573/febr-2007/hazards.pdf)
>
> At the time I don't think we knew that, and we wanted to credit Paul's group for alerting us to glitches (even though we were
> solving them in a somewhat different way). And we were given the impression by the Yale group that Frappé addressed this
> problem. So the combination (Yale told us about the problem, Yale said their Frappé system addressed the problem) caused us to cite Frappé.

What is particularly ironic is that the crucial review paper Bainomugisha et al 2012
[A Survey on Reactive Programming](https://soft.vub.ac.be/Publications/2012/vub-soft-tr-12-13.pdf) which surveys 15 reactive
systems, had determined that 4 of them are subject to glitches, amongst them Frappé itself!

#### How can glitch-freedom be demonstrated?

This in turn raises questions about the methodology of Bainomugisha et al itself. On this I wrote to the authors, asking
if they had been able to verify the absence of glitchiness in the frameworks in any formal or consistent way. However,
they responded that all they had done is what anyone would do informally, that is

> The way you would test if a given language or framework supports glitch-freedom is to define a small program where an
> expression depends on more than one reactive variable, and then to observe how dependencies are updated when the input
>variables are updated (like the simple example we give in Fig 3 of the paper). The expression should describe some
> mathematical constraint that should always hold, unless glitches may occur.

This approach can of course only detect glitchiness and not rigorously demonstrate its absence. So the plot thickens.
Our next port of call is the prestigious [2016 Dagstuhl on Reactive Programming](https://www.dagstuhl.de/seminars/seminar-calendar/seminar-details/16402)
which gathered together the field's greatest experts on incremental and reactive programming. One of the stated goals
of day 2's working group on "Incremental Computing (IC) vs Reactive Programming (RP)" (section 3.2 in
the [Dagstuhl's report](https://www.pl.informatik.uni-mainz.de/files/2019/04/IC-dagstuhl.pdf)) was to develop
"systematic abstractions", in the view that

> ... we broadly consider ad hoc approaches “harmful”, in
> the sense that they lack systematic abstractions, and consequently, may suffer from
> undefined or inconsistent behavior (“glitches”). The alternative to ad hoc approaches
> are programming language abstractions and carefully-designed libraries that offer
> reusable abstractions, with well-defined semantics.

In service of this, an outcome of the Dagstuhl was a series of edits to the Wikipedia articles on Reactive Programming
and Incremental Computing, one of which introduced the text (still present as of 2025) in the Reactive Programming article's
[Glitches section](https://en.wikipedia.org/wiki/Reactive_programming#glitches)

> Some reactive languages are glitch-free and prove this property

Shortly after its appearance in 2016 this text rightly received the \[citation needed] tag, and so I wrote
recently to the Dagstuhl committee to ask whether they had authored or seen any citation that could back up this
assertion. Since I've received no response, my conclusion is that the Dagstuhl has not achieved its aim of producing
these systematic abstractions which are capable of verifying the absence of this inconsistent behaviour.

Section 4 of [FrTime](http://static.cs.brown.edu/~sk/Publications/Papers/Published/ck-frtime/paper.pdf) develops a formal
semantics for their update rules, and the authors state

> they enforce a topological order, which guarantees the absence of glitches and
> makes the state at the end of each update cycle well-defined

but this reasoning is verbal and indirect.

#### Glitch-freedom in practice without this being in focus

In the years since then, work has all the same continued vigorously in this area, especially in the JS view framework
community, but in a way largely unguided by
this pursuit of well-defined semantics or reliable tools for assessing them. This brings us back to the
preact-signals test cases at the head of this post.

The test cases are not just attractively filled with ASCII art but they are also fairly compendious. Along with the
flag, there are diamonds, diamonds with tails and heads, diamonds with two tails, etc. in sufficient variety that the
reader is substantially convinced that the system really is glitch-free, but, one has to note, in the absence
of this term being mentioned[^1], and certainly in the absence of a proof or a well-defined semantic asserting it.
This is the only convincing demonstration for a real system that I'm aware of, and as
I roved around I found that other frameworks that had interested themselves in glitch-freedom
(e.g. [solid-signals](https://github.com/solidjs/signals/blob/d92142095f290e3d091fc9532a0ed541ccc169bc/tests/graph.test.ts#L8),
[maverick-js](https://github.com/maverick-js/signals/blob/main/tests/graph.test.ts)) had simply adopted preact-signals'
test cases wholesale.

Finding alien-signals as an attractive target I [approached Jackson](https://github.com/stackblitz/alien-signals/issues/37) asking whether he knew whether it was glitch-free.
His answer was pretty interesting – that he couldn't be entirely sure, but given it was being used in substantive
contexts in Vue.js' language tooling, he expected that it was. I asked whether he'd appreciate test cases being
contributed checking this, he was welcoming, so I ported the preact-signals test cases and [contributed them](https://github.com/stackblitz/alien-signals/pull/39). Interestingly,
they all passed.

#### Commodity signals implementations

This is perhaps less mysterious than it appears – it seems that with very few exceptions (ignoring obvious blunders
like RxJS) all of the modern JS signals libraries implement essentially the same algorithm, with some inessential
tweaking of how invalidation flags are encoded and updated, whether dependencies are tracked in arrays or linked
lists, etc. Reactively has a brilliant [graphical summary](https://milomg.dev/2022-12-01/reactivity) of the differences
between some of the major lineages (Mobx, preact-signals, Solid, reactively itself), and whilst there are clear structural
differences it seems likely the algorithms are really isomorphic[^2] – they would have just the same profile if they had
been implemented early enough to have been surveyed in the 2012 Bainomugisha et al survey. I call this group of
implementations "commodity signals" and indeed they enjoy enough uniformity that they are coming to be standardised
under the banner of the [TC39 proposal](https://github.com/tc39/proposal-signals) for inclusion in JS.

#### Two important non-commodity systems: Adapton and Observable

Two important other systems to discuss before we finish. Firstly, the very well-motivated
[Adapton](http://matthewhammer.org/adapton/adapton-pldi2014.pdf)/[mini-Adapton](https://arxiv.org/pdf/1609.05337) system
from Hammer et al, 2014 & 2016. Again despite many differences of packaging it seems likely that these implement
"the same" algorithm as commodity signals. I stared at the algorithm a bit and [quizzed ChatGPT](https://chatgpt.com/share/68502246-26f8-8013-8eb5-74490aabdb89)
and whilst it was able to hallucinate a plausible extra capability in Adapton – that it supported the allocation of fresh
reactive cells during the progress of a computation, this proved to be illusory. The commodity signals implementations
I tested handled this just fine, and the error that the chat proposed would be emitted by solid-signals is
nonexistent.

This seems to be an interesting case of "convergent evolution" since I see no evidence that commodity signals implementations
in JS have been in any way informed by Adapton (or indeed by any of the academic literature stemming from the 2016 Dagstuhl)
but as far as I can see their capabilities are the same. And ironically, the only one of the group, preact-signals,
which made any convincing attempt to demonstrate glitch-freedom did so simply by exhibiting exhaustive test cases
without any appeal to the named notion of glitches at all.

Finally a significant JS implementation is Mike Bostock's reactive 
core of the [Observable](https://observablehq.com/framework/) notebook system. This is
clearly part of a separate lineage to commodity signals and Adapton and enjoys important excess capabilities over them with
native support for asynchronous updates.
Observable's reactive system is housed
in [runtime.js](https://github.com/observablehq/runtime/blob/main/src/runtime.js) and
whilst it doesn't have a strong dependency on the rest of Observable feels more like an "evolved solution to a problem
in a context" (together with a soft dependency on the DOM) rather than a library which is intended to be repurposed
elsewhere.

Tom Larkworthy has been investigating Observable's reactivity as part of his
amazing [Lopecode](https://tomlarkworthy.github.io/lopecode/) system, and his notes on it are [here](https://observablehq.com/@tomlarkworthy/observable-notes) as
part of our [June 13th 2025 X discussion](https://x.com/tomlarkworthy/status/1933594600247009570). Observable's
[reactivity](https://observablehq.com/framework/reactivity) has greater power than commodity signals since it has
a native semantic for asynchronous processes in the reactive graph, supporting data arising from JS
[Promises](https://observablehq.com/framework/reactivity#promises) and
[Generators](https://observablehq.com/framework/reactivity#generators). Of commodity signals implementations, only [@solidjs/signals](https://github.com/solidjs/signals/blob/main/tests/createAsync.test.ts)
has nascent support for glitch-free asynchronous updates as part of a library which is (as of Sep 2025) marked as pre-alpha.

The Observable implementation is highly promising and if it weren't for the lack of support for bidirectional
relations I'd consider adopting it for Infusion, but it certainly needs studying carefully especially to understand
what the semantics are for overlapping asynchronous updates. As with commodity signals it is clear that it grew up in
isolation from the academic tradition, the term "glitch" does not appear and some terms (e.g. "indegree") are used in
idiosyncratic senses.




[^1]: The term "glitch" does not occur anywhere in the preact documentation or codebase in this sense.
[^2]: In a somewhat loose sense. They clearly differ significantly in their efficiency and schedule for visiting
the reactive graph, and some may even unnecessarily recompute values or notify effects more often than others – but
they don't seem to differ in terms of the graph topologies and update patterns they support.
