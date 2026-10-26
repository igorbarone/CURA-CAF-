import { test, expect } from "@playwright/test";
import { getCatalog } from "../lib/coffees";
test("official palette, variable typography, vector brand and favicon are applied", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("body")).toHaveCSS("color", "rgb(58, 38, 24)");
  await expect(page.locator("h1")).toHaveCSS("font-stretch", "125%");
  await expect(page.locator(".site-header img")).toHaveAttribute(
    "src",
    /\/brand\/cura-logo\.svg$/,
  );
  const favicon = page.locator("link[rel=icon]");
  await expect(favicon).toHaveAttribute("href", /\/brand\/cura-simbolo\.svg$/);
  expect(
    (await page.request.get((await favicon.getAttribute("href"))!)).ok(),
  ).toBe(true);
  await expect(page.locator("#curadoria .steps article")).toHaveCount(4);
});
test("catalog ordering controls reflect editorial products, including an empty collection", async ({
  page,
}) => {
  await page.goto("cafes/");
  await page
    .getByLabel("Ordenar por", { exact: true })
    .selectOption("name-asc");
  const names = await page.locator(".coffee-info h3").allTextContents();
  expect(names).toEqual(
    getCatalog()
      .map((entry) => entry.coffee.name)
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
  );
  await page
    .getByLabel("Ordenar por", { exact: true })
    .selectOption("score-desc");
  await expect(page.locator(".coffee-card")).toHaveCount(getCatalog().length);
});
