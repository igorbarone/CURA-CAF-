# Cura Café V1 — apresentação ao sócio

## O que esta entrega permite mostrar

Uma única branch/PR reúne Home editorial, catálogo escalável, fichas dos cafés, descoberta sensorial, proposta de Clube, história e seleção comercial demonstrativa. Não houve merge ou deploy direto. As capturas do export real ficam em [screenshots](screenshots/README.md).

## Roteiro de 8–10 minutos

1. **Home**: apresentar a marca oficial fornecida, “Da roça à cidade” e os três verbos. Mostrar a seleção e o protagonismo de quem produz. Ressaltar que as fichas visuais são placeholders editoriais, não fotos de embalagens finais.
2. **Catálogo**: buscar por nota/produtor; filtrar por perfil, torra e preparo. Mostrar que filtros e quantidade vêm do conteúdo publicado, sem nomes de produtos fixos no componente.
3. **SAMBA e SALSA**: abrir as duas páginas, conferir breadcrumbs, notas, produtores, pontuação e origem. No estado atual há um lote publicado por café; o seletor aparece quando há vários lotes publicados. A origem detalhada de SAMBA e município/UF de SALSA continuam pendentes.
4. **Descubra seu café**: escolher “Doce e cremoso”, avançar com preparo/torra sem preferência e abrir a recomendação explicada. Recomeçar com “Frutado e cítrico”. Para mostrar ausência de correspondência, combinar “Doce e cremoso” com “Gelado”: a interface sugere ajustar respostas, sem inventar um resultado.
5. **História**: apresentar o propósito de curadoria sem biografia, visitas, certificados ou depoimentos inventados. Abrir o estudo de identidade: seus produtos são conceituais e não entram no catálogo.
6. **Clube Cura**: mostrar a proposta futura e as definições ainda necessárias. Não existe contratação, promessa de frequência, desconto ou lista de espera.
7. **Carrinho**: abrir o estado vazio e explicar o limite transacional. Hoje há zero ofertas reais cadastradas. A seleção por oferta já funciona quando ofertas reais publicadas existirem; isso é coberto por testes técnicos isolados. Não cadastrar preços/estoques falsos para “animar” a demonstração.
8. **CMS**: mostrar os grupos de conteúdo no Pages CMS, usando a instalação autorizada da equipe. Os textos editoriais da V1 ficam em “Conteúdo editorial V1”; os destaques em “Destaques da Home”. Conteúdo pode ser editado diretamente em `main`, como solicitado. Código continua em branch/PR. Não salvar uma mudança na apresentação se não quiser disparar o fluxo de publicação existente.

## Executar localmente, sem publicar

No computador usado na apresentação, fazer checkout desta branch, usar Node 22 e executar:

```bash
npm ci
GITHUB_PAGES=true npm run build
npm run present
```

O servidor local usa a porta 4173 e o caminho `/CURA-CAF-/`. Abrir esse caminho no navegador do próprio computador. Não é um serviço transacional nem um link público da nuvem. Se essa execução não estiver disponível, usar as capturas versionadas e o checklist abaixo. O site atualmente publicado em Pages não recebe esta V1 até revisão/merge e deploy pelo fluxo existente.

Para refazer as capturas após um build Pages, executar `npm run screenshots`. No ambiente com Chromium já instalado: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run screenshots`. O script inicia/encerra somente seu próprio servidor; a porta deve estar livre.

## Checklist demonstrável

- [x] Home responsiva com identidade oficial disponível, CTAs para catálogo e descoberta.
- [x] Navegação desktop/mobile e rodapé entre todas as páginas.
- [x] Catálogo dinâmico, busca, filtros e estado vazio recuperável.
- [x] Fichas de café/lote/oferta, fotos quando fornecidas e metadados de produto.
- [x] Seleção de lote e ligação do resultado do quiz ao lote correspondente.
- [x] Quiz funcional, explicável, sem cadastro, sem enviar respostas e com reinício/ajuste.
- [x] Tratamento de catálogo vazio, dados sensoriais pendentes e ausência de correspondência.
- [x] Clube e história com conteúdo honesto e editável.
- [x] Seleção demonstrativa de ofertas publicadas, persistida só na sessão do navegador, removível e sem criar pedido/reserva.
- [x] Compra desabilitada; nenhuma oferta fictícia acrescentada ao conteúdo real.
- [x] Conteúdo editorial em Pages CMS, preservando edição direta de conteúdo na main.
- [x] Canonicals, Open Graph/Twitter, sitemap, robots, idioma pt-BR e foco visível.
- [x] Movimento reduzido, formulários com legendas e auditoria automatizada de acessibilidade.

## Pendências reais para lançamento comercial

Definir operador de commerce, planos do Clube, preços, estoque autoritativo, peso, moagem, variantes, frete, pagamentos, pedidos, atendimento, privacidade/termos da operação e testes transacionais. Confirmar dados de origem ainda ausentes. Fornecer fotos finais e arquivo de logo isolado conforme [ASSETS-V1.md](ASSETS-V1.md).

A seleção local de ofertas não valida disponibilidade; pode ficar desatualizada após publicação. IDs inexistentes são descartados ao carregar a sessão. Não existe subtotal de pedido, quantidade reservada ou botão de checkout. O CMS não é fonte de estoque em tempo real.

## Validação e limites

O pipeline mantém validação de conteúdo, lint, unidades, export com cenários técnicos, catálogo vazio e regressões desktop/mobile antes do export real final. Os cenários técnicos nunca são publicados nem copiados para o conteúdo real. A seleção de ofertas é testada com valores comerciais desconhecidos, sem adicionar valores fictícios.

Capturas e auditorias automatizadas não substituem testes em aparelhos físicos, avaliação humana completa de acessibilidade, direitos de imagem e aprovação de conteúdo pelo sócio. O resultado deste PR é uma experiência demonstrável, não uma loja transacional ativa.
