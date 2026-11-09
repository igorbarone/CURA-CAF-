# Cura Commerce — arquitetura (Missão 06)

Estado: **pronta para homologação**, com checkout funcional no ambiente de testes. Não há cobrança real habilitada, credencial publicada nem merge automático. O site atual no GitHub Pages continua no ar, sem mudança de comportamento.

## 1. Auditoria de partida

| Área | Situação encontrada |
| --- | --- |
| Hospedagem | Export estático (`output: "export"`) no GitHub Pages, em `/CURA-CAF-/`, publicado pelo workflow `pages.yml` a cada push na `main`. |
| Conteúdo | Pages CMS sobre JSON no Git: cafés, lotes, ofertas, Home e textos editoriais, validados com Zod no build. A equipe edita direto na `main`. |
| Produtos | Café (identidade e URL) → lote (sensorial e origem) → oferta (SKU, preço, peso, moagem). Há **0 ofertas publicadas**: nenhum preço real existe. |
| O que funcionava | Home, catálogo com filtros, ficha, quiz, comparador, clube (proposta), Food Service, canais de contato configuráveis (vazios). |
| O que era demonstrativo | Carrinho de "seleção demonstrativa", só com IDs na sessão, sem preço, estoque, frete ou pagamento. |
| Integrações | Nenhuma em runtime. Fontes locais, sem scripts de terceiros. |
| Testes | Unitários, Playwright desktop/mobile com axe, cenários editoriais e de catálogo vazio, rodados no CI do PR e antes do deploy. |

## 2. Decisão de arquitetura

Um único app Next.js com **dois alvos de build**:

| | Estático (atual) | Servidor (loja) |
| --- | --- | --- |
| Comando | `GITHUB_PAGES=true npm run build` | `npm run build:server` (`CURA_TARGET=server`) |
| Saída | `out/`, GitHub Pages | `.next-server/`, runtime Node.js |
| Rotas de API | não existem | `app/api/**/route.ts` |
| Loja | desligada: checkout e pedido dizem "Compra online em breve" | ligada quando `CURA_COMMERCE=enabled` e as variáveis exigidas existem |

As rotas de API são arquivos `route.ts` padrão em `app/api`. O build estático (`npm run build`, via `scripts/build-static.ts`) move essa pasta para uma pasta privada enquanto exporta e a devolve no fim, então o export nunca as vê. Na Vercel (`VERCEL=1`) o alvo é sempre o de servidor, com saída em `.next`. O conteúdo continua vindo do mesmo JSON do Pages CMS nos dois alvos: a migração não toca nos dados editoriais.

### Fluxo de compra

1. A ficha lista as embalagens à venda: oferta publicada, com preço e peso confirmados, de lote e café publicados. Ela consulta a disponibilidade em `GET /api/availability/`.
2. O carrinho guarda no navegador apenas `{ id, quantidade }` e cota o frete em `POST /api/shipping/quote/`.
3. `POST /api/checkout/` valida a entrada e faz todo o cálculo no servidor:
   - Recalcula itens a partir do livro de preços do CMS, recota o frete e ignora qualquer valor enviado pelo navegador.
   - Grava o pedido com a chave de idempotência.
   - Reserva o estoque por SKU numa transação: tudo ou nada.
   - Cria o pagamento no Mercado Pago com `X-Idempotency-Key` igual ao id do pedido.
4. Pix: o QR Code é devolvido e exibido na página do pedido. Cartão: o Card Payment Brick gera um token no navegador e só esse token chega ao servidor. Número e CVV nunca chegam.
5. O Mercado Pago chama `POST /api/webhooks/mercadopago/`. A loja processa a notificação assim:
   - Verifica a assinatura HMAC (`x-signature`).
   - Descarta entregas repetidas pelo `x-request-id`.
   - **Lê o pagamento na API do Mercado Pago**, sem confiar no corpo da notificação.
   - Confere o valor e só então muda o status do pedido.
6. `/pedido/?id=…&token=…` mostra o status ao vivo. O token é `HMAC(ORDER_TOKEN_SECRET, id)`: não é guardado e não revela dados pessoais.

### Estados do pedido

| Pagamento no Mercado Pago | Pedido | Estoque |
| --- | --- | --- |
| `pending`, `in_process`, `authorized` | `pending_payment` | reservado |
| `approved`, com o valor igual ao do pedido | `paid` | baixado |
| `approved` com valor diferente | continua pendente, evento `payment.amount_mismatch` | reservado |
| `rejected` | `payment_failed` | devolvido uma única vez |
| `cancelled` ou `expired` (Pix vencido) | `cancelled` | devolvido uma única vez |
| `refunded` ou `charged_back` | `refunded` | conferência manual |
| — (operação) | `shipped` → `delivered` | — |

