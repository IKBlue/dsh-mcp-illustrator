window.__ModuleLoader__.load({
	id: "dsh-mcp-illustrator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");

		// The row this page configures: `<package name>#<row id>`, with the row id as this
		// bundle's patch declares it (`- id: mcp-illustrator`).
		const KEY = "dsh-mcp-illustrator#mcp-illustrator";

		/** Render a value as a short, non-throwing description. */
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

		/** A bounded JSON snapshot, so a huge config cannot flood the panel. */
		function snapshot(v) {
			try {
				return JSON.stringify(v).slice(0, 600);
			} catch (e) {
				return "<not serialisable>";
			}
		}

		function lines(props) {
			const out = [];
			out.push("props keys: " + describe(Object.keys(props || {})));
			out.push("view: " + describe(props && props.view));

			const hooks = Object.keys(props || {}).filter((k) => k.startsWith("use"));
			out.push("hooks on props: " + (hooks.length ? hooks.join(", ") : "(none)"));
			for (const h of hooks) out.push("   " + h + " : " + describe(props[h]));

			const form = props && props.form;
			out.push("");
			out.push("typeof form: " + describe(typeof form));
			if (form && typeof form === "object") {
				out.push("form keys: " + describe(Object.keys(form)));
				for (const k of Object.keys(form)) {
					const v = form[k];
					out.push("  form." + k + " : " + describe(v));
					if (v && typeof v === "object" && !Array.isArray(v)) {
						out.push("      keys: " + describe(Object.keys(v)));
						out.push("      json: " + snapshot(v));
					}
				}
			} else if (form === undefined) {
				out.push("form is undefined — the page owner supplies it only when the entry");
				out.push("exposes editable Config fields; if it stays undefined this page has");
				out.push("to own its values and its write path.");
			}
			return out;
		}

		/**
		 * Probe renderer.
		 *
		 * The documented owner props for this slot are
		 * `PluginConfigViewProps { view, form?: ConfigPageForm }`. `ConfigPageForm` — the
		 * host-owned values and `mutate(operations, expectedRevision)` write action — is only
		 * ever *referenced* in the shipped client code; its definition is not in the packaged
		 * artifacts. So the operations shape is read off a live page instead of guessed at:
		 * a wrong shape would save nothing while looking like it worked.
		 */
		function Probe(props) {
			if (props && props.view === "summary") return "timeout probe";

			const rows = ["dsh-mcp-illustrator — plugins.row.config probe", "key: " + KEY, ""]
				.concat(lines(props));

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
			ctx.slots.inject("plugins.row.config", () =>
				ctx.slots.register(
					{ name: "plugins.row.config", key: KEY },
					Probe,
				),
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
