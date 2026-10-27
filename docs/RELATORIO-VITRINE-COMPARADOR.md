# Relatório — vitrine comercial, comparador e canais de contato

Entrega do Claude Code em 26–27/10/2026, integrada pelo PR [#9](https://github.com/igorbarone/CURA-CAF-/pull/9) (merge `36a7498`). O CI passou e a revisão automática do Codex terminou sem apontamentos. O deploy no GitHub Pages foi concluído com sucesso. Este documento serve como passagem de contexto para quem continuar o trabalho.

## 1. Diagnóstico de partida

Analisamos a `main` após os PRs #6, #7 e #8: identidade definitiva, `/empresas/` e Food Service.

**Pontos fortes mantidos**
- Arquitetura café/lote/oferta validada com Zod.
- Pages CMS em uso.
- Testes amplos: unitários, E2E desktop/mobile, axe e cenários com catálogo vazio.
- Regras do AGENTS.md respeitadas: nenhum preço, origem ou estoque inventado.

**Lacuna comercial principal:** o visitante não tinha nenhum caminho para falar com a Cura. Todo CTA terminava em "Em breve" ou "Canal em preparação", inclusive no Food Service, que é a prioridade B2B.

**Fraquezas de vitrine**
- Os cartões mostravam pontuação e torra só como texto pequeno.
- Não havia leitura de relance nem forma de comparar perfis.
- Estava pendente o comparador, previsto no roadmap.

## 2. O que foi feito

### 2.1 Canais de contato comercial configuráveis (`5f3cce6`)

| Item | Onde |
| --- | --- |
| Dados (WhatsApp, e-mail, Instagram), **vazios por padrão** | `content/contact.json` |
| Schema, carregamento e montagem dos links | `lib/contact.ts` (`contactSchema`, `getContact`, `contactLinks`) |
| Componente de links e aviso | `components/contact-links.tsx` |
| Ficha do café: a mensagem do WhatsApp leva nome e lote | `app/cafes/[slug]/page.tsx` → `ProductDetail` → `CommerceStatus` (prop `contact`) |
| Food Service: "Canal em preparação" passa a "Vamos conversar" | `app/empresas/page.tsx` |
| Rodapé | `components/footer.tsx` |
| Formulário no CMS: "Canais de contato comercial" | `.pages.yml` |

**Regras**
- Nada aparece enquanto o arquivo estiver vazio, que é o estado atual em produção.
- Só links externos (`wa.me`, `mailto:`, Instagram). Sem formulário, sem coleta e sem segredo no cliente.
- O aviso "não cria pedido, reserva ou contrato" acompanha os links.
- "Compra online · Em breve" continua.
- Formatos inválidos falham no build. Exemplos: WhatsApp fora do padrão `55` + DDD + número, e-mail malformado, Instagram com `@` ou URL, campo desconhecido.

**Ponto técnico:** o arquivo é lido via `CURA_CONTENT_ROOT`, como o restante do conteúdo. Assim os cenários conseguem testar o estado ativo.

### 2.2 Vitrine comercial (`1f265d1`)

- **Cartões** (`components/coffee-card.tsx`):
  - Pontuação SCA em destaque (`.score-value`).
  - Medidor de torra.
  - Etiquetas de acidez e corpo (`SensoryChips`, só com dado publicado).
  - Botão principal "Conheça X".
  - Botão "+ Comparar".
  - Mantidos `.lot-facts` e `.coffee-info > .eyebrow`, dos quais os testes existentes dependem.
- **Ficha** (`components/product-detail.tsx`):
  - Bloco `.quick-facts` com pontuação, torra e "Bom para", que substitui a antiga linha `product-roast`.
  - Etiquetas sensoriais.
  - Botão Comparar e link para o comparador.
- **Medidor de torra** (`components/roast-meter.tsx`, `roastLevel` em `lib/compare.ts`):
  - Mesma escala de 4 passos dos rótulos oficiais: clara = 1, média = 2, média-escura = 3, escura = 4.
  - Torra sem correspondência aparece só em texto.
  - O texto visível carrega o significado; os blocos são `aria-hidden`.

### 2.3 Comparador `/comparar/` (`1f265d1`)

| Peça | Arquivo |
| --- | --- |
| Rota | `app/comparar/page.tsx` |
| Tabela e seleção | `components/comparator.tsx` |
| Estado da comparação (sessionStorage `cura-compare`, máximo de 3) | `components/compare-provider.tsx`, montado em `app/layout.tsx` |
| Botão Comparar e link | `components/compare-toggle.tsx` (`CompareToggle`, `CompareLink`) |
| Barra fixa "Comparar agora" no catálogo | `components/compare-bar.tsx`, em `components/catalog.tsx` |
| Funções puras | `lib/compare.ts` (`MAX_COMPARE`, `parseCompareSlugs`, `comparePath`, `roastLevel`) |

**Comportamento**
- Até 3 cafés, com os dados do lote principal publicado.
- Linhas da tabela: perfil, notas, pontuação, torra, acidez, corpo, preparo, produtores, origem, variedade, lote e "Preço e disponibilidade: a confirmar".
- **Link compartilhável** `?cafes=samba,salsa`. Ele vence a sessão; slugs desconhecidos e repetidos são descartados e a URL é corrigida.
- Sem escolha prévia, com catálogo de até 3 cafés, mostra todos. Isso também vale para o HTML estático, por SEO.
- Ordem dos efeitos: o provider carrega a sessão primeiro (`ready`) e só depois o comparador aplica a URL. Isso evita que o filho sobrescreva a sessão antes dela carregar.
- No celular a tabela usa `table-layout: fixed` e cabe em 390 px sem rolagem horizontal. Acima de 3 cafés, o contêiner `.compare-scroll` rola internamente.
- Catálogo vazio mostra um estado editorial.
- Sitemap e rodapé incluem `/comparar/`. O menu do header não foi alterado, porque já está no limite em desktop.

### 2.4 Cartão compacto (ajuste posterior ao PR #9)

O cartão ocupava quase uma tela, com o rótulo a ~450 px e descrição longa. Agora segue padrão de loja:
- Grade `auto-fill` com mínimo de 290 px: até 3 colunas no desktop, 1 no celular.
- Imagem de 300 px no desktop e 250 px no celular.
- Produtor em uma linha (`.card-producers`), perfil e notas juntos (`.card-taste`).
- `.lot-facts` com três colunas: pontuação, torra e "Bom para".
- Preço "a confirmar" e botões Conheça e Comparar.
- A descrição e as etiquetas de acidez/corpo saíram do cartão e continuam na ficha.

Na Home, o espaço livre da grade recebe o bloco `.choice-help` ("Em dúvida?"), que leva a `/comparar/` e `/descubra/`. Ele só aparece quando há cafés publicados.

## 3. Validação executada

- `npm run lint`, `npx tsc --noEmit`, `npm run validate:content` (que agora informa também o número de canais de contato) e Prettier nos arquivos tocados.
- `npm test`: 30 unitários e 48 E2E desktop/mobile aprovados. Novos testes:
  - `tests/unit/contact.test.ts`: links, formatos inválidos e arquivo publicado vazio.
  - `tests/unit/compare.test.ts`: escala de torra, parsing do link e limite de 3.
  - `tests/compare.spec.ts`: fluxo cartão → barra → comparador, dados lado a lado, sem `R$`, sem overflow, axe, desmarcar, link com slug inválido e catálogo vazio.
  - `tests/unit/cms-config.test.ts`: cobre o novo arquivo do CMS.
- `npm run test:scenarios`: 12 E2E de cenário e 42 E2E com catálogo vazio aprovados. Os cenários gravam um `contact.json` de teste para validar o estado ativo na ficha, no Food Service e no rodapé, e o removem antes da rodada de catálogo vazio.
- O export real foi conferido sem nenhum link de contato.
- Revisão visual com capturas desktop e mobile do catálogo, da ficha, do comparador e do contato ativo, este com dados fictícios que não entraram no commit.

## 4. Decisões registradas

- O README ganhou as seções "Canais de contato comercial" e "Vitrine e comparador".
- `docs/POSICIONAMENTO-FOOD-SERVICE.md` ganhou "Canal direto configurável".
- `docs/ROADMAP.md`:
  - Comparador concluído.
  - Nova seção "Vitrine comercial e assistência de escolha".

## 5. Pendências (dependem da equipe)

1. **Canais reais** de WhatsApp e e-mail, e quem responde. Basta preencher no CMS.
2. **Preço e peso de referência por oferta.** O schema e a ficha já exibem esses campos; hoje há 0 ofertas.
3. **Rótulos com campos entre colchetes** (`[Município]`, `[PROCESSO]`, `1 DE [N]`, `SAFRA [2026]`). Estão identificados na legenda, mas são a imagem principal da vitrine. Completar ao confirmar os dados.

## 6. Próximos passos sugeridos

- **Imagem de compartilhamento.** Hoje não há `og:image`, e o Twitter usa `summary`. Fontsource Archivo só traz woff2, que o `next/og` não lê. Será preciso gerar PNGs estáticos ou incluir a fonte em ttf/woff.
- **Lista de espera "Avise-me"**, assim que houver um serviço externo de e-mail definido.
- **Assistente de escolha com IA**, quando houver mais microlotes:
  - Exige serviço externo, porque o export estático não guarda chaves.
  - Respostas restritas ao catálogo publicado.
  - Aviso de IA e revisão de privacidade antes de ativar.
  - Quiz, filtros e comparador já usam os mesmos atributos estruturados de lote que serviriam de base.
- **Observação de SEO:** `robots.txt` em `/CURA-CAF-/` não é lido pelos buscadores, que só o procuram na raiz do domínio. Passa a valer com domínio próprio.

## 7. Cuidados para quem continuar

- Os testes dependem de `.lot-facts`, `.coffee-info > .eyebrow` e dos nomes acessíveis `Comparar <NOME>`, "Comparar agora" e "Compra online · Em breve".
- Não ler `content/contact.json` em componente cliente, porque `lib/contact.ts` usa `fs`. Passe os links prontos por prop, como é feito na ficha.
- O CSS novo está no fim de `app/globals.css`, nos blocos "Real contact channels" e "Vitrine comercial".
