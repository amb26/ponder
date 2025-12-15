---
title: Infinite Apps, Asynchrony and Tree Unshaking
date: 2025-12-12
---

This has been a period of consolidation since pushing on demos of Infusion 6 for the 
[Substrates 2025](https://2025.programming-conference.org/home/substrates-2025) workshop and my 
[2025 Live](https://www.youtube.com/watch?v=ai2fbWi3kUU) incurred a good amount of technical debt.
Lots of demo features were hacked on by banging on framework internals rather than by proper userland constructs, and the
tidyup has proved more meaty than I imagined, with several test cases still failing for fairly fundamental reasons.

However this has been a great opportunity to deliver more soundly on some of Infusion's goals and work out more
of the implications of its model for software's material.

### Infinite software

In the summer I had a really interesting chat with
[Alex Komoroske](https://www.komoroske.com/) who was in the grip of the notion of [infinite software](https://abovethelaw.com/2025/07/how-one-1990s-browser-decision-created-big-techs-data-monopolies-and-how-we-might-finally-fix-it/),
contrasted with "infinite apps" which are billed as the "endless custom tools tailored to every conceivable need" that our
supercharged vehicle of LLMs is rolling out to us. He noted in his rolling [Bits and bobs](https://groups.google.com/g/komoroske-updates/c/lU04FFJsFuU)
journal that "Instead with infinite software, the software will melt away. It will feel like your data coming alive." 
But how could this work, in practice?

To me, the notion of "infinite apps" suggests something a little different. Rather than an endless *profusion* of 
isolated, siloed apps[^1], I imagine apps which are instead *infinite in extent*, that is, uniting their users and putting them
into communication via a continuous, catholic[^2] substance.

Now an app which is infinite in extent clearly can't be expected to load all of its code at once. This brings into
relief a sharp preoccupation of today's endlessly frenetic build systems, that of [tree shaking](https://en.wikipedia.org/wiki/Tree_shaking).
A great virtue of the ES6 modules system is that it hugely eases the static analysis required to eliminate the delivery
of code that designers of an app's build have determined that the user is not going to need, and today's build systems are expected to take
advantage of this capability aggressively.

Readers of this blog with an enthusiasm for malleable software will already be wondering --- this is all very well, but
whose job is it to undo this process when a change in the user's needs requires some of this dead code to come back again?
It's naturally impossible without running the build chain from the start, since the fact that the tree shaken code ever even existed
has been ruthlessly scrubbed from the system. This pattern of "erasure as virtue" is something of course that we are well
familiar with, even down to the execution paradigm itself where a function's arguments on the stack are erased and replaced
with its return value --- it is a central technocratic virtue that a system keeps absolutely the minimum records it needs
to do its job[^3], and one that is at the heart of user disempowerment.

### Tree unshaking

When the user desires the system to adapt, it needs to gracefully and in-place go through a process of *tree unshaking* --- 
locating and loading code that a previous analysis considered "dead", or perhaps which the original designer never considered
relevant at all, and perhaps in the middle of a user gesture (event handler) which invokes the adaptation --- or more sharply,
the system may only discover the need for adaptation partway through the process of constructing a component.

This was a topic of the [memorable conversation](https://chee.party/2025/w30/) I had with the lovely [Rabbits](https://chee.party/) as we stood at the
corner of the Old Street roundabout until midnight ...

Things brings into scope a great mesh of issues related to how execution and construction needs to be structured
in a malleable system. In my 2025 [substrates vision](/post/2025-06-03-substrates-vision#errors-and-asynchrony) I refer
to Bob Nystrom's insightful [What Color is Your Function](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/)
story of how asynchrony, in our current paradigm, is a viral and disruptive issue in a way that is inconsistent with malleable
software values. The user should not be troubled by the issue of whether a piece of data or implementation is available
in the current app's image via a synchronous function call or needs to be unshaken or loaded from somewhere.

These days JavaScript's `async/await` construct closes up a lot of the syntactic gap between synchronous and asynchronous 
availability, but as Bob points out, imperfectly. And the ergonomics are not in our favour --- whilst the stack is a 
[divergent](/term/divergence) construct, it's usually our main source of explanation as developers as to why the
system is in a particular state, which an asynchronous activity largely erases.

### Asynchronous and partial construction

Our dominant paradigms (functional, object-oriented,
procedural, what-have-you) do not permit construction to be interrupted by an asynchronous activity. In a 
[ranty 2014 wiki posting](https://fluidproject.atlassian.net/wiki/spaces/fluid/pages/11607547/On+The+End+of+TIME+and+BEING#OnTheEndofTIMEandBEING-TheObject-OrientedTheorist'sHiddenAxiomofAtomicDelivery:)
which I'm otherwise embarrassed by, I try to uncover this hidden axiom underlying the workflow through which subobjects or subcomponents are expected to be
instantiated and delivered to their parents. All of their prerequisites are expected to be met before construction
begins, and they are expected to be delivered to their parents fully constructed when the function returns. Neither
of these expectations are compatible with the goals of malleable software.

I think that reactive programming paradigms, which are becoming increasingly popular, offer an attractive way
out of these problems, but only if they are improved substantially by increasing the forgivingness of their
constructs, and increasing their explanatory power about their workflow, at the same time as we start to work
with increasingly short call stacks and increasing agnosticism about whether operations are asynchronous.

### Signals from selectors

So what have I managed to do about this?

A significant painpoint in the implementation of my [Codestrates](https://codestrates.projects.cavi.au.dk/)-like in-browser IDE related to the moment of construction
of the editor pane for a particular layer. The requirements of this editor (in Infusion, the layers it needs to load for its own implementation)
can't be known in advance since they are content and context-dependent, yet the user expects it to appear directly and become focused in response to a mouse click.
This was one of the sites where my summer demo banged horribly on framework internals and also was not even
prepared for the discipline of asynchronous layer discovery and loading. Now, this site looks like this:

```
    editorHolderForLayer: {
        $method: {
            func: async (editorsPane, layerName) => {
                const children = fluid.liveQueryILSelector(editorsPane, "fluid.editor");

                await(fluid.signalToPromise(children));

                return children.value.find(child => child.layerRec.layerName === layerName);
            },
            args: ["{editorsPane}", "{0}:layerName"]
        }
    },
```

You can go through the interaction which passes through this site by opening up the [simple SFC Todo List demo](https://fluid-project.github.io/infusion-6/demo/todo-list-sfc/),
pressing the Edit button at the top right, and then double clicking on, say, the pale blue `fluid.demos.todoApp` layer at the top.

The code knows that it expects some kind of `fluid.editor` to be instantiated below a node (`editorsPane`) in the substrate tree,
but it can't know exactly when or what its type or address is going to be. However, it knows that when it does construct, it
is going to be the one whose `layerName` matches the one that was clicked on. The new construct `fluid.liveQueryILSelector` is
strongly analogous with live selector queries that we are familiar with in jQuery-era DOM manipulation, only in this
case it returns a signal for a component, which will produce an *available value* when the reactive graph that it addresses has settled.
We can then directly gear this into an `await`able `Promise` by passing it through `fluid.signalToPromise`.

I'm pretty pleased with the improvement here and it also seems to have resolved a nasty race condition which would
sometimes observe when loading the IDE. Whilst in plain JavaScript it is somewhat clunky, I find it fairly readable and
feel it could plausibly be "sugared away" into a future [integration language](/term/integration-domain).

### Anticipatory construction

Another improvement I've made in this period is to relax a central dogma that I'd subscribed to after bad experiences in "old Infusion", that
one should refuse to even start to instatiate a component until all of its layers are defined. In old Infusion, there
were some bad ergonomics related to a layer whose definition was completely missing being treated as equivalent
to an empty layer, meaning that typos in layer names were hard to diagnose. But since Infusion 6 is a fully
reactive system with a notion of [unavailable values](/term/unavailable-value),
we can now distinguish between a value which is permanently missing as a result of misconfiguration, and one which is
temporarily missing because it depends on I/O which has not completed yet.

In several situations, for example when implementing SSR, it became necessary to know what DOM node, and hence
which document, a component was bound to, before knowing anything
about it at all other than that it was a view component. It became clear that the system needed to be able to make
progress on the layer merging algorithm as soon as any information was available, whilst at the same time marking the overall
component value as unavailable until all of its layers were loaded.

### Mapping the infinite world

Another crucial improvement during this period is allowing layers which have already loaded to map the space of 
other layers which might potentially load if their names are demanded, using an  `$importMap` construct, inspired
by the similarly named highly useful ES6 feature[^4]. This definition of an import map attached to a layer definition  

```
fluid.def("fluid.edit", {
    $layers: "fluid.viewComponent",
    $importMap: {
        "fluid.fullPageEditor": "%fluid-edit/sfc/fluid-fullPageEditor.vue"
    },
    ```
```    

will ensure that when a component with the `fluid.edit` layer enters the substrate, the definition of layer `fluid.fullPageEditor`
will become resolvable for a further component with that layer which starts to instantiate[^5]. 

This definition collaborates with a *module definition* for `fluid-edit` which establishes a related family of
strategies for resolving layer definitions, perhaps via HTTP, local storage or AutoMerge, etc. which definition would typically
be made by a different substrate author. In this case, the definition is placed directly in the DOM substrate by the
head integrator with a DOM node

```
    <fluid-module id="fluid-edit" src="../../src/framework/edit"></fluid-module>
```

I'm excited that this dreamed-of alternative workflow for construction,
anticipation of construction, and mapping the space of on-demand adaptation is already real. In another posting I will explain the complementary work I've done in
making the underlying reactive primitives more explainable (being able to trace notifications back to their causes) and
more forgiving (being able to deal with bidirectional and cyclic graphs) in the cause of infinite, or at least indefinite,
software.



[^1]: How I see these "infinite apps" is as a swarm of trillions of small, isolated tough steel spheres, malevolently
fuelled by the planet-busting emissions which produced them, reminiscent of the iconic Dr. Who villain 
[the Toclafane](https://tardis.fandom.com/wiki/Toclafane) which is apparently a possible fate of the human race.
[^2]: OED sense 2: Universally prevalent: said e.g. of substances, actions, laws, principles, customs, conditions, etc.
[^3]: A classic member of this genre is the [spineless, tagless, G-machine](https://dl.acm.org/doi/pdf/10.1145/99370.99385)
which executes programs written in functional languages more efficiently through having erased any type information ("tags") 
that might make the running program state externally intelligible, and operates through repeated graph reduction
in which the causes of execution are steadily erased.
[^4]: Note that an important aspect of Infusion import maps is that they are fully reactive, unlike ES6 import maps which [may not be modified](https://tomashubelbauer.github.io/esm-import-map/)
after the moment any module begins to load.
[^5]: A mature design would put these definitions elsewhere, perhaps mediated by their own reactive datasource, but this
is fine as an illustration.
