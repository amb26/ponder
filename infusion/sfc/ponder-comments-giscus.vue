<script>
// Comments via giscus, as hard-coded into the site's copy of single.html. Selected by the site parameter
// `commentsLayer` so that another provider (Disqus, staticman) is a matter of configuration.
fluid.def("ponder.comments.giscus", {
    repo: "amb26/ponder",
    repoId: "R_kgDOOKllGA",
    category: "Announcements",
    categoryId: "DIC_kwDOOKllGM4CvhAS"
});
</script>

<template>
    <script src="https://giscus.app/client.js"
            data-repo="@{repo}"
            data-repo-id="@{repoId}"
            data-category="@{category}"
            data-category-id="@{categoryId}"
            data-mapping="pathname"
            data-strict="0"
            data-reactions-enabled="0"
            data-emit-metadata="0"
            data-input-position="bottom"
            data-theme="light"
            data-lang="@{{site}.lang}"
            crossorigin="anonymous"
            async>
    </script>
</template>
