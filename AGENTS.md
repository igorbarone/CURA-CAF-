# Instruções para Codex — Cura Café

## Produto
Criar e evoluir o site oficial da Cura Café, com experiência editorial e comercial premium, humana e acessível. A marca é curadoria de café, **não** saúde, religião ou remédio.

## Stack
Next.js App Router + TypeScript + Tailwind CSS. Exportação estática para GitHub Pages inicialmente. Componentes sem dependência de servidor em runtime. Não adicionar banco de dados ou checkout falso.

## Diretrizes obrigatórias
- Seguir docs/IDENTIDADE.md e docs/ROADMAP.md.
- Usar creme #EFE9DD, verde #17352A e ocre #BF9A50; marrom #3A2618 nas embalagens.
- Tipos: Archivo (títulos/texto), DM Mono (dados), Newsreader itálico (voz humana).
- Logo é arte desenhada, não texto de fonte. Usar arquivo original quando disponível; até lá, placeholder textual identificado.
- Não inventar fazendas, altitude, safra, número de lotes provados, preço, depoimentos ou histórias de produtores.
- Os cafés reais iniciais são SAMBA (CURA-26-01, 84 pontos, torra média, rapadura/melaço) e SALSA (CURA-26-02, 86 pontos, torra clara, cítrico/laranja/tangerina). Outros nomes de mockup são **conceituais**.
- Não publicar fotografias sintéticas como imagens reais de produtores/fazendas.
- Referência coffeemais.com apenas para mapear funcionalidades públicas; criar implementação e visual próprios.
- Mobile-first, acessibilidade, SEO e desempenho.
- Qualquer botão de compra sem integração real deve dizer claramente 'Em breve' ou 'Demonstração'.
- Nunca colocar chaves privadas, tokens ou dados sensíveis no repositório.

## Processo
Trabalhar em alterações pequenas, rodar npm run build antes de concluir, registrar decisões no README. Prioridade: home, catálogo e produto; depois quiz, comparador, clube e carrinho demonstrativo. Não declarar funcionalidade concluída sem testar.
