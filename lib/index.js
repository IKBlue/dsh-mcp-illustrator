//#region lib/index.js
/**
 * Host half.
 *
 * Three jobs, each one forced by how the Harness actually behaves rather than chosen.
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
 * 2. Publish the two budgets into the host process environment, which is where the
 *    `mcp-illustrator` row's env expressions read them (`process.env.ILLUSTRATOR_MCP_TIMEOUT_*`).
 *
 *    `volatile()` means "live": the Loader commits a change that touches only volatile fields into
 *    the running fiber's references (`Entry._commitVolatile`) instead of remounting this entry. So a
 *    save never re-runs `apply` and there is no callback to hook; the values live in Refs on the
 *    config object and are updated in place, which is why the publisher watches them on a timer.
 *
 *    Publication is skipped while a budget equals its default, so the documented
 *    `setx ILLUSTRATOR_MCP_TIMEOUT_NORMAL` route keeps working for anyone who never opens the page.
 *
 * 3. Respawn the `mcp-illustrator` row, which is what makes a saved budget reach the server.
 *
 *    The server reads both variables once, at startup (module-level constants in
 *    dist/executor/jsx-runner.js), so the row has to be mounted again for the expressions to be
 *    re-evaluated. There is no "restart this row" call and the manager ignores a request that does
 *    not change a row's state, so the row is disabled and re-enabled, and the enable is verified and
 *    retried — stopping at a disabled row would cost all 66 Illustrator tools.
 *
 *    This runs here rather than in the browser half on purpose. Reaching `pluginManager` from a
 *    client plugin means going through the remote gateway, and that gateway mounts only the package
 *    faces a client package declares for itself: from this bundle the call was accepted and then
 *    never answered, so the page hung on "restarting…" forever and the profile was never touched.
 *    The service is local to this process, so this half calls it directly.
 *
 *    `hmr.executing` is an `AsyncLocalStorage` and `runExclusive` refuses a caller that is already
 *    inside a transaction — which any callback created during this row's own reconcile is. The
 *    watcher below is therefore created inside `executing.exit(...)`, the same escape DSH uses for
 *    its own config watcher. Without it every restart request would be rejected, because a volatile
 *    save commits into the running references instead of remounting, leaving the watcher with the
 *    transaction's context for the rest of its life.
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

/** Patch id of the MCP client row that has to be mounted again for a new budget to apply. */
const MCP_ROW = "mcp-illustrator";

/** How often the Refs are re-read. A volatile save has no callback, so this is the only signal. */
const WATCH_MS = 300;

/** How long to wait after a failed restart before asking again, so a failure cannot become a loop. */
const RETRY_MS = 10000;

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

/** The budgets as one string, so an unchanged pair never triggers a restart. */
function budgets(config) {
	return CHANNELS.map(({ field }) => read(config?.[field])).join("/");
}

/**
 * Mount the MCP row again so its env expressions are re-evaluated against the environment above.
 * @param ctx - this row's plugin context.
 * @returns whether the row came back enabled.
 */
async function respawn(ctx) {
	const manager = ctx.get("pluginManager");
	if (manager === void 0 || typeof manager.setPluginEnabled !== "function") return false;
	const find = async () => {
		const rows = await manager.listPlugins();
		return Array.isArray(rows) ? rows.find((row) => row.patchId === MCP_ROW) : void 0;
	};
	try {
		const row = await find();
		if (row === void 0 || row.entryId === void 0) return false;
		if (row.readOnlyReason !== void 0) return false;
		// An already-disabled row is repaired by the enable below rather than skipped: the disable
		// half exists only to force a state change the manager would otherwise ignore.
		if (row.enabled !== false) await manager.setPluginEnabled(row.entryId, false);

		let enabled = false;
		for (let attempt = 0; attempt < 3 && !enabled; attempt += 1) {
			try {
				await manager.setPluginEnabled(row.entryId, true);
			} catch (error) {
				if (attempt === 2) throw error;
			}
			const after = await find();
			enabled = after !== undefined && after.enabled !== false;
		}
		return enabled;
	} catch {
		return false;
	}
}

/** Watch the row's budgets, keep the environment in step, and respawn the MCP row when they move. */
export function apply(ctx, config) {
	const original = {};
	for (const { key } of CHANNELS) original[key] = process.env[key];

	let acted = budgets(config);
	let busy = false;
	let retryAt = 0;

	const sync = async () => {
		if (busy) return;
		busy = true;
		try {
			const next = budgets(config);
			publish(config, original);
			if (next === acted || Date.now() < retryAt) return;
			// Publish first, then remount, so the row reads the environment this save produced. The
			// pair is only recorded as acted once the row came back, so a failed restart is retried.
			if (await respawn(ctx)) acted = next;
			else retryAt = Date.now() + RETRY_MS;
		} finally {
			busy = false;
		}
	};

	publish(config, original);

	// `exit` empties the inherited store for everything created inside it, which is what lets the
	// restart request out of the transaction this row was mounted in.
	const hmr = ctx.get("hmr");
	const watch = () => {
		const timer = setInterval(() => {
			void sync();
		}, WATCH_MS);
		return () => {
			clearInterval(timer);
		};
	};
	ctx.effect(
		() => (typeof hmr?.executing?.exit === "function" ? hmr.executing.exit(watch) : watch()),
		"mcp-illustrator: publish timeouts",
	);
}
//#endregion
