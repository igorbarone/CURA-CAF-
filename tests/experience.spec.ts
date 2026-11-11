import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getCatalog } from "../lib/coffees";

const coffees = getCatalog().map((entry) => entry.coffee);
const first = coffees[0];
const pages = [
  "experiencia/",
  "experiencia/cafes/",
  ...(first ? [`experiencia/cafes/${first.slug}/`] : []),
  "experiencia/origem/",
  "experiencia/aprender/",
  "experiencia/aprender/cafe-sem-complicacao/",
  "experiencia/aprender/aprendendo-a-degustar/",
  "experiencia/aprender/ciencia-do-cafe/",
  "experiencia/preparar/?metodo=v60",
  "experiencia/barista/",
  "experiencia/paladar/",
];

async function audit(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Entrance animations fade text in; audit the settled page.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  return violations.map(
    (item) =>
      `${item.id}: ${item.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
  );
}

for (const theme of ["creme", "black"] as const)
  for (const path of pages)
    test(`CURA Experience /${path} is accessible, error-free and fits the screen (${theme})`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      if (theme === "black")
        await page.addInitScript(() =>
          localStorage.setItem("cura-theme", "black"),
        );
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await audit(page)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow).toBe(false);
      expect(errors).toEqual([]);
    });

test("QR entry: opening message, three free paths and real coffee pages", async ({
  page,
}) => {
  await page.goto("experiencia/?origem=qr");
  await expect(page.locator("h1")).toHaveText(
    "Todo café tem uma origem. O seu tem uma história para contar.",
  );
  await page.getByRole("button", { name: /Começar experiência/ }).click();
  await expect(
    page.getByRole("heading", { name: /Três caminhos/ }),
  ).toBeFocused();
  for (const name of [
    "Conhecer meu café",
    "Aprender a preparar",
    "Explorar o universo do café",
  ])
    await expect(
      page.getByRole("link", { name: new RegExp(name) }),
    ).toBeVisible();
  const events = await page.evaluate(() =>
    (
      (window as unknown as { dataLayer?: { event?: string }[] }).dataLayer ??
      []
    ).map((item) => item.event),
  );
  expect(events).toContain("experience_open");
  expect(events).toContain("experience_start");
  for (const coffee of coffees)
    await expect(
      page.locator(`a[href$="/experiencia/cafes/${coffee.slug}/"]`).first(),
    ).toBeVisible();
});

test("coffee page shows only published data and links to the real product route", async ({
  page,
}) => {
  test.skip(!first, "catálogo vazio");
  await page.goto(`experiencia/cafes/${first.slug}/?origem=qr`);
  await expect(page.locator("h1")).toHaveText(first.name);
  await expect(page.locator("body")).not.toContainText(
    /a confirmar|undefined|null/i,
  );
  const buy = page.locator(".xp-buy");
  await expect(buy).toHaveAttribute(
    "href",
    new RegExp(`/cafes/${first.slug}/\\?utm_source=embalagem&utm_medium=qr`),
  );
  await page.locator(".xp-roast-scale button").first().click();
  await expect(page.locator(".xp-roast-scale button").first()).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("tab", { name: /Colheita/ }).click();
  await expect(page.locator("#ciclo-painel h4")).toHaveText("Colheita");
});

test("Laboratório: recipe, calculator, working timer and diagnosis", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("experiencia/preparar/");
  await page.locator(".xp-method-card", { hasText: "V60" }).click();
  // Two cups of 150 ml at 1:16 → 300 g of water and 19 g of coffee.
  const recipe = page.locator(".xp-recipe-grid");
  await expect(recipe).toContainText("19");
  await expect(recipe).toContainText("300");
  await expect(recipe).toContainText("1:16");
  await page.getByRole("button", { name: "Mais intensa" }).click();
  await expect(recipe).toContainText("1:15");
  await page.getByRole("button", { name: "Pelo café" }).click();
  await expect(recipe).toContainText("300"); // 20 g × 15
  const calc = page.locator(".xp-calc");
  await calc.getByLabel("Café (g)").fill("18");
  await expect(calc.getByLabel(/Água/)).toHaveValue("270");
  await calc.getByRole("button", { name: /1:17/ }).click();
  await expect(calc.getByLabel(/Água/)).toHaveValue("306");
  await calc.getByLabel(/Água/).fill("340");
  await expect(calc.getByLabel("Café (g)")).toHaveValue("20");

  const timer = page.locator(".xp-timer");
  await timer.getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.clock.runFor(50_000);
  await expect(timer.locator(".xp-timer-clock")).toHaveText("0:50");
  await expect(timer.locator(".xp-timer-now")).toContainText(
    "Primeiro despejo",
  );
  await expect(page.locator(".xp-tutorial li.is-active")).toContainText(
    "Primeiro despejo",
  );
  await timer.getByRole("button", { name: "Pausar" }).click();
  await page.clock.runFor(10_000);
  await expect(timer.locator(".xp-timer-clock")).toHaveText("0:50");
  await timer.getByRole("button", { name: "Continuar" }).click();
  await page.clock.runFor(10_000);
  await expect(timer.locator(".xp-timer-clock")).toHaveText("1:00");
  await timer.getByRole("button", { name: "Reiniciar" }).click();
  await expect(timer.locator(".xp-timer-clock")).toHaveText("0:00");

  await page.getByRole("button", { name: "Terminei o preparo" }).click();
  await page
    .locator(".xp-diagnosis .xp-choice", { hasText: "Muito amargo" })
    .click();
  await expect(page.locator(".xp-suggestion").first()).toContainText(/moagem/i);
  await expect(page.locator(".xp-diagnosis-result")).toContainText(
    "uma coisa por vez",
  );
});

test("Barista asks questions before suggesting an adjustment", async ({
  page,
}) => {
  await page.goto("experiencia/barista/");
  const input = page.getByLabel("Escreva sua pergunta");
  await input.fill("Meu café está saindo muito amargo.");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.locator(".xp-msg.is-barista").last()).toContainText(
    "Qual método",
  );
  await page.locator(".xp-chat-chips button", { hasText: "Melitta" }).click();
  await expect(page.locator(".xp-msg.is-barista").last()).toContainText(
    "já moído ou mói na hora",
  );
  await page
    .locator(".xp-chat-chips button", { hasText: "Mói na hora" })
    .click();
  await expect(page.locator(".xp-msg.is-barista").last()).toContainText(
    "Comece por aqui",
  );
});

test("taste quiz ends with a preference profile and catalogue recommendations", async ({
  page,
}) => {
  await page.goto("experiencia/paladar/");
  for (let i = 0; i < 6; i++) {
    await page.locator(".xp-choice").first().click();
    await page
      .getByRole("button", { name: i < 5 ? /Próxima/ : /Ver meu perfil/ })
      .click();
  }
  await expect(page.locator("#quiz-result")).toBeVisible();
  await expect(page.locator(".xp-quiz-result")).toContainText(
    "preferências, não classificações científicas",
  );
});

test("mobile bottom navigation reaches the brew guide in one tap", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "barra inferior só no celular");
  await page.goto("experiencia/");
  const nav = page.getByRole("navigation", {
    name: "CURA Experience (atalhos)",
  });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Preparar" }).click();
  await expect(page).toHaveURL(/experiencia\/preparar\/$/);
  await expect(nav.getByRole("link", { name: "Preparar" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("reduced motion disables the opening animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("experiencia/");
  const animation = await page
    .locator(".xp-opening-mark")
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(animation).toBe("none");
});
