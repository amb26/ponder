---
title: Templates and weird attributes together
date: 2025-04-07
---

Trying to put into practice thoughts from the previous two postings on [template thinking](/wip/2025-04-03-change-of-tack-on-templating)
and [weird attributes](/wip/2025-04-04-staring-at-the-wand) for event binding revealed some interesting problems.

Firing up ``${ }``-based templates revealed an awkward problem. This prevents us using 
backtick template literals in code since these automatically interpret ``${}`` syntax and so will break as soon
as they are evaluated.

At the same time, use of ``@click`` style event binding revealed a really interesting limitation. Whilst it is perfect
possible to parse overall HTML documents containing weird attributes like these, *and* it is possible to assign them
into the document in bulk using ``innerHTML`` or ``createContextualFragment`` these may *not* be set on individual nodes using a
call to ``node.setAttribute``. There is an amazing inconsistency that the latter is subject to a special
check leading to an error ``@click is not a valid attribute name``. Which it is not, of course &ndash;
[this posting](https://stackoverflow.com/questions/925994/what-characters-are-allowed-in-an-html-attribute-name) holds 
a pointer to the documentation on a valid [XML name](https://www.w3.org/TR/xml/#NT-Name) which shows these are highly
restricted. They can only begin with a colon (boo!), underscore or letter character.

Which makes it amazing that there are so many routes for getting such invalid attribute names into the document in the
first place, and supplies a clue to why Vue supports two syntaxes (``v-on:click`` and ``@click``).

However, once we fixed up the obviously broken logic, the test cases pass again leading us to ponder that there is really
no need to manipulate such attributes in the DOM in the first place as long as the standard routes for getting bulk
markup into the DOM for templating are workable. Who knows exactly what the original thinking in Vue was but it makes
a lot of sense for us to support just one syntax. DOM reconciliation only needs to work for properly extended material &ndash;
stuff actually forming the live part of the UI.

Leaving the original templating issue on the table. Given we shirk ``{{}}`` because we want to render Hugo templates,
and shirk ``${}`` because we want to use backticks in code, our attribute syntax suggests we go for ``@{}`` which 
whilst a bit funny is not unheard of &ndash; looks like the most popular second choice is Ruby's ``#{}``. 
We want something delimited since the original Infusion syntax based on ``%name``
was annoying based on not wanting to restrict the character set which appeared in interpolated keys.

But the pair of choices based on ``@key`` in attribute names and ``@{}`` in text seem to work well together &ndash; a clear visual
indicator that interpolated material in markup begins with ``@`` as against interpolated material in JSON beginning
with ``$``.




