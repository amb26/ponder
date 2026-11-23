<script>
// Adds a language switcher entry to the navigation bar, after any search entry
fluid.def("ponder.navbar.multilingual", {
    extraItems: {
        languages: {
            priority: 910,
            layer: "ponder.navItem.languages"
        }
    }
});
</script>
