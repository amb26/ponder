---
title: Substrate
categories: ["term"]
---

A **substrate** is a kind of self-sufficient model or material for the construction of software. 
[Jonathan Edwards](https://alarmingdevelopment.org/)' definition is a great starting point comprising the following points:

* A complete and self-sufficient programming system
* Persistent code & data store
* Direct-manipulation UI on that state
* Live programming
* Programming & using are on a spectrum, not distinct
* Conceptually unified — not a “stack” 

Summarized as a slogan: “A PL, DB, & WYSIWYG document unified together.”

Whilst I subscribe to all of these points, in my vision many of them are not essential definitional aspects, but
instead essential *possibilities* &ndash; that is, that the substrate should be designed in such a way that they can be
brought into view or "disclosed" idiomatically in any context. For example, direct-manipulation and live programming
may not be appropriate or necessary for many users of a particular substrate's deployment &ndash; they may prefer to view
it as a regular application, indistinguishable from one not built on a substrate, or even as a static document.
But the path to bringing
these capabilities into view should be reasonably direct and not involve a fundamental change in the structure of
the application. This rules out pieces of obligately unidirectional machinery, such as traditional kinds of "compilers"
or build tools, from the infrastructure of a substrate unless they can be civilised or incrementalised somehow.

I argue that the capabilities of a substrate need to be [disclosable](/term/disclosable-computing).
