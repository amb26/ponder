<script>
// Multilingual support - replaces the {{ if .Site.IsMultiLingual }} block of Hugo's nav.html and the
// {{ if .IsTranslated }} block of post_meta.html. The *language* of the site is not an adaptation - it selects the
// i18n layer of ponder.site and binds <html lang> directly.
// Sketch only: the site model does not yet build per-language page trees or `translations` - REQUIREMENTS.md R14.
fluid.def("ponder.feature.multilingual", {
    $layers: "fluid.component",
    multilingualLinkage: {
        $linkage: [{
            inputLayers: ["ponder.navbar"],
            outputLayers: ["ponder.navbar.multilingual"]
        }, {
            inputLayers: ["ponder.postMeta"],
            outputLayers: ["ponder.postMeta.translations"]
        }]
    }
});
</script>
