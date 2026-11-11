// Barista Cura — MVP conversation engine.
//
// Deterministic, structured answers built only from the reviewed knowledge
// base (content/experience/barista.json), the published coffees and the brew /
// diagnosis rules. It asks before it diagnoses: a problem report starts a
// short flow (method → grind → suggestion) instead of a precipitated verdict.
//
// The `BaristaProvider` interface is the seam for a future AI integration: a
// server route (never the browser) holds the API key, receives the same
// context, must answer from this knowledge base, and can fall back to this
// local provider. See docs/EXPERIENCIA.md.
import type { ExperienceCoffee } from "./coffee";
import type { BaristaKnowledge, BrewMethod, Diagnosis, Taste } from "./schema";
import { diagnose } from "./diagnosis";
import { formatNumber, formatRatio, generateRecipe } from "./brew";
import { coffeeTraits } from "./taste";

export type BaristaContext = {
  knowledge: BaristaKnowledge;
  coffees: ExperienceCoffee[];
  methods: BrewMethod[];
  diagnosis: Diagnosis;
  taste: Taste;
};
export type BaristaFlow =
  | { kind: "idle" }
  | {
      kind: "diagnosis";
      problem?: string;
      method?: string;
      step: "problem" | "method" | "grind";
    }
  | { kind: "recipe"; method?: string; step: "method" | "cups" }
  | { kind: "recommend" };
export type BaristaChip = { label: string; value: string };
export type BaristaReply = {
  text: string[];
  chips: BaristaChip[];
  link?: { href: string; label: string };
  flow: BaristaFlow;
};
export type BaristaInput = { text?: string; value?: string };
export interface BaristaProvider {
  reply(flow: BaristaFlow, input: BaristaInput): Promise<BaristaReply>;
}

export const FLOW_IDS = [
  "diagnostico",
  "receita",
  "recomendar",
  "metodos",
] as const;
const flowLabels: Record<(typeof FLOW_IDS)[number], string> = {
  diagnostico: "Meu café não ficou bom",
  receita: "Quero uma receita",
  recomendar: "Qual café combina comigo?",
  metodos: "Qual método escolher?",
};

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const problemKeywords: [string, string[]][] = [
  ["amargo", ["amarg", "queimad", "adstring"]],
  ["azedo", ["azed", "acido demais", "muito acido", "azedinho"]],
  ["fraco", ["fraco", "aguado", "ralo", "sem gosto"]],
  ["forte", ["forte demais", "muito forte", "concentrado demais"]],
];
const methodAliases: [string, string[]][] = [
  ["v60", ["v60", "hario"]],
  ["melitta", ["melitta", "filtro de papel", "coador", "coado", "pano"]],
  ["prensa-francesa", ["prensa", "french press"]],
  ["moka", ["moka", "italiana"]],
  ["aeropress", ["aeropress"]],
  ["espresso", ["espresso", "expresso", "maquina de espresso"]],
  ["cafeteira-eletrica", ["eletrica", "cafeteira eletrica"]],
  ["cold-brew", ["cold brew", "coldbrew", "gelado", "frio"]],
];

function detect(table: [string, string[]][], text: string) {
  const value = normalize(text);
  return table.find(([, words]) =>
    words.some((word) => value.includes(word)),
  )?.[0];
}