O navegador nunca marca pedido como pago. Um pagamento aprovado depois de o estoque ter sido liberado gera o evento `payment.approved_after_release`, para conferência manual.

## 3. Código

| Caminho | Função |
| --- | --- |
| `lib/commerce/catalog.ts`, `cart.ts`, `recommendations.ts` | Livro de preços, carrinho, preço por 100 g e upsell/cross-sell. Usados no navegador e no servidor. |
| `lib/commerce/rules.ts` + `content/commerce.json` | Regras comerciais do CMS: frete grátis (nulo), quantidade máxima e validade do Pix. |
| `lib/commerce/server/orders.ts` | Checkout, reserva de estoque, transições, webhook, reconciliação e envio. |
| `lib/commerce/server/mercadopago.ts`, `shipping.ts`, `notify.ts` | Clientes HTTP do Mercado Pago, Melhor Envio e Resend. |
| `lib/commerce/server/db.ts` + `db/migrations/*.sql` | PostgreSQL (`pg`) em produção e PGlite em testes, com a mesma SQL. |
| `lib/commerce/server/security.ts`, `log.ts`, `config.ts` | HMAC, CPF, limitador, logs sem dados pessoais e configuração por ambiente. |
| `components/commerce/*` | Painel de compra, carrinho, checkout, pedido e kits. |
| `scripts/ops.ts` | Operação por linha de comando: migração, estoque, pedidos, envio e reconciliação. |
| `scripts/test-commerce.ts` | Ambiente de testes de ponta a ponta com simuladores. |

## 4. Infraestrutura proposta

| Peça | Proposta | Observação |
| --- | --- | --- |
| Hospedagem | **Vercel** (projeto novo apontando para este repositório, comando `npm run build:server`, região de funções `gru1` São Paulo) | Runtime Next.js nativo. O plano Hobby não permite uso comercial: precisa ser **Pro**. Alternativas: Render ou Railway com `npm run start:server`. |
| Banco | **PostgreSQL gerenciado em São Paulo**: Supabase (região sa-east-1) ou Neon | Dados pessoais no Brasil. Backups diários e PITR no plano pago. |
| Pagamentos | Mercado Pago Checkout Transparente (Pix e cartão) | Conta PJ da Cura, credenciais de teste e de produção separadas. |
| Frete | Melhor Envio (Correios e transportadoras) | Conta da Cura, token de API, CEP de origem e medidas da caixa. |
| E-mail | Resend, com domínio próprio verificado (SPF/DKIM) | Sem chave configurada, nada é enviado e o log registra "skipped". |
| Domínio | Domínio `.com.br` próprio (Registro.br) | Necessário para e-mail transacional, cookies e confiança. Hoje o site está em `igorbarone.github.io`. |
| Agendamento | Cron a cada 15 min chamando `npm run ops -- orders:reconcile 60` (job agendado no provedor ou Vercel Cron com rota protegida) | Cancela pedidos sem pagamento e libera estoque. A rota de cron ainda não existe; por ora o comando roda manualmente. |

### Variáveis de ambiente (servidor)

Nenhuma delas vai para o repositório ou para o CMS. Use o painel de segredos do provedor de hospedagem.

| Variável | Obrigatória | Exemplo / formato |
| --- | --- | --- |
| `CURA_COMMERCE` | sim | `enabled` (também no **build**, para ligar a interface da loja) |
| `SITE_URL` | sim | `https://loja.curacafe.com.br` (sem barra no fim) |
| `DATABASE_URL` | sim | `postgres://…` (produção) · `pglite:./.cura-data` (homologação local) |
| `CURA_AUTO_MIGRATE` | não | `true` aplica as migrações na partida; o recomendado é `npm run ops -- migrate` no deploy |
| `ORDER_TOKEN_SECRET` | sim | ≥ 32 caracteres aleatórios. Se for trocado, os links de pedido já enviados deixam de abrir. |
| `MP_ENVIRONMENT` | sim | `sandbox` ou `production` |
| `CURA_ALLOW_LIVE_PAYMENTS` | só para cobrar de verdade | `true`. Sem ela, `MP_ENVIRONMENT=production` **desliga** os pagamentos. |
| `MP_ACCESS_TOKEN` | sim | access token da conta (teste ou produção) |
| `MP_PUBLIC_KEY` | para cartão | public key correspondente; sem ela, só Pix |
| `MP_WEBHOOK_SECRET` | sim | "assinatura secreta" das notificações no painel do Mercado Pago |
| `MELHOR_ENVIO_TOKEN` | sim | token de aplicação |
| `MELHOR_ENVIO_API_BASE` | não | `https://sandbox.melhorenvio.com.br` (padrão) ou `https://melhorenvio.com.br` |
| `MELHOR_ENVIO_USER_AGENT` | sim | `Cura Café (email-tecnico@dominio)`, exigido pelo Melhor Envio |
| `MELHOR_ENVIO_SERVICES` | não | ids de serviço separados por vírgula, para limitar opções |
| `SHIPPING_ORIGIN_CEP` | sim | CEP de onde os pedidos saem |
| `SHIPPING_BOX_CM` | sim | `altura x largura x comprimento`, ex. `12x16x24` (**a confirmar** com a embalagem real) |
| `SHIPPING_TARE_GRAMS` | sim | peso da caixa e proteção, em gramas (**a confirmar**) |
| `RESEND_API_KEY`, `EMAIL_FROM` | para e-mail | `Cura Café <pedidos@dominio>` |

