# CURA Experience 2.0

Evolução da Fase 1 a partir da auditoria de 11/11/2026 (nota 6,8/10). A plataforma continua no mesmo site, em `/experiencia`, aberta pelo QR Code único (`?origem=qr`). Não há link público, ela fica fora do sitemap, tem `noindex` e não exige cadastro. Visão geral, rotas e regras de dados: [EXPERIENCIA.md](EXPERIENCIA.md).

## 1. Motor de receitas (fonte única de verdade)

`lib/experience/brew.ts` calcula tudo o que a experiência mostra:
- o cartão da receita;
- a calculadora;
- os passos e o cronômetro;
- a nova tentativa após o diagnóstico;
- o diário e as receitas salvas;
- as ferramentas do Barista, tanto no modo guiado quanto na IA.

Uma receita é sempre descrita por `BrewParams` (método, modo, quantidade, intensidade, proporção e dose), e o Laboratório a recebe pela URL (`lib/experience/lab-link.ts`). Assim, ninguém reconstrói uma receita a partir de texto livre.

**Unidades e arredondamento**
- Café: arredondado para 0,5 g. Água e bebida: arredondadas para 1 g (≈ 1 ml).
- O valor digitado pela pessoa é mantido. Só os valores derivados são arredondados, e a receita mostra o valor exato (`≈ exato 15,6 g`) e a proporção efetiva (`1:16,1`).
- "Água" é a água de preparo. O pó retém cerca de 2 g de água por grama, então a xícara recebe menos. As porções são definidas pela bebida na xícara (por exemplo, 2 xícaras de 150 ml: 21,5 g de café e 344 g de água).

**Modelos por método** (campo `kind` em `content/experience/methods.json`)

| Método | Modelo | Regra |
|---|---|---|
| V60, Melitta, cafeteira elétrica | `filter` | Porções, café ou água. A pré-infusão usa 2,5 × o café. Os alvos de despejo são o total acumulado na balança. Acima da capacidade prática, a receita vira rodadas. |
| Prensa francesa, AeroPress | `immersion` | Igual ao filtro. **AeroPress:** a fabricante informa câmara de ~296 ml (Original, Clear, Go Plus); usamos no máximo 230 g de água por rodada e dividimos o restante em rodadas completas. A capacidade é conferida depois do arredondamento. |
| Espresso | `espresso` | Cada bebida é **uma extração com uma dose de cesto** (referência: 18 g, ajustável de 7 a 22 g no modo avançado). A proporção 1:2 refere-se à bebida na xícara. Duas bebidas são duas extrações, nunca 36 g no mesmo cesto. Há nota sobre cesto pressurizado. |
| Moka | `moka` | Quem define as quantidades é a cafeteira: água fria até logo abaixo da válvula (conforme o manual da Bialetti Moka Express), cesto cheio, nivelado e sem compactar. Os gramas são uma referência aproximada por tamanho nominal (1 a 12 xícaras), e a intensidade se ajusta pela moagem. |
| Cold brew | `cold` | Separa a água de infusão, o concentrado recuperado (água − retenção) e a bebida pronta (concentrado + a mesma quantidade de água, gelo ou leite). |

O cronômetro começa no evento real de cada método: "ao molhar o pó", "ao despejar", "ao acionar a extração" ou "ao levar ao fogo". Com várias rodadas, o cronômetro roda cada uma separadamente. Pedidos inviáveis (zero, menos de 5 g de café por rodada, mais de 4 litros, dose fora do cesto, tamanho de moka inexistente) geram um erro explícito, nunca uma receita silenciosa.

## 2. Laboratório inteligente

O fluxo tem 4 decisões: café, equipamento, quantidade (só os modos que o método aceita) e intensidade (não se aplica à moka). Os detalhes técnicos ficam no modo Avançado.
- **Preparo guiado:** cada etapa diz o que fazer, quanto, quando e o que observar ("Observe: o pó estufa").
- **Diagnóstico:** sugere uma mudança por vez. Em "Não consegui identificar", faz uma pergunta extra em vez de concluir. Cada sugestão estruturada (`apply` em `diagnosis.json`) aplica o ajuste no motor ("Preparar de novo com este ajuste"): só a proporção muda os números; moagem, tempo e temperatura viram notas explícitas.
- A URL acompanha a receita, que pode ser retomada ou compartilhada.
- A calculadora parte dos mesmos números da receita e limpa o valor derivado quando a entrada é inválida.

## 3. Barista Cura

