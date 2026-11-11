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
  "experiencia/minha-jornada/",
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
      // Audit the settled page: the Barista first checks which mode is on.
      await expect(page.locator(".xp-mode", { hasText: "Verificando" })).toHaveCount(0);
      expect(await audit(page)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow).toBe(false);
      expect(errors).toEqual([]);
    });

const salsa = coffees.find((coffee) => coffee.slug === "salsa");

test("QR entry: the package comes first and “Quero preparar meu café” is one tap away", async ({
  page,
}) => {
  await page.goto("experiencia/?origem=qr");
  await expect(page.locator("h1")).toHaveText(
    "Todo café tem uma origem. O seu tem uma história para contar.",
  );
  for (const coffee of coffees)
    await expect(
      page.getByRole("button", { name: new RegExp(coffee.name) }),
    ).toBeVisible();
  // The QR visit is recorded once per tab, without personal data.
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          (
            window as unknown as {
              dataLayer?: {
                event?: string;
                experience?: { source?: string };
              }[];
            }
          ).dataLayer ?? []
        )
          .filter((item) => item.event === "experience_open")
          .map((item) => item.experience?.source),
      ),
    )
    .toEqual(["qr"]);
  test.skip(!salsa, "SALSA não publicado");
  await page.getByRole("button", { name: /SALSA/ }).click();
  await expect(
    page.getByRole("heading", { name: /SALSA\. O que você quer fazer\?/ }),
  ).toBeFocused();
  await page.getByRole("link", { name: /Quero preparar meu café/ }).click();
  await expect(page).toHaveURL(/experiencia\/preparar\/\?cafe=salsa/);
  await expect(page.getByRole("radio", { name: "SALSA" })).toBeChecked();
  // The choice persists across the Experience ("Seu café").
  await page.goto("experiencia/aprender/");
  await expect(page.locator(".xp-context-bar")).toContainText("SALSA");
});

test("coffee page: lot data first, general context labelled, real product route", async ({
  page,
}) => {
  test.skip(!salsa, "SALSA não publicado");
  await page.goto("experiencia/cafes/salsa/?origem=qr");
  const lot = page.locator(".xp-lot");
  await expect(lot).toContainText("Décio José Lemos");
  await expect(lot).toContainText("Fazenda Serrinha");
  await expect(lot).toContainText("1.200 m");
  await expect(page.locator(".xp-context-tag").first()).toHaveText(
    "CONTEXTO GERAL",
  );
  await expect(page.locator("body")).not.toContainText(
    /a confirmar|undefined|null/i,
  );
  await expect(page.locator(".xp-buy")).toHaveAttribute(
    "href",
    /\/cafes\/salsa\/\?utm_source=embalagem&utm_medium=qr/,
  );
  await page.goto("experiencia/cafes/da-casa/");
  await expect(page.locator(".xp-lot")).toContainText(
    "A origem detalhada ainda não está publicada",
  );
  await expect(page.locator(".xp-roast-scale [aria-checked=true]")).toHaveCount(
    0,
  );
  await expect(page.locator(".xp-roast")).toContainText("não informa a torra");
});

test("Lab: AeroPress over capacity is split into rounds; espresso is per extraction (A01, A02)", async ({
  page,
}) => {
  await page.goto("experiencia/preparar/?metodo=aeropress&modo=water&qtd=400");
  await expect(page.locator(".xp-rounds")).toContainText("2 rodadas");
  await expect(page.locator(".xp-recipe-grid")).toContainText("200");
  await expect(page.locator(".xp-tutorial")).not.toContainText("400 g");
  await page.goto("experiencia/preparar/?metodo=espresso&modo=cups&qtd=2");
  await expect(page.locator(".xp-rounds")).toContainText("2 extrações");
  await expect(page.locator(".xp-recipe-grid")).toContainText("18");
  await expect(page.locator(".xp-tutorial")).not.toContainText("36 g de café");
  await expect(
    page.getByRole("button", { name: "Iniciar ao acionar a extração" }),
  ).toBeVisible();
  await page.goto("experiencia/preparar/?metodo=moka");
  await expect(
    page.getByRole("button", { name: "Iniciar ao levar ao fogo" }),
  ).toBeVisible();
  await expect(page.locator(".xp-recipe")).toContainText("água fria");
});

