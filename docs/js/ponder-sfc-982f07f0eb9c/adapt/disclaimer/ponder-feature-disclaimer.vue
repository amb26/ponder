<script>
// A disclaimer above the footer credits - replaces the {{ if .Site.Params.disclaimerText }} block of Hugo's
// footer.html
fluid.def("ponder.feature.disclaimer", {
    $layers: "fluid.component",
    disclaimerLinkage: {
        $linkage: {
            inputLayers: ["ponder.footer"],
            outputLayers: ["ponder.footer.disclaimer"]
        }
    }
});
</script>
