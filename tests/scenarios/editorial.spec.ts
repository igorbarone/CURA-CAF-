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

test("sensory and roast filters show the matching lot and carry it into the product route", async ({
  page,
}) => {
  await page.goto("cafes/");
  await page
    .getByRole("button", { name: "Perfil técnico A", exact: true })
    .click();
  await page.getByLabel("Torra", { exact: true }).selectOption("Clara");
  const card = page.locator(".coffee-card");
  await expect(card).toHaveCount(1);
  await expect(card.locator(".coffee-info > .eyebrow")).toHaveText(
    "TEST-ONLY-A",
  );
  await expect(card.locator(".lot-facts")).toContainText("86 pontos");
  await expect(card.locator(".lot-facts")).toContainText("Clara");
  await expect(card.locator(".coffee-info")).toContainText(
    "Produtor técnico A",
  );
  await expect(card.locator(".coffee-notes")).toHaveText("Nota técnica A");
  await card
    .getByRole("link", { name: "CAFÉ TÉCNICO DE TESTE", exact: true })
    .click();
  await expect(page).toHaveURL(/\?lote=fixture-a$/);
  await expect(page.getByLabel("Escolha o lote para conhecer")).toHaveValue(
    "fixture-a",
  );
  await expect(page.locator(".product-summary > .eyebrow")).toContainText(
    "86 PONTOS SCA",
  );
  await expect(page.locator(".origin-details .producer-story")).toHaveText(
    "História técnica confirmada apenas para o lote A.",
  );
  await expect(page.locator(".origin-details .fact-grid")).toContainText(
    "Origem técnica A",
  );
  await page
    .getByLabel("Escolha o lote para conhecer")
    .selectOption("fixture-b");
  await expect(page.locator(".product-summary > .eyebrow")).toContainText(
    "84 PONTOS SCA",
  );
  await expect(page.locator(".origin-details .producer-story")).toHaveCount(0);
  await page.goto("cafes/");
  await page
    .getByRole("button", { name: "Perfil técnico A", exact: true })
    .click();
  await page.getByLabel("Torra", { exact: true }).selectOption("Média");
  await expect(page.locator(".coffee-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  const restored = page
    .locator(".coffee-card")
    .filter({
      has: page.getByRole("heading", {
        name: "CAFÉ TÉCNICO DE TESTE",
        exact: true,
      }),
    });
  await expect(restored.locator(".coffee-info > .eyebrow")).toHaveText(
    "TEST-ONLY-B",
  );
  await expect(restored.locator(".lot-facts")).toContainText("84 pontos");
});
test("configured contact channels appear on product, Food Service and footer with context", async ({
  page,
}) => {
  await page.goto("cafes/samba/");
  const commerce = page.getByRole("complementary", {
    name: "Informações comerciais",
  });
  const whatsapp = commerce.getByRole("link", {
    name: /Conversar no WhatsApp/,
  });
  await expect(whatsapp).toHaveAttribute(
    "href",
    `https://wa.me/5500000000000?text=${encodeURIComponent("Olá, Cura Café! Quero saber mais sobre o SAMBA (lote CURA-26-01).")}`,
  );
  await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    commerce.getByRole("button", { name: "Compra online · Em breve" }),
  ).toBeDisabled();
  await page.goto("empresas/");
  await expect(page.getByText("Canal de parceria em preparação.")).toHaveCount(
    0,
  );
  const partner = page.locator("#proxima-conversa");
  await expect(
    partner.getByRole("link", { name: "Enviar e-mail" }),
  ).toHaveAttribute("href", /^mailto:teste@example\.com\?subject=/);
  await expect(
    page.getByRole("list", { name: "Fale com a Cura" }).getByRole("link"),
  ).toHaveCount(2);
  await expect(page.locator("form, input, textarea")).toHaveCount(0);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
});
