# Homologação na Vercel: passo a passo

O projeto `cura-caf` na Vercel roda a versão loja deste repositório. O site no GitHub Pages continua igual. Nada aqui cobra de verdade: o Asaas fica em **sandbox** e o Melhor Envio também.

## Etapa 1: a loja no ar, sem pagamento

Já está feito no projeto atual. As variáveis são `CURA_COMMERCE`, `ORDER_TOKEN_SECRET`, `CURA_AUTO_MIGRATE`, `CURA_STOCK_FROM_CMS` e o banco Neon (`DATABASE_URL`).

- **Remova** `MP_ENVIRONMENT`: o Mercado Pago saiu da loja.
- Enquanto o Asaas não estiver configurado, o checkout diz "Compra online em breve".

Para uma variante aparecer à venda, o Pages CMS (**Ofertas**) precisa de:
- preço;
- peso líquido;
- **peso bruto embalado**;
- **altura, largura e comprimento** da embalagem;
- estado **Publicado**.

Em **Regras comerciais → Caixas**, cadastre ao menos uma caixa de envio. Salvar no CMS dispara um novo deploy.

## Etapa 2: pagamento em sandbox (Asaas)

1. Crie a conta em **sandbox.asaas.com**. Em **Integrações → Chave de API**, gere a chave; ela começa com `$aact_hmlg_`.
2. Em **Integrações → Webhooks**, crie um webhook:
   - URL: `https://cura-caf.vercel.app/api/webhooks/asaas/`
   - versão da API v3, eventos de **Cobranças**
   - fila sequencial
   - **Token de autenticação:** gere 32+ caracteres aleatórios e guarde.
3. Na Vercel, crie:

   | Nome | Valor |
   | --- | --- |
   | `ASAAS_ENVIRONMENT` | `sandbox` |
   | `ASAAS_API_KEY` | a chave do sandbox |
   | `ASAAS_WEBHOOK_TOKEN` | o mesmo token do webhook |

4. Faça **Redeploy**. `GET /api/commerce/status/` passa a mostrar `"pix": true` e `"card": true`.

**Não crie** `CURA_ALLOW_LIVE_PAYMENTS` nem mude `ASAAS_ENVIRONMENT` para `production`. Uma chave de produção com o ambiente sandbox é recusada pela loja.

## Etapa 3: frete em sandbox (Melhor Envio)

1. Crie a conta em **sandbox.melhorenvio.com.br** e gere um token em **Integrações → Permissões de acesso**. Marque cotação, carrinho, compra, geração, impressão e rastreio de etiquetas.
2. Na Vercel, crie:

   | Nome | Valor |
   | --- | --- |
   | `MELHOR_ENVIO_ENVIRONMENT` | `sandbox` |
   | `MELHOR_ENVIO_TOKEN` | o token |
   | `MELHOR_ENVIO_USER_AGENT` | `Cura Café (email-técnico@dominio)` |
   | `SHIPPING_ORIGIN_CEP` | CEP de onde os pedidos saem |

3. Para etiquetas, defina também os dados do remetente: `SHIPPING_FROM_NAME`, `SHIPPING_FROM_DOCUMENT` (CPF) ou `SHIPPING_FROM_COMPANY_DOCUMENT` (CNPJ), `SHIPPING_FROM_PHONE`, `SHIPPING_FROM_EMAIL`, `SHIPPING_FROM_STREET`, `SHIPPING_FROM_NUMBER`, `SHIPPING_FROM_DISTRICT`, `SHIPPING_FROM_CITY` e `SHIPPING_FROM_STATE`.
4. Faça **Redeploy**.

## Etapa 4: painel e reconciliação

1. No terminal do projeto, rode `npm run ops -- admin:hash`. O comando pede a senha e imprime `ADMIN_PASSWORD_HASH=…`. A senha não aparece na tela.
2. Na Vercel, crie `ADMIN_PASSWORD_HASH` (o valor impresso) e `ADMIN_SESSION_SECRET` (48 caracteres aleatórios).
3. Crie `CRON_SECRET` (aleatório). O `vercel.json` agenda a reconciliação diária e a Vercel envia esse segredo sozinha.
4. Faça **Redeploy** e acesse `https://cura-caf.vercel.app/admin/`.

## Etapa 5 (opcional): e-mails

Defina `RESEND_API_KEY` e `EMAIL_FROM`. Sem eles, a loja funciona normalmente, só não envia e-mails.

## O que testar

Siga a seção 3 de [`COMMERCE-ATIVACAO.md`](COMMERCE-ATIVACAO.md):
- frete para SP, RJ e Nordeste;
- Pix com desconto;
- cartão pela página do Asaas;
- webhook repetido;
- Pix vencido;
- SKU esgotado;
- etiqueta e rastreio.
