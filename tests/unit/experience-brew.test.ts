import assert from "node:assert/strict";
import { test } from "node:test";
import { loadExperience } from "../../lib/experience/content";
import {
  applyAdjustment,
  coffeeFor,
  formatClock,
  formatRatio,
  generateRecipe,
  parseAmount,
  ratioFor,
  summarizeRecipe,
  timerPosition,
  waterFor,
  type BrewParams,
  type Recipe,
} from "../../lib/experience/brew";
import {
  labHref,
  labSearch,
  parseLabSearch,
} from "../../lib/experience/lab-link";

const { methods, diagnosis } = loadExperience();
const method = (id: string) => {
  const found = methods.find((item) => item.id === id);
  assert.ok(found, id);
  return found;
};
const recipe = (params: BrewParams): Recipe => {
  const result = generateRecipe(method(params.methodId), params);
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result;
};

test("calculator primitives: Água = Café × Proporção and the reverse (audit regressions)", () => {
  assert.equal(waterFor(20, 15), 300);
  assert.equal(coffeeFor(320, 16), 20);
  assert.equal(coffeeFor(250, 16), 15.5); // 15,625 → 15,5
  assert.equal(ratioFor(15.5, 250), 16.1);
  for (const invalid of [0, -1, Number.NaN]) {
    assert.equal(waterFor(invalid, 15), 0);
    assert.equal(coffeeFor(invalid, 15), 0);
  }
  assert.equal(parseAmount("15,5"), 15.5);
  assert.equal(parseAmount(" 20 "), 20);
  assert.ok(Number.isNaN(parseAmount("")));
  assert.ok(Number.isNaN(parseAmount("abc")));
  assert.ok(Number.isNaN(parseAmount("-3")));
  assert.equal(formatRatio(2.5), "1:2,5");
});

test("water typed by the person is kept; the dose is flagged as approximate (A03)", () => {
  const r = recipe({ methodId: "melitta", mode: "water", amount: 250 });
  assert.equal(r.total.waterGrams, 250);
  assert.equal(r.total.coffeeGrams, 15.5);
  assert.equal(r.coffeeExact, 15.6);
  assert.equal(r.approximate, true);
  assert.equal(r.effectiveRatio, 16.1);
  assert.equal(r.ratio, 16);
  // Every surface reads the same structured numbers.
  assert.match(
    summarizeRecipe(method("melitta"), r),
    /15,5 g de café para 250 g de água/,
  );
});

test("servings are drink in the cup: brewing water accounts for retention", () => {
  const r = recipe({ methodId: "v60", mode: "cups", amount: 2 });
  // 300 ml in the cup at 1:16 → 300 / 14 = 21,4 g → 21,5 g; water = 21,5 × 16.
  assert.equal(r.total.coffeeGrams, 21.5);
  assert.equal(r.total.waterGrams, 344);
  assert.equal(r.effectiveRatio, 16);
  assert.equal(r.beverageMl, 301);
  // The step targets are cumulative weights on the scale and end at the water.
  const pours = r.schedule.filter((step) => step.targetGrams !== undefined);
  assert.equal(pours[0].targetGrams, 54); // bloom 2,5 × 21,5
  assert.equal(pours.at(-1)?.targetGrams, 344);
  for (let i = 1; i < pours.length; i++) {
    assert.ok(pours[i].at > pours[i - 1].at);
    assert.ok((pours[i].targetGrams ?? 0) > (pours[i - 1].targetGrams ?? 0));
  }
});

test("coffee typed by the person is kept and the water follows the ratio", () => {
  const r = recipe({ methodId: "prensa-francesa", mode: "coffee", amount: 20 });
  assert.deepEqual(
    [r.total.coffeeGrams, r.total.waterGrams, r.effectiveRatio],
    [20, 300, 15],
  );
  assert.equal(r.approximate, false);
});

test("AeroPress never asks for more than one chamber per round (A01)", () => {
  const capacity = method("aeropress").capacity?.maxWaterPerRound ?? 0;
  for (const params of [
    { methodId: "aeropress", mode: "water", amount: 400 },
    { methodId: "aeropress", mode: "cups", amount: 2 },
    { methodId: "aeropress", mode: "coffee", amount: 40 },
  ] as BrewParams[]) {
    const r = recipe(params);
    assert.ok(r.perRound.waterGrams <= capacity, JSON.stringify(params));
    assert.ok(r.rounds >= 2);
    assert.ok(r.steps.every((step) => (step.targetGrams ?? 0) <= capacity));
    assert.match(r.steps[0].text, /rodadas completas/);
    assert.ok(r.warnings.some((warning) => /296 ml/.test(warning)));
  }
  const single = recipe({ methodId: "aeropress", mode: "water", amount: 200 });
  assert.equal(single.rounds, 1);
  assert.equal(single.perRound.waterGrams, 200);
});

