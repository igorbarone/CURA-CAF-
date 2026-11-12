# Cura Commerce — arquitetura (Asaas, Melhor Envio e catálogo central)

Estado: **pronta para homologação em sandbox**. Não há cobrança real habilitada, credencial no repositório nem merge automático. O GitHub Pages segue sem runtime e com "Compra online em breve". As variantes reais (SAMBA, SALSA, DA CASA 250 g) ficam **fora da venda online** até a equipe informar peso bruto e medidas da embalagem.

## 1. Auditoria de partida (11/11/2026)

| Área | Situação encontrada | Decisão |
| --- | --- | --- |
| Catálogo | Pages CMS (JSON no Git): Café → Lote → Oferta, validado com Zod no build. 3 cafés e 3 ofertas de 250 g com preço. | **Mantido** como fonte única. A oferta passa a ser a variante, com dados logísticos e trava de venda. |
| Estoque, pedidos | Postgres (`inventory`, `orders`, `payments`, `webhook_events`, `order_events`); reserva atômica, idempotência. | **Mantido** e ampliado (migração 003). |
| Pagamento | Mercado Pago (Pix e Card Payment Brick). | **Substituído pelo Asaas** (decisão definitiva da equipe). |
| Frete | Melhor Envio com uma caixa fixa por variável de ambiente e peso somado. | **Mantido o provedor**, trocada a estratégia: empacotamento em volumes e cotação por volume; etiquetas. |
| Operação | Só CLI (`npm run ops`). | **Painel `/admin`** autenticado, mais a CLI. |
| Barista | Haiku 5.5 com ferramentas sobre o catálogo publicado; comparação com nomes fixos. | **Mantido**; nova ferramenta `consultarCompra` e comparação dinâmica. |
| Experience | Já consome o catálogo publicado (`toExperienceCoffee`). | Sem mudança: QR, `noindex`, sem cadastro. |

Não há sistema paralelo: o mesmo livro de preços (`buildPriceBook`) alimenta loja, carrinho, checkout, painel e Barista.

## 2. Estrutura do catálogo

```
Café (identidade, URL, descrição, destaques, SEO, mídia)
 └─ Lote (fazenda, produtor, região, município, altitude, variedade, processo,
          safra, pontuação + metodologia, torra, sensorial, história, coordenadas,
          janela de venda, status)
     └─ Variante = oferta (SKU, peso líquido, peso bruto embalado, medidas,
                  moagem, preço, preço promocional, quantidade mín./máx., selo,
                  janela de venda, status)
```

- **Nova safra = novo lote.** O lote anterior é arquivado, nunca apagado (o CMS não permite apagar), e a rastreabilidade continua.
- **Variante vendável** (`sellabilityIssues` em `lib/commerce/catalog.ts`): oferta, lote e café publicados, SKU, preço, peso líquido, **peso bruto e as três medidas**. Rascunhos podem ficar incompletos.
- **Inconsistências recusadas no build:** promoção maior que o preço, mínimo maior que o máximo, medida faltando, peso bruto menor que o líquido, janela invertida.
- O validador (`npm run validate:content`) lista o que falta para cada variante publicada. O painel mostra o mesmo em **Produtos e lotes**.
- **Variantes preparadas como rascunho**, sem preço, peso bruto ou estoque: 500 g, 1 kg e 250 g moído de cada café. Não aparecem em lugar nenhum até a equipe completar os dados e publicar.
- **Canais:** loja, Experience e Barista leem o mesmo catálogo publicado. Nada depende de nomes fixos, e o catálogo funciona com 3 ou com 10+ cafés. Academia e motor de receitas continuam independentes.

### Fluxo de publicação

1. **Rascunho** no Pages CMS.
2. **Validação:** o build recusa inconsistências; validador e painel apontam o que falta para vender.
3. **Publicação:** estado "Publicado" e commit; a Vercel publica em minutos.
4. **Disponibilidade:** estoque, pausa por SKU e janela de venda, conferidos a cada requisição.

**Por que o catálogo fica no Git e não no banco:**
- cada mudança de preço ou de origem é revisável, versionada e validada antes de ir ao ar;
- o site estático e a Experience continuam funcionando sem servidor.

O banco guarda só o que muda a cada venda: estoque, pausas, pedidos, pagamentos e etiquetas.

## 3. Compra

```
Produto → Carrinho (CEP e frete) → Checkout (dados, entrega, pagamento) → Pedido
```

