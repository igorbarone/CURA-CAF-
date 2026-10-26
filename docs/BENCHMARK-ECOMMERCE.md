# Benchmark funcional — Coffee++ → Cura Café

Observação em 26/10/2026. A Coffee++ é a referência funcional principal; o código, conteúdo, identidade e ativos da Cura são próprios.

## Escopo observado

Foram consultadas a [home](https://coffeemais.com/), a [listagem de cafés](https://coffeemais.com/collections/todos-os-cafes), o [produto Arara em grãos](https://coffeemais.com/products/cafe-edicao-especial-arara-graos-250g) e o [carrinho vazio](https://coffeemais.com/cart), com leitura do HTML público e renderização em 1280 × 900 e 390 × 844. Capturas foram inspecionadas. Após o bloqueio inicial de rede, o acesso foi liberado e a análise foi concluída.

A navegação pública combina categorias por formato (grão, moído, cápsula e drip), kits, acessórios, descoberta por quiz e assinatura. A home oferece entradas por método, seleção de produtos e comparação entre cafés. A listagem apresenta filtros por método, tipo, variedade e torra, ordenação, contagem e cartões com notas sensoriais e ação comercial. No mobile, o header se compacta em menu/busca/carrinho e a listagem usa “Filtrar e organizar” acima da grade.

A página observada de produto reúne mídia, nome/formato/peso, avaliações, descrição, notas, torra, região, sugestões de preparo, formatos alternativos e quantidade antes da ação de compra; abaixo há ficha técnica e outros cafés. O carrinho vazio oferece retorno ao catálogo e sugestões. Seu HTML também contém a estrutura de resumo, frete por CEP e encaminhamento à finalização. A existência dessa estrutura não comprova seu funcionamento com itens.

Limites: não foram adicionados produtos, enviados formulários nem iniciadas transações. A etapa transacional do checkout, frete, pagamentos, conta, quiz e assinatura não foi validada. No Chromium, os recursos públicos do domínio foram carregados por transporte curl com TLS verificado, pois o navegador não reconheceu a CA do proxy. Serviços externos de analytics, atendimento e pagamento não fizeram parte da renderização; as observações tratam da arquitetura e apresentação públicas, não de uma auditoria completa da loja.

## O que foi adaptado

| Padrão observado na Coffee++ | Adaptação original na Cura |
| --- | --- |
| Entradas claras para seleção e compra | Home → catálogo → ficha, com navegação e breadcrumbs consistentes |
| Catálogo com filtros, contagem e atributos sensoriais | Busca por café/lote/nota/produtor, filtro pelos dois perfis reais, contagem acessível e recuperação de busca vazia |
| Notas sensoriais próximas ao produto | Notas, torra, produtor e preparo no cartão; acidez e corpo documentados na ficha, com explicação simples do que são notas |
| Ficha técnica, preparo e outros cafés | Informações confirmadas em blocos legíveis, origem com lacunas explícitas e link ao outro lote para continuar a descoberta |
| Navegação e filtros reorganizados no mobile | Menu compacto, campos legíveis, filtros visíveis que se reorganizam e ficha em uma coluna |
| Oferta comercial separada da descrição e recuperação do carrinho vazio | Estado comercial transparente “Em breve”, retorno ao catálogo e contrato futuro de oferta separado dos dados editoriais |

Os filtros de formato, a ordenação por preço, promoções, avaliações e assinaturas não foram transpostos: dependem de variedade de catálogo, dados e integrações reais. Para dois cafés, a descoberta por perfil é mais direta que uma árvore extensa de categorias. Sem ofertas confirmadas, também não há compra rápida, seleção de moagem, quantidade ou subtotal fictícios.

## Como a Cura se diferencia

A Cura organiza a experiência em “Encontrado. Escolhido. Explicado.” e no percurso “Da roça à cidade”. Creme dominante, verde Cura, ponto de escolha em ocre e Archivo/DM Mono/Newsreader preservam a identidade editorial V2. O foco é a autoria do produtor e a clareza da escolha entre SAMBA e SALSA, com menos estímulos comerciais e informação sensorial acessível. Não foram copiados fotografias, textos, código, história de marca ou elementos visuais da Coffee++.

## Preparação para comércio real

O catálogo separa café, lote e oferta editorial em `lib/content-schema.ts`, com dados em `content/` e schema validado no build. `lib/commerce.ts` mantém apenas a fronteira futura de carrinho por `offerId`. Uma oferta pode registrar SKU e atributos comerciais confirmados, sem habilitar compra. A integração transacional deverá validar os dados do provedor e o estoque antes de qualquer pedido.

Hoje não existem ofertas, persistência de carrinho, subtotal, reserva, frete, cobrança ou checkout. A rota `/carrinho/` explica isso e retorna ao catálogo. Próxima etapa: confirmar operador de commerce, dados comerciais e opções reais; integrar e validar as ofertas antes de implementar adição, alteração de quantidade e checkout. Todas as páginas atuais são exportadas estaticamente.
