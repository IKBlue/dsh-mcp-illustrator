//#region lib/index.js
/**
 * Host half.
 *
 * Contributes the Config schema for the `mcp-illustrator-timeouts` row. That schema is what
 * makes the row configurable: the settings provider derives a namespace from an entry's
 * Config, and the Plugins page supplies a form for a row only when its id appears among the
 * served namespaces (`formFor` in @deepseek-ai/dsh-client-ui-plugin-manager returns
 * `undefined` otherwise). A probe confirmed that without a schema `props.form` is undefined
 * for this row.
 *
 * `@deepseek-ai/schemastery` is an application-internal package, so the import is done
 * dynamically and allowed to fail: on a resolution failure the schema is simply absent
 * (the row still activates and everything else keeps working) instead of taking the row
 * down with it. The page reports which of the two happened.
 */
let z = null;
try {
	const mod = await import("@deepseek-ai/schemastery");
	z = mod.default ?? mod;
} catch {
	z = null;
}

/** Schema present only when schemastery resolved; see the note above. */
export const Config = z === null
	? undefined
	: z.object({
		normal: z.number().step(1).min(1).default(180000),
		heavy: z.number().step(1).min(1).default(180000),
	});

/** Nothing to run: this row exists so the configuration page has something to configure. */
export function apply() {}
//#endregion
