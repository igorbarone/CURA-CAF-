# Instruções para Codex — Cura Café

## Produto
Criar e evoluir o site oficial da Cura Café, com experiência editorial e comercial premium, humana e acessível. A marca é curadoria de café, **não** saúde, religião ou remédio.

## Stack
Next.js App Router + TypeScript + Tailwind CSS, com dois alvos de build (ver docs/COMMERCE-ARQUITETURA.md):
- **Estático** (padrão, GitHub Pages): sem runtime; loja desligada, checkout e pedido dizem "Compra online em breve".
- **Servidor** (`npm run build:server`): loja com API em `app/api/**/route.server.ts`, PostgreSQL, Mercado Pago e Melhor Envio.
- Preço, frete, estoque e status de pagamento são decididos só no servidor; nunca marcar pedido como pago pelo navegador.
- Nunca habilitar cobrança real (`CURA_ALLOW_LIVE_PAYMENTS`) nem publicar credenciais sem aprovação explícita da equipe. Não criar checkout falso, preço, desconto, urgência ou benefício inventado.

## Diretrizes obrigatórias
- Seguir docs/IDENTIDADE.md e docs/ROADMAP.md.
- Manual de 26/10/2026 prevalece: Marrom Cura #3A2618, creme #EFE9DD e ocre #BF9A50; apoio Breu #1E130C e creme claro #F7F3EA. Perfis subordinados: Rapadura, Anil, Amora, Ipê e Cacau.
- Tipos: Archivo Expanded (eixo wdth 125%, peso 700–800) para títulos; Archivo para textos/interface; DM Mono 400/500 para dados; Newsreader itálico 400 para voz humana.
- Logo e símbolo são desenhos proprietários. Usar os vetores oficiais extraídos em public/brand, sem redesenho, fonte substituta, espelhamento ou selo circular.
- Hierarquia de comunicação: “Democratizando café especial.” é o slogan principal; “Da roça à cidade.” é assinatura de origem; “Encontrado. Escolhido. Explicado.” é o método. B2B prioriza Food Service gastronômico.
- O slogan usa sempre o gerúndio: **“Democratizando café especial.”** (nunca “Democratizar café especial.”). Quando “democratizar” é verbo dentro de uma frase (“Democratizar é abrir a conversa”, “Democratizar também é servir”), mantém o infinitivo.
- Não inventar fazendas, altitude, safra, número de lotes provados, preço, depoimentos ou histórias de produtores.
- Os cafés reais iniciais são SAMBA (CURA-26-01, 84 pontos, torra média, rapadura/melaço) e SALSA (CURA-26-02, 86 pontos, torra clara, cítrico/laranja/tangerina). Outros nomes de mockup são **conceituais**.
- Não publicar fotografias sintéticas como imagens reais de produtores/fazendas.
- Referência coffeemais.com apenas para mapear funcionalidades públicas; criar implementação e visual próprios.
- Mobile-first, acessibilidade, SEO e desempenho.
- Qualquer botão de compra sem integração real deve dizer claramente 'Em breve' ou 'Demonstração'.
- Nunca colocar chaves privadas, tokens ou dados sensíveis no repositório.

## Processo
Trabalhar em alterações pequenas, rodar npm run build antes de concluir, registrar decisões no README. Prioridade: home, catálogo e produto; depois quiz, comparador, clube e carrinho demonstrativo. Não declarar funcionalidade concluída sem testar.
