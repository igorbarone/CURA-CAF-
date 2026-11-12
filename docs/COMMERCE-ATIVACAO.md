# Ativação da loja: dados da equipe e roteiro de homologação

Este roteiro leva a loja do ambiente de testes ao **sandbox real** do Asaas e do Melhor Envio, e depois à produção. Credenciais nunca vão para o repositório, o CMS ou o chat: só para as variáveis de ambiente da Vercel.

## 1. Dados que a equipe precisa fornecer (bloqueiam a venda)

Nada abaixo foi inventado no código. Enquanto faltar, a loja mostra "Compra online em breve" ou recusa a cotação.

| Dado | Onde entra | Situação |
| --- | --- | --- |
| **CEP de origem** dos envios | `SHIPPING_ORIGIN_CEP` | pendente |
| **Remetente das etiquetas:** nome ou razão social, CPF/CNPJ, IE (se houver), telefone, e-mail e endereço completo | `SHIPPING_FROM_*` | pendente |
| **Peso bruto e medidas da embalagem** de cada variante vendida (o saco pronto para envio) | CMS → Ofertas: peso bruto, altura, largura, comprimento | pendente para SAMBA, SALSA e DA CASA 250 g |
| **Caixas de envio:** medidas internas e externas e peso vazio com proteção | CMS → Regras comerciais → Caixas | pendente (nenhuma cadastrada) |
| **Quais variantes serão vendidas:** 500 g e 1 kg em grãos já têm o preço da planilha e estão em rascunho; 250 g moído segue sem preço | CMS → Ofertas: publicar quando a embalagem existir | decidir |
| **Estoque inicial** por SKU | Painel → Estoque (ou `ops -- stock:set`) | pendente |
| **NF-e ou declaração de conteúdo** nas etiquetas | Chave por pedido no painel, ou `SHIPPING_NON_COMMERCIAL=true` se a contabilidade confirmar | decidir com a contabilidade |
| **Credenciais Asaas** (sandbox, depois produção) e token do webhook | `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` | pendente |
| **Credenciais Melhor Envio** (sandbox, depois produção) | `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_USER_AGENT` | pendente |
| **Senha do painel** | `ADMIN_PASSWORD_HASH` (gerado com `npm run ops -- admin:hash`), `ADMIN_SESSION_SECRET` | pendente |
| **Dados legais:** razão social, CNPJ, política de privacidade (LGPD, encarregado), termos, trocas e arrependimento | Páginas do site | pendente |

Já confirmados e aplicados (planilha de precificação de 12/11/2026):

| Variante | Cartão (preço do site) | Pix (−5%) | Estado |
| --- | --- | --- | --- |
| SAMBA e SALSA 250 g | R$ 28,49 | R$ 27,07 | publicada |
| SAMBA e SALSA 500 g | R$ 49,11 | R$ 46,65 | rascunho |
| SAMBA e SALSA 1 kg | R$ 90,33 | R$ 85,81 | rascunho |
| DA CASA 250 g | R$ 26,52 | R$ 25,19 | publicada |
| DA CASA 500 g | R$ 45,16 | R$ 42,90 | rascunho |
| DA CASA 1 kg | R$ 82,44 | R$ 78,32 | rascunho |

Também confirmados:
- desconto de 5% no Pix só sobre os cafés;
- taxas do Asaas usadas só nos indicadores: cartão 3% + R$ 0,49 por venda, Pix R$ 0,99 por venda;
- serviços PAC e .Package;
- peso máximo de 4 kg por volume.

## 2. Contas e credenciais

| Serviço | O que fazer | Variável |
| --- | --- | --- |
| Asaas (sandbox) | Criar a conta em sandbox.asaas.com e gerar a **chave de API** (Integrações) | `ASAAS_API_KEY` (`$aact_hmlg_…`), `ASAAS_ENVIRONMENT=sandbox` |
| Asaas, webhook | Integrações → Webhooks → novo: URL `https://<domínio>/api/webhooks/asaas/`, API v3, eventos de **Cobranças**, envio sequencial, **token de autenticação** com 32+ caracteres aleatórios | `ASAAS_WEBHOOK_TOKEN` (o mesmo token) |
| Asaas, cartão | Na conta, cadastrar o **domínio do site** para o retorno da página de pagamento (o `successUrl` só funciona com domínio cadastrado) | — |
| Melhor Envio (sandbox) | Conta em sandbox.melhorenvio.com.br → Integrações → token com permissões de cotação, carrinho, compra, geração, impressão e rastreio | `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_USER_AGENT="Cura Café (email-técnico)"`, `MELHOR_ENVIO_ENVIRONMENT=sandbox` |
| Melhor Envio, saldo | Adicionar saldo de teste para comprar etiquetas no sandbox | — |
| Painel | Rodar `npm run ops -- admin:hash`, que pede a senha e imprime o hash; gerar um segredo com `openssl rand -base64 48` | `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` |
| Cron | Gerar um segredo aleatório | `CRON_SECRET` |

