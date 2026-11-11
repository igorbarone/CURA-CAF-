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

Tema black e console de origem: o creme continua padrão; o botão “Black” no cabeçalho liga o tema escuro (Breu #1E130C como fundo, creme como texto, ocre nos destaques), lembrado no navegador e aplicado antes da primeira pintura, sem piscar. As cores do CSS viraram tokens (`--brand`, `--cream`, `--light` e versões `-rgb`); blocos que já eram escuros viram um preto mais profundo. O cabeçalho traz o símbolo C oficial ao lado do logotipo. Para isso foram criadas cópias dos vetores oficiais apenas sem o painel de fundo (`public/brand/*-transparente.svg`), sem redesenho; o C é aplicado como máscara e assume a cor do tema. Na Home, o painel do hero é um “console de origem”: C no topo, curvas de nível que ecoam os morros dos rótulos (decorativas, não representam terreno real) e uma leitura feita só de dados publicados (código, pontuação, torra e o texto de origem do lote). Um teste roda a checagem de acessibilidade WCAG AA em todas as páginas públicas no tema black, e a jornada de compra passa inteira nos dois temas (`COMMERCE_THEME=black npm run test:commerce`).

## Cura Commerce (Missão 06)

A loja roda no **alvo de servidor** (`npm run build:server` + `npm run start:server`). O export do GitHub Pages continua sem runtime e com "Compra online em breve". Estão prontos para homologação:
- ficha com embalagens, quantidade, preço por 100 g e estoque ao vivo;
- carrinho persistente e frete pelo Melhor Envio;
- checkout transparente do Mercado Pago (Pix e cartão via Card Payment Brick);
- pedidos com estoque reservado atomicamente;
- webhook assinado e idempotente;
- e-mails transacionais, recompra e eventos de funil.

Decisões principais:
- Preço, frete e status de pagamento são decididos só no servidor.
- A cobrança real exige `MP_ENVIRONMENT=production` **e** `CURA_ALLOW_LIVE_PAYMENTS=true`.
- Os dados editoriais seguem no Pages CMS, que ganhou Kits, Regras comerciais e galeria do produto.
- Não há preço real cadastrado: nada aparece à venda até a equipe publicar ofertas.

Para testar a loja localmente: `npm run test:commerce`. O comando monta um ambiente isolado com catálogo fictício, PGlite e simuladores do Mercado Pago, Melhor Envio e Resend. Para operar: `npm run ops`.

Mais detalhes em [Arquitetura, custos, migração e rollback](docs/COMMERCE-ARQUITETURA.md), em [Dependências e roteiro de ativação](docs/COMMERCE-ATIVACAO.md) e no [passo a passo da homologação na Vercel](docs/HOMOLOGACAO-VERCEL.md).