test("calculator shares the engine's rounding and handles invalid input (A03)", async ({
  page,
}) => {
  await page.goto(
    "experiencia/preparar/?cafe=salsa&metodo=melitta&modo=water&qtd=250",
  );
  await expect(page.locator(".xp-recipe-grid")).toContainText("15,5");
  await expect(page.locator(".xp-recipe-grid")).toContainText("250");
  await expect(page.locator(".xp-recipe-grid")).toContainText("efetiva 1:16,1");
  const calc = page.locator(".xp-calc");
  await expect(calc.getByLabel("Café (g)")).toHaveValue("15,5");
  await expect(calc.getByLabel(/Água/)).toHaveValue("250");
  await calc.getByLabel("Café (g)").fill("20");
  await calc.getByRole("button", { name: /1:15/ }).click();
  await expect(calc.getByLabel(/Água/)).toHaveValue("300");
  await calc.getByLabel(/Água/).fill("320");
  await calc.getByRole("button", { name: /1:16/ }).click();
  await calc.getByLabel(/Água/).fill("320");
  await expect(calc.getByLabel("Café (g)")).toHaveValue("20");
  await calc.getByLabel("Café (g)").fill("0");
  await expect(calc.getByLabel(/Água/)).toHaveValue("");
  await expect(calc.locator(".xp-calc-error")).toBeVisible();
});

test("Phase K scenario: QR → SALSA → V60 250 g → timer → bitter → adjusted retry → save → journal → Barista", async ({
  page,
}) => {
  test.skip(!salsa, "SALSA não publicado");
  await page.clock.install();
  await page.goto("experiencia/?origem=qr");
  await page.getByRole("button", { name: /SALSA/ }).click();
  await page.getByRole("link", { name: /Quero preparar meu café/ }).click();
  await page.locator(".xp-method-card", { hasText: "V60" }).click();
  await page.getByRole("button", { name: "Pela água" }).click();
  await page.getByLabel(/Água que tenho/).fill("250");
  const grid = page.locator(".xp-recipe-grid");
  await expect(grid).toContainText("15,5");
  await expect(page).toHaveURL(/cafe=salsa&metodo=v60&modo=water&qtd=250/);
  // Guided preparation with the timer.
  const timer = page.locator(".xp-timer");
  await timer.getByRole("button", { name: "Iniciar ao molhar o pó" }).click();
  await page.clock.runFor(50_000);
  await expect(timer.locator(".xp-timer-clock")).toHaveText("0:50");
  await expect(page.locator(".xp-tutorial li.is-active")).toContainText(
    "Primeiro despejo",
  );
  await timer.getByRole("button", { name: "Pausar" }).click();
  await page.getByRole("button", { name: "Terminei o preparo" }).click();
  // Diagnosis → structured adjustment → new attempt.
  await page
    .locator(".xp-diagnosis .xp-choice", { hasText: "Muito amargo" })
    .click();
  await expect(page.locator(".xp-suggestion").first()).toContainText(/moagem/i);
  await page
    .getByRole("button", { name: "Preparar de novo com este ajuste" })
    .click();
  await expect(page.locator(".xp-adjusted")).toContainText(
    "moagem um pouco mais grossa",
  );
  await expect(grid).toContainText("15,5");
  // Save the recipe and check the journal.
  await page.getByRole("button", { name: "Salvar receita" }).click();
  await expect(page.getByText("Receita salva em Minha jornada.")).toBeVisible();
  await page.goto("experiencia/minha-jornada/");
  await expect(page.locator(".xp-journal-card").first()).toContainText(
    "SALSA · V60",
  );
  await expect(page.locator("body")).toContainText("Resultado: Muito amargo");
  await expect(page.locator("body")).toContainText("Ajuste sugerido");
  await expect(page.locator(".xp-next-coffee")).toBeVisible();
  // Back in the Lab, the saved recipe reopens with the same numbers.
  await page.getByRole("link", { name: "Preparar de novo" }).first().click();
  await expect(page.locator(".xp-recipe-grid")).toContainText("15,5");
  // Barista (guided in the static build) uses the context from the diagnosis link.
  await page.goto(
    "experiencia/barista/?cafe=salsa&metodo=v60&modo=water&qtd=250&problema=amargo",
  );
  await expect(page.locator(".xp-mode")).toContainText("MODO GUIADO · SEM IA");
  await expect(page.getByLabel("Escreva sua pergunta")).toHaveValue(
    "Por que meu café ficou amargo?",
  );
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.locator(".xp-msg.is-barista").last()).toContainText(
    "já moído ou mói na hora",
  );
  await page
    .locator(".xp-chat-chips button", { hasText: "Mói na hora" })
    .click();
  const answer = page.locator(".xp-msg.is-barista").last();
  await expect(answer).toContainText("Comece por aqui");
  await expect(
    answer.getByRole("link", {
      name: /Preparar de novo com este ajuste|Abrir o Laboratório/,
    }),
  ).toBeVisible();
});

