---
title: Layer Linearisation
category: Infusion
type: infusion-docs
---

This note describes how Infusion 6 orders the layers of a component: how the `$layers` lists written by authors are
linearised into the single list held at `that.$layers`, and so which layer's contributions win a merge. It records the
decisions taken in [FLUID-5743](https://issues.fluidproject.org/browse/FLUID-5743), which made a layer listed further
right beat those to its left, together with a relaxation of the C3 consistency rule and an assessment of its
consequences against the "pedalo" example of Barrett et al.,
[A Monotonic Superclass Linearization for Dylan](https://opendylan.org/_static/c3-linearization.pdf) (OOPSLA 1996).

The implementation is in [`Fluid.js`](https://github.com/fluid-project/infusion-6/blob/main/src/framework/core/js/Fluid.js)
(`fluid.C3_merge`, `fluid.C3_precedence`, `fluid.C3_precedence_parents` and the hierarchy resolver) and
[`FluidIL.js`](https://github.com/fluid-project/infusion-6/blob/main/src/framework/core/js/FluidIL.js) (merge records
and subcomponent records). Tests are in `tests/framework-tests/core/js/FluidJSTests.js`, under
"C3 linearisation for FLUID-5800".

## The rule as authors see it

* Every list of layer names is read **weakest first**: a layer listed later in `$layers` beats one listed earlier.
* A layer always beats the layers it inherits from.
* The resolved list at `that.$layers` is also weakest first, so it reads in the same direction as it is written.

```js
fluid.def("my.shape", {$layers: "fluid.component", sides: 0, colour: "black"});
fluid.def("my.red", {$layers: "fluid.component", colour: "red"});
fluid.def("my.triangle", {$layers: "my.shape", sides: 3});
fluid.def("my.redTriangle", {$layers: ["my.triangle", "my.red"]});

const t = my.redTriangle();
t.colour;    // "red" - my.red is listed after my.triangle, and so beats it and my.shape
t.$layers;   // ["fluid.component", "my.shape", "my.triangle", "my.red", "my.redTriangle"]
```

This reverses the order used by Infusion 1.x, in which the leftmost entry won. FLUID-5743 reported that users
generally expect the opposite, matching the reading order of CSS cascades and of most mixin systems.

## C3 underneath

The linearisation itself is C3, as used by Dylan and by Python's method resolution order. C3 merges

* the linearisations of each of a layer's parents, and
* the layer's own parent list (its *local precedence order*),

taking at each step the first head of any list which appears in no other list's tail. If no such head exists, the
hierarchy is inconsistent. C3 is **monotonic**: a layer's linearisation extends each of its parents' linearisations
without reordering them, and it respects every layer's local precedence order.

C3 conventionally works strongest first. Infusion therefore reverses each `$layers` list before supplying it to C3,
and reverses the result, so that the algorithm is unchanged and only the reading direction of the lists differs.

### Two strengths of ordering

* **Within a def**, a layer's `$layers` list is a hard constraint, as above. Two parents whose own hierarchies order
  some pair of layers in opposite ways cannot be reconciled, and fail with "Inconsistent hierarchy".
* **At the top level** of a component, the list made up of its layer, any `$layers` from a creator function's
  argument, the layers named by its subcomponent records and so on, is a **preference** only.
  `fluid.C3_precedence_parents` merges just the linearisations of the listed layers, not the list itself, so a
  misordered list here never fails. It gives way wherever the layers' own hierarchies require it.

### Ignoring a restated ancestor

A list which names a layer to the right of another layer that already inherits from it asks for the ancestor to beat
its own descendant. For example, `fluid.resolveRoot` inherits from `fluid.component`, so in

```js
$layers: ["fluid.resolveRoot", "fluid.component"]
```

`fluid.component` is asked to beat `fluid.resolveRoot`, which C3 cannot honour. Such a restatement is now **ignored**
rather than failing. The descendant's own hierarchy already places the ancestor beneath it, and the author's intent,
that both layers apply, is clear.

Concretely, `fluid.C3_precedence` filters a def's parents before merging them. Working strongest first, a parent is
dropped if it appears in the linearisation of any parent following it, that is, of any parent listed to its left in
`$layers`.

A restatement on the **weak** side of its descendant is retained, since it carries meaning: it constrains where the
ancestor falls relative to the def's *other* parents (see below). Only restatements that cannot be honoured are
dropped. A rule dropping every restatement, whichever side it fell on, was considered and rejected for this reason.

Genuine conflicts are still reported. In Python's `ex_2` hierarchy, where `A` lists `[X, Y]` and `B` lists `[Y, X]`,
any layer deriving from both `A` and `B` still fails with "Inconsistent hierarchy".

## The pedalo example

Figure 2 of Barrett et al. gives this hierarchy, written here as Infusion `$layers`, weakest first:

```js
fluid.def("boat", {$layers: "fluid.component"});
fluid.def("dayBoat", {$layers: "boat"});
fluid.def("wheelBoat", {$layers: "boat"});
fluid.def("engineless", {$layers: "dayBoat"});
fluid.def("smallMultihull", {$layers: "dayBoat"});
fluid.def("pedalWheelBoat", {$layers: ["wheelBoat", "engineless"]});
fluid.def("smallCatamaran", {$layers: "smallMultihull"});
fluid.def("pedalo", {$layers: ["smallCatamaran", "pedalWheelBoat"]});
```

`dayBoat` reaches `pedalWheelBoat` through `engineless`, its strongest parent, so `dayBoat` beats `wheelBoat`. The paper
uses exactly this to motivate monotonicity: under CLOS's linearisation, `pedalo` reorders `wheelBoat` above `dayBoat`,
so a method on `dayBoat` is the most specific for both of `pedalo`'s parents, but a method on `wheelBoat` is the most
specific for `pedalo` itself. C3 forbids this, and so does Infusion.

Suppose the author of `pedalWheelBoat` restates `dayBoat`. Strongest first, for comparison with the paper:

| `pedalWheelBoat` `$layers` | Linearisation, strongest first | Outcome |
|---|---|---|
| `["wheelBoat", "engineless"]` | pedalWheelBoat, engineless, dayBoat, wheelBoat, boat | `dayBoat` beats `wheelBoat` |
| `["dayBoat", "wheelBoat", "engineless"]` | pedalWheelBoat, engineless, wheelBoat, dayBoat, boat | Restatement kept: `wheelBoat` beats `dayBoat` |
| `["wheelBoat", "engineless", "dayBoat"]` | pedalWheelBoat, engineless, dayBoat, wheelBoat, boat | Previously an error, now the restatement is ignored |

In each case the linearisation of `pedalo` extends that of `pedalWheelBoat`, as C3 requires. With the second variant
it is pedalo, pedalWheelBoat, engineless, wheelBoat, smallCatamaran, smallMultihull, dayBoat, boat. The three variants
appear as fixtures in `FluidJSTests.js`.

The second row shows why consistent restatements are retained. Under a rule which dropped them as well, it would
collapse into the first row, silently discarding a statement which is consistent and which changes the result.

### Consequences of the relaxation

* **Monotonicity is unaffected.** A dropped parent's linearisation is already contained in its descendant's, so the
  merge loses no constraint by dropping it. Every layer's linearisation still extends those of its parents without
  reordering them.
* **An author can be silently misunderstood.** In the third row, the author may have meant either "`dayBoat` should
  beat `engineless`", which is impossible, or "`dayBoat` should beat `wheelBoat`", which they get. Previously the
  error showed them that their list could not mean what they wrote. Now they learn it only from the values in the
  merged component, which is the kind of dispatch surprise the paper set out to rule out, here arising from discarded
  input rather than from a non-monotonic algorithm.
* **Whether a restatement counts depends on distant layers.** If `engineless` were redefined so that it no longer
  inherited from `dayBoat`, the ignored mention would come into effect, making `dayBoat` the strongest parent of
  `pedalWheelBoat`. With live editing of layers, for example in the tldraw workspace, a change to one layer can
  therefore change precedence in another layer which never mentioned it.
* **Only direct restatements are forgiven.** Conflicts arising between the hierarchies of two parents still fail.

## Other places where layer names are combined

Every site which assembles a list of layer names follows the same weakest-first convention:

* **Co-occurrences (linkages).** The output layers of a `$linkage` which matches a component are added at the strong
  end of its layer list. Of two linkages firing in the same round, the one registered later wins.
* **Subcomponent records.** When several layers contribute `$component` records at the same member, their `$layers` are
  gathered weakest contribution first. Duplicates are removed by `fluid.uniqueLayerNames`, which keeps each name's
  last, and so strongest, occurrence. Within one record, a layer listed later beats one listed earlier.
* **Merge records.** A component's merge records, such as its creator function's argument, its subcomponent record and
  its live layer, contribute layer names weakest record first, after the component's own layer names. A creator
  function's `$layers` therefore beat the layer of the function itself.
* **Dynamic layers.** References in `$layers` such as `"{self}.flavour"` are resolved reactively and merged at
  `dynamicLayers` priority, above all static layers and literal configuration, *wherever they appear in the list*.
  Amongst themselves they follow the same order: a later reference beats an earlier one, the dynamic layers of a
  derived layer beat those it inherits, and a component's own record-level references beat inherited ones. Writing
  dynamic references at the right of a list, as is conventional, keeps the written order consistent with the
  outcome. A dynamic reference written before a static layer still beats it.
* **Single File Components.** The SFC loader's tag layer `fluid.sfcLayer` is placed first, at the weak end, of an SFC's
  `$layers`. Appending it would make it an ancestor restated to the right of any SFC deriving from another.
* **Choosing dynamic layers.** `fluid.definedLayers(...candidates)` filters candidates to those which are defined,
  keeping their order, so callers list the most specific, and strongest, candidate last.
  `fluid.firstDefinedLayer(...candidates)` instead takes candidates in order of preference and returns only the first
  which is defined, so its argument order is unaffected.
* **Transmission.** The Portable Transmission Format sorts layer names by derivation rank, which does not depend on
  list order.

## Residual issues

* Dynamic layers are promoted above all static layers regardless of their position in a list, as described above. A
  rule honouring their written position would be more uniform. It would change the outcome only of lists which write
  a dynamic reference before a static layer, since the conventional idiom
  `$layers: ["fluid.component", "{self}.flavour"]` already lists it last.
* Order is a hard constraint only inside a def. At the top level of a component, or within a subcomponent record, it
  is a preference, so a misordered list there raises no error.
* The relaxation trades an error for silence in one class of case, as described under
  [Consequences of the relaxation](#consequences-of-the-relaxation). A diagnostic could be logged when a restatement
  is ignored, should this prove confusing in practice.
