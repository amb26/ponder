<script>
// Hugo's 404.html, whose {{ define "header" }} block is empty. A stronger layer can't yet remove a subcomponent declared
// by a weaker one with `null` - REQUIREMENTS.md R9 - so the document's header slot bears @if on a knob instead.
fluid.def("ponder.kind.404", {
    showHeader: false,
    main: {
        $component: {
            $layers: "ponder.main.notFound"
        }
    }
});
</script>
