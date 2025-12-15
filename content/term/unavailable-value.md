---
title: Unavailable Value
categories: ["term"]
---

An **unavailable value** is a special payload to a reactive system unifying handling of errors and asynchrony under
a common mechanism responding to "design incompletion for any reason". I named a special reactive payload as an "unavailable
value" indicating that the design was incomplete either as a result of depending on pending I/O or else on a design/syntax
error in the system.

My first 2024 simplistic version of this simply
repurposed the JavaScript `undefined` value as a special reactive payload that would short-circuit behaviour of any `computed`
and cull the action of any `effect` that was geared through it. An advantage of this scheme is that it can be layered
on top of any commodity reactive system, and here is my very first pass at this for preact-signals:

````
fluid.processSignalArgs = function (args) {
    let undefinedSignals = false;
    const designalArgs = [];
    for (const arg of args) {
        if (arg instanceof preactSignalsCore.Signal) {
            const value = arg.value;
            designalArgs.push(arg.value);
            if (value === undefined) {
                undefinedSignals = true;
            }
        } else {
            designalArgs.push(arg);
        }
    }
    return {designalArgs, undefinedSignals};
};

fluid.dispatchUnavailable = (func, args) => {
    const {designalArgs, undefinedSignals} = fluid.processSignalArgs(args);
    return undefinedSignals ? undefined : func.apply(null, designalArgs);
});


fluid.computed = function (func, ...args) {
    return computed( () => {
        return fluid.dispatchUnavailable(func, args);
    });
};

fluid.effect = function (func, ...args) {
    return effect( () => {
        return fluid.dispatchUnavailable(func, args);
    });
};
````

One uses the `fluid.computed` and `fluid.effect` wrappers rather than the underlying primitives and gets access
to more coherent behaviour especially as a system is starting up and I/O may not be completed or integration
libraries initialised. This defeats the annoying "dry run" behaviour of commodity reactive systems which expect to
discover dependencies by executing reactive functions on startup before their pre-requisites may be ready.

