---
title: "fluid.cell: A reactive implementation supporting malleable substrates"
date: 2026-02-20
---

Submission to the [Substrates 2026](https://2026.programming-conference.org/home/substrates-2026) Workshop, co-located with
[<Programming 2026>](https://2026.programming-conference.org/).

Over the last few years of developing [Infusion](/infusion), a substrate supporting open authorship, it became
increasingly clear that the key to many of its successful behaviours would be a grounding in
better reactive primitives. The same values of open authorship --- allowing systems to be specified in separate pieces
contributed by multiple authors --- need to be extended right down to the bedrock of reactivity that the system is
built on. Some of these desired behaviours were flagged up in a section of last year's 
[Substrate Vision Statement](/post/2025-06-03-substrates-vision#better-reactive-primitives). 

Over these years I've been working with a "commodity" reactive system, [preact-signals](https://preactjs.com/guide/v10/signals/), and part of my journey
with that system has been described in the December 2025's [Understanding Reactivity](/wip/2025-12-15-understanding-reactivity)
posting. I learned a lot from these commodity systems about what valuable regularities and guarantees a reactive system
needs to support, and also about the limitations of these commodity systems, some of which are fundamental, and some incidental. This learning fed into 
the development of [`fluid.cell`](/docs/fluid-signals) which is specifically tailored to the support of open, malleable systems.
Whilst it will be used to replace preact-signals as the underpinning of Infusion, `fluid.cell` is a self-contained small library with
clearly explainable guarantees and capabilities which could support the development of other malleable systems too.

Here are the new use cases and capabilities which `fluid.cell` supports:

### Support for graphs with bidirectional arcs, malleably authorable

{{< figure src="/img/KCF-rendered.png" width="600px"
caption="Reactive graph with three nodes, two bidirectional arcs">}}



