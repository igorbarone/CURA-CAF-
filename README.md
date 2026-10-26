# Cura Café — da roça à cidade

Site oficial da Cura Café, desenvolvido com Next.js, TypeScript e Tailwind CSS.

## Objetivo
Construir uma experiência de e-commerce de cafés especiais centrada em curadoria, origem e explicação simples. Referência funcional: coffeemais.com, sem copiar identidade, textos ou ativos de terceiros.

## Estado
Fundação do projeto. O catálogo começa com SAMBA e SALSA. **Não há checkout, pagamentos nem pedidos reais nesta fase.**

## Desenvolvimento
```bash
npm install
npm run dev
npm run build
```

## Publicação
Next.js configurado para exportação estática (GitHub Pages). Ativar **Settings > Pages > Build and deployment > Source: GitHub Actions**. Para e-commerce transacional será necessário integrar serviço externo de checkout/commerce; nunca colocar segredos no frontend.

## Documentação
- [Orientações para Codex](AGENTS.md)
- [Identidade e conteúdo](docs/IDENTIDADE.md)
- [Roadmap e critérios de aceite](docs/ROADMAP.md)

## Materiais originais
Os mockups e PDFs de identidade foram fornecidos na conversa e ainda precisam ser adicionados como assets autorizados ao repositório. Não reconstruir o logotipo digitando CURA em uma fonte.

## Home V2

A Home apresenta a seleção SAMBA/SALSA, a curadoria e o propósito da marca. Componentes de header, assinatura, percurso e cartões de café são reutilizáveis; os dados dos lotes ficam em `lib/coffees.ts`. A curva que vira reta conecta origem, escolha e cidade, usando as cores da identidade V2. Archivo, DM Mono e Newsreader itálica são hospedadas localmente via Fontsource.

Sem os assets originais, a marca textual é identificada como provisória. As embalagens são estudos gráficos em CSS, explicitamente identificados, e não reproduções de arte final. Não há fotografias de produtores, preços ou disponibilidade presumidos, checkout ou biografia inventada. A história apresenta apenas o propósito documentado da marca.

### Instalação e validação

Use Node.js 22 e `npm ci`. O lockfile versionado fixa a resolução das dependências. Execute:

```bash
npm run lint
GITHUB_PAGES=true npm run build
npx playwright install --with-deps chromium
npm test
```

Os testes Playwright verificam a exportação real em `/CURA-CAF-/`, em desktop e mobile: cafés e estados comerciais, navegação, menu mobile, ausência de overflow horizontal, fontes locais, recursos sem erros HTTP/JavaScript, acessibilidade com axe e preferência de movimento reduzido. Capturas são geradas em `test-results/`. Se já houver Chromium instalado, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test` em vez de baixar o navegador. `npm run test:build` reúne build Pages e testes.

Para desenvolvimento, execute `npm run dev` sem `GITHUB_PAGES`. Não rode dev e build simultaneamente, pois compartilham `.next`. A saída é estática (`out/`); `npm start` não serve esse modo de exportação. O CI valida pull requests e executa lint, build e testes antes da publicação no GitHub Pages. Não há alteração no caminho público ou dependência de servidor em produção.

Animações são curtas e respeitam `prefers-reduced-motion`. A navegação inclui link para pular ao conteúdo, estados de foco e menu nativo acessível sem JavaScript de aplicação. Catálogo e páginas individuais seguem como próximos itens do roadmap.

Validação local da Home V2: lint sem avisos; build estático Pages concluído; seis testes Playwright aprovados em Chromium (desktop 1280 px e mobile 390 px), incluindo axe sem violações nos critérios automatizados WCAG A/AA. Capturas desktop/mobile inspecionadas. Os assets originais de marca continuam pendentes; auditoria automatizada não substitui avaliação humana completa de acessibilidade.
