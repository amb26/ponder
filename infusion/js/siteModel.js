/* eslint-env node */

"use strict";

// Builds the data model to which ponder.site is bound, from hugo.toml and content/. This is the part of Hugo which is
// not templating: configuration, front matter, markdown rendering, shortcodes, sections, taxonomies, pagination and
// summaries. Each page record is the data of one output document.

const fs = require("fs"),
    path = require("path");

// smol-toml declares node >= 18, but of node 18's additions uses only Object.hasOwn, which node 16.6 lacks
if (!Object.hasOwn) {
    Object.hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
}

const toml = require("smol-toml"),
    yaml = require("yaml"),
    markdownIt = require("markdown-it"),
    markdownItAttrs = require("markdown-it-attrs"),
    markdownItFootnote = require("markdown-it-footnote"),
    markdownItDeflist = require("markdown-it-deflist");

const ponder = {siteModel: {}};

/**
 * Compute the id of a heading as goldmark's autoHeadingID does by default - its text, lower-cased, with spaces turned
 * to hyphens and other punctuation dropped
 * @param {String} text - The text of the heading
 * @return {String} The heading's id
 */
ponder.siteModel.headingId = function (text) {
    return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
};

/**
 * A markdown-it plugin giving each heading an id, as goldmark does, unless it is given one by an attribute. Ids repeated
 * within a document are suffixed -1, -2, ...
 * @param {Object} md - The markdown-it instance
 */
ponder.siteModel.headingIds = function (md) {
    md.core.ruler.push("heading_ids", state => {
        const used = {};
        state.tokens.forEach((token, i) => {
            if (token.type === "heading_open" && !token.attrGet("id")) {
                const base = ponder.siteModel.headingId(state.tokens[i + 1].children.map(child => child.content).join(""));
                const count = used[base] = (used[base] ?? -1) + 1;
                token.attrSet("id", count === 0 ? base : base + "-" + count);
            }
        });
    });
};

/**
 * A markdown-it plugin removing the options of Hugo's code fences, e.g. `{lineNos=inline}`, which Hugo's highlighter
 * consumes, from the attributes markdown-it-attrs applies to a fence's <pre>. Code is highlighted in the browser by
 * highlight.js rather than on the server by Hugo's chroma, so these are not honoured.
 * @param {Object} md - The markdown-it instance
 */
ponder.siteModel.stripFenceOptions = function (md) {
    const hugoOptions = ["linenos", "linenostart", "hl_lines", "anchorlinenos", "lineanchors", "style", "noclasses", "tabindex"];
    md.core.ruler.push("strip_fence_options", state => {
        state.tokens.filter(token => token.type === "fence" && token.attrs).forEach(token => {
            token.attrs = token.attrs.filter(([name]) => !hugoOptions.includes(name.toLowerCase()));
        });
    });
};

// goldmark's options as Hugo configures them: `unsafe = true`, block attributes `{.class}`, and its default extensions -
// typographer, linkify, footnotes, definition lists and heading ids
const markdown = markdownIt({html: true, typographer: true, linkify: true})
    .use(markdownItAttrs).use(markdownItFootnote).use(markdownItDeflist).use(ponder.siteModel.headingIds).use(ponder.siteModel.stripFenceOptions);

/**
 * List the files beneath a directory, recursively
 * @param {String} dir - The directory
 * @param {String} [prefix] - The path of `dir` relative to the directory originally listed
 * @return {String[]} The paths of the files, relative to the directory originally listed
 */
ponder.siteModel.listFiles = function (dir, prefix = "") {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ?
        ponder.siteModel.listFiles(path.join(dir, entry.name), path.join(prefix, entry.name)) : [path.join(prefix, entry.name)]);
};

/**
 * Group the elements of an array by a key computed from each - `Object.groupBy`, which node 18 lacks
 * @param {Array} array - The elements
 * @param {Function} keyOf - Computes the key of an element
 * @return {Object<String, Array>} The elements grouped by key, in order
 */
ponder.siteModel.groupBy = function (array, keyOf) {
    const togo = {};
    array.forEach(element => (togo[keyOf(element)] ||= []).push(element));
    return togo;
};

/**
 * A page record, the data of one output document.
 * @typedef {Object} PageRecord
 * @property {String} kind - Hugo's page kind - "home", "section", "page", "taxonomy", "term" or "404"
 * @property {String} type - The content type - front matter `type`, or the section name, or "page"
 * @property {String} section - The top-level content directory holding the page
 * @property {String} title - The page title
 * @property {String} [date] - The page date in ISO 8601 form
 * @property {String} [lastmod] - The page's last modification date in ISO 8601 form
 * @property {String} relPermalink - The site-relative URL, e.g. "/post/2025-03-20-ui-as-code/"
 * @property {String} permalink - The absolute URL
 * @property {String} outputPath - The path of the output file, relative to the publish directory
 * @property {Object} params - The page's front matter
 * @property {String} content - The rendered HTML content
 * @property {String} summary - The rendered HTML summary
 * @property {String} summaryText - The plain text summary, for meta descriptions
 * @property {Boolean} truncated - `true` if the summary is shorter than the content
 * @property {Object} [paginator] - For list pages, `{pageNumber, pages, prev, next}` with `pages` a list of permalinks
 * @property {Object} [prevInSection] - For regular pages, `{title, relPermalink}` of the previous page in its section
 * @property {Object} [nextInSection] - For regular pages, `{title, relPermalink}` of the next page in its section
 * @property {Object} [data] - For taxonomy and term pages, `{singular, plural, terms}`
 */

