<script>
// The {{ if eq .Type "post" }} branches of Hugo's header.html, applied to a single page of content type "post"
fluid.def("ponder.type.post", {
    header: {
        $component: {
            $layers: ["ponder.header.post", "ponder.header"]
        }
    }
});
</script>
