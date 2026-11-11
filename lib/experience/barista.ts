// Barista Cura — guided mode (no AI).
//
// Deterministic answers built from the reviewed knowledge base, the published
// coffees and the recipe engine, through the same tools the AI Barista uses
// (barista-tools.ts). It reads compound questions (coffee + method + amount),
// keeps the session context (the coffee and recipe being discussed) and asks
// one short question only when something essential is missing.
import {
  analisarEspresso,
  calcularReceita,
  compararCafes,
  detalharCafe,
  diagnosticarPreparo,
  recomendarCafe,
  type BaristaAction,
  type BaristaData,
} from "./barista-tools";
import {
  detectIntent,
  extractEntities,
  normalize,
  type Entities,
  type Quantity,
} from "./barista-intent";
import { formatNumber } from "./brew";
import type { LabState } from "./lab-link";
import type { BrewMethod } from "./schema";

export type BaristaSession = {
  coffeeSlug?: string;
  methodId?: string;
  lab?: LabState;
};
type Problem =
  "amargo" | "azedo" | "fraco" | "forte" | "equilibrado" | "nao-sei";
export type BaristaFlow =
  | { kind: "idle" }
  | {
      kind: "await-method";
      purpose: "recipe" | "diagnosis";
      problem?: Problem;
      quantity?: Quantity;
    }
  | { kind: "await-quantity"; methodId: string }
  | { kind: "await-grind"; problem: Problem; methodId: string }
  | { kind: "await-problem" }
  | { kind: "recommend" };
export type BaristaChip = { label: string; value: string };
export type BaristaReply = {
  text: string[];
  chips: BaristaChip[];
  actions: BaristaAction[];
  flow: BaristaFlow;
  session: BaristaSession;
};
export type BaristaInput = { text?: string; value?: string };
export type BaristaState = { flow: BaristaFlow; session: BaristaSession };

export const FLOW_IDS = [
  "diagnostico",
  "receita",
  "recomendar",
  "metodos",
  "comparar",
] as const;
const flowLabels: Record<(typeof FLOW_IDS)[number], string> = {
  diagnostico: "Meu café não ficou bom",
  receita: "Quero uma receita",
  recomendar: "Qual café combina comigo?",
  metodos: "Qual método escolher?",
  comparar: "Comparar os cafés",
};
const idle: BaristaFlow = { kind: "idle" };

