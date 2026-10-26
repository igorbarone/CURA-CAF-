import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("renders the real coffees and honest commercial states", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("./");
  await expect(page).toHaveTitle("Cura Café | Da roça à cidade");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Da roçaà cidade.",
  );
  for (const name of ["SAMBA", "SALSA"])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByText("Preço e disponibilidade a confirmar.", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByText("CURA-26-01", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByText("CURA-26-02", { exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /comprar|checkout/i }),
  ).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () =>
        document.fonts.check('16px "Archivo Variable"') &&
        document.fonts.check('16px "DM Mono"') &&
        document.fonts.check('italic 16px "Newsreader Variable"'),
    ),
  ).toBe(true);
  expect(failures).toEqual([]);
});
test("navigation, mobile menu and layout work", async ({ page }, testInfo) => {
  await page.goto("./");
  if (testInfo.project.name === "mobile") {
    await page.getByText("Menu", { exact: false }).click();
    await page
      .getByRole("navigation", { name: "Principal mobile" })
      .getByRole("link", { name: "Nossa história" })
      .click();
  } else {
    await page
      .getByRole("navigation", { name: "Principal", exact: true })
      .getByRole("link", { name: "Nossa história" })
      .click();
  }
  await expect(page).toHaveURL(/#historia$/);
  if (testInfo.project.name === "mobile")
    await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(page).toHaveURL(/#inicio$/);
  await page.getByRole("heading", { level: 1 }).click();
  await page.screenshot({
    path: `test-results/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("passes automated accessibility checks and supports reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
});
