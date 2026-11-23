<script>
// All the terms of a taxonomy as an accordion - Hugo's _default/terms.html. The site model supplies the terms, ordered
// by count, as `page.data.terms`, each with `name`, `count` and `pages`.
fluid.def("ponder.main.terms", {
    $layers: "ponder.main",
    terms: {
        $component: {
            $layers: "ponder.termPanel",
            $for: {
                source: "{document}.page.data.terms",
                valueAs: "term"
            }
        }
    }
});
</script>

<template>
    <div class="container" role="main">
        <div class="col-lg-8 col-lg-offset-2 col-md-10 col-md-offset-1">
            <article class="post-preview">
                <div @id="terms" class="panel-group" id="accordion"></div>
            </article>
        </div>
    </div>
</template>