test("espresso: one basket dose per extraction, never two doses in one basket (A02)", () => {
  const two = recipe({ methodId: "espresso", mode: "cups", amount: 2 });
  assert.equal(two.rounds, 2);
  assert.equal(two.roundLabel, "extração");
  assert.equal(two.perRound.coffeeGrams, 18);
  assert.equal(two.perRound.waterGrams, 36); // 1:2 yield
  assert.equal(two.total.coffeeGrams, 36);
  assert.equal(two.ratioMeaning, "beverage");
  assert.ok(two.steps.some((step) => /2 extrações/.test(step.text)));
  assert.ok(!two.steps.some((step) => /36 g de café/.test(step.text)));
  assert.ok(
    two.notes.some((note) => /Nunca coloque a dose de duas bebidas/.test(note)),
  );
  const custom = recipe({
    methodId: "espresso",
    mode: "cups",
    amount: 1,
    dose: 15,
  });
  assert.equal(custom.perRound.coffeeGrams, 15);
  assert.equal(custom.perRound.waterGrams, 30);
  assert.equal(
    generateRecipe(method("espresso"), {
      methodId: "espresso",
      mode: "cups",
      amount: 1,
      dose: 40,
    }).ok,
    false,
  );
  assert.equal(
    generateRecipe(method("espresso"), {
      methodId: "espresso",
      mode: "water",
      amount: 36,
    }).ok,
    false,
  );
  // The espresso timer covers 25–32 s and starts at the extraction.
  assert.equal(two.totalSeconds, 32);
  assert.match(method("espresso").timer?.button ?? "", /extração/);
});

test("moka follows the pot and the manufacturer's manual (A04)", () => {
  const moka = method("moka");
  const r = recipe({ methodId: "moka", mode: "size", amount: 3 });
  assert.equal(r.total.coffeeGrams, 16.5);
  assert.equal(r.total.waterGrams, 150);
  assert.equal(r.beverageMl, null);
  assert.ok(r.notes.some((note) => /válvula/.test(note)));
  assert.match(moka.temperature.beginner, /água fria/);
  assert.ok(!JSON.stringify(moka).match(/água (já )?quente na base/));
  assert.ok(r.steps.some((step) => /Nunca cubra a válvula/.test(step.text)));
  assert.equal(
    generateRecipe(moka, { methodId: "moka", mode: "size", amount: 5 }).ok,
    false,
  );
  assert.equal(
    generateRecipe(moka, { methodId: "moka", mode: "cups", amount: 2 }).ok,
    false,
  );
});

test("cold brew separates infusion water, concentrate and ready drink", () => {
  const r = recipe({ methodId: "cold-brew", mode: "cups", amount: 1 });
  // 200 ml of drink = 100 ml concentrate; 100 / (8 − 2) = 16,7 → 16,5 g.
  assert.equal(r.total.coffeeGrams, 16.5);
  assert.equal(r.total.waterGrams, 132);
  assert.equal(r.concentrateMl, 99);
  assert.equal(r.beverageMl, 198);
  assert.equal(r.totalSeconds, null);
  assert.ok(r.steps.some((step) => /99 ml de concentrado/.test(step.text)));
  assert.ok(r.steps.some((step) => /198 ml de bebida pronta/.test(step.text)));
});

test("every method and strength produces complete, coherent recipes", () => {
  for (const item of methods)
    for (const strength of ["suave", "equilibrado", "intenso"] as const) {
      const mode = item.modes[0];
      const amount =
        mode === "size"
          ? (item.moka?.defaultSize ?? 3)
          : mode === "cups"
            ? 1
            : 20;
      const r = recipe({ methodId: item.id, mode, amount, strength });
      assert.ok(r.total.coffeeGrams > 0 && r.total.waterGrams > 0, item.id);
      assert.equal(r.total.coffeeGrams, r.perRound.coffeeGrams * r.rounds);
      assert.equal(r.total.waterGrams, r.perRound.waterGrams * r.rounds);
      for (const step of r.steps)
        assert.doesNotMatch(step.text, /\{\w+\}/, `${item.id}: ${step.text}`);
      if (item.timer) {
        assert.ok(r.schedule.length > 0 && r.totalSeconds, item.id);
        assert.equal(
          r.schedule[0].at,
          0,
          `${item.id}: timer starts at the first real event`,
        );
      } else assert.equal(r.totalSeconds, null);
      if (item.capacity)
        assert.ok(
          r.perRound.waterGrams <= item.capacity.maxWaterPerRound,
          item.id,
        );
    }
});

