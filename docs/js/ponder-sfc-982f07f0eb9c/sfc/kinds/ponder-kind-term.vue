<script>
// Hugo's _default/list.html for a single taxonomy term such as /tags/reactivity/, whose heading is prefixed with "#"
// - the {{ if .Data.Singular }}#{{ end }} of header.html
fluid.def("ponder.kind.term", {
    header: {
        $component: {
            $layers: "ponder.header",
            title: "$compute:ponder.kind.term.title({document}.page.title)"
        }
    },
    main: {
        $component: {
            $layers: "ponder.main.list"
        }
    }
});

/**
 * Prefix a taxonomy term's title with a hash
 * @param {String} title - The term's title
 * @return {String} The title as rendered in the header
 */
ponder.kind.term.title = function (title) {
    return "#" + title;
};
</script>
