import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Runs against the store's server build in the isolated test environment
// started by scripts/test-commerce.ts (fictitious catalog, simulated providers).
const mock = process.env.COMMERCE_MOCK_URL ?? "http://127.0.0.1:4300";
type MockState = {
  payments: { id: number; status: string; external_reference: string }[];
  emails: { subject: string }[];
};
const state = async (page: Page) =>
  (await (await page.request.get(`${mock}/__test/state`)).json()) as MockState;
async function axe(page: Page) {
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude("#card-brick")
    .analyze();
  expect(audit.violations).toEqual([]);
}
// COMMERCE_SCREENSHOTS=<dir> saves the purchase journey for visual review.
async function shot(page: Page, name: string) {
  const dir = process.env.COMMERCE_SCREENSHOTS;
  if (dir)
    await page.screenshot({
      path: `${dir}/${name}-${test.info().project.name}.png`,
      fullPage: true,
    });
}
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function fillCheckout(page: Page) {
  await page.getByLabel("Nome completo", { exact: true }).fill("Maria Teste");
  await page.getByLabel("E-mail", { exact: true }).fill("maria@example.test");
  await page.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
  await page
    .getByLabel("Celular com DDD", { exact: true })
    .fill("(11) 99999-0000");
  await page.getByLabel("CEP", { exact: true }).fill("01310-100");
  await page.getByLabel("Rua", { exact: true }).fill("Rua de Teste");
  await page.getByLabel("Número", { exact: true }).fill("100");
  await page.getByLabel("Bairro", { exact: true }).fill("Centro");
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo");
  await page.getByLabel("Estado", { exact: true }).selectOption("SP");
  await page.getByRole("button", { name: "Calcular frete" }).click();
  await expect(
    page.getByRole("radiogroup", { name: "Opções de entrega" }),
  ).toBeVisible();
  await page.getByText(/Autorizo o uso/).click();
}
async function addFromProduct(
  page: Page,
  slug: string,
  packageLabel: string,
  quantity: number,
) {
  await page.goto(`cafes/${slug}/`);
  const panel = page.getByRole("complementary", { name: /^Comprar / });
  await expect(panel.getByRole("status").first()).toHaveText(
    "Disponível para envio.",
  );
  await panel.getByLabel(packageLabel).check();
  await panel.getByLabel("Quantidade", { exact: true }).fill(String(quantity));
  await panel.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(panel.locator(".selection-feedback")).toContainText(
    "no carrinho.",
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("full Pix purchase: product → cart → checkout → server-confirmed payment → reorder", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".card-price").first()).toContainText(
    "A PARTIR DE R$ 45,00",
  );
  await page
    .getByRole("link", { name: "Comprar CAFÉ TÉCNICO A" })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "CAFÉ TÉCNICO A",
  );
  const panel = page.getByRole("complementary", {
    name: "Comprar CAFÉ TÉCNICO A",
  });
  await expect(
    panel.getByText("R$ 18,00 / 100 g", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("R$ 16,00 / 100 g", { exact: true }),
  ).toBeVisible();
  // A bigger bag is suggested because it really costs less per 100 g.
  await expect(panel.getByText(/menor preço por 100 g/)).toBeVisible();
  await expect(
    panel.getByText("Kit técnico A + B", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("status").first()).toHaveText(
    "Disponível para envio.",
  );
  await panel.getByLabel(/500 g/).check();
  await panel.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(panel.getByText("R$ 160,00")).toBeVisible();
  await panel.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".header-cart")).toContainText("2 itens");
  await shot(page, "loja-produto");
  await axe(page);
  expect(await noOverflow(page)).toBe(true);

  await page.goto("carrinho/");
  await expect(
    page.getByRole("heading", { name: "CAFÉ TÉCNICO A" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Diminuir quantidade de CAFÉ TÉCNICO A/ })
    .click();
  await expect(page.locator(".cart-line-total")).toHaveText("R$ 80,00");
  await page
    .getByRole("button", { name: /Aumentar quantidade de CAFÉ TÉCNICO A/ })
    .click();
  await page.getByLabel("Calcular frete").fill("01310-100");
  await page.getByRole("button", { name: "Calcular", exact: true }).click();
  await expect(page.getByText(/Correios PAC · até 7 dias úteis/)).toBeVisible();
  await expect(page.getByText(".Package")).toHaveCount(0);
  await expect(page.locator(".cart-suggestions")).toContainText(
    "Kit técnico A + B",
  );
  await shot(page, "loja-carrinho");
  await axe(page);
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole("link", { name: "Finalizar compra" }).click();

  await expect(
    page.getByText("Ambiente de testes: pagamentos simulados"),
  ).toBeVisible();
  await expect(page.getByLabel("Cartão de crédito")).toHaveCount(0);
  await fillCheckout(page);
  // 2 × R$ 80,00 + PAC for 1 kg + 150 g tare (18 + 1.15 × 4 = R$ 22,60).
  await expect(
    page.getByRole("button", { name: "Gerar Pix de R$ 182,60" }),
  ).toBeVisible();
  await shot(page, "loja-checkout");
  await axe(page);
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole("button", { name: "Gerar Pix de R$ 182,60" }).click();

  await expect(page).toHaveURL(/pedido\/\?id=[0-9a-f-]+&token=/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Aguardando pagamento",
  );
  await expect(page.getByLabel("Pix copia e cola")).toHaveValue(/PIX-TESTE/);
  await expect(
    page.getByRole("img", { name: "QR Code Pix do pedido" }),
  ).toBeVisible();
  await expect(page.locator(".header-cart")).toContainText("vazio");
  await shot(page, "loja-pedido-pix");
  await axe(page);
  const orderId = new URL(page.url()).searchParams.get("id")!;
  const payment = (await state(page)).payments.find(
    (item) => item.external_reference === orderId,
  )!;
  expect(payment.status).toBe("pending");
  // Nothing in the browser can mark it paid: only the signed notification,
  // followed by the store reading the payment from the provider.
  const forged = await page.request.post(
    `api/webhooks/mercadopago/?data.id=${payment.id}&type=payment`,
    {
      headers: { "x-signature": "ts=1,v1=forjada", "x-request-id": "forjado" },
      data: { type: "payment", data: { id: String(payment.id) } },
    },
  );
  expect(forged.status()).toBe(401);
  const approved = await page.request.post(
    `${mock}/__test/payments/${payment.id}/approve?requestId=entrega-${orderId}`,
  );
  expect((await approved.json()).body).toEqual({
    processed: true,
    outcome: "paid",
  });
  // Mercado Pago may deliver the same notification again.
  const duplicate = await page.request.post(
    `${mock}/__test/payments/${payment.id}/approve?requestId=entrega-${orderId}`,
  );
  expect((await duplicate.json()).body).toEqual({
    processed: false,
    reason: "duplicate",
  });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Pagamento confirmado",
    {
      timeout: 15_000,
    },
  );
  await expect(page.getByLabel("Pix copia e cola")).toHaveCount(0);
  await shot(page, "loja-pedido-pago");
  const purchases = await page.evaluate(
    () =>
      (
        window as unknown as { dataLayer: { event?: string }[] }
      ).dataLayer.filter((entry) => entry.event === "purchase").length,
  );
  expect(purchases).toBe(1);
  const subjects = (await state(page)).emails.map((email) => email.subject);
  expect(subjects).toContain("Cura Café · Recebemos seu pedido");
  expect(subjects).toContain("Cura Café · Pagamento confirmado");

  await page.getByRole("button", { name: "Comprar novamente" }).click();
  await expect(page.locator(".header-cart")).toContainText("2 itens");
  const wrongToken = await page.request.get(
    `api/orders/${orderId}/?token=errado`,
  );
  expect(wrongToken.status()).toBe(404);
  const view = await (
    await page.request.get(
      `api/orders/${orderId}/?token=${new URL(page.url()).searchParams.get("token")}`,
    )
  ).text();
  for (const personal of [
    "52998224725",
    "maria@example.test",
    "Rua de Teste",
    "99999",
  ])
    expect(view).not.toContain(personal);
});