1. **Carrinho:** cálculo local para exibição. O frete é cotado pelo servidor a partir do CEP.
2. **Empacotamento** (`lib/commerce/packing.ts`):
   - cada unidade usa o peso bruto e as medidas da variante; um kit vira as suas unidades;
   - first-fit decreasing por volume: um volume "cabe" quando uma caixa comporta as medidas de cada unidade, o volume interno × ocupação máxima (`packingFillFactor`) e o peso, que não pode passar de `maxVolumeWeightGrams` (4 kg) incluindo a tara;
   - cada volume usa a menor caixa que serve;
   - sem caixas cadastradas não há cotação: a equipe precisa informá-las.
3. **Cotação** (`lib/commerce/server/shipping.ts`):
   - uma chamada `POST /api/v2/me/shipment/calculate` por volume (`package`, seguro com o valor do volume, `services` = ids do CMS, hoje `1` PAC e `3` .Package);
   - só entram serviços que atendem **todos** os volumes; os preços somam e vale o maior prazo;
   - o cliente paga todo o frete. `freeShippingFromCents` e `shippingSubsidyCents` existem, mas ficam nulos até haver aprovação.
4. **Checkout** (`createCheckout`):
   - Zod estrito; nenhum dado de cartão é aceito;
   - o servidor recalcula preços, desconto e frete;
   - se o frete mudou desde a tela (`shippingPriceCents`), responde `shipping_changed` com as opções atuais e o cliente confirma de novo;
   - reserva o estoque por SKU (`SELECT … FOR UPDATE` e baixa, tudo ou nada; SKU pausado não vende);
   - se faltar estoque preso em pedidos vencidos, eles expiram primeiro e a reserva é tentada de novo.
5. **Cobrança** (`lib/commerce/server/asaas.ts`):
   - **Pix:** `POST /payments` com `billingType: PIX`, depois `GET /payments/{id}/pixQrCode` (imagem e copia e cola).
   - **Cartão:** `billingType: CREDIT_CARD`. O cliente paga na **página hospedada do Asaas** (`invoiceUrl`) e volta ao pedido (`callback.successUrl`). Nenhum dado de cartão passa pela Cura.
   - **Idempotência:** a cobrança leva o id do pedido em `externalReference`. Antes de criar, o servidor procura uma existente; uma trava curta no pedido (`payment_claimed_at`) impede duas criações simultâneas.
   - **Cliente:** reaproveitado pelo CPF, com `notificationDisabled`, porque os e-mails são da Cura.
6. **Desconto Pix:**
   - 5% (`pixDiscountPercent`) **só sobre os cafés**, nunca sobre o frete, arredondado ao centavo;
   - calculado no servidor (`orderTotals`) e mostrado no carrinho, no checkout (recalculado ao trocar a forma de pagamento) e no pedido.
7. **Taxas do Asaas:** cartão 3% + R$ 0,49 por venda e Pix R$ 0,99 por venda (`cardFeeAssumptionPercent`, `cardFeeFixedCents`, `pixFeeFixedCents`), como na planilha de precificação. São **só** premissas dos indicadores: nunca são cobradas do cliente.
   - **Preços:** o preço do site é o "preço no cartão" da planilha, e o Pix sai 5% menor no checkout.
8. **Confirmação:**
   - só o webhook autenticado (ou a reconciliação) marca o pedido como pago, sempre **relendo a cobrança no Asaas**;
   - o valor pago é conferido com o total;
   - o redirecionamento do navegador nunca confirma nada.

### Estados

| Financeiro (`status`) | Logístico (`fulfillment_status`) |
| --- | --- |
| `pending_payment` Aguardando pagamento | `unfulfilled` A preparar |
| `paid` Pago | `preparing` Em preparação |
| `expired` Expirado (prazo vencido; cobrança removida no Asaas) | `shipped` Enviado (com rastreio) |
| `cancelled` Cancelado | `delivered` Entregue |
| `refunded` Reembolsado | |
| `payment_failed` (legado) | |

**Regras:**
- Os estados só avançam. Um evento repetido, atrasado ou fora de ordem não muda nada.
- O estoque baixa **uma vez**, na reserva do checkout. Webhooks nunca baixam estoque; a devolução é única (`stock_released`).
- **Pago depois de expirar:** o pedido vira "pago". O estoque é retomado se houver; se não houver, o pedido aparece em **Pedem atenção** no painel (repor ou estornar).
- **Prazos:** Pix 30 min e cartão 60 min (CMS). Vencido, a cobrança é removida no Asaas (`DELETE /payments/{id}`), o estoque volta e o cliente recebe e-mail. Se o Asaas disser que foi pago no meio da expiração, o pagamento vence.

