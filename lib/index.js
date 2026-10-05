//#region lib/index.js
/**
 * Host half.
 *
 * This exists to answer one question with evidence rather than inference: can a row whose
 * module lives in the *profile's* node_modules be imported by the Loader at all?
 *
 * The earlier attempt failed:
 *   include:mcp-illustrator-config (dsh-mcp-illustrator): failed to import
 * while every row that does activate in this installation names an
 * application-internal @deepseek-ai/* package.
 *
 * So this attempt keeps the browser half out of the picture entirely (no dsh.client, no
 * exports["./client"]) and adds nothing but a row pointing at this package. If the entry
 * activates, profile-local rows work and the earlier failure belonged to the browser half.
 * If it still fails, a third-party bundle cannot declare a host row of its own, and the
 * settings-page plan has to change shape.
 */
export function apply() {}
//#endregion
