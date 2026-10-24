<script>
// Base layer for the component holding translated UI strings - Hugo's i18n/*.yaml. One derived layer per language,
// selected by ponder.site's `i18nLayer`. Placeholders are written {0} rather than Go's {{ . }}.
fluid.def("ponder.i18n", {
    strings: {}
});
</script>
