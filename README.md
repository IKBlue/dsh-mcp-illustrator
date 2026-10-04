# dsh-mcp-illustrator

A DSH **bundle** that connects [`illustrator-mcp-server`](https://github.com/ie3jp/illustrator-mcp-server)
(Adobe Illustrator, 66 MCP tools) to the Harness profile you install it into.

Two files, no build step, no Host/Client entry code.

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

## Installing from a local directory does not work

`install_bundle` (and `dsh plugin add`) with an **absolute directory** records
the dependency as `link:`, and pnpm then only symlinks it — **it does not
install that package's dependencies**, so `illustrator-mcp-server` never
arrives and the server path does not exist. Install from a git URL, an npm
name, or a tarball (`pnpm pack`) instead; all three are real installs and pull
the dependency tree into the profile.

## Upgrading the server

Bump the range in `package.json` and reinstall — the server itself is never
vendored into this repo:

```json
"dependencies": { "illustrator-mcp-server": "^1.11.0" }
```

## Prerequisites

- Adobe Illustrator installed on the machine running the Harness.
  Tested against Illustrator 2022 (v26); the server warns that v28+ is the
  verified baseline but works on older versions.
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
package.json       manifest; dsh.bundle.patch is what makes this installable
cordis.patch.yml   the Loader patch: inserts one @deepseek-ai/dsh-mcp-client row
```
