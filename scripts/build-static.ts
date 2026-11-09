// Static export for GitHub Pages. The store's API routes (app/api, standard
// `route.ts` files) cannot be exported, so they are moved into a private
// folder (ignored by the router) only while `next build` runs, and always put
// back, even when the build fails or is interrupted.
import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
const api = "app/api";
const hidden = "app/_api-static-build";
if (existsSync(hidden) && !existsSync(api)) renameSync(hidden, api);
const restore = () => {
  if (existsSync(hidden)) renameSync(hidden, api);
};
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    restore();
    process.exit(1);
  });
let status = 1;
try {
  if (existsSync(api)) renameSync(api, hidden);
  status =
    spawnSync("npx", ["next", "build"], { stdio: "inherit" }).status ?? 1;
} finally {
  restore();
}
process.exit(status);