## 3. Homologação em sandbox (passo a passo)

Pré-requisitos: as variáveis da seção 2 configuradas em **Preview/Production da Vercel no projeto de homologação**, **sem** `CURA_ALLOW_LIVE_PAYMENTS`. Os dados da seção 1 cadastrados no CMS.

1. Fazer o deploy; com `CURA_AUTO_MIGRATE=true` a migração 003 roda no primeiro acesso (ou use `npm run ops -- migrate`).
2. `GET /api/commerce/status/` deve responder `pix`, `card` e `shipping` como `true` e `environment` como `sandbox`.
3. No painel `/admin/` → **Produtos e lotes**, nenhuma variante que se quer vender pode aparecer como "Falta: …".
4. No **Estoque**, definir o disponível de cada SKU, com motivo.
5. **Frete:** no carrinho, cotar um CEP de SP, um do RJ e um do Nordeste. Conferir que aparecem PAC e/ou .Package conforme o Melhor Envio e que 16 sacos de 250 g (ou ~4 kg) viram mais de um volume.
6. **Pix:** comprar, conferir o desconto de 5% só nos cafés, o QR Code e o copia e cola. Pagar no sandbox do Asaas (botão de confirmar pagamento da cobrança) → o pedido vira "Pagamento confirmado" sozinho e chegam os e-mails.
7. **Cartão:** escolher cartão (sem desconto) → página do Asaas → pagar com o cartão de teste do sandbox → volta ao pedido → "Pagamento confirmado".
8. **Webhook repetido:** reenviar o evento pelo painel do Asaas → o histórico do pedido no `/admin` mostra o recebimento, mas nada muda (nem estoque).
9. **Prazo vencido:** criar um Pix e não pagar. Após 30 min, abrir a página do pedido (ou o painel → "Revisar cobranças pendentes") → pedido "Expirado", cobrança removida no Asaas, estoque devolvido.
10. **Esgotado:** zerar um SKU no painel → a ficha mostra "Indisponível" e o Barista responde "esgotado" com alternativas.
11. **Etiqueta:** num pedido pago, "Comprar etiqueta" (com a chave da NF-e, ou sem ela se a declaração de conteúdo foi autorizada) → link de impressão → "Atualizar rastreio" → "Enviado" com e-mail ao cliente → "Marcar como entregue".
12. **Logs da Vercel:** sem CPF, e-mail, telefone ou endereço.

## 4. Produção (somente com aprovação explícita da equipe)

- [ ] Seções 1 a 3 concluídas, com revisão jurídica das políticas.
- [ ] Domínio próprio com HTTPS; `SITE_URL`, a URL do webhook no Asaas e o domínio do retorno do cartão atualizados.
- [ ] Chave de **produção** do Asaas (`$aact_prod_…`), `ASAAS_ENVIRONMENT=production`, novo webhook de produção com novo token.
- [ ] Token de produção do Melhor Envio, `MELHOR_ENVIO_ENVIRONMENT=production` e saldo na carteira.
- [ ] `CURA_ALLOW_LIVE_PAYMENTS=true`. **Sem esta variável, a produção não cobra.**
- [ ] `CRON_SECRET` definido (a reconciliação diária roda pelo `vercel.json`).
- [ ] Backups do banco ativos.
- [ ] Uma compra real de baixo valor, com estorno, antes de divulgar.
- [ ] Para recuar, siga a seção 12 de `COMMERCE-ARQUITETURA.md`.

## 5. Fora desta entrega

- Compra automática de etiquetas (não há regra aprovada; a compra é sempre manual no painel).
- Frete grátis ou subsídio: os campos existem no CMS e ficam vazios até haver aprovação.
- Parcelamento no cartão (a cobrança é à vista).
- Cupons, assinaturas (Clube), NF-e automática e banner de consentimento de analytics.
- Limitador de tentativas compartilhado entre instâncias (hoje é em memória, por instância).
