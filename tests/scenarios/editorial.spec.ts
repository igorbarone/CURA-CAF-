import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("configured Home, arbitrary coffee and photo work without changing route code", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", {
      name: "Seleção configurada de teste. Sem contagem fixa.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "CAFÉ TÉCNICO DE TESTE", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "SALSA", exact: true }),
  ).toHaveCount(0);
  const image = page.getByRole("img", {
    name: "Imagem técnica de teste, não é fotografia de café",
  });
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await page.goto("cafes/");
  await expect(page.getByRole("status")).toHaveText("4 cafés encontrados");
  await page
    .getByRole("button", { name: "Perfil técnico B", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("1 café encontrado");
  await expect(
    page.getByRole("heading", { name: "CAFÉ TÉCNICO DE TESTE", exact: true }),
  ).toBeVisible();
});
test("multiple lots switch all technical and offer details, with no invented commercial values", async ({
  page,
}, info) => {
  await page.goto("cafes/fixture-editorial/");
  const select = page.getByLabel("Escolha o lote para conhecer");
  await expect(select).toHaveValue("fixture-b");
  await expect(
    page.getByText("SKU TEST-ONLY-B", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("SKU TEST-ONLY-A", { exact: true })).toHaveCount(
    0,
  );
  await select.selectOption("fixture-a");
  await expect(page.locator(".curator-note blockquote")).toHaveText(
    "Nota técnica de teste: critério do lote A.",
  );
  await expect(page.locator(".lot-selector [role=status]")).toHaveText(
    "Ficha do lote TEST-ONLY-A",
  );
  await expect(
    page.getByText("SKU TEST-ONLY-A", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("SKU TEST-ONLY-A2", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("SKU TEST-ONLY-B", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Compra online · Em breve" }),
  ).toBeDisabled();
  await expect(page.getByText(/R\$|em estoque/)).toHaveCount(0);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/editorial-${info.project.name}.png`,
    fullPage: true,
  });
});
test("coffee without lots and archived coffee keep honest states and draft routes stay absent", async ({
  page,
}) => {
  await page.goto("cafes/fixture-empty/");
  await expect(page.locator(".product-summary > .eyebrow")).toHaveText(
    "Lote a confirmar",
  );
  await expect(page.locator(".product-hero .art-number")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Compra online · Em breve" }),
  ).toBeDisabled();
  await page.goto("cafes/fixture-archived/");
  await expect(page.getByText("CAFÉ ARQUIVADO", { exact: true })).toBeVisible();
  await expect(page.locator(".commerce-status")).toHaveCount(0);
  await expect(page.locator("meta[name=robots]")).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  expect((await page.request.get("cafes/fixture-draft/")).status()).toBe(404);
});

test("published offers can be reviewed locally without orders, totals or checkout", async ({
  page,
}) => {
  await page.goto("cafes/fixture-editorial/");
  await page
    .getByRole("button", {
      name: "Selecionar oferta · demonstração",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Oferta incluída" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Revisar seleção demonstrativa/ })
    .click();
  await expect(
    page.getByText("SKU TEST-ONLY-B", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Pedidos, reserva, pagamento e checkout indisponíveis", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/R\$/)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remover oferta TEST-ONLY-B" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remover oferta TEST-ONLY-B" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Em breve.",
  );
});
