import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// The GitHub Pages export has no store runtime: checkout and order pages
// must say so plainly, stay out of search engines and never call an API.
for (const path of ["checkout/", "pedido/"])
  test(`${path} is an honest "em breve" page in the static site`, async ({
    page,
  }) => {
    const apiCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/")) apiCalls.push(request.url());
    });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Compra online em breve.",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.locator("form, input")).toHaveCount(0);
    await expect(page.locator(".site-footer")).toContainText(
      "Compra online em breve",
    );
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    expect(apiCalls).toEqual([]);
  });
test("the static sitemap leaves checkout and order pages out", async ({
  page,
}) => {
  const xml = await (await page.request.get("sitemap.xml")).text();
  expect(xml).not.toContain("/checkout/");
  expect(xml).not.toContain("/pedido/");
});