### Arquitetura
- **Ferramentas tipadas** (`lib/experience/barista-tools.ts`): `listarCafes`, `detalharCafe`, `compararCafes`, `listarMetodos`, `calcularReceita`, `diagnosticarPreparo`, `analisarEspresso`, `buscarConteudo` e `recomendarCafe`. Cada entrada é validada com Zod `strict` e devolve dados mais ações de interface (abrir o Laboratório com os parâmetros, ver o café, abrir a lição). A base de conhecimento é o próprio conteúdo do repositório (catálogo, lotes, métodos, Academia, diagnóstico, tópicos), sem banco vetorial e sem copiar dados de produto para o prompt.
- **Modo guiado (sem IA)**, em `lib/experience/barista.ts` e `barista-intent.ts`. Extrai do texto o café, o método, a quantidade (ml, g, litros, xícaras, pessoas, copos, doses), o sintoma e as medidas de espresso. A intenção vale antes da entidade: "SALSA + V60 + 250 ml" calcula a dose em vez de mostrar a ficha. Mantém o contexto da sessão ("E se eu quiser fazer duas xícaras?") e faz uma única pergunta curta quando falta algo essencial.
- **Modo IA:** rota `app/api/barista/route.ts` (apenas no alvo servidor/Vercel), com o SDK oficial `@anthropic-ai/sdk` (versão fixada em 1.3.0) e um laço de ferramentas manual e limitado em `lib/experience/server/barista-ai.ts`. O modelo escolhe as ferramentas, e o servidor valida e executa as mesmas funções do modo guiado: **nenhum número de receita é produzido pelo modelo**. As respostas chegam em streaming (NDJSON), com cancelamento. A interface `BaristaModel` permite trocar de provedor ou usar um modelo simulado nos testes.
- **Interface híbrida:** a experiência inteira funciona sem IA. A página do Barista pergunta ao servidor se a IA está ativa (`GET /api/barista`) e mostra claramente "BARISTA COM IA" ou "MODO GUIADO · SEM IA". Se a IA falhar, a mensagem diz isso e oferece o modo guiado; nada simulado é apresentado como IA. No export estático (GitHub Pages), o modo é sempre guiado.
- **Contexto entre funcionalidades:** o café escolhido vale para toda a experiência (barra "Seu café"). O diagnóstico do Laboratório abre o Barista com a receita e o sintoma na URL e uma pergunta editável já preenchida. O modelo recebe esse contexto como dado (`<contexto_da_sessao>`), separado das instruções.

### Modelo
- Padrão: **`claude-opus-5-5`** com `effort: low` (o mais capaz para seguir regras e usar ferramentas em português), com fallback de recusa no servidor (`fallbacks: "default"`).
- O briefing pedia um modelo econômico. A alternativa mais barata é **`claude-haiku-5-5`** (cerca de 40 vezes mais barata), configurável em `BARISTA_MODEL`. Ela não tem fallback de recusa no servidor. Antes de trocar, rode `npm run eval:barista` com o modelo candidato. **A escolha é da equipe; nenhum dos dois foi validado com chamadas reais nesta entrega** (ver Testes).

### Ativação (Vercel, alvo servidor)
1. **Banco:** use o Postgres já usado pela loja (`DATABASE_URL` ou `POSTGRES_URL`). A tabela `barista_usage` é criada automaticamente e também consta em `db/migrations/002_barista_usage.sql`.
2. **Variáveis de ambiente**, só no servidor, nunca `NEXT_PUBLIC_`:
   - `BARISTA_AI=enabled`
   - `ANTHROPIC_API_KEY=<chave>`
   - `BARISTA_HASH_SECRET=<32+ caracteres aleatórios>`
   - opcional: `BARISTA_MODEL=claude-haiku-5-5`
3. **Limites opcionais** (os padrões estão entre parênteses):
   - `BARISTA_LIMIT_IP_PER_MINUTE` (6), `BARISTA_LIMIT_IP_PER_DAY` (60), `BARISTA_LIMIT_SESSION_PER_DAY` (40)
   - `BARISTA_DAILY_REQUESTS` (1000), `BARISTA_DAILY_INPUT_TOKENS` (4.000.000), `BARISTA_DAILY_OUTPUT_TOKENS` (400.000)
   - `BARISTA_MAX_OUTPUT_TOKENS` (1500), `BARISTA_MAX_STEPS` (4), `BARISTA_TIMEOUT_MS` (30000), `BARISTA_MAX_CONCURRENCY` (6), `BARISTA_EFFORT` (low)
