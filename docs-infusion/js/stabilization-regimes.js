"use strict";
(() => {

    /* ===================================================================== *
     *  DATA LAYER
     *  Cell objects hold the reactive status flags. The algorithm mutates
     *  those flags; the simulator records snapshots ("frames") from them.
     *  No reactive values are propagated — only staleness.
     * ===================================================================== */

    const CLEAN = 0;
    const CHECK = 1;
    const DIRTY = 2;

    /** Fixed, hand-placed layout in a 320x440 viewBox (sources low, effects high). */
    const LAYOUT = [
        { id:"s0", kind:"source",   x:60,  y:400 },
        { id:"s1", kind:"source",   x:160, y:400 },
        { id:"s2", kind:"source",   x:260, y:400 },
        { id:"a0", kind:"computed", x:46,  y:312 },
        { id:"a1", kind:"computed", x:118, y:312 },
        { id:"a2", kind:"computed", x:202, y:312 },
        { id:"a3", kind:"computed", x:274, y:312 },
        { id:"b0", kind:"computed", x:80,  y:226 },
        { id:"b1", kind:"computed", x:160, y:226 },
        { id:"b2", kind:"computed", x:240, y:226 },
        { id:"c0", kind:"computed", x:118, y:142 },
        { id:"c1", kind:"computed", x:208, y:142 },
        { id:"e0", kind:"effect",   x:60,  y:60  },
        { id:"e1", kind:"effect",   x:160, y:60  },
        { id:"e2", kind:"effect",   x:260, y:60  }
    ];

    /** Dependencies: each node lists the lower nodes it reads. Staleness flows upward. */
    const DEPS = {
        a0:["s0"], a1:["s0","s1"], a2:["s1","s2"], a3:["s2"],
        b0:["a0","a1"], b1:["a1","a2","a3"], b2:["a2","a3"],
        c0:["b0","b1"], c1:["b1","b2"],
        e0:["c0"], e1:["c0","c1"], e2:["c1","b2"]
    };

    /**
     * Build a fresh graph instance (independent flag state per panel).
     * @return {Object} - A graph with `order` [Object], `byId` Object, `sources` [String], `effects` [String].
     */
    const buildGraph = () => {
        const byId = {};
        const order = [];
        const sources = [];
        const effects = [];
        for (const spec of LAYOUT){
            const cell = {
                id: spec.id, kind: spec.kind, x: spec.x, y: spec.y,
                deps: [...(DEPS[spec.id] ?? [])],
                observers: [],
                level: spec.kind === "source" ? 0 : -1,
                state: CLEAN
            };
            byId[cell.id] = cell;
            order.push(cell);
            if (cell.kind === "source"){
                sources.push(cell.id);
            } else if (cell.kind === "effect"){
                effects.push(cell.id);
            } else {
                /* computed — no list membership */
            }
        }
        for (const c of order){
            for (const dep of c.deps){ byId[dep].observers.push(c.id); }
        }
        computeLevels({ order, byId });
        return { order, byId, sources, effects };
    };

    /**
     * Assign each node its longest-path depth from the sources (sources = 0).
     * @param {Object} g - A graph with `order` and `byId`.
     */
    const computeLevels = (g) => {
        let changed = true;
        while (changed){
            changed = false;
            for (const c of g.order){
                if (c.kind === "source"){
                    /* sources are level 0 already */
                } else {
                    let m = 0;
                    for (const dep of c.deps){
                        const lv = g.byId[dep].level;
                        if (lv > m){ m = lv; }
                    }
                    if (m + 1 !== c.level){ c.level = m + 1; changed = true; }
                }
            }
        }
    };

    /**
     * Reset every cell to CacheClean.
     * @param {Object} g - The graph to clear.
     */
    const resetGraph = (g) => {
        for (const c of g.order){ c.state = CLEAN; }
    };

    /**
     * Recursively mark a node (and its descendants) CacheCheck if currently cleaner.
     * @param {Object} g - The graph.
     * @param {String} id - Id of the node to mark.
     */
    const markCheckFrom = (g, id) => {
        const c = g.byId[id];
        if (c.state < CHECK){
            c.state = CHECK;
            for (const o of c.observers){ markCheckFrom(g, o); }
        } else {
            /* already CacheCheck or CacheDirty — leave it */
        }
    };

    /**
     * Down phase from a single source: mark it dirty, all descendants check.
     * @param {Object} g - The graph.
     * @param {String} id - Id of the changed source.
     */
    const setSource = (g, id) => {
        g.byId[id].state = DIRTY;
        for (const o of g.byId[id].observers){ markCheckFrom(g, o); }
    };

    /**
     * Depth-first pull (updateIfNecessary + update): bring `id` and its stale
     * ancestors current, emitting one frame per recompute so the red recompute
     * front can be seen climbing through the green check region.
     * @param {Object} g - The graph.
     * @param {String} id - Id of the node to pull.
     * @param {Object} ctx - Running counters and current labels.
     * @param {Function} push - Frame emitter taking an overrides Object.
     */
    const pull = (g, id, ctx, push) => {
        const c = g.byId[id];
        if (c.state === CLEAN){
            /* already current — sharing avoids a second recompute */
        } else {
            for (const dep of c.deps){ pull(g, dep, ctx, push); }
            c.state = DIRTY;                      /* shown red: executing now */
            let pulses = [];
            if (c.kind === "source"){
                /* a set source is its own current value — not a recompute */
            } else {
                ctx.recomputes += 1;
            }
            if (c.kind === "effect"){
                ctx.fired += 1;
                pulses = [c.id];
            }
            push({ sub:`recompute ${c.id}`, recomputes:ctx.recomputes, fired:ctx.fired, pulses, hold:470 });
            c.state = CLEAN;                      /* settles; visible next frame */
        }
    };

    /* ===================================================================== *
     *  SIMULATOR — turns the algorithm into an ordered list of frames.
     *  A frame is a flat snapshot of all flags plus pulses / labels / hold.
     * ===================================================================== */

    /**
     * Snapshot the current flag state into a frame.
     * @param {Object} g - The graph.
     * @param {Object} extra - Frame fields to merge over the snapshot.
     * @return {Object} - One frame.
     */
    const snap = (g, extra) => {
        const fills = {};
        for (const c of g.order){ fills[c.id] = c.state; }
        const base = { fills, pulses:[], label:"", sub:"", recomputes:0, fired:0, hold:480, trigger:false, analysis:false };
        return { ...base, ...extra };
    };

    /**
     * Produce the frame list for one regime.
     * @param {Object} g - A fresh graph instance for this regime.
     * @param {String} kind - "immediate", "deferred" or "fullyDeferred".
     * @return {Object[]} - Ordered frames.
     */
    const simulate = (g, kind) => {
        resetGraph(g);
        const frames = [];
        const ctx = { recomputes:0, fired:0, label:"", sub:"" };
        const push = (extra = {}) => {
            const merged = {
                label:ctx.label, sub:ctx.sub, recomputes:ctx.recomputes, fired:ctx.fired,
                hold:480, pulses:[], trigger:false, analysis:false, ...extra
            };
            frames.push(snap(g, merged));
        };

        ctx.label = "idle"; ctx.sub = "graph clean";
        push({ hold:1000 });

        if (kind === "immediate"){
            for (const sid of g.sources){
                ctx.label = `update ${sid}()`;
                ctx.sub = "eager — the set notifies effects on this stack";
                push({ trigger:true, hold:1150 });
                setSource(g, sid);
                ctx.label = `set ${sid} → cascade`;
                ctx.sub = "mark stale, then recompute synchronously";
                push({ hold:560 });
                for (const eid of g.effects){ pull(g, eid, ctx, push); }
                ctx.sub = "effects issued";
                push({ hold:600 });
            }
            ctx.label = "settled";
            ctx.sub = `effects fired ${ctx.fired}× · no analysis point`;
            push({ hold:1500 });

        } else if (kind === "deferred"){
            for (const sid of g.sources){
                ctx.label = `update ${sid}()`;
                ctx.sub = "mark stale only — no recompute";
                push({ trigger:true, hold:820 });
                setSource(g, sid);
                push({ hold:500 });
            }
            ctx.label = "graph stale";
            ctx.sub = "effects pending — nothing issued";
            push({ hold:1500 });
            ctx.label = "stabilize()";
            ctx.sub = "walk the effect queue, one at a time";
            push({ trigger:true, hold:1150 });
            for (const eid of g.effects){
                ctx.label = `stabilize(): ${eid}`;
                pull(g, eid, ctx, push);
                ctx.sub = `${eid} current`;
                push({ hold:540 });
            }
            ctx.label = "settled";
            ctx.sub = `each node recomputed once · fired ${ctx.fired}×`;
            push({ hold:1500 });

        } else {
            for (const sid of g.sources){
                ctx.label = `update ${sid}()`;
                ctx.sub = "mark stale only — no recompute";
                push({ trigger:true, hold:820 });
                setSource(g, sid);
                push({ hold:500 });
            }
            ctx.label = "graph stale";
            ctx.sub = "effects pending";
            push({ hold:1250 });
            ctx.label = "stabilize(NonEffects)";
            ctx.sub = "breadth-first, level by level, up to the fringe";
            push({ trigger:true, hold:1150 });

            for (const sid of g.sources){ g.byId[sid].state = CLEAN; }
            ctx.sub = "sources current";
            push({ hold:520 });

            for (const level of [1, 2, 3]){
                const layer = g.order.filter((c) => c.kind !== "effect" && c.level === level && c.state !== CLEAN);
                for (const c of layer){ c.state = DIRTY; ctx.recomputes += 1; }
                ctx.label = "stabilize(NonEffects)";
                ctx.sub = `recompute layer ${level} together`;
                push({ hold:700, recomputes:ctx.recomputes });
                for (const c of layer){ c.state = CLEAN; }
            }

            ctx.label = "analysis point";
            ctx.sub = "all computeds current; effects still pending — inspect here";
            push({ analysis:true, hold:2500 });

            ctx.label = "stabilize() — commit";
            ctx.sub = "issue the three effects";
            push({ trigger:true, hold:1000 });
            const pulses = [];
            for (const eid of g.effects){
                g.byId[eid].state = DIRTY;
                ctx.recomputes += 1; ctx.fired += 1;
                pulses.push(eid);
            }
            ctx.sub = "effects issued together";
            push({ pulses, hold:760, recomputes:ctx.recomputes, fired:ctx.fired });
            for (const eid of g.effects){ g.byId[eid].state = CLEAN; }
            ctx.label = "settled";
            ctx.sub = "each node recomputed once · fired after inspection";
            push({ hold:1500 });
        }
        return frames;
    };

    /* ===================================================================== *
     *  VIEW LAYER — builds an SVG scope once, then only swaps fills / text.
     * ===================================================================== */

    const SVGNS = "http://www.w3.org/2000/svg";

    /**
     * Create an SVG element with attributes.
     * @param {String} tag - Element name.
     * @param {Object} attrs - Attribute map.
     * @return {SVGElement} - The created element.
     */
    const svgEl = (tag, attrs = {}) => {
        const el = document.createElementNS(SVGNS, tag);
        for (const [k, v] of Object.entries(attrs)){ el.setAttribute(k, v); }
        return el;
    };

    const PALETTE = {
        [DIRTY]: { fill:"var(--dirty)", stroke:"var(--dirty-stroke)" },
        [CHECK]: { fill:"var(--check)", stroke:"var(--check-stroke)" },
        [CLEAN]: { fill:"var(--clean)", stroke:"var(--clean-stroke)" }
    };

    /**
     * Map a flag value to fill / stroke CSS variables.
     * @param {Number} state - CLEAN, CHECK or DIRTY.
     * @return {Object} - {fill, stroke} CSS values.
     */
    const colourFor = (state) => PALETTE[state] ?? PALETTE[CLEAN];

    /** A panel: one SVG scope plus its HUD, frame list and pulse rings. */
    class Panel {
        #nodeEls = {};
        #edgeEls = [];
        #pulseGroup;
        #pos = {};
        #refs = {};
        #slider;
        #scrub;

        frames = [];
        starts = [];
        total = 0;
        lastIdx = -1;
        active = [];
        manual = false;
        el;

        /**
         * @param {Object} graph - The graph instance backing this panel.
         * @param {Object} meta - {num, title, desc} descriptors.
         */
        constructor(graph, meta) {
            const panel = document.createElement("section");
            panel.className = "panel";

            const head = document.createElement("div");
            head.className = "phead";
            head.innerHTML =
                `<div class="pnum">${meta.num}</div>` +
                `<div class="ptitle">${meta.title}</div>` +
                `<div class="pdesc">${meta.desc}</div>`;
            panel.appendChild(head);

            const hud = document.createElement("div");
            hud.className = "hud";
            const phaseEl = document.createElement("div");
            phaseEl.className = "phase";
            const subEl = document.createElement("div");
            subEl.className = "sub";
            hud.append(phaseEl, subEl);
            panel.appendChild(hud);

            /*
            const meters = document.createElement("div");
            meters.className = "meters";
            meters.innerHTML =
                `<div class="meter"><b data-rc>0</b><span class="lbl">recomputes</span></div>` +
                `<div class="meter"><b data-fr>0</b><span class="lbl">effects fired</span></div>`;
            panel.appendChild(meters);
            */

            const scope = svgEl("svg", {class: "scope", viewBox: "0 0 320 440", role: "img"});
            const gEdges = svgEl("g");
            const gPulse = svgEl("g");
            const gNodes = svgEl("g");
            scope.append(
                svgEl("rect", {class: "scope-frame", x: 6, y: 6, width: 308, height: 428, rx: 10, "stroke-width": 1}),
                gEdges, gPulse, gNodes
            );
            panel.appendChild(scope);

            for (const c of graph.order) {
                for (const depId of c.deps) {
                    const d = graph.byId[depId];
                    const line = svgEl("line", {class: "edge", x1: d.x, y1: d.y, x2: c.x, y2: c.y});
                    gEdges.appendChild(line);
                    this.#edgeEls.push({el: line, from: d.id, to: c.id});
                }
            }

            for (const n of graph.order) {
                this.#pos[n.id] = {x: n.x, y: n.y};
                let shape;
                if (n.kind === "source") {
                    const r = 12;
                    shape = svgEl("path", {
                        class: "node-shape", "stroke-width": 1.6,
                        d: `M ${n.x} ${n.y - r} L ${n.x + r} ${n.y} L ${n.x} ${n.y + r} L ${n.x - r} ${n.y} Z`
                    });
                    gNodes.appendChild(shape);
                } else if (n.kind === "effect") {
                    gNodes.appendChild(svgEl("rect", {
                        class: "ring",
                        x: n.x - 15,
                        y: n.y - 15,
                        width: 30,
                        height: 30,
                        rx: 6
                    }));
                    shape = svgEl("rect", {
                        class: "node-shape",
                        x: n.x - 11,
                        y: n.y - 11,
                        width: 22,
                        height: 22,
                        rx: 4,
                        "stroke-width": 1.6
                    });
                    gNodes.appendChild(shape);
                } else {
                    shape = svgEl("circle", {class: "node-shape", cx: n.x, cy: n.y, r: 11, "stroke-width": 1.6});
                    gNodes.appendChild(shape);
                }
                const label = svgEl("text", {class: "node-label", x: n.x, y: n.y + 3, "text-anchor": "middle"});
                label.textContent = n.id;
                gNodes.appendChild(label);
                this.#nodeEls[n.id] = shape;
            }

            this.#pulseGroup = gPulse;

            const scrub = document.createElement("div");
            scrub.className = "scrub";
            const slider = document.createElement("input");
            Object.assign(slider, {type: "range", min: 0, max: 1, step: 1, value: 0});
            const mode = document.createElement("div");
            mode.className = "scrub-mode";
            mode.innerHTML = `<span data-mode>auto</span><span data-step>step 1</span>`;
            scrub.append(slider, mode);
            slider.addEventListener("input", () => {
                this.manual = true;
                this.#onScrub();
            });
            slider.addEventListener("dblclick", () => {
                this.manual = false;
                this.syncSlider(this.sliderIndex());
            });
            panel.appendChild(scrub);
            this.#slider = slider;
            this.#scrub = scrub;

            this.#refs = {
                phase: phaseEl,
                sub: subEl,
                //rc: meters.querySelector("[data-rc]"),
                //fr: meters.querySelector("[data-fr]"),
                mode: mode.querySelector("[data-mode]"),
                step: mode.querySelector("[data-step]")
            };
            this.el = panel;
        }

        /**
         * Paint a frame: node fills, edge heat, HUD text, panel highlight.
         * @param {Object} frame - The frame to render.
         */
        render(frame) {
            for (const [id, state] of Object.entries(frame.fills)) {
                const {fill, stroke} = colourFor(state);
                const node = this.#nodeEls[id];
                node.style.fill = fill;
                node.style.stroke = id.startsWith("s") ? "var(--accent)" : stroke;
            }
            for (const ed of this.#edgeEls) {
                const hot = frame.fills[ed.from] === DIRTY || frame.fills[ed.to] === DIRTY;
                ed.el.classList.toggle("hot", hot);
            }
            const {phase, sub, rc, fr} = this.#refs;
            phase.textContent = frame.label;
            sub.textContent = frame.sub;
            phase.classList.toggle("is-trigger", frame.trigger);
            phase.classList.toggle("is-analysis", frame.analysis);
            this.el.classList.toggle("trigger", frame.trigger);
            this.el.classList.toggle("analysis", frame.analysis);
            // rc.textContent = frame.recomputes;
            // fr.textContent = frame.fired;
        }

        /**
         * Add expanding red rings radiating from an effect node.
         * @param {String} id - Effect node id.
         * @param {Number} now - Current timestamp.
         */
        addPulse(id, now) {
            const at = this.#pos[id];
            for (let ring = 0; ring < 2; ring++) {
                const circle = svgEl("circle", {
                    cx: at.x, cy: at.y, r: 13, fill: "none", style: "stroke:var(--dirty)", "stroke-width": 2, opacity: 0
                });
                this.#pulseGroup.appendChild(circle);
                this.active.push({el: circle, born: now + ring * 140});
            }
        }

        /**
         * Advance and prune active pulse rings.
         * @param {Number} now - Current timestamp.
         */
        updatePulses(now) {
            const keep = [];
            for (const ring of this.active) {
                const age = now - ring.born;
                if (age < 0) {
                    ring.el.setAttribute("opacity", "0");
                    keep.push(ring);
                } else if (age <= 820) {
                    ring.el.setAttribute("r", (13 + age * 0.055).toFixed(1));
                    ring.el.setAttribute("opacity", ((1 - age / 820) * 0.6).toFixed(3));
                    keep.push(ring);
                } else {
                    ring.el.parentNode?.removeChild(ring.el);
                }
            }
            this.active = keep;
        }


        /**
         * Size the scrub range to this panel's frame count.
         * @param {Number} n - Number of frames.
         */
        setFrameCount(n) {
            this.#slider.max = n - 1;
        }

        /**
         * Current scrub position as a frame index.
         * @return {Number} - Frame index taken from the slider.
         */
        sliderIndex() {
            return Number(this.#slider.value);
        }

        /**
         * Move the thumb to follow auto progress (only used while not under manual control).
         * @param {Number} idx - Frame index now showing.
         */
        syncSlider(idx) {
            this.#slider.value = idx;
            this.#scrub.classList.remove("is-manual");
            this.#refs.mode.textContent = "auto";
            this.#refs.step.textContent = `step ${idx + 1}`;
        }

        /** Reflect a user scrub in the caption; the frame itself is drawn by the loop. */
        #onScrub() {
            const idx = Number(this.#slider.value);
            this.#scrub.classList.add("is-manual");
            this.#refs.mode.textContent = "manual";
            this.#refs.step.textContent = `step ${idx + 1}`;
        }
    }

    /* ===================================================================== *
     *  DRIVER — one shared clock plays all three panels and loops.
     * ===================================================================== */

    const REDUCE = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    const META = [
        { kind:"immediate", num:"i", title:"Immediate stabilization",
            desc: `Eager &amp; synchronous. Setting any source recomputes its cone and fires effects on the same
             stack &mdash; depth-first, and once per set. As seen in frameworks such as preact-signals, angular signals, and fluid.cell version 6.0` },
        { kind:"deferred", num:"ii", title:"Deferred stabilization",
            desc: `Marks are cheap; nothing runs until stabilize(). Then the effect queue is pulled one effect at a time,
            each dragging its dependencies up depth-first. As seen in Reactively, Solid signals 2.0 and fluid.cell 6.1.` },
        { kind:"fullyDeferred", num:"iii", title:"Fully deferred stabilization",
            desc: `stabilize(NonEffects) brings every non-effect node current breadth-first, then pauses at the fringe
            &mdash; an analysable moment &mdash; before any effect is issued. As planned for fluid.cell 6.3.` }
    ];

    const stage = document.querySelector(".stabilization .stage");
    const panels = [];
    for (const meta of META){
        const graph = buildGraph();
        const frames = simulate(graph, meta.kind);
        const panel = new Panel(graph, meta);
        let acc = 0;
        for (const f of frames){ panel.starts.push(acc); acc += f.hold; }
        panel.frames = frames;
        panel.total = acc;
        panel.setFrameCount(frames.length);
        stage.appendChild(panel.el);
        panel.render(frames[0]);
        panel.lastIdx = 0;
        panels.push(panel);
    }

    const END_PAUSE = 1800;
    const CYCLE = Math.max(...panels.map((p) => p.total)) + END_PAUSE;

    /**
     * Index of the active frame for time `t` (holds the last frame past its end).
     * @param {Number[]} starts - Cumulative start times.
     * @param {Number} t - Time within the cycle.
     * @return {Number} - Frame index.
     */
    const frameIndexAt = (starts, t) => {
        let idx = 0;
        for (let i = 0; i < starts.length; i++){
            if (starts[i] <= t){ idx = i; }
        }
        return idx;
    };

    let t0 = null;
    /**
     * Main animation loop: positions each panel on the shared clock and loops.
     * @param {Number} now - rAF timestamp.
     */
    const loop = (now) => {
        t0 ??= now;
        const t = (now - t0) % CYCLE;
        for (const panel of panels){
            const idx = panel.manual ? panel.sliderIndex() : frameIndexAt(panel.starts, t);
            if (idx !== panel.lastIdx){
                const frame = panel.frames[idx];
                panel.render(frame);
                if (idx > panel.lastIdx && frame.pulses.length > 0 && !REDUCE){
                    for (const pid of frame.pulses){ panel.addPulse(pid, now); }
                }
                if (!panel.manual){ panel.syncSlider(idx); }
                panel.lastIdx = idx;
            }
            panel.updatePulses(now);
        }
        window.requestAnimationFrame(loop);
    };

    window.requestAnimationFrame(loop);

})();