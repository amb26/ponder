<script>
// The home page - Hugo's index.html, a list of the pages in the site's `mainSections` beneath the home page's own
// content. Differs from ponder.main.list only in its markup, so it derives from it and supplies its own template.
fluid.def("ponder.main.home", {
    $layers: "ponder.main.list"
});
</script>

<template>
    <div role="main" class="ponder-front-page">
        <div class="col-lg-8 col-lg-offset-2 col-md-10 col-md-offset-1">
            <div class="ponder-content" @id="content" @if="{document}.page.content"></div>
            <div @id="previews" class="posts-list"></div>
            <ul @id="listPager" @if="ponder.listPager.hasPager({document}.page.paginator)"></ul>
        </div>
    </div>
</template>
