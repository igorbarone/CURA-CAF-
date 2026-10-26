import { get } from "node:http";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { getCatalog } from "../lib/coffees";
import { catalogFilters } from "../lib/catalog-model";
async function capture() {
  const base = "http://127.0.0.1:4173/CURA-CAF-/";
  function probe(): Promise<number> {
    return new Promise((resolve) => {
      const request = get(base, (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      request.setTimeout(500, () => request.destroy());
      request.on("error", () => resolve(0));
    });
  }
  if (await probe())
    throw new Error(
      "A porta 4173 já está ocupada. Pare somente o servidor que você iniciou antes de capturar.",
    );
  const server = spawn(process.execPath, ["scripts/serve-export.mjs"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const files: { page: string; viewport: string; file: string }[] = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if ((await probe()) === 200) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready)
      throw new Error(
        "O export Pages não respondeu na porta de captura. Rode o build estático primeiro.",
      );
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    });
    mkdirSync("docs/screenshots", { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["mobile", 390, 844],
    ] as const) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      for (const [label, path] of [
        ["home", ""],
        ["catalogo", "cafes/"],
        ["samba", "cafes/samba/"],
        ["salsa", "cafes/salsa/"],
        ["quiz", "descubra/"],
        ["clube", "clube/"],
        ["historia", "historia/"],
        ["carrinho", "carrinho/"],
      ]) {
        await page.goto(base + path, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        const file = `${label}-${name}.png`;
        await page.evaluate(() => {
          (document.activeElement as HTMLElement)?.blur?.();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: `docs/screenshots/${file}`,
          fullPage: true,
        });
        files.push({ page: label, viewport: `${width} × ${height}`, file });
        if (label === "quiz") {
          const profile = catalogFilters(getCatalog()).profiles[0];
          if (profile) {
            await page
              .getByRole("radio", { name: profile, exact: true })
              .check();
            await page.getByRole("button", { name: /Continuar/ }).click();
            await page.getByRole("button", { name: /Continuar/ }).click();
            await page
              .getByRole("button", { name: /Ver minha recomendação/ })
              .click();
            await page.locator(".quiz-result").first().waitFor();
            const resultFile = `quiz-resultado-${name}.png`;
            await page.evaluate(() => {
              (document.activeElement as HTMLElement)?.blur?.();
              window.scrollTo(0, 0);
            });
            await page.screenshot({
              path: `docs/screenshots/${resultFile}`,
              fullPage: true,
            });
            files.push({
              page: "quiz-resultado",
              viewport: `${width} × ${height}`,
              file: resultFile,
            });
          }
        }
      }
      await page.close();
    }
    writeFileSync(
      "docs/screenshots/README.md",
      "# Capturas da V1\n\nCapturas do export estático desta branch. Desktop: 1440 px; mobile: 390 px. Movimento reduzido foi usado para estabilizar as capturas. Sem produtos, preços ou estoque de demonstração adicionados.\n\n| Página | Viewport | Captura |\n| --- | --- | --- |\n" +
        files
          .map(
            (item) =>
              `| ${item.page} | ${item.viewport} | [PNG](${item.file}) |`,
          )
          .join("\n") +
        "\n",
    );
    console.log(`${files.length} capturas salvas em docs/screenshots/.`);
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
  }
}
capture().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
