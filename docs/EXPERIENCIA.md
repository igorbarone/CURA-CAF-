# CURA Experience — Fase 1 (MVP)

Plataforma educativa acessada **exclusivamente** pelo QR Code único das embalagens. Integrada ao site: mesmo Next.js, Header/Footer, tema Black, tokens de cor, tipografia, catálogo e rotas de produto. Não há checkout paralelo, cadastro ou login.

## QR Code

Endereço permanente para imprimir nas embalagens:

```
https://<domínio-da-cura>/experiencia/?origem=qr
```

- Novos cafés aparecem a partir do catálogo, sem trocar o código.
- Recomendação: apontar o QR para um domínio próprio da Cura (ex.: `cura.cafe/experiencia/?origem=qr`), não para `*.vercel.app`, para que uma troca de hospedagem não invalide as embalagens já impressas.
- `?origem=qr` (ou `utm_medium=qr`) marca a visita na sessão da aba. Os links comerciais passam a levar `utm_source=embalagem&utm_medium=qr&utm_campaign=cura-experience`, para atribuir conversões sem coletar dados pessoais.

## Acesso e descoberta

- Não há link público de entrada: menu, home, rodapé, fichas de produto e sitemap não apontam para `/experiencia`. A entrada é o QR Code.
- Todas as embalagens usam o mesmo QR. Não há autenticação, senha, cadastro nem validação de compra nesta versão. Se alguém compartilhar o link, tudo bem.
- Todas as rotas `/experiencia/**` recebem `<meta name="robots" content="noindex, nofollow">` pelo layout. Isso só evita indexação em buscadores: **não é mecanismo de segurança nem restrição de acesso**. O `robots.txt` não bloqueia a rota, porque o buscador precisa ler a página para respeitar o `noindex`.
- Os links internos da experiência (entre suas páginas) e os de recompra para `/cafes/{slug}/` continuam normais.

## Rotas

| Rota | Conteúdo |
| --- | --- |
| `/experiencia/` | Abertura, três caminhos livres e seleção do café |
| `/experiencia/cafes/` e `/experiencia/cafes/{slug}/` | Meu Café: ficha, perfil sensorial, preparo sugerido, Jornada da Origem (terra, produtor, colheita, torra, xícara), lições relacionadas e recompra |
| `/experiencia/origem/` | Jornada genérica da fazenda à xícara |
| `/experiencia/aprender/` e `/experiencia/aprender/{modulo}/` | Academia Cura: 3 módulos, roda sensorial (módulo 2) e simulador de extração (módulo 3), carregados sob demanda |
| `/experiencia/preparar/` | Laboratório: café, método (8 equipamentos), quantidade (xícaras, café ou água), intensidade, modo iniciante/avançado, receita, calculadora, passo a passo, cronômetro e diagnóstico. Aceita `?cafe=`, `?metodo=` e `?xicaras=` |
| `/experiencia/barista/` | Barista Cura (respostas estruturadas) |
| `/experiencia/paladar/` | Quiz "Descubra seu paladar" |

Navegação: barra superior no desktop e barra inferior fixa no celular (Início, Meu Café, Aprender, Preparar, Barista). O guia de preparo está a um toque.

## Dados e regra de não inventar

O modelo `ExperienceCoffee` (`lib/experience/coffee.ts`) é uma projeção do café + lote publicado; todos os campos além da identidade são opcionais e a interface oculta o que falta. Campos novos no **lote** (Pages CMS → Lotes, prefixo "Experiência"):

| Campo | Situação atual |
| --- | --- |
| `region`, `altitudeMeters`, `process`, `harvest` | SAMBA e SALSA: Campos Altos – MG, 1.200 m, Natural, 2026 (rótulos de 10/11/2026) |
| `farm` | SALSA: Fazenda Serrinha. SAMBA: vazio (o rótulo não traz fazenda) |
| `latitude`, `longitude` | Vazios em todos. O link de mapa só aparece quando os dois são preenchidos com a coordenada real e autorizada |
| `intensityLevel`, `acidityLevel`, `sweetnessLevel`, `bodyLevel` | Vazios. Escala documentada **1–5** (1 muito baixa · 2 baixa · 3 média · 4 alta · 5 muito alta); preencher só a partir de ficha sensorial oficial |
| DA CASA | Sem origem, pontuação ou notas no rótulo: só aparecem nome, descrição, categoria "Café gourmet" e imagens |

A categoria é derivada dos dados (lote com pontuação ≥ 80 → "Café especial"; Linha Casa → "Café gourmet"). Não há clima, características de cultivo, fotos de produtores ou histórias sem confirmação: esses blocos ficam ocultos ou mostram só conteúdo educativo genérico.

**Para cadastrar um novo café:** criar café, lote e oferta no CMS como hoje. A experiência, o quiz, o Barista e o laboratório o reconhecem sem mudança de código.

## Conteúdo editável (`content/experience/`)

| Arquivo | O que controla |
| --- | --- |
| `methods.json` | Métodos, proporções por intensidade, moagem, temperatura, tempo, passos e tempos de despejo do cronômetro (`at`, `pour`) |
| `academy.json` | Módulos, lições e atributos da roda sensorial |
| `journey.json` | Abertura, caminhos, terroir, curadoria, ciclo do café, níveis de torra e mensagem da xícara |
| `diagnosis.json` | "Como ficou seu café?", observações e sugestões ordenadas (por método quando houver) |
| `taste.json` | Perguntas do quiz, perfis e palavras-chave que reconhecem traços nos atributos publicados |
| `barista.json` | Base de conhecimento do Barista (tópicos, palavras-chave, respostas, links) |

