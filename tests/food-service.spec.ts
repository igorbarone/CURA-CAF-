import { test, expect } from "@playwright/test";
import { getCatalog } from "../lib/coffees";
import { projectCoffee } from "../lib/catalog-model";

const catalog = getCatalog();
test("official slogan leads Home while origin and method keep their own place", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("#hero-title")).toHaveText(
    "Democratizandocafé especial.",
  );
  await expect(page.locator(".hero .origin-signature")).toHaveText(
    "Da roça à cidade.",
  );
  await expect(page.locator(".hero-footnote")).toHaveText(
    "ENCONTRADO. ESCOLHIDO. EXPLICADO.",
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Cura Café | Democratizando café especial.",
  );
  await page.goto("historia/");
  await expect(page.locator(".editorial-lead")).toContainText(
    "Democratizando café especial.",
  );
});

test("Food Service uses the published catalog and an honest partnership path", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("empresas/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Um café à alturada experiência que você oferece.",
  );
  const segments = page.locator(".business-segments");
  for (const title of [
    "Restaurantes e bistrôs",
    "Cafeterias",
    "Padarias artesanais",
    "Hotéis e hospitalidade",
  ])
    await expect(
      segments.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    /escritórios|treinamento|equipamentos|frete grátis|desconto por volume/i,
  );
  await expect(page.locator(".business-benefits")).toContainText(
    "fornecimento recorrente pode ser discutida na negociação",
  );
  await expect(page.locator(".business-coffees .coffee-card")).toHaveCount(
    catalog.length,
  );
  for (const entry of catalog) {
    const coffee = projectCoffee(entry);
    const card = page.locator(".business-coffees .coffee-card").filter({
      has: page.getByRole("heading", { name: coffee.name, exact: true }),
    });
    for (const text of [
      coffee.profile,
      coffee.producers,
      coffee.preparation,
      coffee.roast,
    ])
      await expect(card).toContainText(text);
    await expect(card.locator(".lot-facts")).toContainText(
      coffee.score !== null ? `${coffee.score} pontos` : "A confirmar",
    );
    const href = await card
      .getByRole("link", { name: coffee.name, exact: true })
      .getAttribute("href");
    expect((await page.request.get(href!)).ok()).toBe(true);
  }
  if (!catalog.length)
    await expect(page.locator(".business-coffees")).toContainText(
      "Nossa seleção está sendo preparada.",
    );
  await expect(page.locator(".business-purpose")).toContainText(
    "Cada estabelecimento que serve um bom café pode aproximar mais pessoas",
  );
  await page
    .getByRole("link", { name: "Quero servir Cura Café", exact: true })
    .click();
  await expect(page).toHaveURL(/#proxima-conversa$/);
  await expect(page.locator("#proxima-conversa")).toContainText(
    "Ainda não recebemos solicitações por este site.",
  );
  await page.locator(".business-intake summary").click();
  const planned = page.locator(".business-intake");
  for (const item of [
    "Nome do estabelecimento",
    "Nome do responsável",
    "Segmento",
    "Cidade e estado",
    "Contato comercial para retorno",
    "Consumo mensal estimado (opcional)",
    "Mensagem ou necessidade",
  ])
    await expect(
      planned.getByRole("listitem").filter({ hasText: item }),
    ).toBeVisible();
  await expect(
    page.locator(
      "form, input, textarea, button[type=submit], a[href^='mailto:'], a[href^='tel:']",
    ),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
