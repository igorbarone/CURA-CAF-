// Barista Cura tools: typed, validated operations over the official content
// and the recipe engine. The guided (local) Barista and the AI Barista call
// exactly these functions, so a recipe number shown in the chat is always the
// number the Laboratório computes. Inputs are validated with Zod before
// anything runs; outputs are plain data plus suggested UI actions.
import { z } from "zod";
import type { ExperienceCoffee } from "./coffee";
import type {
  Academy,
  BaristaKnowledge,
  BrewMethod,
  Diagnosis,
  Taste,
} from "./schema";
import { strengths } from "./schema";
import {
  applyAdjustment,
  formatClock,
  formatNumber,
  formatRatio,
  generateRecipe,
  methodFit,
  summarizeRecipe,
  type BrewParams,
} from "./brew";
import { diagnose } from "./diagnosis";
import { labHref, type LabState } from "./lab-link";
import { coffeeTraits } from "./taste";
import { normalize } from "./barista-intent";

export type LessonIndex = {
  id: string;
  moduleId: string;
  moduleTitle: string;
  title: string;
  summary: string;
  text: string;
};
// Commercial snapshot from the store (price book + live stock), loaded by
// the server per request. Only consultarCompra reads it, so the catalog is
// never sent to the model unless a purchase question needs it.
export type ShopSnapshot = {
  // The store is taking orders (payments and freight configured).
  online: boolean;
  pixDiscountPercent: number;
  offers: {
    coffeeSlug: string;
    label: string;
    priceCents: number;
    listPriceCents: number;
    // Units that can be bought now; null = not checked (store offline).
    units: number | null;
  }[];
};
export type BaristaData = {
  coffees: ExperienceCoffee[];
  methods: BrewMethod[];
  diagnosis: Diagnosis;
  taste: Taste;
  knowledge: BaristaKnowledge;
  lessons: LessonIndex[];
  shop?: ShopSnapshot;
};
export type BaristaAction = {
  kind: "lab" | "coffee" | "lesson" | "quiz" | "shop" | "diagnosis";
  label: string;
  href: string;
  lab?: LabState;
};

export function lessonIndex(academy: Academy): LessonIndex[] {
  return academy.modules.flatMap((mod) =>
    mod.lessons.map((lesson) => ({
      id: lesson.id,
      moduleId: mod.id,
      moduleTitle: mod.title,
      title: lesson.title,
      summary: lesson.summary,
      text: [...lesson.body, lesson.keyIdea ?? ""].join(" ").slice(0, 900),
    })),
  );
}

// ---------- coffees ----------------------------------------------------------
/** Only published fields; absent data is reported as absent, never guessed. */
export function coffeeFacts(coffee: ExperienceCoffee) {
  return {
    slug: coffee.slug,
    nome: coffee.name,
    categoria: coffee.category,
    descricao: coffee.description,
    lote: coffee.lotCode ?? null,
    pontuacao: coffee.score ?? null,
    perfil: coffee.profile ?? null,
    notas: coffee.sensory?.notes ?? [],
    acidez: coffee.sensory?.acidity ?? null,
    corpo: coffee.sensory?.body ?? null,
    torra: coffee.roast ?? null,
    regiao: coffee.origin?.region ?? null,
    fazenda: coffee.origin?.farm ?? null,
    produtores: coffee.origin?.producers ?? [],
    altitudeMetros: coffee.origin?.altitudeMeters ?? null,
    safra: coffee.origin?.harvest ?? null,
    variedade: coffee.variety ?? null,
    processo: coffee.process ?? null,
    coordenadas:
      coffee.origin?.latitude !== undefined ? "publicadas" : "não publicadas",
    preparosSugeridosNoRotulo: coffee.preparations,
    formatos: coffee.formats,
    origemDetalhadaPublicada: !!coffee.origin?.region,
  };
}
const coffeeAction = (coffee: ExperienceCoffee): BaristaAction => ({
  kind: "coffee",
  label: `Conhecer o ${coffee.name}`,
  href: `/experiencia/cafes/${coffee.slug}/`,
});

