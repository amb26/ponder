---
title: On Development Speed
date: 2025-03-14
---

A recent posting
[Why the Latest JavaScript Frameworks Are a Waste of Time](https://dev.to/holasoymalva/why-the-latest-javascript-frameworks-are-a-waste-of-time-52pc) 
sparks a short train of thought. As well as the characteristically disrespectful tone of discussion that technical
people often adopt, and the suggestion, contrary to my speculations looking at 
[DOM reconciliation](/post/2025-02-07-benchmarking-dom-reconciliation), that people really do use low-level benchmarks
when choosing frameworks, is the notion of frameworks contributing to development speed. One commentor invites us to watch
him against the clock to implement a front end in Svelte rather than React.

Whilst I don't doubt the reality that some frameworks, to some people, are likely to be much more productive
than others, this discussion to me ignores a reality is only heightened by the intrusion of AI into coding.
[Colin Clark](https://colinclark.org/)
remarked to me last week, during his exciting residency at [Jacob's Pillow](https://en.wikipedia.org/wiki/Jacob%27s_Pillow)
about his and his colleagues' experiences of coding with AI, 

> "You go extremely fast, then suddenly you are completely unable to go at all"

Short-run coding speed in essentially any popular framework is shortly, if not already, essentially infinite since
an AI co-pilot will generate substantial implementations on the spot. A more pertinent question is what risks are being
stored up as designs become larger and older &ndash; these are necessarily hard to quantify since they refer to "[tail risks](https://en.wikipedia.org/wiki/Tail_risk)"
that may not come to fruition over the lifetime of a project. But the question is &ndash; how likely is it that a design
is steered to a point where it becomes essentially unnavigable as a result of inability to connect design changes
predictably with consequences?

<!-- Find a link about how AI generated code is hard to maintain, and also AI is bad at maintenance -->

There are a few kinds of responses to such tail risks. One is to avoid frameworks and focus on relatively transparent
environments such as C, as recommended by
[Richard Mitton commenting on a Vyacheslav Egorov talk](http://www.codersnotes.com/notes/learning-via-bullshit/). In these
environments there is a relatively direct connection between expressions (source code) and results (in this case
represented by emitted assembler). I am interested to see if these extremes can be harmonised &ndash; whether there
could be kinds of frameworks or [substrates](/term/substrate) which allow for a more direct correspondence between
expressions and results in the space of a user interface &ndash; in particular, which allow the full train of design
decisions leading to a particular interface element being a certain way to be traced back to their original
expressions from the interface itself. We have a precedent for such systems inside the powerful CSS inspectors
now built into every mainstream browser. 

Such a system will be helpful for human and AI coders alike &ndash; since easy access to the textual form of the
relevant design expression in a system gives a purchase point to an AI copilot just as readily as it does to a human
typist. This guards against the risk that systems become unnavigable as a result of the _context_ of a design
element becoming unmanageably large. An AI coder is limited by the context required to understand a UI behaviour,
and opacity linking effects with causes, in the same way as a human.
