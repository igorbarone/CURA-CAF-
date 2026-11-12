import assert from "node:assert/strict";
import { test } from "node:test";

// Pages rendered per request on Vercel (the operations panel) load the CMS
// content and check that its images exist, so their function bundle must
// carry the same files as the API routes. Missing ones answer 500 (ENOENT).
test("server functions that read the CMS carry content, media and migrations", async () => {
  process.env.VERCEL = "1";
  const { default: config } = await import("../../next.config.mjs");
  const includes = config.outputFileTracingIncludes as Record<string, string[]>;
  for (const route of ["/api/**", "/admin", "/admin/**"])
    for (const glob of ["./content/**/*", "./public/media/**/*", "./db/**/*"])
      assert.ok(includes[route]?.includes(glob), `${route} sem ${glob}`);
});
