<script>
// Newer/older links between pages of a paginated list - the pager blocks of Hugo's list.html and index.html
fluid.def("ponder.listPager", {
    paginator: "{document}.page.paginator"
});

/**
 * Determine whether a paginated list has more than one page
 * @param {Object} [paginator] - The page's paginator record, with optional `prev` and `next` permalinks
 * @return {Boolean} `true` if a pager is to be shown
 */
ponder.listPager.hasPager = function (paginator) {
    return Boolean(paginator?.prev || paginator?.next);
};
</script>

<template>
    <ul class="pager main-pager">
        <li @if="{listPager}.paginator.prev" class="previous">
            <a href="@{paginator.prev}">&larr; @{{i18n}.strings.newerPosts}</a>
        </li>
        <li @if="{listPager}.paginator.next" class="next">
            <a href="@{paginator.next}">@{{i18n}.strings.olderPosts} &rarr;</a>
        </li>
    </ul>
</template>