test("infeasible requests are explicit errors, not silent recipes", () => {
  const v60 = method("v60");
  for (const params of [
    { methodId: "v60", mode: "coffee", amount: 0 },
    { methodId: "v60", mode: "coffee", amount: Number.NaN },
    { methodId: "v60", mode: "coffee", amount: 3 },
    { methodId: "v60", mode: "cups", amount: 40 },
    { methodId: "v60", mode: "water", amount: 9000 },
  ] as BrewParams[]) {
    const result = generateRecipe(v60, params);
    assert.equal(result.ok, false, JSON.stringify(params));
    assert.ok(!result.ok && result.error.length > 10);
  }
  // Over the practical capacity of a V60, the recipe splits into rounds.
  const big = recipe({ methodId: "v60", mode: "water", amount: 900 });
  assert.equal(big.rounds, 2);
  assert.equal(big.perRound.waterGrams, 450);
});

test("ratio overrides are clamped to the method's recommended range", () => {
  const r = recipe({ methodId: "v60", mode: "coffee", amount: 20, ratio: 30 });
  assert.equal(r.ratio, 18);
  assert.ok(r.warnings.some((warning) => /limite recomendado/.test(warning)));
});

test("diagnosis adjustments change the next attempt through the engine", () => {
  const v60 = method("v60");
  const base: BrewParams = {
    methodId: "v60",
    mode: "water",
    amount: 250,
    strength: "equilibrado",
  };
  const weak = applyAdjustment(v60, base, { ratioDelta: -1 });
  assert.equal(weak.params.ratio, 15);
  const next = recipe(weak.params);
  assert.equal(next.total.waterGrams, 250);
  assert.equal(next.total.coffeeGrams, 16.5); // more coffee for the same water
  const bitter = applyAdjustment(v60, base, { grind: "mais-grossa" });
  assert.equal(bitter.params.ratio, undefined);
  assert.deepEqual(bitter.notes, ["Deixe a moagem um pouco mais grossa."]);
  const atLimit = applyAdjustment(
    v60,
    { ...base, ratio: 18 },
    { ratioDelta: 1 },
  );
  assert.equal(atLimit.params.ratio, 18);
  assert.match(atLimit.notes[0], /limite/);
  // Every structured adjustment in the content applies cleanly.
  for (const option of diagnosis.options)
    for (const item of option.adjustments)
      if (item.apply)
        for (const target of item.methods ?? ["v60"]) {
          const m = method(target);
          const params: BrewParams = {
            methodId: target,
            mode: m.modes[0],
            amount: m.modes[0] === "size" ? 3 : 1,
          };
          assert.ok(
            generateRecipe(m, applyAdjustment(m, params, item.apply).params).ok,
            `${option.id}/${target}`,
          );
        }
});

test("timer position follows the schedule", () => {
  const schedule = recipe({
    methodId: "v60",
    mode: "coffee",
    amount: 20,
  }).schedule;
  assert.equal(timerPosition(schedule, 0).current, 0);
  const at50 = timerPosition(schedule, 50);
  assert.equal(at50.step?.title, "Primeiro despejo");
  assert.equal(at50.next?.title, "Despejo final");
  assert.equal(at50.secondsToNext, 25);
  assert.equal(formatClock(43200), "12:00:00");
});

test("Lab links round-trip structured parameters and reject unknown values", () => {
  const known = {
    coffees: ["samba", "salsa"],
    methods: methods.map((m) => m.id),
  };
  const state = {
    coffeeSlug: "salsa",
    methodId: "v60",
    mode: "water" as const,
    amount: 250,
    ratio: 15,
    strength: "intenso" as const,
  };
  assert.deepEqual(parseLabSearch(labSearch(state), known), state);
  assert.equal(
    labHref({ methodId: "espresso", mode: "cups", amount: 2, dose: 16 }),
    "/experiencia/preparar/?metodo=espresso&modo=cups&qtd=2&dose=16",
  );
  assert.deepEqual(
    parseLabSearch(
      "cafe=inexistente&metodo=foo&modo=bar&qtd=-1&intensidade=x",
      known,
    ),
    {},
  );
  // Phase 1 links (`xicaras`) keep working.
  assert.deepEqual(parseLabSearch("metodo=v60&xicaras=2", known), {
    methodId: "v60",
    mode: "cups",
    amount: 2,
  });
});