test("Barista (guided) answers a compound question with the Lab's numbers and a working link", async ({
  page,
}) => {
  await page.goto("experiencia/barista/");
  await page
    .getByLabel("Escreva sua pergunta")
    .fill("Tenho SALSA, V60 e 250 ml de água. Quanto café uso?");
  await page.getByRole("button", { name: "Enviar" }).click();
  const answer = page.locator(".xp-msg.is-barista").last();
  await expect(answer).toContainText("15,5 g de café para 250 g de água");
  await answer.getByRole("link", { name: /Abrir no Laboratório/ }).click();
  await expect(page).toHaveURL(/metodo=v60&modo=water&qtd=250/);
  await expect(page.locator(".xp-recipe-grid")).toContainText("15,5");
});

test("simulator controls have accessible names and the quiz never traps (A08, A09, A13)", async ({
  page,
}) => {
  await page.goto("experiencia/aprender/ciencia-do-cafe/");
  for (const name of [
    /Moagem/,
    /Temperatura da água/,
    /Tempo de contato/,
    /Proporção café\/água/,
  ])
    await expect(page.getByRole("slider", { name })).toBeVisible();
  await page.getByRole("slider", { name: /Moagem/ }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("slider", { name: /Moagem/ })).toHaveAttribute(
    "aria-valuetext",
    /Fina/,
  );
  await page.goto("experiencia/paladar/");
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: /Pular/ }).click();
  await page.getByRole("button", { name: /Pular e ver meu perfil/ }).click();
  await expect(page.locator(".xp-quiz [role=alert]")).toContainText(
    "responda pelo menos uma pergunta",
  );
  await page.locator(".xp-choice").first().click();
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: /Próxima|Pular/ }).click();
  await page.getByRole("button", { name: /ver meu perfil/i }).click();
  await expect(page.locator("#quiz-result")).toBeVisible();
  await expect(page.locator(".xp-quiz-result")).not.toContainText(
    "Comprar novamente",
  );
  // With the real catalogue there is a recommendation, worded for a first purchase.
  if (salsa)
    await expect(page.locator(".xp-quiz-result")).toContainText("Experimentar o");
});

for (const width of [320, 375])
  test(`small screens (${width} px): main flow has no horizontal scroll (A10)`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    for (const path of [
      "experiencia/",
      ...(first ? [`experiencia/cafes/${first.slug}/`] : []),
      "experiencia/preparar/?metodo=melitta&modo=water&qtd=250",
      "experiencia/preparar/?metodo=espresso&modo=cups&qtd=2",
      "experiencia/barista/",
      "experiencia/minha-jornada/",
      "experiencia/aprender/ciencia-do-cafe/",
    ]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: window.innerWidth,
      }));
      expect(overflow.scroll, path).toBeLessThanOrEqual(overflow.width);
    }
    await context.close();
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
  await expect(page).toHaveURL(/experiencia\/preparar\//);
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

test("every experience route is noindex (discoverability only, not access control)", async ({
  page,
}) => {
  for (const path of pages) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
});

test("the experience is reachable only by the QR link: no public entry points", async ({
  page,
  request,
}) => {
  const publicPages = [
    "./",
    "cafes/",
    ...coffees.map((coffee) => `cafes/${coffee.slug}/`),
    "descubra/",
    "comparar/",
    "historia/",
    "clube/",
    "empresas/",
  ];
  for (const path of publicPages) {
    await page.goto(path);
    await expect(page.locator('a[href*="/experiencia"]')).toHaveCount(0);
  }
  const sitemap = await (await request.get("sitemap.xml")).text();
  expect(sitemap).toContain("<urlset");
  expect(sitemap).not.toContain("experiencia");
});
