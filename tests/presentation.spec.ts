import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getCatalog } from "../lib/coffees";
import { catalogFilters } from "../lib/catalog-model";
const entries = getCatalog(),
  options = catalogFilters(entries);
test("quiz is keyboard accessible, explains matches and handles empty data", async ({
  page,
}) => {
  await page.goto("descubra/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Descubra",
  );
  if (!entries.some((entry) => entry.lots.length)) {
    await expect(
      page.getByRole("heading", { name: "Novas escolhas estão a caminho." }),
    ).toBeVisible();
    return;
  }
  await page
    .getByRole("radio", {
      name: options.profiles[0] ?? "Quero explorar, sem preferência",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(
    page.getByRole("heading", { name: "Como você gosta de preparar?" }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Ver minha recomendação/ }).click();
  await expect(page.locator(".quiz-result")).toHaveCount(
    entries.filter((entry) =>
      entry.lots.some((lot) => lot.profile === options.profiles[0]),
    ).length,
  );
  await expect(
    page
      .getByText(`Perfil confirmado: ${options.profiles[0]}.`, { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.locator(".quiz-results").getByRole("link").first(),
  ).toHaveAttribute("href", /\?lote=/);
  await page.getByRole("button", { name: "Recomeçar", exact: true }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Ver minha recomendação/ }).click();
  await expect(page.locator(".quiz-panel [role=alert]")).toContainText(
    "Escolha ao menos uma preferência",
  );
});
for (const [path, title] of [
  ["clube/", "Clube Cura"],
  ["historia/", "Nossa história"],
  ["descubra/", "Descubra seu café"],
  ["empresas/", "Para empresas"],
] as const) {
  test(`${path} is honest, accessible and mobile ready`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    await expect(page).toHaveTitle(new RegExp(title));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === "clube/") {
      await expect(
        page.getByText("Assinatura em desenvolvimento", { exact: true }),
      ).toBeVisible();
      await expect(page.locator("form")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /assinar|contratar|comprar/i }),
      ).toHaveCount(0);
    }
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${path.replace("/", "")}-${info.project.name}.png`,
      fullPage: true,
    });
  });
}
test("published pages expose canonical URLs and a sitemap without cart or drafts", async ({
  page,
}) => {
  await page.goto("cafes/");
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
    "href",
    "https://igorbarone.github.io/CURA-CAF-/cafes/",
  );
  const sitemap = await page.request.get("sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/descubra/");
  expect(xml).toContain("/clube/");
  expect(xml).toContain("/empresas/");
  expect(xml).not.toContain("/carrinho/");
});

test("incompatible quiz answers show no match and can be adjusted without inventing products", async ({
  page,
}) => {
  const pair = options.profiles
    .flatMap((profile) =>
      options.preparations.map((preparation) => ({ profile, preparation })),
    )
    .find(
      (answer) =>
        !entries.some((entry) =>
          entry.lots.some(
            (lot) =>
              lot.profile === answer.profile &&
              lot.preparations.includes(answer.preparation),
          ),
        ),
    );
  await page.goto("descubra/");
  if (!pair) {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    return;
  }
  await page.getByRole("radio", { name: pair.profile, exact: true }).check();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page
    .getByRole("radio", { name: pair.preparation, exact: true })
    .check();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Ver minha recomendação/ }).click();
  await expect(
    page.getByRole("heading", { name: "Vamos tentar outro caminho?" }),
  ).toBeVisible();
  await expect(page.locator(".quiz-result")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ajustar respostas", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: pair.profile, exact: true }),
  ).toBeChecked();
});
