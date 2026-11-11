// Lightweight Portuguese entity extraction for the guided Barista (no AI).
// It reads what the person already said — coffee, method, quantities,
// symptom, espresso measurements — so a compound question is answered as a
// whole instead of being reduced to its first recognisable word.
export type Quantity =
  | { kind: "water"; grams: number }
  | { kind: "coffee"; grams: number }
  | { kind: "servings"; count: number };

export type Entities = {
  coffee?: string;
  coffees: string[];
  method?: string;
  quantity?: Quantity;
  problem?: "amargo" | "azedo" | "fraco" | "forte";
  /** Espresso measurements, when given ("15 g", "42 g em 18 s"). */
  espresso?: {
    dose?: number;
    yieldGrams?: number;
    seconds?: number;
    pressurized: boolean;
  };
  wantsSweet: boolean;
  wantsLessAcid: boolean;
  wantsFruity: boolean;
};

export const normalize = (value: string) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const methodAliases: [string, RegExp][] = [
  ["v60", /\bv ?60\b|\bhario\b/],
  ["melitta", /\bmelitta\b|filtro de papel|coador|\bcoado\b|filtro de pano/],
  ["prensa-francesa", /prensa|french press/],
  ["moka", /\bmoka\b|italiana/],
  ["aeropress", /aero ?press/],
  [
    "espresso",
    /espresso|expresso|porta.?filtro|cesto (duplo|simples|pressurizado)|pressurizad|maquina de cafe espresso|primalatte/,
  ],
  ["cafeteira-eletrica", /cafeteira eletrica|eletrica/],
  ["cold-brew", /cold ?brew|extracao a frio/],
];
const problemPatterns: [NonNullable<Entities["problem"]>, RegExp][] = [
  ["amargo", /amarg|queimad|adstring|seca a boca/],
  ["azedo", /azed|acido demais|muito acido|acidez demais|vinagre/],
  ["fraco", /fraco|aguado|ralo|sem gosto|sem sabor/],
  ["forte", /forte demais|muito forte|concentrado demais|pesado demais/],
];
const numberWords: Record<string, number> = {
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};
const num = (raw: string) => numberWords[raw] ?? Number(raw.replace(",", "."));

export function extractEntities(
  text: string,
  coffeeNames: { slug: string; name: string }[],
): Entities {
  const value = normalize(text);
  const coffees = coffeeNames
    .filter((item) => new RegExp(`\\b${normalize(item.name)}\\b`).test(value))
    .map((item) => item.slug);
  const method = methodAliases.find(([, pattern]) => pattern.test(value))?.[0];
  const n =
    "(\\d+(?:[.,]\\d+)?|uma|um|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez)";
  let quantity: Quantity | undefined;
  const water =
    value.match(
      new RegExp(`${n} ?(ml|mililitros?|litros?|l\\b|g|gramas?) de agua`),
    ) ?? value.match(new RegExp(`${n} ?(ml|mililitros?|litros?)\\b`));
  const coffee = value.match(new RegExp(`${n} ?(g|gramas?) de (cafe|po)`));
  const servings = value.match(
    new RegExp(
      `${n} (xicaras?|pessoas?|copos?|canecas?|porcoes?|doses?|espressos?)\\b`,
    ),
  );
  if (water) {
    const amount = num(water[1]);
    const litres = /^l|litro/.test(water[2]);
    quantity = { kind: "water", grams: litres ? amount * 1000 : amount };
  } else if (coffee) quantity = { kind: "coffee", grams: num(coffee[1]) };
  else if (servings) quantity = { kind: "servings", count: num(servings[1]) };
  const problem = problemPatterns.find(([, pattern]) =>
    pattern.test(value),
  )?.[0];
  let espresso: Entities["espresso"];
  if (method === "espresso") {
    const grams = [...value.matchAll(/(\d+(?:[.,]\d+)?) ?g\b/g)].map((m) =>
      num(m[1]),
    );
    const seconds = value.match(/(\d+) ?(s|seg|segundos)\b/);
    espresso = {
      dose: grams[0],
      yieldGrams: grams[1],
      seconds: seconds ? Number(seconds[1]) : undefined,
      pressurized: /pressurizad|parede dupla/.test(value),
    };
    if (espresso.dose !== undefined && quantity?.kind === "coffee")
      quantity = undefined;
  }
  return {
    coffee: coffees[0],
    coffees,
    method,
    quantity:
      quantity &&
      (quantity.kind === "servings" ? quantity.count > 0 : quantity.grams > 0)
        ? quantity
        : undefined,
    problem,
    espresso,
    wantsSweet: /mais doce|docura|adocicado|doce/.test(value),
    wantsLessAcid: /menos acid|pouca acidez|sem acidez|nao gosto de acid/.test(
      value,
    ),
    wantsFruity: /frutad|citric|fruta/.test(value) && !/menos frut/.test(value),
  };
}

export type Intent =
  | "recipe"
  | "diagnose"
  | "compare"
  | "recommend"
  | "coffee-info"
  | "capacity"
  | "methods"
  | "grind"
  | "topic";

/** Ordered rules: the intent wins over the entity (audit A06/A07). */
export function detectIntent(text: string, entities: Entities): Intent {
  const value = normalize(text);
  if (/nao comporta|nao cabe|transborda|capacidade/.test(value))
    return "capacity";
  if (
    entities.problem ||
    /(ficou|esta|saiu|saindo) (ruim|estranho)/.test(value)
  )
    return "diagnose";
  if (
    entities.coffees.length >= 2 ||
    // Coffee names come from the published catalog (entities), never from
    // a fixed list: "diferença entre o <café> e …" works for any coffee.
    (entities.coffees.length >= 1 && /diferenca entre/.test(value)) ||
    /compar/.test(value)
  )
    return "compare";
  if (/qual moagem|que moagem|moagem (devo|uso|usar|ideal)/.test(value))
    return "grind";
  if (
    entities.quantity ||
    /quanto (de )?(cafe|po|agua)|receita|proporc|quantas gramas|como (faco|fazer|preparo|preparar)|preparar (para|pra)|fazer (para|pra)/.test(
      value,
    )
  )
    return "recipe";
  if (
    /combina|recomend|indica|qual (cafe|devo comprar)|mais doce|menos acid|meu paladar|para mim/.test(
      value,
    )
  )
    return "recommend";
  if (/qual metodo|que metodo|qual equipamento|qual cafeteira/.test(value))
    return "methods";
  if (entities.coffee && !/(o que|qual a diferenca|significa)/.test(value))
    return "coffee-info";
  return "topic";
}
