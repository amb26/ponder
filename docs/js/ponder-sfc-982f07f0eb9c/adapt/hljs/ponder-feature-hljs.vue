<script>
// highlight.js - replaces the {{ if .Site.Params.useHLJS }} blocks of Hugo's head.html and footer.html
fluid.def("ponder.feature.hljs", {
    $layers: "fluid.component",
    hljsLinkage: {
        $linkage: {
            inputLayers: ["ponder.document"],
            outputLayers: ["ponder.document.hljs"]
        }
    }
});
</script>
