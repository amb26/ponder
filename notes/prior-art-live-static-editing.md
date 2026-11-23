# Prior art: editing a statically published site in place

A survey, made in November 2026, of systems with a goal like that of wend and the "Edit in Infusion" extension: to
edit a page of a statically published site in place, in the browser, previewing the edit by the site's own rendering,
and committing it back to the site's sources.

The findings come from web searches, and the projects were judged from their own descriptions and from reviews, not
from reading their code. Parsoid and Webstrates are described from general knowledge, since the searches did not
reach them.

## What wend combines

- The page carries its own provenance record, `application/fluid-provenance+json`, which names the sources it was
  built from, its build's rendering scripts and the copy of Infusion it was built with.
- In the browser, the site's own component tree is booted over the published static page, so an edit is previewed by
  the same components and markdown pipeline as the build uses, not by a separate preview renderer.
- No server is needed beyond GitHub. Edits are committed through the Contents API, as the user signed in by GitHub's
  device flow.
- An edit is recognised as published once the rebuilt site's trace, `fluid-trace.json`, records it.

No system found does all of these. Each one has precedents, though.

## The closest precedent: Wikipedia's VisualEditor and Parsoid

VisualEditor edits a rendered page in place, on the live site, and serialises the edit back into wikitext, the
textual source. Parsoid makes this possible by recording the source offsets and template structure of each element in
the HTML (`data-parsoid`, `data-mw`). This is the same idea as the provenance record. Unlike wend, it depends on a
server which converts between HTML and wikitext in both directions. The site isn't static, and the build's pipeline
doesn't run in the browser.

## Commercial visual editors: provenance in data attributes

- **CloudCannon** works with plain static HTML output. Attributes such as `data-editable`, `data-path` and `data-key`
  tie an element to its source file.
- **Sanity** marks elements with `data-sanity` attributes, or with invisible encoded text, and an overlay reads them to
  offer click-to-edit.
- **Netlify's Visual Editor**, formerly Stackbit, is reported to write `data-cms-edit-*` attributes into the HTML at
  build time, mapping elements back to Markdown, JSON or YAML in git. This comes from a third-party guide.

These follow the same pattern as the provenance record. The editing, however, happens within the vendor's hosted
editor or a running development server, not on the published page. In general the preview is not produced by the
site's own build code running in the browser.

## Git-backed contextual editing: TinaCMS

TinaCMS renders its editing preview with the site's own React components, and edits become git commits. It is the
nearest to wend's isomorphic preview. It requires, though, that the site be a React or Next.js app, with Tina's own
bundle and backend involved, rather than booting over plain published HTML.

## Small open-source in-place editors

These are the closest in spirit. They edit HTML, though, rather than a source which is rendered into it.

- **Handpress** edits a hand-written static site in place, and each save is a git commit. It holds the source as a
  second DOM beside the page and targets edits by key, a lightweight form of provenance.
- **Blip** is a visual editor in the browser which syncs to GitHub, aimed at flat-file HTML sites.
- **git-edit** edits HTML elements which are marked with a class and data attributes, with a live preview, and commits
  to GitHub through a proxy.
- **edit-mode** edits the text of static HTML inline, but downloads the new file rather than committing it.
- **GitMark** is a Chrome extension which edits Markdown, but only in GitHub's own file view, not on the published
  site.
- **Markdown++**, **gitzen**, **Decap CMS** and **GitLab's Static Site Editor** are git-backed editors of markdown
  files, not of the rendered page.

## Research: editing output back to source

- **Sketch-n-Sketch** runs a program which produces HTML or SVG. When the output is edited directly, it works out a
  change to the program which reproduces the edit, using trace links from output back to source.
- **FuseDM** (2024) tries to free users from needing to know about those links.
- Both treat general programs, and neither touches publishing.
- **Webstrates** takes the opposite approach. The live DOM itself is the shared, persisted document, with no source
  and no static build.

## Where wend stands

- Placing provenance within the page is well established, in Parsoid, CloudCannon and Sanity.
- Editing the published page in place and committing to git exists, but only in tools which treat HTML as the source,
  e.g. Handpress and Blip.
- Previewing by the site's own components exists only within app frameworks, e.g. TinaCMS.
- No system was found which boots its build's own component tree and pipeline over a plain static page from the
  page's published provenance, or which confirms publication against a build trace.

The comparisons most worth making are with Parsoid and VisualEditor, for turning a rendered edit back into source,
with CloudCannon, for provenance in data attributes on static output, and with Sketch-n-Sketch, for the theory of
bidirectional editing.

## Sources

- [Handpress](https://github.com/bikramtuladhar/handpress)
- [git-edit](https://github.com/krispo/git-edit)
- [Blip](https://blipcms.com/)
- [edit-mode](https://github.com/christoph-det/edit-mode)
- [GitMark](https://github.com/ThinkMo/gitmark)
- [Markdown++](https://github.com/emir/markdown-plus-plus)
- [gitzen](https://gitzen.dev/)
- [GitLab Static Site Editor](https://gitlab.com/gitlab-org/gitlab/-/tree/v13.1.2-ee/doc/user/project/static_site_editor)
- [CloudCannon: editable regions on static sites](https://community.cloudcannon.com/t/adding-editable-regions-to-static-sites/476)
- [Sanity: overlays and click-to-edit](https://www.sanity.io/docs/visual-editing/visual-editing-overlays)
- [Sanity: visual editing without React](https://www.sanity.io/docs/visual-editing/visual-editing-without-react)
- [A guide to Netlify's Visual Editor](https://adhdecode.com/articles/netlify/netlify-visual-editor-setup/)
- [Setting up visual editing on a headless CMS frontend](https://headlesscms.guide/guides/how-to-set-up-visual-editing-on-a-headless-cms-frontend)
- [Smashing Magazine: Visual editing comes to the headless CMS](https://smashingmagazine.com/2023/06/visual-editing-headless-cms/)
- [TinaCMS: inline content editing for React](https://snipcart.com/blog/tinacms-nextjs-cms)
- [Decap CMS documentation](https://decapcms.org/docs)
- [Bidirectional Evaluation with Direct Manipulation](https://arxiv.org/pdf/1809.04209)
- [Sketch-n-Sketch](https://ravichugh.github.io/sketch-n-sketch/)
- [Fusing Direct Manipulations into Functional Programs](https://doi.org/10.1145/3632883)
