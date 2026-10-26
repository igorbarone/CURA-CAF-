import { test, expect } from "@playwright/test";
import { getCatalog, getHomeSelection } from "../lib/coffees";
import { getEditorial } from "../lib/editorial";

const catalog = getCatalog();
test("roast and sensory filters preserve the published lot score and displayed facts", async ({
  page,
}) => {
  await page.goto("cafes/");
  for (const entry of catalog) {
    for (const lot of entry.lots) {
      await page
        .getByLabel("Torra", { exact: true })
        .selectOption(lot.roast ?? "");
      if (lot.profile)
        await page
          .getByRole("button", { name: lot.profile, exact: true })
          .click();
      const matching = entry.lots.filter(
        (item) =>
          (!lot.roast || item.roast === lot.roast) &&
          (!lot.profile || item.profile === lot.profile),
      );
      const expected =
        matching.find((item) => item.id === entry.coffee.primaryLotId) ??
        matching[0];
      const card = page
        .locator(".coffee-card")
        .filter({
          has: page.getByRole("heading", {
            name: entry.coffee.name,
            exact: true,
          }),
        });
      await expect(card.locator(".coffee-info > .eyebrow")).toHaveText(
        expected.code,
      );
      await expect(card.locator(".lot-facts")).toContainText(
        expected.score !== null ? `${expected.score} pontos` : "A confirmar",
      );
      await expect(card.locator(".lot-facts")).toContainText(
        expected.roast ?? "A confirmar",
      );
      await expect(card.locator(".profile-tag")).toHaveText(
        expected.profile ?? "Perfil a confirmar",
      );
      if (expected.code === "CURA-26-02") {
        await expect(card.locator(".lot-facts")).toContainText("86 pontos");
        await expect(card.locator(".lot-facts")).toContainText("Clara");
      }
      await page.getByLabel("Torra", { exact: true }).selectOption("");
      await page.getByRole("button", { name: "Todos", exact: true }).click();
    }
  }
  await expect(page.locator(".coffee-card")).toHaveCount(catalog.length);
});

test("business navigation leads to an honest editorial page without simulated lead collection", async ({
  page,
}, info) => {
  await page.goto("./");
  if (info.project.name === "mobile")
    await page.locator(".mobile-menu summary").click();
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "Principal mobile" : "Principal",
      exact: true,
    })
    .getByRole("link", { name: "Para empresas", exact: true })
    .click();
  await expect(page).toHaveURL(/\/empresas\/$/);
  await expect(
    page.locator(".business-segments .editorial-topics article"),
  ).toHaveCount(getEditorial().business.segments.length);
  await expect(
    page.locator("form, input, textarea, button[type=submit]"),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Conheça a proposta", exact: true })
    .click();
  await expect(page.locator("#proxima-conversa")).toContainText(
    "Ainda não recebemos solicitações por este site.",
  );
  await expect(page.locator("a[href^='mailto:'], a[href^='tel:']")).toHaveCount(
    0,
  );
});

test("Home opens knowledge to everyone and credits only published producers", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".access-section")).toContainText(
    "linguagem, no conhecimento e na experiência",
  );
  const selected = getHomeSelection().entries;
  const names = selected.flatMap((entry) => {
    const lot =
      entry.lots.find((item) => item.id === entry.coffee.primaryLotId) ??
      entry.lots[0];
    return lot?.producers.length ? [lot.producers.join(" e ")] : [];
  });
  await expect(page.locator(".producer-feature h3")).toHaveText(names);
  await expect(page.locator(".producer-feature img")).toHaveCount(0);
});
