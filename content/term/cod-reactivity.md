---
title: Cod reactivity
categories: ["term"]
---

Cod reactivity (by analogy with [Cod Latin](https://en.wikipedia.org/wiki/Cod_Latin))[^1] is a kind of semi-literate
adoption of reactivity, reflecting either deficiencies in the underlying reactive implementation or the user's
understanding of it.

Typical of cod reactivity is the use of "broken graphs" --- rather than being joined up into a coherent and connected
overall application graph, the reactive graph is broken up into several formally isolated reactive islands. These are
either self-standing little patches of reactivity, cranked manually by imperative updates to source signals, or else
orchestrated by means of effects which bridge updates from one island to the other.

The need for cod reactivity can often motivated by deficiencies in a reactive API which presents itself in an
insufficiently malleable way, forcing undesirable foresight into the architecture's wiring of the reactive graph.

The ill consequences of applying cod reactivity, as well as loss of reasoning power about the layout of application
dependencies, most seriously include the loss of [glitch avoidance](/term/glitch/), since the reactive system no longer has global
oversight of the structure of the reactive graph.

Here is a relatively harmless though crass example of cod reactivity in imerss-bioinfo's data filtering framework (this is written
in Infusion 4's interim reactive system layered on top of preact-signals): 

```
fluid.defaults("hortis.filters", {
    components: {
        filterRoot: "{that}"
    },
    members: {
        allInput: "@expand:signal()",
        combinedFilterInput: "@expand:hortis.combinedFilterInput({that}, {that}.options.filterGradeName)",
        lastEvaluatedInput: null,
        scheduleFilter: "@expand:fluid.effect(hortis.scheduleFilter, {that}, {that}.combinedFilterInput, {that}.idle)",
        // TODO: syntax for unavailable literal on startup
        allOutput: "@expand:signal()"
    }
});
...

hortis.scheduleFilter = function (that, combinedFilterInput, idle) {
    if (idle && combinedFilterInput !== that.lastEvaluatedInput) {
        that.lastEvaluatedInput = combinedFilterInput;
        window.setTimeout(() => hortis.evaluateFilter(that, combinedFilterInput), 1);
    }
};

hortis.evaluateFilter = function (that, combinedFilterInput) {
    const {filterStates, filterComps, filtersActive, allInput} = combinedFilterInput;

    let prevOutput = allInput;

    for (let i = 0; i < filterComps.length; ++i) {
        const filterComp = filterComps[i];
        const filterActive = filtersActive[i];
        const filterOutput = filterActive ? filterComp.doFilter(prevOutput, filterStates[i]) : prevOutput;
        prevOutput = filterOutput;
        if (fluid.isUnavailable(prevOutput)) {
            break;
        }
    }
    that.allOutput.value = prevOutput;
};
```

The problem here is that `hortis.evaluateFilter` which should be a `computed` in fact breaks the reactive graph
by being implemented as an `effect`. This is primarily a failure of malleability --- `hortis.filters` is meant
to be a reactive graph element which connects signal `allInput` to `allOutput`, but we can't write the definition
of `allOutput` as a `computed` until we have seen the full set of filters around the application which need to be
wired into the filter bank. Traditional reactive systems such as preact-signals don't allow signals to change
category between stateful and computed signals or let the computation of a computed signal be rebound, although
in [Understanding Reactivity](/wip/2025-12-15-understanding-reactivity/#milos-golden-malleability) I write about
how Milo Mighdoll's Reactively framework unusually has this flexibility.

A much more significant kind of cod reactivity can be seen in the current \[July 2026] Infusion 6 mechanism
for lensing a boolean signal into the conditional presence or absence of a component. Since this has what are arguably side-effects on 
the structure of the reactive graph, this is necessarily implemented as an effect, which looks like this:

```
shadow.frameworkEffects["conditionalComponent-" + segs.join(".")] = fluid.cell.effect( () => {
    const value = fluid.deSignal(sourceSignal);
    if (value && !fluid.isUnavailable(value)) {
        computer = fluid.pushSubcomponentPotentia(shadow, key, expanded, null, sourceLayer);
        togo.set(computer);
    }
});
```

There's no way out of a conundrum like this without fundamentally reforming the ontology comprising signals, computeds,
and effects. This needs to become a more refined ontology which is able to distinguish between different categories of
priority in reactive computations ---
shading the spectrum of reactive primitives between computeds and effects rather than making
a categorical separation between them. This work is described in my recent article on 
[fully deferred stabilization](/post/2026-06-28-fully-deferred-stabilization/) which views a reactive engine
as being parameterised by the data structure forming its work list: This needs to move from being a stack (whether
the program stack, or an explicit stack) to being a priority queue.

All the same, cod reactivity could take one quite far. Ken Tilton, primordial reactive guru,
[himself noted](https://github.com/kennytilton/matrix/wiki/introduction#glitches)
when speaking of glitches in his reactive systems Matrix/Cells that

> Matrix itself delivered complex enterprise software while still vulnerable to glitches, but eventually
> they broke an application and had to be resolved.

and modern Infusion's "give every reactive cell an intelligible global name" goes a long way to making cod designs
fairly intelligible. But a mature reactive system delivering strong consistency and provenance guarantees will in
the end have to become cod-free.

[^1]: E.g. "Ovum crackus, totale knackus"
