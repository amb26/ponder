---
title: Hunting rich editors
date: 2025-03-28
---

The substrate's transition to editability will need to present a "mostly rendered" view of itself &ndash; managed
by some form of rich text editor. A huge "grab-bag list" is at JefMari's curated list of
[Awesome Wysiwyg Editors](https://github.com/JefMari/awesome-wysiwyg-editors) which can rapidly be whittled down
to a shortlist. [CKEditor 5](https://github.com/ckeditor/ckeditor5) and [TinyMCE](https://github.com/tinymce/tinymce)
are familiar from decades ago. But the gold standard is clearly Marijn's [ProseMirror](https://prosemirror.net/) &ndash;
[basic example](https://prosemirror.net/examples/basic/) here and really nice markdown editing example here.

It feels as if an Infusion component tree could very easily be the backing of one of Marijn's [document models](https://prosemirror.net/docs/guide/#doc)
but we'd need to produce a [schema](https://prosemirror.net/docs/guide/#schema). Indeed the whole thing is feeling
rather heavyweight and not the kind of thing we could bash into a demo in a couple of weeks. A checkin confirms that
a minimal sort of bundle size of ProseMirror is in the region of 200K, [Marijn concurs](https://discuss.prosemirror.net/t/reduce-size-of-bundle/1705).
TinyMCE and CKEditor don't seem much different.

In the meantime we run into a principled rant from a former mathematician and Medium Engineering lead Nick Santos
[Why ContentEditable is Terrible](https://medium.engineering/why-contenteditable-is-terrible-122d8a40e480). I've often
reflected that perhaps the only benefit of my mathematical education is equipping me to tell anyone armed with an
impressive abstraction to eff off, but the analysis here seems sound and warns of pretty dreadful problems if we
start round-tripping stuff in earnest. Along the way we run into Steve Yegge's salutory 2004 rant on the 
[Nonesuch Beast](https://sites.google.com/site/steveyegge2/nonesuch-beast) which warns us that what we are trying to do
is likely impossible &mdash; "People need to understand when they're asking for something that's going to be too complex to learn and use."

But still &mdash; we need to get off the ground more quickly and carry less
weight with us for a while. Let's put these warnings in our back pocket and look for something a bit more minimal.
This [Reddit thread](https://www.reddit.com/r/webdev/comments/1dfq69v/looking_for_a_very_basic_wysiwyg_editor_in_js_to/)
gives a few pointers but TipTap is itself based on ProseMirror. The AI suggestions for "rich text editor with smallest bundle size"
bring up the hilariously named [Trumbowyg](https://github.com/Alex-D/Trumbowyg) which is sadly jQuery-based and then
the peculiarly promising [Pell](https://github.com/jaredreich/pell/blob/master/src/pell.js) which weighs in at an amazing
145 lines. The [live demo](https://codepen.io/meanbard/pen/rdjMQg) seems perfectly reasonable, and when we look at the
implementation, we find that it is, surprise surprise, based wholly around ``contentEditable``!

This really does feel like something we can work with[^1], and morning noodlings suggest that contentEditable might not
have to be such a great unwashed. For a start, if we are tracking provenance of each rendered region to its source,
each one might need to be editable (or read-only) in a different way anyway. We should research what the effects are
of stringing together adjacent sibling nodes with ``contentEditable`` versus promoting up to the parent.

In any case we have a workable lift-off vehicle &ndash; the entire (tiny) design can be Infusionised and first experiment
is to check that it is perfectly workable to embed a self-hosted demo inside Infusion's README file &ndash; it's puzzling
that pell's own demo takes the form of a little video.

[^1] And to me the "pell" name is a pleasing signpost back to the great
[Pelle Ehn](https://www.interaction-design.org/literature/author/pelle-ehn)
one of the founding fathers of malleable software thinking.
