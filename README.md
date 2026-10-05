# dsh-mcp-illustrator

A DSH **bundle** that connects [`illustrator-mcp-server`](https://github.com/ie3jp/illustrator-mcp-server)
(Adobe Illustrator, 66 MCP tools) to the Harness profile you install it into.

Two files, no build step, no Host/Client entry code.

## Why this exists

Wiring an MCP server into DSH by hand means pasting a config row full of
absolute paths into a profile file. That works on exactly one machine:

- the paths point at wherever the server happened to be cloned or unpacked
- upgrading the server is a manual `npm install` in that directory
- it never appears in the plugin manager, so install and uninstall leave no
  trace and nothing can report *why* it failed
- a second machine cannot reproduce it — which defeats the point of keeping a
  configuration at all

The goal here is to move that from a hand-edited config to a **package**, so a
machine that has never seen this repository gets a working server with one
command and no path written down anywhere:

```
plugin_manager install_bundle → https://github.com/IKBlue/dsh-mcp-illustrator.git
```

- the server resolves from the profile that installed the bundle, not a fixed path
- the Node interpreter is the Harness's own executable, so nothing must be on PATH
- upgrading is one version range; uninstalling is one command with no residue
- the plugin manager can list it, toggle it, and report why it failed

That goal is why the two details below are load-bearing rather than stylistic.

## Install

Requires the plugin-manager tool. It ships disabled in `dsh-base`
(`tool-plugin-manager`, `disabled: true`); enable it in the profile patch, or
use a preset that carries it:

```yaml
- id: tool-plugin-manager
  disabled: false
```

Then let the manager do the package install and the bundle selection — do not
reproduce those steps by hand:

```
plugin_manager({ action: "install_bundle", target: "https://github.com/IKBlue/dsh-mcp-illustrator.git" })
```

or, from a shell:

```
dsh plugin --profile <profile> add https://github.com/IKBlue/dsh-mcp-illustrator.git
```

Spec forms accepted: an npm name, an absolute directory, a git URL, or a
tarball. **Prefer git / npm / tarball** — a local directory is linked rather
than installed, so the dependency never arrives (see below).

A live profile applies the install immediately (`"application": "applied"`);
`dsh plugin add` from a shell does not notify the manager service, so a shell
install waits for the next restart.

Then verify with the newly available tools — `mcp__illustrator__get_document_info`,
`mcp__illustrator__list_fonts`, and 64 others.

## Uninstall

```
plugin_manager({ action: "remove_bundle", ... })
```

## Why there are no absolute paths

Everything machine-specific is resolved at activation time:

| Field | Value | Why it travels |
|---|---|---|
| `command` | `!!js process.execPath` | The Harness executable run with `ELECTRON_RUN_AS_NODE=1` **is** a Node interpreter. Verified: reports `node v24.18.1` and runs this server. No "Node must be on PATH" prerequisite. |
| `args[0]` | `!!js ctx.get('profileContext').dir + '/node_modules/illustrator-mcp-server/dist/index.js'` | `ctx.profileContext` is the app-boot service carrying the profile's locations; `.dir` is its profile directory. The server is a declared dependency, so the installing profile has it under its own `node_modules`. |
| `cwd` | same directory | The server writes per-call scratch files there. |

### Do not use `process.env.DSH_PROFILE_DIR` here

It is the obvious-looking choice and it is wrong. `DSH_PROFILE` /
`DSH_PROFILE_DIR` are injected into **shell calls** by
`@deepseek-ai/dsh-shell-env`; they are not part of the host process
environment. Reading one gives `undefined`, and because `undefined + '…'` is a
valid string the expression still evaluates — so nothing reports a config
error. The bundle loads, the row mounts, and it fails only at spawn:

```
{"entryId":"include:mcp-illustrator","enabled":true,"fiberPhase":"failed"}
```

`fiberPhase: failed` on an otherwise healthy-looking row is that signature.
Use `plugin_manager list_plugins` to see it — it is the only place the failure
is visible, since the desktop profile writes no host log, `dsh --dump-config`
refuses ("managed exclusively by the Electron application"), and a failed row
simply contributes no tools.

**Assumption:** the profile's pnpm `nodeLinker` is `hoisted`, so the dependency
lands at `<profile>/node_modules/illustrator-mcp-server`. If a profile ever
nests it, the path becomes
`<profile>/node_modules/dsh-mcp-illustrator/node_modules/illustrator-mcp-server/dist/index.js`.

### The configuration page, and why it needs a `volatile` field

The Illustrator row on the Plugins page carries a form with the two cold-start budgets, the same
shape the shell executor's 终端 page uses. Three separate facts make it work, and each one was a
failure mode first:

| Fact | What breaks without it |
|---|---|
| `dsh.client.inject` in `package.json` lists `@deepseek-ai/dsh-client-ui-settings`, not `dsh-client-ui-primitives` | the browser half never loads. `primitives` is a pure React atom library with no `dsh.client` block, so it cannot be an injection edge; `ui-settings` is what *provides* the `ctx.configForms` service this page injects |
| `normal` and `heavy` are declared `volatile()` in `lib/index.js` | the namespace is never served. `dsh-settings.describe()` drops every entry whose `volatileForm(schema)` is undefined, so `whileServed` never fires and the row shows no configuration at all |
| the browser half respawns the MCP row after a save | the saved numbers never reach the server |

**Saving restarts the Illustrator MCP server.** That is inherent, not incidental: the server reads
`ILLUSTRATOR_MCP_TIMEOUT_*` exactly once, at startup, so a new budget can only apply by mounting the
MCP row again. The page does that by disabling and re-enabling the row through the plugin manager
(there is no "restart this row" call, and the manager ignores a request that does not change a row's
state), then verifies the enable and retries it — stopping at a disabled row would cost all 66 tools.
A save therefore interrupts any tool call in flight, and the next call may pay a cold start.

`volatile` is also why `lib/index.js` watches the two values on a timer: the Loader commits a
volatile change into the running references *without* remounting, so there is no callback to hook.

### Timeouts, and the two routes that set them

The server takes two timeouts from its own environment, and **reads them once, at
server start** — both are module-level constants in
`dist/executor/jsx-runner.js`. A new value therefore needs this row to be
remounted, i.e. the server process respawned.

| Variable | Covers | Server default | This bundle |
|---|---|---|---|
| `ILLUSTRATOR_MCP_TIMEOUT_NORMAL` | every call that does not opt into heavy | 30000 | **180000** |
| `ILLUSTRATOR_MCP_TIMEOUT_HEAVY` | `export`, `export_pdf`, `preflight_check`, plus whatever `tool-executor` routes there | 60000 | 180000 |

- **The page** (recommended). `lib/index.js` publishes each configured budget into the host process
  environment, and the page respawns the MCP row so the `!!js` expressions are re-evaluated.
- **The host environment**, for a budget you never configure on the page:

```powershell
setx ILLUSTRATOR_MCP_TIMEOUT_NORMAL 240000   # applies to the next Harness launch
```

That fallback is deliberately conditional: a budget is published only while it differs from the
180000 default, so a `setx` value still wins as long as the page is left alone. Set the page to
240000 and the page wins; set it back to 180000 and control returns to `setx`.

Two properties of the server worth knowing before tuning:

- It accepts only a positive decimal integer (`/^\d+$/`). **Anything else silently
  falls back to the server default of 30000 — lower than this bundle's value.** A
  malformed value makes things worse, not better. The page rejects a non-finite draft
  rather than saving it.
- `HEAVY` is deliberately kept below the row's `toolCallTimeoutMs` (300000): when
  the inner timeout wins you get the server's actionable "script execution timed
  out" message, which names the variables; when the outer one wins you get a
  generic tool-call timeout.

**Cold start is the case that motivated 180000.** The server launches Illustrator
itself when it is not running. Measured here: with Illustrator not running, a
NORMAL call (`list_fonts`) hit the 60s deadline while Illustrator 29 was still
coming up — the window appeared shortly afterwards. 180000 is margin, not a
measurement of that cold start. If you keep Illustrator running, this never
arises.

## Installing from a local directory does not work

`install_bundle` (and `dsh plugin add`) with an **absolute directory** records
the dependency as `link:`, and pnpm then only symlinks it — **it does not
install that package's dependencies**, so `illustrator-mcp-server` never
arrives and the server path does not exist. Install from a git URL, an npm
name, or a tarball (`pnpm pack`) instead; all three are real installs and pull
the dependency tree into the profile.

## Upgrading the server

The dependency is **pinned** (`"illustrator-mcp-server": "1.10.3"`), so an
install never silently changes server behaviour — these tools drive an external
application over COM, and a minor bump there is a behavioural change, not just a
bug fix.

To upgrade: edit the version, bump this package's `version`, reinstall.

```json
"dependencies": { "illustrator-mcp-server": "1.11.0" }
```

## Surviving a DSH upgrade

This bundle declares **no `@deepseek-ai/dsh*` peer dependency**, deliberately.
DSH compares a plugin's declared DSH peers against the runtime version and skips
incompatible bundles; the shipped rule (translated from the Chinese reference)
is:

> when no DSH peer is declared, no version constraint is applied

So a DSH upgrade will never refuse to load this bundle on version grounds. The
other half of that sentence is the catch: **nothing protects it either.**

The peer route is not a free upgrade, incidentally. Exact-version exemptions
live in the profile's `compatibility.json`, and the docs state that *neither
plugin upgrades nor DSH upgrades inherit an exemption* — so a declared peer
would mean re-granting one on every DSH release. Declaring none avoids that
treadmill.

The trade-off is a **missing compatibility gate**: three seams are load-bearing,
and a change to any of them fails the row at activation rather than at load.

| Seam | Used for | Evidence it is intended, not incidental |
|---|---|---|
| `ctx.get('profileContext').dir` | resolving the server entry | `dsh-app-boot`: "`ctx.profileContext` contains only profile locations…" |
| `@deepseek-ai/dsh-mcp-client` row schema | the entire row | the shipped `cordis-plugin-development` skill's `templates/mcp/` |
| `process.execPath` + `ELECTRON_RUN_AS_NODE=1` | a Node interpreter | `dsh-desktop-host` launches pnpm exactly this way; `dsh-ptc-runtime-node` documents keeping the variable for child startup on purpose |

What to expect after an upgrade, and what each symptom means:

- **Tools gone, row reads `fiberPhase: failed`** → one of the three seams moved.
  Re-run `install_bundle`; if that does not fix it, re-read the current
  `@deepseek-ai/dsh-mcp-client` config schema and the `profileContext` reference.
- **The bundle missing from the plugin list entirely** → a structural failure.
  DSH skips such bundles and reports them in `skippedBundles`, once per launch.

This is why keeping the plugin-manager tool enabled is worth it:
`plugin_manager list_plugins` is the only place a failed row is visible.
Otherwise the first symptom is 66 missing tools and no explanation.

`dsh --dump-config` cannot help — it refuses for the desktop profile ("managed
exclusively by the Electron application").

## Prerequisites

- Adobe Illustrator installed on the machine running the Harness.
  Tested against Illustrator 2022 (v26); the server warns that v28+ is the
  verified baseline but works on older versions.
- **Illustrator is launched by the server when it is not already running.** The
  first call after a cold start can therefore hit the inner timeout while
  Illustrator is still starting up — measured: a NORMAL call timed out at 60000ms
  with Illustrator 29. Start Illustrator first, or raise the normal budget on the
  configuration page (see "The configuration page" above).
- Network access to an npm registry on the machine that installs the bundle
  (the server is fetched as a dependency).

## Adapting this to another npm-published MCP server

The skeleton is the whole recipe — copy these two files and change four things:

1. `package.json` → `name`, `description`, `dependencies`
2. `cordis.patch.yml` → row `id`, `serverName`, and the server's entry path

`serverName` is the tool namespace: `mcp__<serverName>__<tool>`. Keep it unique
per profile.

## Files

```
package.json       manifest; dsh.bundle.patch is what makes this installable,
                   dsh.client.inject is the browser half's load graph
cordis.patch.yml   the Loader patch: inserts the @deepseek-ai/dsh-mcp-client row
                   and this bundle's own configurable row
lib/index.js       host half: the row's volatile Config schema, and the publisher
                   that puts each configured budget into the process environment
lib/client.js      browser half: the configuration page, and the respawn of the
                   MCP row that makes a saved budget reach the server
```

## Credits

**The Illustrator work is not in this repository.** It is
[**ie3jp/illustrator-mcp-server**](https://github.com/ie3jp/illustrator-mcp-server)
by **ie3jp** — a 66-tool MCP server that drives Adobe Illustrator over
PowerShell COM / ExtendScript, MIT licensed, published on npm as
`illustrator-mcp-server`. This bundle installs it as a dependency and adds
nothing to it. It is the thing to star, to thank, and to file Illustrator bugs
against.

If this bundle saves you the config work, the credit belongs upstream: every
interesting problem here — Illustrator's object model, the version differences,
the COM bridge, keeping the artwork intact across an export — is solved there.

Also worth naming: the DSH-side blueprint is the Harness's own shipped skill
`cordis-plugin-development`, specifically `references/mcp-bundle.md` and
`templates/mcp/`. This bundle is that template plus a dependency and a resolved
path; building it from the shipped template is what the docs intend.

