---
title: Coming Out of the Shadows
date: 2025-04-13
---

Or &ndash; "Evading Gilad's Comparison".

A 2014 posting of Gilad Bracha's, [A DOMain of shadows](https://gbracha.blogspot.com/2014/09/a-domain-of-shadows.html), 
has prompted a lot of thought over the years. I refer to it in passing in last month's 
[On UI as Code](/post/2025-03-20-ui-as-code) but this week a line of argument became a bit clearer on how
the comparison in the posting might be dodged.

Gilad's note is about the design tension constantly pushing complexity into any purportedly "simple" user-facing language,
that we might call a DSL. He argues that any DSL is constantly under pressure to become a general-purpose computing
language, since if it does not, it ends up evolving "shadow constructs" which ape those which are more competently
implemented in such a language. If his argument can't be counterbalanced, the "UI as code" idiom pushed by Flutter etc.
must be accepted, along with the tool chains and social constructs that come with it. However, at a practical level,
[my posting](/post/2025-03-20-ui-as-code) shows the kinds of consequences that we typically have to accept with such a choice.

But to go along with this practical demonstration, how can we evade the criticism at a moral level? Gilad's second example
is of a view templating language, Polymer &ndash; it is a thing of its day, but every view templating system is forced
into similar choices. For example, Vue's [list rendering template syntax](https://vuejs.org/guide/essentials/list.html)
(one has to say, a highly successful one) duly includes "shadow constructs" for looping and conditionals. A fully
fledged "shadom domain" that should be better implemented in code? Maybe.

From my point of view what is problematic about these shadow domains is not just that they ape constructs in general-purpose
programming language, but that they are just as opaque as them. For example, here is a section of templating language
from the Hugo theme underlying this site (earlier version of [Beautiful Hugo's nav.html](https://github.com/halogenica/beautifulhugo/blob/master/layouts/partials/nav.html)): 

```
  <div class="{{ .Type }}-heading">
    <h1>{{ with $.Scratch.Get "title" }}{{.}}{{ else }}<br/>{{ end }}</h1>
      {{ if $subtitle }}
        {{ if eq .Type "page" }}
          <hr class="small">
          <span class="{{ .Type }}-subheading">{{ $subtitle }}</span>
        {{ else }}
          <h2 class="{{ .Type }}-subheading">{{ $subtitle }}</h2>
        {{ end }}
      {{ end }}
      {{ if eq .Type "post" }}
        {{ partial "post_meta.html" . }}
      {{ end }}
  </div>
```

Whether or not you consider this template would better have been implemented
in a general-purpose programming language, it is pretty hard to discover, given the rendered markup in the UI,
how it got there. Have a look in this page's markup and see how easily it leaps out at you &ndash; bearing in mind
that we are aiming here at a system which brings computation to the general public.

This is the same argument with the same consequences as in [On UI as Code](/post/2025-03-20-ui-as-code).

Now, given that Infusion now implements what look like the same constructs `@for` and `@if` 
in the view/configuration layer, how do we evade the "shadow domain" criticism?

### This is not control flow

One answer is that, despite their superficial resemblance, these are not control flow constructs. Rather than,
for example, `@for` being a looping construct, it is actually a construct that *puts one part of the system in
correspondence with another*. It says &ndash; "There are as many components here as there are elements in this
data structure". Similarly, `@if` puts a component in correspondence with a reactive boolean value.

Somewhere in the "base language" which may or may not underlie the substrate, there may indeed be an `if` statement
which produced the boolean we are corresponding with &ndash; but maybe there isn't.

Philosophically then there are not two or more "shadow constructs" here, there is just one, the "put into correspondence"
construct, which just has two syntactically different sugars reflecting whether the corresponding item is a composite
or a boolean. "Old Infusion" was a little clearer about this, with the configuration named 
[source/sources](https://docs.fluidproject.org/infusion/development/SubcomponentDeclaration#dynamic-subcomponents-with-a-source-array)
rather than `if/for` but there is no point confounding users with unfamiliar names for potentially familiar things.

A valid response to this distinction is "at the end of the day it's the same thing &ndash; the same computation is
designated and occurs" but I consider the difference of emphasis is important. 
The operation of "putting into correspondence" plans for the
relationship to be maintained, and also to be traceable in either direction. It is this which will be at the
heart of Infusion's ability to trace causes from effects, and given a piece of UI, allow a UI gesture which
directly navigates to the pieces of data and code responsible.  

### The new paradigm is an old paradigm

As it turns out, as we are announcing "the death of the execution paradigm", the alternative we are looking at is far
from a new one. It is in fact closely reminiscent of the [relational algebra](https://en.wikipedia.org/wiki/Relational_algebra)
underlying the highly successful SQL query model. 
Codd introduced this model in his [1970 paper](https://www.seas.upenn.edu/~zives/03f/cis550/codd.pdf), and it is a close
match for our requirements &ndash; as befits an inhabitant of an [integration domain](/term/integration-domain) it is
not Turing complete and allows for the expression of what we call [good functions](/term/a-good-function) whose work
does not grow faster than the structural size of its arguments. The wrinkle in our formulation is that the entities
being related are part of different domains &ndash; whilst Codd's algebra relates data-to-data, ours relates data-to-substrate.
One can perhaps draw a lesson on the uphill struggle that faces this model from the fact I considered Codd's laws
far and away the most boring part of my Computer Science syllabus. Like the rest of the industry, I was computation-mad
and only wanted stuff that gave me more power rather than less.

Whilst it is colloquially true that "an SQL query executes" &ndash; one sees data centres grinding, and power being
dissipated &ndash; technically speaking it does not. It merely establishes a relation.
