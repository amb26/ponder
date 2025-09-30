---
title: The Module System Once More
date: 2025-09-30
---

It finally seems to be time to do something decisive about this issue which seems to have been pending for longer
than I've been alive, the Infusion Module System. There are [Notes on the Infusion Module Loader](https://fluidproject.atlassian.net/wiki/spaces/fluid/pages/11643260/Notes+on+the+Infusion+Module+Loader)
and [Notes on Modularisation of Infusion](https://fluidproject.atlassian.net/wiki/spaces/fluid/pages/11527165/Notes+on+Modularisation+of+Infusion) 
as well as ancient [tickets](https://fluidproject.atlassian.net/browse/FLUID-5521) 
going back as far as 2014 which read as if before the era of the printing press. The landscape has changed profoundly
since then - 

* There are numerous other package managers than npm for node, and even npm changed its module layout pretty significantly
* There are several alternatives to node itself for JS on the server
* Various monorepo orchestrators solve many of the problems described here
* The already highly confused state of JS module loading, which had 5 major competing variants then, has been totally
shredded by the "nuclear option" of ES6 modules with their impermissive "viral" footprint - only an ES6 module can load
another ES6 module.

On the other hand the way we are thinking about Infusion itself, as a "reactive-first" system, has changed significantly too.
This promises to ease several of the deeper conundrums around how Infusion coexists with code loading schemes, and more
deeply, how it is meant to cooperate with a "foreign Infusion" that it finds loaded into a neighbouring context.

There had been a long-standing plan[^1] to split the responsibilities of Infusion into two parts, `fluid-store` responsible
for storing an retrieving grade (layer) definitions, and `fluid-runtime` which actually animated them in a particular
context. The dawn of reactivity implies that essentially anything can be a `fluid-store` (a git url? an automerge doc?
the end of a WebSocket?) and so perhaps little to do there now.

#### When one Infusion meets another

The great conundrum of "how many runtimes" remains - the mission of Infusion to be a universal, catholic substance crossing
all boundaries hits the metal when two apps load slightly different versions of Infusion using their respective module
loaders and then expect to share layer definitions and component references. As I say, with reactivity this is all much
more doable and hopefully without the horrors of
stuf like [membranes](https://www.researchgate.net/publication/220828927_Proxies_Design_Principles_for_Robust_Object-oriented_Intercession_APIs)
implied by taking the proxy model to its conclusion.

I'm perversely proud of the "[look 5 directory levels above you](https://github.com/fluid-project/infusion/blob/main/src/module/fluid.js#L194)"
filesystem inspection scheme that was used to arbitrate between multiple Infusions loaded by npm in the same module tree but
it's clear the world no longer has room for such a thing.

#### Start simple - consolidate build code

In the short term what needs to happen is to unify all the [build code](https://github.com/IMERSS/xetthecum-storymap-story/blob/main/src/js/reknit.js) [lithified](/term/lithification) all around our
various visualisations into something shareable, and, for example, enable the use of `%self` to allow such
build code to refer to its own module. This code is still touchingly using the name `maxwell` in honour of the
[Maxwell Creek Watershed Project](https://github.com/IMERSS/maxwell), the first paid work I received after leaving the
IDRC and the site of our very first "reweaving/[reknitting](https://lichen-community-systems.github.io/knitting-data-communities/)" workflow.

This use of `self` raises spectres of Gilad's [Modules as Objects in Newspeak](https://bracha.org/newspeak-modules.pdf) which
I really do think is where we need to go, but there's a lot of water to go under the bridge before we can think of mounting
content hosted by foreign Infusions in our tree space, and trusting our reactive system not to stuff up if/when it encounters
some foreign reactivity within the same JS VM. I think reactivity plus transparent asynchrony mediated by
[unavailable values](/term/unavailable-value) is going to carry us a long way.

But first, the build system, and then also its interaction with browser-directed module loading of the form in our samples,
which currently looks like this:

````
<template>
    <!-- Upstream loader needs to define libUrlBase and editUrlbase -->
    <!-- <fluid-url-base id="libUrlBase" src="../../../src/lib"></fluid-url-base> -->
    <div>
        <fluid-import layer="fluid.editorRoot" src="@{editUrlBase}/sfc/EditorRoot.vue"></fluid-import>
        <fluid-import layer="fluid.editor.layerList" src="@{editUrlBase}/sfc/EditorLayerList.vue"></fluid-import>
````

instantiated by stuff like this:

````
    <div>
        <!-- Instantiate the app on this div -->
        <div fluid-layers="fluid.demos.todoApp">
        </div>
    </div>
````

Thus, the second substrate will boot into the third substrate.

Today I am watching the impressive 
[Hyperclay](https://www.youtube.com/watch?v=pks83J2HqJo) talk for Live 2025 and am excited for the potential
of DOM-mediated interoperability. Another benefit of thorough-going reactivity is not having to care if something
is instantiated as a Web Component, included in an iframe, or rendered by something totally alien, etc.


[^1]: By 2014 there was already enough code depending on "old Infusion" that doing this split at the time felt
really prohibitive.