**Quando a expiração roda:**
- na página do próprio pedido;
- quando falta estoque num novo checkout;
- em `GET /api/cron/reconcile/` (Vercel Cron diário, `CRON_SECRET`);
- no painel ou na CLI.

## 4. Etiquetas (Melhor Envio)

**Só por ação explícita** no painel ou na CLI, nunca automática. Exigem pedido pago e o remetente configurado.

**Passos:** um item no carrinho do Melhor Envio por volume → `checkout` (paga com o saldo da carteira) → `generate` → `print` (link) → `tracking`.

**Proteções:**
- `shipments` tem um registro por pedido (chave primária). O status guarda a última etapa concluída, e uma nova tentativa continua dali **sem pagar de novo**.
- Um clique duplo ou simultâneo encontra a tentativa em andamento e não repete.

**NF-e:** a chave é pedida no painel. A declaração de conteúdo só é usada se a equipe ativar `SHIPPING_NON_COMMERCIAL=true`.

Com todos os códigos de rastreio, o pedido passa a "Enviado" e o cliente é avisado. Também existe o envio manual, com rastreio digitado.

## 5. Painel `/admin`

Acesso:
- senha única da equipe, guardada só como hash scrypt em `ADMIN_PASSWORD_HASH` (`npm run ops -- admin:hash`);
- sessão assinada (`ADMIN_SESSION_SECRET`) de 8 h, em cookie `HttpOnly`, `SameSite=Strict` e `Secure`;
- formulários só da mesma origem, login limitado a 5 tentativas por minuto;
- `noindex` e bloqueado no `robots.txt`;
- não existe no export do GitHub Pages.

| Seção | O que faz |
| --- | --- |
| Visão geral | Pedidos pagos (Pix/cartão), faturamento bruto, descontos Pix, frete cobrado, taxas estimadas de cartão (estimativa), ticket médio, pedidos a enviar e pedidos que pedem atenção. Também mostra o ambiente (sandbox/produção) e o que está ativo. |
| Pedidos | Filtros (pagamento, a enviar, enviados, encerrados, atenção). Na ficha: itens com preços do momento da compra, totais, endereço, volumes, cobranças, histórico, preparação, etiqueta, rastreio e entrega. |
| Estoque | Por variante: venda online (ativa, pausada, esgotada ou bloqueada e por quê), disponível, reservado, vendido, ajuste com motivo obrigatório e pausar/retomar. Ajustes ficam em `inventory_adjustments`. |
| Produtos e lotes | Cafés, lotes, safra, pontuação, janelas e variantes, com o que falta para vender, e o link para editar no Pages CMS. |

Não é um ERP: não há NF-e, financeiro nem CRM.

## 6. Barista

- A nova ferramenta `consultarCompra` traz embalagens, preço, estoque, desconto Pix e alternativas disponíveis do livro de preços e do estoque ao vivo.
- Esses dados vêm de um instantâneo de 60 s carregado no servidor, que o modelo só vê quando a pergunta é de compra.
- Se a loja não está vendendo, a resposta é "em breve", sem preço.
- O prompt manda usar a ferramenta para qualquer preço; nada é inventado.
- Receitas continuam no motor do Laboratório.
- A intenção de comparar usa os nomes do catálogo publicado.
- O modelo, o esforço, o cache e os limites não mudaram (Haiku 5.5, sem fallback).

## 7. Código

| Arquivo | Papel |
| --- | --- |
| `lib/content-schema.ts`, `.pages.yml` | Campos de café, lote e variante (paridade testada). |
| `lib/commerce/catalog.ts` | Livro de preços, `sellabilityIssues`, janelas de venda. |
| `lib/commerce/{cart,pricing,packing,rules}.ts` | Carrinho, desconto Pix e frete cobrado, volumes, regras do CMS. |
| `lib/commerce/server/asaas.ts` | Cliente Asaas e mapa de status. |
| `lib/commerce/server/shipping.ts` | Cotação por volume e etiquetas no Melhor Envio. |
| `lib/commerce/server/orders.ts` | Checkout, cobrança, webhook, expiração, reconciliação, logística, visão do pedido, disponibilidade. |
| `lib/commerce/server/{labels,stock,indicators,admin,admin-auth}.ts` | Etiquetas, estoque auditado, indicadores, sessão do painel. |
| `app/api/webhooks/asaas`, `app/api/cron/reconcile`, `app/api/admin/*` | Webhook, reconciliação agendada, ações do painel. |
| `app/admin/**` | Painel. |
| `db/migrations/003_asaas_fulfillment.sql` | Status logístico, desconto, volumes, prazos, pausa, ajustes e etiquetas. Converte pedidos antigos `shipped`/`delivered` em pago + logística, sem perder histórico. |
| `scripts/ops.ts` | CLI de operação, incluindo `admin:hash`, `order:label` e `indicators`. |