test("stock is checked live: a scarce item cannot exceed the units available", async ({
  page,
}) => {
  await addFromProduct(page, "teste-c", "250 g · Em grãos", 1);
  await page.goto("carrinho/");
  await page
    .getByRole("button", { name: /Aumentar quantidade de CAFÉ TÉCNICO C/ })
    .click();
  await expect(page.locator(".cart-warning[role=alert]")).toHaveText(
    "Só há 1 unidade(s) disponível(is). Ajuste a quantidade.",
  );
  await expect(
    page.getByRole("link", { name: "Finalizar compra" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ajuste os itens indisponíveis para finalizar."),
  ).toBeVisible();
});

test("a provider outage keeps the same order and the retry pays it without duplicates", async ({
  page,
}) => {
  await addFromProduct(page, "teste-b", "250 g · Em grãos", 1);
  await page.goto("checkout/");
  await fillCheckout(page);
  await page.request.post(`${mock}/__test/fail-next-payment`);
  const before = (await state(page)).payments.length;
  const responses: { orderId?: string }[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/api/checkout/"))
      responses.push(await response.json());
  });
  const pay = page.getByRole("button", { name: /Gerar Pix de/ });
  await pay.click();
  await expect(page.locator(".cart-warning[role=alert]")).toContainText(
    "O pagamento não pôde ser iniciado",
  );
  await pay.click();
  await expect(page).toHaveURL(/pedido\/\?id=/);
  const orderId = new URL(page.url()).searchParams.get("id");
  expect(responses[0].orderId).toBe(orderId);
  expect((await state(page)).payments.length).toBe(before + 1);
});

test("rejected card and invalid requests never create a paid order", async ({
  page,
  request,
}) => {
  const base = {
    lines: [{ id: "b-250", quantity: 1 }],
    customer: {
      name: "Maria Teste",
      email: "maria@example.test",
      cpf: "52998224725",
      phone: "11999990000",
    },
    address: {
      cep: "01310100",
      street: "Rua de Teste",
      number: "1",
      complement: "",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
    },
    shippingOptionId: "1",
    consent: true,
  };
  const card = await request.post("api/checkout/", {
    data: {
      ...base,
      idempotencyKey: crypto.randomUUID(),
      payment: {
        method: "card",
        token: "tok-reject-card",
        paymentMethodId: "visa",
        installments: 1,
      },
    },
  });
  expect(card.status()).toBe(201);
  expect((await card.json()).status).toBe("payment_failed");
  const tampered = await request.post("api/checkout/", {
    data: {
      ...base,
      idempotencyKey: crypto.randomUUID(),
      payment: { method: "pix" },
      totalCents: 1,
    },
  });
  expect(tampered.status()).toBe(400);
  const unpriced = await request.post("api/checkout/", {
    data: {
      ...base,
      lines: [{ id: "inexistente", quantity: 1 }],
      idempotencyKey: crypto.randomUUID(),
      payment: { method: "pix" },
    },
  });
  expect((await unpriced.json()).error).toBe("item_unavailable");
  const status = await (await request.get("api/commerce/status/")).json();
  expect(status).toEqual({
    enabled: true,
    pix: true,
    card: false,
    shipping: true,
    environment: "sandbox",
    publicKey: null,
  });
  void page;
});
