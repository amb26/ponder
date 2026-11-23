<script>
// Adds the search entry to the navigation bar, purely as data - see ponder.navbar's `extraItems`
fluid.def("ponder.navbar.gcse", {
    extraItems: {
        gcse: {
            priority: 900,
            layer: "ponder.navItem.gcseSearch"
        }
    }
});
</script>
