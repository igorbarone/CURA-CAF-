import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Runs against the store's server build in the isolated test environment
// started by scripts/test-commerce.ts (fictitious catalog, simulated providers).
const mock = process.env.COMMERCE_MOCK_URL ?? "http://127.0.0.1:4300";
type MockState = {
  payments: { id: string; status: string; externalReference: string }[];
  emails: { subject: string }[];
  shippingCalls: { package: { weight: number }; services?: string }[];
};
const state = async (page: Page) =>
  (await (await page.request.get(`${mock}/__test/state`)).json()) as MockState;
async function axe(page: Page) {
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
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
  // COMMERCE_THEME=black runs the whole journey in the black theme.
  if (process.env.COMMERCE_THEME === "black")
    await page.addInitScript(() => localStorage.setItem("cura-theme", "black"));
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
  await shot(page, "loja-home");
  await page
    .getByRole("link", { name: "Comprar CAFÉ TÉCNICO A" })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "CAFÉ TÉCNICO A",
  );
  await shot(page, "loja-produto-inicio");
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
  await expect(panel.locator(".purchase-total")).toContainText("R$ 160,00");
  await panel.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.locator(".header-cart")).toContainText("2 itens");
  // Confirmation with the next step, closable with Esc.
  const notice = page.getByRole("dialog", { name: /Adicionado ao carrinho/ });
  await expect(notice).toContainText("2× CAFÉ TÉCNICO A · 500 g · Em grãos");
  await expect(
    notice.getByRole("link", { name: /Finalizar compra/ }),
  ).toBeVisible();
  await shot(page, "loja-mini-carrinho");
  await page.keyboard.press("Escape");
  await expect(notice).toHaveCount(0);
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
  // Services come from the real quote, filtered to PAC and .Package.
  await expect(page.getByText(/Correios PAC · até 4 dias úteis/)).toBeVisible();
  await expect(page.getByText(/Jadlog \.Package/)).toBeVisible();
  await expect(page.getByText(/SEDEX/)).toHaveCount(0);
  await expect(page.locator(".cart-pix-note")).toContainText(
    "5% de desconto nos cafés",
  );
  await expect(page.locator(".cart-suggestions")).toContainText(
    "Kit técnico A + B",
  );
  await shot(page, "loja-carrinho");
  // A second, different item: the order (and the reorder) has two lines.
  await page.getByRole("button", { name: "Adicionar CAFÉ TÉCNICO B" }).click();
  await expect(page.locator(".header-cart")).toContainText("3 itens");
  await axe(page);
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole("link", { name: "Finalizar compra" }).click();

  await expect(
    page.getByText("Ambiente de testes: pagamentos simulados"),
  ).toBeVisible();
  await fillCheckout(page);
  // 2 × R$ 80,00 + R$ 52,00 = R$ 212,00. Packed in one box G (2 × 600 g +
  // 300 g + 300 g tare = 1,8 kg): PAC = 16 + 1,8 × 4 = R$ 23,20.
  // Pix: −5% of the coffees only (R$ 10,60) → R$ 224,60.
  await expect(page.locator(".summary-discount")).toContainText("R$ 10,60");
  await expect(
    page.getByRole("button", { name: "Gerar Pix de R$ 224,60" }),
  ).toBeVisible();
  // Switching to card removes the discount; switching back restores it.
  await page.getByLabel(/Cartão de crédito/).check();
  await expect(page.locator(".summary-discount")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pagar R$ 235,20 no cartão" }),
  ).toBeVisible();
  await page.getByLabel(/^Pix/).check();
  await shot(page, "loja-checkout");
  await axe(page);
  expect(await noOverflow(page)).toBe(true);
  await page.getByRole("button", { name: "Gerar Pix de R$ 224,60" }).click();

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
    (item) => item.externalReference === orderId,
  )!;
  expect(payment.status).toBe("PENDING");
  // Nothing in the browser can mark it paid: only an authenticated webhook,
  // followed by the store reading the charge from Asaas.
  const forged = await page.request.post("api/webhooks/asaas/", {
    headers: { "asaas-access-token": "forjado" },
    data: { id: "evt_forjado", event: "PAYMENT_RECEIVED", payment },
  });
  expect(forged.status()).toBe(401);
  const wrongToken = await page.request.post(
    `${mock}/__test/payments/${payment.id}/receive?token=errado`,
  );
  expect((await wrongToken.json()).status).toBe(401);
  expect(
    (
      await (
        await page.request.get(
          `api/orders/${orderId}/?token=${new URL(page.url()).searchParams.get("token")}`,
        )
      ).json()
    ).status,
  ).toBe("pending_payment");
  const approved = await page.request.post(
    `${mock}/__test/payments/${payment.id}/receive?eventId=evt_${orderId}`,
  );
  expect((await approved.json()).body).toEqual({
    processed: true,
    outcome: "paid",
  });
  // Asaas may deliver the same event again.
  const duplicate = await page.request.post(
    `${mock}/__test/payments/${payment.id}/receive?eventId=evt_${orderId}`,
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
  await expect(page.locator(".header-cart")).toContainText("3 itens");
  const wrongOrderToken = await page.request.get(
    `api/orders/${orderId}/?token=errado`,
  );
  expect(wrongOrderToken.status()).toBe(404);
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

test("card data, tampered totals and unknown items never reach an order", async ({
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
    shippingPriceCents: 1780,
    consent: true,
  };
  // The store never accepts card numbers: card is typed on the Asaas page.
  const card = await request.post("api/checkout/", {
    data: {
      ...base,
      idempotencyKey: crypto.randomUUID(),
      payment: { method: "card", number: "4111111111111111", cvv: "123" },
    },
  });
  expect(card.status()).toBe(400);
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
  // A freight price the server no longer quotes (stale quote) is refused.
  const stale = await request.post("api/checkout/", {
    data: {
      ...base,
      shippingPriceCents: 1,
      idempotencyKey: crypto.randomUUID(),
      payment: { method: "pix" },
    },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toBe("shipping_changed");
  const status = await (await request.get("api/commerce/status/")).json();
  expect(status).toEqual({
    enabled: true,
    pix: true,
    card: true,
    shipping: true,
    environment: "sandbox",
  });
});

test("card purchase: typed on the Asaas page, confirmed by webhook, back to the order", async ({
  page,
}) => {
  await addFromProduct(page, "teste-a", "250 g · Em grãos", 1);
  await page.goto("checkout/");
  await fillCheckout(page);
  await page.getByLabel(/Cartão de crédito/).check();
  await expect(page.locator(".summary-discount")).toHaveCount(0);
  await page.getByRole("button", { name: /Pagar R\$ .* no cartão/ }).click();
  // The hosted page belongs to the provider (simulated here).
  await expect(
    page.getByRole("heading", { name: "Página de pagamento simulada" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pagar com cartão de teste" }).click();
  await expect(page).toHaveURL(/pedido\/\?id=/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Pagamento confirmado",
    { timeout: 15_000 },
  );
  await axe(page);
});

test("a freight provider outage is explained and nothing is charged", async ({
  page,
}) => {
  await addFromProduct(page, "teste-a", "250 g · Em grãos", 1);
  await page.request.post(`${mock}/__test/shipping-down?value=true`);
  await page.goto("checkout/");
  await page.getByLabel("CEP", { exact: true }).fill("20040020");
  await expect(page.locator(".cart-warning[role=alert]")).toContainText(
    "Não conseguimos calcular o frete agora",
  );
  await expect(
    page.getByRole("radiogroup", { name: "Opções de entrega" }),
  ).toHaveCount(0);
  await page.request.post(`${mock}/__test/shipping-down?value=false`);
  await page.getByRole("button", { name: "Calcular frete" }).click();
  await expect(
    page.getByRole("radiogroup", { name: "Opções de entrega" }),
  ).toBeVisible();
  // Rio de Janeiro in the simulation: 16 + 2 × 1,5 + 0,45 × 4 = R$ 20,80.
  await expect(
    page.locator(".shipping-options .package-option").first(),
  ).toContainText("R$ 20,80");
});

test("checkout fills the address from the CEP, quotes freight and points at wrong fields", async ({
  page,
}) => {
  await addFromProduct(page, "teste-b", "250 g · Em grãos", 1);
  await page.goto("checkout/");
  await expect(
    page.getByRole("navigation", { name: "Etapas da compra" }),
  ).toContainText("Carrinho");
  await page.getByLabel("CPF", { exact: true }).fill("52998224725");
  await expect(page.getByLabel("CPF", { exact: true })).toHaveValue(
    "529.982.247-25",
  );
  await page.getByLabel("Celular com DDD", { exact: true }).fill("11999990000");
  await expect(page.getByLabel("Celular com DDD", { exact: true })).toHaveValue(
    "(11) 99999-0000",
  );
  await page.getByLabel("CEP", { exact: true }).fill("00000000");
  await expect(
    page.getByText("CEP não encontrado. Preencha o endereço."),
  ).toBeVisible();
  await page.getByLabel("CEP", { exact: true }).fill("01310100");
  await expect(page.getByLabel("CEP", { exact: true })).toHaveValue(
    "01310-100",
  );
  await expect(page.getByText(/Endereço preenchido pelo CEP/)).toBeVisible();
  await expect(page.getByLabel("Rua", { exact: true })).toHaveValue(
    "Avenida Paulista",
  );
  await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue(
    "São Paulo",
  );
  await expect(page.getByLabel("Estado", { exact: true })).toHaveValue("SP");
  // Freight shows up without pressing "Calcular frete".
  await expect(
    page.getByRole("radiogroup", { name: "Opções de entrega" }),
  ).toBeVisible();
  await page.getByLabel("CPF", { exact: true }).fill("11111111111");
  await page.getByText(/Autorizo o uso/).click();
  await page.getByRole("button", { name: /Gerar Pix de/ }).click();
  await expect(page.locator(".cart-warning[role=alert]")).toHaveText(
    "Revise os campos destacados.",
  );
  const cpf = page.getByLabel("CPF", { exact: true });
  await expect(cpf).toHaveAttribute("aria-invalid", "true");
  // Focus goes to the first wrong field (the name, still empty).
  await expect(page.getByLabel("Nome completo", { exact: true })).toBeFocused();
  await expect(
    page.getByText("CPF inválido. Confira os números."),
  ).toBeVisible();
  await expect(page.getByText("Informe nome e sobrenome.")).toBeVisible();
  await expect(page).toHaveURL(/checkout\/$/);
  await axe(page);
  expect(await noOverflow(page)).toBe(true);
});

test("a late freight answer for a previous CEP never replaces the current one", async ({
  page,
}) => {
  await addFromProduct(page, "teste-b", "250 g · Em grãos", 1);
  await page.goto("checkout/");
  const cep = page.getByLabel("CEP", { exact: true });
  // The first CEP answers slowly (and is pricier); the second answers at once.
  await cep.fill("69900000");
  await cep.fill("01310100");
  const pac = page.locator(".shipping-options .package-option").first();
  await expect(pac).toContainText("Correios PAC");
  // 300 g bag + 150 g box P = 0,45 kg: 16 + 0,45 × 4 = R$ 17,80 (the slow
  // CEP would be R$ 106,80).
  await expect(pac).toContainText("R$ 17,80");
  await page.waitForTimeout(3000);
  await expect(pac).toContainText("R$ 17,80");
  // R$ 52,00 − 5% Pix (R$ 2,60) + R$ 17,80.
  await expect(page.locator(".checkout-summary .cart-total")).toContainText(
    "R$ 67,20",
  );
});
