# Cura Café — da roça à cidade

Site oficial da Cura Café: experiência editorial de curadoria brasileira em Next.js App Router, TypeScript e Tailwind CSS, com exportação estática para GitHub Pages. Não há checkout, pagamentos, reservas ou pedidos reais nesta fase.

## Desenvolvimento

Use Node.js 22:

```bash
npm ci
npm run dev
```

No desenvolvimento, não definir `GITHUB_PAGES`. Não executar dev e build simultaneamente: compartilham `.next`. As fontes Archivo, DM Mono e Newsreader itálica são hospedadas localmente via Fontsource. A identidade usa creme, Marrom Cura e ocre, com o percurso gráfico da curva à reta e animações que respeitam movimento reduzido.

Rotas: `/`, `/cafes/`, `/cafes/{slug}/` e `/carrinho/`. As URLs atuais de SAMBA e SALSA foram preservadas. Header/menu mobile, footer, cartões, arte, breadcrumbs e estado comercial são reutilizáveis. O carrinho permite revisar uma seleção demonstrativa quando há ofertas publicadas, guardando apenas IDs na sessão do navegador; não cria transações, reservas ou totais de pedido.

## Conteúdo e CMS

Café (identidade/URL/foto), lote (origem e sensorial) e oferta (referência comercial) são entidades separadas. Os JSON ficam em `content/coffees/`, `content/lots/` e `content/offers/`; `content/home.json` controla textos e ordem dos destaques. O build valida dados, relações e arquivos de mídia com Zod. Usar `npm run build` preserva os passos de validação e finalização da exportação, inclusive a compatibilidade do catálogo vazio com Next 15. O conjunto real de ofertas está vazio, sem preços ou estoque fictícios.

Perfil, torra e preparo são filtros derivados de todos os lotes publicados. A ficha permite selecionar lotes; cafés sem lotes têm estados pendentes. Rascunhos não são emitidos no export; cafés arquivados mantêm a URL com aviso e `noindex`. Os componentes não dependem de nomes ou quantidades fixos.

A proposta inicial é Pages CMS sobre Git, com formulários em `.pages.yml` para cadastrar/editar, mudar o estado editorial e trocar fotos sem editar código. A instalação, credenciais e permissões do serviço não foram alteradas nesta entrega. A edição de conteúdo diretamente na `main` foi preservada; código segue branch/PR. Não existe painel simulado no site. Consulte:

- [Arquitetura, entidades e validação](docs/ARQUITETURA-CATALOGO.md)
- [Decisão de CMS: Git versus API, custos e segurança](docs/CMS-DECISAO.md)
- [Operação editorial, migração e reversão](docs/OPERACAO-CONTEUDO.md)

A marca e o símbolo usam vetores extraídos diretamente do manual oficial de 26/10/2026, sem redesenho. Enquanto não há fotos oficiais por café, usamos fichas editoriais identificadas. Fotos reais autorizadas podem ser cadastradas em `public/media/`, com alt e crédito obrigatórios. Não há fotografias sintéticas apresentadas como registro de origem, nem dados de origem, preço ou disponibilidade presumidos.

## Validação

```bash
npm run validate:content
npm run lint
npx playwright install --with-deps chromium
npm run test:scenarios
npm test
```

`test:scenarios` faz um export com conteúdo técnico isolado, verifica foto, seleção de lotes, múltiplas ofertas sem valores, Home configurável, café sem lote, arquivamento e isolamento de drafts. Também faz um build e regressões com o catálogo completamente vazio. Remove a imagem técnica e reconstrói o export real ao terminar, inclusive após falha dos cenários. Não executar em paralelo com outros comandos que leem/escrevem `.next` ou `out`.

`npm test` executa unidades e regressões Playwright sobre o export real. As regressões leem as seleções/dados publicados em vez de exigir exatamente dois cafés, e continuam úteis após edições pelo CMS. A migração original é conferida separadamente pelo snapshot `tests/fixtures/legacy-catalog.json` e adaptador de migração em `scripts/lib/migrate-legacy.ts`, sem congelar o catálogo vivo. Há cobertura desktop/mobile, navegação, filtros, recursos HTTP/JS, fontes, overflow, axe e movimento reduzido. Auditoria automatizada não substitui avaliação humana completa de acessibilidade.