`/api/commerce/status/` informa o que está ligado (`pix`, `card`, `shipping`) sem expor nenhum valor.

## 5. Custos recorrentes estimados

Valores de referência a **confirmar nas páginas oficiais e na negociação** antes da decisão. Taxas de pagamento variam com o prazo de recebimento e com o volume.

| Item | Estimativa | Confirmar |
| --- | --- | --- |
| Vercel Pro | cerca de US$ 20 por membro/mês, mais excedentes de uso | vercel.com/pricing |
| Postgres (Supabase Pro ou Neon pago) | cerca de US$ 19–25/mês; existe plano gratuito para homologação | supabase.com/pricing · neon.tech/pricing |
| Mercado Pago, Pix | taxa percentual por transação (da ordem de 1%) | tabela de taxas da conta, Checkout Transparente |
| Mercado Pago, cartão | taxa percentual por transação (da ordem de 4–5% com recebimento na hora, menor com prazo maior), mais juros do parcelamento quando repassados | tabela de taxas da conta |
| Melhor Envio | sem mensalidade; paga-se cada etiqueta | melhorenvio.com.br |
| Resend | plano gratuito com limite diário; plano pago a partir de cerca de US$ 20/mês | resend.com/pricing |
| Domínio `.com.br` | cerca de R$ 40/ano | registro.br |

Sem tráfego relevante, a infraestrutura fixa fica na ordem de **US$ 40–50/mês**. O custo variável vem das taxas de pagamento e das etiquetas.

## 6. Segurança, LGPD e qualidade

- **Entrada:** Zod valida todos os campos, incluindo CPF (dígitos verificadores), CEP, UF, telefone, nome e sobrenome. O consentimento é obrigatório. O corpo é limitado a 32 KB.
- **Preço:** o total é calculado só no servidor, a partir do CMS. Campos extras no corpo são recusados (`strict`).
- **Autorização:** o pedido só é lido com o token HMAC do link. Sem ele, ou com o id inexistente, a resposta é a mesma (404). A resposta não traz CPF, e-mail, telefone nem endereço completo.
- **Abuso:** há limitador por IP e rota. Ele fica em memória, então protege uma instância; com várias instâncias será preciso um armazenamento compartilhado (ex. Upstash Redis).
- **Pagamentos:**
  - O cartão só existe nos campos seguros do Mercado Pago.
  - O webhook tem assinatura HMAC, comparação em tempo constante e deduplicação.
  - A loja confirma o status consultando a API do Mercado Pago.
  - O valor do pagamento é conferido com o do pedido.
- **Duplicidade:**
  - Na loja: chave de idempotência por tentativa de checkout, com hash do corpo; a mesma chave com outro carrinho é recusada.
  - No Mercado Pago: `X-Idempotency-Key` igual ao id do pedido.
- **Logs:** nomes, e-mail, CPF, telefone, endereço, tokens e QR Codes são mascarados.
- **LGPD:**
  - O checkout coleta só o necessário e explica a finalidade (pedido, pagamento e entrega).
  - **Pendentes antes da produção:**
    - Política de privacidade com o controlador (razão social, CNPJ, encarregado/DPO, canal do titular).
    - Prazo de retenção dos pedidos.
    - Banner de consentimento antes de qualquer ferramenta de analytics.
    - Contrato ou termos com os operadores (Mercado Pago, Melhor Envio, Resend, hospedagem).
