import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { contentSchema } from "./content-schema";
// Build-time adapter. Never import into a client component or ship draft content.
export function loadContent(
  root = process.env.CURA_CONTENT_ROOT ?? process.cwd(),
) {
  function collection(name: string) {
    return readdirSync(join(root, "content", name))
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => {
        const record = JSON.parse(
          readFileSync(join(root, "content", name, file), "utf8"),
        );
        if (file !== `${record.id}.json`)
          throw new Error(
            `${name}/${file}: nome do arquivo deve corresponder ao id`,
          );
        return record;
      });
  }
  const content = contentSchema.parse({
    coffees: collection("coffees"),
    lots: collection("lots"),
    offers: collection("offers"),
    home: JSON.parse(readFileSync(join(root, "content/home.json"), "utf8")),
  });
  for (const coffee of content.coffees)
    if (
      coffee.media &&
      !statSync(join(root, "public", coffee.media.src)).isFile()
    )
      throw new Error(`Mídia inexistente: ${coffee.media.src}`);
  return content;
}
