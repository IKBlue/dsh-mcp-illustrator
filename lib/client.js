window.__ModuleLoader__.load({
	id: "dsh-mcp-illustrator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");

		const NS = "mcp-illustrator-timeouts";

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

		function Probe(props) {
			const rows = ["dsh-mcp-illustrator - browser-half probe", "ns: " + NS, ""]
				.concat(notes)
				.concat([
					"",
					"props keys: " + Object.keys(props || {}).join(", "),
					"view: " + String(props && props.view),
				]);
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
			note("configForms.get(NS)", () => ctx.configForms && ctx.configForms.get(NS));

			ctx.slots.inject("plugins.item", () =>
				ctx.slots.register(
					{ name: "plugins.item", id: NS, order: 10, label: () => "Illustrator timeouts" },
					Probe,
				),
			);
		}

		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