In the more mature system in 2025's Infusion, the unavailable payload is a specialised type including a
list of incompletion causes accumulated as the short-circuit process runs through the graph. This is analogous
to the good practice in language supporting
exceptions of [re-throwing an exception payload to add context](https://softwareengineering.stackexchange.com/questions/278034/rethrow-the-same-exception-to-provide-more-info).
As well as messages, these causes also include externally resolvable [addresses](/term/externalisability) of the
sites in the graph where the incompletion (I/O, error) occurred.

Here's an excerpt of the current unavailable value support, with much work still in progress: 


````
    fluid.unavailablePriority = {
        "I/O": 1,
        "config": 2,
        "error": 3
    };

    /**
     * Create a marker representing an "Unavailable" state with an associated waitset.
     * The marker is mutable.
     *
     * @param {Object|Array} [cause={}] - A list of dependencies or reasons for unavailability.
     * @param {String} [variety="error"] - The variety of unavailable value:
     * * "error" indicates a syntax issue that needs design intervention.
     * * "config" indicates configuration designed to short-circuit evaluation which is not required.
     * * "I/O" indicates pending I/O
     * @return {Unavailable} An unavailable value marker.
     */
    fluid.unavailable = (cause = {}, variety = "error") => {
        const togo = fluid.makeMarker("Unavailable", {
            causes: fluid.makeArray(cause).map(oneCause => {
                if (typeof(oneCause) === "string") {
                    oneCause = {message: oneCause};
                }
                if (!oneCause.variety) {
                    oneCause.variety = variety;
                }
                return oneCause;
            })
        }, true);
        togo.variety = togo.causes.reduce((acc, {variety}) => {
            const priority = fluid.unavailablePriority[variety];
            return priority > acc.priority ? {variety, priority} : acc;
        }, {priority: -1}).variety;
        return togo;
    };

    /**
     * Process an array of arguments, unwrapping values from `preactSignalsCore.Signal` objects
     * and identifying and coalescing "unavailable" values if present.
     *
     * @param {Array|any} args - The array of arguments or single argument to process.
     *     Arguments may include `preactSignalsCore.Signal` instances or plain values.
     * @param {Object} [options] - Additional specifications for processing arguments (optional).
     * @param {any} [oldValue] - If these are arguments to a "computed", the previous value of the computed is supplied here
     * @return {Object} An object with the following properties:
     *     - `designalArgs` (Array): The array of arguments with `Signal` values replaced by their unwrapped values.
     *     - `unavailable` (Object|undefined): The most "unavailable" value (if any) based on priority,
     *       or `undefined` if no unavailable values are found.
     */
    fluid.processSignalArgs = function (args, options, oldValue) {
        let unavailable = undefined;
        const designalArgs = [];
        if (!Array.isArray(args)) {
            args = [args];
        }
        const flattenArg = options?.flattenArg;
        for (let i = 0; i < args.length; ++i) {
            let arg = args[i];
            if (arg instanceof preactSignalsCore.Signal) {
                arg = flattenArg ? flattenArg(arg, i) : arg.value;
            }
            if (arg === fluid.OldValue) {
                arg = fluid.isUnavailable(oldValue) ? null : oldValue; // User doesn't want a short-circuit
            }
            if (fluid.isUnavailable(arg)) {
                unavailable = fluid.mergeUnavailable(unavailable, arg);
            }
            designalArgs.push(arg);
        }
        return {designalArgs, unavailable};
    };

    /**
     * Appends a site to the `site` array of the last element in the `causes` array of the given "unavailable" marker.
     * If the `site` array does not exist, it is allocated.
     * @param {fluid.unavailable} unavailable - The "unavailable" marker containing the `causes` array.
     * @param {Site} [site] - The site to append to the `site` array of the last cause.
     * @return {fluid.unavailable} The supplied unavailable value with a cause site filled in
     */
    fluid.accumulateUnavailableSite = function (unavailable, site) {
        // TODO: Causes should actually form independent chains rather than being in a linear array - can't guarantee
        // right now that the last cause is not an irrelevant failure
        if (site) {
            const lastCause = unavailable.causes[0];
            if (!Array.isArray(lastCause.site)) {
                lastCause.site = fluid.makeArray(lastCause.site);
            }
            if (!lastCause.site.includes(site)) {
                lastCause.site.push(site);
            }
        }
        return unavailable;
    };

    /**
     * Create a computed value based on a function and its arguments, resolving any signals and handling unavailability.
     *
     * @param {Function|Signal<Function>} funcSignal - The function to compute the value
     * @param {Array|any} argSignals - The arguments or argument to pass to the function. These may include signals, which will be resolved.
     * @param {Object} [options] - Additional specifications for processing arguments (optional).
     * @return {Object} A computed value that resolves the function's result, or an "unavailable" marker if any argument is unavailable.
     */
    fluid.computed = function (funcSignal, argSignals, options) {
        return computed(function fluidComputed(oldValue) {
            const acc = u => fluid.accumulateUnavailableSite(u, this.site);
            const {
                designalArgs,
                unavailable
            } = fluid.processSignalArgs(argSignals, options || fluid.defaultSignalOptions, oldValue);
            const func = fluid.deSignal(funcSignal);
            return unavailable ? acc(unavailable) : fluid.isUnavailable(func) ? acc(func) : func.apply(null, designalArgs);
        });
    };

    /**
     * Create an effect that executes a function with resolved arguments, resolving any signals and handling unavailability.
     *
     * @param {Function} func - The function to execute
     * @param {Array|any} args - The arguments or argument to pass to the function. These may include signals, which will be resolved.
     * @param {Object} [options] - Additional specifications for processing arguments (optional).
     * @return {Object} An effect that executes the function if all arguments are available, or does nothing if any argument is unavailable.
     */
    fluid.effect = function (func, args, options) {
        const togo = effect(function fluidEffect() {
            const {designalArgs, unavailable} = fluid.processSignalArgs(args, options || fluid.defaultSignalOptions);
            if (!unavailable || options?.free) {
                return untracked( () => func.apply(this, designalArgs));
            }
        });
        togo.$func = func;
        togo.$args = args;
        return togo;
    };
````

To illustrate how this is meant to work at the "supply end" here is the `fluid.fetch` wrapper which wraps the underlying
`fetch` API with appropriate signalling of unavailability during the fetch, and harder unavailability ("error") if
it fails:

````
    /**
     * Fetches data from a given URL and processes the response using a provided strategy function.
     * Whilst the fetch is pending, the signal is set to an "unavailable" state.
     * If the fetch fails, the signal is set to an "unavailable" state with an error message.
     *
     * @param {String} url - The URL to fetch data from.
     * @param {RequestInit} [options] - Optional fetch configuration options.
     * @param {Function} strategy - An async function to process the response.
     * @return {signal<any>} A signal containing the processed data or an "unavailable" state.
     */
    fluid.fetch = function (url, options, strategy) {
        const togo = signal(fluid.unavailable({message: `Pending I/O for URL ${url}`, variety: "I/O"}));
        fetch(url, {...options, ...fluid.cacheOptions})
            .then(response => {
                if (!response.ok) {
                    togo.value = fluid.unavailable({message: `HTTP error ${response.status} for URL ${url}`, variety: "error"});
                } else {
                    return strategy(response);
                }
            })
            .then(data => {
                if (!fluid.isErrorUnavailable(togo.peek())) { // Fetch API provides an undefined response in the case response is not OK
                    if (options?.delay) {
                        window.setTimeout(() => togo.value = data, options.delay);
                    } else {
                        togo.value = data;
                    }
                }
            })
            .catch(err => togo.value = fluid.unavailable({message: `I/O failure for URL ${url} - ${err}`, variety: "error"}));
        return togo;
    };
    
   /**
     * Fetches JSON data from a given URL and stores the result in a signal.
     * Whilst the fetch is pending, the signal is set to an "unavailable" state.
     * If the fetch fails, the signal is set to an "unavailable" state with an error message.
     *
     * @param {String} url - The URL to fetch JSON data from.
     * @param {RequestInit} [options] - Optional fetch configuration options.
     * @return {signal<Object>} A signal containing the fetched JSON data or an "unavailable" state.
     */
    fluid.fetchJSON = function (url, options) {
        return fluid.fetch(url, options, async response => response.json());
    };
````

This can then be used to lift a synchronous computation primitive (addition) to an asynchronous one without the need
for explicit synchronisation ([test case](https://github.com/fluid-project/infusion-6/blob/590803081e8243c07e30360cecd07eb4167178f1/tests/framework-tests/core/js/FluidILTests.js#L564)):

````
fluid.def("fluid.tests.fetchCompute", {
    $layers: "fluid.component",
    first: "$compute:fluid.fetchJSON(../testData/data-2.json)",
    second: "$compute:fluid.fetchJSON(../testData/data-3.json)",
    result: {
        "$compute": {
            func: (a, b) => a + b,
            args: ["{self}.first.value", "{self}.second.value"]
        }
    }
});
````
