<script>
// The {{< vizreactive >}} shortcode - the live visualisation of fluid.cell's test fixtures, rendered as an island within
// the verbatim content of a page (REQUIREMENTS.md R2). It shows infusion-6's own visualiser, as its page
// tests/manual-tests/framework/html/visual-signal-test.html does, from the copy of Infusion the site publishes (see
// infusion/js/trace.js). Its libraries are payload for the browser, marked fluid-client so that they are never
// evaluated whilst rendering (R11). Once the island has rendered in the browser, its `widget` boots the visualiser into
// the island's target, and clears it should the island be destroyed - e.g. when the page is migrated in place for
// editing, whereupon the fresh island boots it afresh. Under node the libraries are never loaded, so that
// {global}.fluid.vizReactive is unavailable and nothing is bound.
fluid.def("ponder.shortcode.vizreactive", {
    $layers: "fluid.component",
    widget: {
        $bindable: {
            bind: "ponder.shortcode.vizreactive.boot({self}.view.renderedContainer, {global}.fluid.vizReactive, {global}.StubQUnit)",
            unbind: "ponder.shortcode.vizreactive.clear({boundValue})",
            onceOnly: true
        }
    }
});

/**
 * Boot the visualiser into the island's target, with the test fixtures registered by FluidSignalsTests-annotations.js
 * @param {Element} container - The island's rendered container
 * @param {Object} vizReactive - The visualiser, `fluid.vizReactive`, from qunit-visual-signals.js
 * @param {Object} stubQUnit - The stub of QUnit holding the registered fixtures, from qunit-stub.js
 * @return {Element} The target into which the visualiser rendered
 */
ponder.shortcode.vizreactive.boot = function (container, vizReactive, stubQUnit) {
    const target = container.querySelector(".vizreactive-target");
    // noinspection JSIgnoredPromiseFromCall
    vizReactive.vizReactiveUI(target, stubQUnit.allTests);
    return target;
};

/**
 * Remove the visualiser from its target
 * @param {Element} target - The target, as returned by `boot`
 */
ponder.shortcode.vizreactive.clear = function (target) {
    target.replaceChildren();
};
</script>

<script src="https://d3js.org/d3.v7.min.js" data-fl-scope="global" fluid-client></script>
<script src="https://cdn.jsdelivr.net/npm/dagre-d3@0.6.4/dist/dagre-d3.min.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/src/lib/codemirror/js/jshint.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/src/lib/codemirror/js/codemirror.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/src/lib/codemirror/js/javascript.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/tests/test-core/qunit/js/function-lint.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/src/lib/codemirror/js/javascript-lint.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/tests/test-core/qunit/js/lezer-transform.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/tests/test-core/qunit/js/qunit-stub.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/tests/test-core/qunit/js/qunit-visual-signals.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/tests/manual-tests/framework/js/visual-signals-test-gallery.js" data-fl-scope="global" fluid-client></script>
<script src="%infusion-6/tests/framework-tests/core/annotations/FluidSignalsTests-annotations.js" data-fl-scope="global" fluid-client></script>

<template>
    <div class="vizreactive">
        <link rel="stylesheet" href="/js/infusion-6/src/lib/codemirror/css/codemirror.css" />
        <link rel="stylesheet" href="/js/infusion-6/src/lib/codemirror/css/lint.css" />
        <link rel="stylesheet" href="/js/infusion-6/tests/test-core/qunit/css/qunit-visual-signals.css" />
        <div id="live-demo" class="vizreactive-target"></div>
    </div>
</template>
