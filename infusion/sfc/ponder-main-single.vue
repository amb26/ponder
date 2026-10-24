<script>
// A single page of content - Hugo's _default/single.html. Its optional parts are slots bearing @if (REQUIREMENTS.md
// R4), absent from the markup when their condition fails. Conditions read whole records of parameters rather than
// optional members of them, since a reference to a missing member is unavailable rather than undefined.
fluid.def("ponder.main.single", {
    $layers: "ponder.main",
    content: {
        $component: {
            $layers: "ponder.content",
            html: "{document}.page.content"
        }
    },
    tags: {
        $component: {
            $layers: "ponder.tags",
            tags: "{document}.page.params.tags"
        }
    },
    share: {
        $component: {
            $layers: "ponder.shareLinks"
        }
    },
    related: {
        $component: {
            $layers: "ponder.relatedPosts"
        }
    },
    pager: {
        $component: {
            $layers: "ponder.pager"
        }
    },
    // The comment provider is chosen by configuration rather than hard-coded into this layout, as giscus is in the
    // site's copy of single.html
    comments: {
        $component: {
            $layers: "{site}.config.params.commentsLayer"
        }
    }
});

/**
 * Decide whether to show social share links - the conditions of Hugo's single.html and share-links.html combined.
 * A page's `socialShare` parameter overrides the site's.
 * @param {Object} pageParams - The page's front matter
 * @param {Object} siteParams - The site's parameters
 * @return {Boolean} `true` if share links are to be shown
 */
ponder.main.single.showShare = function (pageParams, siteParams) {
    return pageParams.socialShare ?? siteParams.socialShare ?? false;
};

/**
 * Decide whether to show related posts on a page - only if the site shows them and the page has some
 * @param {Object[]} pages - All of the site's page records
 * @param {Object} page - The page
 * @param {Object} siteParams - The site's parameters
 * @return {Boolean} `true` if related posts are to be shown
 */
ponder.main.single.showRelated = function (pages, page, siteParams) {
    return !!siteParams.showRelatedPosts && ponder.relatedPosts.find(pages, page, siteParams.related_content_limit).length > 0;
};

/**
 * Decide whether to show comments on a page
 * @param {Object} pageParams - The page's front matter
 * @param {Object} siteParams - The site's parameters
 * @return {Boolean} `true` if the site has comments, and they are not disabled for the page
 */
ponder.main.single.showComments = function (pageParams, siteParams) {
    return !!siteParams.comments && pageParams.comments !== false && !pageParams.disableComments;
};
</script>

<!-- The comments slot is a <script>, since the giscus template's root is its loader script, which is elided onto the
     slot whose tag wins - REQUIREMENTS.md R16 -->
<template>
    <div role="main">
        <div class="row">
            <div class="col-lg-8 col-lg-offset-2 col-md-10 col-md-offset-1">
                <article role="main" class="blog-post">
                    <div @id="content"></div>
                    <div @id="tags" @if="{document}.page.params.tags"></div>
                    <div @id="share" @if="ponder.main.single.showShare({document}.page.params, {site}.config.params)"></div>
                    <div @id="related" @if="ponder.main.single.showRelated({site}.pages, {document}.page, {site}.config.params)"></div>
                </article>
                <ul @id="pager" @if="{document}.showPager" class="pager blog-pager"></ul>
                <script @id="comments" @if="ponder.main.single.showComments({document}.page.params, {site}.config.params)"></script>
            </div>
        </div>
    </div>
</template>
