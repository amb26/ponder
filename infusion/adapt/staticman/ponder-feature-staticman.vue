<script>
// Staticman comments - replaces the {{ if .Site.Params.staticman }} blocks of Hugo's head.html, footer.html and
// post_meta.html
fluid.def("ponder.feature.staticman", {
    $layers: "fluid.component",
    staticmanLinkage: {
        $linkage: [{
            inputLayers: ["ponder.document"],
            outputLayers: ["ponder.document.staticman"]
        }, {
            inputLayers: ["ponder.postMeta"],
            outputLayers: ["ponder.postMeta.staticman"]
        }]
    }
});
</script>