export const schemas = {
  listarCafes: z.object({}).strict(),
  detalharCafe: z.object({ slug: z.string().min(1).max(40) }).strict(),
  compararCafes: z
    .object({ slugs: z.array(z.string().min(1).max(40)).min(2).max(3) })
    .strict(),
  listarMetodos: z.object({}).strict(),
  consultarCompra: z
    .object({ slug: z.string().min(1).max(40).optional() })
    .strict(),
  calcularReceita: z
    .object({
      metodo: z.string().min(1).max(40),
      modo: z.enum(["cups", "coffee", "water", "size"]),
      quantidade: z.number().positive().max(10000),
      intensidade: z.enum(strengths).optional(),
      proporcao: z.number().positive().max(30).optional(),
      dose: z.number().positive().max(40).optional(),
      cafe: z.string().min(1).max(40).optional(),
    })
    .strict(),
  diagnosticarPreparo: z
    .object({
      problema: z.enum([
        "amargo",
        "azedo",
        "fraco",
        "forte",
        "equilibrado",
        "nao-sei",
      ]),
      metodo: z.string().min(1).max(40).optional(),
      modo: z.enum(["cups", "coffee", "water", "size"]).optional(),
      quantidade: z.number().positive().max(10000).optional(),
      intensidade: z.enum(strengths).optional(),
      proporcao: z.number().positive().max(30).optional(),
      cafe: z.string().min(1).max(40).optional(),
    })
    .strict(),
  analisarEspresso: z
    .object({
      dose: z.number().positive().max(40),
      bebida: z.number().positive().max(200).optional(),
      segundos: z.number().positive().max(180).optional(),
      pressurizado: z.boolean().optional(),
    })
    .strict(),
  buscarConteudo: z.object({ consulta: z.string().min(2).max(200) }).strict(),
  recomendarCafe: z
    .object({
      querDoce: z.boolean().optional(),
      querFrutado: z.boolean().optional(),
      menosAcidez: z.boolean().optional(),
      maisCorpo: z.boolean().optional(),
      diaADia: z.boolean().optional(),
    })
    .strict(),
} as const;
export type ToolName = keyof typeof schemas;

export function listarCafes(data: BaristaData) {
  return { cafes: data.coffees.map(coffeeFacts) };
}
export function detalharCafe(
  data: BaristaData,
  input: z.infer<typeof schemas.detalharCafe>,
) {
  const coffee = data.coffees.find((item) => item.slug === input.slug);
  if (!coffee)
    return {
      ok: false as const,
      erro: "Café não encontrado no catálogo publicado.",
      disponiveis: data.coffees.map((item) => item.slug),
    };
  return {
    ok: true as const,
    cafe: coffeeFacts(coffee),
    acoes: [coffeeAction(coffee)],
  };
}
export function compararCafes(
  data: BaristaData,
  input: z.infer<typeof schemas.compararCafes>,
) {
  const found = input.slugs
    .map((slug) => data.coffees.find((item) => item.slug === slug))
    .filter((item): item is ExperienceCoffee => !!item);
  if (found.length < 2)
    return {
      ok: false as const,
      erro: "Informe pelo menos dois cafés publicados.",
    };
  return {
    ok: true as const,
    cafes: found.map(coffeeFacts),
    acoes: [
      {
        kind: "coffee" as const,
        label: "Comparar no site",
        href: `/comparar/?cafes=${found.map((item) => item.slug).join(",")}`,
      },
    ],
  };
}

// ---------- methods and recipes ---------------------------------------------
export function listarMetodos(data: BaristaData) {
  return {
    metodos: data.methods.map((method) => ({
      id: method.id,
      nome: method.name,
      resumo: method.summary,
      modos: method.modes,
      porcao: method.cup.label,
      capacidade: method.capacity?.note ?? null,
      preparoDoRotulo: method.catalogPreparations,
    })),
    modos: {
      cups: "porções de bebida (xícaras, pessoas, copos; no espresso, número de extrações)",
      coffee: "gramas de café disponíveis",
      water: "gramas (ml) de água de preparo",
      size: "tamanho nominal da moka, em xícaras",
    },
  };
}