Para um build real independente: `GITHUB_PAGES=true npm run build`. Para apenas testes de domínio: `npm run test:unit`. Com Chromium já instalado, usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` nos comandos que abrem navegador. `CURA_CONTENT_ROOT` existe exclusivamente como entrada de teste/adaptação build-time e não deve ser fixada em produção.

## Publicação

Em GitHub **Settings → Pages → Build and deployment**, selecionar **GitHub Actions**. O CI verifica lint, conteúdo, unidades, cenários e regressões antes de publicar o export real em `out/`, preservando `/CURA-CAF-/`. A produção é estática; `npm start` não serve esse modo de exportação. Status editorial, merge e deploy são etapas distintas.

Para comércio real, escolher provedor e validar preço, estoque, variantes, frete, pagamento e pedidos. O CMS não é uma fonte autoritativa de estoque transacional, e publicar uma oferta editorial não habilita compra.

## Orientações

- [Instruções para Codex](AGENTS.md)
- [Identidade e dados confirmados](docs/IDENTIDADE.md)
- [Roadmap](docs/ROADMAP.md)
- [Benchmark funcional Coffee++ e diferenciação da Cura](docs/BENCHMARK-ECOMMERCE.md)

O benchmark informou descoberta por atributos, fichas claras e continuidade da navegação. Nenhum código, texto ou ativo da Coffee++ foi incorporado. A Cura mantém seu recorte de curadoria, autoria do produtor e estética editorial própria.

## V1 de apresentação

Novas rotas: `/descubra/`, `/clube/` e `/historia/`. Quiz baseado exclusivamente nos lotes publicados, com correspondência exata de preferências e explicações por atributo, sem cadastro ou envio de respostas. Clube é uma proposta futura, sem contratação. História apresenta somente o propósito documentado da curadoria. O conteúdo editorial está em `content/site.json`, disponível no Pages CMS.

[Guia de apresentação, checklist e pendências](docs/APRESENTACAO-V1.md) · [Assets oficiais e arquivos pendentes](docs/ASSETS-V1.md) · [Capturas desktop/mobile](docs/screenshots/README.md). `npm run screenshots` gera as capturas sobre o export Pages; `npm run present` serve o export local para apresentação, sem deploy.

## Missão 05 — identidade definitiva

Manual de 26/10/2026 aplicado: marrom/creme/ocre, cinco cores de perfil, Archivo Expanded real no eixo 125%, vetores oficiais de marca/símbolo/favicon e rótulos de SAMBA/SALSA. Os rótulos são artes identificadas com campos provisórios; não são fotografia ou oferta confirmada. Catálogo ganhou ordenação por curadoria, nome e pontuação, sem ordenação por preço ausente. O CMS ganhou natureza da imagem e nota confirmada de curadoria por lote, sem limites a dois cafés.

[Auditoria, fontes e pendências da Missão 05](docs/MISSAO05.md) · [Comparação antes/depois](docs/missao05/README.md). Edição editorial direta na main e publicação Pages preservadas.

## Refinamento editorial e empresas

Página B2B `/empresas/`, democratização em linguagem/conhecimento/experiência e protagonismo dos produtores. Filtros e ordenação exibem os atributos do mesmo lote, com pontuação textual e links para a ficha correspondente. [Diagnóstico, operação do CMS e futura captação](docs/EMPRESAS-E-REFINAMENTO.md).

## Posicionamento e Food Service

**Democratizando café especial.** lidera a Home; **Da roça à cidade.** assina a origem e os três verbos explicam o método. `/empresas/` prioriza estabelecimentos gastronômicos e usa o mesmo catálogo publicado. [Comunicação, CMS, jornada de parceria e pendências comerciais](docs/POSICIONAMENTO-FOOD-SERVICE.md).

## Canais de contato comercial

`content/contact.json` (Pages CMS → **Canais de contato comercial**) guarda WhatsApp, e-mail e Instagram reais da equipe. Vazio, nada é exibido e o site mantém os estados “em preparação”. Preenchido, aparecem links na ficha de cada café (mensagem com nome e lote), na seção de parceria de `/empresas/` e no rodapé. São links externos (`wa.me`, `mailto:`, Instagram): o site não coleta dados, não tem formulário e não cria pedido, reserva ou contrato; o texto ao lado dos links diz isso. Formatos inválidos falham na validação do build. Decisão: é a forma de abrir conversa comercial sem servidor, sem segredos no cliente e sem checkout falso.

## Vitrine e comparador

Os cartões são compactos, em padrão de loja (grade de até 3 colunas, imagem de 300 px, produtor em uma linha, perfil e notas, faixa com pontuação, torra e preparo, preço “a confirmar” e botões Conheça/Comparar); descrição longa e etiquetas de acidez/corpo ficam na ficha. Na Home, um bloco “Em dúvida?” leva ao comparador e ao quiz. Cartões e ficha do café mostram pontuação SCA em destaque, medidor de torra na mesma escala de quatro passos dos rótulos oficiais (clara = 1, média = 2; torras sem correspondência aparecem só em texto), acidez/corpo como etiquetas quando publicados e botão principal para a ficha. `/comparar/` coloca até três cafés lado a lado com os dados do lote principal publicado; preço e disponibilidade seguem “a confirmar”. A escolha é feita pelo botão “Comparar” nos cartões e na ficha, guardada só na sessão do navegador, e o link `?cafes=samba,salsa` é compartilhável (slugs desconhecidos são ignorados). Sem cadastro, coleta ou dado inventado. Decisão: comparar pelos atributos já estruturados prepara o catálogo de microlotes e uma futura assistência de escolha (ver roadmap). [Relatório da entrega](docs/RELATORIO-VITRINE-COMPARADOR.md).

Catálogo a partir dos rótulos oficiais de 10/11/2026: SAMBA e SALSA (Linha Origem, safra 2026, Região Campos Altos – MG, 1.200 m, processo natural; SALSA passa a torra média e coado/espresso, como no rótulo) e o novo DA CASA (blend gourmet da Linha Casa, sem pontuação/origem no rótulo, campos vazios). Ofertas de 250 g em grãos: R$ 39,90 para os especiais e R$ 29,90 para o gourmet, preços definidos pela equipe; estoque inicial de 20 unidades cada para homologação (`CURA_STOCK_FROM_CMS`). As artes PNG dos rótulos são a imagem principal. Decisão: os rótulos impressos são a fonte; nada além deles foi acrescentado.

Tema black e console de origem: o creme continua padrão; o botão “Black” no cabeçalho liga o tema escuro (Breu #1E130C como fundo, creme como texto, ocre nos destaques), lembrado no navegador e aplicado antes da primeira pintura, sem piscar. As cores do CSS viraram tokens (`--brand`, `--cream`, `--light` e versões `-rgb`); blocos que já eram escuros viram um preto mais profundo. O cabeçalho traz o símbolo C oficial ao lado do logotipo. Para isso foram criadas cópias dos vetores oficiais apenas sem o painel de fundo (`public/brand/*-transparente.svg`), sem redesenho; o C é aplicado como máscara e assume a cor do tema.  Um teste roda a checagem de acessibilidade WCAG AA em todas as páginas públicas no tema black, e a jornada de compra passa inteira nos dois temas (`COMMERCE_THEME=black npm run test:commerce`).

Embalagens na venda: as imagens das embalagens de SAMBA, SALSA e DA CASA (cenas criadas digitalmente) são a imagem principal de cada café, cadastradas com o novo tipo de mídia `illustration` (“Ilustração da embalagem” no CMS). Elas aparecem sempre com o selo “Ilustração digital” e o crédito diz que a cena não retrata a fazenda do produtor; o rótulo oficial fica na galeria. Usos: vitrine do hero (alterna os cafés a cada 5 s, pausa ao passar o mouse ou focar, sem movimento com redução de movimento), cartões da loja (mais baixos; ao passar o mouse, o rótulo aparece inteiro), ficha do produto (imagem grande) e fluxo de compra (miniatura no carrinho, mini-carrinho, resumo do checkout e barra fixa do celular, via `image` no price book). Decisão: imagem ilustrativa ajuda a vender sem se passar por fotografia real.

## Cura Commerce: Asaas, Melhor Envio, catálogo central e painel

A loja roda no **alvo de servidor** (Vercel, `npm run build:server`). O export do GitHub Pages segue sem runtime e com "Compra online em breve". O que está pronto, para homologação em **sandbox**:
- **Catálogo central** no Pages CMS: Café → Lote → Variante, com peso bruto, medidas, preço promocional opcional, limites de quantidade e janelas de venda. Uma variante só é vendida com preço, SKU e dados de envio. O validador e o painel mostram o que falta.
- **Asaas:**
  - Pix com QR Code e **5% de desconto só nos cafés**;
  - cartão pago na página segura do Asaas, sem dados de cartão na Cura;
  - webhook autenticado e idempotente;
  - prazo de pagamento com devolução única do estoque.
- **Melhor Envio:**
  - carrinho empacotado em volumes de até 4 kg, nas caixas do CMS;
  - cotação por volume (PAC e .Package conforme a cotação real);
  - etiquetas compradas só por ação explícita, uma por pedido, com rastreio.
- **Pedidos:** status financeiro separado do logístico. Não há overselling sob concorrência, e um webhook repetido ou fora de ordem nunca baixa estoque duas vezes.
- **Painel `/admin`** com senha da equipe: indicadores, pedidos, etiquetas, estoque auditado com pausa por SKU, produtos e lotes.
- **Barista:** preço e disponibilidade pela ferramenta `consultarCompra`, alternativas quando esgota, comparação sem nomes fixos.

Decisões (11/11/2026):
- O Asaas substitui o Mercado Pago por decisão da equipe. O cartão usa a página hospedada do Asaas, para que nenhum dado de cartão passe pelo servidor.
- O catálogo continua no Git (Pages CMS): cada mudança de preço ou de origem é versionada, revisada e validada no build. O banco guarda só estoque, pausas, pedidos, pagamentos e etiquetas.
- Os dados de envio não foram inventados. As variantes reais ficam fora da venda online até a equipe informar peso bruto, medidas, caixas e o CEP de origem.
- A cobrança real exige `ASAAS_ENVIRONMENT=production`, uma chave de produção **e** `CURA_ALLOW_LIVE_PAYMENTS=true`.
- A taxa de cartão de 3% é só uma premissa interna dos indicadores.

Testes: `npm run test:unit` e `npm run test:commerce`. O segundo usa um catálogo fictício e simuladores HTTP do Asaas e do Melhor Envio, e nunca usa credenciais reais. Para operar: painel `/admin` ou `npm run ops`.

Detalhes:
- [Arquitetura](docs/COMMERCE-ARQUITETURA.md);
- [dados que a equipe precisa fornecer e roteiro de ativação](docs/COMMERCE-ATIVACAO.md);
- [passo a passo na Vercel](docs/HOMOLOGACAO-VERCEL.md).

## CURA Experience (Fase 1)

Destino permanente do QR Code das embalagens: `/experiencia/?origem=qr`. Acesso exclusivo pelo QR: sem links no menu, home, rodapé ou fichas, fora do sitemap e com `noindex` (que só evita indexação; não é controle de acesso). Sem login ou validação de compra. Abertura cinematográfica, três caminhos livres (conhecer meu café, aprender a preparar, explorar), página por café com Jornada da Origem, Academia Cura (3 módulos, roda sensorial e simulador de extração), Laboratório de Preparo (8 métodos, receita personalizada, calculadora de proporção, passo a passo com cronômetro real e diagnóstico), Barista Cura com respostas estruturadas e quiz de paladar. Mantém Header, Footer, tema Black, catálogo e rotas de produto; a recompra leva à ficha existente, sem checkout paralelo. O lote ganhou campos opcionais de rastreabilidade e escala sensorial 1–5, preenchidos só com o que está nos rótulos (sem coordenadas nem escalas inventadas). Receitas, lições, quiz, diagnóstico e base do Barista ficam em `content/experience/*.json`, validados no build. Decisões, arquitetura da IA futura, eventos e pendências: [docs/EXPERIENCIA.md](docs/EXPERIENCIA.md).

## CURA Experience 2.0

O que mudou, a partir da auditoria de 11/11/2026:
- **Motor de receitas único** (`lib/experience/brew.ts`). Tem um modelo por método: filtro, imersão, espresso por extração, moka pelo tamanho e cold brew com concentrado. A política de arredondamento é uma só e a capacidade do equipamento divide a receita em rodadas.
- **Laboratório:** preparo guiado com início real do cronômetro, diagnóstico com ajuste aplicado à nova tentativa, receitas salvas e diário em `/experiencia/minha-jornada/`, só no navegador.
- **Barista Cura híbrido.** O modo guiado entende perguntas compostas e mantém o contexto. O modo IA usa o SDK oficial da Anthropic no servidor com o **Claude Haiku 5.5** (`claude-haiku-5-5`, sem fallback automático para outro modelo), esforço `low` e cache de prompt, e ferramentas tipadas sobre o mesmo motor, com limites distribuídos em Postgres e orçamento diário. O custo estimado é de ≈ US$ 0,0004 a 0,0007 por resposta, com teto padrão de ≈ US$ 0,60/dia. A IA só é ativada com `BARISTA_AI=enabled`, chave e banco.
- **Entrada:** pela embalagem, com "Quero preparar meu café". **Origem:** "Dados deste lote". **Academia:** revisão técnica (escala histórica da SCA e CVA, TDS e rendimento).
- **Acessibilidade e telas de 320 px:** corrigidas.

Ativação, variáveis, custos, segurança e a situação dos 15 achados: [docs/EXPERIENCIA-2.md](docs/EXPERIENCIA-2.md). A avaliação com o modelo real (`npm run eval:barista`) exige credencial e ainda não foi executada.
