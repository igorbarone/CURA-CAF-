import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "../../lib/content-loader";
import { publishedCatalog } from "../../lib/catalog-model";
import {
  toExperienceCoffee,
  hasCoordinates,
} from "../../lib/experience/coffee";
import { loadExperience } from "../../lib/experience/content";
import {
  coffeeFor,
  formatClock,
  formatRatio,
  generateRecipe,
  methodFit,
  ratioFor,
  timerPosition,
  waterFor,
} from "../../lib/experience/brew";
import { diagnose } from "../../lib/experience/diagnosis";
import { coffeeTraits, recommendByTaste } from "../../lib/experience/taste";
import { createBarista, type BaristaFlow } from "../../lib/experience/barista";
import { productHref } from "../../lib/experience/analytics";

const experience = loadExperience();
const coffees = publishedCatalog(loadContent()).map(toExperienceCoffee);
const method = (id: string) => {
  const found = experience.methods.find((item) => item.id === id);
  assert.ok(found, id);
  return found;
};
const bySlug = (slug: string) => {
  const found = coffees.find((coffee) => coffee.slug === slug);
  assert.ok(found, slug);
  return found;
};

test("ratio calculator: Água = Café × Proporção, in both directions", () => {
  assert.equal(waterFor(20, 15), 300);
  assert.equal(waterFor(15, 16), 240);
  assert.equal(coffeeFor(300, 15), 20);
  assert.equal(coffeeFor(250, 16), 15.5); // 15.625 rounded to 0.5 g
  assert.equal(ratioFor(20, 300), 15);
  assert.equal(ratioFor(18, 36), 2);
  for (const invalid of [0, -1, Number.NaN]) {
    assert.equal(waterFor(invalid, 15), 0);
    assert.equal(coffeeFor(invalid, 15), 0);
    assert.equal(ratioFor(invalid, 300), 0);
  }
  assert.equal(formatRatio(15), "1:15");
  assert.equal(formatRatio(2.5), "1:2,5");
});

test("recipes follow the chosen input mode and strength", () => {
  const v60 = method("v60");
  const byCups = generateRecipe(
    v60,
    { mode: "cups", amount: 2 },
    "equilibrado",
  );
  assert.equal(byCups.waterGrams, 300);
  assert.equal(byCups.ratio, 16);
  assert.equal(byCups.coffeeGrams, 19); // 18.75 → 19
  const byCoffee = generateRecipe(
    v60,
    { mode: "coffee", amount: 20 },
    "intenso",
  );
  assert.deepEqual(
    [byCoffee.coffeeGrams, byCoffee.waterGrams, byCoffee.ratio],
    [20, 300, 15],
  );
  const byWater = generateRecipe(v60, { mode: "water", amount: 340 }, "suave");
  assert.deepEqual([byWater.coffeeGrams, byWater.waterGrams], [20, 340]);
  // A lighter preference always means more water per gram of coffee.
  for (const item of experience.methods)
    assert.ok(
      item.ratio.suave >= item.ratio.equilibrado &&
        item.ratio.equilibrado >= item.ratio.intenso,
    );
});

test("espresso ratio describes the beverage yield and a cup is one dose", () => {
  const recipe = generateRecipe(method("espresso"), {
    mode: "cups",
    amount: 1,
  });
  assert.equal(recipe.ratioMeaning, "beverage");
  assert.equal(recipe.coffeeGrams, 18);
  assert.equal(recipe.waterGrams, 36);
  assert.match(recipe.steps.at(-1)!.text, /36 g de bebida/);
});

test("V60 timer schedule: bloom 2–3× the dose, ordered pours, ends at the total water", () => {
  const recipe = generateRecipe(
    method("v60"),
    { mode: "coffee", amount: 20 },
    "intenso",
  );
  const pours = recipe.schedule.filter(
    (step) => step.targetGrams !== undefined,
  );
  assert.equal(pours[0].targetGrams, 50); // 20 g × 2.5
  assert.ok(pours[0].targetGrams! >= 40 && pours[0].targetGrams! <= 60);
  for (let i = 1; i < pours.length; i++) {
    assert.ok(pours[i].at > pours[i - 1].at);
    assert.ok(pours[i].targetGrams! > pours[i - 1].targetGrams!);
  }
  assert.equal(pours.at(-1)!.targetGrams, 300);
  assert.ok(recipe.schedule.every((step) => !/\{\w+\}/.test(step.text)));
  assert.equal(recipe.totalSeconds, 210);
});

