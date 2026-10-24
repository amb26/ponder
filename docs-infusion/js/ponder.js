"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const headings = document.querySelectorAll("h2, h3, h4");

    headings.forEach((heading) => {
        const href = heading.id || "";
        const label = heading.textContent;

        const fragment = document
            .createRange()
            .createContextualFragment(
                `<a class="infusion-docs-anchor" aria-label="${label}" href="#${href}">
                    <span class="octicon octicon-link" aria-hidden="true"></span>
                 </a>`
            );

        heading.prepend(fragment);
    });
});
