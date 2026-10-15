---
title: Researching in-browser AI
date: 2026-05-25
---
<style>
@media (min-width: 992px) {
h1 {
margin-left: -25px;
}
}
</style>

After beholding Clayton's Antigravity-fuelled [conversion](https://fluid-project.github.io/NoPumpG/) of his
1987 [NoPumpG](https://web.archive.org/web/20250202091404/https://apps.dtic.mil/sti/tr/pdf/ADA460027.pdf) spreadsheet-inspired visual
programming system, I started to wonder what it would take to get in-browser AI assistance and explanation
of the interface. Below is reproduced a Gemini Q&A session where I started from the assumption that some kind of
MCP-like construct, mapping the materialised interface contents onto a structured query API, would be relevant.

The conversation revealed that whilst an MCP-like mapping could be a helpful intermediate, this is secondary compared
to the central difficulty of getting the AI mustered into the browser environment itself, at a price/availability
that made sense for a non-technical user.

Unsurprisingly it seems that an interesting process of "enclosure" has taken place in the AI industry after the halcyon
period of 2024 --- it isn't economic for the major cloud providers to supply arbitrary programmatic access to their
frontier products at the commodity $20/month-ish level which as are we know massively loss-making.

Looking aside to some other projects, there is Tom Larkworthy's [Robocoop](https://talk.observablehq.com/t/robocoop-3-agentic-runtime-function/10583)
agent-in-the-browser system, which it turns out is mediated by his own proxy to GPT 5-mini which as far as I can tell
he is funding out of his own pocket (brave man!).

Along the same lines, Colin suggested that DeepSeek Flash could be another good candidate for opportunistic, temporary
hosting - he reports having most of a $20 credit still available after months, and using only 38 cents on a day of
intense activity. 

Other than that, the most proximate route is through Google's [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) 
which has daringly and quietly rolled out a 4GB nano model to most users of recent Chrome. To see if your Chrome has it,
you can try out the [Prompt API Playground](https://chrome.dev/web-ai-demos/prompt-api-playground/). I was
pretty amazed by this - the context window is unbelievably tiny, at 10K, but I think it could be possible to shoe-horn
quite a lot of substrate-directed authorial expertise into this. And after the AI apocalypse is over, such things
will only become more powerful.

The final option, also suggested by Colin, would be to roll out one's own model via [WebLLM](https://webllm.mlc.ai/) which has
the upside that it could be tweaked efficiently to the substrate's grammar, but the downside of requiring a further
~4GB download for the user.

So, the [WebLLM chat](https://chat.webllm.ai/#/chat) interface is pretty impressive, and shows that I'm able to successfully
execute several out of a choice of some dozens of local models on my creaky old GPU (10 year old GTX1080i with 8GB VRAM).
Having Gigabit broadband probably makes my experience of this significantly smoother than the typical user but it's
pretty amazing that this is even slightly usable.

Here is the Gemini transcript of my queries about brokering access to cloud models:

# Q1: Is there a Chrome extension that logs into AI and allows MCP from in-page js?

Google’s official [**WebMCP Extension**](https://chromewebstore.google.com/detail/webmcp-extension/jigokfbbpcdckjmhbgapmikncfihboec)
(paired with the emerging WebMCP web standard) exactly matches your requirements. It links to the browser's local or logged-in AI capabilities
and exposes an **Imperative API** that allows in-page JavaScript to declare and execute tools over the Model Context Protocol (MCP).

## **Core Architecture**

Instead of relying on heavy server deployments or external terminal commands, the system runs locally inside the browser tab.

1. **The Extension**: Injects and handles the protocol bridge, leveraging your active browser sessions.
2. **In-Page JavaScript**: Uses the experimental navigator.modelContext (or document.modelContext) API to expose structural tools directly to the AI agent.

---

**How to Implement It (In-Page JS)**

With WebMCP, you do not need screen-scraping or visual models. You explicitly write JavaScript on your page to register tools that the AI agent can discover and invoke.

## **1\. Registering the Tool**

Use the **Imperative API** in your web app's frontend code to register a function as an MCP tool:

```javascript
// Check if the WebMCP browser API is available
if (navigator.modelContext) {
  navigator.modelContext.registerTool({
    name: "fetch_user_data",  
    description: "Retrieves specific user account metrics from the page state.",
    inputSchema: {  
      type: "object",
      properties: {  
        userId: { type: "string", description: "The unique ID of the user." }
      },
      required: ["userId"]
    },  
    // The actual JS function execution context`  
    execute: async ({ userId }) => { 
      try {  
        const data = await window.getInternalAppState(userId);
        return {  
          content: [{ type: "text", text: JSON.stringify(data) }]
        };  
      } catch (error) {
        return {  
          isError: true,  
          content: [{ type: "text", text: error.message }]  
        };  
      }  
    }  
  });
}
```

## **2\. Declarative Fallback (HTML Form)**

If you prefer not to use JavaScript for simple actions, WebMCP also supports a **Declarative API** using standard HTML forms.
Annotating elements lets the AI know how to handle the page:

```html
<form name="book_flight" data-mcp-tool="BookFlight" description="Books a flight resource">  
<input type="text" name="destination" required />  
<button type="submit">Submit</button>  
</form>

```

---

**Alternative Browser-MCP Extensions**

If you need an AI agent sitting in an external IDE (like Cursor, Claude Desktop, or Windsurf) to reach *into* your live browser tab to execute JavaScript and utilize cookies, use these alternatives:

* [**Browser Bridge MCP**](https://chromewebstore.google.com/detail/browser-bridge-mcp/ddcpicbjicfmpkeaohnpjdldjnlollec): A Chrome extension and local WebSocket setup that allows an AI client to call execute scripts to run any arbitrary JS within the page context.
* [**Kapture MCP**](https://chromewebstore.google.com/detail/kapture-mcp-browser-autom/ejfnegenodbdcodemkibocefmajjjjbn): Connects a chosen browser tab to local AI clients via a toggle switch, allowing JavaScript execution, DOM tracking, and form automation.
* [**Browser MCP**](https://browsermcp.io/): Specifically built to preserve your logged-in profiles and cookies so that external AI agents can seamlessly navigate sites without hitting bot-detection blocks.

Are you building a **custom web application** that wants to offer tools to an AI assistant, or are you trying to configure an IDE like **Cursor / Claude Desktop** to automate tasks inside your personal browser windows? Let me know so I can provide the exact configuration blocks or API snippets\!

# Q2: Neither, I want locally running JS to be able to manually synthesize the contents of the context window and invoke AI to retrieve its response

To completely bypass pre-packaged AI extensions or external tools, you can use **Chrome's native, built-in Prompt API (LanguageModel)**.
This allows standard, locally running in-page JavaScript to read the page context, manually assemble the prompt/context window, and execute local AI inference directly via **Gemini Nano** without an internet connection or external servers.

Alternatively, if you want your in-page JS to invoke a heavy local LLM (like Llama 3 or Mistral via Ollama), you can use an open standard injection extension like
[**Window AI**](https://chromewebstore.google.com/detail/window-ai/cbhbgmdpcoelfdoihppookkijpmgahag).

---

**Method 1: Using Chrome's Native On-Device AI (Zero Extensions)**

This uses the experimental Web API natively embedded in Google Chrome.

## **1\. Setup Flags**

Before testing your local code, you must enable on-device AI in your browser:

1. Navigate to chrome://flags/\#prompt-api-for-gemini-nano and set it to **Enabled**.
2. Navigate to chrome://flags/\#optimization-guide-on-device-model and set it to **Enabled BypassPerfRequirement**.
3. Restart Chrome and visit chrome://components to ensure the **Optimization Guide On Device Model** has finished downloading.

## **2\. The In-Page JavaScript Implementation**

This code manually scrapes the text content of your webpage, structures it into an AI context window block, and feeds it into the local model:

```javascript
async function invokeLocalAIWithPageContext() {
// 1. Verify if Chrome's built-in Language Model API is available  
    const availability = await ai.languageModel.capabilities();
    if (availability.available === "no") {
        console.error("Local Gemini Nano is not available or hasn't downloaded yet.");
        return;
    }

// 2. Manually synthesize the contents of the page context window  
// You can customize this selector to only grab relevant text, articles, or state data.  
    const pageContent = document.body.innerText || document.documentElement.textContent;

// Format the full system prompt and content map manually  
    const systemPrompt = "You are an analytical assistant reading a webpage context window. Answer the user prompt based strictly on this text data.";

    const userRequest = "Summarize the key action items and entities mentioned on this page.";

// Synthesize the final payload context block  
    const fullSynthesizedPrompt = `
Context Window Data:  
---  
${pageContent}  
---

Instructions: ${userRequest}  
`;

    try {
// 3. Instantiate the local inference session  
        const session = await ai.languageModel.create({
            systemPrompt: systemPrompt
        });

        console.log("Analyzing local context window...");

        // 4. Invoke the local AI and stream the response  
        const stream = session.promptStreaming(fullSynthesizedPrompt);

        for await (const chunk of stream) {
            // Clear console or write directly to a UI container element on the page  
            console.clear();
            console.log(chunk);
        }

        // Always destroy the session manually to free up local VRAM/RAM allocation  
        session.destroy();

    } catch (error) {
        console.error("Inference run failed:", error);
    }
}

*// Execute on demand*  
invokeLocalAIWithPageContext();
````

---

**Method 2: Using the "Window AI" Extension (For Custom Local Models)**

If Gemini Nano's small context window or token limits are too restrictive for your page data, install the **Window AI Extension**.
This extension injects a standard `window.ai` object into every page context. You can configure the extension's settings to route requests to a local instance of **Ollama** or **LM Studio** running a 7B or 8B model over localhost.

## **The Window AI Implementation:**

```javascript
async function invokeWindowAIExtension() {
    if (typeof window.ai === 'undefined') {
        alert("Please install the Window AI Chrome Extension first.");
        return;
    }

// Manually grab your page layout state  
    const tableData = document.querySelector("#dashboard-table")?.innerText || "";
    const metaDescription = document.querySelector("meta[name='description']")?.content || "";

// Manually synthesize your targeted context window structure  
    const dynamicContext = `
        [Meta Description]: ${metaDescription}
        [Dashboard View]: ${tableData}
    `;

    try {
// Invoke the extension model mapping  
        const response = await window.ai.getCompletion({
            prompt: `Analyze this UI snapshot and report any anomalies:\n${dynamicContext}`,
        }, {
// Optional streaming handler  
            onStreamResult: (result) => {
                console.log("Streaming response token:", result.text);
            }
        });

        console.log("Final Synthesized Output:", response.text);
    } catch (err) {
        console.error("Extension communication failed:", err);
    }
}
```

Would you like help writing specific DOM filtering filters to **strip out HTML boilerplate and script tags** so your synthesized context window doesn't overflow local token limits? Let me know\!

# Q3: What if I want to interact with a cloud model such as Claude via this route?

To interact with a cloud model like **Claude (Anthropic)** while keeping the logic strictly within locally running in-page JavaScript, you can choose from three main implementation routes. Each method manages the synthesized context window locally before passing it to the cloud.

---

**Method 1: The "Window AI" Extension API (Recommended & Secure)**

Using the [**Window AI Chrome Extension**](https://chromewebstore.google.com/detail/window-ai/cbhbgmdpcoelfdoihppookkijpmgahag) is the cleanest approach. You paste your Anthropic API key directly into the extension's secure configuration dashboard instead of hardcoding it into the web page.
The extension then exposes a clean, unified window.ai object to your local JS.

## **In-Page JS Code:**

```javascript
async function sendSynthesizedContextToClaude() {
    if (typeof window.ai === 'undefined') {
        alert("Please install and configure the Window AI extension.");
        return;
    }

// 1. Manually synthesize your context window locally  
    const dynamicDOMData = document.querySelector("#app-root")?.innerText || "";
    const pageMetadata = JSON.stringify({ url: window.location.href, title: document.title });

    const customContextWindow = `
        [METADATA]: ${pageMetadata}
        [PAGE TEXT CONTENT]:
    ${dynamicDOMData}
    ;`

    try {
        console.log("Streaming synthesized context directly to Claude...");

        // 2. Call window.ai explicitly targetting Anthropic models  
        const response = await window.ai.getCompletion({
            prompt: `Analyze the following webpage context window data and extract all high-priority action items:\n${customContextWindow}`,
        }, {
            // Direct options mapping  
            model: "anthropic/claude-3-5-sonnet",
            onStreamResult: (result) => {
                // Handle stream chunking straight to your page's UI  
                console.log("Chunk:", result.text);
            }
        });

        console.log("Analysis Completed: ", response.text);
    } catch (error) {
        console.error("Cloud inference routing failed:", error);
    }
}
```

---

**Method 2: Direct fetch to Anthropic's Messages API (Bypasses Extensions)**

If you don't want your users or app to rely on *any* third-party extensions, you can use vanilla JavaScript fetch() to call the **Anthropic Claude API** directly.

⚠️ **Security Warning**: Only use this for locally hosted HTML/JS files (localhost or file://) or internal tools. If you deploy this to a public web server, malicious users can extract your Anthropic API Key from the client-side source code.

## **In-Page JS Code:**
```javascript
async function callClaudeDirectly() {
    const API_KEY = "YOUR_ANTHROPIC_API_KEY_HERE"; // Ensure this stays locked to local environments

// 1. Synthesize your page data  
    const mainContent = document.getElementById("content-wrapper")?.innerText;

// 2. Send the synthesized context window to the cloud via standard fetch  
    try {
        const response = await fetch("https://anthropic.com", {
            method: "POST",
            headers: {
                "x-api-key": API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "dangerously-allow-the-browser": "true" // Required by Anthropic to permit client-side calls  
            },
            body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1024,
                system: "You are an AI processing a manually synthesized DOM context window pipeline.",
                messages: [
                    {
                        role: "user",
                        content: `Review this raw page data and format it into a clean JSON array:\n\n${mainContent}`
                    }
                ]
            })
        });

        const data = await response.json();
        console.log("Claude Cloud Response:", data.content[0].text);
    } catch (err) {
        console.error("Direct API request failed:", err);
    }
}
```

---

**Method 3: Local Proxy Relay (Secure Cloud Routing)**

If you are building an actual web app and want to use Claude safely without client-side API key exposure, use your in-page JS to hit a thin local proxy or your own backend server. The backend simply passes the payload along to Anthropic.

```javascript
async function sendToSecureProxy() {
// Synthesize locally  
    const layoutState = extractCleanDOMState();

// Push to local or remote proxy  
    const response = await fetch("/api/analyze-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contextWindow: layoutState,
            userInstruction: "Identify any UI elements that look broken."
        })
    });

    const result = await response.json();
    console.log(result.claudeResponse);
}

function extractCleanDOMState() {
// Quick helper to strip heavy script and style tags before cloud upload  
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("script, style, svg, noscript").forEach(el => el.remove());
    return clone.innerText.replace(/\s+/g, ' ').trim();
}
```

Do you need a snippet for a **Node.js/Next.js proxy backend** to securely handle your Anthropic cloud routing, or would you like to see how to handle **Server-Sent Events (SSE) streaming** with the direct fetch method? Let me know\!

# Q4: Alex Atallah seemed to cease to maintain window.io about 3 years ago, see if you can find out why and/or whether this work was of interest to others or why not picked up

[**Alex Atallah**](https://www.google.com/search?q=alex+atallah&kgmid=/g/11pv27s2hq#sv=CBwSyAQKjwQSjAQKzANBSmlUNHRMakxENVNMbXl5T2xRTkxQT2FVcC1ZXzZ6VE40b3BqZGhMTXIwckNKXzBpN2NaZlEyYkRucE01TEVxMDQ0emFVdmhxbGhMQXJpaG1lcEFSNV95aS1xWEk5aHZQMnUtVER3Yk52ZW1pNW5yenZKSy01Rk93aEZmWjlFMGJ4cWxsaklRM3FGeEduWlE0d2FEUVRlTGxtZmdDbWItb3licTk0QmtGbjMxYl9zUnV4RDd5QzVEUG5sYTZ6XzRZUVZ4SnFMS3V6dEZzbFk0N003V0x3RGEyVTEyRFpFclJ1V3VUTmVfVVZxSlNpNHd2bFgzekJkQkQwR0lBZXEtYkRybnpfOWJDVlRxeGxEeGNCUEpGR3dTMHIzYnBzeUhTck5HT1F2UTNSU3pzNW1lWnVET0huREFKNTI3a0VPWGdPcmxhUjlKMFVxdFBHZjRiMGp1OUh4TEJOa2RKTGJwZWdheHRwZTQwb2ZpVTlkbmJLd1RmV2hiVnZQNlVsWER4a1JQOVJQRXpRYnhkOVZrNE1rckNoeXZFMUt4dzhEc2ZoS2cxSjVDMXYweTFWOHN3RHE0S2hDQ1o2VTVaWF9Pa0ZWclFTSXZ5RTdWEhdrUnR1YXZUOUtfUFBoYklQLXVPcXNBSRoiQURzcjlmUWxTUDdsR0V3X0pwdm9hWm4ya2w4ZUJwTGRIURIENzg1NBoBMyIRCgFxEgxhbGV4IGF0YWxsYWgiFgoFa2dtaWQSDS9nLzExcHYyN3MyaHEoABhFILamgboD) ceased maintaining the [**Window AI**](https://github.com/alexanderatallah/window.ai) browser extension around 2023 because it successfully served its architectural purpose as a **prototype, which directly birthed [OpenRouter](https://openrouter.ai/)**.
Rather than the project failing or being ignored, its core philosophy was fundamentally integrated into a multi-billion dollar platform.

The story of why Window AI was left behind and how the industry reacted breaks down into distinct phases:

## **1\. Why Alex Atallah Stopped Maintaining It**

In early 2023, after stepping down as the CTO of OpenSea, Atallah wanted to investigate a core hypothesis: *Would the AI inference market become a winner-take-all monopoly dominated entirely by OpenAI, or would a massive, multi-model ecosystem emerge?*

To test this, he built **Window AI** as an experimental prototype. Its goal was to decouple the application layer from the model layer, allowing developers to build web apps where users brought their own model (whether via an OpenAI API key or a local Ollama instance).

The experiment provided crucial marketplace clues:

* **The Problem:** Asking everyday users to install a developer-focused browser extension, manage their own local models, and paste raw API keys into their browser created far too much friction.
* **The Pivot:** Atallah realized that the true "missing market" wasn't a browser extension, but a unified, server-side infrastructure layer. He transitioned the core architecture of Window AI—a single, universal API that routes requests across diverse, competing models—and launched **OpenRouter**.

Because OpenRouter experienced explosive growth—culminating in massive industry usage and high-profile acquisition interest by companies like [**Stripe**](https://www.wsj.com/tech/ai/stripe-in-talks-to-buy-buzzy-ai-model-marketplace-openrouter-decc6a74)—the local client extension became obsolete to his primary mission.

## **2\. Was the Work Picked Up by Others?**

Yes, but the community fragmented the core idea into **three distinct trends** rather than keeping the exact window.ai extension alive:

## **A. Transition to Browser-Native Standards**

The concept of exposing a model directly to in-page JavaScript without standard backend calls was highly influential. Instead of using third-party extensions, browser vendors began building this directly into the web platform.

* Google introduced the native Chrome **Prompt API (LanguageModel)** and the [**WebMCP standard**](https://chromewebstore.google.com/detail/webmcp-extension/jigokfbbpcdckjmhbgapmikncfihboec). This natively achieves exactly what Window AI set out to do—giving in-page JavaScript secure, permissioned access to an on-device model (Gemini Nano) or localized tools without manual key-injecting wrappers.

## **B. The Rise of Server-Side Routing (The Winner)**

The developer community largely agreed with Atallah's final pivot: routing should happen over HTTP via unified backend frameworks rather than client-side extensions. Tools like **Vercel AI SDK**, **LiteLLM**, and **LangChain** adopted the universal model-agnostic schema pattern that Window AI pioneered, standardizing applications so they can hot-swap between Claude, OpenAI, and local weights on the fly.

## **C. Evolution into Agentic Browser Tools**

For users who still wanted an extension to bridge browser sessions with AI, the ecosystem evolved away from generic model configurations toward **agentic control**. Extensions like *Browser Bridge MCP*, *Kapture MCP*, and *Browserbase* took the spirit of Window AI but added automation layers, allowing modern IDEs (like Cursor or Claude Desktop) to command the browser tab.

## **Summary**

Window AI did not fail; it evolved. It proved that developers and users wanted to break away from vendor lock-in. It was left behind because its creator successfully used it to discover a far larger market constraint, resulting in the creation of **OpenRouter**.

If you are writing local code today, would you prefer to see how to implement **Google's new native Chrome AI APIs**, or would you like to see how to use **OpenRouter's unified API** to swap between different cloud models using a single backend connection?

# Q5: None of these seem to accomplish the original goals of window.ai \- to allow an individual user access to a specific cloud provider that they have already paid for an account with

You are completely right. There is a glaring, deeply frustrating gap left in the ecosystem because the industry completely shifted its incentives.

When **Window AI** died, the goal of letting a user bring a subscription they *already pay for* (like Claude Pro or ChatGPT Plus) and exposing it directly to local in-page JavaScript was abandoned. Everyone shifted to **API-key models** (like OpenRouter) because that is where the venture capital and developer monetization models are.

No major AI lab wants you to bypass their official chat interface to use your $20/month consumer subscription for programmatic, local automation.

However, if you want to achieve the exact original goal of Window AI today, you can use the following open-source workarounds to bridge a logged-in cloud account to local in-page JS.

---

**Option 1: The Modern Spiritual Successor (The "Web-LLM" & MCP Bridge)**

Because no single extension injects a clean window.ai object for logged-in cloud web sessions anymore, developers who want to route local JS to their active web accounts use **\[Browserless / Playwright Extension Bridges\]** or dedicated MCP clients.

If you use **Claude Desktop** or **Cursor** alongside your browser, you can use [**Browser MCP**](https://browsermcp.io/) or **Browser Bridge MCP**.

* **How it works:** It uses your live, logged-in Chrome session (including your Claude Pro session cookies).
* **The Route:** Your local in-page JS pushes data to a local WebSocket, which commands the extension to open a hidden/background tab on claude.ai, pastes your synthesized context directly into the chat box, and extracts the response DOM text back to your local script.

---

**Option 2: Build a Lightweight 20-Line "Window AI" Injection Script**

Since the Chrome Extension Store heavily polices extensions that scrape or modify session headers, the cleanest way to get the exact original functionality without third-party friction is to run a local **Tampermonkey / Violentmonkey** userscript.

You can write a script that mimics the old Window AI behavior by intercepting your authenticated web sessions.

## **How to build your own local injection pipeline:**

1. Install the **Tampermonkey** extension.
2. Create a script that matches your local app URL (e.g., http://localhost:\*/\*).
3. Have the script securely fetch or communicate with a background tab pointing to claude.ai.

Because cloud providers heavily protect their internal endpoints with strict Cross-Origin Resource Sharing (CORS) and anti-bot measures (like Cloudflare Turnstile), a direct fetch to claude.ai/api/v1/... from your local page will block. The user-script acts as the extension wrapper used to act, passing messages via window.postMessage.

---

**Why the Industry Rejected This Idea**

The reason this work wasn't picked up by others as an open standard comes down to a battle over user data and token economics:

1. **The Web Interface "Moat":** Google, OpenAI, and Anthropic actively fight against people using their consumer web UIs as APIs. They frequently change their internal web CSS classes, DOM structures, and API request signatures specifically to break unofficial headless wrappers.
2. **Economic Misalignment:** Consumer subscriptions ($20/month) assume human typing speeds. If an extension allows a local JS script to loop over thousands of lines of page data using a consumer account, the cloud provider loses massive amounts of money on compute.
3. **The API Pivot:** The developer community collectively gave up trying to keep up with the breaking changes of web-scraping wrappers and accepted paying fractions of a cent per token via official API keys instead.

If you want to build a quick, custom Tampermonkey script that bridges your **localhost page context** straight to a logged-in **Claude/ChatGPT tab** via browser messaging, I can write the clean, dependency-free JavaScript to set that up. Would you like to see how to handle that cross-tab communication?

# Q6\. Does some barrier prevent the source for window.ai being forked, modernised and redeployed?

Technically and legally, **no barrier prevents you from cloning the repository right now.** The [alexanderatallah/window.ai](https://github.com/alexanderatallah/window.ai) source code is licensed under the permissive MIT License, meaning anyone is free to fork, modernise, and republish it.

However, if you or a team of developers were to modernise and redeploy it today, you would immediately crash into severe **structural, security, and browser architecture barriers** that did not exist when Alex built it. These barriers explain why the project remains an archived relic.

---

**1\. The Security Barrier: Manifest V3 (Chrome's New Rules)**

Window AI was built on Chrome's older **Manifest V2** extension architecture. Chrome has fully deprecated Manifest V2. To deploy the extension to the Chrome Web Store today, it must be rewritten entirely for **Manifest V3**.

This transition breaks the exact mechanics Window AI relied on:

* **The Death of remotely hosted code:** Manifest V3 strictly prohibits extensions from executing dynamically fetched code or scripts injected from remote locations to prevent malware. Window AI frequently bypassed limits by adjusting communication pipelines dynamically.
* **Rigid Background Service Workers:** Manifest V3 replaced persistent background pages with ephemeral "Service Workers" that automatically shut down after a few minutes of inactivity. Window AI relied on a persistent background state to hold open authentication tokens, manage multi-tab message queues, and maintain WebSocket streams to local models. In Manifest V3, keeping that bridge permanently awake is incredibly difficult.

## **2\. The Defensive Barrier: Script-Scraping Warfare**

Window AI’s most valuable feature for individual users was its ability to use your *already-logged-in web accounts* (like chatgpt.com or claude.ai). It did this by mimicking a human user session or passing session headers.

Today, AI cloud providers aggressively guard their web applications against this exact behavior:

* **Cloudflare Turnstile & Proof-of-Work:** Major providers shield their consumer chat dashboards behind intense bot-detection layers. If an extension programmatically routes bulk requests from an in-page script through the consumer web DOM, it triggers Cloudflare, demanding an interactive captcha.
* **Rapid DOM Churn:** Anthropic and OpenAI rewrite and obfuscate their internal web app CSS and API endpoints constantly. A modernised version of Window AI would require a dedicated team of maintainers pushing extensions updates almost weekly just to fix broken DOM selectors.


## **3\. The Protocol Shift: MCP Rendered it Archaic**

The developer ecosystem moved away from custom extension-injected objects like window.ai because Anthropic open-sourced the **Model Context Protocol (MCP)**.

Instead of an extension injecting an AI engine into a webpage, the paradigm completely inverted: developers now want the *AI engine* (like Claude Desktop) to connect to the *local system* via standard JSON-RPC over WebSockets. Trying to convince web developers to wrap their code in a custom window.ai script when they can just spin up a standard MCP server is an uphill battle.

## **4\. Browser Vendors Stole the Monopolies**

The final barrier is a lack of user adoption incentive. Google and Apple realized that letting third-party extensions act as the AI router for the browser was a massive data security risk.

* Google built its own native **Prompt API (LanguageModel)** and WebMCP system directly into the browser core.
* Apple did the same with system-wide Apple Intelligence integrations.

Because browser vendors chose to bake localized AI routing straight into the operating system and browser engines, the user demand for a clunky, permission-heavy third-party extension that asks for raw API keys or session data plummeted.

---

**How to Fork It Anyway**

If you want to build this for your own personal use (bypassing the Web Store filters by loading it locally as an unpacked developer extension), the path forward is clear:

1. Clone the repo and audit the **src/background** scripts.
2. Refactor the manifest.json from version: 2 to version: 3\.
3. Strip out the broken web-scraping controllers and focus purely on letting it inject a clean window.ai object that forwards local page content directly to a **securely held API key** via fetch (with dangerously-allow-the-browser enabled).

If you are interested, I can write the core **Manifest V3 background.js wrapper** that handles the cross-origin permissions required to let an in-page script securely talk to an extension backend. Would you like to see that architectural blueprint?

# Q7: Can I get and use such an API key from a $20/month account?

**No, you cannot get an official API key from a $20/month consumer subscription.** Both OpenAI (ChatGPT Plus) and Anthropic (Claude Pro) enforce a strict wall between their products:

* **The $20/Month Subscription** covers unlimited-ish chat interactions *only* through their official web interfaces or consumer apps. It does not provide any API access.
* **The Developer API** is a completely separate billing system. It requires a developer account where you pay strictly for what you use, calculated per token (fractional pieces of text words).


However, if your goal is strictly to use **Claude** with local code, Anthropic introduced an exception to this rule.

---

**The Only Official Exception: Claude Code**

Anthropic allows users to authenticate a local terminal tool directly using a consumer subscription.

If you install [**Claude Code**](https://docs.anthropic.com/en/docs/claude-code/setup)—Anthropic's official command-line agent tool—the terminal will ask if you want to use an API Key or a subscription. By choosing **subscription**, you log into your browser using your $20/month Claude Pro account credentials. The local terminal agent can then run complex coding tasks locally using your subscription quotas rather than charging an API account.

While this doesn't give you a blank API key to use in a generic Chrome extension, it does provide a secure, local, programmatic route to Claude using your $20 account.

---

**Unofficial Workarounds (With Risks)**

Because of the financial incentive, developers frequently try to trick cloud providers into letting scripts use consumer accounts. These strategies carry significant trade-offs:

## **1\. The Headless Terminal Wrap**

Some developers log into Claude Code using their subscription, then wrap that local terminal process inside a lightweight backend API (like a local Node.js or FastAPI server). In-page JavaScript can then send the synthesized context window to http://localhost:3000, which passes it to the running Claude Code loop.

* **The Catch:** While it technically works for personal use, Anthropic's automated systems actively monitor for high-frequency or robotic request patterns. If you use a setup like this to loop over vast amounts of text data, it can result in a fast **permanent ban** on your $20 account for terms of service violations.


## **2\. Cookie Extraction (Session Token Scraping)**

You can manually open Chrome Developer Tools (F12), head to the Application/Storage tab, and copy your session cookie (e.g., Secure-4PSID for Google, or the session tokens for OpenAI/Anthropic). You can paste this cookie string into a custom local user script.


* **The Catch:** This is incredibly brittle. Security frameworks like Cloudflare Turnstile actively monitor cookie-based requests coming from script origins
that do not exactly match the original chat browser context, causing the automation to fail.


If you are open to using the official pay-as-you-go developer route instead, **$5 or $10 of pre-funded API credit** can last a surprisingly long time for small HTML text synthesis tasks. Would you like to see how to set up a standard pay-as-you-go developer profile for either **OpenAI** or **Anthropic**?

# Q8: Expand on Claude local terminal agent route \- could a dedicated chrome extension act as such an agent?

Yes, **Anthropic actually built this exact architecture**. Anthropic bypassed the limitations of browser-isolated environments by creating the official [**Claude in Chrome**](https://support.claude.com/en/articles/12902405-claude-in-chrome-troubleshooting) extension to act as an bridge for the local **Claude Code** terminal agent.

By looking at how Anthropic's own engineering team bypassed browser sandboxing, it is possible to design a custom, dedicated extension that hooks into your $20/month subscription for custom in-page JavaScript.

---

**How the Official "Claude in Chrome" Architecture Works**

Standard Chrome extensions cannot natively execute a continuous local AI loop or host an internal terminal agent because of Manifest V3's ephemeral service workers. Anthropic solved this with a split-brain approach:

1. **The "Brain" Outside the Browser:** The local claude CLI tool (Claude Code) runs natively on your machine. It handles your authenticated session, tracks context window state, and communicates with Anthropic's web routing layers.
1. **The "Brain" Outside the Browser:** The local claude CLI tool (Claude Code) runs natively on your machine. It handles your authenticated session, tracks context window state, and communicates with Anthropic's web routing layers.
2. **The Extension Bridge:** The Chrome extension connects to Claude Code using a specialized browser feature called **chrome.runtime.connectNative** (Native Messaging).
3. **The Channel:** This creates a permanent, lightning-fast bidirectional pipe (a local socket connection) between your terminal and your browser. Claude Code sends commands *down* to the extension, and the extension sends page content and raw DOM data *up* to the terminal agent.

Because Claude Code handles the login state via your web session, the extension allows the agent to view and manipulate pages you are actively signed into.
 
---

**Building Your Own Custom Extension Agent**

To replicate the original goal of **Window AI** (exposing your active consumer subscription to your own locally running code), you can build a lightweight version of Anthropic's setup using a three-tier pipeline.

```text
[ Your In-Page JS ]  <-- (window.postMessage) -->  [ Your Custom Extension ]  
|  
(Native Messaging Pipe)  
v  
[ Local Proxy Node.js ]   
|  
(Authenticated Session)  
v  
[ Claude ]
```

## **Step 1: The In-Page JavaScript (Your Local App)**

Your web app's standard front-end JavaScript simply broadcasts the synthesized context window text using standard browser events:

```javascript
function invokeSubscriptionAI(synthesizedContext, prompt) {
// Dispatch a message that the Chrome extension content-script is listening for  
    window.postMessage({
        type: "INVOKE_LOCAL_AGENT",
        context: synthesizedContext,
        instruction: prompt
    }, "*");
}

*// Example listener to catch the response returned from the extension later*  
window.addEventListener("message", (event) => {
    if (event.data.type === "AGENT_RESPONSE") {
        console.log("Claude Subscription Output:", event.data.text);
    }
});
```

## **Step 2: The Custom Extension (content.js \+ background.js)**

The extension acts entirely as a silent postman. It intercepts your in-page events and routes them straight out of the browser's sandbox using Native Messaging.

```javascript
/* eslint-env node */

"use strict";

// background.js (Extension Service Worker)
const nativePort = chrome.runtime.connectNative("com.local.claude.bridge");

// Listen for the context payload coming from the webpage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SEND_TO_AGENT") {
    // Blast it straight out of the browser into your local machine's native process
    nativePort.postMessage({ context: request.context, prompt: request.prompt });
  }
});

// Catch the output from the local machine and push it back down to the webpage tab
nativePort.onMessage.addListener((responseFromNode) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: "AGENT_RESPONSE",
      text: responseFromNode.text
    });
  });
});
```
## **Step 3: The Native App (A 20-line Node.js Script)**

Chrome extensions cannot run raw bash commands or hold persistent system state, but they *can* launch a specific binary or script on your machine if registered in a local manifest JSON file.

You write a tiny, local, background Node.js script. When your browser extension sends data down the pipe, this script acts as the client to process your subscription token or pipe the text into an open instance of **Claude Code**. 

---

**The Cat-and-Mouse Reality**

While a dedicated extension pipeline is fully possible and bypasses the Manifest V3 execution limits, open-source projects that try to automate subscription accounts face continuous legal and technical pushback.

Community projects like [**OpenClaw**](https://github.com/sethschnrt/claude-max-api-proxy) and **OpenCode** attempted to build local developer proxies that routed standard API calls directly through consumer web session tokens. However, maintainers regularly receive **legal takedown notices** from AI providers to strip out subscription auth hooks, and frequent updates to web app tokens often break unofficial authentication pipelines.

Because of this, sticking to Anthropic's **official Claude Code CLI** or wrapping it with your own personal, unreleased Native Messaging extension is the most reliable way to use your subscription programmatically without your code breaking every few weeks.

