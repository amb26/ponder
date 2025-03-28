---
title: Lithification
categories: ["term"]
---

The term **lithification** in software development was coined by [r0ml]() (Robert Lefkowitz) in his incendiary
2017 talk [Keeping Linux Great](https://www.youtube.com/watch?v=i3nJR7PNgI4) which is written up further in
his equally trenchant article [Giving up on Open Source Software](https://r0ml.medium.com/giving-up-on-open-source-software-526b63a90d5d).
It describes a mode of software reuse that appears entirely anti-religious to anyone with a traditional
programming education, of simply appropriating the source code for any library or implementation one needs, incorporating
it into one's own codebase and then bashing on it. This can be seen as an extreme form of vendoring, which itself is described in this
[gist rant](https://gist.github.com/datagrok/8577287) as a "vile anti-pattern".

The arguments against this model of reuse are clear since it violates the [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
principle. I spent years engrossed by this religious mania, 
but had quite an experience when seeing the [Boxer](https://boxer-project.github.io/) ecosystem for the first time,
to realise that wholesale appropriation of dependencies is the only supported model of reuse. In fact, Andy
diSessa, the Boxer instigator, has written on the
[evils of component-based development](https://boxer-project.github.io/boxer-literature/papers/Boxer%20Profile%20-%20Component%20Computing%20within%20a%20Computational%20Medium%20(diSessa,%202001).pdf)
for community structure.

In practice, a balance must be sought between lithification and abstraction-based reuse, but lithification is
an attractive approach much more often than appreciated &ndash; in fact I heavily lithified the theme underlying
this blog from its original implementation as [Beautiful Hugo](https://themes.gohugo.io/themes/beautifulhugo/) filled with
sprawling unnecessary conditionals and brittle styling.
