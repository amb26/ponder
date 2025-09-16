---
title: Co-occurrences are here again
date: 2025-04-21
---

Reimplementing Infusion for its reactive version made me vow to concentrate on its everyday, bread and butter
features at the expense of what might have been "speculative nonsense" in its earlier history. However, implementing
something pretty basic &ndash; the ability to render lists of components &ndash; brought me right back to an old
conversation.

Here's the situation &ndash; one author wrote a `todoItem` which is a `templateViewComponent`:

```
fluid.def("fluid.tests.todoItem", {
    $layers: "fluid.templateViewComponent",
    template: '<span class="todo tag is-large">@text<button class="delete is-small"></button></span>'
});
```

Another author now wants to iterate over a list of these items:

```
$component: {
    $layers: "fluid.tests.todoItem",
    $for: {
        source: "{forTodo}.todos",
        value: "todo",
        key: "todoIndex"
    },
    text: "{todo}.text"
}
```

What kind of component ends up this path? One author has contributed that it is a view component, and another has
contributed that it is a list. Given these two separate contributions we need to determine that it is more
than the sum of its parts &ndash; a `fluid.listViewComponent` whose job it is to collect markup from all its
children and contribute it into the document.

In a conventionally structured programming language this would fall under the heading of 
[multiple dispatch](https://en.wikipedia.org/wiki/Multiple_dispatch) which for a while had mostly been implemented in relatively
esoteric languages but is over time becoming more mainstream.

Infusion as a substrate folds together design time and run time, and also does not focus on execution. Our rendition of this
notion was called co-occurrence, written up in the 2018 paper
[An Anatomy of Interaction: Co-occurrences and Entanglements](https://www.shift-society.org/salon/papers/2018/revised/anatomy-of-interaction-authorversion.pdf).
There's a lot of excess detail there, but the kernel of the idea is pretty simple &ndash; given parts of the design where
two or more (layer) names occur together ("reactants"), the system can contribute some extra layer names looked up from the
co-occurrence ("product"). Now that all of the system will be reactive, we can do far better than old Infusion ever could and
don't need to construct fresh components as the products using a dedicated engine. An existing component can simply be
adapted in place &ndash; but the configuration has just the same form as the old Infusion
API [makeGradeLinkage](https://docs.fluidproject.org/infusion/development/IoCAPI#fluidmakegradelinkagelinkagename-inputnames-outputnames).

We're in a hurry now and given this has only arisen in the design of Infusion itself rather than in a user program
we don't need a general facility yet and can just quickly hack this using a global array:

```
// In Fluid.js
    fluid.coOccurrenceRegistry = [];

...

// In FluidView.js
    fluid.coOccurrenceRegistry.push({
        inputNames: ["fluid.viewComponent", "fluid.componentList"],
        outputNames: ["fluid.viewComponentList"]
    });

```

Funny to meet this old friend again, but I guess given this idea is already inscribed into my model of how I think
programming should be, it shouldn't be a great surprise to have it reappear.

But I can't help feeling a general issue emerging that a rendition of this multiple dispatch/co-occurrence concept is
an essential part of the responsibilities of a competent [integration domain](/term/integration-domain). This is because
the core responsibility of such a domain is to integrate and synthesize intentions which emerge in different places.
Taking this kind of responsibility out of the domain of code (execution) feels like a helpful disempowering of that domain.

Implementing this, however, raised a few knock-on issues:

### Reactive control flow

Firstly, this kind of "recurrent" computation sits uneasily with conventional reactive primitives.
At a low level, there now needs to be a `while` loop which repeatedly iterates over co-occurrences until no
further ones arrive. Staring at the inside, say, of `fluid.flatMergedComputer"

```
    fluid.flatMergedComputer = function (shadow) {
        return computed(function flatMergedComputer() {
            const {layerNames, mergeRecords} = shadow.potentia.value;
            const memberName = shadow.memberName;
            ...
        }
    });
```

I boggle a bit that it is all several `computed` deep and that it can't do anything about returning any "provisional"
values until it is completely sure of them. Any more complex control flow needs to be pushed into the deepest
nested reactive level where everything consists of conventional values which I guess is as it should be, but makes me
want to unbundle the contract of reactive primitives rather more. Hammer et. al's [miniAdapton](https://arxiv.org/pdf/1609.05337.pdf)
looks like it loosens this a bit by being better at allocating reactive values during a computation (but is it really
better than state of the art computeds?) but I think this could go further. Two main directions &ndash; dealing with
cyclic or bidirectional relations, and arranging for "computed" values to be writeable. They are in a sense the same
direction &ndash; can this be achieved without creating a chaos?

We can get away with a simple implementation here because the accumulation is "monotonic" &ndash; we can
make use of the same `hierarchyResolver` and all of its reactive contents. Note that if there were any changes
to the co-occurrence registry, we'd likely have to recompute everything in the world &ndash; if we wanted to do this
in a principled way we'd have to create "fake" reactive dependencies on all of the `inputNames`? For a start,
typical frameworks don't let us create fake dependencies, data actually needs to be seen to change. This is in the same
category of our problem with "reactive scopes" which have to pool together a number of separately reactive records
into a bigger one. How reactive in practice do we need the system to be? An idea twigged recently that React really
*is* in a sense reactive since it just reruns everything from top-down whenever anything changes. It is bone-headedly
reactive but still ended up being highly usable by millions.

### Possible return of merge policies

Secondly, this exposes the fact that layer names are not currently being accumulated properly. In test cases so far there's never been a design
where layer names have themselves been drawn from more than one layer, and there's right now just the most basic "last write wins"
model. This implies that yet another old Infusion chestnut, [merge policies](https://docs.fluidproject.org/infusion/development/OptionsMerging#use-of-fluidmerge)
needs to come back too. Again, this can just be in a very basic form since there's no demand for it in user programs.
This was perhaps the biggest contributor to the massive inefficiency of old Infusion and can now be close to zero
overhead once we implement a kind of "inline cache for the merged layer registry". But as with co-occurrences since this
isn't emerging in user programs yet we can for the time being hack this very simply but reminiscently:

```
fluid.staticMergePolicy = {
    $layers: {
        [$m]: fluid.arrayConcatPolicy
    }
};
```

[Edit 2025-04-22:] It turns out merge policies are not returning just yet &ndash; rather thankfully. The above merge
policy is no use without even further unnecessary complexity (such as "local merge policies") because the only
way we can express the output of the [C3 algorithm](https://en.wikipedia.org/wiki/Draft:C3_linearization) we use to linearize
layer hierarchies is to push it to the top of the layer stack so that it definitively trumps any previous attempts
to assign layers. In tidying this up we also presented a slightly better front end to C3 which up front accepts an
array of layer names rather than the single "class name" in the classic implementation. This means we don't need
to do weird stuff when the user writes (in that rare, exiguous world of direct function calls) an instantiation like

```
fluid.someComponent({
   $layers: "fluid.someParent"
})
```

which would otherwise require us to create some special node in the layer graph representing this single instance's
layer hierarchy. Thus we squarely align ourselves with Gilad's other great direction forged in his [Newspeak](https://newspeaklanguage.org/)
system &ndash; that "kinds of things are just things too" &ndash; which can be seen as a generalisation of the notion
of protoypal inheritance, another ancient paradigm whose time is to come.
