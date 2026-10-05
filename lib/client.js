window.__ModuleLoader__.load({
	id: "dsh-mcp-illustrator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");

		// `<the bundle that declares the row>#<row id>`. The row is declared by this
		// package's own cordis.patch.yml (`- id: mcp-illustrator-timeouts`), which is why
		// the prefix is this package's name.
		const KEY = "dsh-mcp-illustrator#mcp-illustrator-timeouts";

		// Diagnostics are collected in apply() and rendered by the card, so the page shows
		// what the browser context actually has instead of asserting what it should have.
		const notes = [];
		function note(label, fn) {
			try {
				const v = fn();
				let d;
				if (v === undefined) d = "undefined";
				else if (v === null) d = "null";
				else if (typeof v === "object") d = "object { " + Object.keys(v).join(", ") + " }";
				else d = typeof v + " " + String(v);
				notes.push(label + " -> " + d);
			} catch (e) {
				notes.push(label + " -> THREW " + String(e && e.message));
			}
		}

		function describe(v) {
			try {
				if (v === null) return "null";
				if (v === undefined) return "undefined";
				const t = typeof v;
				if (t === "function") return "function/" + v.length + " args";
				if (Array.isArray(v)) return "array[" + v.length + "]";
				if (t === "object") return "object{ " + Object.keys(v).join(", ") + " }";
				return t + " " + JSON.stringify(v);
			} catch (e) {
				return "<unreadable: " + String(e && e.message) + ">";
			}
		}

		function Probe(props) {
			if (props && props.view === "summary") return "timeout probe";

			const rows = ["dsh-mcp-illustrator - plugins.row.config probe", "key: " + KEY, ""]
				.concat(notes)
				.concat(["", "props keys: " + Object.keys(props || {}).join(", "), "view: " + String(props && props.view)]);

			const form = props && props.form;
			rows.push("typeof form: " + describe(typeof form));
			if (form && typeof form === "object") {
				rows.push("form keys: " + describe(Object.keys(form)));
				for (const k of Object.keys(form)) {
					const v = form[k];
					rows.push("  form." + k + " : " + describe(v));
					if (v && typeof v === "object" && !Array.isArray(v)) {
						rows.push("      keys: " + describe(Object.keys(v)));
					}
				}
			}

			return react.createElement(
				"div",
				{
					style: {
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						fontSize: "12px",
						lineHeight: "1.5",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						padding: "8px 0",
					},
				},
				rows.map((r, i) => react.createElement("div", { key: i }, r)),
			);
		}

		const inject = ["slots"];

		function apply(ctx) {
			note("typeof ctx.slots", () => typeof ctx.slots);
			note("typeof ctx.configForms", () => typeof ctx.configForms);
			note("ctx.configForms keys", () => ctx.configForms && Object.keys(ctx.configForms));
			note("typeof configForms.get", () => typeof (ctx.configForms && ctx.configForms.get));
			note("typeof configForms.whileServed", () => typeof (ctx.configForms && ctx.configForms.whileServed));

			// `plugins.row.config`, not `plugins.item`: the latter holds the plugins this
			// installation ships and is rendered by the ids in that list, so a contribution
			// under any other id is never asked for its card.
			ctx.slots.inject("plugins.row.config", () =>
				ctx.slots.register({ name: "plugins.row.config", key: KEY }, Probe),
			);
		}

		exports.KEY = KEY;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