test("every method renders complete steps without unfilled placeholders", () => {
  for (const item of experience.methods)
    for (const strength of ["suave", "equilibrado", "intenso"] as const) {
      const recipe = generateRecipe(
        item,
        { mode: "cups", amount: 1 },
        strength,
      );
      assert.ok(recipe.coffeeGrams > 0 && recipe.waterGrams > 0, item.id);
      for (const step of recipe.steps)
        assert.doesNotMatch(step.text, /\{\w+\}/, `${item.id}: ${step.text}`);
      if (item.timer) assert.ok(recipe.schedule.length > 0, item.id);
      else assert.equal(recipe.totalSeconds, null);
    }
});

test("recipes warn about equipment capacity and tiny doses instead of failing", () => {
  assert.equal(
    generateRecipe(method("aeropress"), { mode: "water", amount: 500 }).warnings
      .length,
    1,
  );
  assert.equal(
    generateRecipe(method("v60"), { mode: "coffee", amount: 3 }).warnings
      .length,
    1,
  );
  assert.deepEqual(
    generateRecipe(method("v60"), { mode: "cups", amount: 2 }).warnings,
    [],
  );
  assert.equal(
    generateRecipe(method("v60"), { mode: "coffee", amount: Number.NaN })
      .coffeeGrams,
    0,
  );
});

test("timer position follows the schedule", () => {
  const schedule = generateRecipe(method("v60"), {
    mode: "coffee",
    amount: 20,
  }).schedule;
  assert.equal(timerPosition(schedule, 0).current, 0);
  const at50 = timerPosition(schedule, 50);
  assert.equal(at50.step?.title, "Primeiro despejo");
  assert.equal(at50.next?.title, "Despejo final");
  assert.equal(at50.secondsToNext, 25);
  assert.equal(timerPosition(schedule, 9999).next, undefined);
  assert.equal(formatClock(75), "1:15");
  assert.equal(formatClock(43200), "12:00:00");
});

test("label fit comes from the printed preparations, never from names", () => {
  assert.equal(methodFit(method("v60"), bySlug("samba")), "label");
  assert.equal(methodFit(method("espresso"), bySlug("salsa")), "label");
  assert.equal(
    methodFit(method("prensa-francesa"), bySlug("samba")),
    "experiment",
  );
  assert.equal(methodFit(method("v60"), bySlug("da-casa")), "unknown");
});

test("experience projection exposes only confirmed label data and hides the rest", () => {
  const samba = bySlug("samba");
  assert.equal(samba.score, 84);
  assert.equal(samba.category, "Café especial");
  assert.equal(samba.origin?.region, "Campos Altos – MG");
  assert.equal(samba.origin?.altitudeMeters, 1200);
  assert.equal(samba.origin?.farm, undefined);
  assert.equal(samba.process, "Natural");
  assert.equal(samba.variety, "Catucaí");
  assert.deepEqual(samba.origin?.producers, ["Mauricio Lemos", "Diego Campos"]);
  assert.equal(bySlug("salsa").origin?.farm, "Fazenda Serrinha");
  assert.equal(bySlug("salsa").score, 86);
  const casa = bySlug("da-casa");
  assert.equal(casa.category, "Café gourmet");
  assert.equal(casa.score, undefined);
  assert.equal(casa.origin, undefined);
  assert.equal(casa.sensory, undefined);
  // No coordinates were published, so the map stays hidden for every coffee.
  assert.ok(coffees.every((coffee) => !hasCoordinates(coffee)));
  assert.ok(coffees.every((coffee) => coffee.sensory?.levels === undefined));
  assert.ok(
    coffees.every((coffee) => coffee.productUrl === `/cafes/${coffee.slug}/`),
  );
});

test("diagnosis asks to change one variable, starting with method-specific advice", () => {
  const bitter = diagnose(experience.diagnosis, "amargo", "v60");
  assert.ok(bitter);
  assert.equal(bitter.first?.variable, "moagem");
  assert.ok(bitter.checks.length > 1, "investigates several causes");
  assert.match(bitter.oneVariable, /uma coisa por vez/);
  const press = diagnose(experience.diagnosis, "amargo", "prensa-francesa");
  assert.match(press!.first!.text, /prensa francesa/);
  assert.ok(!press!.then.some((item) => item.variable === "moagem"));
  const espresso = diagnose(experience.diagnosis, "amargo", "espresso");
  assert.match(espresso!.first!.text, /espresso/);
  assert.ok(!espresso!.then.some((item) => /ferver/.test(item.text)));
  assert.equal(diagnose(experience.diagnosis, "inexistente"), null);
  for (const option of experience.diagnosis.options)
    assert.ok(
      diagnose(experience.diagnosis, option.id, "melitta")?.first,
      option.id,
    );
});

