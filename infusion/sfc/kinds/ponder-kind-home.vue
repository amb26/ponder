<script>
// Hugo's index.html, plus the {{ if .IsHome }} branches of header.html. Adaptation layers are listed before the base
// layer they adapt, since an earlier entry in $layers beats a later one.
fluid.def("ponder.kind.home", {
    header: {
        $component: {
            $layers: ["ponder.header.home", "ponder.header"]
        }
    },
    main: {
        $component: {
            $layers: "ponder.main.home"
        }
    }
});
</script>