export function calcularReceita(
  data: BaristaData,
  input: z.infer<typeof schemas.calcularReceita>,
) {
  const method = data.methods.find((item) => item.id === input.metodo);
  if (!method)
    return {
      ok: false as const,
      erro: "Método desconhecido.",
      metodos: data.methods.map((item) => item.id),
    };
  const coffee = input.cafe
    ? data.coffees.find((item) => item.slug === input.cafe)
    : undefined;
  const params: BrewParams = {
    methodId: method.id,
    mode: input.modo,
    amount: input.quantidade,
    strength: input.intensidade,
    ...(input.proporcao !== undefined ? { ratio: input.proporcao } : {}),
    ...(input.dose !== undefined ? { dose: input.dose } : {}),
  };
  const recipe = generateRecipe(method, params);
  if (!recipe.ok)
    return {
      ok: false as const,
      erro: recipe.error,
      modosAceitos: method.modes,
    };
  const lab: LabState = { ...recipe.params, coffeeSlug: coffee?.slug };
  return {
    ok: true as const,
    resumo: summarizeRecipe(method, recipe),
    receita: {
      metodo: method.name,
      cafe: coffee?.name ?? null,
      cafeTotalGramas: recipe.total.coffeeGrams,
      aguaTotalGramas: recipe.total.waterGrams,
      significadoDaAgua:
        recipe.ratioMeaning === "beverage"
          ? "bebida na xícara (espresso)"
          : "água de preparo",
      rodadas: recipe.rounds,
      tipoDeRodada: recipe.roundLabel,
      cafePorRodada: recipe.perRound.coffeeGrams,
      aguaPorRodada: recipe.perRound.waterGrams,
      proporcao: formatRatio(recipe.ratio),
      proporcaoEfetiva: formatRatio(recipe.effectiveRatio),
      doseAproximada: recipe.approximate,
      bebidaEstimadaMl: recipe.beverageMl,
      concentradoMl: recipe.concentrateMl,
      moagem: method.grind.beginner,
      temperatura: method.temperature.beginner,
      tempo: method.time.label,
      inicioDoCronometro: method.timer?.start ?? "Sem cronômetro neste método.",
      sugeridoNoRotulo: coffee ? methodFit(method, coffee) === "label" : null,
    },
    passos: recipe.steps.map(
      (step) =>
        `${step.at !== undefined && method.timer ? `${formatClock(step.at)} · ` : ""}${step.title}: ${step.text}`,
    ),
    avisos: recipe.warnings,
    notas: recipe.notes,
    acoes: [
      {
        kind: "lab" as const,
        label: "Abrir no Laboratório com cronômetro",
        href: labHref(lab),
        lab,
      },
    ],
  };
}

export function diagnosticarPreparo(
  data: BaristaData,
  input: z.infer<typeof schemas.diagnosticarPreparo>,
) {
  const result = diagnose(data.diagnosis, input.problema, input.metodo);
  if (!result) return { ok: false as const, erro: "Problema desconhecido." };
  const method = input.metodo
    ? data.methods.find((item) => item.id === input.metodo)
    : undefined;
  let ajuste: { resumo: string; notas: string[]; acao: BaristaAction } | null =
    null;
  const apply = result.first?.apply;
  if (method && apply) {
    const base: BrewParams = {
      methodId: method.id,
      mode:
        input.modo && method.modes.includes(input.modo)
          ? input.modo
          : method.modes[0],
      amount:
        input.quantidade ??
        (method.modes[0] === "size" ? (method.moka?.defaultSize ?? 3) : 1),
      strength: input.intensidade,
      ...(input.proporcao !== undefined ? { ratio: input.proporcao } : {}),
    };
    const next = applyAdjustment(method, base, apply);
    const recipe = generateRecipe(method, next.params);
    if (recipe.ok) {
      const lab: LabState = { ...recipe.params, coffeeSlug: input.cafe };
      ajuste = {
        resumo: summarizeRecipe(method, recipe),
        notas: next.notes,
        acao: {
          kind: "lab",
          label: "Preparar de novo com este ajuste",
          href: labHref(lab),
          lab,
        },
      };
    }
  }
  return {
    ok: true as const,
    resumo: result.summary,
    observeAntes: result.checks,
    comeceAqui: result.first?.text ?? null,
    seNaoResolver: result.then.slice(0, 2).map((item) => item.text),
    umaVariavelPorVez: result.oneVariable,
    perguntaExtra: result.followUp,
    ajusteDeReceita: ajuste,
    metodoInformado: !!method,
  };
}

