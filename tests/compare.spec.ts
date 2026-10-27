import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getCatalog } from "../lib/coffees";
import { projectCoffee } from "../lib/catalog-model";
const coffees = getCatalog().map((entry) => projectCoffee(entry));
test("catalog cards feed the comparator, which shows published facts side by side", async ({
  page,
}) => {
  test.skip(coffees.length < 2, "Comparação exige ao menos dois cafés");
  const [first, second] = coffees;
  await page.goto("cafes/");
  await page.getByRole("button", { name: `Comparar ${first.name}` }).click();
  await expect(
    page.getByRole("button", { name: `Comparar ${first.name}` }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: `Comparar ${second.name}` }).click();
  const bar = page.getByRole("complementary", {
    name: "Comparação de cafés",
  });
  await expect(bar).toContainText("2 de 3");
  await bar.getByRole("link", { name: "Comparar agora" }).click();
  await expect(page).toHaveURL(
    new RegExp(`comparar/\\?cafes=${first.slug},${second.slug}$`),
  );
  const table = page.getByRole("table");
  for (const coffee of [first, second]) {
    await expect(
      table.getByRole("columnheader", { name: new RegExp(coffee.name) }),
    ).toBeVisible();
    await expect(table).toContainText(coffee.notes);
    await expect(table).toContainText(coffee.producers);
    if (coffee.score !== null)
      await expect(table).toContainText(`${coffee.score} pontos`);
  }
  await expect(
    table.getByRole("row", { name: /Preço e disponibilidade/ }),
  ).toContainText("A confirmar");
  await expect(page.getByText(/R\$/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.getByRole("checkbox", { name: second.name }).uncheck();
  await expect(page).toHaveURL(new RegExp(`comparar/\\?cafes=${first.slug}$`));
  await expect(
    table.getByRole("columnheader", { name: new RegExp(second.name) }),
  ).toHaveCount(0);
});
test("a shared comparison link ignores unknown coffees and the page handles any catalog size", async ({
  page,
}) => {
  await page.goto(
    `comparar/?cafes=${coffees.map((coffee) => coffee.slug).join(",")},nao-existe`,
  );
  if (!coffees.length) {
    await expect(
      page.getByRole("heading", { name: "Novas escolhas estão a caminho." }),
    ).toBeVisible();
    return;
  }
  const shown = coffees.slice(0, 3);
  await expect(page.getByRole("table").getByRole("columnheader")).toHaveCount(
    shown.length,
  );
  await expect(page).not.toHaveURL(/nao-existe/);
  await expect(page.getByText(`(${shown.length} de 3)`)).toBeVisible();
});
