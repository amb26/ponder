<script>
// The page header - Hugo's partials/header.html, shorn of its {{ if .IsHome }} and {{ if eq .Type "post" }} branches,
// which are supplied by the layers in infusion/sfc/kinds/. What remains are the "knobs" those layers turn: `title`,
// `subtitle`, `bigimg` and `showRule`. Optional elements are written with @if (REQUIREMENTS.md R4), so that they are
// absent from the markup when their condition fails, as in Hugo's output.
fluid.def("ponder.header", {
    title: "{document}.page.title",
    subtitle: "{document}.page.params.subtitle",
    bigimg: "{document}.page.params.bigimg",
    type: "{document}.page.type",
    // Hugo's {{ if ne .Type "post" }} - ponder.header.post turns it off
    showRule: true,
    bigImage: {
        $component: {
            $layers: "ponder.header.bigimg"
        }
    }
});

/**
 * Decide whether the subtitle is rendered by one of its two elements - a page's subtitle is a <span>, any other a <h2>
 * @param {String} [subtitle] - The subtitle, if any
 * @param {String} type - The page's content type
 * @param {String} element - The element asking, "span" or "h2"
 * @return {Boolean} `true` if the subtitle is rendered by that element
 */
ponder.header.subtitleAs = function (subtitle, type, element) {
    return !!subtitle && (type === "page") === (element === "span");
};
</script>

<!-- The theme's outer {{ if or $bigimg $title }} ... {{ else }} <div class="intro-header"></div> is dropped since every
     page of this site has a title. Hugo emits <div id="header-big-imgs"> as a *sibling* of <header>; here it is moved
     inside, since a template must have a single root - see REQUIREMENTS.md R3. -->
<template>
    <header class="header-section">
        <div @id="bigImage" @if="{header}.bigimg" class="ponder-big-image"></div>
        <div class="intro-header no-img">
            <div class="container">
                <div class="header-row">
                    <div class="@{type}-heading ponder-heading">
                        <h1 class="ponder-title">@{title}</h1>
                        <hr @if="showRule" class="small">
                        <span @if="ponder.header.subtitleAs({header}.subtitle, {header}.type, span)" class="@{type}-subheading">@{subtitle}</span>
                        <h2 @if="ponder.header.subtitleAs({header}.subtitle, {header}.type, h2)" class="@{type}-subheading">@{subtitle}</h2>
                    </div>
                </div>
            </div>
        </div>
    </header>
</template>
