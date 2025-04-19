---
title: An era for new notations
date: 2025-04-19
---

I argue that there has never been a more promising time for developing fruitful new notations.

Some, considering the enormous success of modern LLMs in solving increasingly complex "problems" &ndash; in terms of
translating a verbal or pictorial design specification into code &ndash; means programming is now a "solved" problem.
They imagine a future where humans no longer need to understand or write code.

I believe this is wrong on several accounts. The central account is ignoring the extent to which coding
is a *social activity*, that is, one that establishes long term relationships amongst communities of use around
shared artefacts. Even in the purest of disciplines, mathematics, it has long been recognised, for example
in Lakatos' 1959-1961 paper [What does a mathematical proof prove?](https://sidoli.w.waseda.jp/Lakatos_1978.pdf) that
the primary function of a mathematical proof, rather than to constitute a formal specification of a chain of reasoning, is 
to convince the human reader that its result is true. In doing so it establishes a dialogue amongst related
communities, which can only happen in terms of their recognition of shared distinctions that are of interest to them &ndash;
for example, polyhedra, or functions. One characterisation of the roles of these distinctions is Star and Griesamer's 1989
notion of [Boundary Objects](https://en.wikipedia.org/wiki/Boundary_object).

Rather than representing a **solution to a problem**, most deployed codebases represent a
**locus of discussion**. An example of such a locus is the thread on this 
[MapLibre GitHub issue](https://github.com/maplibre/maplibre-gl-js/issues/793) where contributors debate how to
distinguish event sources in an open-source mapping library. This discussion relates the concerns of those using a system to particular
structures in its implementation &ndash; the discussants need to
refer to parts of the library, long in maintenance, in terms which are recognisable to each other as stable landmarks.

Code that can be signed off as a one-off solution to a closed form programming puzzle or scripting task is an
important constituency but not a dominant one.

Here are two reasons why the rise of LLMs makes the development of new notations more promising and rewarding, rather than less.

## Oversight of code

The proliferation of LLM authorship of code is indeed accelerating and unstoppable. 
This puts an increasing burden on humans to review and ensure that such code aligns with a community’s goals. There have been no
shortage of rather quaint posts arguing that [writing efficient code is a moral good](https://tomgamon.com/posts/is-it-morally-wrong-to-write-inefficient-code/)
because of its reduced energy consumption. We are now at the point that the energy expended at runtime by typical code during its
deployed lifetime is totally dwarfed by that consumed by AI during its composition. Any notation which eases the burden
of oversight of AI &ndash; that is, makes it as obvious as possible whether the code it has produced
is aligned with the goals of its community &ndash; is going to offer massive savings. Saving one round trip to an AI
based on a notational niggle or shortening its "chain of thought" on a task would be a great result.

Even a wholly vibe coded app with no human community around its expression could benefit from this.  

I argue that an important way to ease the path to designs which are **obviously correct** to a human or AI overseer is
to minimise their [divergence](/term/divergence) &ndash; any discrepancy between their runtime state and the state
from which they can be authored. I and others in the [substrates](/term/substrate) community are working on notations
to achieve this.

## Decline of incumbency

At the same time as increasing the stakes for better notations, it has never been easier to deploy them. Typically a framework
or language faces a huge incumbency barrier &ndash; the years of costs sunk into a particular system make it prohibitive
to move to alternatives even if the advantages are huge. However, translation tasks are amongst the easiest for today's
LLMs &ndash; these are highly constrained tasks with clear metrics for success. Anthropic's
[documentation for Claude Code](https://www.anthropic.com/engineering/claude-code-best-practices) describes letting loose an
agentic coder on the task of translating 2000 source files from React to Vue (doubtless a very popular industry activity at present).
Code today has never been less tied to incumbent notations.

I predict that 30 years from now, those predicting the end of human readership of programming notations will seem as
misguided as Richard Gabriel's 1993 essay 
[The End of History and the Last Programming Language](https://www.dreamsongs.com/Files/PatternsOfSoftware.pdf) which concludes
that "the last programming language is C".