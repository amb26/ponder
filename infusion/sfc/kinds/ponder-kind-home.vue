<script>
// Hugo's index.html, plus the {{ if .IsHome }} branches of header.html. Adaptation layers are listed after the base
// layer they adapt, since a later entry in $layers beats an earlier one.
fluid.def("ponder.kind.home", {
    header: {
        $component: {
            $layers: ["ponder.header", "ponder.header.home"]
        }
    },
    main: {
        $component: {
            $layers: "ponder.main.home"
        }
    }
});
</script>
