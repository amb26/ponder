<script>
fluid.def("ponder.postMeta.translations", {
    view: {
        $component: {
            $layers: ["fluid.sfcTemplateViewComponent", "fluid.partialViewComponent"],
            relativeContainer: "after: .ponder-date"
        }
    },
    translationLinks: {
        $component: {
            $layers: "fluid.component",
            $for: {
                source: "{postMeta}.page.translations",
                valueAs: "translation"
            },
            view: {
                $component: {
                    $layers: "fluid.templateViewComponent",
                    elideParent: false,
                    template: "<a href=\"@{translation.permalink}\" lang=\"@{translation.lang}\">@{translation.languageName}</a>"
                }
            }
        }
    }
});
</script>

<!-- Hugo joins the links with the i18n "translationsSeparator" - a separator between list members has no
     expression in a template -->
<template>
    <span class="ponder-translations">&nbsp;&bull;&nbsp;@{{i18n}.strings.translationsLabel}<span @id="translationLinks"></span></span>
</template>
