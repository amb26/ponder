---
title: Josh Horowitz Review
date: 2025-10-07
---

Last month I received some great feedback and searching questions from [Josh Horowitz](https://joshuahhh.com/) about
my [2025 Live](https://www.youtube.com/watch?v=ai2fbWi3kUU) submission. Whilst
it was rejected this time round, the submission achieved its aim of engaging with the most thoughtful minds in the field,
and starting the long process of sharpening up these ideas so that they can be widely intelligible and adopted.

There's been no substantial writing on Infusion's goals since the 2018 [Open Authorial Principle](/papers/onward-2016.pdf)
and since then both the ideas and implementation have evolved significantly. Since it looks like another big paper
is some way off this looks like a good opportunity to respond to the questions inline and continue the conversation until
I'm in a position to write up the system properly.

> I am a big fan of this line of work: defining new materials for software that allow open modification and reconfiguration.
> Substrates! Malleable software! These are visions for much more deeply "live" programming than is usually presented at LIVE.
> So I am heartened to see this system presented.

> So what does this submission contribute to this line of work? It's not 100% clear to me.

> From the outside, the things you show Infusion doing seem roughly similar to things I've seen Varv do. Indeed, you borrow your
> "assignable todos" demo from Varv. So your contribution must not be "look what I made this system do in these demos!",
> since these demos have already more-or-less been done.

> A platform like Infusion is largely characterized by its ontology (what is the computational material made of?) and its
> mechanisms (how do these parts interact and create behavior?). Your presentation shares some small bits of this.
> We learn that an Infusion app consists of "layers", which can be merged (how? when?) and refer to each other.
> But there's so many questions of ontology and mechanism which gets skimmed over. For instance:

> – The video shows fluid.demos.todoItem.withAssignee being added as an extension of fluid.demos.todoItem.
>     1. How does this extension work internally? Is it a full re-write of the original todoItem? Or does it partially extend it?
>     2. How does this extension come to be active in the environment?
> – What system determines which version to use, when both the old and new versions exist in the computational universe?

Infusion's layers are merged in a live way through a reactive version of the aligned, recursive dictionary merge
system which is standard to algorithms like [lodash.merge](https://lodash.com/docs#merge),
[jQuery.extend](https://api.jquery.com/jQuery.extend/) or [Python deepmerge](https://pypi.org/project/deepmerge/). 
Infusion contextualises this merge algorithm in the following way:

* Each layer has a globally unique *namespaced name* such as [`fluid.demos.todoList`](https://github.com/fluid-project/infusion-6/blob/main/demo/todo-list-assign/sfc/fluid-demos-todoList.vue)
* The ordering of parent layers to be merged is determined by the standard [C3 linearisation algorithm](https://en.wikipedia.org/wiki/Draft:C3_linearization)
applied to layer names stored in a layer property `$layers` which holds one or more parent layer names
* The contents of each layer are considered immutable for the purposes of the merge algorithm, and whilst any form of
JS object is permitted within layers, any material not directly descended from `Object` or `Array` will be considered atomic
and not cloned or recursed over
* The algorithm is fully reactive both respect to any layer contents and layer geometry determined by `$layers`
* The provenance of the resulting merged structure is tracked in a `layerMap` which records for each merged path the
name of the topmost layer which is responsible for it 

The resulting merged structure forms the configuration for an Infusion *component* which reads the topmost visible layer
at each path and uses it to construct some live material from it. This may be a plain reactive value that just consists
of the layer's value itself, a reference to a live value elswhere, or may be a reactive computation designated by `$compute`,
a reactive effect designated by `$effect` or one of a small number of other things.

So answering question 1. [`fluid.demos.todoItem.withAssignee`](https://github.com/fluid-project/infusion-6/blob/main/demo/todo-list-assign/sfc/fluid-demos-todoItem-withAssignee.vue)
is a layer which is applied on top of a component's existing [`fluid.demos.todoItem`](https://github.com/fluid-project/infusion-6/blob/main/demo/todo-list-assign/sfc/fluid-demos-todoItem.vue)
in order to extend it. Other questions answered below.

> – It looks like the original todoList system explicitly exposes an "filters" extension point, so that extensions can contribute filters.
> Is that right? In that case
>    1. What mechanism allows multiple extensions to contribute to the same extension point?
> (I'm reminded here of CodeMirror's "facets" system for extensions, but I don't know if you're doing anything similar.)
>    2. This example suggests that much of the extensibility of Infusion comes from "cooperative" extensibility
> (deliberately exposing extension points), rather than "preemptive" extensibility
> (having the material be inherently extensible, so extensions can be performed in ways unanticipated by the original
> application's authors). Do you agree with this assessment? If so, does this limit the malleability of systems made with Infusion?

"cooperative" vs "preemptive" is a great distinction. In fact Infusion does support fully preemptive extensibility given any part
of any component can be overridden by a higher priority layer. But in many cases it feels that preemption isn't the most
attractive route to creating a design which can be simultaneously intelligible to different authors. In the case of the
todoList we have a fundamental problem of multiplicity. Here's the base definition of the todoList before any filtering
was considered:

```
fluid.def("fluid.demos.todoList", {
    $layers: "fluid.sfcTemplateViewComponent",
    todos: {
        $reactiveRoot: []
    },
    todoItems: {
        $component: {
            $layers: "fluid.demos.todoItem",
            $for: {
                source: "{todoList}.todos",
                value: "todo",
                key: "itemIndex"
            },
            text: "{todo}.text",
            completed: "{todo}.completed"
        }
    },
...
```

And here is the definition with filtering:

```
fluid.def("fluid.demos.todoList", {
    $layers: "fluid.sfcTemplateViewComponent",
    todos: {
        $reactiveRoot: []
    },
    filteredTodos: {
        $compute: {
            func: (filters, todos) => {
                return todos.filter(todo => filters.every(filter => filter.accept(todo)));
            },
            args: ["{filters fluid.demos.filter}", "{self}.todos"]
        }
    },
    todoItems: {
        $component: {
            $layers: "fluid.demos.todoItem",
            $for: {
                source: "{todoList}.filteredTodos",
                value: "todo",
                key: "itemIndex"
            },
            text: "{todo}.text",
            completed: "{todo}.completed"
        }
    },
```

There's an authorial faultline that has to open up as we consider that in the first design, `{todoList}.todos`
refers to the very same piece of data that was fetched from persistence, that is, "the list which is rendered
is the same one which was fetched", and in the second design there must be a discrepancy since the list is not
the same since it has been filtered. Infusion would perfectly well allow either the entire definition of
`todoItems` to be overridden or even simply the reference held at `todoItems.$component.$for.source` but the fact
remains that these two authors can't comfortably live in the same authorial universe since one of them
sees two objects whilst the other sees one. I talk about these multiplicity problems in my 2018
[Semprola critique](https://www.shift-society.org/salon/papers/2018/critiques/critique-semprola.pdf) and they seem
like the most problematic mismatches preventing different authors from sharing a design. I think there are some
contortions that could be done with naming and structuring in the substrate[^1] but on balance it seems safer not to be too categorical
about the value of reuse in this situation and instead say that these authors have to consider that they are
parts of different designs, one with filtering and one without. Once we have admitted that there is *some* filtering,
it is possible to be quite open in how filters are written and contributed. The first argument to `filteredTodos.$compute`
takes the form of a selector query `{filters fluid.demos.filter}` which evaluates to a reactive collection
of any components nested below our `filters` which include a `fluid.demos.filter` layer. This allows for the kinds of "spatial queries" that are
used in Geoffrey Litt's [Potluck](https://www.inkandswitch.com/potluck/) system, supporting substrated-oriented open
extension with new kinds of filters.

So on balance, I would say that whilst total preemption is supported, it feels preferable in some scenarios to cooperatively
prepare the ground for certain kinds of extension.

Answering the question 2. how does the extension come to be active, it is through a mechanism named
"layer linkage" which is a simplified version of the "co-occurrence"
system described in [Basman et al, 2018](https://scispace.com/pdf/an-anatomy-of-interaction-co-occurrences-and-entanglements-2f41pz9lip.pdf).

Firstly, the checkbox state is geared into the substrate via a
[conditionally constructed component](https://github.com/fluid-project/infusion-6/blob/main/demo/todo-list-assign/sfc/fluid-demos-assigneeControl.vue), with a `$if`
directive bound to the checkbox state:

```
fluid.def("fluid.demos.assigneeControl", {
    enabled: false,
    assigneeLinkage: {
        $component: {
            $if: "{assigneeControl}.enabled",
...l            
```

Secondly, the component whilst it is in the substrate exposes a specially recognised `$linkage` record which reactively
contributes further layers onto any components in the tree matching a selector describing a co-occurring set of layers
(in this case just one layer each)

```
    $linkage: [{
        inputLayers: ["fluid.demos.todoItem"],
        outputLayers: ["fluid.demos.todoItem.withAssignee"]
    }, {
        inputLayers: ["fluid.demos.todoList"],
        outputLayers: ["fluid.demos.todoList.withAssignee"]
    }, {
        inputLayers: ["fluid.demos.filters"],
        outputLayers: ["fluid.demos.filters.withAssignee"]
    }, ]
```

In this way the three different levels of the application which need to be adapted to refer to the new facet become
simultaneously adapted:

* The item itself, which needs to show its assignee and let it be chosen
* The overall list, which becomes a source for the list of assignees and allows items to be assigned to them
* The set of filters, which needs to include the filter definition to filter items by assignee and the control for choosing this

> – Just how does this system differ from Varv?

Some big differences with Varv are: 

* Infusion permits differential extension of both the app definitions and the rendered markup.
[`fluid.demos.todoItem.withAssignee`](https://github.com/fluid-project/infusion-6/blob/main/demo/todo-list-assign/sfc/fluid-demos-todoItem-withAssignee.vue)
is a `partialViewComponent` which doesn't need to repeat the markup definitions from the component it is extending – instead
it can direct the renderer to composite together just the extra piece of template relative to some landmark in the
existing content, through a definition like `relativeContainer: "after: .item-text",` which indicates that the written
template which just holds the dropdown should be injected directly after the selector match of `.item-text`
* Infusion is wholly reactive as regards adaptation, and incrementally computes the substrate contents from its
constituent layer definitions and data at each moment. This means we don't need to do anything special
when adaptations happen – the user's data naturally "slips along" the substrate surface in its own layer.
This produces a general framework for state-preserving live adaptations of the kind seen in [Hyperclay](https://docs.hyperclay.com/docs/how-hyperclay-works/)'s
"Strip-Save-Restore" cycle. In Varv user state must be explicitly reread from data stores after the model
is rebuilt following a change in concept structure.

Varv also doesn't fully form a "substrate" in the strongest sense – the definitions in it are not referred to a global
coordinate system so it's hard to see how they can themselves be targetted for extension, or
how to access these extensions via navigation over the running application. It isn't built
out of a homogeneous material because its "concepts" live at a meta-level of design to the data which is being
operated on. In Infusion, this is organised somewhat differently. Infusion data and system design are co-located in a single-rooted, consistently
addressed tree structure. This allows the system to operate on itself at its own meta-level, deriving adaptations from
data held in the system (e.g. the "Assignee Facet" checkbox in the UI) and recruiting them in a cross-cutting way 
across multiple levels of design as the example shows. Note that, for example, Varv's design doesn't provide the
3rd adaptation listed above, to show a collection of filters whose members are drawn from a set of different concepts, nor for
allowing control over the set of concepts in play to be derived from the substrate's own contents.

Finally, the role of computation. Whilst Varv does allow concepts to be decorated with arbitrary JavaScript, it 
includes a core ontology for computation in its concept meta-level via logical primitives
such as [FilterAnd](https://varv.projects.cavi.au.dk/api/varv/FilterAnd.html) and action primitives such as
[PrependAction](https://varv.projects.cavi.au.dk/api/varv/ArrayActions.PrependAction.html). In Infusion's
description, the substrate forms a relational algebra/integration domain in which computation is not described. 
Instead this is outsourced to the host system, in this case performed by conventional JavaScript
syntax for logical operators and array assignment, etc. ensuring that experience gained in this area can be shared
with conventional development communities. 

> I feel like questions like these are the tricky bits substrate systems need to grapple with. But your presentation didn't go into them very much.

#### Other things I'm curious about, roughly chronologically

> – You note that "One of the most important aspects of Infusion development is that the rendering process
> is not simply a one-way function." As far as I can tell, the only consequence of this aspect you show
> is that you can hover a node in the outline (the "substrate") and see its rendered representation and visa versa.
> This is great, but it's also something we are all very used to from development dev tools
> (e.g. for the DOM tree, or the React component tree). So if this is indeed an important aspect,
> I'm going to need more explanation of "why" that goes beyond this familiar development convenience.

Thanks, there was clearly more to unpack here than I went into. It's true that this is by now a very familiar interaction – 
half of the Live submissions this year featured some kind of bidirectional updating interaction. I think it's worth
drawing a distinction between the two examples you gave – the DOM, and React. In the case of the DOM, the browser is
using just the same front door API that the developer uses in order to render its view, whereas in the case of React,
with its unidirectional dataflow idiom, the devtools need to go behind the back of the visible contract in order to 
produce the interface. For example, devtools need to be aware of the details of the [React Fiber](https://github.com/acdlite/react-fiber-architecture)
architecture and become invalidated as these implementation details change. Whilst this could seem a technical detail,
it's my aim in Infusion to support an ecology of authorship around public representations and publicly addressed state
which don't privilege particular kinds of tools or workflows, and allow everything one needs to work on a system to
be delivered along with it. The fact that the DOM API is public and consistent is what allows the DOM to represent
a substrate (as seen in Webstrates), whilst React and similar systems fail to do so. 

> – You show how the "todos" data is contained within the "todoList" view component.
> I get the sense that incorporating data into your substrate is an important design aspect.
> It feels under-explained here. This feels like an interesting novelty of your system.
> I didn't really understand how Infusion serves as an example of transclusion. In part this is
> because my understanding of "transclusion" is grounded in the idea of one media artifact transcluding parts of
> another media artifact. I don't usually think of, say, one application transcluding parts of
> another. (I'm not sure Ted Nelson cares very much about that sense of transclusion.)
> I am left wondering in what sense what you show is different from one conventional React project
> importing and using components defined in another React project.

There's a good distinction between "importing components" at the (traditionally hidden) source
level of a system, and "transcluding content" which is part of the visible surface that is interacted with. So
including a React component is part of a private contract between technicians, using specialised tools on a hidden
representation, which is a capability denied to those using the running system. The React devtools aside, it is 
essentially impossible to make use of the knowledge that a system is built using React, in order to get useful access
to the component definitions which form part of it and adapt them into another system.

In Infusion, the distinction between the visible material, and the definitions which are responsible for it,
is largely closed up – since it is possible to query any bit of the visible system to find the corresponding piece of
substrate, and then go from there (via the provenance of the coloured layers) to the definitions responsible for it.

In talking with Clemens I think it's clear that the next Infusion talk/demo needs to foreground this story and show how one could use its
substrate nature to perform wholesale adaption of an existing system to another one on the outside, rather than just
the internal adaptation in this demo. Clemens called this idea "inheriting from entire apps" rather than just
inheriting from the individual layers that constitute the app.


> – The demo of "direct editing of the UI" is enticing. However, it is not clear to me how it synergizes
> (or doesn't) with Infusion's unique substrate qualities. As is, it feels orthogonal.
> And we all know that direct-manipulation editing of programmatic output is a very tricky problem...
> the basic string-editing you're doing feels like a barest hint of what would need to be done for a practical system.

> – I did not understand the "reactive relational algebra" claims. I also do not understand how Infusion functions as an integration domain.

These need to be explained far better. Infusion is reactive in the traditional sense since the visible application is
derived reactively from the constituent layer contents. It is a kind of relational algebra because the correspondence
between the visible application and the constituents can be traversed, using public information, in both directions. 
The recursive merge operation through which the visible application is composited can be considered a kind of
information-preserving (if one considers in scope the deep stack of "buried" definitions which have been overriden) "join" operation
which is part of the algebra. Infusion functions as an integration domain because it follows 
Stephen Kell's notion of [interface hiding](https://www.humprog.org/~stephen/research/papers/kell09mythical.pdf) whereby
the reactive values which are traded in the information domain do not expose the source-level interface which they
depend on. Infusion's tooling doesn't currently enforce this, but only the parts of the substrate which are
JSON-equivalent and so can be straightforwardly serialised are considered part of its public representation. 


> – I was excited to see examples of previous versions of Infusion in use. However, the artifacts
> you show here look like conventional websites, and the story you tell of the creation of these
> artifacts is indistinguishable from conventional web-development stories.
> I would love to hear more details about how Infusion changed how people were able to work together,
> or some other novel aspect, but they're not in this submission, so these examples don't seem to contribute much.

Yes it's true that they contribute little to the technical explanation but I was hoping they would serve as examples
of the communities which Infusion has been serving and which I hope to serve better through producing better substrates.

To the extent these communities have benefited from (old) Infusion's substrate nature, it has been due to the fact that
their preferred authoring tools and computational idioms, R and R markdown, are quite distant from the web, 
and I have been developing workflows to allow content authored in these to be
"[reknitted](https://lichen-community-systems.github.io/knitting-data-communities/#mxcw)" into more interactive forms.
This to a certain extent unpicks the "[knitting](https://cran.r-project.org/web/packages/knitr/index.html)" process
where R markdown produces not terribly interactive web content, and reknits the content into a more interactive and
compelling form.

This was aided by old Infusion's orientation to composing applications by recursively merging JSON blocks rather than
expecting the end users to write source code, and its happiness to
bind to markup produced by foreign systems rather than expecting to render an entire application interface wholesale.

Whilst this story seems somewhat distant from the values of the live programming community, I'm hoping to show that
the values of open authorship are key to unlocking greater power from live interactions. I find a similar situation
in the context of local-first programming where it feels that bringing a different ontology to software construction
could serve these communities better without necessarily foregrounding their values. But there's clearly a big gap
to bridge here and I really welcome the thought the Live community have been willing to put in, to help bring
clarity to these so far poorly expressed ideas.

[^1]: See slide 11 in
[Openly authored data pipelines](https://docs.google.com/presentation/d/12vLg_zWS6uXaHRy8LWQLzfNPBYa1E6L-WWyLqH1iWJ4/edit?slide=id.ge3dc635994_0_27#slide=id.ge3dc635994_0_27) – 
on paper this seems to solve the problem "How to present one author with a modified artefact which bears the same name
as another author's unmodified artefact" by means of a scoping trick letting one author see it as `joined` and another
see it as `joined.joined` but I can't think how a UI could really let this seem graceful and natural.
