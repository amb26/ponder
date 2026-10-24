<script>
// Piwik/Matomo analytics - replaces the {{ if .Site.Params.piwik }} block of Hugo's footer.html
fluid.def("ponder.feature.piwik", {
    $layers: "fluid.component",
    piwikLinkage: {
        $linkage: {
            inputLayers: ["ponder.document"],
            outputLayers: ["ponder.document.piwik"]
        }
    }
});
</script>