export function analisarEspresso(
  data: BaristaData,
  input: z.infer<typeof schemas.analisarEspresso>,
) {
  const method = data.methods.find((item) => item.kind === "espresso");
  const findings: string[] = [];
  const ratio = input.bebida ? input.bebida / input.dose : null;
  if (ratio !== null)
    findings.push(
      `Proporção da extração: ${formatRatio(Math.round(ratio * 10) / 10)} (${formatNumber(input.dose)} g → ${formatNumber(input.bebida ?? 0)} g).`,
    );
  let direction: "rapido" | "lento" | "ok" | null = null;
  if (input.segundos !== undefined) {
    const [min, max] = method?.time.seconds ?? [25, 32];
    direction =
      input.segundos < min ? "rapido" : input.segundos > max ? "lento" : "ok";
    findings.push(
      direction === "rapido"
        ? `${input.segundos} s é mais rápido que a referência de ${min} a ${max} s: tende a subextrair (acidez áspera, pouca doçura).`
        : direction === "lento"
          ? `${input.segundos} s é mais lento que a referência de ${min} a ${max} s: tende a superextrair (amargor).`
          : `${input.segundos} s está dentro da referência de ${min} a ${max} s.`,
    );
  }
  const suggestion = input.pressurizado
    ? "Em cesto pressurizado, moagem e compactação mudam pouco: comece ajustando a quantidade de bebida (pare antes para menos amargor, deixe correr um pouco mais para menos acidez) e mantenha a dose indicada pelo fabricante do cesto."
    : direction === "rapido"
      ? "Comece afinando um pouco a moagem, mantendo dose e quantidade de bebida."
      : direction === "lento"
        ? "Comece engrossando um pouco a moagem, mantendo dose e quantidade de bebida."
        : ratio !== null && ratio > 2.5
          ? "A bebida está longa para a dose: tente parar mais perto de 1:2."
          : "Ajuste uma variável por vez e prove de novo.";
  return {
    ok: true as const,
    leitura: findings,
    sugestao: suggestion,
    observacao: input.pressurizado
      ? (method?.espresso?.pressurized ?? null)
      : null,
    acoes: [
      {
        kind: "lab" as const,
        label: "Abrir receita de espresso",
        href: labHref({
          methodId: "espresso",
          mode: "cups",
          amount: 1,
          dose: input.dose,
        }),
        lab: {
          methodId: "espresso",
          mode: "cups" as const,
          amount: 1,
          dose: input.dose,
        },
      },
    ],
  };
}

// ---------- content ----------------------------------------------------------
export function buscarConteudo(
  data: BaristaData,
  input: z.infer<typeof schemas.buscarConteudo>,
) {
  const query = normalize(input.consulta);
  const words = query.split(" ").filter((word) => word.length > 2);
  const score = (haystack: string, keywords: string[] = []) => {
    const text = normalize(haystack);
    let total = 0;
    for (const keyword of keywords)
      if (query.includes(normalize(keyword)))
        total += 5 + normalize(keyword).length;
    for (const word of words) if (text.includes(word)) total += 1;
    return total;
  };
  const topics = data.knowledge.topics.map((topic) => ({
    tipo: "topico" as const,
    titulo: topic.label,
    texto: topic.answer.join(" "),
    link: topic.link ?? null,
    score:
      score(`${topic.label} ${topic.answer.join(" ")}`, topic.keywords) * 1.5,
  }));
  const lessons = data.lessons.map((lesson) => ({
    tipo: "licao" as const,
    titulo: lesson.title,
    texto: `${lesson.summary} ${lesson.text}`,
    link: {
      href: `/experiencia/aprender/${lesson.moduleId}/#${lesson.id}`,
      label: `Ler “${lesson.title}”`,
    },
    score: score(`${lesson.title} ${lesson.summary} ${lesson.text}`),
  }));
  const results = [...topics, ...lessons]
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      tipo: item.tipo,
      titulo: item.titulo,
      texto: item.texto,
      link: item.link,
    }));
  return {
    resultados: results,
    aviso: results.length
      ? null
      : "Nada encontrado na base da Cura para essa pergunta.",
  };
}

