---
title: Divergence
categories: ["term"]
---

Defined in my [2016 paper](https://www.ppig.org/files/2016-PPIG-27th-Basman1.pdf), **divergence** represents
any discrepancy between the runtime state of an application, and the state through which it can be authored. Typical
sources of divergence include the program's [_call stack_](https://en.wikipedia.org/wiki/Call_stack), 
unintepreted addresses within the [_heap_](https://stackoverflow.com/questions/79923/what-and-where-are-the-stack-and-heap), 
[event listeners](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events) and 
typical sources of object representation such as [vtables](https://en.wikipedia.org/wiki/Virtual_method_table) and the like.

In a tradition of materialised programming, divergence should be minimised, in order to reduce the mental burden on
those trying to visualise the effects of their edits.
