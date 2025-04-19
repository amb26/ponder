---
title: A good function
categories: ["term"]
---

A **good function** is:

* A pure function, one without side-effects whose return value depends only on its arguments
* Available at a stable public name in a global namespace
* Performs work only linearly proportional to the size of its arguments (considered as structures)

This notion was first described the Fluid wiki 
on [this 2005 page](https://fluidproject.atlassian.net/wiki/spaces/fluid/pages/11514225/A+Good+Function) which goes
into some somewhat crusty historical detail for justification. The main upshot is that such a definition aids
transparency --- the ability to reason from effects to causes, and liveness --- for the system to responsively
adapt to the user's gestures. This kind of liveness helps the system to form what Chris Hancock in his 2003 PhD
[thesis on computation literacy](https://boxer-project.github.io/boxer-literature/theses/Real-Time%20Programming%20and%20the%20Big%20Ideas%20of%20Computational%20Literacy%20(Hancock,%20MIT%20PhD,%202003).pdf)
calls a "steady frame".

Our substrate should support functions which are not "good" &ndash; that is, which are expressed in arbitary
conventional progamming language code in the base language &ndash; but these should have a visible, lower status
in the authoring system which marks them out, and this will reduce the portability profile of the application. We would
expect that a substrate which makes use only of good functions would be readily portable to JavaScript, Lua or even to C.
