window.__ModuleLoader__.load({
	id: "dsh-mcp-illustrator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let jsx_runtime = require("react/jsx-runtime");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		/**
		 * The key the Plugins page dispatches for this row: `<bundle package>#<row id>`, built by
		 * `rowConfigKey` in @deepseek-ai/dsh-client-ui-plugin-manager. A mismatch registers the page
		 * under a key nobody dispatches, which looks exactly like having no page at all.
		 */
		const KEY = "dsh-mcp-illustrator#mcp-illustrator-timeouts";
		/** The settings namespace the Host serves for this row (the row id). */
		const NS = "mcp-illustrator-timeouts";
		/** Patch id of the MCP client row whose environment carries the budgets. */
		const MCP_ROW = "mcp-illustrator";
		/**
		 * Wait before respawning the MCP row. The Host half publishes a saved budget to its own
		 * process environment on a 300 ms watcher — a volatile save commits into the running
		 * references without remounting, so there is no callback to await — and the row's `!!js`
		 * env expressions read that environment when they are re-evaluated.
		 */
		const PUBLISH_GRACE_MS = 1200;

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
			applying: "Saved. Restarting the Illustrator MCP server…",
			applied: "Saved, and the Illustrator MCP server was restarted with the new budgets.",
			applyUnavailable: "Saved, but this page cannot reach the plugin manager. Restart DSH to apply the budgets.",
			applyRowMissing: "Saved, but the Illustrator MCP row was not found. Restart DSH to apply the budgets.",
			applyReadOnly: "Saved, but the Illustrator MCP row is not remotely manageable here. Restart DSH to apply the budgets.",
			applyFailed: "Saved, but restarting the Illustrator MCP server failed. Retry the save, or reopen Illustrator's entry in the plugin list.",
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
			applying: "已保存。正在重启 Illustrator MCP 服务器…",
			applied: "已保存，Illustrator MCP 服务器已带着新预算重启。",
			applyUnavailable: "已保存，但本页访问不到插件管理器。重启 DSH 后预算才会生效。",
			applyRowMissing: "已保存，但没找到 Illustrator MCP 那一行。重启 DSH 后预算才会生效。",
			applyReadOnly: "已保存，但这里无法远程管理 Illustrator MCP 那一行。重启 DSH 后预算才会生效。",
			applyFailed: "已保存，但重启 Illustrator MCP 服务器失败。请再保存一次，或在插件列表里重新打开 Illustrator 条目。",
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

		/** Copy for the outcome of the apply step, or null when there is nothing to report. */
		function outcomeText(t, outcome) {
			switch (outcome) {
				case null:
				case undefined:
					return null;
				case "ok":
					return { text: t("applied"), tone: "ok" };
				case "unavailable":
					return { text: t("applyUnavailable"), tone: "warn" };
				case "row-missing":
					return { text: t("applyRowMissing"), tone: "warn" };
				case "read-only":
					return { text: t("applyReadOnly"), tone: "warn" };
				default:
					return { text: t("applyFailed"), tone: "error" };
			}
		}

		/**
		 * Respawn the MCP client row, which is what makes a saved budget reach the server: the row's
		 * `!!js` env expressions are re-evaluated when it is mounted again.
		 *
		 * The plugin manager offers no "restart this row" call, and it refuses to touch a row that is
		 * already in the requested state, so a restart is a disable followed by an enable. The enable
		 * is verified and retried: stopping at a disabled row would cost all 66 Illustrator tools.
		 *
		 * @param ctx - this page's plugin context, whose `remote.pluginManager` namespace answers.
		 * @returns a stable outcome code the card renders.
		 */
		async function respawn(ctx) {
			const manager = ctx.remote === void 0 ? void 0 : ctx.remote.pluginManager;
			if (manager === void 0) return "unavailable";
			try {
				const find = async () => {
					const rows = await manager.listPlugins();
					return Array.isArray(rows) ? rows.find((row) => row.patchId === MCP_ROW) : void 0;
				};
				const row = await find();
				if (row === void 0 || row.entryId === void 0) return "row-missing";
				if (row.readOnlyReason !== void 0) return "read-only";
				// An already-disabled row is repaired by the enable below rather than skipped: the
				// disable half exists only to force a state change the manager would otherwise ignore.
				if (row.enabled !== false) await manager.setPluginEnabled(row.entryId, false);

				let enabled = false;
				for (let attempt = 0; attempt < 3 && !enabled; attempt += 1) {
					try {
						await manager.setPluginEnabled(row.entryId, true);
					} catch (error) {
						if (attempt === 2) throw error;
					}
					const after = await find();
					enabled = after !== void 0 && after.enabled !== false;
				}
				return enabled ? "ok" : "failed";
			} catch (error) {
				return "failed";
			}
		}

		/** The settings form. */
		function Card(props) {
			const { t } = props;
			const state = props.useIllustratorTimeoutsCard((snapshot) => snapshot);
			if (props.view === "summary") return t("description");
			const disabled = !state.writable;
			const outcome = outcomeText(t, state.outcome);
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
					state.applying || outcome !== null ? jsx_runtime.jsx("p", {
						role: "status",
						style: {
							margin: "0",
							fontSize: "13px",
							lineHeight: "20px",
							color: outcome === null ? "var(--dsw-alias-label-tertiary)" : outcome.tone === "error" ? "var(--dsw-alias-state-error-primary)" : outcome.tone === "warn" ? "var(--dsw-alias-state-warning-primary)" : "var(--dsw-alias-state-success-primary)",
						},
						children: state.applying ? t("applying") : outcome.text,
					}) : null,
				],
			});
		}

		/**
		 * The page's staged form over the timeouts entry, plus the apply step that respawns the MCP row.
		 *
		 * The save is driven through the model rather than through `SettingsForm`'s callback because
		 * `actions().save` returns nothing and the apply step has to wait for the write to land.
		 */
		var TimeoutsCard = class {
			ctx;
			form;
			store;
			actions;
			outcome = null;
			applying = false;

			/** @param ctx - this page's plugin context. @param scope - the shared form for the namespace. */
			constructor(ctx, scope) {
				this.ctx = ctx;
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
					applying: this.applying,
					outcome: this.outcome,
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
						this.outcome = null;
						this.actions.edit(field, text);
					},
					resetField: (field) => {
						this.outcome = null;
						this.actions.resetField(field);
					},
					discard: () => {
						this.outcome = null;
						this.actions.discard();
						this.form.publish();
					},
					save: () => {
						void this.save();
					},
				};
			}

			/** Write the staged budgets, then respawn the row that carries them to the server. */
			async save() {
				this.outcome = null;
				this.applying = false;
				this.form.publish();
				await this.form.save();
				if (this.form.shell().failed) {
					this.form.publish();
					return;
				}
				this.applying = true;
				this.form.publish();
				await new Promise((resolve) => {
					setTimeout(resolve, PUBLISH_GRACE_MS);
				});
				this.outcome = await respawn(this.ctx);
				this.applying = false;
				this.form.publish();
			}

			/** Release the form subscription. */
			dispose() {
				this.form.dispose();
			}
		};

		/** Required services (cordis fiber inject). `configForms` is provided by dsh-client-ui-settings. */
		const inject = ["slots", "locale", "configForms", "remote"];

		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "mcp-illustrator: dictionaries");

			const card = new TimeoutsCard(ctx, ctx.configForms.get(NS));
			ctx.effect(() => () => {
				card.dispose();
			}, "mcp-illustrator: form subscription");

			// The shipped pages gate their registration on the namespace actually being served, so a
			// deployment that does not serve it shows no trace of this page.
			ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
				name: "plugins.row.config",
				key: KEY,
				locale: NS,
				inject: () => card.inject(),
			}, Card))), "mcp-illustrator: page");
		}

		exports.KEY = KEY;
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
