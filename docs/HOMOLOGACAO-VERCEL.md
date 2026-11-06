# Homologação na Vercel — passo a passo

A homologação é um **segundo endereço**, por exemplo `cura-cafe.vercel.app`, rodando a versão loja do mesmo repositório. O site atual no GitHub Pages continua igual. Nada aqui cobra de verdade: o Mercado Pago fica em modo **sandbox**.

## Etapa 1 — Loja no ar, sem pagamento (≈15 min)

Mostra a ficha com embalagens e preços, o carrinho e a página de checkout. Enquanto o Mercado Pago não estiver configurado, o checkout diz "Compra online em breve".

1. Crie a conta em **vercel.com** entrando com o GitHub. Para testes o plano Hobby basta; para vender de verdade a Vercel exige o plano **Pro**.
2. **Add New → Project**, escolha o repositório `igorbarone/CURA-CAF-` e clique em **Import**. O `vercel.json` do repositório já define o framework (Next.js), o build (`npm run build:server`) e a região (São Paulo). Não mude essas opções.
3. Antes do primeiro deploy, abra **Environment Variables** e crie:

   | Nome | Valor |
   | --- | --- |
   | `CURA_COMMERCE` | `enabled` |
   | `ORDER_TOKEN_SECRET` | 48 caracteres aleatórios (use o gerador de senhas do navegador ou do gerenciador de senhas). Não compartilhe. |
   | `MP_ENVIRONMENT` | `sandbox` |
   | `CURA_AUTO_MIGRATE` | `true` (cria as tabelas no primeiro acesso) |
   | `CURA_STOCK_FROM_CMS` | `true` (usa o "estoque editorial" do CMS como estoque inicial de teste) |

4. Clique em **Deploy**. O primeiro build pode falhar por falta de banco; é esperado.
5. **Banco:** no projeto, abra **Storage → Create Database → Neon** (Postgres) e escolha a região **São Paulo** se ela aparecer na lista. Conecte o banco ao projeto: a Vercel cria `DATABASE_URL` sozinha.
6. **Deployments → ⋯ → Redeploy.**
7. Abra `https://<seu-projeto>.vercel.app/api/commerce/status/`. Deve aparecer `"enabled": true`.

O endereço da loja (`SITE_URL`) é detectado automaticamente pela Vercel. Só defina `SITE_URL` se usar um domínio próprio.

### Para ver produtos à venda

A loja só vende embalagens com **preço e peso confirmados**. No Pages CMS, em **Ofertas**, crie uma oferta para cada embalagem, com estes campos:
- lote;
- SKU;
- preço em centavos (ex.: `4990` = R$ 49,90);
- peso em gramas;
- moagem;
- estoque editorial (ex.: `20`);
- estado **Publicado**.

Salvar no CMS dispara um novo deploy da Vercel. Atenção: a oferta publicada também mostra o preço ("a partir de") no site do GitHub Pages, que continua dizendo "Compra online em breve".

## Etapa 2 — Pagamento em sandbox (Mercado Pago)

1. Em **mercadopago.com.br/developers**, crie uma aplicação do tipo **Checkout Transparente** (pagamentos online).
2. Em **Credenciais de teste**, copie o **Access Token** e a **Public Key**.
3. Em **Webhooks**, configure:
   - URL: `https://<seu-projeto>.vercel.app/api/webhooks/mercadopago/`
   - evento **Pagamentos**
   - copie a **assinatura secreta**.
4. Na Vercel, crie as variáveis `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` e `MP_WEBHOOK_SECRET` e faça **Redeploy**.
5. Crie **contas de teste** (comprador) no painel do Mercado Pago e use os **cartões de teste** da documentação.

**Não crie** `CURA_ALLOW_LIVE_PAYMENTS` nem mude `MP_ENVIRONMENT` para `production`: é isso que garante que não há cobrança real.

## Etapa 3 — Frete em sandbox (Melhor Envio)

1. Crie a conta em **sandbox.melhorenvio.com.br** e gere um token em **Integrações → Permissões de acesso**.
2. Na Vercel, crie as variáveis:

   | Nome | Valor |
   | --- | --- |
   | `MELHOR_ENVIO_TOKEN` | o token |
   | `MELHOR_ENVIO_USER_AGENT` | `Cura Café (seu-email@dominio)` |
   | `SHIPPING_ORIGIN_CEP` | CEP de onde os pedidos sairão |
   | `SHIPPING_BOX_CM` | medidas da caixa, `alturaxlarguraxcomprimento`, ex. `12x16x24` |
   | `SHIPPING_TARE_GRAMS` | peso da caixa e proteção, ex. `150` |

3. **Redeploy**. Na loja, o carrinho passa a calcular o frete pelo CEP e o checkout fica completo.

## Etapa 4 (opcional) — E-mails

Crie uma conta na **Resend**, verifique um domínio e defina `RESEND_API_KEY` e `EMAIL_FROM` (`Cura Café <pedidos@seudominio>`). Sem isso, a loja funciona normalmente, só não envia e-mails.

## O que testar em seguida

Siga a seção 3 de [`COMMERCE-ATIVACAO.md`](COMMERCE-ATIVACAO.md): compra por Pix, cartão aprovado e recusado, notificação repetida, Pix vencido, estoque esgotado e envio com rastreio.
