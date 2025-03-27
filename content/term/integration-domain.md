---
title: Integration Domain
categories: ["term"]
---

An  _integration domain_ is defined in Stephen Kell's 2009 paper 
[The Mythical Matched Modules](https://www.cl.cam.ac.uk/research/srg/netos/papers/2009-kell2009mythical.pdf) as a domain where

* languages and tools are specialised towards composition of software, and so do not resemble conventional languages
* relations are expressed between runtime values, predicated on the context in which they occur

In addition through Stephen's principle of _interface hiding_, dependencies do not explicitly manifest themselves in
the domain except through the contextualised values which the domain puts into relation.

A core goal of the rewrite to version 6 of framework I have been working on, Infusion, is for it to host a
software substrate representing an integration domain.
