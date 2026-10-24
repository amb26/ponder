<script>
// Swaps the static syntax stylesheet for highlight.js's, and adds its script and initialiser
fluid.def("ponder.document.hljs", {
    stylesheets: {
        syntax: {href: "/css/highlight.min.css"}
    },
    footerScripts: {
        hljs: {priority: 950, src: "/js/highlight.min.js"},
        hljsInit: {priority: 949, text: "hljs.initHighlightingOnLoad();"}
    }
});
</script>
