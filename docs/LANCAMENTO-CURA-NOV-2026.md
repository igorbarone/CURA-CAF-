# Plano operacional de lançamento — CURA Café
**Data-base:** 17/11/2026 · **Status:** preparação/homologação, não liberar cobrança real sem testes e aprovação.

## Decisões já documentadas no projeto

- **Tecnologia:** site Next.js na Vercel; manter a aplicação atual e não reescrever o checkout.
- **Pagamentos:** Asaas (Pix 5% de desconto sobre os cafés; cartão na página do Asaas). Taxas de **planejamento**, não tarifas confirmadas: cartão 3% + R$ 0,49 e Pix R$ 0,99 por venda. Verificar tabela efetiva da conta Asaas antes da liberação.
- **Frete:** Melhor Envio, serviços cotados dinamicamente (PAC e .Package quando disponíveis), frete pago pelo comprador, etiqueta adquirida manualmente no painel.
- **Origem:** CEP `22775-033` documentado no projeto em 12/11/2026.
- **Identidade:** CURA Café, assinatura «Democratizar café especial», valorização do pequeno produtor; manter materiais, logo e rótulos oficiais.
- **Experience:** QR Code **único para todas as embalagens**; a mesma URL fixa deve permitir alterar o conteúdo sem reimpressão; sem cadastro obrigatório na primeira fase.
- **Catálogo:** Pages CMS é a fonte única para loja, Experience e Barista. Estoque transacional no Postgres. Não inserir preços ou fotos de origem inventados.

## Preços do catálogo já aprovados em 12/11/2026

| Café / peso | Preço no cartão | Pix com 5% de desconto | Publicação |
|---|---:|---:|---|
| SAMBA 250 g | R$ 28,49 | R$ 27,07 | Ofertado editorialmente; venda bloqueada até logística |
| SALSA 250 g | R$ 28,49 | R$ 27,07 | Ofertado editorialmente; venda bloqueada até logística |
| DA CASA 250 g | R$ 26,52 | R$ 25,19 | Ofertado editorialmente; venda bloqueada até logística |
| SAMBA / SALSA 500 g | R$ 49,11 | R$ 46,65 | Rascunho |
| SAMBA / SALSA 1 kg | R$ 90,33 | R$ 85,81 | Rascunho |
| DA CASA 500 g | R$ 45,16 | R$ 42,90 | Rascunho |
| DA CASA 1 kg | R$ 82,44 | R$ 78,32 | Rascunho |

**Escopo comercial inicial recomendado:** apenas três cafés de 250 g em grãos. Manter 500 g, 1 kg e 250 g moído como rascunhos até confirmação de embalagem, custo e estoque.

## Caminho crítico — executar nesta ordem

### A. Domínio e publicação
- [ ] Confirmar disponibilidade e titularidade de `curacafe.com.br` no Registro.br e verificar conflito de marca; **não assumir que está livre**.
- [ ] Responsável legal registrar e pagar pelo domínio, preferencialmente na conta corporativa da CURA.
- [ ] Por se tratar de e-commerce, usar plano Vercel compatível com uso comercial (Pro, segundo termos atuais); o Hobby é para uso pessoal não comercial.
- [ ] Na Vercel do projeto `cura-caf`, adicionar o domínio e `www`; configurar DNS conforme instruções geradas no painel e aguardar SSL/HTTPS verificado.
- [ ] Ajustar `SITE_URL` e URL do webhook Asaas para o domínio real; cadastrar domínio de retorno no Asaas; verificar links absolutos, SEO, sitemap, robots, login admin, e-mails e Experience.
- [ ] Preservar `cura-caf.vercel.app` para testes/redirecionamento; verificar que checkout real opera apenas na implantação correta.

### B. Configuração operacional e comercial
- [x] CEP de origem: `22775-033` registrado no guia da equipe.
- [ ] Confirmar razão social, CNPJ, endereço completo, telefone e e-mail do remetente e configurar `SHIPPING_FROM_*` na Vercel; nunca no Git.
- [ ] Medir e pesar cada **saco pronto de 250 g** (peso **bruto**, A × L × C) e cadastrar no Pages CMS.
- [ ] Medir caixas de envio (dimensões internas e externas, tara, proteção) e cadastrar em Regras comerciais → Caixas.
- [ ] Definir quantidade inicial real por SKU no painel; **não confundir estoque de homologação com estoque físico**.
- [ ] Com a contabilidade, confirmar NF-e / possibilidade legal de declaração de conteúdo, políticas de venda, devolução, arrependimento, privacidade e dados fiscais do site.
- [ ] Confirmar na conta Asaas as **tarifas efetivas**, em particular promoções temporárias, para aprovar/revisar a margem antes de começar.

### C. Pagamento e frete em sandbox
- [ ] Criar/configurar conta Asaas sandbox. Gerar `ASAAS_API_KEY` e token de webhook; inserir somente no ambiente Vercel. `ASAAS_ENVIRONMENT=sandbox`.
- [ ] Configurar Webhook API v3 em `/api/webhooks/asaas/` com os eventos de cobrança e token; cadastrar o domínio do retorno do cartão.
- [ ] Criar/configurar Melhor Envio sandbox, token com escopos necessários e user-agent identificado; `MELHOR_ENVIO_ENVIRONMENT=sandbox`.
- [ ] Configurar acesso do `/admin/` por hash de senha, segredo de sessão e `CRON_SECRET` na Vercel.
- [ ] Testar frete RJ, SP e Nordeste; múltiplos volumes; CEP inválido e serviço indisponível.
- [ ] Testar compra Pix sandbox com desconto, confirmação por webhook, cartão sandbox com redirecionamento e retorno, estoque, webhook duplicado, expiração de cobrança, estorno, etiqueta e rastreio.
- [ ] Confirmar proteção contra envio repetido da etiqueta e contra criação duplicada de pedido/cobrança; revisar logs sem dados pessoais.
- [ ] Só depois de tudo concluído: configurar **chaves de produção** em ambiente correto, backup do banco, `CURA_ALLOW_LIVE_PAYMENTS=true` após aprovação e fazer **compra real de baixo valor + estorno**.
- [ ] Divulgar a loja apenas depois de checkout, envio, e-mails e políticas revisados.

