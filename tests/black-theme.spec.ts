import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getCatalog } from "../lib/coffees";
const first = getCatalog()[0]?.coffee.slug;
// The black theme must keep every public page readable (WCAG A/AA, contrast
// included), exactly like the default cream theme.
const pages = [
  "",
  "cafes/",
  ...(first ? [`cafes/${first}/`] : []),
  "comparar/",
  "descubra/",
  "historia/",
  "empresas/",
  "clube/",
  "carrinho/",
];
for (const path of pages)
  test(`black theme passes accessibility checks on /${path}`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("cura-theme", "black"));
    await page.goto(path || "./");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
    await page.evaluate(() => document.fonts.ready);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      violations.map(
        (item) =>
          `${item.id}: ${item.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
      ),
    ).toEqual([]);
  });
