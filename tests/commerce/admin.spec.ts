import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Operations panel against the isolated store (simulated providers, test
// password set by scripts/test-commerce.ts).
const mock = process.env.COMMERCE_MOCK_URL ?? "http://127.0.0.1:4300";
const PASSWORD = "senha-de-teste-do-painel";

async function paidOrder(request: APIRequestContext) {
  const lines = [{ id: "a-250", quantity: 2 }];
  const quote = await (
    await request.post("api/shipping/quote/", {
      data: { cep: "20040020", lines },
    })
  ).json();
  const option = quote.options[0];
  const order = await (
    await request.post("api/checkout/", {
      data: {
        idempotencyKey: crypto.randomUUID(),
        lines,
        customer: {
          name: "Ana Painel",
          email: "ana@example.test",
          cpf: "52998224725",
          phone: "21999990000",
        },
        address: {
          cep: "20040020",
          street: "Rua do Painel",
          number: "5",
          complement: "",
          district: "Centro",
          city: "Rio de Janeiro",
          state: "RJ",
        },
        shippingOptionId: option.id,
        shippingPriceCents: option.chargedCents,
        consent: true,
        payment: { method: "pix" },
      },
    })
  ).json();
  const state = await (await request.get(`${mock}/__test/state`)).json();
  const payment = state.payments.find(
    (item: { externalReference: string }) =>
      item.externalReference === order.id,
  );
  await request.post(`${mock}/__test/payments/${payment.id}/receive`);
  return order.id as string;
}
async function login(page: Page) {
  await page.goto("admin/");
  await page.getByLabel("Senha da equipe").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
}

test("the panel needs the team password and is never indexed", async ({
  page,
  request,
}) => {
  await page.goto("admin/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await page.getByLabel("Senha da equipe").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator(".cart-warning[role=alert]")).toHaveText(
    "Senha incorreta.",
  );
  await expect(page.getByRole("heading", { name: "Visão geral" })).toHaveCount(
    0,
  );
  // Actions without a session do nothing.
  const forged = await request.post("api/admin/action/", {
    form: { action: "stock.set", sku: "A-250", quantity: "999", reason: "x" },
    maxRedirects: 0,
  });
  expect(forged.status()).toBe(303);
  expect(forged.headers().location).toContain("erro=sessao");
  const robots = await (await request.get("robots.txt")).text();
  expect(robots).toContain("Disallow: /admin/");
});

test("order operations: indicators, preparation, label once, tracking and delivery", async ({
  page,
}) => {
  const orderId = await paidOrder(page.request);
  await login(page);
  await expect(page.locator(".admin-kpis")).toContainText("Pedidos pagos");
  await expect(page.locator(".admin-kpis")).toContainText("Descontos Pix");
  await expect(page.locator(".admin-kpis")).toContainText(
    "estimativa interna, não cobrada do cliente",
  );
  await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze()
    .then((audit) => expect(audit.violations).toEqual([]));
  await page.getByRole("link", { name: "Pedidos", exact: true }).click();
  await page.getByRole("link", { name: "Pagos a enviar" }).click();
  await page
    .getByRole("link", { name: orderId.slice(0, 8).toUpperCase() })
    .click();
  await expect(page.getByText("Rua do Painel, 5")).toBeVisible();
  await expect(page.getByText(/Volume 1: Caixa P/)).toBeVisible();
  await page.getByRole("button", { name: "Marcar em preparação" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Pedido marcado como em preparação.",
  );
  await page
    .getByRole("button", { name: "Comprar etiqueta no Melhor Envio" })
    .click();
  await expect(page.getByRole("status")).toContainText("Etiqueta processada");
  await expect(page.getByText(/Etapa: generated/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Imprimir etiqueta(s)" }),
  ).toBeVisible();
  // The label exists: the panel no longer offers to buy another one.
  await expect(
    page.getByRole("button", { name: /Comprar etiqueta/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Atualizar rastreio" }).click();
  await expect(page.getByText(/Rastreio: BR\d+TESTE/)).toBeVisible();
  await page.getByRole("button", { name: "Marcar como entregue" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Pedido marcado como entregue.",
  );
  const state = await (await page.request.get(`${mock}/__test/state`)).json();
  expect(
    state.carts.filter(
      (cart: { options: { tags: { tag: string }[] } }) =>
        cart.options.tags[0].tag === orderId,
    ).length,
  ).toBe(1);
});

test("stock: audited adjustment and pause reach the store at once", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Estoque" }).click();
  await page.getByLabel("Novo disponível de B-250").fill("7");
  await page.getByLabel("Motivo do ajuste de B-250").fill("contagem semanal");
  await page
    .getByRole("row", { name: /B-250/ })
    .getByRole("button", { name: "Salvar" })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Estoque ajustado e registrado.",
  );
  // The history shows the newest adjustment first.
  await expect(page.locator("#stock-history + ol li").first()).toContainText(
    "→ 7 · contagem semanal (painel)",
  );
  await page
    .getByRole("row", { name: /B-250/ })
    .getByRole("button", { name: "Pausar venda" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Venda do SKU pausada.");
  const units = await (
    await page.request.get("api/availability/?ids=b-250")
  ).json();
  expect(units.units["b-250"]).toBe(0);
  await page
    .getByRole("row", { name: /B-250/ })
    .getByRole("button", { name: "Retomar venda" })
    .click();
  expect(
    (await (await page.request.get("api/availability/?ids=b-250")).json())
      .units["b-250"],
  ).toBe(7);
  await page.getByRole("link", { name: "Produtos e lotes" }).click();
  await expect(page.getByText("Rascunho no Pages CMS")).toBeVisible();
  await expect(page.locator(".admin-coffee").first()).toContainText("Liberada");
});
