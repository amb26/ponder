---
title: Divergence
categories: ["term"]
---

Defined in my [2016 paper](https://www.ppig.org/files/2016-PPIG-27th-Basman1.pdf), **divergence** represents
any discrepancy between the runtime state of a program, and the state through which it can be authored. Typical
sources of divergence include the program's [_call stack_](https://en.wikipedia.org/wiki/Call_stack), 
uninterpreted addresses within the [_heap_](https://stackoverflow.com/questions/79923/what-and-where-are-the-stack-and-heap), 
[event listeners](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events) and 
typical sources of object representation such as [vtables](https://en.wikipedia.org/wiki/Virtual_method_table) and the like.

In a tradition of materialised programming, divergence should be minimised, in order to reduce the mental burden on
those trying to visualise the effects of their edits.

Closely related notions are the **Gulf of Execution**, and **Gulf of Evaluation**, originally coined by Don Norman in
his 1988 [Design of Everyday Things](https://en.wikipedia.org/wiki/The_Design_of_Everyday_Things). 

Jonathan Edwards centres bridging these gulfs in his 2005 paper
[Subtext: Uncovering the Simplicity of Programming](https://www.subtext-lang.org/OOPSLA05.pdf): 

> The Gulf of Execution is the difficulty
of translating a desired goal into an action to be executed. The
Gulf of Evaluation is the difficulty of determining whether an
observable state meets the desired goals.

and announces

> Subtext is a new medium in which the representation of a program
is the same thing as its execution.

Subtext is thus a medium or [substrate](/term/substrate) in which divergence is minimised.

However, it seems that a slight pun may emerge between these two notions of "execution" &ndash; one, the execution
of the user's intention, and the other, the execution of the program. I argue that by reframing the activity of
substrates away from execution in the programming sense, there is better scope for the minimisation of divergence
to bridge these gulfs, in the typical case where minimal or no computation is required.

Instead of execution we focus on the correlation or organisation of state, in line with the responsibilities of an
[integration domain](/term/integration-domain). Computation, where necessary, is expressed in a dialect of
[good functions](/term/a-good-function) in a syntax which will be familiar to users from grade school or spreadsheets.