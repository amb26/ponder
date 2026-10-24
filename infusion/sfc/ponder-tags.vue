<script>
// The tag links of a post - the {{ if .Params.tags }} blocks of Hugo's single.html and post_preview.html
fluid.def("ponder.tags", {
    tags: [],
    tagLinks: {
        $component: {
            $layers: "fluid.component",
            $for: {
                source: "{tags}.tags",
                valueAs: "tag"
            },
            slug: "$compute:ponder.urlize({self}.tag)",
            view: {
                $component: {
                    $layers: "fluid.templateViewComponent",
                    // Hugo emits `<a>...</a>&nbsp;` - with the root not elided, both top-level nodes of the template
                    // are rendered, spliced into the list - REQUIREMENTS.md R3
                    elideParent: false,
                    template: "<a href=\"/tags/@{slug}/\">@{tag}</a>&nbsp;"
                }
            }
        }
    }
});
</script>

<template>
    <div @id="tagLinks" class="blog-tags"></div>
</template>
