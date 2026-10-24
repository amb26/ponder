/* eslint-env node */

"use strict";

// Renders the whole site as one component tree, with one ponder.document per page, each rendering into an output
// document of its own (fluid.outputDocumentView), and writes every document which has changed - the multi-document
// counterpart of src/framework/server/hydrate.js in Infusion 6.
//
// Usage: node infusion/js/buildSite.js [--infusion ../fluid-infusion-6] [-o docs-infusion] [--live true]
//     [--verbose true] [--from M] [--limit N]
// --live true keeps the inert records of the SFCs' scripts in each page, from which the page could be made live again -
// see REQUIREMENTS.md R11. Otherwise the build is static, and they are stripped.

const fs = require("fs"),
    path = require("path");
const siteModel = require("./siteModel.js"),
    feeds = require("./feeds.js");

/**
 * Parse the command line arguments of the form `--name value` or `-n value`
 * @param {String[]} args - The arguments following the script's name
 * @return {Object<String, String>} The values of the arguments keyed by name
 */
const parseArgs = function (args) {
    const togo = {};
    for (let i = 0; i < args.length - 1; i += 2) {
        togo[args[i].replace(/^-+/, "")] = args[i + 1];
    }
    return togo;
};

const parsedArgs = parseArgs(process.argv.slice(2));
const siteDir = path.resolve(__dirname, "../..");
const infusionDir = path.resolve(parsedArgs.infusion ?? path.join(siteDir, "../fluid-infusion-6"));
const outDir = path.resolve(parsedArgs.o ?? path.join(siteDir, "docs-infusion"));

// Infusion logs copiously to the console whilst rendering - keep the console for this script's own report
const report = console.log;
if (!parsedArgs.verbose) {
    console.log = () => {};
}
const fluid = require(infusionDir);
fluid.setLogging(!!parsedArgs.verbose);

/**
 * Rewrite site-absolute URLs in a document to be relative to the document's own location - Hugo's `relativeURLs`.
 * See REQUIREMENTS.md R11: this would better be done as each URL is rendered, and is retained here only until the
 * templates do so.
 * @param {Document} dokkument - The rendered document
 * @param {String} outputPath - The document's path relative to the publish directory, e.g. "post/x/index.html"
 */
const relativiseURLs = function (dokkument, outputPath) {
    const depth = outputPath.split("/").filter(segment => segment).length - 1;
    const prefix = depth === 0 ? "./" : "../".repeat(depth);
    ["href", "src"].forEach(attr => {
        dokkument.querySelectorAll(`[${attr}^="/"]`).forEach(element => {
            const value = element.getAttribute(attr);
            // A protocol-relative URL such as //cdn.example.org/x.js is left alone
            if (!value.startsWith("//")) {
                element.setAttribute(attr, prefix + value.substring(1));
            }
        });
    });
};

/**
 * Strip from a rendered document the material which is only of use for making it live again - the inert records of the
 * scripts of its SFCs, the markers of scripts which are payload for the client, and the record of the site's root by
 * which the page recognises its own location - REQUIREMENTS.md R11
 * @param {Document} dokkument - The rendered document
 */
const stripForStatic = function (dokkument) {
    dokkument.documentElement.removeAttribute(fluid.siteRootAttribute);
    dokkument.querySelectorAll("script").forEach(script => {
        if (fluid.classifyScriptNode(script) === "injection") {
            script.remove();
        } else if (script.hasAttribute("fluid-client")) {
            script.removeAttribute("fluid-client");
        }
    });
};

/**
 * List the HTML files beneath a directory, recursively
 * @param {String} dir - The directory
 * @return {String[]} Their absolute paths
 */
const listHtmlFiles = function (dir) {
    return fs.existsSync(dir) ? fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ?
        listHtmlFiles(path.join(dir, entry.name)) : entry.name.endsWith(".html") ? [path.join(dir, entry.name)] : []) : [];
};

/**
 * Copy a directory's contents into another, recursively, overwriting files of the same name - `fs.cpSync`, which node
 * 16.6 lacks
 * @param {String} source - The directory to copy from
 * @param {String} target - The directory to copy into, created if absent
 */
const copyDir = function (source, target) {
    fs.mkdirSync(target, {recursive: true});
    fs.readdirSync(source, {withFileTypes: true}).forEach(entry => {
        const from = path.join(source, entry.name), to = path.join(target, entry.name);
        if (entry.isDirectory()) {
            copyDir(from, to);
        } else {
            fs.copyFileSync(from, to);
        }
    });
};