4. **Orçamento no provedor:** configure no Console da Anthropic um limite de gasto mensal para a organização ou o workspace da chave. Alertas de gasto avisam, mas não bloqueiam por si; o bloqueio local é o limite diário de tokens acima.
5. Faça o deploy de preview, rode `npm run eval:barista` com a chave e revise as respostas antes de publicar.

Sem `BARISTA_AI=enabled`, sem chave ou sem um armazenamento durável, a IA fica desligada, o status informa o motivo (`disabled`, `missing_credentials`, `missing_rate_limit_store`) e a experiência segue no modo guiado. `BARISTA_ALLOW_MEMORY_LIMITS=true` existe só para desenvolvimento local.

## 4. Custos (estimativa com premissas explícitas)

**Premissas**
- Prefixo fixo (instruções + definições das ferramentas): 2.955 + 4.383 caracteres, ≈ 2.300 tokens.
- Uma resposta típica faz duas chamadas ao modelo (uma de ferramenta e uma de resposta), com histórico médio de ≈ 600 tokens e resultado de ferramenta de ≈ 600 tokens. Total por resposta: **≈ 6.700 tokens de entrada e ≈ 500 de saída**, incluindo o raciocínio em esforço baixo.
- Não contamos economia de cache de prompt: o prefixo provavelmente fica abaixo do mínimo cacheável.
- Preços de tabela da Anthropic consultados em 03/11/2026, em US$ por milhão de tokens (entrada/saída): Opus 5.5 4/20, Sonnet 5.5 2/10, Haiku 5.5 0,10/0,50. **Confirme na página de preços vigente antes de decidir.**

| Respostas por mês | Opus 5.5 (≈ US$ 0,037 cada) | Sonnet 5.5 (≈ US$ 0,018) | Haiku 5.5 (≈ US$ 0,0009) |
|---|---:|---:|---:|
| 1.000 | ≈ US$ 37 | ≈ US$ 18 | ≈ US$ 0,90 |
| 10.000 | ≈ US$ 370 | ≈ US$ 184 | ≈ US$ 9 |
| 50.000 | ≈ US$ 1.850 | ≈ US$ 920 | ≈ US$ 46 |

**Teto com os limites padrão:** 4 milhões de tokens de entrada e 400 mil de saída por dia, o que equivale a cerca de US$ 24/dia no Opus 5.5 (≈ US$ 720/mês) ou cerca de US$ 0,60/dia no Haiku 5.5. Ao atingir o teto, a IA responde "limite de hoje" e o modo guiado continua. A execução das funções na Vercel depende do plano contratado e não está incluída aqui.

## 5. Segurança e privacidade

**Proteções no servidor** (nada depende do navegador):
- origem idêntica e cabeçalho `x-cura-barista: 1`;
- corpo de até 24 KB, validado com Zod `strict`; mensagem do usuário com até 500 caracteres; papel `system` recusado;
- histórico limitado às últimas 12 mensagens;
- limites por IP com hash (minuto e dia), por sessão anônima (dia), por total diário de requisições e por orçamento diário de tokens. São gravados em **Postgres** e, por isso, valem para todas as instâncias serverless;
- concorrência por instância (uma resposta por sessão e um máximo global configurável);
- `max_tokens`, no máximo 4 chamadas ao modelo por resposta e tempo limite de 30 s;
- ferramentas sem acesso à rede ou a arquivos, só a funções puras;
- resultados de ferramentas com até 6.000 caracteres.

**Injeção de prompt:** as instruções do sistema declaram que histórico, contexto e resultados de ferramentas são dados. Entradas maliciosas nas ferramentas são rejeitadas pelo Zod (chaves desconhecidas, números fora de faixa). O conteúdo consultado é do próprio repositório.

**Privacidade**
- Não pedimos dados pessoais.
- IP e id de sessão são guardados só como hash diário com segredo (`BARISTA_HASH_SECRET`). As linhas são apagadas após 2 dias.
- **O texto das conversas não é registrado** nos logs, que guardam apenas código, duração e tokens.
- A conversa fica só no `sessionStorage` da aba. O diário e as receitas salvas ficam no `localStorage` do aparelho, sem sincronização, com opção de apagar tudo.
- Analytics registra o tipo de interação, nunca o texto.
- Pelas condições comerciais da API da Anthropic, as entradas não são usadas para treinar modelos. Revise a retenção do provedor na política de privacidade do site antes de ativar.

