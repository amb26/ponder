<script>
// Self-hosted assets - replaces the {{ if .Site.Params.selfHosted }} ... {{ else }} ... blocks of Hugo's head.html and
// footer.html, which choose between local and CDN copies of KaTeX, Font Awesome and Bootstrap
fluid.def("ponder.feature.selfHosted", {
    $layers: "fluid.component",
    selfHostedLinkage: {
        $linkage: {
            inputLayers: ["ponder.document"],
            outputLayers: ["ponder.document.selfHosted"]
        }
    }
});
</script>
