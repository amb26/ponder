---
title: Learning from Codestrates
date: 2025-04-24
---

For the last few days I've been looking at the amazing [Codestrates](https://codestrates.projects.cavi.au.dk/) project,
a development from Webstrates that has been under development by Clemens Klokmose and his team at [CAVI](https://cavi.au.dk/)
since 2015. This has always been a close sibling project since the days of our [2016 paper](https://www.ppig.org/files/2016-PPIG-27th-Basman1.pdf)
and the development into Codestrates with its powerful in-browser IDE makes the convergence even more interesting.

### Reuse and abstractions in Substrates

There has always been a fundamental difference in philosophy between Webstrates and Infusion,
in that the substrate underlying Webstrates is simply
the DOM itself. Whilst in the latest [MyWebstrates](https://cs.au.dk/~clemens/files/MyWebstrates-UIST2024.pdf) this has
been displaced one level lower in the stack into an [Automerge](https://github.com/automerge/automerge) document,
the representation of the UI held in the substrate is still isomorphic to the DOM and so does not permit idiomatic
abstraction or reuse. I talk a little about the vexed concept of "objects/types/abstractions" in my
[position paper](/papers/Substrates-25_paper_8.pdf) for the upcoming
[Substrates Workshop](https://2025.programming-conference.org/home/substrates-2025)
at <Programming 2025>. Folding together design time and run time causes many notions of "types" to collapse, but there
remains a core notion of a named, reusable design unit. Boxer, one of the few true substrates created, apparently
lacks such a notion, but there is a functional standin &ndash; at the moment a "doit" box begins to execute, a
(recursive, lazy) copy is made of it. This copying process is at the core of Boxer's reuse model, which otherwise
relies on wholesale copying of material adopted into one's microworld through [lithification](/term/lithification).

The Webstrates family features some models for reuse but these are those inherited from traditional file-based
programming &ndash; the [Webstrates Package Manager](https://webstrate.projects.cavi.au.dk/docs/wpmv2/WPMv2.html) maintains
a library of JavaScript packages which are largely lightly wrapped versions of conventional JavaScript libraries available
in mainstream repositories. This reuse doesn't penetrate into the substrate itself, which is noted as a limitation
in the [MyWebstrates paper](https://cs.au.dk/~clemens/files/MyWebstrates-UIST2024.pdf) on its model of transclusion.

Nonetheless our projects have so much in common that there is a great deal to learn from both at the
implementation and interaction level. For a start, both projects necessarily eschew complex design-time tooling such
as bundlers and transpilers, for the same reasons that these are incompatible with local-first, locally-delivered
design experiences. I see that this stretches further into so far avoiding [ES6 modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
with their peculiar "viral"
idiom &ndash; any consumer of an ES6 module has to buy in fully to a new syntax and isolated world which is passed
on virally to any upstream dependencies. I think there are ways to deliver Infusion in an ES6 module world but for now it
represents an unnecessary annoyance which can be deferred for the time being. Similarly, the Webstrates idiom depends commendably
on access to a shared global namespace which stuff is injected into, as every moral programming system ought.

### Taking a Codestrate for a Spin

Firing up for example the TODO sample available at the first link on the CodeStrates [Example Gallery](https://codestrates.projects.cavi.au.dk/examples/)
and peering at its markup reveals a number of interesting things. Firstly in terms of initiating
[disclosure](/term/disclosable-computing) this is very simple &ndash; there is simply a button named Edit which
floats at the top right of the browser pane.

Putting this together with the Export facility available from the File menu in the development UI the button reveals
sparked off some interesting trains of thought. As always with Webstrates, it stretches my categories of 
"things necessary to deliver a successful substrate" since I was greatly surprised to find that the resulting ZIP
file, delivered by code executing in the browser, harboured an ``index.html`` file which successfully executed
the resulting WebStrate together with its editing interface. A Codestrate is a successful [Quine](https://en.wikipedia.org/wiki/Quine_(computing)),
even more so than Boxer, which is something I'd thought essential to the delivery of a true substrate.

I saw that the filesystem substrate did depend on loading its dependencies online from the WebStrates Package Manager,
but there's no essential reason why this would have to be so. The dependencies could have been baked into the downloaded
ZIP package together with some kind of equivalent of an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)
so that the substrate was self-sufficient, in rather the way that Tom Larkworthy's [LopeCode](https://github.com/tomlarkworthy/lopecode)
attains its virtues of Durability.

As with most of Jonathan's substrate virtues, this looks like a capability that isn't actually definitional but rather,
an essential *capability*. Some users (actually most users in my community) will want complete isolation and durability,
others will want to offload responsibility for dependencies.

### The Quine Flame

But staring at the self-editing markup in detail in a Codestrate makes me think more carefully about the whole "disclosure" angle.
Now &ndash; either a given substrate is editable or it isn't. It seems that every Codestrate (that I can see) is obligately
editable &ndash; much like a Boxer microworld. Now the difference here is that the UI by default is almost completely
unpolluted by the disclosure facility &ndash; but it is still there. This is the form it takes &ndash; to start with, on the
root html node there is an attribute ``transient-data-docking-area-component-mode`` which defaults to ``right-edge``. This then,
on all top-level document elements, activates a CSS rule

```
html[transient-data-docking-area-component-mode~="edge"] > *:not(.docking-area--ignore) {
    flex: 1 1 auto;
    overflow: auto;
    contain: paint;
}
```

The other UI elements, the slider bar and docking pane have similar stuff, and interestingly the docked pane is
a direct descendent of `<html>` *outside* `<body>` with a custom tag of `component-area`. All of these are new
possibilities to me and are doubtless the result of studied experiment from the CodeStrates team which is well
worth learning from. The Edit button itself is injected as
a [transient](https://webstrates.github.io/userguide/api/transient.html) sibling of the body's actual content.

But the interesting philosophical/practical issue here is how all of these pieces of "framing" material actually
get there in the first place. It appears that WebStrates suffers from a very minor instance of SmallTalk's "image problem"
in that the only idiomatic way to get a WebStrate is to start with one and to transmit it via its "sacred flame"
of Quining. Now it is clearly fantastically easier to create a WebStrate than it is to create a SmallTalk VM but
all the same it is not quite nothing, reflecting the fact that WebStrates editing ecology is still in a sense "closed".
It is not intended to be idiomatic to work on a WebStrate through anything other than itself (although one
could work on JS libraries that it loads from WPM), even if this is massively more convenient than working on
a SmallTalk VM with something. One could load up a WebStrate `index.html` in a text editor and hack on it intelligibly,
or even commit it to GitHub, but there are idiomatic issues which make this undesirable.

This points to a core Infusion goal which is to much more closely bridge between community idioms of users and developers.
Whilst in practice we expect it to be the developers who make the most significant concessions &ndash; since they are the
ones blessed with the powerful tools, elite education and grandiose epistemology[^1]  &ndash; we can't expect them to make
*total* concessions and abandon the use of their specialised tools and workflows entirely. I envisage, for example,
a trajectory where a substrate grows beyond a certain level of complexity and then needs to have substantial parts of it
worked on by traditional heavyweight IDEs. And without a route to managing longer-lived designs of greater complexity, there's
little point in having a substrate in the first place, since all designs below a certain scale and longevity can
now handily be synthesized by AIs.

Also, I expect it to be pretty common to deploy substrated apps in lightweight and static contexts &ndash; for example
static sites such as this blog. Whilst it can be cute to have an "edit this blog post" button in such contexts it doesn't
appeal to a relevant need there &ndash; people largely come to blogs to read. This implies an idiomatic way
to "publish" content from a substrate in such a way that the disclosure functionality is not included, but could easily
be reinjected.

What form could this reinjection take? The simplest possible form would be to produce a "one stop shop igniter" in the form
of a single JS file that could be injected into the `<head>` of the document to produce all of the machinery above. How the
user actually arranges to have this done is a matter for another discussion &ndash; there could be, say, a 
[Tampermonkey](https://www.tampermonkey.net/) script, but if the injection were done via a browser extension this may as
well produce a UI via the browser's dev tools UI plugin system with much better integration with base language
debugging and other goodies such as access to the File System API. But still, we expect this kind of gesture to be as 
minimal as possible and be compatible with the use of a substrate appearing as a conventional JS dependency in
a lightweight project. I'm targetting the kind of applications that might find the use of
[Web Components](https://www.webcomponents.org/libraries) attractive.

These in themselves are not showstopping issues in WebStrates. It's clear that the WebStrates team are highly sympathetic
to the "one stop shop flame" model since this is how the [WPM package resolver](https://github.com/Webstrates/WPM)
itself is meant to be included:

```
<script id="WPMv2-script" src="https://cdn.jsdelivr.net/gh/Webstrates/WPM@v2.22/WPMv2.js"></script>
```

But the fact that WebStrates, as delivered, are primarily a self-replicating "flame" ecology is reflective of
the deeper idiomatic issues I mention before &ndash; underlying them that
"being a webstrate" is an all or nothing deal that affects the entire page.

Given the close relationship between aims I see a lot of value in going along with technological and UX choices
behind CodeStrates where they are in scope, and also scratch my head to see whether there could even be complementary
development &ndash; for example trying to fit Infusion layers into the WPM package format, or as a dedicated
top-level entry in a MyWebstrates AutoMerge document.

[^1]: I include, by extension, AI developers in this category since they result from the same worldview.
