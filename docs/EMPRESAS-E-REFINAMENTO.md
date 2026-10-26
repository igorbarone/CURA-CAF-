# Empresas, democratização e consistência dos lotes

> Registro da entrega do PR #7. A evolução da comunicação e dos segmentos B2B está em [Posicionamento e Food Service](POSICIONAMENTO-FOOD-SERVICE.md); o foco atual é gastronômico. O diagnóstico técnico dos filtros abaixo permanece válido.

## O que muda

A página `/empresas/` entra no menu desktop/mobile, rodapé e sitemap. Usa a identidade oficial, componentes editoriais compartilhados e conteúdo de `content/site.json`, editável em **Conteúdo editorial V1 → Para empresas** no Pages CMS.

Cafeterias/restaurantes, espaços de trabalho e hospitalidade são contextos propostos para a construção do B2B. Não há base para afirmar que já são segmentos efetivamente atendidos, clientes ou serviços disponíveis. O texto explicita essa condição. A equipe deve confirmar escopo de atendimento antes de anunciar uma operação comercial.

A Home explica democratização em três dimensões: linguagem compreensível, conhecimento compartilhado e experiência orientada pelo paladar. Não faz alegações de preço, desconto ou economia. A seção de quem produz deriva dos cafés em destaque e dos seus lotes principais publicados; não é uma lista fixa de nomes. A atenção aos pequenos produtores é um compromisso editorial, não uma afirmação sobre o tamanho das propriedades atuais.

Nomes e origem ganham destaque também na ficha. Histórias só aparecem quando o campo opcional **Lotes → História de quem produz** contém texto confirmado e autorizado. Nenhuma biografia foi acrescentada aos dados reais. A equipe pode deixar o campo vazio sem perder os nomes e a origem já documentados. O cadastro continua separado em café/lote/oferta.

## Diagnóstico e correção dos filtros

O dado confirmado de SALSA é **CURA-26-02, 86 pontos SCA, torra clara**. SAMBA continua **CURA-26-01, 84 pontos, torra média**. Selecionar torra clara deve mostrar SALSA e seus 86 pontos; o filtro não cria nem altera a pontuação.

Havia dois problemas:

1. O filtro verificava se algum lote do café correspondia, mas entregava a entrada completa. O card a projetava novamente pelo lote principal: em um café com múltiplos lotes, podia mostrar atributos de um lote diferente daquele encontrado.
2. A pontuação não era exposta como texto no card quando havia mídia; ficava apenas impressa no rótulo. A percepção dependia da arte e do tamanho de exibição.

A filtragem agora restringe os lotes e as ofertas da projeção, mantendo o catálogo original intacto. Todos os filtros ativos devem corresponder ao mesmo lote. Entre vários lotes correspondentes, usa-se o principal se ele corresponder; caso contrário, o primeiro na ordem editorial. A ordenação por pontuação usa a pontuação do lote efetivamente exibido, inclusive quando o principal não é o de maior nota.

Torra e pontuação têm campos legíveis em todos os cards, com estado desconhecido explícito. Links de lotes diferentes do principal carregam `?lote=ID`, abrindo a mesma ficha encontrada. Limpar filtros restaura a projeção principal. As imagens podem declarar o lote representado no CMS; o vínculo é validado como pertencente ao mesmo café e independe do lote principal. Rótulos sem vínculo conhecido ou de outro lote não ilustram a seleção atual: nessa situação usa-se a ficha editorial identificada, sem reutilizar a pontuação impressa incorreta. Fotos autorizadas continuam disponíveis no nível do café.

## Preparação da futura captação B2B

A seção `#proxima-conversa` é o ponto de entrada visual reservado. Hoje é conteúdo editorial, sem formulário, submissão, lista de espera, e-mail ou telefone inventado. Não guarda nem transmite dados de interessados. Os segmentos, títulos e estado do canal podem ser atualizados pelo CMS; código e integração seguem branch/PR.

Antes de ativar:

- Confirmar responsável comercial, segmentos, região de atendimento e canal de retorno reais.
- Integrar um serviço de formulário/API externo: o export estático no Pages não recebe POST nem envia e-mail por conta própria. Credenciais privadas ficam no serviço, nunca no bundle ou CMS.
- Definir o mínimo necessário para a conversa: empresa, segmento, cidade/UF, contato de retorno e interesse. Publicar finalidade e tratamento dos dados antes da coleta.
- Implementar validação no serviço e na interface, proteção contra spam e estados acessíveis de envio/erro/sucesso. Confirmar recebimento real antes de exibir sucesso; não simular uma submissão.
- Testar o canal em desktop/mobile e manter fallback editorial quando indisponível. Não acoplar captação a pedido, reserva ou checkout.

## Revisão visual e operação

Novos blocos usam títulos Archivo Expanded, voz humana Newsreader, dados DM Mono, regras em ocre e fundos creme. Separação entre chamada, título, texto explicativo e ficha ajuda a leitura em desktop/mobile. A página B2B reutiliza a mesma grade de tópicos da democratização.

Pages CMS, permissões, workflow main → Actions → Pages e export estático foram preservados. Este refinamento será entregue em novo PR porque o PR #6 já foi integrado. Não inclui merge nem publicação automática pela ferramenta.

As capturas atuais estão na [galeria](screenshots/README.md). O [roteiro de apresentação](APRESENTACAO-V1.md) inclui B2B e a conferência de 86 pontos ao filtrar torra clara.

## Verificação

- Conteúdo real preservado: 2 cafés, 2 lotes e 0 ofertas; nenhum registro comercial inventado.
- Testes unitários de projeção, combinação de filtros, ordenação pelo lote exibido, ausência de pontuação e associação de mídia por lote.
- Cenários E2E isolados de múltiplos lotes, filtro de lote não principal → ficha correspondente, troca de produtor/origem/pontuação e ausência de história não confirmada.
- E2E desktop/mobile para navegação B2B, estado de captação inativo, acessibilidade, democratização e produtores publicados; cenário de catálogo vazio preservado.
- Capturas específicas do catálogo com torra clara para revisar SALSA/86 pontos além da galeria de todas as páginas.

Resultado local: validação de conteúdo e lint aprovados; **25 testes unitários**, **40 E2E desktop/mobile**, **10 E2E de cenários editoriais** e **36 E2E de catálogo vazio** aprovados. `npm run test:scenarios` recompilou o export estático para cenários, vazio e produção, encerrando com o catálogo real. O basePath `/CURA-CAF-/` e as rotas existentes foram mantidos.
