<script>
// The document's <head> - Hugo's partials/head.html, seo/opengraph.html and head_custom.html.
// The Kind-dependent cascade of {{ $.Scratch.Set "Title" ... }} becomes two computed members. Stylesheets and scripts
// are rendered from the document's keyed asset records, so that adaptations override them as data.
fluid.def("ponder.head", {
    title: "$compute:ponder.head.title({document}.page, {site}.config.params.homeTitle)",
    description: "$compute:ponder.head.description({document}.page)",
    shareImage: "$compute:ponder.head.shareImage({document}.page.params, {site}.config.params.logo, {site}.config.baseURL)",
    stylesheetTags: {
        $component: {
            $layers: "ponder.stylesheetTag",
            $for: {
                source: "{document}.stylesheets",
                valueAs: "stylesheet"
            }
        }
    },
    scriptTags: {
        $component: {
            $layers: "ponder.scriptTag",
            $for: {
                source: "{document}.headScripts",
                valueAs: "script"
            }
        }
    }
});

/**
 * Compute the document title - the {{ if .IsHome }} and Kind cascade at the top of Hugo's head.html
 * @param {Object} page - The page record
 * @param {String} homeTitle - The site's `homeTitle` parameter
 * @return {String} The content of the <title> element
 */
ponder.head.title = function (page, homeTitle) {
    let title;
    if (page.kind === "home") {
        title = homeTitle;
    } else if (page.kind === "taxonomy") {
        title = `Overview of all pages with ${page.data.plural}, ordered by ${page.data.singular} - ${homeTitle}`;
    } else if (page.kind === "term") {
        title = `Overview of all pages with the ${page.data.singular} #${page.title} - ${homeTitle}`;
    } else {
        title = page.title + " - " + homeTitle;
    }
    return title;
};

/**
 * Compute the meta description of a page - Hugo's `.Description | default .Params.subtitle | default .Summary`
 * @param {Object} page - The page record
 * @return {String} The description, truncated to 180 characters
 */
ponder.head.description = function (page) {
    const description = page.description || page.params.subtitle || page.summaryText || "";
    return description.length > 180 ? description.substring(0, 179) + "…" : description;
};

/**
 * Compute the OpenGraph share image of a page
 * @param {Object} params - The page's front matter
 * @param {String} logo - The site's `logo` parameter
 * @param {String} baseURL - The site's base URL
 * @return {String} The absolute URL of the image, as Hugo's absURL renders it
 */
ponder.head.shareImage = function (params, logo, baseURL) {
    const image = params.share_img ?? params.image ?? logo;
    return /^[a-z]+:/.test(image) ? image : baseURL + "/" + image.replace(/^\//, "");
};
</script>

<template>
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <title>@{title}</title>
    <meta name="description" content="@{description}">
    <meta name="author" content="@{{site}.config.params.author.name}"/>
    <meta property="og:title" content="@{{document}.page.title}" />
    <meta property="og:description" content="@{description}">
    <meta property="og:image" content="@{shareImage}" />
    <meta property="og:url" content="@{{document}.page.permalink}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="@{{site}.config.title}" />
    <link href="@{{site}.config.baseURL}/@{{site}.config.params.favicon}" rel="icon" type="image/x-icon"/>
    <meta name="generator" content="Infusion 6">
    <link rel="alternate" href="@{{site}.config.baseURL}/index.xml" type="application/rss+xml" title="@{{site}.config.title}">
    <!-- Fragment slots, since no element may wrap these within <head> - REQUIREMENTS.md R3 -->
    <fluid-fragment @id="stylesheetTags"></fluid-fragment>
    <fluid-fragment @id="scriptTags"></fluid-fragment>
</head>
</template>
