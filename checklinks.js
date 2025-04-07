const fs = require("fs");
const path = require("path");
const { parseHTML } = require("linkedom");
const readline = require("readline");

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
        .filter(href => href && !href.startsWith("mailto:") && !href.startsWith("https://bsky.app/intent"))
        .map(href => href.split("#")[0]);
}

function checkLocalPath(filePath) {
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
    return null;
}

async function checkLink(target, sourceFile, brokenLinks) {
    const fetch = await getFetch();
    if (target.startsWith("http")) {
        try {
            const res = await fetch(target, { method: "HEAD" });
            if (res.status === 404) {
                brokenLinks.push(`Broken external link: ${target} in ${sourceFile}`);
            }
        } catch (err) {
            brokenLinks.push(`Failed to fetch external link: ${target} in ${sourceFile}`);
        }
    } else {
        const resolvedPath = resolveLocalPath(target, sourceFile);
        if (!resolvedPath) {
            brokenLinks.push(`Broken local link: ${target} in ${sourceFile}`);
        }
    }
}

async function validateLinks() {
    const htmlFiles = getHtmlFiles(docsDir);
    const linksToCheck = [];

    // Gather all links, ensuring each external link is only added once
    const seenExternalLinks = new Set();
    for (const file of htmlFiles) {
        console.log(`        checking links in file ${file}`);
        const content = fs.readFileSync(file, "utf8");
        const links = extractLinks(content);
        for (const link of links) {
            if (link.startsWith("http") && !seenExternalLinks.has(link)) {
                seenExternalLinks.add(link);
                linksToCheck.push({ target: link, sourceFile: file });
            } else if (!link.startsWith("http")) {
                linksToCheck.push({ target: link, sourceFile: file });
            }
        }
    }

    const totalLinks = linksToCheck.length;
    let completedLinks = 0;

    const brokenLinks = [];

    const linkPromises = linksToCheck.map(async (link, index) => {
        await checkLink(link.target, link.sourceFile, brokenLinks);
        completedLinks++;
        if (completedLinks > linksToCheck.length - 2) {
            console.log("Resolved link ", link.target);
        }
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`Progress: ${completedLinks}/${totalLinks} links checked`);
    });

    await Promise.all(linkPromises);

    // Print out the broken links at the end
    console.log("\nBroken Links:");
    if (brokenLinks.length === 0) {
        console.log("No broken links found!");
    } else {
        brokenLinks.forEach((brokenLink) => console.log(brokenLink));
    }
}

validateLinks().catch(console.error).finally(() => process.exit());
