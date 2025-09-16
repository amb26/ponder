---
title: Staring at the wand
date: 2025-04-04
---

OK, so we have now imported a visually reasonable and properly lithified version of
[Pell](https://github.com/jaredreich/pell/blob/master/src/pell.js) into a tiny static page which is itself
lithified from the rendered output of the [substrates](/term/substrate) page, which will be where the
[most basic editing demo](https://fluid-project.github.io/infusion-6/demo/) gets scaffolded.

I mused about making the [disclosing tool](/term/disclosable-computing) into a pencil of the kind we see
in the [Lively Kernel](https://github.com/LivelyKernel/lively4-core) UI but the "magic wand" was
hard to resist and fits in with some rhetoric about this gesture. I recently dug out my original
[2013 Tweet](https://x.com/amb26ponder/status/304536562820063232)
about having invented a CSS-like design extension scheme[^1] and this lovely [Mulla Nasruddin cartoon](https://ponder.org.uk/public/patent3.png)
feels as funny as it did when I saw it in one of my father's [Idries Shah](https://en.wikipedia.org/wiki/Idries_Shah) books as a teenager.

<img src="/img/magic-wand-demo.png" width="600px" title="Most basic editing demo"/>

But staring at this tantalising UI invitation, we think... so what indeed comes next? I guess I'll be damned if I
start by writing yet another blasted piece of event binding code so I guess it actually needs to start *here* which is 
just a bit annoying since it means we need to implement, as well as the event binding syntax perhaps inspired by 
[Vue](https://vuejs.org/guide/essentials/event-handling.html) something to back this up in the substrate in terms
of not only the binding directive itself but perhaps some "event" it can fire.

Looks like I misremembered how methods had been finally implemented - rather than a "flash" signal holding the immediately
dispatched arguments, it looks like there was a pretty conventional dispatcher which just used a little intermediate
"resolver" to resolve any substrate arguments on the spot, here's the standard
"[slow path](https://github.com/fluid-project/infusion-6/blob/main/src/framework/core/js/FluidIL.js#L733)":

```
const resolver = fluid.makeArgResolver();
const argRecs = fluid.makeArray(record.args);
const argResolver = fluid.resolveComputeArgs(argRecs, shadow, resolver.resolve);
togo = function applyMethod(...args) {
    resolver.backing = args;
    const resolvedArgs = argResolver.map(methodFlattener);
    const resolvedFunc = fluid.deSignal(func);
    return resolvedFunc.apply(shadow, resolvedArgs);
};
```

Events were so lovely and elaborate in "Old Infusion" and it's unclear how much of that stuff we want to port just yet.
It's clear that there is room to implement the "layer idiom" for covering and uncovering listeners which was key to the
model of the [2018 paper on entanglements](https://www.shift-society.org/salon/papers/2018/revised/anatomy-of-interaction-authorversion.pdf).
But for now we need the "simplest thing which can work", I mean, HTML ``onclick`` doesn't even have an idiom for
registering more than one listener!

I guess we don't actually need user events yet, methods will do fine &ndash; and we have plenty of impl from 
[petite-vue](https://github.com/vuejs/petite-vue) to lift to back up the front-end binding. So interesting that petite-vue
is so unpopular and also generally unloved/orphaned by its creator who amazingly is the [same creator](http://evanyou.me/) of Vue.
Here's the core [``on`` parser and binder](https://github.com/vuejs/petite-vue/blob/main/src/directives/on.ts) &ndash;
eventually we'll need syntax assistance for this.

Other ideas of the day &ndash; whilst demarking the action of the "CSS bundler" with specially formatted CSS comments 
seemed desirable, it feels like we can get away with something much simpler and just creating one ``<style>`` node
in the document for each source of a CSS nugget in the layer/component tree. "Tokyo House insight" has it that
layer names can be folded on to the equivalent of class names. This suggests we steer away from 
"component names as tag names" as seen in the default [Vue consumption syntax](https://vuejs.org/guide/essentials/component-basics#using-a-component)
(and indeed (P)react and all the rest of them) but instead prefer something like
the ``is`` syntax that we see when customising builtin HTML elements as
[Web Components](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define#defining_a_customized_built-in_element).
Remind ourselves that Hugo Daniel used a ``data-component``
attribute in his hilarious [BoreDOM](https://hugodaniel.com/posts/boredom-another-js-framework/). Here's an [interesting example](https://www.w3schools.com/vue/ref_is.php) of
dynamically binding the Web Component ``is`` attribute using Vue but note that this doesn't represent any dedicated Vue facility,
beyond the ability to hook into its registration of web components using the ``vue:`` prefix. Unclear whether there's
any value in advertising custom elements right now even though we do indeed have something to offer in long run in terms of 
civilising the horrific race-laden workflow of Web Component startup in terms of timing of the
[lifecycle callbacks](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks).

Choosing between ``v-on:click="handler"`` and ``@click="handler"`` &ndash; the errors triggered in Webstorm are
rather less obnoxious for the latter (highly scientific criterion!). Also the latter is more concise, doesn't visibly
associate us with Vue, and must be widely attested/supported since most Vue apps use it!

[^1]: Which in practice was perhaps not as usable a design affordance that I dreamed at the time, but as with so
much of the "[substrates definition](/term/substrate)" feels like an *essential possibility* that any competent
substrate should allow for.
