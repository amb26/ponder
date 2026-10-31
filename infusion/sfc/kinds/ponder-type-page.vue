<script>
// The {{ if eq .Type "page" }} branches of Hugo's header.html, footer.html (page_meta.html) and single.html (no pager).
// The pager is turned off through a knob on the document rather than by restating `main`, since a stronger layer's
// $component record replaces a weaker one's as a unit - see REQUIREMENTS.md R9.
fluid.def("ponder.type.page", {
    header: {
        $component: {
            $layers: ["ponder.header", "ponder.header.page"]
        }
    },
    showPageMeta: true,
    showPager: false
});
</script>