- **Cabeçalhos:** o alvo de servidor envia `nosniff`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`, e as rotas de API usam `Cache-Control: no-store`.

## 7. Operação comercial

| Necessidade | Como funciona hoje |
| --- | --- |
| Estoque | O banco é a fonte de verdade: `npm run ops -- stock:set <SKU> <qtd>` e `stock:list`. Um SKU sem registro está indisponível. O campo de estoque do CMS é só referência editorial. |
| Pedidos | `orders:list [status]` e `order:events <id>`, sem dados pessoais. Os dados de entrega ficam no banco e são consultados com acesso restrito. |
| Envio e rastreio | `order:ship <id> <código> [transportadora]` avisa o cliente por e-mail; depois, `order:deliver <id>`. A compra de etiqueta no Melhor Envio continua manual, no painel deles. |
| Pagamentos pendentes | `orders:reconcile [minutos]` relê o Mercado Pago, cancela pedidos sem pagamento e libera o estoque. |
| Comunicação | E-mails de pedido recebido (Pix), pagamento confirmado, pagamento não aprovado e pedido enviado. |
| Recompra | "Comprar novamente" na página do pedido, com os itens que continuam à venda. |
| Medição | Eventos `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info` e `purchase` em `window.dataLayer` (formato GA4). `purchase` só é enviado com pagamento confirmado pelo servidor, uma vez por pedido. Nenhuma ferramenta de analytics é carregada antes do consentimento. |
| Assinaturas | **Não implementadas**, até a aprovação das regras do Clube Cura. |
| Painel web | Não há. A operação é por CLI em homologação. Um painel com autenticação é o próximo passo depois das primeiras vendas. |

## 8. Upsell e cross-sell (sem invenção)

- **Kit** (ex. Kit descoberta SAMBA + SALSA): é cadastrado em **Kits** no CMS e só é vendido com preço aprovado. O estoque é o de cada SKU do kit.
- **Embalagem maior:** só é sugerida quando existe e **custa menos por 100 g**. Caso contrário, não aparece como vantagem.
- **Outro café** e **kits** aparecem no carrinho e na ficha, cada um com o motivo da sugestão.
- **Frete grátis:** `freeShippingFromCents` fica nulo até ser aprovado. Não há cupons, descontos, contadores ou urgência.
- **Produtos complementares** (filtros, acessórios): não existem no catálogo, então nada é sugerido.

## 9. Migração sem interromper o site

1. **Homologação:** criar o projeto na hospedagem com credenciais de **teste**, um banco separado e um subdomínio de homologação. O GitHub Pages continua sendo o site público.
2. Cadastrar ofertas reais (SKU, preço, peso) pelo CMS; aplicar `ops -- migrate` e `ops -- stock:set`.
3. Validar o roteiro de `docs/COMMERCE-ATIVACAO.md` com compras de teste, Pix e cartões de teste.
4. **Produção:** com domínio próprio, credenciais de produção, `MP_ENVIRONMENT=production` e, por decisão explícita, `CURA_ALLOW_LIVE_PAYMENTS=true`. O domínio passa a apontar para a loja.
5. O GitHub Pages pode continuar publicando o export estático como reserva, ou ser desativado depois de estabilizar.

## 10. Plano de rollback

| Situação | Ação |
| --- | --- |
| Falha no checkout ou no pagamento | Remover `CURA_ALLOW_LIVE_PAYMENTS` (ou o `MP_ACCESS_TOKEN`). Os pagamentos desligam na hora e a ficha continua exibindo os produtos. |
| Loja inteira instável | Apontar o domínio de volta para o GitHub Pages: o export estático segue sendo gerado a cada push na `main`. |
| Deploy com erro | "Instant rollback" para o deploy anterior no provedor de hospedagem. |
| Migração de banco | As migrações só adicionam estruturas. Antes de cada nova migração, fazer backup ou snapshot do banco. |
| Pedidos em andamento | Não são apagados. `orders:reconcile` e o painel do Mercado Pago garantem conferência e estorno. |

## 11. Testes

| Comando | Cobre |
| --- | --- |
| `npm run test:unit` | Livro de preços, carrinho, kits, preço por 100 g, upsell, Pix, cartão aprovado, recusado e em análise, idempotência e concorrência, estoque insuficiente, falha de rede, webhook duplicado e forjado, valor divergente, expiração, reconciliação, envio, CPF, limitador, mascaramento de logs e bloqueio de cobrança real. |
| `npm run test:commerce` | Build de servidor com catálogo **fictício**, PGlite e simuladores locais do Mercado Pago, Melhor Envio e Resend. Inclui: compra completa por Pix até a confirmação pelo webhook, recompra, estoque escasso, queda do provedor com nova tentativa sem duplicar, cartão recusado, adulteração de total, webhook forjado, privacidade da resposta e axe e overflow em desktop e mobile. |
| `npm test`, `npm run test:scenarios` | Site estático e cenários editoriais, inclusive "Compra online em breve" no GitHub Pages. |

**Fora do alcance automático:**
- O Card Payment Brick real depende do script do Mercado Pago.
- As APIs reais (sandbox) exigem credenciais e acesso de rede.

Os dois são validados no roteiro de homologação.
