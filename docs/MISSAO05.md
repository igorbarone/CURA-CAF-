# Missão 05 — identidade oficial e refinamento

## Referências efetivamente analisadas

A issue #5 e seu complemento foram lidos integralmente. Os dois PDFs de identidade recebidos no ZIP foram lidos e renderizados nas quatro páginas de cada arquivo. As quatro artes A/B frente/verso foram analisadas. Os dois PDFs de adesivos têm duas páginas cada: frente vetorial e faca técnica. A frente foi usada; a faca não foi apresentada como produto.

Precedência: manual de referência de **26/10/2026** → Sistema V2 → flyers. A entrega não trata textos de exemplo dos documentos como dados comerciais confirmados.

## Aplicação dos vetores

- Logo empilhado, negativo e símbolo: extraídos das páginas 1 e 2 do manual, sem redesenho. O logo não é composição tipográfica. O descritor CAFÉ acompanha a marca no primeiro contato.
- Símbolo: três curvas originais, retas voltadas para a direita, sem espelhamento, sem selo circular. O mesmo arquivo original convertido serve ao favicon.
- Rótulos SAMBA/SALSA: primeira página dos PDFs vetoriais convertida a SVG. Mantidos desenhos, letras, geometria e textos; somente a antiga tinta institucional dos adesivos foi harmonizada para Marrom Cura, conforme a hierarquia de referências. O restante das cores dos rótulos é preservado.
- A conversão é PDF→SVG com crop e glyphs vetoriais do original, não tracing de imagem ou recriação por IA. `scripts/extract-official-assets.py` documenta a reprodução com PyMuPDF e Poppler/pdftocairo. Não são dependências de runtime/build: SVGs prontos são versionados.
- `docs/missao05/fontes-vetoriais.json` registra arquivo de origem, página, crop, SHA-256 do PDF e a indicação de harmonização de tinta. Os materiais originais recebidos permanecem no diretório de anexos de trabalho, sem expor flyers com contatos/preços provisórios no site.

## Refinamento aplicado

Marrom, creme e ocre agora organizam todas as páginas. Amora, Ipê, Anil, Rapadura e Cacau são opções de perfil no CMS e acentos subordinados nos cards, fichas e quiz. Archivo usa o arquivo variável com eixo real de largura a 125% e pesos 700–800 nos títulos; textos/interface continuam Archivo, dados DM Mono e voz humana Newsreader itálico.

Home ganha hierarquia editorial revista, símbolo oficial, apresentação real dos rótulos e jornada de quatro etapas. O catálogo mantém dados e filtros dinâmicos e acrescenta ordenação por curadoria, nome e pontuação publicada, sem preço imaginário. A ficha distingue arte de fotografia, enfatiza produtor/perfil e suporta uma nota de curadoria confirmada por lote. Sem nota, não se inventa um motivo ou autor.

Quiz, Clube, história, navegação, carrinho demonstrativo e SEO foram preservados e revisados sob o mesmo sistema. O CMS continua conectado conforme informado pela equipe: edição de conteúdo na main → Actions → Pages. Código segue branch/PR. Não foram alteradas credenciais, permissões, instalação do CMS ou gatilhos de publicação.

## Decisões editoriais dos flyers

Foi incorporada a mensagem “Não precisa entender de café” e a sequência Encontramos → Escolhemos → Torramos → Explicamos. A etapa de torra não declara endereço, data ou operação própria não confirmada.

Não foram publicados preços, descontos, frete, prazo, economia por xícara, B2B, telefones, perfis sociais/QR de exemplo, visitas ou contagem de lotes provados. A continuação “Nem pagar caro por ele” permanece retida como alegação de preço/economia, dependente de confirmação comercial. Não há ofertas reais novas, reservas, pagamentos ou checkout.

## Imagens e operação editorial

A imagem é classificada como fotografia autorizada ou arte oficial. Os rótulos são identificados como arte; os campos entre colchetes e a apresentação comercial impressa não confirmam safra, altitude, processo ou moagem no catálogo. Os registros de origem continuam com suas lacunas visíveis. Nenhum texto do PDF foi convertido automaticamente em dado do lote.

O campo **Por que escolhemos** fica no lote e recebe somente uma nota real confirmada. Cores e imagens podem ser editadas no Pages CMS, sem travar o catálogo em SAMBA/SALSA. SVGs editoriais ficam em `public/media/rotulo-*.svg`; a validação bloqueia conteúdo ativo ou referências externas. Uploads raster anteriores continuam válidos.

## Evidências e auditoria

- [Antes/depois](missao05/README.md): capturas de Home, catálogo e produtos na mesma escala desktop/mobile.
- [Galeria atual completa](screenshots/README.md): todas as rotas e resultado do quiz.
- Auditoria automatizada de tokens do layout e vetores web: paleta antiga não reaparece no runtime. Arquivos históricos de comparação e materiais de origem não são reinterpretados como layout atual.
- Testes de fonte variável, logo/símbolo/favicon, cinco perfis, ordenação estável, dados e fluxo V1.
- Validação de conteúdo, lint, testes unitários/E2E e builds de cenário, catálogo vazio e produção mantidos no pipeline.

## Validação executada nesta entrega

- `npm run validate:content`: 2 cafés, 2 lotes e 0 ofertas reais.
- `npm run lint`: sem erros ou avisos.
- `npm test`: 22 testes unitários e 32 E2E aprovados em desktop/mobile, incluindo auditorias automatizadas de acessibilidade.
- `npm run test:scenarios`: 8 E2E de cenários editoriais e 28 E2E com catálogo vazio aprovados; rebuild final de produção restaurou apenas o conteúdo real.
- `GITHUB_PAGES=true npm run build`: export estático concluído para o basePath do GitHub Pages; também executado nos cenários e no rebuild final.
- 18 capturas atuais e 8 capturas históricas, com mídia lazy carregada antes da imagem integral.

## Pendências reais

Fotografias autorizadas dos cafés/produtores e embalagens finais por oferta; município/UF e demais dados de origem ainda ausentes; motivo e autoria de seleção quando ainda não documentados. Confirmar operação de torra, contatos oficiais e condições comerciais antes de divulgá-los. Definir commerce, estoque transacional, variantes, peso, moagem, frete, pedidos, pagamento e assinatura do Clube.

Os materiais de identidade solicitados foram fornecidos e analisados: não são mais uma pendência. Nenhum merge automático ou deploy direto faz parte desta entrega.

A prévia dos adesivos aplicados no pacote também foi inspecionada. É um mockup de referência, não fotografia de estoque ou confirmação de peso; não foi usada como foto de produto. Os arquivos de flyer, a prévia e as PDFs de fonte não foram publicados como catálogo.
