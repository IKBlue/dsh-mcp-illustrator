//#region lib/index.js
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * `@deepseek-ai/schemastery` is application-internal. This profile's node_modules never contains it
 * — nothing here declares it, and the hoisted layout proves it (see .modules.yaml) — so importing it
 * by bare name fails with ERR_MODULE_NOT_FOUND from this package's own directory. That failure takes
 * the whole row down, and a failed host row takes the web boot with it ("1 entry did not activate"),
 * which is what re-initialised this profile's patch layer and cost it its rows.
 *
 * The installation's own copy is what this schema must be built from, so it is resolved by absolute
 * path instead of by name.
 */
const resources = process.resourcesPath;
if (resources === undefined) {
	throw new Error("dsh-mcp-illustrator: process.resourcesPath is undefined — this host half must run inside the Harness installation");
}
const schemastery = await import(pathToFileURL(join(resources, "app.asar", "dsh", "node_modules", "@deepseek-ai", "schemastery", "lib", "index.mjs")).href);
const z = schemastery.default ?? schemastery;

/**
 * Host half: the two cold-start budgets of the Illustrator MCP server.
 *
 * Three Loader behaviours shape this file, and each one was learned the hard way:
 *
 * - `dsh-settings` serves a settings namespace only for an entry whose schema declares a
 *   `volatile()` field (`describe()` drops every entry whose `volatileForm` is undefined), so
 *   without volatility the configuration page simply never appears.
 * - A change that touches only volatile fields is committed into the running fiber's references
 *   instead of remounting the entry (`Entry._commitVolatile`), so a save never re-runs `apply` and
 *   there is no callback to await: the numbers have to be watched.
 * - The MCP row's `!!js` env expressions are evaluated during the Loader's prepare pass, before any
 *   row is mounted, so publishing an environment value and remounting that row is the only way a
 *   saved budget can reach the server (which reads `ILLUSTRATOR_MCP_TIMEOUT_*` once, at startup).
 */

/** Patch id of the row that has to be mounted again for a new budget to apply. */
const MCP_ROW = "mcp-illustrator";

/** Defaults, mirrored from the schema below. Also the state the first watcher tick compares against. */
const DEFAULTS = [180000, 180000];

/** Environment variable each budget maps to, and the config field it comes from. */
const CHANNELS = [
	{ key: "ILLUSTRATOR_MCP_TIMEOUT_NORMAL", field: "normal" },
	{ key: "ILLUSTRATOR_MCP_TIMEOUT_HEAVY", field: "heavy" },
];

/** How often the Refs are re-read. A volatile save has no callback, so this is the only signal. */
const WATCH_MS = 300;

/** How long to wait after a failed restart before asking again, so a failure cannot become a loop. */
const RETRY_MS = 10000;

export const Config = z.object({
	normal: z.number().step(1).min(1).default(DEFAULTS[0]).volatile(),
	heavy: z.number().step(1).min(1).default(DEFAULTS[1]).volatile(),
});

/** A volatile field arrives as a Ref on the resolved config; anything else arrives as a value. */
const read = (field) => (typeof field?.get === "function" ? field.get() : field);

/** The page is the only owner of these numbers: what it shows is what the server is given. */
function publish(config) {
	for (const { key, field } of CHANNELS) {
		const value = read(config?.[field]);
		if (typeof value === "number") process.env[key] = String(value);
	}
}

/** The budgets as one string, for change detection. */
const budgets = (config) => CHANNELS.map(({ field }) => read(config?.[field])).join("/");

/**
 * Mount the MCP row again so its env expressions are re-evaluated against the environment above.
 *
 * There is no "restart this row" call, and the manager ignores a request that does not change a
 * row's state, so the row is disabled and re-enabled. The enable is verified and retried because
 * stopping at a disabled row would cost all 66 Illustrator tools.
 *
 * This runs here rather than in the browser half because a client plugin reaches `pluginManager`
 * only through the remote gateway, which mounts the package faces a client package declares for
 * itself; from this bundle that call is accepted and then never answered, which reads as a hang.
 *
 * @param ctx - this row's plugin context.
 * @returns whether the row came back enabled.
 */
async function respawn(ctx) {
	const manager = ctx.get("pluginManager");
	const find = async () => {
		const rows = await manager.listPlugins();
		return Array.isArray(rows) ? rows.find((row) => row.patchId === MCP_ROW) : undefined;
	};
	try {
		const row = await find();
		if (row?.entryId === undefined || row.readOnlyReason !== undefined) return false;
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
			enabled = (await find())?.enabled !== false;
		}
		return enabled;
	} catch {
		return false;
	}
}

/** Watch the budgets, keep the environment in step, and remount the MCP row when they move. */
export function apply(ctx, config) {
	// Seeded with the defaults, not with the mounted config: the prepare pass above evaluated the
	// env expressions before this row could publish anything, so a persisted non-default budget
	// started the process on the wrong value and the first tick has to correct it.
	let acted = DEFAULTS.join("/");
	let busy = false;
	let retryAt = 0;

	const sync = async () => {
		if (busy) return;
		busy = true;
		try {
			const next = budgets(config);
			publish(config);
			if (next === acted || Date.now() < retryAt) return;
			if (await respawn(ctx)) acted = next;
			else retryAt = Date.now() + RETRY_MS;
		} finally {
			busy = false;
		}
	};

	publish(config);

	// `executing.exit` empties the inherited store for everything created inside it. Without it the
	// watcher keeps the transaction this row was mounted in for the rest of its life, and every
	// restart would be refused: `runExclusive` rejects a caller that is already inside one, which is
	// what `configEditor` and the plugin manager both use. DSH escapes its own watcher the same way.
	const { executing } = ctx.get("hmr");
	ctx.effect(
		() => executing.exit(() => {
			const timer = setInterval(() => {
				void sync();
			}, WATCH_MS);
			return () => {
				clearInterval(timer);
			};
		}),
		"mcp-illustrator: budgets",
	);
}
//#endregion