## 8. Variáveis de ambiente (só no servidor)

Nenhuma vai para o navegador: não há variável `NEXT_PUBLIC_` de pagamento.

| Variável | Para quê | Obrigatória |
| --- | --- | --- |
| `CURA_COMMERCE=enabled`, `DATABASE_URL`, `ORDER_TOKEN_SECRET` (32+), `SITE_URL` (ou o da Vercel) | Loja ligada | sim |
| `ASAAS_ENVIRONMENT` | `sandbox` (padrão) ou `production` | — |
| `ASAAS_API_KEY` | Chave da conta, `$aact_hmlg_…` no sandbox e `$aact_prod_…` em produção. Uma chave do outro ambiente é recusada. | para Pix/cartão |
| `ASAAS_WEBHOOK_TOKEN` (16+) | Token escolhido ao criar o webhook no Asaas, conferido em `asaas-access-token` | para Pix/cartão |
| `ASAAS_API_BASE`, `ASAAS_USER_AGENT` | Só para sobrescrever (padrões: `https://api-sandbox.asaas.com/v3` e `https://api.asaas.com/v3`) | — |
| `CURA_ALLOW_LIVE_PAYMENTS=true` | **Única** forma de cobrar de verdade, junto com `ASAAS_ENVIRONMENT=production`. Exige aprovação explícita da equipe. | — |
| `MELHOR_ENVIO_ENVIRONMENT` | `sandbox` (padrão) ou `production` | — |
| `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_USER_AGENT` (`Cura Café (email-técnico)`) | Cotação e etiquetas | para frete |
| `SHIPPING_ORIGIN_CEP` | CEP de origem (dado da equipe) | para frete |
| `SHIPPING_FROM_NAME`, `SHIPPING_FROM_DOCUMENT` ou `SHIPPING_FROM_COMPANY_DOCUMENT`, `SHIPPING_FROM_STATE_REGISTER`, `SHIPPING_FROM_PHONE`, `SHIPPING_FROM_EMAIL`, `SHIPPING_FROM_STREET`, `SHIPPING_FROM_NUMBER`, `SHIPPING_FROM_COMPLEMENT`, `SHIPPING_FROM_DISTRICT`, `SHIPPING_FROM_CITY`, `SHIPPING_FROM_STATE` | Remetente das etiquetas | para etiquetas |
| `SHIPPING_NON_COMMERCIAL=true` | Envio com declaração de conteúdo (sem NF-e), só se a equipe confirmar que pode | — |
| `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` (32+) | Painel | para o painel |
| `CRON_SECRET` | Protege `/api/cron/reconcile/` (a Vercel Cron envia como Bearer) | recomendado |
| `RESEND_API_KEY`, `EMAIL_FROM` | E-mails | opcional |
| `CURA_AUTO_MIGRATE`, `CURA_STOCK_FROM_CMS` | Homologação: migra no primeiro acesso e cria estoque inicial a partir do CMS | opcional |

**Variáveis removidas:** `MP_*`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `SHIPPING_BOX_CM`, `SHIPPING_TARE_GRAMS`, `MELHOR_ENVIO_SERVICES`. As caixas e os serviços agora ficam nas Regras comerciais do CMS.

## 9. Segurança e LGPD

- **Credenciais:** só em variáveis do servidor; sandbox e produção separados; cobrança real com dupla trava. Testes automatizados usam chaves simuladas, e o `test-commerce` remove do ambiente qualquer `ASAAS_*`, `MELHOR_ENVIO_*` ou `ADMIN_*` do terminal.
- **Cartão:** digitado só na página do Asaas. O checkout recusa qualquer campo de cartão.
- **Webhook:** token comparado em tempo constante, deduplicação por id do evento e estado relido no Asaas.
  - Responde 200 para eventos ignorados, para o Asaas não pausar a fila.
  - Responde 401 para token errado e 5xx só quando deve haver nova tentativa.