/**
 * Remove HTML files left in the publish directory by an earlier build which this build neither wrote nor copied, e.g.
 * the page of a content file since renamed
 * @param {String[]} staticDirs - The static directories copied into the publish directory
 * @param {String[]} rendered - The files of the documents rendered by this build
 */
const pruneStale = function (staticDirs, rendered) {
    const keep = new Set([...rendered, ...staticDirs.flatMap(dir => listHtmlFiles(dir).map(file => path.join(outDir, path.relative(dir, file))))]);
    listHtmlFiles(outDir).filter(file => !keep.has(file)).forEach(file => {
        fs.rmSync(file);
        report("Removed stale " + path.relative(outDir, file));
    });
};

/**
 * Index the output paths of the site's documents by their URLs, with which they are created - see ponder.document
 * @param {Object} model - The site's model, as loaded by siteModel.load
 * @return {Map<String, String>} The path of each page's and alias's output file relative to the publish directory, e.g.
 * "/post/x/index.html", keyed by its permalink
 */
const outputPathsByPermalink = function (model) {
    return new Map([...model.pages, ...model.aliases].map(record => [record.permalink, record.outputPath]));
};

const main = async function () {
    // The host document holds no markup of its own - it only declares the modules and SFC imports
    fluid.loadAndBootDocument(path.join(__dirname, "../site.html"));
    const fullModel = siteModel.load(siteDir);
    // --from M --limit N renders just N pages starting from the Mth, e.g. for debugging the theme
    const from = +(parsedArgs.from ?? 0);
    const model = parsedArgs.limit || parsedArgs.from ? {...fullModel, pages: fullModel.pages.slice(from, from + +(parsedArgs.limit ?? Infinity))} : fullModel;

    // Hugo's static files - the theme's, overlaid by the site's
    const staticDirs = [path.join(siteDir, "themes/beautifulhugo/static"), path.join(siteDir, "static")];
    staticDirs.forEach(dir => copyDir(dir, outDir));

    // The creator functions of the layers live in Infusion's V8 context rather than node's global
    const site = fluid.initFreeComponent("ponder.site", {
        config: {$reactiveRoot: model.config},
        pages: {$reactiveRoot: model.pages},
        aliases: {$reactiveRoot: model.aliases},
        data: {$reactiveRoot: model.data}
    });

    Object.entries(feeds.files(model)).forEach(([outputPath, text]) => fluid.writeFile(path.join(outDir, outputPath), text));

    // Each document is created at its page's URL, and written to the file of the page at that URL
    const outputPaths = outputPathsByPermalink(fullModel);
    const outputPathOf = function (record) {
        const outputPath = outputPaths.get(record.location);
        if (outputPath === undefined) {
            throw new Error("No page is at the location of output document " + record.location);
        }
        return outputPath;
    };
    const outcome = await fluid.writeOutputDocumentsWhenSettled(record => path.join(outDir, outputPathOf(record)), record => {
        relativiseURLs(record.dokkument, outputPathOf(record));
        if (!parsedArgs.live) {
            stripForStatic(record.dokkument);
        }
    });
    if (!parsedArgs.limit && !parsedArgs.from) {
        pruneStale(staticDirs, fluid.outputDocuments.get().map(record => path.join(outDir, outputPathOf(record))));
    }
    report(`Wrote ${outcome.written.length} pages to ${outDir}, ${outcome.unchanged.length} unchanged`);
    if (outcome.unready.length > 0) {
        console.error(`${outcome.unready.length} pages were not ready:`);
        outcome.unready.forEach(record => console.error("  " + record.location + ": " + fluid.renderUnavailable(record.readiness)));
        process.exitCode = 1;
    }
    if (fluid.outputDocuments.get().length === 0) {
        console.error("No pages were rendered - unavailable components: ", JSON.stringify(fluid.unavailableComponents.get()));
        process.exitCode = 1;
    }
    // The site is not destroyed - the process is about to exit, and tearing down so large a tree is costly
    return site;
};

let finished = false;

main().then(() => {
    finished = true;
}, error => {
    console.error(error);
    process.exitCode = 1;
});

// node exits once no I/O or timer is outstanding - if the pages have not been written by then, the graph is
// deadlocked on effects which can never complete
process.on("exit", function () {
    if (!finished && process.exitCode !== 1) {
        console.error("Exiting without writing pages - pending effects: ",
            fluid.cell.pendingEffects().map(effect => effect.name), "\nunavailable components: ",
            JSON.stringify(fluid.unavailableComponents.get()));
        process.exitCode = 1;
    }
});