/**
 * Split a content file into its YAML front matter and markdown body
 * @param {String} text - The text of the content file
 * @return {Object} The parsed front matter as `params`, and the remaining text as `body`
 */
ponder.siteModel.splitFrontMatter = function (text) {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    return match ? {params: yaml.parse(match[1]) ?? {}, body: match[2]} : {params: {}, body: text};
};

/**
 * Translate Hugo shortcodes into component islands - elements bearing `fluid-layers`, which would be booted as
 * components within otherwise verbatim content. See REQUIREMENTS.md R2.
 * @param {String} body - The markdown body of a content file
 * @return {String} The body with each `{{< name key="value" >}}` replaced by an island element
 */
ponder.siteModel.expandShortcodes = function (body) {
    return body.replace(/\{\{<\s*(\w+)([^>]*?)\s*>\}\}/g, (match, name, args) => {
        const attrs = [...args.matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => ` data-${key}="${value}"`).join("");
        return `<div fluid-layers="ponder.shortcode.${name}"${attrs}></div>`;
    });
};

/**
 * Compute the summary of rendered content - Hugo's manual `<!--more-->` divider, or else its first 70 words
 * @param {String} html - The rendered HTML content
 * @return {Object} `summary` HTML, `summaryText` plain text, and `truncated`
 */