export function recomendarCafe(
  data: BaristaData,
  input: z.infer<typeof schemas.recomendarCafe>,
) {
  const wanted = new Set<string>();
  if (input.querDoce) wanted.add("doce");
  if (input.querFrutado) wanted.add("frutado").add("acido");
  if (input.maisCorpo) wanted.add("encorpado");
  if (input.diaADia) wanted.add("dia-a-dia");
  if (input.menosAcidez) wanted.add("acidez-media");
  const ranked = data.coffees
    .map((coffee, order) => {
      const traits = coffeeTraits(coffee, data.taste);
      const matches = traits.filter((trait) => wanted.has(trait.trait));
      const penalty =
        input.menosAcidez && traits.some((trait) => trait.trait === "acido")
          ? 3
          : 0;
      return { coffee, matches, score: matches.length * 2 - penalty, order };
    })
    .filter((item) => item.matches.length > 0 && item.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);
  return {
    recomendacoes: ranked.slice(0, 2).map((item) => ({
      cafe: item.coffee.name,
      slug: item.coffee.slug,
      motivos: item.matches.map(
        (match) => `${match.label} (${match.evidence})`,
      ),
    })),
    aviso: ranked.length
      ? null
      : "Nenhum café publicado tem essas características cadastradas.",
    acoes: [
      ...ranked.slice(0, 1).map((item) => coffeeAction(item.coffee)),
      {
        kind: "quiz" as const,
        label: "Fazer o quiz de paladar",
        href: "/experiencia/paladar/",
      },
    ],
  };
}

// ---------- purchase ------------------------------------------------------
const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Price and availability from the store, never from memory. */
export function consultarCompra(data: BaristaData, input: { slug?: string }) {
  const shop = data.shop;
  const coffees = input.slug
    ? data.coffees.filter((coffee) => coffee.slug === input.slug)
    : data.coffees;
  if (input.slug && !coffees.length)
    return { ok: false, erro: `Café não encontrado: ${input.slug}` };
  const offersOf = (slug: string) =>
    (shop?.offers ?? []).filter((offer) => offer.coffeeSlug === slug);
  const available = (slug: string) =>
    !!shop?.online && offersOf(slug).some((offer) => (offer.units ?? 0) > 0);
  const cafes = coffees.map((coffee) => ({
    slug: coffee.slug,
    nome: coffee.name,
    vendaOnline: !shop?.online
      ? "em breve (a loja ainda não está recebendo pedidos)"
      : offersOf(coffee.slug).length
        ? available(coffee.slug)
          ? "disponível"
          : "esgotado no momento"
        : "em breve (embalagem ainda não liberada para venda online)",
    embalagens: offersOf(coffee.slug).map((offer) => ({
      rotulo: offer.label,
      preco: brl(offer.priceCents),
      ...(offer.listPriceCents > offer.priceCents
        ? { precoNormal: brl(offer.listPriceCents) }
        : {}),
      disponivel:
        offer.units === null ? "a confirmar na loja" : offer.units > 0,
    })),
    paginaDoCafe: `/cafes/${coffee.slug}/`,
  }));
  const alternativas =
    input.slug && !available(input.slug)
      ? data.coffees
          .filter(
            (coffee) => coffee.slug !== input.slug && available(coffee.slug),
          )
          .map((coffee) => ({ slug: coffee.slug, nome: coffee.name }))
      : [];
  return {
    cafes,
    descontoPix:
      shop?.online && shop.pixDiscountPercent > 0
        ? `${shop.pixDiscountPercent}% sobre os cafés no Pix (o frete não tem desconto)`
        : null,
    frete: "calculado pelo CEP no carrinho, antes de pagar",
    alternativasDisponiveis: alternativas,
    observacao:
      "Preços e estoque vêm da loja agora; o valor final é conferido no checkout. Nunca prometa prazo, cupom ou condição que não esteja aqui.",
    acoes: cafes.slice(0, 1).map((cafe) => ({
      kind: "shop" as const,
      label: `Ver o ${cafe.nome} na loja`,
      href: cafe.paginaDoCafe,
    })),
  };
}

