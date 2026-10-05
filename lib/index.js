//#region lib/index.js
/**
 * Host marker for the browser half that `cordis.patch.yml`'s self-referencing row mounts.
 *
 * Every behaviour lives in the client export (`exports["./client"]` → `lib/client.js`).
 * A row needs a host half to mount at all, and an empty `apply` is the shipped way to
 * provide one — see @deepseek-ai/dsh-experimental-client-ui-voice-input/lib/index.js,
 * whose whole host half is an empty `apply`.
 */
export function apply() {}
//#endregion
