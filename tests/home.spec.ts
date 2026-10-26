import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getHomeSelection } from "../lib/coffees";
const selection = getHomeSelection();
test("renders the configured selection and honest commercial states", async ({
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
  await expect(page.locator("#cafes-title")).toHaveText(
    selection.settings.title + selection.settings.emphasis,
  );
  await expect(page.locator("#cafes .coffee-card")).toHaveCount(
    selection.entries.length,
  );
  for (const { coffee } of selection.entries)
    await expect(page.locator(`#cafe-${coffee.id}`)).toHaveText(coffee.name);
  if (!selection.entries.length)
    await expect(
      page.getByText("Estamos preparando a próxima seleção.", { exact: false }),
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
test("navigation, mobile menu and layout work", async ({ page }, info) => {
  await page.goto("./");
  if (info.project.name === "mobile")
    await page.locator(".mobile-menu summary").click();
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "Principal mobile" : "Principal",
      exact: true,
    })
    .getByRole("link", { name: "Nossa história" })
    .click();
  await expect(page).toHaveURL(/\/historia\/$/);
  if (info.project.name === "mobile")
    await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".site-header .brand").click();
  await expect(page).toHaveURL(/#inicio$/);
  await page.getByRole("heading", { level: 1 }).click();
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
});
test("passes automated accessibility checks and supports reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
});