/** Tool registry with descriptions (pt-BR) and validated runners. */
export const baristaTools: {
  [K in ToolName]: {
    description: string;
    schema: (typeof schemas)[K];
    run: (data: BaristaData, input: z.infer<(typeof schemas)[K]>) => unknown;
  };
} = {
  listarCafes: {
    description:
      "Lista os cafés publicados da Cura com todos os dados confirmados (origem, notas, pontuação). Campos nulos significam que o dado não está publicado: nunca preencha por conta própria.",
    schema: schemas.listarCafes,
    run: (data) => listarCafes(data),
  },
  detalharCafe: {
    description:
      "Dados confirmados de um café publicado, pelo slug (os slugs vêm de listarCafes).",
    schema: schemas.detalharCafe,
    run: detalharCafe,
  },
  compararCafes: {
    description:
      "Compara dois ou três cafés publicados lado a lado, só com dados confirmados.",
    schema: schemas.compararCafes,
    run: compararCafes,
  },
  listarMetodos: {
    description:
      "Lista os métodos de preparo do Laboratório, seus modos de quantidade e limites de capacidade.",
    schema: schemas.listarMetodos,
    run: (data) => listarMetodos(data),
  },
  consultarCompra: {
    description:
      "Preço, embalagens, disponibilidade e desconto Pix de um café (slug) ou de todos, direto da loja. Use SEMPRE que perguntarem preço, estoque, onde ou como comprar. Se o café não estiver disponível, ofereça as alternativas devolvidas.",
    schema: schemas.consultarCompra,
    run: consultarCompra,
  },
  calcularReceita: {
    description:
      "Calcula a receita com o motor oficial do Laboratório. Use SEMPRE que precisar de qualquer número de receita (gramas de café, água, proporção, rodadas, extrações). modo: cups = porções de bebida (pessoas/xícaras/copos; no espresso, número de extrações); coffee = gramas de café; water = gramas ou ml de água de preparo; size = tamanho nominal da moka. Retorna também a ação para abrir o Laboratório.",
    schema: schemas.calcularReceita,
    run: calcularReceita,
  },
  diagnosticarPreparo: {
    description:
      "Diagnóstico oficial de um preparo (amargo, azedo, fraco, forte, equilibrado, nao-sei). Informe o método e a receita usada quando conhecidos: a resposta inclui a primeira mudança sugerida e, quando possível, a receita ajustada.",
    schema: schemas.diagnosticarPreparo,
    run: diagnosticarPreparo,
  },
  analisarEspresso: {
    description:
      "Analisa uma extração de espresso a partir da dose, da bebida na xícara e do tempo, inclusive em cesto pressurizado.",
    schema: schemas.analisarEspresso,
    run: analisarEspresso,
  },
  buscarConteudo: {
    description:
      "Busca na base educativa da Cura (Academia e tópicos revisados) e devolve trechos com link para a lição.",
    schema: schemas.buscarConteudo,
    run: buscarConteudo,
  },
  recomendarCafe: {
    description:
      "Recomenda cafés publicados a partir de preferências explícitas, explicando o motivo com atributos do rótulo.",
    schema: schemas.recomendarCafe,
    run: recomendarCafe,
  },
};

/** Validates and runs a tool. Errors become data, never exceptions. */
export function runTool(data: BaristaData, name: string, input: unknown) {
  const tool = (
    baristaTools as Record<string, (typeof baristaTools)[ToolName]>
  )[name];
  if (!tool) return { ok: false, erro: `Ferramenta desconhecida: ${name}` };
  const parsed = tool.schema.safeParse(input ?? {});
  if (!parsed.success)
    return {
      ok: false,
      erro: "Parâmetros inválidos.",
      detalhes: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .slice(0, 5),
    };
  return (tool.run as (d: BaristaData, i: unknown) => unknown)(
    data,
    parsed.data,
  );
}

/** Collects UI actions returned by tools (deduplicated by href). */
export function actionsFrom(results: unknown[]): BaristaAction[] {
  const seen = new Set<string>();
  const out: BaristaAction[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    for (const key of ["acoes", "acao"])
      for (const action of ([] as unknown[]).concat(record[key] ?? []))
        if (
          action &&
          typeof action === "object" &&
          "href" in action &&
          "label" in action
        ) {
          const item = action as BaristaAction;
          if (!seen.has(item.href) && item.href.startsWith("/")) {
            seen.add(item.href);
            out.push(item);
          }
        }
    if (record.ajusteDeReceita) visit(record.ajusteDeReceita);
  };
  results.forEach(visit);
  return out.slice(0, 3);
}