**Riscos residuais**
- IPs rotativos ou proxies diluem o limite por IP; o orçamento diário global é o teto final.
- A concorrência é controlada por instância.
- O modelo pode errar a redação de um conceito. A interface mostra que a resposta é gerada por IA, e os números vêm sempre das ferramentas.
- O comportamento do modelo real não foi avaliado nesta entrega.

## 6. Minha jornada

`/experiencia/minha-jornada/` (`lib/experience/journal.ts`) mostra:
- as receitas salvas, que podem ser reabertas no Laboratório com os mesmos parâmetros ou removidas;
- o diário de preparo (data, café, receita, resultado marcado, ajuste sugerido, ligação "nova tentativa");
- contagens simples (métodos mais usados, cafés registrados, sequência dos resultados), apresentadas como registro e não como medida de paladar;
- uma sugestão de outro café, com o motivo tirado dos atributos publicados.

Os dados são validados na leitura, e navegação privada ou armazenamento bloqueado são tratados.

## 7. Auditoria: situação dos achados

| ID | Situação |
|---|---|
| A01 AeroPress 400 g | **Resolvido.** Rodadas de até 230 g, conferidas após o arredondamento. |
| A02 Espresso 36 g | **Resolvido.** Uma extração por bebida, com dose de cesto ajustável. |
| A03 Arredondamento | **Resolvido.** Política única; a calculadora parte dos números da receita e mostra a aproximação e a proporção efetiva. |
| A04 Moka | **Resolvido.** Água fria conforme o manual, válvula, cesto e tamanho nominal. Validação com equipamento real: pendente. |
| A05 Início do timer | **Resolvido.** Botão e dica por método. |
| A06 SALSA + V60 + 250 ml | **Resolvido.** 15,5 g e link com parâmetros, nos dois modos. |
| A07 Oster e TDS | **Resolvido no modo guiado** (análise de dose, bebida e tempo; tópicos de TDS e rendimento). No modo IA, coberto pela ferramenta `analisarEspresso` e pelos casos da avaliação; falta rodar a avaliação real. |
| A08 Sliders sem nome | **Resolvido.** `label for`, unidade em `aria-valuetext` e descrição. |
| A09 Quiz pular | **Resolvido.** "Pular e ver meu perfil" com mensagem e retorno, sem botão travado. |
| A10 Overflow em 340 px | **Resolvido no teste automatizado** em 320 e 375 px. Validação em aparelho físico: pendente. |
| A11 SCA/CVA e heurísticas | **Resolvido.** A escala 0–100 é apresentada como referência histórica, ao lado do CVA, e as heurísticas como pistas. |
| A12 Entrada | **Resolvido.** A escolha da embalagem vem primeiro, com "Quero preparar meu café". "Dados deste lote" vem antes da aula. |
| A13 "Comprar novamente" no quiz | **Resolvido.** "Experimentar o … (ver na loja)". |
| A14 TDS × rendimento | **Resolvido.** Fórmula e exemplo (250 g × 1,4% → 3,5 g; 19,4%); a degustação não usa mapa da língua. |
| A15 Diagnóstico → Barista | **Resolvido.** A receita e o sintoma vão na URL, com pergunta editável. |

## 8. Testes

- **Unitários** (`npm run test:unit`, 102 no total), incluindo:
  - motor de receitas (14);
  - Barista guiado com as 10 perguntas obrigatórias, o caso Oster e o caso DA CASA (15);
  - camada de IA com modelo simulado: ferramentas, validação, recusa, limite de passos, configuração, limites e orçamento, origem, payload, streaming, 429 e tempo limite (9);
  - diário e receitas salvas (4).
- **End-to-end** (`npm test`, Playwright em desktop e celular):
  - acessibilidade WCAG A/AA nos temas creme e Black em todas as rotas;
  - entrada pela embalagem;
  - Dados do lote;
  - AeroPress, espresso e moka;
  - calculadora;
  - **cenário completo da Fase K** (QR → SALSA → V60 250 g → cronômetro → amargo → ajuste → salvar → diário → Barista com contexto);
  - Barista guiado com link para o Laboratório;
  - simulador e quiz;
  - telas de 320 e 375 px;
  - navegação inferior, `noindex` e ausência de links públicos.
- **Avaliação da IA real** (`npm run eval:barista`): 13 casos, incluindo os da auditoria e uma tentativa de injeção. **Não foi executada** por falta de credencial nesta sessão; sem chave, o script informa isso e não faz chamadas.
