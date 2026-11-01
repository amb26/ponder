<script>
// The {{ if eq .Type "page" }} branches of Hugo's header.html, footer.html (page_meta.html) and single.html (no pager).
// The document's `pageMeta`, removed by default, is restored with a complete record, and the pager is removed from
// `main` by a contribution which adjusts the record supplied by ponder.kind.page.
fluid.def("ponder.type.page", {
    header: {
        $component: {
            $layers: ["ponder.header", "ponder.header.page"]
        }
    },
    pageMeta: {
        $component: {
            $layers: "ponder.pageMeta"
        }
    },
    main: {
        $component: {
            pager: null
        }
    }
});
</script>
