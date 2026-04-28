---
title: AI cries out for better notations
date: 2026-03-27
---

The themes of today's posting have been seen before. As with the dismal exercise in
[On UI as Code](/post/2025-03-20-ui-as-code) I find myself once again trying to make an apparently trivial modification
to a user interface - in this case, getting a [Hextra](https://imfing.github.io/hextra/) Hugo theme menu to support
nested menus. As is typical, this turns out to be impossible without some large-scale cut, paste and hack exercise
of the kind we so regularly tell each other is unvirtuous. The difference since last time is that I now have my
clanker buddy Claude online \[Sonnet 4.6] whom I can get to reflect on the meaning of this exercise. Until the next AI winter bites,
you will be able to see the conversation in its context [here](https://claude.ai/share/43038859-0c49-45ee-ab52-123707ac90b5), but
the central interaction is pasted out here:

<style>
@font-face {
    font-family: "Anthropic Serif";
    src: url(https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/c66fc489e-C-BHYa_K.woff2) format("woff2");
    font-weight: 300 800;
    font-style: normal;
    font-display: swap
}

.claude-interaction {
  background-color: rgb(248, 248, 246);
  padding: 1.5rem 2rem;
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  font-family: "Anthropic Serif", Georgia, "Arial Hebrew", "Noto Sans Hebrew", "Times New Roman", Times, "Hiragino Sans", "Yu Gothic", Meiryo, "Noto Sans CJK JP", "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", serif;
  font-size: 16px;
  margin: 2rem 0;
}

.claude-interaction p+p {
  margin: 10px 0;
}

.human-question {
   background-color: rgb(239, 238, 235);
   padding: 1rem 1.5rem;
   border-radius: 1rem;
   align-self: flex-end;
   max-width: 85%;
   margin: 2rem 0;
}

</style>

<div class="claude-interaction">
...

Yes. Here is the updated block in full:

```hugo
<ul class="hx-flex hx-flex-col hx-gap-1 md:hx-hidden">
  {{- range site.Menus.main -}}
    {{- if .Parent -}}{{- continue -}}{{- end -}}
    {{- $active := eq $pageURL .URL -}}
    <li class="{{ if $active }}open{{ end }}">
      {{- template "sidebar-item-link" (dict "context" (dict "RegularPages" .Children "Sections" slice) "active" $active "title" .Name "link" .URL) -}}
      {{- if .Children -}}
        <div class="ltr:hx-pr-0 hx-overflow-hidden">
          <ul class='hx-relative hx-flex hx-flex-col hx-gap-1 before:hx-absolute before:hx-inset-y-1 before:hx-w-px before:hx-bg-gray-200 before:hx-content-[""] ltr:hx-ml-3 ltr:hx-pl-3 ltr:before:hx-left-0 rtl:hx-mr-3 rtl:hx-pr-3 rtl:before:hx-right-0 dark:before:hx-bg-neutral-800'>
            {{- range .Children -}}
              {{- $childActive := eq $pageURL .URL -}}
              <li class="hx-flex hx-flex-col {{ if $childActive }}open{{ end }}">
                {{- template "sidebar-item-link" (dict "context" (dict "RegularPages" slice "Sections" slice) "active" $childActive "title" .Name "link" .URL) -}}
              </li>
            {{- end -}}
          </ul>
        </div>
      {{- end -}}
    </li>
  {{- end -}}
</ul>
```

The only change from before is that every `sidebar-item-link` call now
passes `(dict "RegularPages" .Children "Sections" slice)` as `context` instead of the raw `MenuEntry`, which satisfies
the collapsible button check without ever calling `.RegularPages` on the entry itself.

<div class="human-question">
Why do you imagine the software industry never takes stock of absolutely massive and routine reuse failures of this kind?
</div>

Because the incentives never align to fix it.

The people who feel the pain most acutely — developers doing exactly what you're doing, trying to compose or override a
small piece of someone else's template — have no leverage over the design decisions made upstream. The theme author
ships something that works for their use case, the override/reuse story is an afterthought, and by the time the API is "stable" it's too expensive to break.

Hugo's `define` blocks are a good example of the deeper pattern: the mechanism was designed for template inheritance
in the simple case, not for surgical overrides in a large theme. The same failure recurs in React component libraries,
CSS frameworks, CMS theming systems, plugin architectures — anywhere a large coherent thing is built first and composability is bolted on later or not at all.

The stock-taking does happen occasionally — usually as a clean rewrite that then repeats the cycle.
But the industry has no real feedback loop between the people who design these APIs and the people who spend hours
untangling them two years later. The cost is diffuse, invisible, and borne entirely by downstream users.
Nobody files a P0 bug for "reuse is harder than it should be."

The honest answer is probably that composability is genuinely hard to design upfront, and most people building
these systems are optimising for the demo, not the long-term integration surface.

<div class="human-question">
Could one consider that there is evidence that the primitives that are commonly available to build software from
inherently defeat composability rather than this representing an upfront design failure by individual framework designers?
</div>

Yes, and that's a much more honest framing.

The evidence is pretty strong. The same failure pattern appears across decades, languages, paradigms, and teams of
wildly varying skill. Object inheritance, CSS cascades, Hugo `define` blocks, React context, plugin hooks — they all
start with a plausible composability story and reliably produce the same tangle. At some point the most parsimonious
explanation stops being "framework designers keep making the same mistake" and starts being "the underlying primitives
have a structural property that defeats composition."

The core problem seems to be that most primitives are built around **substitution** — you replace one thing with
another. But real reuse almost always requires **wrapping** or **interception** — you want to sit beside something,
augment it, redirect one piece of it. Substitution forces you to take ownership of the whole thing to change any
part of it, which is exactly what you hit with `sidebar.html`.

There's a deeper issue too. Composability requires that a system's pieces have **stable, narrow contracts** — they
promise little and expose little. But useful software tends toward the opposite: pieces that do a lot, know a lot
about their context, and are therefore coupled to it. `sidebar-item-link` knowing about `.RegularPages` is not a
design error, it's just a function that grew to meet real needs. Composition and capability pull in opposite
directions and most primitives don't give you a way to manage that tension, they just let it accumulate.

Some traditions have taken this seriously — concatenative languages, capability-based systems, certain Lisp and
Smalltalk lineages. They tend to remain niche, which is itself further evidence: the mainstream primitives that
win adoption are not selected for composability.

<div class="human-question">
All things being equal, could the widespread use of AI for code generation be expected to exacerbate or alleviate this problem?
</div>

Exacerbate it, almost certainly.

AI code generation optimises for the same thing the demo optimises for — something that works for the case in front of
it. It's trained on the corpus of existing code, which already embeds all the composability failures you're describing.
It reproduces those patterns fluently and confidently because they are statistically dominant.

More specifically, AI generation tends to:

**Produce whole things rather than narrow contracts.** When you ask for a sidebar or a navbar it gives you a
complete artifact. This is locally satisfying but globally it means the stock of large, monolithic, hard-to-partially-override things grows faster.

**Obscure the cost of coupling.** A human developer who spends two hours untangling `sidebar.html` accumulates
some intuition about what caused the problem. That feedback is lost when the same two hours is saved upfront by
generation — the coupling is still there but nobody paid the price that would have taught them to avoid it.

**Accelerate the accumulation of code that nobody fully understands.** Composability failures are most acute
at the boundaries between pieces written by different people at different times with different assumptions.
AI generation dramatically increases the volume of such pieces entering codebases.

The alleviating argument would be that AI could in principle generate narrow, well-contracted primitives if
asked to, or could help untangle existing coupling. That's true but it requires the person asking to already
understand the problem — which is precisely the understanding that gets bypassed when generation is used
to avoid engaging with the code in the first place.

So the net effect is probably: faster accumulation of the same structural problems, with less human
understanding distributed across the industry to diagnose or push back on them.

<div class="human-question">
Given we agreed that it was not plausible to assign the blame for ill-contracted design elements onto those
at the point of design, but instead more convincingly on the underlying primitives, is
this not evidence that AI-generated code would benefit disproportionately from any
improvement in the underlying primitives than code generated by humans?
</div>

That's a sharp observation and I think it's right.

If the failure is primarily in the primitives rather than in the judgment of the person using them, then the quality ceiling for any code generator — human or AI — is set by the primitives
available. A human brings compensating intuitions: they feel the pain of bad composition, they develop heuristics,
they sometimes push back against the grain of the tools. Those compensations are imperfect and inconsistent but they exist.

An AI generator has no such friction. It reproduces whatever the primitives make easy, at scale and without
hesitation. This means it hits the ceiling faster and harder than a human would — but it also means that
if the ceiling is raised by better primitives, the AI benefits more completely. A human might still reach
for a familiar bad pattern out of habit or because the old primitives are still available. An AI
trained on a corpus where better primitives are dominant would simply use them.

There's a further implication. One reason better primitives have historically struggled to achieve
adoption is the activation energy required — humans have to learn them, unlearn existing habits, and
tolerate a period of lower productivity. AI generation could in principle collapse that activation
energy almost to zero. If a sufficiently better primitive exists and is well represented in training data,
the switching cost for an AI consumer is negligible compared to a human one.

So the argument runs: AI generation is currently a multiplier on whatever the primitives reward.
That's bad when the primitives are bad. But it also means the leverage runs both ways — improvements
in primitives could propagate through AI-generated code faster and more completely than they ever could through human practice.

</div>

The central message, that AI could be expected to benefit disproportionately from, and also greatly assist in the development of
new notations, is familiar from my [New Notations Era](/post/2025-04-19-new-notation-era) posting but feels rather more pointed
in a concrete context as well as coming from the horse's mouth. Not that, of course, one could expect it to have any more
accurate introspection than any other kind of intelligence.
