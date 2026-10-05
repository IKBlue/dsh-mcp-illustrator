window.__ModuleLoader__.load({
	id: "dsh-mcp-illustrator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let jsx_runtime = require("react/jsx-runtime");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		const KEY = "dsh-mcp-illustrator#mcp-illustrator-timeouts";
		const NS = "mcp-illustrator-timeouts";

		const en = {
			title: "Illustrator",
			description: "Cold-start timeouts for the Illustrator MCP server.",
			normal: "Normal timeout (ms)",
			normalHint: "How long an ordinary tool call may wait. Cold-starting Illustrator is what this budget has to cover.",
			heavy: "Heavy timeout (ms)",
			heavyHint: "Budget for the export, PDF and preflight calls.",
			overridden: "Overridden",
			reset: "Reset to default",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			invalidNumber: "Enter a number, or leave blank to use the default.",
		};
		const zh = {
			title: "Illustrator",
			description: "Illustrator MCP 服务器的冷启动超时。",
			normal: "常规超时（毫秒）",
			normalHint: "普通工具调用允许等待多久；冷启动 Illustrator 必须落在这个预算内。",
			heavy: "重度超时（毫秒）",
			heavyHint: "导出、PDF、预检这类调用的预算。",
			overridden: "已覆盖",
			reset: "恢复默认",
			readOnly: "本部署的设置为只读。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			invalidNumber: "请填数字；留空表示使用默认值。",
		};

		function formLabels(t) {
			return {
				unavailable: t("unavailable"),
				readOnly: t("readOnly"),
				saveFailed: t("saveFailed"),
				save: t("save"),
				saving: t("saving"),
			};
		}

		const notes = [];
		function note(label, fn) {
			try {
				const v = fn();
				let d;
				if (v === undefined) d = "undefined";
				else if (v === null) d = "null";
				else if (typeof v === "function") d = "function/" + v.length;
				else if (typeof v === "object") d = "object[" + Array.from(v).join(", ") + "]";
				else d = typeof v + " " + String(v);
				notes.push(label + " -> " + d);
			} catch (e) {
				notes.push(label + " -> THREW " + String(e && e.message));
			}
		}

		function Diagnostics() {
			if (notes.length === 0) return null;
			return jsx_runtime.jsxs("div", {
				style: {
					marginTop: "24px",
					borderTop: "1px solid #ddd",
					paddingTop: "8px",
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
					fontSize: "11px",
					lineHeight: "1.6",
					opacity: 0.75,
					whiteSpace: "pre-wrap",
				},
				children: [
					jsx_runtime.jsx("div", { children: "diagnostics (temporary)" }),
					...notes.map((n, i) => jsx_runtime.jsx("div", { children: n }, i)),
				],
			});
		}

		/** The settings form, mirroring @deepseek-ai/dsh-client-ui-settings-shell. */
		function Card(props) {
			const { t } = props;
			const state = props.useIllustratorTimeoutsCard((snapshot) => snapshot);
			if (props.view === "summary") return t("description");
			const disabled = !state.writable;
			return jsx_runtime.jsxs("div", {
				children: [
					jsx_runtime.jsxs(primitives.SettingsForm, {
						labels: formLabels(t),
						state,
						onSave: props.save,
						onDiscard: props.discard,
						children: [
							jsx_runtime.jsx(primitives.SettingsValueField, {
								id: "plugin-config-illustrator-normal",
								label: t("normal"),
								hint: t("normalHint"),
								overriddenLabel: t("overridden"),
								resetLabel: t("reset"),
								invalidLabel: t("invalidNumber"),
								numeric: true,
								disabled,
								...state.normal,
								onEdit: (text) => {
									props.edit("normal", text);
								},
								onReset: () => {
									props.resetField("normal");
								},
							}),
							jsx_runtime.jsx(primitives.SettingsValueField, {
								id: "plugin-config-illustrator-heavy",
								label: t("heavy"),
								hint: t("heavyHint"),
								overriddenLabel: t("overridden"),
								resetLabel: t("reset"),
								invalidLabel: t("invalidNumber"),
								numeric: true,
								disabled,
								...state.heavy,
								onEdit: (text) => {
									props.edit("heavy", text);
								},
								onReset: () => {
									props.resetField("heavy");
								},
							}),
						],
					}),
					jsx_runtime.jsx(Diagnostics, {}),
				],
			});
		}

		const inject = ["slots", "locale", "configForms"];

		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "mcp-illustrator: dictionaries");

			note("whileServed", () => typeof ctx.configForms.whileServed);
			note("scopes", () => {
				const out = [];
				for (const k of Object.keys(ctx.configForms)) {
					const sc = ctx.configForms[k];
					if (sc === null || typeof sc !== "object") {
						out.push(k + ":" + typeof sc);
						continue;
					}
					const spec = sc.spec;
					out.push(k + ":" + (spec === undefined ? "no spec" : JSON.stringify(spec).slice(0, 120)));
				}
				return out;
			});

			// The shipped page gates registration on the namespace actually being served
			// (`configForms.whileServed`). Registering unconditionally hands the form a scope
			// that is not served yet, and the frame then reports `available: false`.
			ctx.effect(() => ctx.configForms.whileServed([NS], (served) => {
				note("served", () => {
					const out = [];
					for (const ns of served) out.push(ns);
					return out.length ? out : ["(none)"];
				});
				note("served.has(NS)", () => served.has(NS));

				let face = {};
				try {
					const scope = ctx.configForms.get(NS);
					const form = new primitives.SettingsFormModel(scope, [
						primitives.settingsNumberField("normal"),
						primitives.settingsNumberField("heavy"),
					]);
					const store = form.bind(() => ({
						...form.shell(),
						normal: form.field("normal"),
						heavy: form.field("heavy"),
					}));
					ctx.effect(() => () => form.dispose(), "mcp-illustrator: form subscription");
					face = { hooks: { illustratorTimeoutsCard: store }, ...form.actions() };
					note("form built", () => "ok");
				} catch (e) {
					notes.push("form build -> THREW " + String(e && e.message));
				}

				return ctx.slots.inject("plugins.row.config", () =>
					ctx.slots.register(
						{ name: "plugins.row.config", key: KEY, locale: NS, inject: () => face },
						Card,
					),
				);
			}), "mcp-illustrator: page");
		}

		exports.KEY = KEY;
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
