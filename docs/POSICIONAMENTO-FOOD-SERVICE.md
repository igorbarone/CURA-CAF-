# Posicionamento e Food Service

## Hierarquia da comunicação

O pedido editorial da equipe define **Democratizar café especial.** como slogan principal. **Da roça à cidade.** continua como assinatura de origem e **Encontrado. Escolhido. Explicado.** como método de curadoria. Isso atualiza a hierarquia da comunicação, preservando os vetores proprietários, a identidade marrom/creme/ocre e as fontes do manual de 26/10/2026.

O slogan ocupa o H1 da Home. A assinatura de origem acompanha o símbolo oficial; o método mantém seu espaço de apoio. A narrativa de Nossa História e os metadados da Home/institucionais refletem o propósito. A seção explicativa da democratização continua detalhando linguagem, conhecimento e experiência. Não há promessa de preço baixo, acesso universal ou vantagem comercial.

## Página `/empresas/`

A proposta passa a priorizar **Food Service**, com a mensagem “Um café à altura da experiência que você oferece.” e o CTA “Quero servir Cura Café”. O CTA leva à seção de parceria e informa que o canal está em preparação; não envia uma solicitação.

A página reúne seis partes:

1. Hero com proposta gastronômica e CTA.
2. Restaurantes/bistrôs, cafeterias, padarias artesanais e hotelaria/hospitalidade como públicos-alvo; sem afirmar uma carteira de clientes ou atendimento já contratado.
3. Curadoria, perfis sensoriais, origem/produtor, explicações acessíveis e possibilidade de relacionamento recorrente sujeita à negociação.
4. Cafés publicados pelo mesmo `getCatalog()` usado no catálogo, com `projectCoffee()` e `CoffeeCard`. Nome, perfil, pontuação, torra, produtor e preparos vêm dos lotes reais. Não há segunda base nem lista fixa de SAMBA/SALSA. Catálogo vazio recebe mensagem editorial.
5. “Democratizar também é servir”: o estabelecimento como ponto de encontro entre produtores, curadoria e público.
6. Seção de parceria com estado honesto de canal indisponível e informações previstas para uma conversa futura.

A proposta genérica para escritórios foi retirada. Não foram acrescentados treinamento, máquinas, consultoria, logística, suporte, preços de atacado, descontos, mínimos, frete, prazos ou capacidade de fornecimento.

## Captação: estado atual e ativação futura

Não existe destino real configurado na implementação para receber interessados. Portanto, a alternativa atual é editorial: explica o estado do canal e permite conhecer os cafés. Não há formulário, submissão, dados guardados no navegador, confirmação fictícia ou contato inventado.

A seção recolhível apresenta os sete grupos de informações previstos, sem coletá-los:

| Informação | Exigência prevista |
| --- | --- |
| Nome do estabelecimento | Obrigatória |
| Nome do responsável | Obrigatória |
| Segmento | Obrigatória |
| Cidade e estado | Obrigatória |
| Contato comercial para retorno | Obrigatória |
| Consumo mensal estimado | Opcional |
| Mensagem ou necessidade | Obrigatória |

Para ativar, a equipe precisa definir responsável comercial, destino real de envio e retorno, finalidade/tratamento dos dados e operação comercial. Depois, implementar integração com serviço externo compatível com o export estático, validação de campos no cliente e serviço, proteção contra spam e estados acessíveis. Exibir sucesso somente após o serviço confirmar recebimento. Segredos ficam no serviço, nunca no cliente ou CMS. Captação não cria pedido, reserva ou contrato.

## Operação no Pages CMS

- **Hero da Home**: as duas linhas do título representam o slogan prioritário; **Assinatura de origem** administra a frase ao lado do símbolo.
- **Nossa história**: introdução e parágrafos institucionais.
- **Para empresas — Food Service**: hero, CTA, segmentos, diferenciais, apresentação/estado vazio dos cafés, propósito e seção de parceria com informações futuras.
- Os cafés permanecem nas coleções existentes, separados em café, lote e oferta. O vínculo da imagem ao lote e a correção dos filtros do PR #7 foram preservados.

Editar o CTA ou as informações previstas não ativa envio. Conteúdo editorial continua podendo ser alterado diretamente na main pelo CMS; alterações de código seguem branch/PR. Não foram alterados workflows, permissões, integrações do CMS ou credenciais.

## Revisão

A [galeria desktop/mobile](screenshots/README.md) inclui Home, história, Food Service, catálogo e o caso torra clara/SALSA/86 pontos. O PR anterior já estava incorporado, por isso a entrega segue em nova branch, sem merge automático ou deploy direto.

## Validações executadas

- Conteúdo real: 2 cafés, 2 lotes e 0 ofertas. Nenhuma alteração dos dados dos lotes ou das condições comerciais.
- `npm run lint` e `npx tsc --noEmit` aprovados. Corrigida uma tipagem de âncora na auditoria de links dos testes, sem mudança de comportamento.
- `npm test`: 25 unitários e 44 E2E desktop/mobile aprovados, incluindo acessibilidade, CTA, catálogo compartilhado e hierarquia de comunicação.
- `npm run test:scenarios`: 10 E2E de cenários editoriais e 40 E2E com catálogo vazio aprovados. Builds estáticos dos cenários, vazio e produção concluídos; fixtures removidas e export final restaurado com conteúdo real.
- 22 capturas atuais desktop/mobile para revisão visual. Next.js, basePath `/CURA-CAF-/`, Pages CMS e publicação editorial na main preservados.

Home e B2B também foram conferidas sem transbordamento horizontal em 320, 390, 768, 1024, 1280 e 1440 px; revisão visual do hero e da página Food Service em desktop/mobile concluída.