Todos são validados com Zod no `prebuild` (`npm run validate:content`): proporções coerentes, despejos crescentes terminando em 100%, referências entre perfis, traços, tópicos e métodos. Textos usam placeholders `{coffee}`, `{water}`, `{bloom}`, `{target}` e `{yield}`, preenchidos pela receita. A edição é feita nos JSON (via Git ou PR); ainda não há formulário no Pages CMS para esses arquivos.

## Lógica (pura e testada)

- `lib/experience/brew.ts`: Água (g) = Café (g) × Proporção; receitas por xícaras, café ou água; pré-infusão = café × fator; cronograma do cronômetro; avisos de capacidade. No espresso, a proporção é sobre a **bebida** (rendimento) e uma "xícara" é uma dose.
- `lib/experience/diagnosis.ts`: conselho do método primeiro, depois os gerais não cobertos; sempre "mude uma variável por vez".
- `lib/experience/taste.ts`: perfil por pontos + recomendação apenas por traços encontrados nos atributos publicados, com a evidência exibida.
- `lib/experience/extraction.ts`: modelo educativo monotônico para o simulador (faixa de referência 18–22 % de extração e 1,15–1,45 % de concentração), apresentado como tendência, não como medida.
- O cronômetro usa timestamps, então continua correto com a aba em segundo plano. Som e vibração são opcionais e ficam desligados por padrão.

## Barista Cura e IA futura

O MVP (`lib/experience/barista.ts`) é determinístico: fluxos de diagnóstico (pergunta o método e a moagem antes de sugerir), receita, recomendação e visão geral dos métodos, além de tópicos da base. Fora do que sabe, responde que não sabe. Dados de café vêm apenas do catálogo publicado. As mensagens não são guardadas nem enviadas.

Integração futura com IA, usando a interface `BaristaProvider`:

1. Rota de servidor (ex.: `app/api/barista/route.ts`, só no alvo servidor/Vercel) com a chave em variável de ambiente. Nunca usar `NEXT_PUBLIC_*` e nunca chamar o modelo pelo navegador.
2. Enviar ao modelo apenas a base (`barista.json`, lições, métodos, diagnóstico) e os `ExperienceCoffee` publicados, com instrução de responder só a partir desse contexto e de dizer quando não souber.
3. Limite de taxa, tamanho máximo de mensagem, sem registro de texto livre, aviso visível de IA e revisão de privacidade (LGPD) antes de ativar.
4. Em erro ou indisponibilidade, cair no provedor local atual.

## Analytics

Eventos em `window.dataLayer` (`lib/experience/analytics.ts`): `experience_open` (com `source: qr|direto`), `experience_start`, `coffee_select`, `content_view`, `method_select`, `recipe_generate`, `timer_start`, `tutorial_complete`, `diagnosis_select`, `barista_message` (tipo/fluxo, nunca o texto), `quiz_complete` e `product_click`. Como no funil de e-commerce, nenhum script de analytics é carregado até existir o banner de consentimento.

## Armazenamento local

Só no navegador, todo acesso com try/catch: último café aberto, última receita, nível iniciante/avançado (localStorage), anotações da roda sensorial e origem da visita (sessionStorage). Nenhum dado pessoal. A persistência em banco fica para as fases 2 e 3.

## Testes

- `tests/unit/experience.test.ts`: calculadora, receitas de todos os métodos, cronograma da V60, cronômetro, encaixe com o rótulo, projeção sem dados inventados, diagnóstico, quiz, Barista e atribuição de QR.
- `tests/experience.spec.ts`: axe WCAG A/AA nos temas creme e Black, ausência de erros de console e de rolagem horizontal em todas as rotas (desktop e celular), entrada pelo QR, ficha do café com link UTM, laboratório completo com relógio simulado (iniciar, pausar, continuar, reiniciar), Barista, quiz, barra inferior, movimento reduzido, `noindex` em todas as rotas e ausência de links públicos e de entradas no sitemap.

## Decisões

- **Slogan:** o pedido dizia "DEMOCRATIZAR CAFÉ ESPECIAL." A decisão da equipe registrada em `AGENTS.md`/`docs/IDENTIDADE.md` é usar sempre o gerúndio: **"Democratizando café especial."** A experiência não reescreve o slogan.
- **Mapa:** sem coordenadas reais, o mapa interativo não aparece. Quando a coordenada for cadastrada, um link para o OpenStreetMap é exibido; o mapa embutido fica para a Fase 2.
- **Imagens:** as ilustrações de embalagem sempre levam o selo "Ilustração digital". Não há fotos de produtores.
- **Quiz existente (`/descubra/`):** mantido. O novo quiz de paladar trabalha com perfis de preferência e aponta para o mesmo catálogo.

## Pendências (dados reais necessários)

Coordenadas autorizadas das fazendas, fotos reais e histórias aprovadas dos produtores, ficha sensorial oficial com escala 1–5, informações de clima e cultivo, e o domínio definitivo para o QR.

## Próximas fases

- **Fase 2:** mapa interativo, histórias aprofundadas, "Minha Xícara" com gráfico e comparação com a ficha oficial, compartilhamento visual, conquistas e "Minha jornada no café", formulários do Pages CMS para `content/experience/`.
- **Fase 3:** Barista com IA no servidor, recomendações personalizadas, histórico persistente com consentimento e métricas avançadas.
