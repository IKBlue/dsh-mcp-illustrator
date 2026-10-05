window.__ModuleLoader__.load({
	id: "dsh-mcp-illustrator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let jsx_runtime = require("react/jsx-runtime");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		/** The settings namespace the Host serves for this row (the row id). */
		const NS = "mcp-illustrator-timeouts";
		/** This bundle's package name, which is the key `plugins.bundle.config` is dispatched under. */
		const BUNDLE = "dsh-mcp-illustrator";

		const en = {
			title: "Illustrator",
			description: "Cold-start budgets for the Illustrator MCP server.",
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
			applied: "Saved. The Illustrator MCP server is being restarted, so its tools blink for a moment.",
		};
		const zh = {
			title: "Illustrator",
			description: "Illustrator MCP 服务器的冷启动预算。",
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
			applied: "已保存。插件正在重启 Illustrator MCP 服务器，工具会短暂消失后回来。",
		};

		/** The form frame's copy, read from this page's dictionary. */
		function formLabels(t) {
			return {
				unavailable: t("unavailable"),
				readOnly: t("readOnly"),
				saveFailed: t("saveFailed"),
				save: t("save"),
				saving: t("saving"),
			};
		}

		/** The settings form. Writing the numbers is this half's whole job; the restart is the host half's. */
		function Card(props) {
			const { t } = props;
			const state = props.useIllustratorTimeoutsCard((snapshot) => snapshot);
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
					state.saved ? jsx_runtime.jsx("p", {
						role: "status",
						style: {
							margin: "0",
							fontSize: "13px",
							lineHeight: "20px",
							color: "var(--dsw-alias-label-tertiary)",
						},
						children: t("applied"),
					}) : null,
				],
			});
		}

		/**
		 * The page's staged form over the timeouts entry.
		 *
		 * The save goes through the model rather than `SettingsForm`'s callback because
		 * `actions().save` returns nothing and the note below waits for the write to land.
		 */
		var TimeoutsCard = class {
			form;
			store;
			actions;
			saved = false;

			/** @param scope - the shared form for the namespace. */
			constructor(scope) {
				this.form = new primitives.SettingsFormModel(scope, [
					primitives.settingsNumberField("normal"),
					primitives.settingsNumberField("heavy"),
				]);
				this.actions = this.form.actions();
				this.store = this.form.bind(() => this.projection());
			}

			projection() {
				return {
					...this.form.shell(),
					normal: this.form.field("normal"),
					heavy: this.form.field("heavy"),
					saved: this.saved,
				};
			}

			/**
			 * Build the face this page's slot registration injects.
			 * @returns the page's snapshot and its actions.
			 */
			inject() {
				return {
					hooks: { illustratorTimeoutsCard: this.store },
					edit: (field, text) => {
						this.saved = false;
						this.actions.edit(field, text);
					},
					resetField: (field) => {
						this.saved = false;
						this.actions.resetField(field);
					},
					discard: () => {
						this.saved = false;
						this.actions.discard();
						this.form.publish();
					},
					save: () => {
						void this.save();
					},
				};
			}

			/** Write the staged budgets; the host half notices and restarts the MCP server. */
			async save() {
				this.saved = false;
				this.form.publish();
				await this.form.save();
				if (this.form.shell().failed) {
					this.form.publish();
					return;
				}
				this.saved = true;
				this.form.publish();
			}

			/** Whether the Host serves this namespace, as the form itself sees it. */
			available() {
				return this.form.shell().available;
			}

			/** Release the form subscription. */
			dispose() {
				this.form.dispose();
			}
		};

		/** Required services (cordis fiber inject). `configForms` is provided by dsh-client-ui-settings. */
		const inject = ["slots", "locale", "configForms"];

		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "mcp-illustrator: dictionaries");

			const card = new TimeoutsCard(ctx.configForms.get(NS));
			ctx.effect(() => () => {
				card.dispose();
			}, "mcp-illustrator: form subscription");

			// One place only: the bundle's own page, keyed by the package name, which the plugin manager
			// renders between the description and the rows. Registering the row as well put the same form
			// in two places (bundle page and row page) for no gain.
			ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: BUNDLE,
				locale: NS,
				inject: () => card.inject(),
			}, Card));

			// The served-namespace directory is read once and afterwards only refreshed on demand, and
			// this bundle's row is activated *after* the rows the shipped pages hang off. The first read
			// can therefore predate this namespace and leave the form reporting itself unavailable for
			// the rest of the session. Ask for one; the mirror publishes into the form's own scope.
			const mirror = ctx.configForms.describe();
			mirror.load();
			const retry = setTimeout(() => {
				if (!card.available()) mirror.load();
			}, 2000);
			ctx.effect(() => () => clearTimeout(retry), "mcp-illustrator: directory retry");
		}

		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
