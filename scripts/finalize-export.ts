import { rmSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_CATALOG_ROUTE } from "../lib/catalog-model";
// Next 15 requires a parameter even for a genuinely empty catalog and writes a
// notFound HTML at that parameter. Remove only this reserved generated artifact;
// it is not a coffee, and must return the host's regular 404 in the public site.
rmSync(join(process.cwd(), "out", "cafes", EMPTY_CATALOG_ROUTE), {
  recursive: true,
  force: true,
});
console.log("Export finalizado sem a rota técnica de catálogo vazio.");