export function createBarista(data: BaristaData) {
  const { knowledge, coffees, methods } = data;
  const names = coffees.map(({ slug, name }) => ({ slug, name }));
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
  const methodById = (id?: string) => methods.find((item) => item.id === id);
  const coffeeName = (slug?: string) =>
    coffees.find((item) => item.slug === slug)?.name;

  function reply(
    session: BaristaSession,
    text: string[],
    options: {
      chips?: BaristaChip[];
      actions?: BaristaAction[];
      flow?: BaristaFlow;
    } = {},
  ): BaristaReply {
    return {
      text,
      chips: options.chips ?? [],
      actions: options.actions ?? [],
      flow: options.flow ?? idle,
      session,
    };
  }

  function greeting(session: BaristaSession = {}): BaristaReply {
    const text = [knowledge.greeting];
    const current = coffeeName(session.coffeeSlug);
    if (current)
      text.push(
        `Vi que você está com o ${current}. Posso usar esse café nas respostas.`,
      );
    return reply(session, text, { chips: starters() });
  }

  // ---------- recipes -------------------------------------------------------
  function defaultQuantity(method: BrewMethod): {
    mode: LabState["mode"];
    amount: number;
    label: string;
  } {
    if (method.kind === "moka") {
      const size = method.moka?.defaultSize ?? 3;
      return {
        mode: "size",
        amount: size,
        label: `uma moka de ${size} xícaras`,
      };
    }
    if (method.kind === "espresso")
      return { mode: "cups", amount: 1, label: "um espresso" };
    if (method.id === "aeropress")
      return { mode: "cups", amount: 1, label: `uma ${method.cup.label}` };
    return {
      mode: "cups",
      amount: 2,
      label: `2 porções (${method.cup.label})`,
    };
  }
  function toParams(method: BrewMethod, quantity: Quantity | undefined) {
    if (!quantity) return { ...defaultQuantity(method), assumed: true };
    if (method.kind === "moka") {
      const count = quantity.kind === "servings" ? quantity.count : 3;
      const sizes = method.moka?.sizes ?? [3];
      const size =
        sizes.find((item) => item >= count) ?? sizes[sizes.length - 1];
      return {
        mode: "size" as const,
        amount: size,
        label: `uma moka de ${size} xícaras`,
        assumed: quantity.kind !== "servings",
      };
    }
    if (quantity.kind === "servings")
      return {
        mode: "cups" as const,
        amount: quantity.count,
        label: "",
        assumed: false,
      };
    if (quantity.kind === "coffee" && method.modes.includes("coffee"))
      return {
        mode: "coffee" as const,
        amount: quantity.grams,
        label: "",
        assumed: false,
      };
    if (quantity.kind === "water" && method.modes.includes("water"))
      return {
        mode: "water" as const,
        amount: quantity.grams,
        label: "",
        assumed: false,
      };
    return { ...defaultQuantity(method), assumed: true };
  }
  function recipeReply(
    session: BaristaSession,
    methodId: string | undefined,
    quantity?: Quantity,
  ): BaristaReply {
    const method = methodById(methodId);
    if (!method)
      return reply(
        session,
        [
          quantity
            ? "Combinado. Qual equipamento você vai usar?"
            : "Vamos montar sua receita. Qual equipamento você tem?",
        ],
        {
          chips: methodChips(),
          flow: { kind: "await-method", purpose: "recipe", quantity },
        },
      );
    const params = toParams(method, quantity);
    const result = calcularReceita(data, {
      metodo: method.id,
      modo: params.mode,
      quantidade: params.amount,
      cafe: session.coffeeSlug,
      ...(session.lab?.methodId === method.id && session.lab.strength
        ? { intensidade: session.lab.strength }
        : {}),
    });
    const next: BaristaSession = { ...session, methodId: method.id };
    if (!result.ok)
      return reply(next, [result.erro], {
        chips: [1, 2, 3, 4].map((n) => ({
          label: `${n} ${n === 1 ? "porção" : "porções"}`,
          value: `cups:${n}`,
        })),
        flow: { kind: "await-quantity", methodId: method.id },
      });
    const lab = result.acoes[0].lab as LabState;
    const r = result.receita;
    const text = [
      `${result.resumo}${r.cafe ? `, com o ${r.cafe}` : ""}.`,
      ...(params.assumed && params.label
        ? [
            `Calculei para ${params.label}. Se quiser outra quantidade, é só dizer.`,
          ]
        : []),
      ...(r.doseAproximada
        ? [
            "A dose foi arredondada para 0,5 g, mantendo a quantidade que você informou.",
          ]
        : []),
      ...result.avisos,
      `Moagem: ${r.moagem} ${r.temperatura} Tempo: ${r.tempo}.`,
      ...(result.notas[0] ? [result.notas[0]] : []),
      ...(r.sugeridoNoRotulo === false && r.cafe
        ? [
            `Esse método não está entre os sugeridos no rótulo do ${r.cafe}: vale como experimento.`,
          ]
        : []),
      "É um ponto de partida: prove e ajuste uma coisa por vez.",
    ];
    return reply({ ...next, lab }, text, {
      chips: [
        { label: "Mais suave", value: "strength:suave" },
        { label: "Mais intenso", value: "strength:intenso" },
        { label: "Meu café não ficou bom", value: "flow:diagnostico" },
      ],
      actions: result.acoes,
    });
  }

  // ---------- diagnosis -----------------------------------------------------
  function diagnosisReply(
    session: BaristaSession,
    problem: Problem | undefined,
    methodId: string | undefined,
    grind?: "fresh" | "pre" | "unknown",
  ): BaristaReply {
    if (!problem)
      return reply(
        session,
        ["Vamos descobrir o motivo. Como ficou o seu café?"],
        {
          chips: data.diagnosis.options.map((option) => ({
            label: option.label,
            value: `problem:${option.id}`,
          })),
          flow: { kind: "await-problem" },
        },
      );
    const method = methodById(
      methodId ?? session.methodId ?? session.lab?.methodId,
    );
    if (!method)
      return reply(session, ["Entendi. Qual método você está usando?"], {
        chips: methodChips(),
        flow: { kind: "await-method", purpose: "diagnosis", problem },
      });
    if (
      !grind &&
      ["amargo", "azedo", "fraco"].includes(problem) &&
      method.kind !== "moka" &&
      method.kind !== "espresso"
    )
      return reply(
        { ...session, methodId: method.id },
        ["Você utiliza café já moído ou mói na hora?"],
        {
          chips: [
            { label: "Mói na hora", value: "grind:fresh" },
            { label: "Já moído", value: "grind:pre" },
            { label: "Não sei", value: "grind:unknown" },
          ],
          flow: { kind: "await-grind", problem, methodId: method.id },
        },
      );
    const lab = session.lab?.methodId === method.id ? session.lab : undefined;
    const result = diagnosticarPreparo(data, {
      problema: problem,
      metodo: method.id,
      ...(lab
        ? {
            modo: lab.mode,
            quantidade: lab.amount,
            intensidade: lab.strength,
            proporcao: lab.ratio,
          }
        : {}),
      cafe: session.coffeeSlug,
    });
    if (!result.ok) return greeting(session);
    if (result.perguntaExtra)
      return reply(
        { ...session, methodId: method.id },
        [result.resumo, result.perguntaExtra.question],
        {
          chips: result.perguntaExtra.options.map((option) => ({
            label: option.label,
            value: `problem:${option.to}`,
          })),
          flow: { kind: "await-problem" },
        },
      );
    const text = [result.resumo];
    if (grind === "pre")
      text.push(
        "Como o café já vem moído, a moagem pode não ser a ideal para o seu método e o pó perde frescor mais rápido. Se puder, moa na hora ou peça a moagem específica para o método.",
      );
    if (problem !== "equilibrado" && problem !== "nao-sei")
      text.push(
        `Referência para ${method.name}: moagem ${method.grind.beginner.toLocaleLowerCase("pt-BR")} Tempo: ${method.time.label}.`,
      );
    if (result.comeceAqui) text.push(`Comece por aqui: ${result.comeceAqui}`);
    if (result.ajusteDeReceita)
      text.push(`Na próxima tentativa: ${result.ajusteDeReceita.resumo}.`);
    if (result.seNaoResolver[0])
      text.push(`Se não resolver: ${result.seNaoResolver[0]}`);
    if (problem !== "equilibrado") text.push(result.umaVariavelPorVez);
    const actions: BaristaAction[] = result.ajusteDeReceita
      ? [result.ajusteDeReceita.acao]
      : [
          {
            kind: "lab",
            label: "Abrir o Laboratório",
            href: `/experiencia/preparar/?metodo=${method.id}`,
          },
        ];
    return reply(
      {
        ...session,
        methodId: method.id,
        lab: result.ajusteDeReceita?.acao.lab ?? session.lab,
      },
      text,
      {
        chips: [
          { label: "Outro problema", value: "flow:diagnostico" },
          { label: "Ver receita", value: `method:${method.id}` },
        ],
        actions,
      },
    );
  }

  // ---------- other intents -------------------------------------------------
  function describeCoffee(session: BaristaSession, slug: string): BaristaReply {
    const result = detalharCafe(data, { slug });
    if (!result.ok) return fallback(session);
    const c = result.cafe;
    const text = [`${c.nome}: ${c.descricao}`];
    const facts = [
      c.categoria,
      c.pontuacao !== null ? `${c.pontuacao} pontos no rótulo` : null,
      c.torra ? `torra ${c.torra.toLocaleLowerCase("pt-BR")}` : null,
    ].filter(Boolean);
    text.push(`${facts.join(" · ")}.`);
    if (c.notas.length) text.push(`Notas do rótulo: ${c.notas.join(", ")}.`);
    if (c.acidez || c.corpo)
      text.push(
        [
          c.acidez && `Acidez ${c.acidez.toLocaleLowerCase("pt-BR")}`,
          c.corpo && `corpo ${c.corpo.toLocaleLowerCase("pt-BR")}`,
        ]
          .filter(Boolean)
          .join(", ") + ".",
      );
    const origin = [
      c.fazenda,
      c.regiao,
      c.altitudeMetros ? `${formatNumber(c.altitudeMetros)} m` : null,
      c.processo ? `processo ${c.processo.toLocaleLowerCase("pt-BR")}` : null,
      c.variedade,
    ].filter(Boolean);
    if (origin.length) text.push(`Origem: ${origin.join(" · ")}.`);
    if (c.produtores.length)
      text.push(`Quem produz: ${c.produtores.join(" e ")}.`);
    if (!c.origemDetalhadaPublicada)
      text.push(
        "A origem detalhada deste café ainda não está publicada, e eu não vou inventar.",
      );
    if (c.preparosSugeridosNoRotulo.length)
      text.push(
        `O rótulo sugere: ${c.preparosSugeridosNoRotulo.join(" e ").toLocaleLowerCase("pt-BR")}.`,
      );
    return reply({ ...session, coffeeSlug: c.slug }, text, {
      chips: [
        { label: `Preparar ${c.nome}`, value: "flow:receita" },
        { label: "Comparar os cafés", value: "flow:comparar" },
      ],
      actions: result.acoes,
    });
  }
  function compareReply(
    session: BaristaSession,
    slugs: string[],
  ): BaristaReply {
    const chosen =
      slugs.length >= 2 ? slugs : coffees.slice(0, 2).map((item) => item.slug);
    const result = compararCafes(data, { slugs: chosen.slice(0, 3) });
    if (!result.ok) return fallback(session);
    const text = ["Comparando pelo que está publicado nos rótulos:"];
    for (const c of result.cafes) {
      const parts = [
        c.pontuacao !== null ? `${c.pontuacao} pontos` : c.categoria,
        c.perfil,
        c.notas.length ? `notas de ${c.notas.join(" e ")}` : null,
        c.acidez ? `acidez ${c.acidez.toLocaleLowerCase("pt-BR")}` : null,
        c.corpo ? `corpo ${c.corpo.toLocaleLowerCase("pt-BR")}` : null,
        c.processo && c.variedade
          ? `${c.variedade}, ${c.processo.toLocaleLowerCase("pt-BR")}`
          : null,
      ].filter(Boolean);
      text.push(`${c.nome}: ${parts.join("; ")}.`);
    }
    text.push(
      "Pontuação mostra avaliação técnica, não preferência: o melhor café é o que combina com você.",
    );
    return reply(session, text, {
      chips: [{ label: "Qual combina comigo?", value: "flow:recomendar" }],
      actions: result.acoes,
    });
  }
  function recommendReply(
    session: BaristaSession,
    entities?: Entities,
    pref?: string,
  ): BaristaReply {
    const prefs = {
      querDoce: pref === "doce" || !!entities?.wantsSweet,
      querFrutado: pref === "frutado" || !!entities?.wantsFruity,
      menosAcidez: pref === "doce" || !!entities?.wantsLessAcid,
      diaADia: pref === "dia",
    };
    if (
      !prefs.querDoce &&
      !prefs.querFrutado &&
      !prefs.menosAcidez &&
      !prefs.diaADia
    )
      return reply(session, ["Me conta: o que você procura na xícara?"], {
        chips: [
          { label: "Doce e com pouca acidez", value: "pref:doce" },
          { label: "Frutado e vivo", value: "pref:frutado" },
          { label: "Para o dia a dia", value: "pref:dia" },
        ],
        actions: [
          {
            kind: "quiz",
            label: "Ou faça o quiz de paladar",
            href: "/experiencia/paladar/",
          },
        ],
        flow: { kind: "recommend" },
      });
    const result = recomendarCafe(data, prefs);
    if (!result.recomendacoes.length)
      return reply(
        session,
        [
          result.aviso ??
            "Não encontrei um café com essas características publicadas.",
        ],
        { chips: starters().slice(0, 3), actions: result.acoes },
      );
    const [best, ...rest] = result.recomendacoes;
    return reply(
      { ...session, coffeeSlug: session.coffeeSlug ?? best.slug },
      [
        `Pelo que está publicado, o ${best.cafe} combina com o que você descreveu.`,
        `Por quê: ${best.motivos.join("; ")}.`,
        ...(rest.length
          ? [`Também vale provar: ${rest.map((item) => item.cafe).join(", ")}.`]
          : []),
        "É uma sugestão a partir dos rótulos: o seu paladar tem a palavra final.",
      ],
      {
        chips: [
          { label: `Mais sobre o ${best.cafe}`, value: `coffee:${best.slug}` },
          { label: "Quero uma receita", value: "flow:receita" },
        ],
        actions: result.acoes,
      },
    );
  }
  function capacityReply(
    session: BaristaSession,
    entities: Entities,
  ): BaristaReply {
    const base = topic("capacidade");
    const methodId =
      entities.method ?? session.lab?.methodId ?? session.methodId;
    const method = methodById(methodId);
    const text = [...(base?.answer ?? [])];
    let actions: BaristaAction[] = [];
    if (method && (session.lab?.methodId === method.id || entities.quantity)) {
      const quantity =
        entities.quantity ??
        (session.lab
          ? ({
              kind:
                session.lab.mode === "water"
                  ? "water"
                  : session.lab.mode === "coffee"
                    ? "coffee"
                    : "servings",
              ...(session.lab.mode === "cups"
                ? { count: session.lab.amount }
                : { grams: session.lab.amount }),
            } as Quantity)
          : undefined);
      const result = recipeReply(session, method.id, quantity);
      return { ...result, text: [...text.slice(0, 1), ...result.text] };
    }
    if (!method)
      text.push(
        "Me diga o equipamento e a quantidade, e eu divido a receita em rodadas.",
      );
    else
      actions = [
        {
          kind: "lab",
          label: `Abrir ${method.name} no Laboratório`,
          href: `/experiencia/preparar/?metodo=${method.id}`,
        },
      ];
    return reply(session, text, {
      chips: method ? [] : methodChips(),
      actions,
      flow: method ? idle : { kind: "await-method", purpose: "recipe" },
    });
  }
  function grindReply(
    session: BaristaSession,
    methodId?: string,
  ): BaristaReply {
    const method = methodById(
      methodId ?? session.methodId ?? session.lab?.methodId,
    );
    if (!method) return topicReply(session, "moagem");
    return reply(
      { ...session, methodId: method.id },
      [`Para ${method.name}: ${method.grind.beginner}`, method.grind.advanced],
      {
        chips: [
          { label: `Receita de ${method.name}`, value: `method:${method.id}` },
        ],
        actions: [
          {
            kind: "lesson",
            label: "Por que a moagem importa",
            href: "/experiencia/aprender/cafe-sem-complicacao/#por-que-a-moagem-importa",
          },
        ],
      },
    );
  }
  function methodsOverview(session: BaristaSession): BaristaReply {
    return reply(
      session,
      [
        "Depende do que você tem em casa e do que gosta na xícara:",
        ...methods.map((method) => `${method.name}: ${method.summary}`),
        "Me diga qual equipamento você tem e eu monto a receita.",
      ],
      {
        chips: methodChips(),
        flow: { kind: "await-method", purpose: "recipe" },
      },
    );
  }
  function topicReply(session: BaristaSession, id: string): BaristaReply {
    const found = topic(id);
    if (!found) return fallback(session);
    return reply(session, found.answer, {
      chips: chips(
        found.followUps.length
          ? found.followUps
          : knowledge.starters.slice(0, 3),
      ),
      actions: found.link
        ? [{ kind: "lesson", label: found.link.label, href: found.link.href }]
        : [],
    });
  }
  function fallback(session: BaristaSession): BaristaReply {
    return reply(
      session,
      [
        "Ainda não sei responder isso com segurança e prefiro não inventar. No modo guiado, eu ajudo com receitas, ajustes de preparo, conceitos de café e com os cafés da Cura.",
      ],
      { chips: starters() },
    );
  }
  function startFlow(session: BaristaSession, id: string): BaristaReply {
    if (id === "diagnostico")
      return diagnosisReply(session, undefined, undefined);
    if (id === "receita") return recipeReply(session, session.methodId);
    if (id === "recomendar") return recommendReply(session);
    if (id === "comparar") return compareReply(session, []);
    return methodsOverview(session);
  }

  /** Synchronous core. */
  function respond(state: BaristaState, input: BaristaInput): BaristaReply {
    const { flow } = state;
    let session = { ...state.session };
    const [kind, raw] = input.value
      ? [
          input.value.slice(0, input.value.indexOf(":")),
          input.value.slice(input.value.indexOf(":") + 1),
        ]
      : [undefined, undefined];
    if (kind === "flow" && raw) return startFlow(session, raw);
    if (kind === "topic" && raw) return topicReply(session, raw);
    if (kind === "coffee" && raw) return describeCoffee(session, raw);
    if (kind === "pref" && raw) return recommendReply(session, undefined, raw);
    if (kind === "problem" && raw)
      return diagnosisReply(
        session,
        raw as Problem,
        flow.kind === "await-grind" ? flow.methodId : undefined,
      );
    if (kind === "grind" && raw && flow.kind === "await-grind")
      return diagnosisReply(
        session,
        flow.problem,
        flow.methodId,
        raw as "fresh" | "pre" | "unknown",
      );
    if (kind === "cups" && raw && flow.kind === "await-quantity")
      return recipeReply(session, flow.methodId, {
        kind: "servings",
        count: Number(raw),
      });
    if (kind === "strength" && raw && session.lab) {
      const method = methodById(session.lab.methodId);
      if (method) {
        const lab = {
          ...session.lab,
          strength: raw as LabState["strength"],
          ratio: undefined,
        };
        session = { ...session, lab };
        const result = calcularReceita(data, {
          metodo: lab.methodId,
          modo: lab.mode,
          quantidade: lab.amount,
          intensidade: lab.strength,
          cafe: session.coffeeSlug,
        });
        if (result.ok)
          return reply(
            { ...session, lab: result.acoes[0].lab },
            [
              `${result.resumo}.`,
              "Mudei só a proporção; moagem e tempo continuam os mesmos.",
            ],
            {
              actions: result.acoes,
              chips: [
                { label: "Meu café não ficou bom", value: "flow:diagnostico" },
              ],
            },
          );
      }
    }
    if (kind === "method" && raw) {
      if (flow.kind === "await-method" && flow.purpose === "diagnosis")
        return diagnosisReply(session, flow.problem, raw);
      return recipeReply(
        session,
        raw,
        flow.kind === "await-method" ? flow.quantity : undefined,
      );
    }

    const text = (input.text ?? "").slice(0, 500);
    if (!text.trim()) return greeting(session);
    const entities = extractEntities(text, names);
    if (entities.coffee) session = { ...session, coffeeSlug: entities.coffee };
    if (entities.method) session = { ...session, methodId: entities.method };

    // A free-text answer moves the pending question forward.
    if (flow.kind === "await-method" && entities.method)
      return flow.purpose === "diagnosis"
        ? diagnosisReply(
            session,
            entities.problem ?? flow.problem,
            entities.method,
          )
        : recipeReply(
            session,
            entities.method,
            entities.quantity ?? flow.quantity,
          );
    if (flow.kind === "await-quantity" && entities.quantity)
      return recipeReply(session, flow.methodId, entities.quantity);
    if (flow.kind === "await-quantity") {
      const n = Number(normalize(text).match(/\d+/)?.[0]);
      if (n > 0)
        return recipeReply(session, flow.methodId, {
          kind: "servings",
          count: n,
        });
    }
    if (flow.kind === "await-grind") {
      const value = normalize(text);
      const grind =
        /\bja\b|pronto|comprado moido|moido/.test(value) &&
        !/na hora/.test(value)
          ? "pre"
          : /hora|moo|moedor/.test(value)
            ? "fresh"
            : "unknown";
      return diagnosisReply(session, flow.problem, flow.methodId, grind);
    }
    if (
      flow.kind === "recommend" &&
      (entities.wantsSweet || entities.wantsFruity || entities.wantsLessAcid)
    )
      return recommendReply(session, entities);

    const intent = detectIntent(text, entities);
    switch (intent) {
      case "capacity":
        return capacityReply(session, entities);
      case "diagnose":
        if (
          entities.espresso?.dose &&
          (entities.espresso.yieldGrams || entities.espresso.seconds)
        ) {
          const result = analisarEspresso(data, {
            dose: entities.espresso.dose,
            bebida: entities.espresso.yieldGrams,
            segundos: entities.espresso.seconds,
            pressurizado: entities.espresso.pressurized,
          });
          return reply(
            { ...session, methodId: "espresso" },
            [
              ...result.leitura,
              result.sugestao,
              ...(result.observacao ? [result.observacao] : []),
              data.diagnosis.oneVariable,
            ],
            {
              actions: result.acoes,
              chips: [
                { label: "Receita de espresso", value: "method:espresso" },
              ],
            },
          );
        }
        return diagnosisReply(session, entities.problem, entities.method);
      case "compare":
        return compareReply(session, entities.coffees);
      case "grind":
        return grindReply(session, entities.method);
      case "recipe":
        return recipeReply(
          session,
          entities.method ?? session.methodId,
          entities.quantity,
        );
      case "recommend":
        return recommendReply(session, entities);
      case "methods":
        return methodsOverview(session);
      case "coffee-info":
        return describeCoffee(session, entities.coffee as string);
      default: {
        const value = normalize(text);
        const scored = knowledge.topics
          .map((item) => ({
            item,
            score: item.keywords.reduce(
              (sum, keyword) =>
                new RegExp(`\\b${normalize(keyword)}`).test(value)
                  ? sum + normalize(keyword).length
                  : sum,
              0,
            ),
          }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score);
        if (scored.length) return topicReply(session, scored[0].item.id);
        if (entities.coffee) return describeCoffee(session, entities.coffee);
        return fallback(session);
      }
    }
  }

  return { greeting, respond };
}
