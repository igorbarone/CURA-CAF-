import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("catalog filters, searches and recovers from an empty result", async ({
  page,
}) => {
  await page.goto("cafes/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nossos cafés.A sua escolha.",
  );
  await expect(page.getByRole("status")).toHaveText("2 cafés encontrados");
  await page
    .getByRole("button", { name: "Doce e cremoso", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("1 café encontrado");
  await expect(
    page.getByRole("heading", { name: "SAMBA", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "SALSA", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await page.getByRole("searchbox").fill("TANGERINA");
  await expect(
    page.getByRole("heading", { name: "SALSA", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "SAMBA", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("searchbox").fill("inexistente");
  await expect(page.getByRole("status")).toHaveText("0 cafés encontrados");
  await expect(
    page.getByRole("heading", { name: "Nenhum café por aqui." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.getByRole("status")).toHaveText("2 cafés encontrados");
});

for (const product of [
  {
    slug: "samba",
    name: "SAMBA",
    notes: "Rapadura e melaço",
    producer: "Mauricio Lemos e Diego Campos",
    origin: "Origem exata a confirmar.",
  },
  {
    slug: "salsa",
    name: "SALSA",
    notes: "Laranja e tangerina",
    producer: "Décio José Lemos",
    origin: "Fazenda Serrinha. Município e UF a confirmar.",
  },
]) {
  test(`${product.name} exports its confirmed facts and honest purchase state`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`cafes/${product.slug}/`);
    await expect(page).toHaveTitle(
      `${product.name} — ${product.notes} | Cura Café`,
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      product.name,
    );
    await expect(
      page.getByText(product.producer, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(product.origin, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Compra online · Em breve" }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        "Preço, estoque, peso e opções de moagem ainda não foram confirmados.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.locator("input[type=number]")).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${product.slug}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

test("home to catalog to product to cart, and back to the editorial home", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Encontre o seu café" }).click();
  await expect(page).toHaveURL(/\/CURA-CAF-\/cafes\/$/);
  await page.getByRole("link", { name: "Conheça SAMBA" }).click();
  await expect(page).toHaveURL(/\/cafes\/samba\/$/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("SAMBA");
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
  if (testInfo.project.name === "mobile")
    await page.locator(".mobile-menu summary").click();
  const nav = page.getByRole("navigation", {
    name: testInfo.project.name === "mobile" ? "Principal mobile" : "Principal",
    exact: true,
  });
  await nav.getByRole("link", { name: "A curadoria" }).click();
  await expect(page).toHaveURL(/\/CURA-CAF-\/#curadoria$/);
  await expect(
    page.getByRole("heading", { name: "Café bom não precisa de complicação." }),
  ).toBeVisible();
});

test("catalog and cart pass accessibility checks and contain no broken internal links", async ({
  page,
}) => {
  for (const path of ["cafes/", "carrinho/"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    const links = await page
      .locator("a")
      .evaluateAll((anchors) => [...new Set(anchors.map((a) => a.href))]);
    for (const href of links) {
      const url = new URL(href);
      expect(url.pathname).toMatch(/^\/CURA-CAF-\//);
      const response = await page.request.get(href);
      expect(response.ok(), href).toBe(true);
      if (url.hash)
        expect(await response.text()).toContain(`id="${url.hash.slice(1)}"`);
    }
  }
  const response = await page.request.get("cafes/inexistente/");
  expect(response.status()).toBe(404);
});
