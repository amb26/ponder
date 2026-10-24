<script>
// Root of the whole site: one free component holding the site model, with one ponder.document per output page.
// Replaces Hugo's .Site plus its per-page render loop. Environmental adaptations which in the Hugo theme are cascades
// of {{ if .Site.Params.xxx }} are held here as conditional linkage holders - see the bottom of this layer and
// infusion/adapt/. None of the layers they broadcast onto (navbar, head, footer, ...) mention them.
fluid.def("ponder.site", {
    // fluid.resolveRoot derives from fluid.component - listing that too, before it, would be an inconsistent hierarchy
    $layers: "fluid.resolveRoot",
    // Transcribed from hugo.toml by ponder.siteModel.load - see infusion/js/siteModel.js
    config: {$reactiveRoot: {}},
    // Page records, one per output document including paginated list pages - see siteModel.js for their shape
    pages: {$reactiveRoot: []},
    // Static data loaded alongside, e.g. for staticman comment counts - Hugo's .Site.Data
    data: {$reactiveRoot: {}},

    lang: "{self}.config.defaultContentLanguage",
    isMultilingual: "$compute:ponder.site.isMultilingual({self}.config.languages)",
    buildYear: "$compute:ponder.site.buildYear()",
    menu: "$compute:ponder.site.buildMenu({self}.config.menu.main)",
    pagesByPermalink: "$compute:ponder.site.indexPages({self}.pages)",

    i18n: {
        $component: {
            // Hugo resolves i18n/<lang>.yaml - here the language selects a dynamic layer
            $layers: ["ponder.i18n", "{site}.i18nLayer"]
        }
    },
    i18nLayer: "$compute:ponder.site.i18nLayer({self}.lang)",

    documents: {
        $component: {
            $layers: "ponder.document",
            $for: {
                source: "{site}.pages",
                valueAs: "page"
            }
        }
    },
    // Redirecting alias documents, each `{permalink, outputPath, target}` - see siteModel.js
    aliases: {$reactiveRoot: []},
    aliasDocuments: {
        $component: {
            $layers: "ponder.alias",
            $for: {
                source: "{site}.aliases",
                valueAs: "alias"
            }
        }
    },

    // ---- Environmental adaptations ----
    // Each holder exists only while its configuration is set, and while it exists its $linkage broadcasts adaptation
    // layers onto the theme's layers. Cf. fluid.demos.assigneeControl in the todo-list-assign demo.
    // A $linkage entry may now bear $if itself (REQUIREMENTS.md R6), but a holder per feature is kept, as it groups the
    // feature's linkages in its own layer within infusion/adapt/
    gcse: {
        $component: {
            $if: "{site}.config.params.gcse",
            $layers: "ponder.feature.gcse"
        }
    },
    piwik: {
        $component: {
            $if: "{site}.config.params.piwik",
            $layers: "ponder.feature.piwik"
        }
    },
    selfHosted: {
        $component: {
            $if: "{site}.config.params.selfHosted",
            $layers: "ponder.feature.selfHosted"
        }
    },
    hljs: {
        $component: {
            $if: "{site}.config.params.useHLJS",
            $layers: "ponder.feature.hljs"
        }
    },
    staticman: {
        $component: {
            $if: "{site}.config.params.staticman",
            $layers: "ponder.feature.staticman"
        }
    },
    disclaimer: {
        $component: {
            $if: "{site}.config.params.disclaimerText",
            $layers: "ponder.feature.disclaimer"
        }
    },
    multilingual: {
        $component: {
            $if: "{site}.isMultilingual",
            $layers: "ponder.feature.multilingual"
        }
    }
});

/**
 * Determine whether the site is configured with more than one language
 * @param {Object} [languages] - The `languages` table of hugo.toml, if any
 * @return {Boolean} `true` if more than one language is configured
 */
ponder.site.isMultilingual = function (languages) {
    return Object.keys(languages ?? {}).length > 1;
};

/**
 * The year in which the site is built, as rendered in the copyright notice - Hugo's `dateFormat "2006" now`
 * @return {Number} The current year
 */
ponder.site.buildYear = function () {
    return new Date().getFullYear();
};

/**
 * Name the i18n layer holding the strings for a language
 * @param {String} lang - The language code, e.g. "en"
 * @return {String} The layer name, e.g. "ponder.i18n.en"
 */
ponder.site.i18nLayer = function (lang) {
    return "ponder.i18n." + lang;
};

/**
 * Convert hugo.toml's flat list of menu entries into a tree sorted by weight - Hugo's .Site.Menus.main.ByWeight
 * @param {Object[]} entries - Menu entries, each with `name`, `url`, `weight` and optional `identifier` and `parent`
 * @return {Object[]} Top-level entries, each with a `children` array of entries sorted by weight
 */
ponder.site.buildMenu = function (entries) {
    // Hugo breaks ties of weight by name
    const byWeight = (a, b) => (a.weight ?? 0) - (b.weight ?? 0) || a.name.localeCompare(b.name);
    const withChildren = entries.map(entry => ({...entry, children: []}));
    const byId = Object.fromEntries(withChildren.map(entry => [entry.identifier ?? entry.name, entry]));
    withChildren.forEach(entry => {
        if (entry.parent) {
            byId[entry.parent].children.push(entry);
        }
    });
    withChildren.forEach(entry => entry.children.sort(byWeight));
    return withChildren.filter(entry => !entry.parent).sort(byWeight);
};

/**
 * Index page records by their relative permalink
 * @param {Object[]} pages - The site's page records
 * @return {Object<String, Object>} The page records keyed by `relPermalink`
 */
ponder.site.indexPages = function (pages) {
    return Object.fromEntries(pages.map(page => [page.relPermalink, page]));
};

/**
 * Look up a list of page records by permalink, as for a paginator's or related-posts' page list
 * @param {Object<String, Object>} pagesByPermalink - The site's page records keyed by `relPermalink`
 * @param {String[]} [permalinks] - The permalinks to look up
 * @return {Object[]} The corresponding page records
 */
ponder.site.lookupPages = function (pagesByPermalink, permalinks) {
    return (permalinks ?? []).map(permalink => pagesByPermalink[permalink]);
};

/**
 * Convert a string into a URL path segment - Hugo's `urlize`
 * @param {String} text - The text to convert, e.g. a tag name
 * @return {String} The lower-cased, hyphenated form of the text
 */
ponder.urlize = function (text) {
    return text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
};

/**
 * Format a date according to a Go reference-time layout such as "January 2, 2006" - Hugo's `.Date.Format`
 * Only the tokens used by this site's configuration are supported.
 * @param {String} isoDate - The date in ISO 8601 form
 * @param {String} layout - The Go layout string
 * @param {String} lang - The language in which month names are rendered
 * @return {String} The formatted date
 */
ponder.formatDate = function (isoDate, layout, lang) {
    const date = new Date(isoDate);
    const month = date.toLocaleString(lang, {month: "long", timeZone: "UTC"});
    return layout.replace("January", month).replace("2006", String(date.getUTCFullYear()))
        .replace("2", String(date.getUTCDate()));
};
</script>
