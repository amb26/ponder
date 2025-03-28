const fs = require("fs");
const path = require("path");
const { parseHTML } = require("linkedom");

const docsDir = "docs";

async function getFetch() {
    return (await import("node-fetch")).default;
}

function getHtmlFiles(dir) {
    let files = [];
    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            files = files.concat(getHtmlFiles(fullPath));
        } else if (file.endsWith(".html")) {
            files.push(fullPath);
        }
    }
    return files;
}

function extractLinks(htmlContent) {
    const { document } = parseHTML(htmlContent);
    return [...document.querySelectorAll("a")]
        .map(a => a.getAttribute("href"))
        .filter(Boolean);
}

function checkLocalPath(filePath) {
    // console.log(`Checking path: ${filePath}`);
    return fs.existsSync(filePath);
}

function resolveLocalPath(target, sourceFile) {
    const sourceDir = path.dirname(sourceFile);
    const absoluteTarget = path.resolve(sourceDir, target);

    if (checkLocalPath(absoluteTarget)) return absoluteTarget;
    if (checkLocalPath(absoluteTarget + ".html")) {
        return absoluteTarget + ".html";
    }
    const indexPath = path.join(absoluteTarget, "index.html");
    if (checkLocalPath(indexPath)) {
        return indexPath;
    }
    //console.warn(`Broken local path: ${target} in ${sourceFile}`);
    return null;
}

async function checkLink(target, sourceFile) {
    const fetch = await getFetch();
    if (target.startsWith("http")) {
        try {
            const res = await fetch(target, { method: "HEAD" });
            if (!res.ok) console.warn(`Broken external link: ${target} in ${sourceFile}`);
        } catch (err) {
            console.warn(`Failed to fetch external link: ${target} in ${sourceFile}`);
        }
    } else {
        const resolvedPath = resolveLocalPath(target, sourceFile);
        if (resolvedPath) {
            // console.log(`Valid local link: ${target} -> ${resolvedPath}`);
        } else {
            console.warn(`Broken local link: ${target} in ${sourceFile}`);
        }
    }
}

async function validateLinks() {
    const htmlFiles = getHtmlFiles(docsDir);
    for (const file of htmlFiles) {
        console.log(`        checking links in file ${file}`);
        const content = fs.readFileSync(file, "utf8");
        const links = extractLinks(content);
        for (const link of links) {
            await checkLink(link, file);
        }
    }
}

validateLinks().catch(console.error);
