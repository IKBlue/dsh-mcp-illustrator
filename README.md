# dsh-mcp-illustrator

A DSH **bundle** that connects [`illustrator-mcp-server`](https://github.com/ie3jp/illustrator-mcp-server)
(Adobe Illustrator, 66 MCP tools) to the Harness profile you install it into.

Two files, no build step, no Host/Client entry code.

## Install

The plugin manager does the package install and the bundle selection — do not
reproduce those steps by hand:

```
plugin_manager({ action: "install_bundle", target: "<git-or-path-spec>" })
```

or, from a shell:

```
dsh plugin --profile <profile> add <git-or-path-spec>
```

Spec forms accepted: an npm name, an **absolute directory**, a git URL, or a
tarball. For a git URL use `#main`:

```
https://github.com/IKBlue/dsh-mcp-illustrator.git
```

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
| `args[0]` | `!!js process.env.DSH_PROFILE_DIR + '/node_modules/illustrator-mcp-server/dist/index.js'` | The server is a declared dependency, so the installing profile has it under its own `node_modules`. |
| `cwd` | same directory | The server writes per-call scratch files there. |

**Assumption:** the profile's pnpm `nodeLinker` is `hoisted`, so the dependency
lands at `<profile>/node_modules/illustrator-mcp-server`. If a profile ever
nests it, the path becomes
`<profile>/node_modules/dsh-mcp-illustrator/node_modules/illustrator-mcp-server/dist/index.js`.

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
