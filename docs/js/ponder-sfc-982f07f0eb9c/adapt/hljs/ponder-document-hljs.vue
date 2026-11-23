<script>
// Swaps the static syntax stylesheet for highlight.js's. The highlighting itself is no longer done by highlight.js's
// script once each page has loaded, but by the site's markdown pipeline as content is rendered - see
// ponderMarkdown.highlightFences in infusion/js/markdown.js - so that it is part of the content as built
fluid.def("ponder.document.hljs", {
    stylesheets: {
        syntax: {href: "/css/highlight.min.css"}
    }
});
</script>