test("taste quiz finds traits only in published attributes and explains each one", () => {
  assert.deepEqual(
    coffeeTraits(bySlug("da-casa"), experience.taste).map((t) => t.trait),
    ["dia-a-dia"],
  );
  const salsaTraits = coffeeTraits(bySlug("salsa"), experience.taste).map(
    (t) => t.trait,
  );
  assert.ok(salsaTraits.includes("frutado") && salsaTraits.includes("acido"));
  const explorer = recommendByTaste(coffees, experience.taste, {
    frutado: "adoro",
    acidez: "sim",
    novidade: "novidades",
  });
  assert.equal(explorer.profile?.id, "explorador");
  assert.equal(explorer.recommendations[0].coffee.slug, "salsa");
  assert.ok(
    explorer.recommendations[0].reasons.every((reason) =>
      /: /.test(reason.evidence),
    ),
  );
  const classic = recommendByTaste(coffees, experience.taste, {
    "docura-ou-intensidade": "doces",
    frutado: "prefiro-nao",
    novidade: "familiar",
  });
  assert.equal(classic.profile?.id, "classico");
  assert.equal(classic.recommendations[0].coffee.slug, "samba");
  assert.deepEqual(recommendByTaste(coffees, experience.taste, {}), {
    profile: null,
    recommendations: [],
  });
  assert.deepEqual(
    recommendByTaste([], experience.taste, { frutado: "adoro" })
      .recommendations,
    [],
  );
});

test("Barista asks before diagnosing and follows the conversation", () => {
  const barista = createBarista({ ...experience, coffees });
  const first = barista.respond(
    { kind: "idle" },
    { text: "Meu café está saindo muito amargo." },
  );
  assert.match(first.text[0], /Qual método/);
  assert.equal(first.flow.kind, "diagnosis");
  const second = barista.respond(first.flow, { text: "Melitta" });
  assert.match(second.text[0], /já moído ou mói na hora/);
  const third = barista.respond(second.flow, { value: "grind:pre" });
  assert.equal(third.flow.kind, "idle");
  assert.ok(third.text.some((line) => /Comece por aqui/.test(line)));
  assert.ok(third.text.some((line) => /já vem moído/.test(line)));
  assert.match(third.link!.href, /metodo=melitta/);
});

test("Barista recipes, coffee facts, topics and an honest fallback", () => {
  const barista = createBarista({ ...experience, coffees });
  let flow: BaristaFlow = barista.respond(
    { kind: "idle" },
    { value: "flow:receita" },
  ).flow;
  flow = barista.respond(flow, { text: "uso V60" }).flow;
  const recipe = barista.respond(flow, { text: "2" });
  assert.match(recipe.text[0], /19 g de café para 300 g/);
  const salsa = barista.respond({ kind: "idle" }, { text: "me fala do salsa" });
  assert.ok(salsa.text.some((line) => /Fazenda Serrinha/.test(line)));
  const casa = barista.respond({ kind: "idle" }, { value: "coffee:da-casa" });
  assert.ok(casa.text.some((line) => /não vou inventar/.test(line)));
  assert.ok(!casa.text.some((line) => /pontos|Origem:/.test(line)));
  assert.match(
    barista.respond({ kind: "idle" }, { text: "como conservar o café?" })
      .text[0],
    /embalagem/,
  );
  assert.match(
    barista.respond({ kind: "idle" }, { text: "qual a cotação do dólar?" })
      .text[0],
    /não inventar/,
  );
  const recommend = barista.respond(
    { kind: "recommend" },
    { value: "pref:frutado" },
  );
  assert.match(recommend.text[0], /SALSA/);
});

test("QR attribution only decorates links for QR visits", () => {
  assert.equal(productHref("/cafes/samba/", null), "/cafes/samba/");
  assert.equal(
    productHref("/cafes/samba/", "qr"),
    "/cafes/samba/?utm_source=embalagem&utm_medium=qr&utm_campaign=cura-experience",
  );
});