- **Pedido do cliente:** token HMAC no link. A resposta não traz CPF, e-mail, telefone nem endereço.
- **Painel:** mostra os dados de entrega só para a sessão autenticada. Os logs mascaram dados pessoais.
- **Pendências legais antes de vender:** política de privacidade com o controlador e o encarregado, termos de compra, trocas e arrependimento (7 dias), contratos com os operadores (Asaas, Melhor Envio, Resend, hospedagem) e banner de consentimento antes de qualquer analytics.

## 10. Custos (confirmar nas contas da equipe)

| Item | Referência |
| --- | --- |
| Asaas | Sem mensalidade no plano básico. Há taxa por Pix recebido e por cartão (percentual + fixo). A premissa interna de 3% no cartão é só para os indicadores. Conferir a tabela da conta. |
| Melhor Envio | Sem mensalidade; paga-se cada etiqueta com o saldo da carteira. |
| Vercel | O Hobby serve para homologação; para vender, a Vercel exige o Pro. O cron diário é suportado nos dois. |
| Neon (Postgres) | O plano gratuito serve para homologação. |
| Resend | Plano gratuito com limite diário. |

Nenhum serviço pago novo foi introduzido.

## 11. Testes

| Comando | Cobre |
| --- | --- |
| `npm run test:unit` | **Catálogo:** trava de venda, rascunho incompleto, inconsistências, promoção, quantidade mín./máx., janela de venda (fuso de Brasília), kits.<br>**Empacotamento:** caixa menor, divisão acima de 4 kg, unidade grande demais, sem caixas.<br>**Cotação:** SP, RJ e Nordeste com PAC e .Package, ~4 kg em vários volumes, serviço que não atende um volume, queda do provedor, CEP inválido.<br>**Desconto Pix** só nos cafés.<br>**Checkout:** Pix, cartão (página do Asaas, sem dado de cartão), preços do servidor, cotação vencida, idempotência com envios simultâneos, concorrência sem overselling, SKU pausado, falha na criação da cobrança.<br>**Webhook:** pago uma vez, duplicado, fora de ordem, corpo não confiável, valor divergente, falha do provedor, cobrança desconhecida.<br>**Expiração:** remoção no Asaas e estoque devolvido uma vez, pago no prazo final, pago depois de expirar (com e sem estoque), reconciliação.<br>**Logística e etiquetas:** uma por volume, comprada uma vez, retomável, cliques simultâneos.<br>**Operação:** estoque auditado, indicadores, configuração (sandbox, trava de produção, chave do ambiente errado).<br>**Segurança:** token, senha e sessão do painel.<br>**Clientes HTTP:** Asaas e Melhor Envio contra `fetch` simulado.<br>**Barista:** `consultarCompra` e comparação dinâmica. |
| `npm run test:commerce` | Build de servidor com catálogo **fictício**, PGlite e simuladores HTTP do Asaas, Melhor Envio, ViaCEP e Resend, em desktop e mobile, com axe.<br>**Compra:** Pix completa (desconto recalculado ao trocar o método, webhook forjado e com token errado, duplicado, recompra, privacidade), compra com cartão pela página simulada do Asaas, queda do frete, cotação antiga, dados de cartão recusados, CEP, resposta atrasada.<br>**Painel:** senha, ação sem sessão, robots, indicadores, preparação, etiqueta única, rastreio, entrega, ajuste e pausa de estoque. |
| `npm test`, `npm run test:scenarios` | Site estático, Experience e cenários editoriais, inclusive "Compra online em breve". |

**Fora do alcance automático:**
- As APIs reais em sandbox exigem as credenciais da equipe. Os contratos foram implementados pela API v3 do Asaas e v2 do Melhor Envio e conferidos com SDKs públicos. A documentação oficial não estava acessível pela rede desta sessão, por isso a primeira rodada em sandbox (roteiro em `COMMERCE-ATIVACAO.md`) é obrigatória antes de produção.

## 12. Rollback

| Situação | Ação |
| --- | --- |
| Problema no pagamento | Remover `ASAAS_API_KEY` ou `CURA_ALLOW_LIVE_PAYMENTS`: o checkout volta a "Compra online em breve" na hora. |
| Problema no frete | Remover `MELHOR_ENVIO_TOKEN`: sem cotação, sem checkout. |
| Deploy com erro | "Instant rollback" na Vercel. |
| Banco | A migração 003 só adiciona colunas e tabelas e converte status legados. Fazer backup antes. |
| Pedidos em andamento | Nunca apagados. Usar a reconciliação e o painel do Asaas para conferir e estornar. |
