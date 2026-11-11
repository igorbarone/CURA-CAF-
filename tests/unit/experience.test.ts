import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "../../lib/content-loader";
import { publishedCatalog } from "../../lib/catalog-model";
import {
  hasCoordinates,
  toExperienceCoffee,
} from "../../lib/experience/coffee";
import { loadExperience } from "../../lib/experience/content";
import { methodFit } from "../../lib/experience/brew";
import { diagnose } from "../../lib/experience/diagnosis";
import { coffeeTraits, recommendByTaste } from "../../lib/experience/taste";
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

test("QR attribution only decorates links for QR visits", () => {
  assert.equal(productHref("/cafes/samba/", null), "/cafes/samba/");
  assert.equal(
    productHref("/cafes/samba/", "qr"),
    "/cafes/samba/?utm_source=embalagem&utm_medium=qr&utm_campaign=cura-experience",
  );
});
