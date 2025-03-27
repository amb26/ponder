---
title: Habitable
categories: ["term"]
---

Habitability as applied to software technology is a term coined by Richard Gabriel in his 1993 article 
"Habitability and Piecemeal Growth". You can see [part of this article](https://akkartik.name/post/habitability) 
reproduced on Kartik Agaram's excellent [blog](https://akkartik.name/), as republished in Gabriel's book
[Patterns of Software](https://www.dreamsongs.com/Files/PatternsOfSoftware.pdf) which I hugely recommend &ndash; I 
consider Gabriel the finest writer on software technology of his generation.

Connecting this idea with Christopher Alexander's idea of _organic growth_ in the context of the architecture of buildings,
Gabriel says 

> Habitability is the characteristic of source code that enables programmers, coders, bug-fixers,
> and people coming to the code later in its life to understand its construction and intentions and to change it
> comfortably and confidently.

> Habitability makes a place livable, like home. And this is what we want in software—that developers feel at home,
> can place their hands on any item without having to think deeply about where it is.

We can however see a big discrepancy that's emerged as Gabriel imported Alexander's notion. 
The inhabitants of a building are, in software terms, its "users" &ndash; I think a term
which any architect of buildings (outside Le Corbusier's school) would feel uneasy at applying &ndash; whereas
the inhabitants of a piece of software are its "coders".

Gabriel notes this discrepancy, but surprisingly other than noting it simply passes over it completely:

> It should be clear that, in our context, a “user” is a programmer who is called
> upon to maintain or modify software; a user is not (necessarily) the person who
> uses the software. In Alexander’s terminology, a user is an inhabitant. A client or
> software user certainly does not inhabit the code but instead uses its external
> interface; such a software user would be more like the city sewer, which hooks up
> to a building but doesn’t live in it.

How could it be that such a fundamental discrepancy is not worthy of comment, by a mind as far-reaching as Gabriel's?
The assumption the builders and users of software inhabit such utterly different spheres
("[Incommensurable](https://dreamsongs.com/Files/Incommensurability.pdf)", in Gabriel's, and Kuhn's terms) 
is so baked in to decades of technological culture,
that the possibility that their values might relate to one another is not even worth commenting on. My entry
on [end user programming](/term/end-user-programming) talks about this tendency.

As I remark in my rather ranty [2016 PPIG paper](https://ppig.org/files/2016-PPIG-27th-Basman2.pdf) 

> There is an aesthetics in computer science, but it is not for the user and rarely even for the developer.

Similarly, there is a habitability for software, but it is not (yet) for the user. My goal in designing a
[substrate](/term/substrate) for software is to bring the worlds of "users" and developers into close enough
contact that the users of software might finally manage to find livable places of their own.