export function createBarista(context: BaristaContext) {
  const { knowledge, coffees, methods } = context;
  const topic = (id: string) => knowledge.topics.find((item) => item.id === id);
  const chipFor = (id: string): BaristaChip | null => {
    if ((FLOW_IDS as readonly string[]).includes(id))
      return {
        label: flowLabels[id as (typeof FLOW_IDS)[number]],
        value: `flow:${id}`,
      };
    const found = topic(id);
    return found ? { label: found.label, value: `topic:${id}` } : null;
  };
  const chips = (ids: string[]) =>
    ids.map(chipFor).filter((chip): chip is BaristaChip => chip !== null);
  const starters = () => chips(knowledge.starters);
  const methodChips = () =>
    methods.map((method) => ({
      label: method.name,
      value: `method:${method.id}`,
    }));
  const idle: BaristaFlow = { kind: "idle" };

  function greeting(): BaristaReply {
    return { text: [knowledge.greeting], chips: starters(), flow: idle };
  }

  function describeCoffee(coffee: ExperienceCoffee): BaristaReply {
    const facts = [
      coffee.category,
      coffee.score !== undefined ? `${coffee.score} pontos SCA` : null,
      coffee.roast ? `torra ${coffee.roast.toLocaleLowerCase("pt-BR")}` : null,
    ].filter(Boolean);
    const origin = [
      coffee.origin?.farm,
      coffee.origin?.region,
      coffee.origin?.altitudeMeters
        ? `${formatNumber(coffee.origin.altitudeMeters)} m`
        : null,
    ].filter(Boolean);
    const text = [
      `${coffee.name}: ${coffee.description}`,
      facts.join(" · ") + ".",
    ];
    if (coffee.sensory?.notes?.length)
      text.push(`Notas do rótulo: ${coffee.sensory.notes.join(", ")}.`);
    if (origin.length) text.push(`Origem: ${origin.join(" · ")}.`);
    if (coffee.origin?.producers?.length)
      text.push(`Quem produz: ${coffee.origin.producers.join(" e ")}.`);
    if (coffee.preparations.length)
      text.push(
        `O rótulo sugere: ${coffee.preparations.join(" e ").toLocaleLowerCase("pt-BR")}.`,
      );
    if (!coffee.score && !coffee.sensory?.notes?.length && !coffee.origin)
      text.push(
        "Ainda não temos notas, origem ou pontuação publicadas para este café, e eu não vou inventar.",
      );
    return {
      text,
      chips: [
        { label: `Preparar ${coffee.name}`, value: "flow:receita" },
        ...starters().slice(0, 2),
      ],
      link: {
        href: `/experiencia/cafes/${coffee.slug}/`,
        label: `Conhecer o ${coffee.name}`,
      },
      flow: idle,
    };
  }

  function diagnosisStep(
    flow: Extract<BaristaFlow, { kind: "diagnosis" }>,
    grind?: string,
  ): BaristaReply {
    if (!flow.problem)
      return {
        text: ["Vamos descobrir o motivo. Como ficou o seu café?"],
        chips: context.diagnosis.options.map((option) => ({
          label: option.label,
          value: `problem:${option.id}`,
        })),
        flow: { ...flow, step: "problem" },
      };
    if (!flow.method)
      return {
        text: ["Entendi. Qual método você está usando?"],
        chips: methodChips(),
        flow: { ...flow, step: "method" },
      };
    if (!grind && ["amargo", "azedo", "fraco"].includes(flow.problem))
      return {
        text: ["Você utiliza café já moído ou mói na hora?"],
        chips: [
          { label: "Mói na hora", value: "grind:fresh" },
          { label: "Já moído", value: "grind:pre" },
          { label: "Não sei", value: "grind:unknown" },
        ],
        flow: { ...flow, step: "grind" },
      };
    const result = diagnose(context.diagnosis, flow.problem, flow.method);
    const method = methods.find((item) => item.id === flow.method);
    if (!result) return greeting();
    const text = [result.summary];
    if (grind === "pre")
      text.push(
        "Como o café já vem moído, a moagem pode não ser a ideal para o seu método, e o pó perde frescor mais rápido. Se puder, peça a moagem específica para o método ou moa na hora.",
      );
    if (method && result.id !== "equilibrado" && result.id !== "nao-sei")
      text.push(
        `Referência para ${method.name}: moagem ${method.grind.beginner.toLocaleLowerCase("pt-BR")} Tempo: ${method.time.label}.`,
      );
    if (result.first) text.push(`Comece por aqui: ${result.first.text}`);
    if (result.then.length)
      text.push(`Se não resolver: ${result.then[0].text}`);
    if (result.id !== "equilibrado") text.push(result.oneVariable);
    return {
      text,
      chips: [
        { label: "Outro problema", value: "flow:diagnostico" },
        { label: "Quero uma receita", value: "flow:receita" },
      ],
      link: {
        href: `/experiencia/preparar/?metodo=${flow.method}`,
        label: "Abrir o Laboratório de Preparo",
      },
      flow: idle,
    };
  }

  function recipeStep(
    flow: Extract<BaristaFlow, { kind: "recipe" }>,
    cups?: number,
  ): BaristaReply {
    const method = methods.find((item) => item.id === flow.method);
    if (!method)
      return {
        text: ["Qual equipamento você tem?"],
        chips: methodChips(),
        flow: { kind: "recipe", step: "method" },
      };
    if (!cups)
      return {
        text: [
          method.cupIsDose
            ? `Ótimo: ${method.name}. Quantas doses você quer preparar?`
            : `Ótimo: ${method.name}. Quantas porções (${method.cup.label}) você quer preparar?`,
        ],
        chips: [1, 2, 3, 4].map((n) => ({
          label: String(n),
          value: `cups:${n}`,
        })),
        flow: { kind: "recipe", method: method.id, step: "cups" },
      };
    const recipe = generateRecipe(
      method,
      { mode: "cups", amount: cups },
      "equilibrado",
    );
    const water =
      recipe.ratioMeaning === "beverage"
        ? `${formatNumber(recipe.waterGrams)} g de bebida na xícara`
        : `${formatNumber(recipe.waterGrams)} g (ml) de água`;
    return {
      text: [
        `Ponto de partida para ${method.name}: ${formatNumber(recipe.coffeeGrams)} g de café para ${water} (proporção ${formatRatio(recipe.ratio)}).`,
        `Moagem: ${method.grind.beginner} ${method.temperature.beginner} Tempo: ${method.time.label}.`,
        ...(method.capacityNote ? [method.capacityNote] : []),
        "É um ponto de partida: ajuste ao seu gosto, uma variável por vez.",
      ],
      chips: [
        { label: "Mais suave ou mais intenso?", value: "topic:moagem" },
        { label: "Meu café não ficou bom", value: "flow:diagnostico" },
      ],
      link: {
        href: `/experiencia/preparar/?metodo=${method.id}&xicaras=${cups}`,
        label: "Preparar com passo a passo e cronômetro",
      },
      flow: idle,
    };
  }

  function recommend(text?: string): BaristaReply {
    const preferences: [string, string, string[]][] = [
      ["doce", "Doce e confortável", ["doce"]],
      ["frutado", "Frutado e vivo", ["frutado", "acido"]],
      ["dia", "Para o dia a dia", ["dia-a-dia"]],
    ];
    const chosen = text ? preferences.find(([id]) => id === text) : undefined;
    if (!chosen)
      return {
        text: ["Me conta: o que você procura na xícara?"],
        chips: preferences.map(([id, label]) => ({
          label,
          value: `pref:${id}`,
        })),
        link: {
          href: "/experiencia/paladar/",
          label: "Ou faça o quiz completo de paladar",
        },
        flow: { kind: "recommend" },
      };
    const matches = coffees
      .map((coffee) => ({
        coffee,
        reasons: coffeeTraits(coffee, context.taste).filter((item) =>
          chosen[2].includes(item.trait),
        ),
      }))
      .filter((item) => item.reasons.length);
    if (!matches.length)
      return {
        text: [
          "Nenhum café publicado tem essa característica cadastrada agora. Que tal conhecer a seleção completa?",
        ],
        chips: starters().slice(0, 3),
        link: { href: "/experiencia/cafes/", label: "Ver os cafés" },
        flow: idle,
      };
    const best = matches[0];
    return {
      text: [
        `Pelo que está publicado, o ${best.coffee.name} combina com “${chosen[1].toLocaleLowerCase("pt-BR")}”.`,
        `Por quê: ${best.reasons.map((reason) => reason.evidence).join("; ")}.`,
        ...(matches.length > 1
          ? [
              `Também vale provar: ${matches
                .slice(1)
                .map((item) => item.coffee.name)
                .join(", ")}.`,
            ]
          : []),
      ],
      chips: [
        {
          label: `Mais sobre o ${best.coffee.name}`,
          value: `coffee:${best.coffee.slug}`,
        },
        { label: "Quero uma receita", value: "flow:receita" },
      ],
      link: {
        href: `/experiencia/cafes/${best.coffee.slug}/`,
        label: `Conhecer o ${best.coffee.name}`,
      },
      flow: idle,
    };
  }

  function methodsOverview(): BaristaReply {
    return {
      text: [
        "Depende do que você tem em casa e do que gosta na xícara:",
        ...methods.map((method) => `${method.name}: ${method.summary}`),
        "Me diga qual equipamento você tem e eu monto uma receita.",
      ],
      chips: methodChips(),
      flow: { kind: "recipe", step: "method" },
    };
  }

  function topicReply(id: string): BaristaReply {
    const found = topic(id);
    if (!found) return greeting();
    return {
      text: found.answer,
      chips: chips(
        found.followUps.length
          ? found.followUps
          : knowledge.starters.slice(0, 3),
      ),
      link: found.link,
      flow: idle,
    };
  }

  function startFlow(id: string): BaristaReply {
    if (id === "diagnostico")
      return diagnosisStep({ kind: "diagnosis", step: "problem" });
    if (id === "receita") return recipeStep({ kind: "recipe", step: "method" });
    if (id === "recomendar") return recommend();
    return methodsOverview();
  }

  function fallback(): BaristaReply {
    return {
      text: [
        "Ainda não sei responder isso com segurança, e prefiro não inventar. Posso ajudar com preparo, ajustes de receita, conceitos de café e com os cafés da Cura.",
      ],
      chips: starters(),
      flow: idle,
    };
  }

  /** Synchronous core, used by the local provider and by tests. */
  function respond(flow: BaristaFlow, input: BaristaInput): BaristaReply {
    const [kind, raw] = input.value
      ? input.value.split(":")
      : [undefined, undefined];
    if (kind === "flow" && raw) return startFlow(raw);
    if (kind === "topic" && raw) return topicReply(raw);
    if (kind === "coffee" && raw) {
      const coffee = coffees.find((item) => item.slug === raw);
      return coffee ? describeCoffee(coffee) : fallback();
    }
    if (kind === "pref" && raw) return recommend(raw);
    const text = input.text ?? "";
    // Inside a flow, a chip or a free-text answer moves it forward.
    if (flow.kind === "diagnosis") {
      if (flow.step === "problem") {
        const problem =
          kind === "problem" ? raw : detect(problemKeywords, text);
        if (problem) return diagnosisStep({ ...flow, problem });
      }
      if (flow.step === "method") {
        const method = kind === "method" ? raw : detect(methodAliases, text);
        if (method) return diagnosisStep({ ...flow, method });
      }
      if (flow.step === "grind") {
        const value = normalize(text);
        const grind =
          kind === "grind"
            ? raw
            : value.includes("ja") ||
                value.includes("pronto") ||
                value.includes("comprado moido")
              ? "pre"
              : value.includes("hora") ||
                  value.includes("moo") ||
                  value.includes("moedor")
                ? "fresh"
                : value
                  ? "unknown"
                  : undefined;
        if (grind) return diagnosisStep(flow, grind);
      }
    }
    if (flow.kind === "recipe") {
      if (flow.step === "method") {
        const method = kind === "method" ? raw : detect(methodAliases, text);
        if (method) return recipeStep({ ...flow, method });
      }
      if (flow.step === "cups") {
        const cups = Number(
          kind === "cups" ? raw : (text.match(/\d+/)?.[0] ?? NaN),
        );
        if (cups > 0 && cups <= 12) return recipeStep(flow, cups);
        if (text)
          return {
            text: ["Me diga um número de 1 a 12."],
            chips: [1, 2, 3, 4].map((n) => ({
              label: String(n),
              value: `cups:${n}`,
            })),
            flow,
          };
      }
    }
    if (flow.kind === "recommend") {
      const value = normalize(text);
      const pref =
        value.includes("frut") || value.includes("acid")
          ? "frutado"
          : value.includes("doce")
            ? "doce"
            : value.includes("dia")
              ? "dia"
              : undefined;
      if (pref) return recommend(pref);
    }
    if (kind === "method" && raw)
      return recipeStep({ kind: "recipe", method: raw, step: "cups" });
    if (!text.trim()) return greeting();
    // Free text outside a flow: problems first (ask, do not diagnose yet).
    const problem = detect(problemKeywords, text);
    if (problem) {
      const method = detect(methodAliases, text);
      return diagnosisStep({
        kind: "diagnosis",
        problem,
        method,
        step: "method",
      });
    }
    const value = normalize(text);
    const coffee = coffees.find((item) => value.includes(normalize(item.name)));
    if (coffee) return describeCoffee(coffee);
    if (
      /(receita|proporc|quanto cafe|quantas gramas|quanto de agua)/.test(value)
    ) {
      const method = detect(methodAliases, text);
      return recipeStep({
        kind: "recipe",
        method,
        step: method ? "cups" : "method",
      });
    }
    if (/(recomend|indica|qual cafe|combina|escolher um cafe)/.test(value))
      return recommend();
    if (
      /(metodo|equipamento|qual (cafeteira|jeito)|como preparar|como fazer)/.test(
        value,
      )
    )
      return methodsOverview();
    const scored = knowledge.topics
      .map((item) => ({
        item,
        score: item.keywords.reduce(
          (sum, keyword) =>
            value.includes(normalize(keyword))
              ? sum + normalize(keyword).length
              : sum,
          0,
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored.length) return topicReply(scored[0].item.id);
    return fallback();
  }

  const provider: BaristaProvider = {
    reply: async (flow, input) => respond(flow, input),
  };
  return { greeting, respond, provider };
}
