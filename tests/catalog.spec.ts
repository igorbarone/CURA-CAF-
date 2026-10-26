import { getEditorial } from "../lib/editorial";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getCatalog } from "../lib/coffees";
import {
  catalogFilters,
  filterCatalog,
  projectCoffee,
} from "../lib/catalog-model";
const catalog = getCatalog(),
  options = catalogFilters(catalog);
const noFilters = { query: "", profile: "", roast: "", preparation: "" };
test("catalog derives filters, searches and recovers from an empty result", async ({
  page,
}) => {
  await page.goto("cafes/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nossos cafés.A sua escolha.",
  );
  await expect(page.locator(".coffee-card")).toHaveCount(catalog.length);
  await expect(
    page.getByRole("button", { name: "Todos", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  if (options.profiles.length) {
    const profile = options.profiles[0];
    await page.getByRole("button", { name: profile, exact: true }).click();
    await expect(page.locator(".coffee-card")).toHaveCount(
      filterCatalog(catalog, { ...noFilters, profile }).length,
    );
    await page.getByRole("button", { name: "Todos", exact: true }).click();
  }
  await expect(page.getByLabel("Torra").locator("option")).toHaveCount(
    options.roasts.length + 1,
  );
  await expect(
    page.getByLabel("Preparo sugerido").locator("option"),
  ).toHaveCount(options.preparations.length + 1);
  if (catalog.length) {
    const query = catalog[0].coffee.name;
    await page.getByRole("searchbox").fill(query);
    await expect(page.locator(".coffee-card")).toHaveCount(
      filterCatalog(catalog, { ...noFilters, query }).length,
    );
  }
  await page.getByRole("searchbox").fill("no-match-" + Date.now());
  await expect(page.getByRole("status")).toHaveText("0 cafés encontrados");
  await expect(
    page.getByRole("heading", { name: "Nenhum café por aqui." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.locator(".coffee-card")).toHaveCount(catalog.length);
});
for (const entry of catalog) {
  const coffee = projectCoffee(entry);
  test(`${coffee.slug} exports its published facts and honest purchase state`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`cafes/${coffee.slug}/`);
    await expect(page).toHaveTitle(
      `${coffee.name} — ${coffee.notes} | Cura Café`,
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      coffee.name,
    );
    await expect(
      page.getByText("Produtores", { exact: true }).locator("..").locator("dd"),
    ).toHaveText(coffee.producers);
    await expect(
      page.getByText("Origem", { exact: true }).locator("..").locator("dd"),
    ).toHaveText(coffee.origin);
    await expect(
      page.getByRole("button", { name: "Compra online · Em breve" }),
    ).toBeDisabled();
    const offers = entry.offers.filter((item) => item.lotId === coffee.lotId);
    if (!offers.length)
      await expect(
        page.getByText(
          "Preço, estoque, peso e opções de moagem ainda não foram confirmados.",
        ),
      ).toBeVisible();
    else
      for (const offer of offers)
        await expect(
          page.getByText(`SKU ${offer.sku}`, { exact: true }),
        ).toBeVisible();
    await expect(page.locator("#lot-select")).toHaveCount(
      entry.lots.length > 1 ? 1 : 0,
    );
    await expect(page.locator("input[type=number]")).toHaveCount(0);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${coffee.slug}-${info.project.name}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
test("home to catalog to product to cart, and back to the editorial home", async ({
  page,
}, info) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Encontre o seu café" }).click();
  await expect(page).toHaveURL(/\/CURA-CAF-\/cafes\/$/);
  if (catalog.length) {
    const coffee = catalog[0].coffee;
    await page.locator(`#cafe-${coffee.id} a`).click();
    await expect(page).toHaveURL(new RegExp(`/cafes/${coffee.slug}/$`));
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      coffee.name,
    );
  } else
    await expect(
      page.getByRole("heading", { name: "Nenhum café por aqui." }),
    ).toBeVisible();
  await page.getByRole("link", { name: "Carrinho Em breve" }).click();
  await expect(page).toHaveURL(/\/carrinho\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Em breve.",
  );
  await expect(
    page.getByText(
      "Não recebemos pedidos, reservas ou pagamentos por este site.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
  if (info.project.name === "mobile")
    await page.locator(".mobile-menu summary").click();
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "Principal mobile" : "Principal",
      exact: true,
    })
    .getByRole("link", { name: "A curadoria" })
    .click();
  await expect(page).toHaveURL(/\/CURA-CAF-\/#curadoria$/);
  await expect(
    page.getByRole("heading", {
      name: `${getEditorial().curation.title} ${getEditorial().curation.emphasis}`,
    }),
  ).toBeVisible();
});
test("catalog and cart pass accessibility checks and contain no broken internal links", async ({
  page,
}) => {
  for (const path of ["cafes/", "carrinho/"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    const links = await page
      .locator("a")
      .evaluateAll((anchors) => [
        ...new Set(anchors.map((a) => (a as HTMLAnchorElement).href)),
      ]);
    for (const href of links) {
      const url = new URL(href);
      expect(url.pathname).toMatch(/^\/CURA-CAF-\//);
      const response = await page.request.get(href);
      expect(response.ok(), href).toBe(true);
      if (url.hash)
        expect(await response.text()).toContain(`id="${url.hash.slice(1)}"`);
    }
  }
  const unknown = "route-not-registered-" + Date.now();
  expect((await page.request.get(`cafes/${unknown}/`)).status()).toBe(404);
});