**Guia técnico já existente:** `docs/COMMERCE-ATIVACAO.md` e `docs/HOMOLOGACAO-VERCEL.md`.

### D. QR Code e adesivos
- [ ] Só imprimir após compra do domínio. URL canônica proposta: `https://curacafe.com.br/experiencia/?origem=qr`.
- [ ] Manter um único QR para SAMBA, SALSA e DA CASA, levando a seleção dinâmica do café na Experience.
- [ ] Não incorporar data, lote, SKU ou parâmetros que exijam reimpressão. Fazer eventual roteamento e conteúdo no **servidor/CMS**, mantendo a URL estável.
- [ ] Gerar QR em vetor (SVG/PDF) com margem de silêncio de 4 módulos, contraste escuro sobre fundo claro e tamanho testado em prova real (ponto de partida: 25–30 mm; ajustar após teste).
- [ ] Aplicar o QR aos adesivos oficiais sem alterar logotipo, tabela obrigatória ou rótulos aprovados. Testar leitura em celulares Android/iOS, luz fraca, adesivo curvo e embalagem fechada.
- [ ] Testar URLs finais (sem 404/redirecionamento em loop), texto do botão, performance mobile e alternativa textual legível.
- [ ] Enviar para gráfica somente o PDF final aprovado e com link funcional. **Nunca imprimir QR de domínio ainda não registrado.**

## Estratégia de Instagram e vendas — primeiros 7 dias

**Posicionamento:** café especial menos intimidador; origem e produtor em destaque; trilha «conheça → escolha → prepare → compre». Linguagem simples e calorosa, sem promessas sobre fazendas ou notas sensoriais que não constem nas fichas oficiais.

| Dia | Conteúdo | Objetivo | CTA |
|---|---|---|---|
| D−3 | Reel curto «café especial sem complicação» (close em grãos, embalagem e preparo) | Alcance | «Conheça a CURA» |
| D−2 | Carrossel «SAMBA x SALSA x DA CASA: qual combina com você?» usando apenas atributos confirmados | Escolha | «Salve para comparar» |
| D−1 | Stories de embalagem, QR e bastidores reais (sem simular imagens de fazendas) | Confiança | «Ative as notificações» |
| D0 | Post/Reel de abertura + stories com os 3 preços, Pix e site com checkout **somente se homologado** | Conversão | «Compre no site» |
| D+1 | Tutorial simples de coado, incluindo dosagem/exemplo validado pelo Barista | Educação | «Teste a receita» |
| D+2 | Reel da Experience no celular, mostrando QR e descoberta do café | Diferenciação | «Escaneie sua embalagem» |
| D+3 | FAQ sobre frete, embalagem, diferença de perfis e como escolher | Reduzir objeções | «Visite o site» |

**Distribuição:** 1 reel principal de lançamento, 1 carrossel comparativo, stories todos os dias, repost de fotos de clientes apenas com autorização. Usar UTM no link da bio/campanhas e eventos de funil para entender visitas → carrinho → checkout → pedido pago. Não anunciar «frete grátis», promoções extras ou estoque ilimitado.

### Legendas prontas para revisão
**Anúncio de lançamento** (usar somente quando loja e links estiverem operacionais):
> O café especial pode fazer parte da sua rotina. ☕ Conheça SAMBA, SALSA e DA CASA — três maneiras de descobrir novos sabores, sem complicação. A CURA nasceu para democratizar o café especial e aproximar você de quem produz. Escolha o seu no nosso site. No Pix, 5% de desconto sobre o café. Link na bio.

**Apresentação da Experience:**
> O café não termina quando você abre a embalagem. Aponte a câmera para o QR Code e entre na CURA Experience: conheça o café que está na sua mão, descubra formas de preparo e aprenda no seu ritmo, com apoio do CURA Barista IA. Conhecimento também faz parte do sabor.

**Pré-lançamento** (usar enquanto checkout estiver em homologação):
> Tem novidade sendo preparada na CURA. SAMBA, SALSA e DA CASA estão chegando para tornar o café especial mais próximo do dia a dia. Em breve: mais sabor, mais histórias e uma experiência que começa na embalagem.

## Quem precisa agir
| Entrega | Dependência externa / responsável |
|---|---|
| Domínio | Conta e pagamento do responsável legal no Registro.br |
| Vercel comercial e DNS | Conta proprietária da Vercel, autorização de workspace e eventual contratação |
| Asaas | Conta PJ, chave de sandbox, webhook e chaves de produção (não compartilhar em conversa) |
| Melhor Envio | Conta, autorização, saldo e remetente |
| Embalagem | Equipe comercial/logística fornece medidas e peso real |
| Fiscal e políticas | Contabilidade/jurídico da CURA |
| Instagram | Conta oficial, aprovação criativa e publicação |
| Liberação de pagamentos | Homologação em sandbox, revisão operacional e aprovação explícita da equipe |

**Gate de lançamento:** Domínio com SSL + Vercel comercial + variantes realmente vendáveis + estoque + frete real + Pix e cartão em sandbox + compra real/estorno + jurídico/fiscal + QR testado. Sem esses itens, manter vitrine em modo «Compra online em breve».
