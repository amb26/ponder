---
title: Change of Tack on Templating
date: 2025-04-03
---

I get to staring at the [markup templates](https://github.com/IMERSS/imerss-bioinfo/blob/main/indexBlitz.html)
that were already implemented for the 
[Galiano 2023 Bioblitz](https://imerss.github.io/galiano-bioblitz-2023/Galiano-BioBlitz-2023-Reknitted.html)
and thinking how to adapt/reuse them for the upcoming 
[Diatoms of the Salish Sea](https://imerss.org/2020/10/04/diatoms-of-the-salish-sea-2/)
viz forces me to put some things in focus about how templating is going to have to work for these communities. I'd 
vaguely hoped that the details of how Infusion templating was going to interact with Hugo templating would
somehow just "come out in the wash" but naturally this isn't going to happen without some kind of focused plan!

This current round of Infusion's design was heavily influenced by inspecting 
[Vue's templating system](https://vuejs.org/guide/essentials/template-syntax) which had really seemed like the best of the
crop. The Vue developers balance pragmatism of good performance, clean syntax, and an open implementation with 
render functions (see post on [DOM reconciliation](/post/2025-02-07-benchmarking-dom-reconciliation) on Svelte's
limitations here), as well as great support for SFCs ([single file components](https://vuejs.org/guide/scaling-up/sfc.html))
at least on the server. I'd wanted to pick a syntax as close as possible to Vue's as well as to aid familiarity,
to open the door to some implementation sharing down the line. I'm desperate to avoid reinventing the wheel with this
round of Infusion, as every technologist either wittingly or unwittingly does.

But the longer I spent with the Vue codebase, the more it became apparent that I wasn't going to find anything to
salvage &ndash; except maybe for their [HTML parser](https://github.com/vuejs/vue/blob/dev/src/compiler/parser/html-parser.js)
which itself turns out to be a lightly warmed over [lithification](/term/lithification) from John Resig and hasn't been touched in 5 years.

After a few weeks' experience with Hugo my feelings about it are broadly positive which is saying something given
the typical experience of using a library. The way it interpolates templates by leaving masses of blank lines is
benighted and it's incapable of simple adaptations such as setting dimensions on images or configuring relative
paths from the 404 page, but it is as least thankfully extremely good at its _one job_ which is slinging interpolated
shit across the filesystem extremely fast, and its layered design for directory structure of themes and projects
makes a lot of sense and is very reminiscent of Infusion layers. It is still building this site in < 300ms on this
10 year old machine which is just great and will make a night and day difference to the horrific Quarto-based
[Bryophytes of British Columbia](https://imerss.github.io/bc-bryo-atlas/) site which can take nearly **2 hours** (!!?!)
for a clean rebuild. To mangle Arthur C. Clark "Any sufficiently rapid imperative system is indistinguishable from
a malleable one" which is perhaps Kartik's point. But I believe that is only true up to a point.

The awkward train-wreck is that Vue's templating syntax is based on ``{{ }}`` which is just the same as Vue's (and
indeed as all the Handlebars-based family from which it inherits). I think the ideal workflow is going to consist of
"rapid expansion and site structuring" done by Hugo/blogdown plus then a round of some kind of "optional hydration"
done by Infusion to flesh out the fine structure in the rendered pages which will be too obnoxious to express in 
Hugo's last-century templating system. It's funny to think of [self templating](https://fluidproject.atlassian.net/wiki/spaces/Infusion13/pages/9315898/Renderer+API#RendererAPI-selfRender)
coming back from the Infusion 1.x days, and from even more ancient schemes like
RSF's [IKAT](https://rsf.github.io/wiki/Wiki7157.html?page=IKAT) algorithm but
the more I stare at SFCs I think it is going to fit. The idea of the SFC itself being an actually sufficient
HTML page &ndash; and one that perhaps runs its own test cases and/or shows placeholder content seems very helpful.

The upshot is that we are going to need another syntax for Infusion's templating than Vue's Handlebars one to
avoid it colliding with Hugo's &ndash; and we at a sufficiently early stage of development that this change of course
is just fine. We'd already noted the strange anomaly that Vue itself moved away from ``{{ }}`` syntax for attributes
&ndash; this was done 9 years ago in the transition from Vue 1 to Vue 2 written up in [issue 4042](https://github.com/vuejs/vue/issues/4042)
but the reasoning was never explained. The newer kind of "weird attribute syntax" ``vbind:id`` or ``:id`` 
is thus something that could perfectly well be supported in a Hugo post-processor or any kind of "markup functor system"[^1].

We might support "weird attribute syntax" but to start with we need a replacement for ``{{ }}`` for which case simply
dropping back to ES6 template syntax ``${ }`` seems just fine. There will never be a confusion with actual ES6 templates
since as we lamented these things are only supported within _code_ in the first place and so can never be externalised.
Because they are only implemented in a way which binds onto a runtime programming language scope they could never
be part of an [integration domain](/term/integration-domain). Also the ``${ }`` syntax has a slightly greater
clarity that it is only intended to support interpolation of **values**, as against ``{{ }}`` which in Hugo as
well as Handlebars has always supported a variety of other exotic control flow constructs such as ``{{ if }}`` which
we had never planned to support.

[^1]: Somewhere I have a scrawled drawing from the RSF days elaborating how self-templating can be seen as some funky
kind of "endofunctor on the category of markup".