ponder.siteModel.summarise = function (html) {
    const divider = html.indexOf("<!--more-->");
    let togo;
    if (divider === -1) {
        // Hugo's summary - its first 70 words, extended to the end of the sentence holding the last of them
        const words = ponder.siteModel.plainText(html).split(/\s+/).filter(word => word);
        const sentenceEnd = words.findIndex((word, i) => i >= 69 && /[.!?]["'’”)]*$/.test(word));
        const count = sentenceEnd === -1 ? words.length : sentenceEnd + 1;
        const summaryText = words.slice(0, count).join(" ");
        togo = {summary: summaryText, summaryText, truncated: words.length > count};
    } else {
        const summary = html.substring(0, divider);
        togo = {summary, summaryText: ponder.siteModel.plainText(summary), truncated: true};
    }
    return togo;
};

/**
 * Strip markup from HTML
 * @param {String} html - Some HTML
 * @return {String} Its text, with runs of whitespace collapsed
 */
ponder.siteModel.plainText = function (html) {
    return html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
};

/**
 * Read one regular content page
 * @param {String} contentDir - The content directory
 * @param {String} relPath - The path of the markdown file relative to `contentDir`
 * @param {String} baseURL - The site's base URL
 * @return {PageRecord} The page record
 */
ponder.siteModel.readPage = function (contentDir, relPath, baseURL) {
    const {params, body} = ponder.siteModel.splitFrontMatter(fs.readFileSync(path.join(contentDir, relPath), "utf8"));
    // Hugo's path sanitisation - spaces become hyphens, and characters other than letters, digits and -._~ are dropped
    const segments = relPath.replace(/\.md$/, "").split(path.sep)
        .map(segment => segment.replace(/\s+/g, "-").replace(/[^\p{L}\p{N}\-._~]/gu, ""));
    const section = segments.length > 1 ? segments[0] : "";
    const relPermalink = "/" + segments.join("/") + "/";
    const content = markdown.render(ponder.siteModel.expandShortcodes(body));
    return {
        kind: "page",
        type: params.type ?? (section || "page"),
        section,
        title: params.title ?? "",
        date: params.date ? new Date(params.date).toISOString() : undefined,
        lastmod: params.lastmod ? new Date(params.lastmod).toISOString() : undefined,
        relPermalink,
        permalink: baseURL + relPermalink,
        outputPath: relPermalink + "index.html",
        params,
        content,
        ...ponder.siteModel.summarise(content)
    };
};

/**
 * Split a list of pages into paginated list pages
 * @param {Object} listPage - The record of the list page, lacking `paginator`
 * @param {PageRecord[]} pages - The pages to be listed, in order
 * @param {Number} pagerSize - The number of pages listed per page
 * @return {PageRecord[]} One record per page of the list, the first at the list page's own permalink and the others
 * at `page/N/` beneath it
 */
ponder.siteModel.paginate = function (listPage, pages, pagerSize) {
    const count = Math.max(1, Math.ceil(pages.length / pagerSize));
    const permalinkOf = number => number === 1 ? listPage.relPermalink : listPage.relPermalink + "page/" + number + "/";
    return Array.from({length: count}, (unused, i) => {
        const number = i + 1;
        const relPermalink = permalinkOf(number);
        return {
            ...listPage,
            relPermalink,
            permalink: listPage.permalink.replace(/\/$/, "") + relPermalink.substring(listPage.relPermalink.length - 1),
            outputPath: relPermalink + "index.html",
            paginator: {
                pageNumber: number,
                pages: pages.slice(i * pagerSize, number * pagerSize).map(page => page.relPermalink),
                // Every page of the list, e.g. for its feed
                allPages: pages.map(page => page.relPermalink),
                prev: number > 1 ? permalinkOf(number - 1) : undefined,
                next: number < count ? permalinkOf(number + 1) : undefined
            }
        };
    });
};

/**
 * Build the model of the whole site
 * @param {String} siteDir - The root of the Hugo site, holding hugo.toml and content/
 * @return {Object} The site model, with `config` (hugo.toml with keys lower-camel-cased as Hugo exposes them),
 * `pages`, a list of {@link PageRecord}, and `data`
 */
ponder.siteModel.load = function (siteDir) {
    const rawConfig = toml.parse(fs.readFileSync(path.join(siteDir, "hugo.toml"), "utf8"));
    const config = {
        title: rawConfig.title,
        baseURL: rawConfig.baseurl.replace(/\/$/, ""),
        defaultContentLanguage: rawConfig.DefaultContentLanguage ?? "en",
        languages: rawConfig.languages,
        menu: rawConfig.menu,
        params: {
            commentsLayer: "ponder.comments.giscus",
            ...rawConfig.Params
        }
    };
    const contentDir = path.join(siteDir, "content");
    const files = ponder.siteModel.listFiles(contentDir)
        .filter(file => file.endsWith(".md") && !path.basename(file).startsWith("_index"));
    const byDateDesc = (a, b) => (b.date ?? "").localeCompare(a.date ?? "");
    const regular = files.map(file => ponder.siteModel.readPage(contentDir, file, config.baseURL))
        .filter(page => !page.params.draft).sort(byDateDesc);

    // Previous and next within each section, by date
    const sections = ponder.siteModel.groupBy(regular, page => page.section);
    Object.values(sections).forEach(sectionPages => sectionPages.forEach((page, i) => {
        const link = other => other && {title: other.title, relPermalink: other.relPermalink};
        page.prevInSection = link(sectionPages[i + 1]);
        page.nextInSection = link(sectionPages[i - 1]);
    }));

    const pagerSize = rawConfig.pagination?.pagerSize ?? 10;
    const listPage = (kind, title, relPermalink, extra) => ({
        kind, type: kind === "home" ? "page" : "list", section: "", title, relPermalink,
        permalink: config.baseURL + relPermalink, params: {}, content: "", summary: "", summaryText: "", ...extra
    });

    const homeIndex = ponder.siteModel.splitFrontMatter(fs.readFileSync(path.join(contentDir, "_index.md"), "utf8"));
    const mainSections = config.params.mainSections ?? ["post"];
    const home = ponder.siteModel.paginate(listPage("home", config.title, "/", {
        content: markdown.render(homeIndex.body)
    }), regular.filter(page => mainSections.includes(page.type)), pagerSize);

    const sectionLists = Object.entries(sections).filter(([section]) => section)
        .flatMap(([section, sectionPages]) =>
            ponder.siteModel.paginate(listPage("section", section, "/" + section + "/"), sectionPages, pagerSize));

    // Hugo's default taxonomies
    const taxonomies = {tags: "tag", categories: "category"};
    const taxonomyPages = Object.entries(taxonomies).flatMap(([plural, singular]) => {
        const termMap = {};
        regular.forEach(page => (page.params[plural] ?? []).forEach(term => (termMap[term] ||= []).push(page)));
        const terms = Object.entries(termMap)
            .map(([name, termPages]) => ({name, count: termPages.length, pages: termPages.map(page => page.relPermalink)}))
            .sort((a, b) => b.count - a.count);
        const data = {singular, plural, terms};
        const termLists = Object.entries(termMap).flatMap(([name, termPages]) => ponder.siteModel.paginate(
            listPage("term", name, "/" + plural + "/" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "/", {data}),
            termPages, pagerSize));
        return [{...listPage("taxonomy", plural, "/" + plural + "/", {data}), outputPath: "/" + plural + "/index.html"},
            ...termLists];
    });

    const notFound = {...listPage("404", "404 Page not found", "/404.html"), outputPath: "/404.html"};

    const pages = [...home, ...sectionLists, ...regular, ...taxonomyPages, notFound];
    // Hugo writes an alias at page/1/ beneath each paginated list, redirecting to the list itself
    const aliases = pages.filter(page => page.paginator?.pageNumber === 1 && page.kind !== "home")
        .map(page => ({permalink: page.permalink + "page/1/", outputPath: page.relPermalink + "page/1/index.html", target: page.permalink}))
        .concat({permalink: config.baseURL + "/page/1/", outputPath: "/page/1/index.html", target: config.baseURL + "/"});

    return {
        config,
        pages,
        aliases,
        data: {}
    };
};

module.exports = ponder.siteModel;
