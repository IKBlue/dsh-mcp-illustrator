//#region lib/index.js
/**
 * Host half.
 *
 * Two jobs, both of them forced by how the Harness actually behaves rather than chosen.
 *
 * 1. Make the `mcp-illustrator-timeouts` row configurable.
 *
 *    The settings provider derives a namespace from an entry's Config, but it serves only entries
 *    whose schema declares at least one `volatile()` field: `describe()` in @deepseek-ai/dsh-settings
 *    drops every entry whose `volatileForm(schema)` is undefined, and the Plugins page offers a form
 *    only for a served namespace. Without volatility the namespace is never served, the browser
 *    half's `whileServed` gate never fires, and the row shows no configuration at all — which is
 *    exactly what this row did at 0.2.1, where the two numbers were declared as plain defaults.
 *
 *    `volatile()` also means "live": the Loader commits a change that touches only volatile fields
 *    into the running fiber's references (`Entry._commitVolatile`) instead of remounting the entry.
 *    So a save never re-runs `apply` below — there is no callback to hook. The values live in Refs
 *    on the config object and are updated in place, which is why the publisher polls them.
 *
 * 2. Publish the two budgets into the host process environment.
 *
 *    The `mcp-illustrator` row's env expressions read `process.env.ILLUSTRATOR_MCP_TIMEOUT_*`, and
 *    that server reads both variables exactly once, at startup. The browser half respawns that row
 *    after a save, which re-evaluates the expressions and restarts the server with the new budgets.
 *
 *    Publication is skipped while a budget still equals its default, so the documented
 *    `setx ILLUSTRATOR_MCP_TIMEOUT_NORMAL` route keeps working for anyone who never opens the page.
 *
 * `@deepseek-ai/schemastery` is an application-internal package, so the import is dynamic and
 * allowed to fail: on a resolution failure the schema is simply absent (the row still activates
 * and everything else keeps working) instead of taking the row down with it.
 */
let z = null;
try {
	const mod = await import("@deepseek-ai/schemastery");
	z = mod.default ?? mod;
} catch {
	z = null;
}

/** Defaults, mirrored from cordis.patch.yml. A budget equal to its default is not published. */
const DEFAULTS = { normal: 180000, heavy: 180000 };

/** Environment variable each budget maps to, and the config field it comes from. */
const CHANNELS = [
	{ key: "ILLUSTRATOR_MCP_TIMEOUT_NORMAL", field: "normal" },
	{ key: "ILLUSTRATOR_MCP_TIMEOUT_HEAVY", field: "heavy" },
];

/** How often the Refs are re-read. A volatile save has no callback, so this is the only signal. */
const WATCH_MS = 300;

/** Schema present only when schemastery resolved; see the note above. */
export const Config = z === null
	? undefined
	: z.object({
		normal: z.number().step(1).min(1).default(DEFAULTS.normal).volatile(),
		heavy: z.number().step(1).min(1).default(DEFAULTS.heavy).volatile(),
	});

/**
 * Read one config field, whether the schema delivered it as a Ref (volatile) or as a value.
 * @param field - the field as it arrived on the resolved config.
 * @returns its current value.
 */
function read(field) {
	if (field === null || typeof field !== "object") return field;
	return typeof field.get === "function" ? field.get() : field;
}

/**
 * Publish the configured budgets into this process's environment, or restore what was there before
 * for any budget left at its default.
 * @param config - the row's resolved config.
 * @param original - the environment values captured when this row was mounted.
 */
function publish(config, original) {
	for (const { key, field } of CHANNELS) {
		const value = read(config?.[field]);
		if (typeof value !== "number" || value === DEFAULTS[field]) {
			const previous = original[key];
			if (previous === undefined) delete process.env[key];
			else process.env[key] = previous;
			continue;
		}
		process.env[key] = String(value);
	}
}

/** Watch the row's budgets and keep the environment in step with them. */
export function apply(ctx, config) {
	const original = {};
	for (const { key } of CHANNELS) original[key] = process.env[key];

	publish(config, original);
	ctx.effect(() => {
		const timer = setInterval(() => {
			publish(config, original);
		}, WATCH_MS);
		return () => {
			clearInterval(timer);
		};
	}, "mcp-illustrator: publish timeouts");
}
//#endregion
