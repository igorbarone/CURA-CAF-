# Ativação da loja — dependências e roteiro de homologação

Este roteiro leva a loja do ambiente de testes à **homologação com sandbox real** e, depois, à produção. Nenhuma etapa deve publicar credenciais no repositório, no CMS ou no chat.

## 1. Decisões e dados da equipe (bloqueiam a venda)

- [ ] **Ofertas reais no CMS:**
  - SKU, preço em centavos, peso em gramas e moagem por embalagem de SAMBA e SALSA.
  - Hoje há 0 ofertas, então nada aparece à venda.
- [ ] **Kit descoberta:** decidir se existe e com que preço; cadastrar em **Kits**.
- [ ] **Estoque inicial por SKU:** carregado com `npm run ops -- stock:set`.
- [ ] **Embalagem de envio:** medidas da caixa (`SHIPPING_BOX_CM`), peso da caixa e proteção (`SHIPPING_TARE_GRAMS`) e CEP de origem.
- [ ] **Regras comerciais:** frete grátis (se houver), validade do Pix e quantidade máxima por item.
- [ ] **Dados legais da loja**, exigidos para comércio eletrônico:
  - Razão social, CNPJ, endereço e canal de atendimento no site.
  - Política de trocas e direito de arrependimento de 7 dias.
  - Política de privacidade (LGPD) com o encarregado.
  - Termos de compra.
- [ ] **Responsável pela operação:** quem separa, envia, informa o rastreio e responde ao cliente.

## 2. Contas e credenciais (feitas pela equipe)

| Serviço | O que criar | Onde vai |
| --- | --- | --- |
| Mercado Pago | Conta da empresa; aplicação "Checkout Transparente"; **credenciais de teste** e contas de teste (comprador e vendedor); depois as credenciais de produção | Segredos do provedor de hospedagem |
| Mercado Pago, Webhooks | URL `https://<dominio>/api/webhooks/mercadopago/`, evento "Pagamentos"; copiar a **assinatura secreta** | `MP_WEBHOOK_SECRET` |
| Melhor Envio | Conta, aplicativo e token no **sandbox** (sandbox.melhorenvio.com.br); depois em produção | `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_API_BASE` |
| Resend | Conta, domínio verificado e chave de API | `RESEND_API_KEY`, `EMAIL_FROM` |
| Banco | Projeto Postgres em São Paulo (homologação e produção separados) | `DATABASE_URL` |
| Hospedagem | Projeto apontando para este repositório; build `npm run build:server` e start `npm run start:server` (ou nativo do Next.js na Vercel) | — |

Gere `ORDER_TOKEN_SECRET` com, por exemplo, `openssl rand -base64 48`.

## 3. Homologação com sandbox real

Configure no ambiente de homologação:
- `CURA_COMMERCE=enabled` (também no build).
- `MP_ENVIRONMENT=sandbox`.
- As credenciais **de teste**.
- **Sem** `CURA_ALLOW_LIVE_PAYMENTS`.

1. Implantar e rodar `npm run ops -- migrate`.
2. Cadastrar as ofertas reais pelo CMS e carregar o estoque com `ops -- stock:set`.
3. Conferir que `GET /api/commerce/status/` retorna `pix`, `card` e `shipping` como `true` e `environment` como `sandbox`.
4. Fazer uma compra por **Pix** com o comprador de teste. O pedido deve:
   - aparecer como pendente, com QR Code;
   - ficar "pago" após a simulação de pagamento e a notificação;
   - enviar os e-mails de pedido recebido e de pagamento confirmado.
5. Fazer uma compra por **cartão** com os cartões de teste do Mercado Pago:
   - aprovado → pedido pago;
   - recusado → "Pagamento não aprovado" e estoque devolvido;
   - em análise → pedido continua pendente.
6. Repetir uma notificação pelo painel do Mercado Pago e conferir com `ops -- order:events <id>` que o status não muda de novo.
7. Deixar um Pix vencer e rodar `ops -- orders:reconcile 30`: o pedido é cancelado e o estoque devolvido.
8. Esgotar um SKU: a ficha mostra "Indisponível" e o checkout recusa a compra.
9. Enviar um pedido pago com `ops -- order:ship <id> <rastreio> Correios` e conferir o e-mail com o rastreio.
10. Conferir os logs da hospedagem: sem CPF, e-mail, telefone ou endereço.

## 4. Produção (decisão explícita da equipe)

- [ ] Itens 1 e 2 concluídos, com revisão jurídica da política de privacidade e dos termos.
- [ ] Domínio próprio com HTTPS; `SITE_URL` e a URL do webhook atualizados no Mercado Pago.
- [ ] Credenciais de produção; `MP_ENVIRONMENT=production`; `MELHOR_ENVIO_API_BASE=https://melhorenvio.com.br`.
- [ ] `CURA_ALLOW_LIVE_PAYMENTS=true`. **Sem esta variável, a produção não cobra.**
- [ ] Rotina agendada de `orders:reconcile`.
- [ ] Backups do banco ativos.
- [ ] Uma compra real de baixo valor, com estorno, antes de divulgar.
- [ ] Para recuar, siga o rollback em `COMMERCE-ARQUITETURA.md`.

## 5. Ainda fora desta entrega

- Painel administrativo web com autenticação (a operação é por CLI).
- Compra automática de etiqueta e rastreio pelo Melhor Envio.
- Cupons e descontos, até haver regras aprovadas.
- Assinaturas (Clube Cura), até haver regras e operador de cobrança recorrente.
- Rota de cron autenticada para a reconciliação e limitador compartilhado entre instâncias.
- Banner de consentimento e ferramenta de analytics.
