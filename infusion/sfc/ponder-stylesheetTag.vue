<script>
// One <link rel="stylesheet">, rendered from a member of the document's `stylesheets` record as `stylesheet`
fluid.def("ponder.stylesheetTag", {
});
</script>

<template>
    <link rel="stylesheet" href="@{stylesheet.href}" integrity="@{stylesheet.integrity}" crossorigin="@{stylesheet.crossorigin}" />
</template>
